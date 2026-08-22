"""Intent detection — keyword + pattern engine (LLM refine optional)."""
from __future__ import annotations

import re
from typing import Any

from app.services.ai.constants import INTENTS


_SYMPTOM_BOOK = (
    r"(stomach|abdomen|abdominal|fever|cough|cold|rash|headache|migraine|joint|knee|"
    r"back pain|chest|dizzy|dizziness|sore throat|body pain|thyroid|asthma|diabetes|"
    r"bp|blood pressure|stress|sleep|skin)"
)

_RULES: list[tuple[str, re.Pattern[str]]] = [
    # Urgency / clinical personal advice still first (safety_block also gates)
    ("refuse_clinical", re.compile(
        r"\b(diagnos(e|is|ing)|prescribe|what medicine should i take|"
        r"do i have (a |an )?(disease|condition|cancer|infection)|am i dying|self[- ]medicat)\b",
        re.I,
    )),
    ("emergency_help", re.compile(r"\b(emergency|ambulance|urgent care|er\b|casualty)\b", re.I)),
    ("get_my_profile", re.compile(r"\b(what('?s| is) my name|who am i|my profile)\b", re.I)),
    ("get_today_appointments", re.compile(
        r"\b(today('?s)?|today).*(appointment|booking|visit)|\b(appointment|booking|visit).*(today)\b",
        re.I,
    )),
    (
        "view_appointments",
        re.compile(
            r"\b(my appointments?|show( me)?.*(appoint|booking)|list.*(appoint|booking)|"
            r"view.*(appoint|booking)|upcoming appointments?|what appointments?|"
            r"do i have (any )?appointments?)\b|"
            r"(मेरे|मेरा)\s*(अपॉइंटमेंट|डॉक्टर)|"
            r"(నా)\s+(అపాయింట్|డాక్టర్)|"
            r"\b(mere|mera)\s+(appointment|doctor)s?\b|"
            r"\b(naa|na)\s+(appointment|doctor)s?\b",
            re.I,
        ),
    ),
    ("basic_conversation", re.compile(
        r"^\s*(hi|hello|hey|good (morning|afternoon|evening)|thanks|thank you|"
        r"who are you|what can you do|"
        r"namaste|नमस्ते|నమస్కారం|namaskaram)[!?.\s]*$",
        re.I,
    )),
    ("navigation_help", re.compile(
        r"\b(open|go to|take me to)\b.*(pharmacy|lab|laboratory|appointment|report|"
        r"community|payment|profile|emergency|hospital|doctor|help)",
        re.I,
    )),
    # Medicine INFO before buy/search
    (
        "medicine_info",
        re.compile(
            r"\b(what (is|are)|uses? for|used for|side effects?|after food|with food|"
            r"together with|can i take|forgot (to take|my)|when (should|do) i take)\b.*"
            r"\b(tablet|medicine|pill|drug|paracetamol|acetaminophen|ibuprofen|antibiotic|"
            r"metformin|aspirin)\b|"
            r"\b(paracetamol|acetaminophen|ibuprofen|metformin|aspirin)\b.*"
            r"\b(for|use|used|does|do|mean|together|food)\b|"
            r"\bwhat is (this )?(tablet|medicine|pill)\b|"
            r"(दवाई|दवा|गोली|మందు|మాత్ర).*(क्या|క్యా|emi|ఏమి|use|के लिए)|"
            r"\b(dawai|davai|goli|mandulu|mathralu)\b.*"
            r"\b(kya|emi|use|ke liye|entati)\b|"
            r"\b(paracetamol|ibuprofen)\b.*(kya|emi|కోసం|के लिए)",
            re.I,
        ),
    ),
    # Disease / condition education
    (
        "health_education",
        re.compile(
            r"\bwhat (is|are)\b.*(diabetes|asthma|thyroid|migraine|hypertension|blood pressure|"
            r"anemia|haemoglobin|hemoglobin|fever|infection|covid)|"
            r"\b(symptoms? of|causes? of|can .+ be cured|foods? (to|should).*(avoid|eat)|"
            r"explain|tell me about)\b.*"
            r"\b(diabetes|asthma|thyroid|migraine|hypertension|bp|anemia)\b|"
            r"\b(diagnosed with|i have)\b.*(diabetes|asthma|thyroid|migraine)|"
            r"\b(hemoglobin|haemoglobin|sugar level|blood sugar)\b.*"
            r"\b(mean|normal|explain)\b|"
            r"\bmy (hemoglobin|haemoglobin|sugar)\b|"
            r"(मधुमेह|डायबिटीज|షుగర్|డయాబెటిస్|शुगर).*(क्या|ఏమి|emi|kya)|"
            r"\b(madhumeh|diabetes|sugar)\b.*(kya hai|emi|ఏమిటి)",
            re.I,
        ),
    ),
    (
        "wellness_info",
        re.compile(
            r"\b(stress|unable to sleep|insomnia|mental (health|wellness)|relax|"
            r"improve my health|healthy (routine|lifestyle)|lifestyle|"
            r"daily (habits?|routine))\b|"
            r"(नींद|నిద్ర|stress|तनाव).*(नहीं|లేదు|problem)",
            re.I,
        ),
    ),
    (
        "explain_lab_report",
        re.compile(
            r"\b(explain|what does|mean)\b.*(lab|report|cbc|hemoglobin|haemoglobin|result)|"
            r"\b(lab|blood) (report|result).*(explain|mean)|"
            r"(रिपोर्ट|రిపోర్ట్).*(समझा|చెప్ప|explain)|"
            r"\b(report|lab).*(samjha|cheppu|emi)\b",
            re.I,
        ),
    ),
    # NL booking BEFORE generic symptom guidance
    (
        "book_appointment",
        re.compile(
            r"\b(book|schedule)\b.*\b(appoint(ment)?|doctor|visit|slot|"
            r"dermatolog\w*|cardiolog\w*|pediatric\w*|specialist|gynecolog\w*|orthop\w*)\b|"
            r"\b(see|visit)\s+a\s+(doctor|dermatolog\w*|cardiolog\w*|specialist)\b|"
            r"\b(need|want)\s+(an?\s+)?(appointment|doctor)\b|"
            r"\b(want to (see|meet)|see a doctor|consult (a )?doctor)\b|"
            rf"{_SYMPTOM_BOOK}.*\b(doctor|appointment|specialist|consult)\b|"
            rf"\b(doctor|appointment|specialist).*{_SYMPTOM_BOOK}\b|"
            r"\b(book|appointment).*\b(for )?(my )?(mother|father|mom|dad|wife|husband|child|son|daughter|"
            r"maa|amma|nanna|papa|beta|beti)\b|"
            r"(मुझे|मुझको).*(डॉक्टर|अपॉइंटमेंट)|"
            r"(నాకు|నేను).*(డాక్టర్|అపాయింట్)|"
            r"\b(mujhe|mujhko).*(doctor|appointment|dikhana)\b|"
            r"\b(naku|nenu).*(doctor|appointment)\b|"
            r"(माँ|माता|अम्मा|నాన్న|మా).*(डॉक्टर|డాక్టర్|appointment)|"
            r"\b(maa|amma|nanna|papa).*(doctor|appointment)\b",
            re.I,
        ),
    ),
    (
        "symptom_guidance",
        re.compile(
            rf"\b(i (have|am|feel|['’]?ve)|feeling|suffering from|been having)\b.*{_SYMPTOM_BOOK}|"
            rf"\b{_SYMPTOM_BOOK}\b.*(what could|reason|why|what (should|do)|help)|"
            r"\b(fever|body pain|sore throat|dizzy|dizziness|cough|rash)\b|"
            r"(बुखार|दर्द|खांसी|జ్వరం|నొప్పి|దగ్గు)|"
            r"\b(bukhar|bukhaar|dard|khansi|jwaram|noppi|daggu)\b",
            re.I,
        ),
    ),
    ("cancel_appointment", re.compile(r"\b(cancel.*(appoint|visit|booking)|cancel my)\b", re.I)),
    ("reschedule_appointment", re.compile(r"\b(reschedule|change.*(slot|appoint|time))\b", re.I)),
    (
        "find_doctor",
        re.compile(
            r"\b(find|search|looking for)\b.*\b(doctor|specialist|dermatolog\w*|cardiolog\w*|pediatric\w*)\b",
            re.I,
        ),
    ),
    (
        "find_hospital",
        re.compile(r"\b(find|search|nearest|nearby)\b.*\b(hospital|clinic)\b|\bnearest hospital\b", re.I),
    ),
    ("track_medicine_order", re.compile(
        r"\b(track|where is)\b.*(order|medicine|delivery|pharmacy)|\bpharmacy order\b",
        re.I,
    )),
    ("raise_complaint", re.compile(
        r"\b(complaint|wasn'?t delivered|not delivered|raise ticket|support ticket)\b",
        re.I,
    )),
    ("track_complaint", re.compile(r"\b(ticket status|track.*(ticket|complaint)|my complaint)\b", re.I)),
    (
        "find_pharmacy",
        re.compile(
            r"\b(where can i (get|buy)|buy|order)\b.*\b(medicine|drug|paracetamol|tablet)\b|"
            r"\b(find|search)\b.*\b(pharmacy|medicine)\b",
            re.I,
        ),
    ),
    ("view_prescription", re.compile(r"\b(my )?prescriptions?\b|\brx\b", re.I)),
    ("view_lab_report", re.compile(r"\b(my )?(lab report|test result|blood report|cbc result)s?\b", re.I)),
    ("book_lab_test", re.compile(r"\b(book.*(lab|test)|lab test|blood test|cbc)\b", re.I)),
    ("community_search", re.compile(r"\b(community|forum|doctor answered|health question)\b", re.I)),
    ("view_queue", re.compile(r"\b(queue|token|waiting)\b", re.I)),
    ("view_schedule", re.compile(r"\b(my schedule|today'?s appointments|roster)\b", re.I)),
    ("pay_bill", re.compile(r"\b(pay|payment|bill|invoice)\b", re.I)),
    ("medicine_reminder", re.compile(r"\b(remind|reminder).*(medicine|pill|dose)\b", re.I)),
    ("find_department", re.compile(r"\b(department|specialty|speciality|ward)\b", re.I)),
    ("analytics", re.compile(r"\b(analytics|dashboard|metrics|kpi)\b", re.I)),
    ("platform_help", re.compile(r"\b(how (do|to) (i )?(book|cancel|use)|help center|faq|guide)\b", re.I)),
]

