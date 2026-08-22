from app.models import super_appointment_model
from typing import Dict, Any
from app.services import email_service

async def book_appointment(data: Dict[str, Any]):
    try:
        # Basic validation
        if not data.get('user_name') or not data.get('email') or not data.get('appointment_date'):
            return {"success": False, "message": "Missing required fields."}
            
        appointment = await super_appointment_model.create_super_appointment(data)
        if appointment:
            # Send confirmation email
            try:
                await email_service.send_super_appointment_notification(
                    data.get('email'),
                    data.get('user_name'),
                    data
                )
            except Exception as e:
                print(f"Email Error (Super Appointment): {e}")

            return {"success": True, "message": "Appointment booked successfully.", "appointment": appointment}
        else:
            return {"success": False, "message": "Failed to store appointment in database."}
    except Exception as e:
        print(f"Error in book_appointment: {e}")
        return {"success": False, "message": str(e)}

async def list_appointments():
    try:
        appointments = await super_appointment_model.get_all_super_appointments()
        return {"success": True, "appointments": appointments}
    except Exception as e:
        print(f"Error in list_appointments: {e}")
        return {"success": False, "message": str(e)}

async def update_status(appointment_id: int, status: str):
    try:
        appointment = await super_appointment_model.update_super_appointment_status(appointment_id, status)
        if appointment:
            # Send status update email
            try:
                await email_service.send_super_appointment_status_update(
                    appointment['email'],
                    appointment['user_name'],
                    appointment['service_type'],
                    status
                )
            except Exception as e:
                print(f"Email Error (Update Status): {e}")

            return {"success": True, "message": f"Appointment {status} successfully."}
        return {"success": False, "message": "Appointment not found."}
    except Exception as e:
        return {"success": False, "message": str(e)}
