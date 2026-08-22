import cloudinary.uploader
import json
import os
from datetime import datetime
from fastapi import UploadFile
from typing import List, Optional
from app.models import health_record_model, appointment_model, user_model
from app.services import audit_service, email_service
import asyncio
from app.utils.formatters import format_health_record
from app.utils.ownership import load_appointment_for_user, row_owned_by, unauthorized

async def create_health_record(
    user_id: int,
    record_type: str,
    title: str,
    description: str,
    doctor_name: str,
    doc_id: Optional[int],
    appointment_id: Optional[int],
    date_str: str,
    tags: str,
    is_important: bool,
    files: List[UploadFile]
):
    try:
        if appointment_id:
            _, err = await load_appointment_for_user(int(appointment_id), user_id)
            if err:
                return err

        # Set defaults
        if not record_type: record_type = 'General'
        if not date_str: date_str = datetime.now().strftime('%Y-%m-%d')
        
        if not title or not title.strip():
            title = f"Medical Report - {date_str}"

        # Parse tags
        tags_array = []
        if tags:
            try:
                tags_array = json.loads(tags)
            except:
                tags_array = [tags]

        def _detect_file_type(filename: str, content_type: Optional[str]) -> str:
            lower = (filename or '').lower()
            if lower.endswith('.pdf'):
                return 'pdf'
            if lower.endswith('.docx'):
                return 'docx'
            if lower.endswith('.doc'):
                return 'doc'
            if lower.endswith('.wps'):
                return 'wps'
            if lower.endswith(('.jpg', '.jpeg')):
                return 'jpg'
            if lower.endswith('.png'):
                return 'png'
            ct = (content_type or '').lower()
            if 'pdf' in ct:
                return 'pdf'
            if 'wordprocessingml' in ct or 'docx' in ct:
                return 'docx'
            if 'msword' in ct:
                return 'doc'
            if 'jpeg' in ct or 'jpg' in ct:
                return 'jpg'
            if 'png' in ct:
                return 'png'
            return 'unknown'

        # Upload files to Cloudinary
        uploaded_files = []
        user_row = await user_model.get_user_by_id(user_id)
        from app.services.cloudinary_folders import patient_reports_folder

        report_folder = patient_reports_folder(user_row, user_id=user_id)
        for file in files:
            try:
                from app.utils.upload_safe import (
                    UploadRejected,
                    cloudinary_upload_bytes,
                    read_upload_limited,
                )

                try:
                    file_content, fname, ctype = await read_upload_limited(file)
                except UploadRejected as ure:
                    print(f"File upload rejected: {ure.message}")
                    continue

                upload_result = await cloudinary_upload_bytes(
                    file_content,
                    folder=report_folder,
                    resource_type="auto",
                )

                uploaded_files.append({
                    "url": upload_result.get('secure_url'),
                    "fileName": fname,
                    "fileType": _detect_file_type(fname or '', ctype),
                    "fileSize": len(file_content),
                    "cloudinaryPublicId": upload_result.get('public_id')
                })
            except Exception as upload_err:
                print(f"File upload error: {upload_err}")

        record_data = {
            "userId": user_id,
            "appointmentId": appointment_id,
            "docId": doc_id,
            "recordType": record_type,
            "title": title,
            "description": description or '',
            "doctorName": doctor_name or '',
            "date": datetime.strptime(date_str, '%Y-%m-%d') if date_str else datetime.now(),
            "files": uploaded_files,
            "tags": tags_array,
            "isImportant": is_important,
            "uploadedBeforeAppointment": bool(appointment_id)
        }

        new_record = await health_record_model.create_health_record(record_data)

        try:
            user = await user_model.get_user_by_id(user_id)
            if user and user.get("email"):
                upload_date = date_str or datetime.now().strftime("%d %B %Y")
                if len(str(upload_date)) == 10 and "-" in str(upload_date):
                    try:
                        upload_date = datetime.strptime(str(upload_date), "%Y-%m-%d").strftime("%d %B %Y")
                    except ValueError:
                        pass
                uploaded_by = doctor_name.strip() if doctor_name and doctor_name.strip() else "MEDCLUES"
                asyncio.create_task(
                    email_service.send_medical_report_available(
                        user["email"],
                        user.get("name", "Patient"),
                        title,
                        upload_date,
                        uploaded_by,
                        record_type or "General",
                    )
                )
                from app.services import telegram_notify_service
                asyncio.create_task(
                    telegram_notify_service.notify_report_available(
                        user_id,
                        user.get("name", "Patient"),
                        title,
                        upload_date,
                    )
                )
        except Exception as mail_err:
            print(f"[WARNING] Health record email failed: {mail_err}")

        return {"success": True, "message": "Health record uploaded", "record": format_health_record(new_record)}

    except Exception as e:
        print(f"Create Health Record Error: {e}")
        return {"success": False, "message": str(e)}

def _attachments_list(record: dict) -> list:
    attachments = record.get('attachments', [])
    if isinstance(attachments, str):
        attachments = json.loads(attachments)
    return attachments if isinstance(attachments, list) else []


