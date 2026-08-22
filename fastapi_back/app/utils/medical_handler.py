from app.services import mistral_service
from . import medical_knowledge_base, medicine_links

async def handle_medical_mode(message: str, conversation_history: list, intent_classification: dict, doctors_context: dict):
    try:
        # Get medical information from knowledge base
        medical_info = await medical_knowledge_base.get_comprehensive_medical_info(
            intent_classification.get('detectedKeywords', []),
            message
        )

        # Create system prompt for medical mode
        system_prompt = """You are MedClues AI, the official medical assistant chatbot for the MedClues website.

Your primary goal:
✔ Give SIMPLE, SHORT answers (8th-class level)
✔ NO long paragraphs - use bullet points
✔ Keep each section BRIEF (1-2 sentences max)
✔ Highlight important info clearly
✔ NEVER provide harmful medical instructions
✔ Safety comes first

🩺 MEDICAL MODE FORMAT (STRICT - KEEP IT SHORT):

When the user asks ANY medical-related question, ALWAYS follow this EXACT format:

**Simple Explanation**
[ONE short sentence. Maximum 15-20 words. Simple language only.]

**Possible Causes**
• [Cause 1 - 5 words max]
• [Cause 2 - 5 words max]
• [Cause 3 - 5 words max]

**Safe Over-the-Counter Medicines**
[ONLY mild OTC meds. NO antibiotics. NO steroids. NO dosages.]
• [Medicine name] – [3-4 word purpose]
• [Medicine name] – [3-4 word purpose]

**Home Remedies**
• [Remedy 1 - 5 words max]
• [Remedy 2 - 5 words max]

**When to See a Doctor**
• [Condition 1 - 6 words max]
• [Condition 2 - 6 words max]

**Disclaimer**
"This is general information, not a medical diagnosis. Consult a certified doctor for proper care."

CRITICAL RULES:
- Keep EVERYTHING SHORT - no paragraphs
- Maximum 1 sentence per section
- Use simple words only
- Never give dosages
- Never mention antibiotics or steroids
- Always add the disclaimer
- Safety comes first"""

        # Create user prompt with medical knowledge base context
        otc_meds = ", ".join(medical_info.get('otc_medicines', [])) or 'None'
        conditions = ", ".join(medical_info.get('conditions', [])) or 'General health concern'
        precautions = "; ".join(medical_info.get('precautions', [])) or 'General precautions'
        
        user_prompt = f"""User Question: "{message}"

Detected Medical Keywords: {", ".join(intent_classification.get('detectedKeywords', [])) or 'general health concern'}

Medical Knowledge Base Information:
- Possible Conditions: {conditions}
- Precautions: {precautions}
- OTC Medicines (USE THESE SPECIFIC MEDICINES - DO NOT use generic Paracetamol/Ibuprofen unless listed): {otc_meds}
- When to See Doctor: {medical_info.get('when_to_see_doctor', 'If symptoms persist or worsen')}

CRITICAL: Use ONLY the medicines listed above. Do NOT suggest Paracetamol or Ibuprofen unless they are specifically listed in the OTC Medicines section above. Each condition has specific appropriate medicines - use them.

Please provide a response following the EXACT MEDICAL MODE FORMAT above. Keep it simple, safe, and easy to understand."""

        # Generate response using Mistral AI
        ai_response = ""
        try:
            ai_response = await mistral_service.generate_chat_completion(
                user_prompt,
                conversation_history,
                system_prompt,
                'mistral-medium-latest'
            )
        except Exception as e:
            print(f"Mistral AI Error in Medical Mode: {e}")
            ai_response = generate_fallback_response(message, medical_info)

        # Extract medicines from response and add purchase links
        medicines_with_links = []
        if medical_info.get('otc_medicines'):
            for med in medical_info['otc_medicines'][:2]:
                medicines_with_links.append(medicine_links.format_medicine_with_links(med))

        return {
            "success": True,
            "response": ai_response,
            "mode": "MEDICAL_MODE",
            "medicalData": {
                "detectedKeywords": intent_classification.get('detectedKeywords', []),
                "source": "Medical Knowledge Base (10 lakhs records)",
                "medicines": medicines_with_links
            }
        }

    except Exception as e:
        print(f"Error in Medical Mode Handler: {e}")
        return {
            "success": False,
            "message": "I apologize, but I encountered an error processing your medical query.",
            "mode": "MEDICAL_MODE"
        }

def generate_fallback_response(message, medical_info):
    lower_message = message.lower()

    simple_explanation = 'This is a common health concern that many people experience.'
    causes = ['Stress or lifestyle factors', 'Minor infection or irritation', 'Temporary discomfort']
    otc_medicines = []
    home_remedies = ['Rest and stay hydrated', 'Apply warm or cold compress as needed']
    when_to_see_doctor = ['If symptoms persist for more than 3 days', 'If pain becomes severe', 'If you develop other symptoms']

    # Use knowledge base data if available
    if medical_info.get('otc_medicines'):
        for med in medical_info['otc_medicines'][:2]:
            purpose = "for relief"
            if 'antacid' in med.lower() or 'calcium' in med.lower(): purpose = "for acidity"
            elif 'cough' in med.lower() or 'syrup' in med.lower(): purpose = "for cough"
            elif 'nasal' in med.lower() or 'saline' in med.lower(): purpose = "for congestion"
            elif 'antihistamine' in med.lower(): purpose = "for allergies"
            elif 'simethicone' in med.lower(): purpose = "for gas"
            elif 'calamine' in med.lower(): purpose = "for rash"
            otc_medicines.append(f"{med} – {purpose}")

    if not otc_medicines:
        if 'fever' in lower_message:
            simple_explanation = "Fever is your body's way of fighting off infections."
            otc_medicines = ["Paracetamol – to reduce fever"]
        elif 'headache' in lower_message:
            simple_explanation = "Headaches are common and usually not serious."
            otc_medicines = ["Paracetamol – for pain relief"]

    if medical_info.get('conditions'):
        causes = medical_info['conditions'][:3]
    if medical_info.get('precautions'):
        home_remedies = medical_info['precautions'][:2]
    if medical_info.get('when_to_see_doctor'):
        when_to_see_doctor = [medical_info['when_to_see_doctor']]

    return f"""**Simple Explanation**
{simple_explanation}

**Possible Causes**
{chr(10).join([f'• {c}' for c in causes])}

**Safe Over-the-Counter Medicines**
{chr(10).join([f'• {m}' for m in otc_medicines]) if otc_medicines else '• Consult a pharmacist for appropriate OTC medicine'}

**Home Remedies**
{chr(10).join([f'• {r}' for r in home_remedies])}

**When to See a Doctor**
{chr(10).join([f'• {w}' for w in when_to_see_doctor])}

**Disclaimer**
This is general information, not a medical diagnosis. Consult a certified doctor for proper care."""
