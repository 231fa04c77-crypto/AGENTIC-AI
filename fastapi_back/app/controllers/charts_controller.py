from datetime import datetime, timedelta
from collections import defaultdict
from app.config.db import db
from app.models import doctor_model, user_model


def _hour_label(h: int) -> str:
    if h == 0:
        return "12 AM"
    if h < 12:
        return f"{h} AM"
    if h == 12:
        return "12 PM"
    return f"{h - 12} PM"


def _day_labels_last7():
    today = datetime.now().date()
    return [(today - timedelta(days=i)).strftime("%a") for i in range(6, -1, -1)]


def _parse_ts(row) -> datetime | None:
    for key in ("created_at", "date", "slot_date"):
        val = row.get(key)
        if val is None:
            continue
        if isinstance(val, datetime):
            return val
        if isinstance(val, (int, float)):
            try:
                if val > 1e12:
                    return datetime.fromtimestamp(val / 1000)
                return datetime.fromtimestamp(val)
            except (ValueError, OSError):
                pass
        if isinstance(val, str):
            for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%d-%m-%Y"):
                try:
                    return datetime.strptime(val[:10], fmt)
                except ValueError:
                    continue
    return None


async def get_admin_chart_stats():
    today = datetime.now().date()
    appointments = await db.query(
        "SELECT * FROM appointments ORDER BY created_at DESC LIMIT 5000"
    )
    users = await user_model.get_all_users_minimal()
    doctors = await doctor_model.get_all_doctors()

    payments_by_hour: dict[int, float] = defaultdict(float)
    appts_by_hour: dict[int, int] = defaultdict(int)

    for row in appointments or []:
        ts = _parse_ts(row)
        if not ts or ts.date() != today:
            continue
        hour = ts.hour
        appts_by_hour[hour] += 1
        if row.get("payment"):
            try:
                payments_by_hour[hour] += float(row.get("amount") or 0)
            except (TypeError, ValueError):
                pass

    payments_today = [
        {"hour": _hour_label(h), "amount": round(payments_by_hour.get(h, 0), 2)}
        for h in range(8, 21)
    ]
    appointments_per_hour = [
        {"hour": _hour_label(h), "count": appts_by_hour.get(h, 0)}
        for h in range(8, 21)
    ]

    patient_count = len(users or [])
    doctor_count = len(doctors or [])
    dean_rows = await db.query("SELECT COUNT(*)::int AS c FROM deans")
    dean_count = (dean_rows[0]["c"] if dean_rows else 0) or 0

    users_by_role = [
        {"role": "Admin", "count": 1},
        {"role": "Dean", "count": dean_count},
        {"role": "Doctor", "count": doctor_count},
        {"role": "Patient", "count": max(patient_count - doctor_count, 0)},
    ]

    return {
        "paymentsToday": payments_today,
        "usersByRole": users_by_role,
        "appointmentsPerHour": appointments_per_hour,
    }


async def get_dean_chart_stats(hospital_id: int):
    doctors = await doctor_model.get_doctors_by_hospital_id(hospital_id)
    appointments = await db.query(
        """
        SELECT a.* FROM appointments a
        JOIN doctors d ON a.doctor_id = d.id
        WHERE d.hospital_id = $1
        ORDER BY a.created_at DESC LIMIT 3000
        """,
        hospital_id,
    )

    dept_load: dict[str, int] = defaultdict(int)
    for doc in doctors or []:
        spec = doc.get("speciality") or doc.get("specialty") or "General"
        dept_load[str(spec)] += 1

    if not dept_load:
        dept_load["General"] = 0

    busy = 0
    available = 0
    off_duty = 0
    for doc in doctors or []:
        avail = doc.get("available")
        if avail is False:
            off_duty += 1
        elif avail is True:
            available += 1
        else:
            busy += 1

    if available + busy + off_duty == 0:
        available = len(doctors or [])

    day_labels = _day_labels_last7()
    today = datetime.now().date()
    revenue_by_day: dict[str, float] = {d: 0.0 for d in day_labels}

    for row in appointments or []:
        if not row.get("payment"):
            continue
        ts = _parse_ts(row)
        if not ts:
            continue
        label = ts.strftime("%a")
        if label in revenue_by_day:
            try:
                revenue_by_day[label] += float(row.get("amount") or 0)
            except (TypeError, ValueError):
                pass

    return {
        "deptLoad": [{"dept": k, "count": v} for k, v in dept_load.items()],
        "doctorAvailability": [
            {"status": "Available", "count": available},
            {"status": "Busy", "count": busy},
            {"status": "Off-duty", "count": off_duty},
        ],
        "weeklyRevenue": [
            {"day": d, "amount": round(revenue_by_day[d], 2)} for d in day_labels
        ],
    }


async def get_doctor_chart_stats(doctor_id: int):
    appointments = await db.query(
        "SELECT * FROM appointments WHERE doctor_id = $1 ORDER BY created_at DESC LIMIT 2000",
        doctor_id,
    )

    pending = completed = cancelled = 0
    today = datetime.now().date()
    queue_length = 0

    for row in appointments or []:
        if row.get("cancelled"):
            cancelled += 1
            continue
        if row.get("is_completed"):
            completed += 1
        else:
            pending += 1
            ts = _parse_ts(row)
            slot = row.get("slot_date")
            slot_date = None
            if isinstance(slot, str):
                try:
                    slot_date = datetime.strptime(slot[:10], "%Y-%m-%d").date()
                except ValueError:
                    pass
            elif isinstance(slot, datetime):
                slot_date = slot.date()
            if (ts and ts.date() == today) or slot_date == today:
                queue_length += 1

    day_labels = _day_labels_last7()
    earnings_by_day: dict[str, float] = {d: 0.0 for d in day_labels}

    for row in appointments or []:
        if not row.get("payment"):
            continue
        ts = _parse_ts(row)
        if not ts:
            continue
        label = ts.strftime("%a")
        if label in earnings_by_day:
            try:
                earnings_by_day[label] += float(row.get("amount") or 0)
            except (TypeError, ValueError):
                pass

    return {
        "myAppointments": [
            {"status": "Pending", "count": pending},
            {"status": "Completed", "count": completed},
            {"status": "Cancelled", "count": cancelled},
        ],
        "queueLength": queue_length,
        "weeklyEarnings": [
            {"day": d, "amount": round(earnings_by_day[d], 2)} for d in day_labels
        ],
    }
