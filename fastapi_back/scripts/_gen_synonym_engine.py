"""Generate Module 5 Synonym Engine YAML configs."""
from __future__ import annotations

from pathlib import Path

import yaml

OUT = Path(__file__).resolve().parents[1] / "app/services/ai/synonym/config"


def entry(
    id: str,
    canonical: str,
    category: str,
    *,
    synonyms: list[str] | None = None,
    aliases: list[str] | None = None,
    abbreviations: list[str] | None = None,
    misspellings: list[str] | None = None,
    plurals: list[str] | None = None,
    regions: list[str] | None = None,
) -> dict:
    d: dict = {
        "id": id,
        "canonical": canonical,
        "category": category,
        "synonyms": synonyms or [],
        "aliases": aliases or [],
        "abbreviations": abbreviations or [],
        "misspellings": misspellings or [],
        "plurals": plurals or [],
    }
    if regions:
        d["regions"] = regions
    return d


def dump(name: str, category: str, entries: list[dict]) -> None:
    path = OUT / name
    doc = {"version": 1, "category": category, "entries": entries}
    path.write_text(
        yaml.dump(doc, sort_keys=False, allow_unicode=True, width=100, default_flow_style=False),
        encoding="utf-8",
    )
    print(f"  {name}: {len(entries)}")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    dump(
        "specialties.yaml",
        "specialty",
        [
            entry("derm", "Dermatologist", "specialty", synonyms=["skin doctor", "skin specialist", "skin physician"], aliases=["derm doctor"], misspellings=["dermotologist", "dermatolgist"]),
            entry("cardio", "Cardiologist", "specialty", synonyms=["heart doctor", "heart specialist", "cardiac doctor", "heart physician", "cardiac specialist"], misspellings=["cardioligist", "cardialogist"]),
            entry("nephro", "Nephrologist", "specialty", synonyms=["kidney doctor", "kidney specialist", "renal doctor"]),
            entry("pedia", "Pediatrician", "specialty", synonyms=["children doctor", "child doctor", "kids doctor", "child specialist", "paediatrician"]),
            entry("ophtho", "Ophthalmologist", "specialty", synonyms=["eye doctor", "eye specialist", "vision doctor"]),
            entry("ortho", "Orthopedic", "specialty", synonyms=["bone doctor", "bone specialist", "ortho doctor"], aliases=["orthopaedic"]),
            entry("gyn", "Gynecologist", "specialty", synonyms=["women's doctor", "womens doctor", "lady doctor", "women doctor"], aliases=["gynaecologist"]),
            entry("neuro", "Neurologist", "specialty", synonyms=["nerve doctor", "brain doctor", "neuro specialist"]),
            entry("ent", "ENT", "specialty", synonyms=["ear nose throat doctor", "ent doctor"], abbreviations=["ENT"]),
            entry("gp", "General Physician", "specialty", synonyms=["family doctor", "general doctor"], abbreviations=["GP"]),
            entry("endo", "Endocrinologist", "specialty", synonyms=["sugar doctor", "hormone doctor", "diabetes doctor"]),
            entry("pulmo", "Pulmonologist", "specialty", synonyms=["lung doctor", "chest doctor"]),
            entry("dentist", "Dentist", "specialty", synonyms=["tooth doctor", "dental doctor"]),
        ],
    )

    dump(
        "medicines.yaml",
        "medicine",
        [
            entry(
                "paracetamol",
                "Paracetamol",
                "medicine",
                synonyms=["acetaminophen"],
                aliases=["pcm", "dolo", "dolo 650"],
                abbreviations=["PCM"],
                misspellings=["paracetmol", "paracetamoll"],
            ),
            entry("ibuprofen", "Ibuprofen", "medicine", aliases=["brufen"], misspellings=["ibuprofin"]),
            entry("metformin", "Metformin", "medicine", aliases=["glycomet"], misspellings=["metformine"]),
            entry("amoxicillin", "Amoxicillin", "medicine", aliases=["amox"], misspellings=["amoxycillin"]),
            entry("aspirin", "Aspirin", "medicine", abbreviations=["ASA"]),
            entry("omeprazole", "Omeprazole", "medicine", aliases=["omez"]),
            entry("cetirizine", "Cetirizine", "medicine", aliases=["cetzine"], misspellings=["cetrizine"]),
        ],
    )

    dump(
        "symptoms.yaml",
        "symptom",
        [
            entry("fever", "Fever", "symptom", synonyms=["high temperature", "high temp", "running temperature", "pyrexia"], plurals=["fevers"]),
            entry("sob", "Shortness of Breath", "symptom", synonyms=["breathing problem", "breathing difficulty", "cant breathe", "cannot breathe", "difficulty breathing"]),
            entry("chest_pain", "Chest Pain", "symptom", synonyms=["chest tightness", "chest discomfort", "pain in chest"]),
            entry("headache", "Headache", "symptom", synonyms=["head pain"], plurals=["headaches"]),
            entry("cough", "Cough", "symptom", synonyms=["coughing"], plurals=["coughs"]),
            entry("dizziness", "Dizziness", "symptom", synonyms=["dizzy", "lightheaded", "vertigo"]),
            entry("vomiting", "Vomiting", "symptom", synonyms=["throwing up", "puking"]),
            entry("body_pain", "Body Pain", "symptom", synonyms=["body ache", "body aches"]),
        ],
    )

    dump(
        "diseases.yaml",
        "disease",
        [
            entry("diabetes", "Diabetes", "disease", synonyms=["sugar", "sugar disease", "high sugar"], aliases=["dm"], misspellings=["diabetis", "diabities"]),
            entry("hypertension", "Hypertension", "disease", synonyms=["high blood pressure", "high bp"], abbreviations=["HTN"]),
            entry("asthma", "Asthma", "disease", misspellings=["asma", "asthama"]),
            entry("migraine", "Migraine", "disease", misspellings=["migrane"]),
            entry("covid", "COVID-19", "disease", synonyms=["coronavirus", "covid 19"], aliases=["covid"]),
            entry("anemia", "Anemia", "disease", aliases=["anaemia"]),
        ],
    )

    dump(
        "laboratories.yaml",
        "laboratory",
        [
            entry("cbc", "Complete Blood Count", "laboratory", synonyms=["blood count", "complete blood count", "full blood count", "cbc"], abbreviations=["CBC"]),
            entry("glucose", "Blood Glucose", "laboratory", synonyms=["sugar test", "blood sugar test", "glucose test"], aliases=["blood sugar"]),
            entry("ecg", "Electrocardiogram", "laboratory", synonyms=["heart test", "heart tracing", "ekg", "ecg"], abbreviations=["ECG", "EKG"]),
            entry("mri", "Magnetic Resonance Imaging", "laboratory", synonyms=["mri scan", "mri"], abbreviations=["MRI"]),
            entry("ct", "Computed Tomography", "laboratory", synonyms=["ct scan", "cat scan", "ct"], abbreviations=["CT"]),
            entry("xray", "X-Ray", "laboratory", synonyms=["x ray", "radiograph"]),
            entry("imaging", "Imaging Study", "laboratory", synonyms=["scan", "body scan"]),
            entry("hba1c", "HbA1c", "laboratory", synonyms=["a1c test", "glycated hemoglobin"], abbreviations=["HbA1c"]),
            entry("lft", "LFT", "laboratory", synonyms=["liver function test", "liver test"], abbreviations=["LFT"]),
            entry("kft", "KFT", "laboratory", synonyms=["kidney function test", "renal function test"], abbreviations=["KFT"]),
        ],
    )

    dump(
        "navigation.yaml",
        "navigation",
        [
            entry("appointments", "Appointments", "navigation", synonyms=["my bookings", "my appointments", "booking list", "upcoming visits"]),
            entry("pharmacy", "Pharmacy", "navigation", synonyms=["medicine store", "medical store", "drugstore", "chemist"]),
            entry("community", "Community", "navigation", synonyms=["health forum", "forum", "community forum", "health community"]),
            entry("lab_reports", "Lab Reports", "navigation", synonyms=["reports", "my reports", "lab results", "test reports"]),
            entry("dashboard", "Dashboard", "navigation", synonyms=["home screen", "main screen"]),
            entry("profile", "Profile", "navigation", synonyms=["my profile", "account"]),
            entry("settings", "Settings", "navigation", synonyms=["preferences", "app settings"]),
        ],
    )

    dump(
        "appointment.yaml",
        "appointment",
        [
            entry("book", "Book Appointment", "appointment", synonyms=["schedule visit", "fix appointment", "fix a slot"]),
            entry("cancel", "Cancel Appointment", "appointment", synonyms=["cancel booking", "cancel visit"], misspellings=["cancle"]),
            entry("reschedule", "Reschedule Appointment", "appointment", synonyms=["change appointment", "move appointment"], misspellings=["reshedule"]),
            entry("slot", "Slot", "appointment", synonyms=["time slot", "available slot"], plurals=["slots"]),
        ],
    )

    dump(
        "emergency.yaml",
        "emergency",
        [
            entry("emergency", "Emergency", "emergency", synonyms=["urgent help", "medical emergency", "casualty"]),
            entry("ambulance", "Ambulance", "emergency", synonyms=["need ambulance", "call ambulance"], misspellings=["ambulence"]),
            entry("heart_attack", "Heart Attack", "emergency", synonyms=["cardiac arrest symptoms"]),
            entry("stroke", "Stroke", "emergency", synonyms=["brain attack"]),
        ],
    )

    dump(
        "general.yaml",
        "general",
        [
            entry("bp", "Blood Pressure", "abbreviation", abbreviations=["BP"], synonyms=["blood pressure"]),
            entry("icu", "Intensive Care Unit", "abbreviation", abbreviations=["ICU"]),
            entry("opd", "Outpatient Department", "abbreviation", abbreviations=["OPD"]),
            entry("support", "Support", "support", synonyms=["help desk", "customer care", "raise ticket"]),
            entry("complaint", "Complaint", "support", synonyms=["file complaint", "grievance"]),
            entry("hello", "Hello", "conversation", synonyms=["hi there", "hey there", "namaste"]),
            entry("thanks", "Thank You", "conversation", synonyms=["thanks a lot", "thx", "ty"]),
            entry("hospital_word", "Hospital", "general", synonyms=["clinic hospital"], misspellings=["hospitl", "hospitle"], plurals=["hospitals"]),
            entry("tomorrow", "Tomorrow", "general", misspellings=["tomorow", "tommorow"]),
            entry("medicine_word", "Medicine", "general", misspellings=["medicne", "medcine"], plurals=["medicines"]),
            entry("appointment_word", "Appointment", "general", misspellings=["appointmnt", "appoinment", "appoitment"]),
        ],
    )

    dump(
        "spelling.yaml",
        "spelling",
        [
            entry("spell_receive", "Receive", "general", misspellings=["recieve"]),
            entry("spell_lab", "Laboratory", "laboratory", misspellings=["labratory"]),
        ],
    )

    dump(
        "regional_IN.yaml",
        "regional",
        [
            entry(
                "tylenol_in",
                "Paracetamol",
                "medicine",
                synonyms=["tylenol"],
                aliases=["tylenol"],
                regions=["IN"],
            ),
            entry(
                "crocin_in",
                "Paracetamol",
                "medicine",
                synonyms=["crocin", "crocin advance"],
                regions=["IN"],
            ),
            entry(
                "dolo_in",
                "Paracetamol",
                "medicine",
                synonyms=["dolo", "dolo 650", "dolo650"],
                regions=["IN"],
            ),
            entry(
                "combiflam_in",
                "Ibuprofen",
                "medicine",
                synonyms=["combiflam"],
                regions=["IN"],
            ),
            entry(
                "calpol_in",
                "Paracetamol",
                "medicine",
                synonyms=["calpol"],
                regions=["IN"],
            ),
        ],
    )

    print(f"Wrote synonym configs to {OUT}")


if __name__ == "__main__":
    main()
