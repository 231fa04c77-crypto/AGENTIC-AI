PLATFORM_KNOWLEDGE = {
    "name": "MedClues",
    "slogan": "Your Healthcare Companion",
    "mission": "To provide accessible, high-quality healthcare services through technology, connecting patients with the best doctors and hospitals in their vicinity.",
    "features": [
        {
            "name": "Doctor Appointments",
            "description": "Book appointments with top specialists across multiple departments.",
            "path": "/all-doctors"
        },
        {
            "name": "Hospital Discovery",
            "description": "Find nearby partner hospitals and super-specialty medical centers.",
            "path": "/hospitals"
        },
        {
            "name": "Diagnostic Labs",
            "description": "Access pathology and diagnostic laboratory services with report history.",
            "path": "/labs"
        },
        {
            "name": "Emergency 108",
            "description": "Rapid emergency response and location tracking for critical medical situations.",
            "path": "/emergency"
        },
        {
            "name": "Blood Bank",
            "description": "Locate blood donor centers and check availability of different blood groups.",
            "path": "/hospitals"
        }
    ],
    # contact.email / contact.phone resolved at runtime from SUPPORT_* settings
    "contact": {
        "support": "Available 24/7 for emergency and 9 AM to 9 PM for general support"
    },
    "faqs": [
        {
            "q": "How do I book an appointment?",
            "a": "Navigate to 'Doctors', select your specialist, choose a convenient slot, and click 'Book Appointment'."
        },
        {
            "q": "Where can I see my medical reports?",
            "a": "You can view and download all your lab reports in the 'My Labs' section under your profile."
        },
        {
            "q": "What is Emergency 108?",
            "a": "It is our dedicated emergency portal that sends your location to emergency services and notifies your emergency contacts."
        }
    ]
}


def get_contact():
    """Support contact aligned with SUPPORT_EMAIL / SUPPORT_PHONE config."""
    from app.config.config import settings

    email = (getattr(settings, "SUPPORT_EMAIL", None) or "support@medclues.com").strip()
    phone = (getattr(settings, "SUPPORT_PHONE", None) or "1800-123-4567").strip()
    return {
        "email": email or "support@medclues.com",
        "phone": phone or "1800-123-4567",
        "support": PLATFORM_KNOWLEDGE["contact"]["support"],
    }


def get_system_training_prompt():
    contact = get_contact()
    knowledge_str = f"""
    You are MedClues AI, the intelligent primary health assistant for the MedClues platform.
    
    PLATFORM KNOWLEDGE:
    - Name: {PLATFORM_KNOWLEDGE['name']}
    - Purpose: {PLATFORM_KNOWLEDGE['mission']}
    - Contact email: {contact['email']}
    - Contact phone: {contact['phone']}
    
    KEY SECTIONS:
    {chr(10).join([f"• {f['name']}: {f['description']} (Path: {f['path']})" for f in PLATFORM_KNOWLEDGE['features']])}
    
    GUIDELINES:
    1. Be empathetic, professional, and concise.
    2. ALWAYS prioritize emergency queries by directing users to the /emergency page.
    3. For booking, guide users to the Doctors page.
    4. For lab reports, direct them to My Labs.
    5. If you don't know the answer, ask them to contact {contact['email']} or {contact['phone']}.
    6. Response Limit: Keep responses under 2-3 sentences. Use bullet points for lists.
    """
    return knowledge_str
