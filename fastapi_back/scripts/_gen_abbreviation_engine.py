"""Generate Module 6 Abbreviation Engine YAML configs."""
from __future__ import annotations

from pathlib import Path

import yaml

OUT = Path(__file__).resolve().parents[1] / "app/services/ai/abbreviation/config"


def row(
    id: str,
    abbreviation: str,
    expanded: str,
    category: str,
    *,
    canonical: str | None = None,
    aliases: list[str] | None = None,
    contexts: list[str] | None = None,
    sense_id: str | None = None,
) -> dict:
    d = {
        "id": id,
        "abbreviation": abbreviation,
        "expanded": expanded,
        "canonical": canonical or expanded,
        "category": category,
        "aliases": aliases or [],
        "contexts": contexts or [],
        "aliases_hi": [],
        "aliases_te": [],
    }
    if sense_id:
        d["sense_id"] = sense_id
    return d


def dump(name: str, category: str, entries: list[dict]) -> None:
    path = OUT / name
    path.write_text(
        yaml.dump(
            {"version": 1, "category": category, "entries": entries},
            sort_keys=False,
            allow_unicode=True,
            width=100,
            default_flow_style=False,
        ),
        encoding="utf-8",
    )
    print(f"  {name}: {len(entries)}")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    dump(
        "vitals.yaml",
        "Vitals",
        [
            row("bp", "BP", "Blood Pressure", "Vitals"),
            row("hr", "HR", "Heart Rate", "Vitals"),
            row("rr", "RR", "Respiratory Rate", "Vitals"),
            row("spo2", "SpO2", "Oxygen Saturation", "Vitals", aliases=["spo2", "SPO2"]),
            row("temp", "Temp", "Temperature", "Vitals", aliases=["TMP"]),
            row("bmi", "BMI", "Body Mass Index", "Vitals"),
        ],
    )

    dump(
        "laboratory.yaml",
        "Laboratory",
        [
            row("cbc", "CBC", "Complete Blood Count", "Laboratory"),
            row("lft", "LFT", "Liver Function Test", "Laboratory"),
            row("kft", "KFT", "Kidney Function Test", "Laboratory"),
            row("rft", "RFT", "Renal Function Test", "Laboratory"),
            row("hba1c", "HbA1c", "Glycated Hemoglobin", "Laboratory", aliases=["HBA1C", "A1C"]),
            row("rbs", "RBS", "Random Blood Sugar", "Laboratory"),
            row("fbs", "FBS", "Fasting Blood Sugar", "Laboratory"),
            row("ppbs", "PPBS", "Post Prandial Blood Sugar", "Laboratory"),
            row("ecg", "ECG", "Electrocardiogram", "Laboratory", aliases=["EKG"]),
            row("tsh", "TSH", "Thyroid Stimulating Hormone", "Laboratory"),
        ],
    )

    dump(
        "radiology.yaml",
        "Radiology",
        [
            row("mri", "MRI", "Magnetic Resonance Imaging", "Radiology"),
            row("ct", "CT", "Computed Tomography", "Radiology", aliases=["CAT"]),
            row("usg", "USG", "Ultrasonography", "Radiology"),
            row("pet", "PET", "Positron Emission Tomography", "Radiology"),
            row("xr", "XR", "X-Ray", "Radiology", aliases=["XRAY"]),
        ],
    )

    dump(
        "specialties.yaml",
        "Specialty",
        [
            row("ent", "ENT", "Ear Nose Throat", "Specialty", canonical="Ear Nose Throat Specialist"),
            row("gp", "GP", "General Physician", "Specialty"),
            row("obg", "OBG", "Obstetrics and Gynecology", "Specialty", aliases=["OBGYN"]),
            row("ortho", "Ortho", "Orthopedics", "Specialty"),
            row("neuro", "Neuro", "Neurology", "Specialty"),
            row("cardio", "Cardio", "Cardiology", "Specialty"),
        ],
    )

    dump(
        "diseases.yaml",
        "Disease",
        [
            row("htn", "HTN", "Hypertension", "Disease"),
            row("dm", "DM", "Diabetes Mellitus", "Disease"),
            row("cad", "CAD", "Coronary Artery Disease", "Disease"),
            row("copd", "COPD", "Chronic Obstructive Pulmonary Disease", "Disease"),
            row("ckd", "CKD", "Chronic Kidney Disease", "Disease"),
        ],
    )

    dump(
        "medicines.yaml",
        "Medicine",
        [
            row("pcm", "PCM", "Paracetamol", "Medicine"),
            row("ors", "ORS", "Oral Rehydration Solution", "Medicine"),
            row("iv", "IV", "Intravenous", "Medicine"),
            row("im", "IM", "Intramuscular", "Medicine"),
            row("po", "PO", "Oral Administration", "Medicine"),
        ],
    )

    dump(
        "departments.yaml",
        "Department",
        [
            row("icu", "ICU", "Intensive Care Unit", "Department"),
            row("opd", "OPD", "Outpatient Department", "Department"),
            row("ipd", "IPD", "Inpatient Department", "Department"),
            row("er", "ER", "Emergency Room", "Department", aliases=["A&E"]),
        ],
    )

    dump(
        "navigation.yaml",
        "Navigation",
        [
            row("rx", "Rx", "Prescription", "Navigation"),
            row("appt", "Appt", "Appointment", "Navigation", aliases=["APT"]),
        ],
    )

    dump(
        "medical.yaml",
        "Medical",
        [
            row(
                "op_outpatient",
                "OP",
                "Out Patient",
                "Medical",
                sense_id="outpatient",
                contexts=["ticket", "opd", "visit", "consultation", "clinic", "registration"],
            ),
            row(
                "op_operation",
                "OP",
                "Operation",
                "Medical",
                sense_id="operation",
                contexts=["scheduled", "surgery", "theatre", "ot", "surgical", "operation"],
            ),
            row(
                "op_operator",
                "OP",
                "Operator",
                "Medical",
                sense_id="operator",
                contexts=["call", "helpline", "phone", "operator"],
            ),
            row("ot", "OT", "Operation Theatre", "Medical"),
            row("dob", "DOB", "Date of Birth", "Medical"),
            row("mrn", "MRN", "Medical Record Number", "Medical"),
        ],
    )

    print(f"Wrote abbreviation configs to {OUT}")


if __name__ == "__main__":
    main()
