from datetime import datetime, timedelta
from app.utils import medical_intent_classifier, medical_handler, ai_knowledge_base
from app.services import mistral_service
from app.models import doctor_model, appointment_model

async def get_doctors_context():
    try:
        all_doctors = await doctor_model.get_all_doctors()
        available_doctors = [doc for doc in all_doctors if doc.get('available')]
        specialties = list(set([doc.get('speciality') for doc in available_doctors]))
        
        return {
            "doctors": [
                {
                    "id": d['id'],
                    "name": d['name'],
                    "speciality": d['speciality'],
                    "degree": d.get('degree'),
                    "experience": d.get('experience'),
                    "fees": float(d.get('fees', 0))
                } for d in available_doctors
            ],
            "specialties": specialties
        }
    except Exception as e:
        print(f"Error fetching doctors context: {e}")
        return {"doctors": [], "specialties": []}

async def get_available_slots(doc_id: int):
    try:
        doctor = await doctor_model.get_doctor_by_id(doc_id)
        if not doctor: return []
        
        # In a real app we'd calculate slots based on doctor.slots_booked
        # Replicating simple slot logic from Node.js
        available_slots = []
        today = datetime.now()
        
        for i in range(7):
            current_date = today + timedelta(days=i)
            date_str = current_date.strftime('%d_%m_%Y')
            display_date = current_date.strftime('%a, %b %d')
            
            day_slots = []
            # Simplified slot generation (10 AM to 9 PM)
            for hour in range(10, 21):
                for minute in [0, 30]:
                    slot_time = f"{hour:02}:{minute:02}"
                    day_slots.append({
                        "date": date_str,
                        "time": slot_time,
                        "displayDate": display_date,
                        "displayTime": slot_time
                    })
            
            if day_slots:
                available_slots.append({
                    "date": date_str,
                    "displayDate": current_date.strftime('%A, %B %d'),
                    "slots": day_slots[:5] # Limit to 5 per day as in Node.js
                })
                
        return available_slots
    except Exception as e:
        print(f"Error fetching available slots: {e}")
        return []

def extract_booking_intent(message: str, doctors_context: dict):
    lower_message = message.lower()
    intent = {
        "specialty": None,
        "doctorName": None,
        "doctorId": None
    }
    
    # Simple name matching
    for doc in doctors_context['doctors']:
        if doc['name'].lower() in lower_message:
            intent['doctorName'] = doc['name']
            intent['doctorId'] = doc['id']
            break
            
    if not intent['doctorId']:
        for spec in doctors_context['specialties']:
            if spec.lower() in lower_message:
                intent['specialty'] = spec
                break
                
    return intent

async def ai_chat(message: str, conversation_history: list = None, user_id: int = None):
    try:
        if conversation_history is None:
            conversation_history = []
            
        doctors_context = await get_doctors_context()
        intent_classification = medical_intent_classifier.classify_intent(message, conversation_history)
        
        # --- Medical Mode ---
        if intent_classification['intent'] == 'MEDICAL_MODE':
            return await medical_handler.handle_medical_mode(
                message, conversation_history, intent_classification, doctors_context
            )
            
        # --- Normal Mode ---
        booking_intent = extract_booking_intent(message, doctors_context)
        
        selected_doctor = None
        available_slots = None
        
        if booking_intent['doctorId']:
            selected_doctor = next((d for d in doctors_context['doctors'] if d['id'] == booking_intent['doctorId']), None)
            if selected_doctor:
                available_slots = await get_available_slots(selected_doctor['id'])
        elif booking_intent['specialty']:
            spec_docs = [d for d in doctors_context['doctors'] if d['speciality'] == booking_intent['specialty']]
            if spec_docs:
                selected_doctor = spec_docs[0]
                available_slots = await get_available_slots(selected_doctor['id'])

        system_prompt = ai_knowledge_base.get_system_training_prompt()
        system_prompt += f"\nAVAILABLE DOCTORS (Real-time):\n"
        system_prompt += chr(10).join([f"- Dr. {d['name']} ({d['speciality']})" for d in doctors_context['doctors'][:10]])
        
        if available_slots and selected_doctor:
            system_prompt += f"\nCRITICAL: The user is interested in {selected_doctor['name']}. Mention their slots."

        ai_response = await mistral_service.generate_chat_completion(message, conversation_history, system_prompt)

        response_data = {
            "success": True,
            "response": ai_response,
            "suggestedActions": [],
            "timestamp": datetime.now().isoformat(),
            "provider": "Mistral AI (Python Port)"
        }
        
        if selected_doctor and available_slots:
            response_data['bookingData'] = {
                "doctorId": selected_doctor['id'],
                "doctorName": selected_doctor['name'],
                "availableSlots": available_slots[:3]
            }
            response_data['suggestedActions'].append({
                "type": "show_slots",
                "label": f"View Slots for {selected_doctor['name']}",
                "action": "show_slots",
                "doctorId": selected_doctor['id']
            })
            
        return response_data

    except Exception as e:
        print(f"AI Chat Error: {e}")
        return {"success": False, "message": str(e)}

async def get_doctor_slots(doc_id: int):
    try:
        doctor = await doctor_model.get_doctor_by_id(doc_id)
        if not doctor: return {"success": False, "message": "Doctor not found"}
        
        slots = await get_available_slots(doc_id)
        return {
            "success": True,
            "doctor": {"id": doctor['id'], "name": doctor['name'], "speciality": doctor['speciality']},
            "availableSlots": slots
        }
    except Exception as e:
        return {"success": False, "message": str(e)}

async def get_user_appointments_context(user_id: int):
    try:
        appointments = await appointment_model.get_appointments_by_user_id(user_id)
        # Filter and sort
        active_apts = [a for a in appointments if not a.get('cancelled') and not a.get('is_completed')]
        active_apts.sort(key=lambda x: x.get('slot_date', ''))
        
        return {
            "success": True,
            "appointments": active_apts[:5]
        }
    except Exception as e:
        return {"success": False, "message": str(e)}
