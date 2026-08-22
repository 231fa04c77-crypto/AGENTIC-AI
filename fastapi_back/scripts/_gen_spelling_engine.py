"""Generate Module 7 Spelling Correction dictionaries."""
from __future__ import annotations

from pathlib import Path

import yaml

OUT = Path(__file__).resolve().parents[1] / "app/services/ai/spelling/config"


def entry(canonical: str, misspellings: list[str], category: str, *, id: str | None = None) -> dict:
    return {
        "id": id or canonical.lower().replace(" ", "_").replace("-", "_"),
        "canonical": canonical,
        "category": category,
        "misspellings": misspellings,
    }


def dump(name: str, category: str, entries: list[dict]) -> None:
    (OUT / name).write_text(
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
        "specialties.yaml",
        "Specialty",
        [
            entry("Dermatologist", ["dermotologist", "dermatolgist", "dermatologyst"], "Specialty"),
            entry("Cardiologist", ["cardialogist", "cardioligist", "cardiologyst"], "Specialty"),
            entry("Gynecologist", ["gynecologyst", "gynaecologyst", "gyneclogist"], "Specialty"),
            entry("Orthopedic", ["orthopeadic", "orthopadic", "orthopedik"], "Specialty"),
            entry("Pediatrician", ["paediatrician", "peditrician", "pediatritian"], "Specialty"),
            entry("Neurologist", ["neurologyst", "neurologits"], "Specialty"),
            entry("Ophthalmologist", ["opthalmologist", "ophthalmologyst"], "Specialty"),
        ],
    )

    dump(
        "medicines.yaml",
        "Medicine",
        [
            entry("Paracetamol", ["paracetmol", "paracetamoll", "paracetmol"], "Medicine"),
            entry("Amoxicillin", ["amoxcillin", "amoxycillin", "amoxicilin"], "Medicine"),
            entry("Azithromycin", ["azithromicin", "azithromyacin"], "Medicine"),
            entry("Metformin", ["metmorfin", "metformine"], "Medicine"),
            entry("Ibuprofen", ["ibuprofin"], "Medicine"),
            entry("Omeprazole", ["omeprazol", "omeprezole"], "Medicine"),
        ],
    )

    dump(
        "diseases.yaml",
        "Disease",
        [
            entry("Diabetes", ["diabtes", "diabetis", "diabities"], "Disease"),
            entry("Hypertension", ["hypretension", "hypertention", "hypertensoin"], "Disease"),
            entry("Asthma", ["asthama", "asma", "asthmaa"], "Disease"),
            entry("Migraine", ["migrane", "migrain"], "Disease"),
            entry("Anemia", ["aneamia", "anaemia"], "Disease"),
        ],
    )

    dump(
        "symptoms.yaml",
        "Symptom",
        [
            entry("Headache", ["headak", "headace", "hedache"], "Symptom"),
            entry("Fever", ["feverr", "fevor", "feaver"], "Symptom"),
            entry("Vomiting", ["vommiting", "vomitting", "vomitting"], "Symptom"),
            entry("Dizziness", ["dizzyness", "diziness", "dizzyiness"], "Symptom"),
            entry("Cough", ["coughh", "couph"], "Symptom"),
        ],
    )

    dump(
        "cities.yaml",
        "City",
        [
            entry("Hyderabad", ["hydrabad", "hyderbad", "hydrabbad"], "City"),
            entry("Bengaluru", ["banglore", "bangalor", "bengalooru"], "City"),
            entry("Visakhapatnam", ["vizagh", "vizag", "vishakapatnam"], "City"),
            entry("Mumbai", ["bombay", "mumbait"], "City"),
            entry("Chennai", ["madrass", "chenai"], "City"),
        ],
    )

    dump(
        "general_words.yaml",
        "General",
        [
            entry("tomorrow", ["tomorow", "tommorow", "tommorrow"], "General"),
            entry("appointment", ["appointmnt", "appoinment", "appoitment"], "General"),
            entry("medicine", ["medcine", "medicne", "medicin"], "General"),
            entry("doctor", ["docter", "doctr", "docotor"], "General"),
            entry("hospital", ["hospitl", "hospitle", "hospitaal"], "General"),
            entry("laboratory", ["labratory", "laboratry"], "General"),
            entry("cancel", ["cancle", "cancell"], "General"),
            entry("reschedule", ["reshedule", "reschedual"], "General"),
            entry("ambulance", ["ambulence", "ambulanc"], "General"),
            entry("receive", ["recieve"], "General"),
        ],
    )

    dump(
        "medical_terms.yaml",
        "Medical",
        [
            entry("prescription", ["presciption", "prescripion"], "Medical"),
            entry("diagnosis", ["diagnonis", "diagonsis"], "Medical"),
            entry("symptoms", ["symptons", "symtoms"], "Medical"),
            entry("CBC", ["cb c", "c b c"], "Medical"),
            entry("HbA1c", ["hba1 c", "hba 1c"], "Medical"),
            entry("ECG", ["ecgg", "e c g"], "Medical"),
            entry("MRI", ["mri scan", "m r i"], "Medical"),
        ],
    )

    print(f"Wrote spelling configs to {OUT}")


if __name__ == "__main__":
    main()
