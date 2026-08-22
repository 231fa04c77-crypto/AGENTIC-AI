import cloudinary.uploader
from datetime import datetime
from fastapi import UploadFile, File, Response
from app.models import job_application_model
from app.services import email_service
from app.services.cloudinary_folders import job_applications_folder

async def apply_for_job(data: dict, resume_file: UploadFile):
    try:
        # Upload resume to Cloudinary
        # This matches how medical reports and profile images are stored
        file_content = await resume_file.read()
        
        upload_result = cloudinary.uploader.upload(
            file_content,
            folder=job_applications_folder(),
            resource_type="auto",
            public_id=f"{datetime.now().timestamp()}_{resume_file.filename.split('.')[0]}",
        )
        
        image_url = upload_result.get('secure_url')

        data['resume_file_path'] = image_url
        data['status'] = 'pending'
        
        result = await job_application_model.create_job_application(data)
        if result:
            return {"success": True, "message": "Application submitted successfully."}
        else:
            return {"success": False, "message": "Failed to save application to database."}
    except Exception as e:
        print(f"Error in apply_for_job: {e}")
        return {"success": False, "message": f"Server Error: {str(e)}"}

async def list_job_applications(search: str = None):
    try:
        if search:
            applications = await job_application_model.search_job_applications(search)
        else:
            applications = await job_application_model.get_all_job_applications()
        return {"success": True, "applications": applications}
    except Exception as e:
        return {"success": False, "message": str(e)}

async def get_resume(application_id: int):
    try:
        application = await job_application_model.get_job_application_by_id(application_id)
        if not application or not application.get('resume_url'):
            print(f"Resume not found for ID: {application_id}")
            return Response(status_code=404, content="Resume not found.")
        
        url = application['resume_url']
        
        # Check if it's a Cloudinary URL or a local path (legacy)
        if url.startswith('http'):
            # Return a direct redirect. This is better for performance and 
            # handles Cloudinary's secure serving correctly by letting the 
            # browser handle the final request directly.
            print(f"🔀 Redirecting to Cloudinary: {url}")
            from fastapi.responses import RedirectResponse
            return RedirectResponse(url)
        else:
            from fastapi.responses import FileResponse
            if os.path.exists(url):
                print(f"📂 Serving local resume: {url}")
                return FileResponse(url)
            else:
                return Response(status_code=404, content="Local resume file no longer exists.")
                
    except Exception as e:
        print(f"Error in get_resume: {e}")
        return Response(status_code=500, content=str(e))

async def delete_job_application(application_id: int):
    try:
        application = await job_application_model.get_job_application_by_id(application_id)
        if not application:
            return {"success": False, "message": "Application not found."}

        # Delete resume from Cloudinary if it exists
        # In this implementation, we'd need public_id. For now just removing DB record
        # but Cloudinary suggests cleanup eventually.
        await job_application_model.delete_job_application(application_id)
        return {"success": True, "message": "Application deleted successfully."}
    except Exception as e:
        return {"success": False, "message": str(e)}

async def approve_job_application(application_id: int):
    try:
        application = await job_application_model.get_job_application_by_id(application_id)
        if not application:
            return {"success": False, "message": "Application not found."}

        await job_application_model.update_job_application_status(application_id, 'approved')

        # Send interview email
        await email_service.send_job_email(
            application['email'],
            application['name'],
            application['position'],
            'interview'
        )

        return {"success": True, "message": "Application approved and interview email sent."}
    except Exception as e:
        print(f"Approve Error: {e}")
        return {"success": False, "message": str(e)}

async def reject_job_application(application_id: int):
    try:
        application = await job_application_model.get_job_application_by_id(application_id)
        if not application:
            return {"success": False, "message": "Application not found."}

        await job_application_model.update_job_application_status(application_id, 'rejected')

        # Send rejection email
        await email_service.send_job_email(
            application['email'],
            application['name'],
            application['position'],
            'rejection'
        )

        return {"success": True, "message": "Application rejected and email sent."}
    except Exception as e:
        return {"success": False, "message": str(e)}