INTENT_TOOL: dict[str, str] = {
    "basic_conversation": "none",
    "get_my_profile": "get_my_profile",
    "get_today_appointments": "get_today_appointments",
    "view_appointments": "list_my_appointments",
    "book_appointment": "propose_book_appointment",
    "cancel_appointment": "propose_cancel_appointment",
    "reschedule_appointment": "request_grace_reschedule",
    "find_doctor": "search_doctors",
    "find_hospital": "search_hospitals",
    "find_pharmacy": "search_medicine",
    "medicine_info": "medicine_info",
    "health_education": "health_education",
    "symptom_guidance": "symptom_guidance",
    "wellness_info": "wellness_info",
    "track_medicine_order": "track_medicine_order",
    "view_prescription": "list_prescriptions",
    "view_lab_report": "list_lab_bookings",
    "explain_lab_report": "explain_lab_report",
    "book_lab_test": "search_labs",
    "raise_complaint": "propose_create_support_ticket",
    "track_complaint": "get_ticket_status",
    "emergency_help": "find_nearest_emergency_hospital",
    "find_department": "search_doctors",
    "community_search": "search_community",
    "view_queue": "list_my_appointments",
    "view_schedule": "doctor_today_schedule",
    "pay_bill": "list_payments",
    "medicine_reminder": "medicine_reminder_hint",
    "analytics": "hospital_analytics_hint",
    "platform_help": "knowledge_search",
    "navigation_help": "navigate_app",
    "refuse_clinical": "none",
    "unknown": "knowledge_search",
}


