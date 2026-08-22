from fastapi import Request, HTTPException, Security, Depends
import fastapi.security
from jose import jwt, JWTError
from app.config.config import settings
from app.services.token_service import verify_access_payload
from app.utils.app_logger import get_logger
from app.utils.ownership import coerce_user_id
from datetime import datetime

security = fastapi.security.HTTPBearer(auto_error=False)
logger = get_logger(__name__)


async def _reject_if_blacklisted(token_str: str | None) -> None:
    """Logout blacklist — no-op when Redis unset."""
    if not token_str:
        return
    try:
        from app.services.session_blacklist import is_access_token_blacklisted

        if await is_access_token_blacklisted(token_str):
            raise HTTPException(status_code=401, detail="Session revoked. Please login again")
    except HTTPException:
        raise
    except Exception:
        return


async def auth_user(request: Request, token: fastapi.security.HTTPAuthorizationCredentials = Depends(security)):
    # Try getting token from Bearer header OR from 'token' header
    token_str = token.credentials if token else None
    
    if not token_str:
        token_str = request.headers.get("token") or request.headers.get("Token")
        
    # Extra check: Authorization header might be sent without 'Bearer ' prefix
    if not token_str:
        auth_header = request.headers.get("Authorization")
        if auth_header and not auth_header.startswith("Bearer "):
            token_str = auth_header
        
    if not token_str:
        logger.warning("Auth failed: no token in request headers")
        raise HTTPException(status_code=401, detail="No token provided")

    await _reject_if_blacklisted(token_str)
        
    try:
        secret = settings.JWT_SECRET.strip('"').strip("'")
        payload = jwt.decode(token_str, secret, algorithms=["HS256"])
        verify_access_payload(payload)

        role = (payload.get("role") or "patient").strip().lower()
        if role != "patient":
            logger.warning("Auth failed: patient route used with role=%s", role)
            raise HTTPException(status_code=403, detail="Patient access required")

        user_id = coerce_user_id(payload.get("id")) or coerce_user_id(payload.get("userId"))
        if user_id is None:
            logger.warning("Auth failed: token missing numeric user id claim")
            raise HTTPException(status_code=401, detail="Invalid token")

        return int(user_id)
    except JWTError as e:
        logger.warning("Auth JWT error: %s", str(e))
        raise HTTPException(status_code=401, detail="Not authorized, login again")

async def auth_admin(request: Request, token: fastapi.security.HTTPAuthorizationCredentials = Depends(security)):
    # Try getting token from Bearer header OR from 'atoken' / 'aToken' / 'token' header
    token_str = token.credentials if token else None
    
    if not token_str:
        all_headers = dict(request.headers)
        token_str = all_headers.get("atoken") or all_headers.get("token") or all_headers.get("Token")
        if not token_str:
            for k, v in all_headers.items():
                if k.lower() in ["atoken", "token"]:
                    token_str = v
                    break

    if not token_str:
        auth_header = request.headers.get("Authorization")
        if auth_header and not auth_header.startswith("Bearer "):
            token_str = auth_header

    if not token_str:
        logger.warning("Admin auth failed: no token in headers")
        raise HTTPException(status_code=401, detail="No admin token provided")

    await _reject_if_blacklisted(token_str)
        
    try:
        secret = settings.JWT_SECRET.strip('"').strip("'")
        payload = jwt.decode(token_str, secret, algorithms=["HS256"])
        verify_access_payload(payload)
        email = payload.get("email")

        expected_admin = getattr(settings, "ADMIN_EMAIL", None)
        if not expected_admin:
            logger.error("ADMIN_EMAIL not configured")
            raise HTTPException(status_code=500, detail="Server configuration error")

        if not email or str(email).strip().lower() != str(expected_admin).strip().lower():
            logger.warning("Admin auth failed: unauthorized email claim")
            raise HTTPException(status_code=401, detail="Not authorized as admin")
        return email
    except JWTError as e:
        logger.warning("Admin auth JWT error: %s", str(e))
        raise HTTPException(status_code=401, detail="Not authorized, login again")

