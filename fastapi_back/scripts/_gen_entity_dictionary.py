"""Generate Module 4 Entity Dictionary seed YAML catalogs."""
from __future__ import annotations

from pathlib import Path

import yaml

OUT = Path(__file__).resolve().parents[1] / "app/services/ai/entity/dictionary/catalogs"


def rec(
    id: str,
    canonical: str,
    category: str,
    *,
    aliases: list[str] | None = None,
    synonyms: list[str] | None = None,
    abbreviations: list[str] | None = None,
    misspellings: list[str] | None = None,
    plurals: list[str] | None = None,
    metadata: dict | None = None,
) -> dict:
    return {
        "id": id,
        "canonical": canonical,
        "category": category,
        "normalized": canonical,
        "aliases": aliases or [],
        "synonyms": synonyms or [],
        "abbreviations": abbreviations or [],
        "misspellings": misspellings or [],
        "plurals": plurals or [],
        "metadata": metadata or {},
        "aliases_hi": [],
        "aliases_te": [],
    }


def dump(name: str, category: str, entries: list[dict]) -> None:
    path = OUT / name
    doc = {"version": 1, "category": category, "entities": entries}
    path.write_text(
        yaml.dump(doc, sort_keys=False, allow_unicode=True, width=100, default_flow_style=False),
        encoding="utf-8",
    )
    print(f"  {name}: {len(entries)}")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    dump(
        "specialties.yaml",
        "Specialty",
        [
            rec("dermatologist", "Dermatologist", "Specialty", aliases=["dermatology", "skin specialist", "skin doctor"], abbreviations=["derm"], misspellings=["dermotologist", "dermatolgist"]),
            rec("cardiologist", "Cardiologist", "Specialty", aliases=["cardiology", "heart specialist", "heart doctor"], abbreviations=["cardio"], misspellings=["cardioligist"]),
            rec("neurologist", "Neurology", "Specialty", aliases=["neurology", "neuro specialist"], abbreviations=["neuro"]),
            rec("orthopedic", "Orthopedics", "Specialty", aliases=["orthopaedic", "orthopedics", "bone specialist", "ortho"], misspellings=["orthopeadic"]),
            rec("gynecologist", "Gynecologist", "Specialty", aliases=["gynaecologist", "gynecology", "gynaecology"], abbreviations=["gynae", "obgyn"]),
            rec("psychiatrist", "Psychiatry", "Specialty", aliases=["psychiatry", "mental health doctor"]),
            rec("ent", "ENT", "Specialty", aliases=["ear nose throat", "ent specialist", "otolaryngologist"], abbreviations=["ENT"]),
            rec("general_physician", "General Physician", "Specialty", aliases=["physician", "gp", "family doctor", "general practitioner"], abbreviations=["GP"]),
            rec("pediatrician", "Pediatrician", "Specialty", aliases=["pediatric", "pediatrics", "child specialist", "paediatrician"]),
            rec("dentist", "Dentistry", "Specialty", aliases=["dental", "tooth doctor"]),
            rec("ophthalmologist", "Ophthalmologist", "Specialty", aliases=["eye specialist", "eye doctor"], abbreviations=["ophtho"]),
            rec("pulmonologist", "Pulmonologist", "Specialty", aliases=["lung specialist", "chest specialist", "pulmonology"]),
            rec("nephrologist", "Nephrologist", "Specialty", aliases=["kidney specialist", "nephrology"]),
            rec("gastroenterologist", "Gastroenterologist", "Specialty", aliases=["gastro", "stomach specialist", "gastroenterology"]),
            rec("oncologist", "Oncologist", "Specialty", aliases=["cancer specialist", "oncology"]),
            rec("endocrinologist", "Endocrinologist", "Specialty", aliases=["hormone specialist", "endocrinology"]),
            rec("urologist", "Urologist", "Specialty", aliases=["urology"]),
        ],
    )

    dump(
        "medicines.yaml",
        "Medicine",
        [
            rec(
                "paracetamol",
                "Paracetamol",
                "Medicine",
                aliases=["acetaminophen", "pcm"],
                abbreviations=["PCM"],
                misspellings=["paracetmol", "paracetamoll", "paracetmol"],
                synonyms=["painkiller"],
                metadata={"strengths": ["500 mg", "650 mg"], "forms": ["Tablet", "Syrup", "Injection"]},
            ),
            rec("ibuprofen", "Ibuprofen", "Medicine", aliases=["brufen"], misspellings=["ibuprofin"]),
            rec("metformin", "Metformin", "Medicine", aliases=["glycomet"], misspellings=["metformine"]),
            rec("amoxicillin", "Amoxicillin", "Medicine", aliases=["amox"], misspellings=["amoxycillin", "amoxicilin"]),
            rec("aspirin", "Aspirin", "Medicine", aliases=["asa", "acetylsalicylic acid"]),
            rec("omeprazole", "Omeprazole", "Medicine", aliases=["omez", "prilosec"], misspellings=["omeprazol"]),
            rec("cetirizine", "Cetirizine", "Medicine", aliases=["cetzine", "zyrtec"], misspellings=["cetrizine"]),
            rec("azithromycin", "Azithromycin", "Medicine", aliases=["azithral"], misspellings=["azithromyacin"]),
            rec("atorvastatin", "Atorvastatin", "Medicine", aliases=["atorva", "lipitor"]),
            rec("amlodipine", "Amlodipine", "Medicine", aliases=["amlopin"]),
            rec("pantoprazole", "Pantoprazole", "Medicine", aliases=["pantocid", "pan"]),
            rec("dolo", "Dolo 650", "Medicine", aliases=["dolo 650", "dolo650"], synonyms=["paracetamol"], metadata={"brand": True}),
        ],
    )

    dump(
        "medicine_brands.yaml",
        "MedicineBrand",
        [
            rec("crocin", "Crocin", "MedicineBrand", aliases=["crocin advance"], metadata={"generic": "Paracetamol"}),
            rec("combiflam", "Combiflam", "MedicineBrand", metadata={"generic": "Ibuprofen+Paracetamol"}),
            rec("augmentin", "Augmentin", "MedicineBrand", metadata={"generic": "Amoxicillin+Clavulanate"}),
            rec("shelcal", "Shelcal", "MedicineBrand", aliases=["calcium tablet"]),
        ],
    )

    dump(
        "symptoms.yaml",
        "Symptom",
        [
            rec("headache", "Headache", "Symptom", aliases=["head pain", "cephalgia"], plurals=["headaches"], metadata={"severity": "mild", "emergency": False}),
            rec("fever", "Fever", "Symptom", aliases=["high temperature", "pyrexia"], metadata={"severity": "moderate", "emergency": False}),
            rec("cough", "Cough", "Symptom", aliases=["coughing"], metadata={"severity": "mild", "emergency": False}),
            rec("chest_pain", "Chest Pain", "Symptom", aliases=["chest discomfort", "pain in chest"], metadata={"severity": "severe", "emergency": True}),
            rec("shortness_of_breath", "Shortness of Breath", "Symptom", aliases=["difficulty breathing", "cant breathe", "cannot breathe", "dyspnea"], misspellings=["shortnes of breath"], metadata={"severity": "severe", "emergency": True}),
            rec("vomiting", "Vomiting", "Symptom", aliases=["throwing up", "emesis"], metadata={"severity": "moderate", "emergency": False}),
            rec("dizziness", "Dizziness", "Symptom", aliases=["dizzy", "vertigo", "lightheaded"], metadata={"severity": "moderate", "emergency": False}),
            rec("rash", "Rash", "Symptom", aliases=["skin rash", "eruption"], metadata={"severity": "mild", "emergency": False}),
            rec("sore_throat", "Sore Throat", "Symptom", aliases=["throat pain"], metadata={"severity": "mild", "emergency": False}),
            rec("body_pain", "Body Pain", "Symptom", aliases=["body ache", "myalgia"], metadata={"severity": "mild", "emergency": False}),
            rec("abdominal_pain", "Abdominal Pain", "Symptom", aliases=["stomach pain", "belly pain", "tummy pain"], metadata={"severity": "moderate", "emergency": False}),
            rec("bleeding", "Severe Bleeding", "Symptom", aliases=["heavy bleeding", "uncontrolled bleeding"], metadata={"severity": "severe", "emergency": True}),
        ],
    )

    dump(
        "diseases.yaml",
        "Disease",
        [
            rec("diabetes", "Diabetes", "Disease", aliases=["diabetes mellitus", "sugar disease"], synonyms=["dm"], misspellings=["diabetis", "diabities"], metadata={"icd_code": "E11"}),
            rec("hypertension", "Hypertension", "Disease", aliases=["high blood pressure", "high bp"], abbreviations=["HTN", "BP"], misspellings=["hypertention"]),
            rec("asthma", "Asthma", "Disease", aliases=["bronchial asthma"], misspellings=["asma", "asthama"]),
            rec("migraine", "Migraine", "Disease", aliases=["migraine headache"], misspellings=["migrane"]),
            rec("covid19", "COVID-19", "Disease", aliases=["covid", "coronavirus", "covid 19"], abbreviations=["COVID"]),
            rec("anemia", "Anemia", "Disease", aliases=["anaemia", "low hemoglobin"], misspellings=["aneamia"]),
            rec("thyroid", "Thyroid Disorder", "Disease", aliases=["thyroid", "hypothyroid", "hyperthyroid"]),
            rec("dengue", "Dengue", "Disease", aliases=["dengue fever"]),
            rec("uti", "UTI", "Disease", aliases=["urinary tract infection"], abbreviations=["UTI"]),
            rec("tuberculosis", "Tuberculosis", "Disease", aliases=["tb", "consumption"], abbreviations=["TB"]),
        ],
    )

    dump(
        "laboratories.yaml",
        "Laboratory",
        [
            rec("cbc", "CBC", "Laboratory", aliases=["complete blood count", "full blood count"], abbreviations=["CBC"], synonyms=["hemogram"]),
            rec("mri", "MRI", "Laboratory", aliases=["magnetic resonance imaging"], abbreviations=["MRI"]),
            rec("ct", "CT", "Laboratory", aliases=["ct scan", "computed tomography", "cat scan"], abbreviations=["CT"]),
            rec("ecg", "ECG", "Laboratory", aliases=["ekg", "electrocardiogram"], abbreviations=["ECG", "EKG"]),
            rec("xray", "X-Ray", "Laboratory", aliases=["x ray", "xray", "radiograph"], abbreviations=["XR"]),
            rec("hba1c", "HbA1c", "Laboratory", aliases=["glycated hemoglobin", "a1c", "hba1c test"], abbreviations=["HbA1c"]),
            rec("lipid_profile", "Lipid Profile", "Laboratory", aliases=["lipid", "cholesterol test", "lipid panel"]),
            rec("lft", "LFT", "Laboratory", aliases=["liver function test", "liver panel"], abbreviations=["LFT"]),
            rec("kft", "KFT", "Laboratory", aliases=["kidney function test", "rft", "renal function test"], abbreviations=["KFT", "RFT"]),
            rec("urine_test", "Urine Test", "Laboratory", aliases=["urine", "urinalysis", "urine routine"]),
            rec("blood_sugar", "Blood Sugar", "Laboratory", aliases=["glucose", "blood glucose", "fbs", "ppbs", "rbs"]),
            rec("tsh", "TSH", "Laboratory", aliases=["thyroid stimulating hormone", "thyroid test"], abbreviations=["TSH"]),
        ],
    )

    dump(
        "hospitals.yaml",
        "Hospital",
        [
            rec("demo_city_hospital", "City Care Hospital", "Hospital", aliases=["city care", "city hospital"], metadata={"city": "Hyderabad", "branch": "Main"}),
            rec("demo_apollo_seed", "Apollo Seed Clinic", "Hospital", aliases=["apollo seed"], metadata={"city": "Hyderabad"}),
            rec("demo_care_branch", "Care Hospital Jubilee Hills", "Hospital", aliases=["care jubilee", "jubilee hills care"], metadata={"city": "Hyderabad", "branch": "Jubilee Hills", "parent_id": "demo_city_hospital"}),
        ],
    )

    dump(
        "doctors.yaml",
        "Doctor",
        [
            rec(
                "doc_ravi_kumar",
                "Dr. Ravi Kumar",
                "Doctor",
                aliases=["Dr Ravi", "Ravi", "Doctor Ravi", "Dr. Ravi Kumar", "ravi kumar"],
                metadata={
                    "doctor_id": "doc_ravi_kumar",
                    "hospital_id": "demo_city_hospital",
                    "department": "Dermatology",
                    "specialty": "Dermatologist",
                    "experience_years": 12,
                    "languages": ["en", "hi", "te"],
                },
            ),
            rec(
                "doc_anita_sharma",
                "Dr. Anita Sharma",
                "Doctor",
                aliases=["Dr Sharma", "Anita Sharma", "Doctor Anita"],
                metadata={
                    "doctor_id": "doc_anita_sharma",
                    "hospital_id": "demo_apollo_seed",
                    "department": "Cardiology",
                    "specialty": "Cardiologist",
                    "experience_years": 15,
                    "languages": ["en", "hi"],
                },
            ),
            rec(
                "doc_suresh_rao",
                "Dr. Suresh Rao",
                "Doctor",
                aliases=["Dr Rao", "Suresh Rao", "Doctor Rao"],
                metadata={
                    "doctor_id": "doc_suresh_rao",
                    "hospital_id": "demo_care_branch",
                    "department": "General Medicine",
                    "specialty": "General Physician",
                    "experience_years": 8,
                    "languages": ["en", "te"],
                },
            ),
        ],
    )

    dump(
        "cities.yaml",
        "City",
        [
            rec("hyderabad", "Hyderabad", "City", aliases=["hyd", "cyberabad"], metadata={"state_id": "telangana"}),
            rec("bangalore", "Bengaluru", "City", aliases=["bangalore", "blr"], misspellings=["bengalooru"]),
            rec("mumbai", "Mumbai", "City", aliases=["bombay", "bom"]),
            rec("delhi", "New Delhi", "City", aliases=["delhi", "ncr", "new delhi"]),
            rec("chennai", "Chennai", "City", aliases=["madras"]),
            rec("kolkata", "Kolkata", "City", aliases=["calcutta"]),
            rec("pune", "Pune", "City", aliases=["poona"]),
            rec("ahmedabad", "Ahmedabad", "City", aliases=["amdavad"]),
            rec("jaipur", "Jaipur", "City"),
            rec("lucknow", "Lucknow", "City"),
            rec("kochi", "Kochi", "City", aliases=["cochin"]),
            rec("chandigarh", "Chandigarh", "City"),
        ],
    )

    dump(
        "states.yaml",
        "State",
        [
            rec("telangana", "Telangana", "State", aliases=["tg"], abbreviations=["TS"]),
            rec("andhra_pradesh", "Andhra Pradesh", "State", aliases=["ap"], abbreviations=["AP"]),
            rec("karnataka", "Karnataka", "State", abbreviations=["KA"]),
            rec("maharashtra", "Maharashtra", "State", abbreviations=["MH"]),
            rec("tamil_nadu", "Tamil Nadu", "State", abbreviations=["TN"]),
            rec("delhi_nct", "Delhi", "State", aliases=["nct delhi"], abbreviations=["DL"]),
            rec("west_bengal", "West Bengal", "State", abbreviations=["WB"]),
            rec("gujarat", "Gujarat", "State", abbreviations=["GJ"]),
            rec("rajasthan", "Rajasthan", "State", abbreviations=["RJ"]),
            rec("uttar_pradesh", "Uttar Pradesh", "State", abbreviations=["UP"]),
            rec("kerala", "Kerala", "State", abbreviations=["KL"]),
            rec("punjab", "Punjab", "State", abbreviations=["PB"]),
        ],
    )

    dump(
        "countries.yaml",
        "Country",
        [
            rec("india", "India", "Country", aliases=["bharat", "hindustan"], abbreviations=["IN", "IND"]),
            rec("usa", "United States", "Country", aliases=["us", "usa", "america"], abbreviations=["US", "USA"]),
            rec("uk", "United Kingdom", "Country", aliases=["britain", "england"], abbreviations=["UK", "GB"]),
        ],
    )

    dump(
        "abbreviations.yaml",
        "Abbreviation",
        [
            rec("abbr_bp", "Blood Pressure", "Abbreviation", abbreviations=["BP"], aliases=["blood pressure"]),
            rec("abbr_cbc", "Complete Blood Count", "Abbreviation", abbreviations=["CBC"]),
            rec("abbr_mri", "Magnetic Resonance Imaging", "Abbreviation", abbreviations=["MRI"]),
            rec("abbr_ct", "Computed Tomography", "Abbreviation", abbreviations=["CT"]),
            rec("abbr_ecg", "Electrocardiogram", "Abbreviation", abbreviations=["ECG", "EKG"]),
            rec("abbr_ent", "Ear Nose Throat", "Abbreviation", abbreviations=["ENT"]),
            rec("abbr_icu", "Intensive Care Unit", "Abbreviation", abbreviations=["ICU"]),
            rec("abbr_ot", "Operation Theatre", "Abbreviation", abbreviations=["OT", "OR"]),
            rec("abbr_opd", "Outpatient Department", "Abbreviation", abbreviations=["OPD"]),
            rec("abbr_ipd", "Inpatient Department", "Abbreviation", abbreviations=["IPD"]),
        ],
    )

    dump(
        "medical_abbreviations.yaml",
        "MedicalAbbreviation",
        [
            rec("medabbr_bid", "Twice Daily", "MedicalAbbreviation", abbreviations=["BID", "BD"]),
            rec("medabbr_tid", "Three Times Daily", "MedicalAbbreviation", abbreviations=["TID", "TDS"]),
            rec("medabbr_od", "Once Daily", "MedicalAbbreviation", abbreviations=["OD", "QD"]),
            rec("medabbr_sos", "If Needed", "MedicalAbbreviation", abbreviations=["SOS", "PRN"]),
            rec("medabbr_iv", "Intravenous", "MedicalAbbreviation", abbreviations=["IV"]),
            rec("medabbr_im", "Intramuscular", "MedicalAbbreviation", abbreviations=["IM"]),
        ],
    )

    dump(
        "relationships.yaml",
        "Relationship",
        [
            rec("mother", "Mother", "Relationship", aliases=["mom", "mummy", "maa"]),
            rec("father", "Father", "Relationship", aliases=["dad", "daddy", "papa"]),
            rec("spouse", "Spouse", "Relationship", aliases=["wife", "husband", "partner"]),
            rec("son", "Son", "Relationship", aliases=["my son"]),
            rec("daughter", "Daughter", "Relationship", aliases=["my daughter"]),
            rec("brother", "Brother", "Relationship", aliases=["bhai"]),
            rec("sister", "Sister", "Relationship", aliases=["sis", "didi"]),
            rec("self", "Self", "Relationship", aliases=["myself", "me", "for me"]),
            rec("friend", "Friend", "Relationship"),
            rec("grandparent", "Grandparent", "Relationship", aliases=["grandmother", "grandfather", "grandma", "grandpa"]),
        ],
    )

    dump(
        "roles.yaml",
        "Role",
        [
            rec("patient", "Patient", "Role", aliases=["user"]),
            rec("doctor", "Doctor", "Role", aliases=["physician"]),
            rec("receptionist", "Receptionist", "Role"),
            rec("dean", "Dean", "Role", aliases=["hospital admin"]),
            rec("admin", "Admin", "Role", aliases=["super admin"]),
            rec("partner", "Partner", "Role", aliases=["pharmacy partner", "lab partner"]),
        ],
    )

    dump(
        "genders.yaml",
        "Gender",
        [
            rec("male", "Male", "Gender", aliases=["m", "man", "boy"]),
            rec("female", "Female", "Gender", aliases=["f", "woman", "girl"]),
            rec("other", "Other", "Gender", aliases=["non-binary", "prefer not to say"]),
        ],
    )

    dump(
        "appointment_statuses.yaml",
        "AppointmentStatus",
        [
            rec("booked", "Booked", "AppointmentStatus", aliases=["scheduled", "confirmed"]),
            rec("completed", "Completed", "AppointmentStatus", aliases=["done", "finished"]),
            rec("cancelled", "Cancelled", "AppointmentStatus", aliases=["canceled"]),
            rec("no_show", "No Show", "AppointmentStatus", aliases=["missed"]),
            rec("in_progress", "In Progress", "AppointmentStatus", aliases=["ongoing", "with doctor"]),
            rec("pending", "Pending", "AppointmentStatus", aliases=["awaiting"]),
        ],
    )

    dump(
        "payment_methods.yaml",
        "PaymentMethod",
        [
            rec("upi", "UPI", "PaymentMethod", aliases=["gpay", "phonepe", "paytm"]),
            rec("card", "Card", "PaymentMethod", aliases=["credit card", "debit card"]),
            rec("cash", "Cash", "PaymentMethod"),
            rec("netbanking", "Net Banking", "PaymentMethod", aliases=["net banking", "online banking"]),
            rec("wallet", "Wallet", "PaymentMethod"),
        ],
    )

    dump(
        "emergency_keywords.yaml",
        "EmergencyKeyword",
        [
            rec("ek_chest_pain", "Chest Pain", "EmergencyKeyword", aliases=["heart attack"], metadata={"emergency": True}),
            rec("ek_stroke", "Stroke", "EmergencyKeyword", aliases=["brain attack"], metadata={"emergency": True}),
            rec("ek_unconscious", "Unconscious", "EmergencyKeyword", aliases=["passed out", "not responding"], metadata={"emergency": True}),
            rec("ek_overdose", "Overdose", "EmergencyKeyword", aliases=["poisoning"], metadata={"emergency": True}),
            rec("ek_seizure", "Seizure", "EmergencyKeyword", aliases=["fit", "convulsion"], metadata={"emergency": True}),
            rec("ek_severe_bleeding", "Severe Bleeding", "EmergencyKeyword", metadata={"emergency": True}),
            rec("ek_choking", "Choking", "EmergencyKeyword", metadata={"emergency": True}),
            rec("ek_suicidal", "Suicidal", "EmergencyKeyword", aliases=["suicide", "want to die"], metadata={"emergency": True}),
        ],
    )

    dump(
        "departments.yaml",
        "Department",
        [
            rec("dept_dermatology", "Dermatology", "Department", aliases=["skin department"]),
            rec("dept_cardiology", "Cardiology", "Department", aliases=["heart department"]),
            rec("dept_emergency", "Emergency", "Department", aliases=["casualty", "er", "a&e"]),
            rec("dept_pediatrics", "Pediatrics", "Department", aliases=["paediatrics", "child ward"]),
            rec("dept_orthopedics", "Orthopedics", "Department", aliases=["ortho department"]),
            rec("dept_radiology", "Radiology", "Department", aliases=["imaging"]),
            rec("dept_lab", "Laboratory", "Department", aliases=["pathology", "diagnostics"]),
            rec("dept_pharmacy", "Pharmacy", "Department"),
        ],
    )

    dump(
        "body_parts.yaml",
        "BodyPart",
        [
            rec("bp_head", "Head", "BodyPart", aliases=["skull"]),
            rec("bp_chest", "Chest", "BodyPart", aliases=["thorax"]),
            rec("bp_abdomen", "Abdomen", "BodyPart", aliases=["stomach", "belly"]),
            rec("bp_back", "Back", "BodyPart", aliases=["spine"]),
            rec("bp_knee", "Knee", "BodyPart"),
            rec("bp_skin", "Skin", "BodyPart"),
            rec("bp_throat", "Throat", "BodyPart"),
            rec("bp_eye", "Eye", "BodyPart", plurals=["eyes"]),
            rec("bp_ear", "Ear", "BodyPart", plurals=["ears"]),
            rec("bp_heart", "Heart", "BodyPart"),
            rec("bp_lung", "Lung", "BodyPart", plurals=["lungs"]),
            rec("bp_kidney", "Kidney", "BodyPart", plurals=["kidneys"]),
        ],
    )

    dump(
        "allergies.yaml",
        "Allergy",
        [
            rec("allergy_penicillin", "Penicillin", "Allergy", aliases=["penicillin allergy"]),
            rec("allergy_sulfa", "Sulfa", "Allergy", aliases=["sulfa drugs", "sulfonamide"]),
            rec("allergy_peanut", "Peanut", "Allergy", aliases=["groundnut"]),
            rec("allergy_dust", "Dust", "Allergy", aliases=["dust mite"]),
            rec("allergy_pollen", "Pollen", "Allergy"),
            rec("allergy_latex", "Latex", "Allergy"),
        ],
    )

    dump(
        "languages.yaml",
        "Language",
        [
            rec("lang_en", "English", "Language", aliases=["en"], abbreviations=["en"]),
            rec("lang_hi", "Hindi", "Language", aliases=["hi", "hindi"], abbreviations=["hi"]),
            rec("lang_te", "Telugu", "Language", aliases=["te", "telugu"], abbreviations=["te"]),
            rec("lang_ta", "Tamil", "Language", aliases=["ta"], abbreviations=["ta"]),
            rec("lang_kn", "Kannada", "Language", aliases=["kn"], abbreviations=["kn"]),
            rec("lang_mr", "Marathi", "Language", aliases=["mr"], abbreviations=["mr"]),
        ],
    )

    dump(
        "healthcare_terms.yaml",
        "HealthcareTerm",
        [
            rec("term_opd", "OPD", "HealthcareTerm", aliases=["outpatient", "out patient"]),
            rec("term_followup", "Follow-up", "HealthcareTerm", aliases=["follow up", "review visit"]),
            rec("term_prescription", "Prescription", "HealthcareTerm", aliases=["rx", "script"]),
            rec("term_referral", "Referral", "HealthcareTerm"),
            rec("term_triage", "Triage", "HealthcareTerm"),
            rec("term_discharge", "Discharge", "HealthcareTerm"),
            rec("term_admission", "Admission", "HealthcareTerm", aliases=["admit", "hospital admission"]),
        ],
    )

    print(f"Wrote catalogs to {OUT}")


if __name__ == "__main__":
    main()
