/**
 * Booking storm — N VUs race to book the same slot.
 *
 * Pass criteria (after Phase 1 transactional booking):
 *   - At most one VU receives success:true for the contested slot
 *   - Others get conflict / already booked / capacity errors (4xx or success:false)
 *
 * Env:
 *   BASE_URL, AUTH_TOKEN (patient JWT), DOC_ID, SLOT_DATE, SLOT_TIME, SLOT_ID (optional)
 *   BOOKING_VUS (default 50), BOOKING_DURATION (default "15s")
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";

const BASE = __ENV.BASE_URL || "http://127.0.0.1:5000";
const TOKEN = __ENV.AUTH_TOKEN || "";
const DOC_ID = __ENV.DOC_ID || "1";
const SLOT_DATE = __ENV.SLOT_DATE || "2026-08-01";
const SLOT_TIME = __ENV.SLOT_TIME || "10:00";
const SLOT_ID = __ENV.SLOT_ID || "";
const VUS = Number(__ENV.BOOKING_VUS || 50);

const bookingSuccess = new Counter("booking_success");
const bookingFail = new Counter("booking_fail");
const bookingLatency = new Trend("booking_latency_ms");

export const options = {
  scenarios: {
    storm: {
      executor: "constant-vus",
      vus: VUS,
      duration: __ENV.BOOKING_DURATION || "15s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.5"],
    booking_latency_ms: ["p(95)<3000"],
  },
};

export default function () {
  if (!TOKEN) {
    throw new Error("AUTH_TOKEN is required");
  }

  const form = {
    docId: DOC_ID,
    slotDate: SLOT_DATE,
    slotTime: SLOT_TIME,
    symptoms: "[]",
    paymentMethod: "payOnVisit",
    mode: "offline",
    actualPatient: JSON.stringify({ isSelf: true }),
  };
  if (SLOT_ID) {
    form.slotId = String(SLOT_ID);
  }

  const res = http.post(`${BASE}/api/user/book-appointment`, form, {
    headers: { token: TOKEN, Authorization: `Bearer ${TOKEN}` },
    tags: { name: "book_appointment" },
  });

  bookingLatency.add(res.timings.duration);

  let ok = false;
  try {
    const body = res.json();
    ok = res.status === 200 && body && body.success === true;
  } catch (_) {
    ok = false;
  }

  if (ok) {
    bookingSuccess.add(1);
  } else {
    bookingFail.add(1);
  }

  check(res, {
    "status is 2xx or 4xx (not 5xx)": (r) => r.status < 500,
  });

  sleep(0.1);
}

export function handleSummary(data) {
  const success =
    (data.metrics.booking_success && data.metrics.booking_success.values.count) || 0;
  const note =
    success <= 1
      ? `PASS heuristic: booking_success=${success} (ideal = 1 for same slot).`
      : `FAIL heuristic: booking_success=${success} > 1 — investigate slot race (Phase 1).`;
  return {
    stdout: `\n${note}\nSee docs/enterprise/ENTERPRISE_SCALABILITY_AUDIT_2026-07-20.md §9\n`,
  };
}