async def auth_doctor(request: Request, token: fastapi.security.HTTPAuthorizationCredentials = Depends(security)):
    # Try getting token from Bearer header OR from 'dtoken' / 'dToken' / 'token' header
    token_str = token.credentials if token else None
    if not token_str:
        token_str = request.headers.get("dtoken") or request.headers.get("dToken") or \
                    request.headers.get("token") or request.headers.get("Token")
        
    if not token_str:
        auth_header = request.headers.get("Authorization")
        if auth_header and not auth_header.startswith("Bearer "):
            token_str = auth_header

    if not token_str:
        raise HTTPException(status_code=401, detail="No doctor token provided")

    await _reject_if_blacklisted(token_str)
        
    try:
        secret = settings.JWT_SECRET.strip('"').strip("'")
        payload = jwt.decode(token_str, secret, algorithms=["HS256"])
        verify_access_payload(payload)
        role = (payload.get("role") or "").strip().lower()
        if role and role != "doctor":
            raise HTTPException(status_code=403, detail="Doctor access required")
        doc_id = coerce_user_id(payload.get("id")) or coerce_user_id(payload.get("userId"))
        if doc_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return int(doc_id)
    except JWTError:
        raise HTTPException(status_code=401, detail="Not authorized, login again")

async def auth_reception(request: Request, token: fastapi.security.HTTPAuthorizationCredentials = Depends(security)):
    """Extract and validate a RECEPTIONIST JWT. Returns dict with id & hospital_id."""
    token_str = token.credentials if token else None
    if not token_str:
        for header_key in ["rectoken", "reception-token", "token"]:
            token_str = request.headers.get(header_key)
            if token_str:
                break
    if not token_str:
        auth_header = request.headers.get("Authorization")
        if auth_header and not auth_header.startswith("Bearer "):
            token_str = auth_header
    if not token_str:
        raise HTTPException(status_code=401, detail="No receptionist token provided")
    await _reject_if_blacklisted(token_str)
    try:
        secret = settings.JWT_SECRET.strip('"').strip("'")
        payload = jwt.decode(token_str, secret, algorithms=["HS256"])
        verify_access_payload(payload)
        if payload.get("role") != "receptionist":
            raise HTTPException(status_code=403, detail="Access denied: receptionist role required")
        rec_id = payload.get("id")
        hospital_id = payload.get("hospital_id")
        if rec_id is None:
            raise HTTPException(status_code=401, detail="Invalid receptionist token")
        return {"id": rec_id, "hospital_id": hospital_id}
    except JWTError:
        raise HTTPException(status_code=401, detail="Not authorized, login again")

async def auth_dean(request: Request, token: fastapi.security.HTTPAuthorizationCredentials = Depends(security)):
    """Extract and validate a DEAN JWT. Returns dict with id & hospital_id."""
    token_str = token.credentials if token else None
    if not token_str:
        for header_key in ["deantoken", "dean-token", "token"]:
            token_str = request.headers.get(header_key)
            if token_str:
                break
    if not token_str:
        auth_header = request.headers.get("Authorization")
        if auth_header and not auth_header.startswith("Bearer "):
            token_str = auth_header
    if not token_str:
        raise HTTPException(status_code=401, detail="No DEAN token provided")
    await _reject_if_blacklisted(token_str)
    try:
        secret = settings.JWT_SECRET.strip('"').strip("'")
        payload = jwt.decode(token_str, secret, algorithms=["HS256"])
        verify_access_payload(payload)
        if payload.get("role") != "dean":
            raise HTTPException(status_code=403, detail="Access denied: DEAN role required")
        dean_id = payload.get("id")
        hospital_id = payload.get("hospital_id")
        if dean_id is None or hospital_id is None:
            raise HTTPException(status_code=401, detail="Invalid DEAN token")
        return {"id": dean_id, "hospital_id": hospital_id}
    except JWTError:
        raise HTTPException(status_code=401, detail="Not authorized, login again")