async def _get_record_file_meta(user_id: int, record_id: int, file_index: int):
    record = await health_record_model.get_health_record_by_id(record_id)
    if not row_owned_by(record, user_id):
        return None, None
    attachments = _attachments_list(record)
    if not attachments or file_index < 0 or file_index >= len(attachments):
        return None, None
    return record, attachments[file_index]


async def stream_record_file(
    user_id: int,
    record_id: int,
    file_index: int = 0,
    *,
    ip_address: str | None = None,
    user_agent: str | None = None,
):
    """Fetch file bytes for inline viewing (bypasses browser Cloudinary PDF issues)."""
    try:
        from app.services.cloudinary_delivery import fetch_file_bytes

        _, file_meta = await _get_record_file_meta(user_id, record_id, file_index)
        if not file_meta:
            return {"success": False, "message": "Record or file not found"}

        await audit_service.log_access(
            action="health_record.download",
            resource="health_records",
            resource_id=record_id,
            actor_id=user_id,
            actor_role="patient",
            ip_address=ip_address,
            user_agent=user_agent,
            metadata={"fileIndex": file_index, "fileName": file_meta.get("fileName")},
        )

        content, content_type, filename = await fetch_file_bytes(file_meta)
        return {
            "success": True,
            "content": content,
            "contentType": content_type,
            "fileName": filename,
        }
    except Exception as e:
        return {"success": False, "message": str(e)}


async def get_record_file_view_url(
    user_id: int,
    record_id: int,
    file_index: int = 0,
    *,
    ip_address: str | None = None,
    user_agent: str | None = None,
):
    try:
        from app.services.cloudinary_delivery import get_viewable_url

        _, file_meta = await _get_record_file_meta(user_id, record_id, file_index)
        if not file_meta:
            return {"success": False, "message": "Record or file not found"}

        await audit_service.log_access(
            action="health_record.view_url",
            resource="health_records",
            resource_id=record_id,
            actor_id=user_id,
            actor_role="patient",
            ip_address=ip_address,
            user_agent=user_agent,
            metadata={"fileIndex": file_index, "fileName": file_meta.get("fileName")},
        )

        view_url = get_viewable_url(file_meta)
        if not view_url:
            return {"success": False, "message": "No viewable URL for this file"}

        return {
            "success": True,
            "viewUrl": view_url,
            "fileName": file_meta.get('fileName'),
            "fileType": file_meta.get('fileType'),
        }
    except Exception as e:
        return {"success": False, "message": str(e)}


async def get_health_records(user_id: int, params: dict):
    try:
        from app.utils.pagination import parse_pagination, pagination_meta, with_pagination

        params["userId"] = user_id
        limit, offset = parse_pagination(
            params.get("limit"),
            params.get("offset"),
        )
        if limit is not None:
            params["limit"] = limit
            params["offset"] = offset
        total = await health_record_model.count_health_records(params)
        records = await health_record_model.get_health_records(params)
        formatted_records = [format_health_record(r) for r in records]
        payload = {"success": True, "records": formatted_records}
        return with_pagination(
            payload,
            pagination_meta(
                total=total,
                limit=limit,
                offset=offset,
                returned=len(formatted_records),
            ),
        )
    except Exception as e:
        return {"success": False, "message": str(e)}

async def delete_health_record(user_id: int, record_id: int):
    try:
        record = await health_record_model.get_health_record_by_id(record_id)
        if not row_owned_by(record, user_id):
            return unauthorized("Record not found or unauthorized")

        # Delete from Cloudinary
        attachments = record.get('attachments', [])
        if isinstance(attachments, str):
            attachments = json.loads(attachments)
            
        for file in attachments:
            if file.get('cloudinaryPublicId'):
                try:
                    cloudinary.uploader.destroy(file['cloudinaryPublicId'])
                except: pass

        await health_record_model.delete_health_record(record_id)
        return {"success": True, "message": "Record deleted successfully"}
    except Exception as e:
        return {"success": False, "message": str(e)}

async def get_patient_records_for_doctor(
    doc_id: int,
    appointment_id: int,
    *,
    ip_address: str | None = None,
    user_agent: str | None = None,
):
    try:
        appointment = await appointment_model.get_appointment_by_id(appointment_id)
        if not appointment or appointment['doctor_id'] != doc_id:
            return {"success": False, "message": "Unauthorized access"}

        await audit_service.log_access(
            action="health_record.list_for_appointment",
            resource="appointments",
            resource_id=appointment_id,
            actor_id=doc_id,
            actor_role="doctor",
            ip_address=ip_address,
            user_agent=user_agent,
            metadata={"patientUserId": appointment.get("user_id")},
        )

        records = await health_record_model.get_health_records_by_user_id(appointment['user_id'])
        formatted_records = [format_health_record(r) for r in records]
        return {"success": True, "records": formatted_records}
    except Exception as e:
        return {"success": False, "message": str(e)}

async def mark_record_as_viewed(doc_id: int, record_id: int):
    try:
        # Check if record exists
        record = await health_record_model.get_health_record_by_id(record_id)
        if not record:
            return {"success": False, "message": "Record not found"}

        # Update viewed status
        await health_record_model.update_health_record(record_id, {
            "viewedByDoctor": True,
            "viewedAt": datetime.now()
        })
        return {"success": True, "message": "Record marked as viewed"}
    except Exception as e:
        return {"success": False, "message": str(e)}