def detect_intent(message: str, *, context: dict[str, Any] | None = None) -> dict[str, Any]:
    msg = (message or "").strip()
    ctx = context or {}
    flow = (ctx.get("active_flow") or "").strip()
    lower = msg.lower()
    escape = False

    if flow and flow != "cancel_appointment" and re.search(r"\bcancel.*(appoint|visit|booking)\b", lower):
        escape = True
    if flow and flow != "reschedule_appointment" and re.search(r"\breschedule\b", lower):
        escape = True
    if flow and flow != "book_appointment" and re.search(
        r"\b(book|schedule)\b.*\b(doctor|appoint|dermatolog|cardiolog|visit)\b", lower
    ):
        escape = True
    if flow == "book_appointment" and re.search(
        r"\b(my appointments?|show|list|view).*(appoint|booking)|what appointments?\b", lower
    ):
        escape = True
    # Educational questions should escape booking flow
    if flow == "book_appointment" and re.search(
        r"\bwhat (is|are)\b|\bsymptoms? of\b|\bexplain\b", lower
    ):
        escape = True

    if flow in INTENTS and not escape and not re.fullmatch(r"\s*(hi|hello|hey)\s*", msg, re.I):
        return {
            "intent": flow,
            "confidence": 0.92,
            "source": "memory",
            "query": msg,
            "suggested_tool": INTENT_TOOL.get(flow),
        }

    for intent, pattern in _RULES:
        if pattern.search(msg):
            return {
                "intent": intent,
                "confidence": 0.75,
                "source": "rules",
                "query": msg,
                "suggested_tool": INTENT_TOOL.get(intent),
            }
    return {
        "intent": "unknown",
        "confidence": 0.3,
        "source": "fallback",
        "query": msg,
        "suggested_tool": "knowledge_search",
    }