async def dispatch_auth(request: Request, token: fastapi.security.HTTPAuthorizationCredentials = Depends(security)):
    """Unified dispatch auth — accepts either a DEAN or RECEPTIONIST JWT.
    Returns dict: {id, hospital_id, role} so endpoints can work for both.
    Header precedence: Bearer > deantoken > rectoken > token.
    """
    token_str = token.credentials if token else None
    if not token_str:
        for header_key in ["deantoken", "rectoken", "reception-token", "dean-token", "token"]:
            token_str = request.headers.get(header_key)
            if token_str:
                break
    if not token_str:
        auth_header = request.headers.get("Authorization")
        if auth_header and not auth_header.startswith("Bearer "):
            token_str = auth_header
    if not token_str:
        raise HTTPException(status_code=401, detail="No dispatch token provided (dean or receptionist)")
    await _reject_if_blacklisted(token_str)
    try:
        secret = settings.JWT_SECRET.strip('"').strip("'")
        payload = jwt.decode(token_str, secret, algorithms=["HS256"])
        verify_access_payload(payload)
        role = (payload.get("role") or "").strip().lower()
        if role not in ("dean", "receptionist"):
            raise HTTPException(status_code=403, detail="Access denied: Dean or Receptionist role required")
        actor_id = payload.get("id")
        hospital_id = payload.get("hospital_id")
        if actor_id is None or hospital_id is None:
            raise HTTPException(status_code=401, detail="Invalid dispatch token: missing id or hospital_id")
        return {"id": actor_id, "hospital_id": hospital_id, "role": role}
    except JWTError:
        raise HTTPException(status_code=401, detail="Not authorized, login again")

async def auth_assistant(request: Request, token: fastapi.security.HTTPAuthorizationCredentials = Depends(security)):
    """Any MedClues role for the AI Assistant gateway. Returns {id, role, hospital_id, email}."""
    token_str = token.credentials if token else None
    if not token_str:
        for header_key in (
            "token", "Token", "atoken", "dtoken", "deantoken", "rectoken",
            "reception-token", "dean-token",
        ):
            token_str = request.headers.get(header_key)
            if token_str:
                break
    if not token_str:
        auth_header = request.headers.get("Authorization")
        if auth_header and not auth_header.startswith("Bearer "):
            token_str = auth_header
    if not token_str:
        raise HTTPException(status_code=401, detail="No token provided")

    await _reject_if_blacklisted(token_str)
    try:
        secret = settings.JWT_SECRET.strip('"').strip("'")
        payload = jwt.decode(token_str, secret, algorithms=["HS256"])
        verify_access_payload(payload)

        role = (payload.get("role") or "patient").strip().lower()
        if role in ("superadmin", "super_admin"):
            role = "super_admin"
        email = payload.get("email")
        expected_admin = getattr(settings, "ADMIN_EMAIL", None)
        if email and expected_admin and str(email).strip().lower() == str(expected_admin).strip().lower():
            role = "admin"

        allowed = {"patient", "doctor", "dean", "admin", "receptionist", "super_admin"}
        if role not in allowed:
            raise HTTPException(status_code=403, detail=f"Role '{role}' not allowed for AI Assistant")

        uid = coerce_user_id(payload.get("id")) or coerce_user_id(payload.get("userId"))
        if uid is None and role == "admin":
            uid = 0
        if uid is None:
            raise HTTPException(status_code=401, detail="Invalid token: missing id")

        hospital_id = payload.get("hospital_id")
        try:
            hospital_id = int(hospital_id) if hospital_id is not None else None
        except (TypeError, ValueError):
            hospital_id = None

        return {"id": int(uid), "role": role, "hospital_id": hospital_id, "email": email}
    except HTTPException:
        raise
    except JWTError:
        raise HTTPException(status_code=401, detail="Not authorized, login again")
