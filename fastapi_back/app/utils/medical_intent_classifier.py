import re

# Medical-related keywords (symptoms, diseases, medicines, treatments, etc.)
MEDICAL_KEYWORDS = [
    # Symptoms
    'fever', 'pain', 'headache', 'vomiting', 'dizziness', 'cough', 'cold', 'infection',
    'ache', 'sore', 'hurt', 'hurting', 'hurts', 'sick', 'ill', 'unwell',
    'nausea', 'diarrhea', 'constipation', 'rash', 'itchy', 'fatigue', 'tired',
    'weakness', 'dizzy', 'numbness', 'tingling', 'burning', 'stinging',
    'stomach ache', 'stomach pain', 'abdominal pain', 'back pain', 'neck pain',
    'joint pain', 'chest pain', 'throat pain', 'ear pain', 'eye pain',
    'body pain', 'body ache', 'muscle pain', 'bone pain',
    
    # Diseases/Conditions
    'disease', 'condition', 'disorder', 'syndrome', 'infection', 'virus', 'bacteria',
    'diabetes', 'hypertension', 'asthma', 'allergy', 'allergic', 'flu', 'influenza',
    
    # Medicines/Treatments
    'medicine', 'medication', 'tablet', 'pill', 'syrup', 'capsule', 'drug',
    'treatment', 'remedy', 'cure', 'therapy', 'prescription',
    'can i take', 'should i take', 'what tablet', 'what medicine',
    
    # Health concerns
    'first aid', 'emergency', 'health', 'medical', 'doctor', 'clinic', 'hospital',
    'diagnosis', 'symptom', 'symptoms', 'signs', 'warning',
    
    # Body parts (when mentioned in health context)
    'heart', 'lungs', 'liver', 'kidney', 'stomach', 'head', 'chest', 'back'
]

def classify_intent(message: str, conversation_history: list = None):
    if conversation_history is None:
        conversation_history = []
        
    lower_message = message.lower().strip()
    
    # Check conversation history for context
    recent_context_list = [
        msg.get('content', '').lower() if isinstance(msg, dict) else ''
        for msg in conversation_history[-3:]
    ]
    recent_context = " ".join(recent_context_list)
    
    full_context = f"{recent_context} {lower_message}".lower()
    
    # Check if message contains any medical-related keywords
    detected_keywords = [
        keyword for keyword in MEDICAL_KEYWORDS 
        if keyword.lower() in full_context
    ]
    has_medical_keyword = len(detected_keywords) > 0
    
    # Check for medical question patterns
    medical_question_patterns = [
        r"what (medicine|tablet|pill|syrup)",
        r"can i take",
        r"should i take",
        r"how to treat",
        r"how to cure",
        r"what causes",
        r"why do i have",
        r"is (this|it) (normal|serious|dangerous)"
    ]
    
    has_medical_pattern = any(
        re.search(pattern, lower_message, re.IGNORECASE) 
        for pattern in medical_question_patterns
    )
    
    if has_medical_keyword or has_medical_pattern:
        return {
            'intent': 'MEDICAL_MODE',
            'confidence': 'high' if (has_medical_keyword and has_medical_pattern) else 'medium',
            'detectedKeywords': detected_keywords
        }
    
    # Default to NORMAL_MODE
    return {
        'intent': 'NORMAL_MODE',
        'confidence': 'high',
        'detectedKeywords': []
    }
