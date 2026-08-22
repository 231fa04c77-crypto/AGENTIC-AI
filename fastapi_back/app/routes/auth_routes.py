from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.responses import JSONResponse

from app.controllers import auth_controller
from app.middleware.auth import auth_user, auth_admin, auth_doctor, auth_dean
from app.utils.auth_response import build_auth_response
from app.utils.refresh_cookie import clear_refresh_cookie, uses_cookie_storage

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/forgot-password")
async def forgot_password(req: Request):
    body = await req.json()
    email = body.get("email")
    role = body.get("role", "patient")
    result = await auth_controller.forgot_password(email, role)
    if result.get("success") is False:
        raise HTTPException(status_code=400, detail=result.get("message", "Failed to send OTP"))
    return result


@router.post("/verify-otp")
async def verify_otp(req: Request):
    body = await req.json()
    result = await auth_controller.verify_otp(
        body.get("email"),
        body.get("otp"),
        body.get("role", "patient"),
    )
    if not result.get("valid"):
        raise HTTPException(status_code=400, detail=result.get("message", "Invalid OTP"))
    return result


@router.post("/reset-password")
async def reset_password(req: Request):
    body = await req.json()
    new_password = body.get("new_password") or body.get("newPassword")
    result = await auth_controller.reset_password(
        body.get("email"),
        body.get("otp"),
        new_password,
        body.get("role", "patient"),
    )
    if result.get("success") is False:
        raise HTTPException(status_code=400, detail=result.get("message", "Reset failed"))
    return result


@router.post("/refresh")
async def refresh(req: Request):
    body = await req.json()
    role = body.get("role", "patient")
    result = await auth_controller.refresh_tokens(
        body.get("refresh_token") or body.get("refreshToken"),
        role,
        request=req,
    )
    if not result.get("success"):
        raise HTTPException(status_code=401, detail=result.get("message", "Refresh failed"))
    return build_auth_response(result, role, req)


@router.post("/logout")
async def logout(req: Request):
    body = await req.json()
    role = body.get("role", "patient")
    result = await auth_controller.logout(
        body.get("refresh_token") or body.get("refreshToken"),
        role,
        request=req,
    )
    response = JSONResponse(content=result)
    if uses_cookie_storage(req):
        clear_refresh_cookie(response, role)
    return response


@router.post("/logout-all")
async def logout_all(req: Request, user_id: int = Depends(auth_user)):
    body = await req.json()
    role = (body.get("role") or "patient").strip().lower()
    if role != "patient":
        raise HTTPException(status_code=400, detail="Use role-specific logout-all for non-patient roles")
    result = await auth_controller.logout_all(role=role, request=req, user_id=user_id)
    response = JSONResponse(content=result)
    if uses_cookie_storage(req):
        clear_refresh_cookie(response, role)
    return response


@router.post("/logout-all/admin")
async def logout_all_admin(req: Request, email: str = Depends(auth_admin)):
    body = await req.json()
    result = await auth_controller.logout_all(role="admin", request=req, email=email)
    response = JSONResponse(content=result)
    if uses_cookie_storage(req):
        clear_refresh_cookie(response, "admin")
    return response


@router.post("/logout-all/doctor")
async def logout_all_doctor(req: Request, doctor_id: int = Depends(auth_doctor)):
    body = await req.json()
    result = await auth_controller.logout_all(role="doctor", request=req, user_id=doctor_id)
    response = JSONResponse(content=result)
    if uses_cookie_storage(req):
        clear_refresh_cookie(response, "doctor")
    return response


@router.post("/logout-all/dean")
async def logout_all_dean(req: Request, dean_ctx: dict = Depends(auth_dean)):
    body = await req.json()
    result = await auth_controller.logout_all(
        role="dean", request=req, user_id=dean_ctx.get("id")
    )
    response = JSONResponse(content=result)
    if uses_cookie_storage(req):
        clear_refresh_cookie(response, "dean")
    return response
