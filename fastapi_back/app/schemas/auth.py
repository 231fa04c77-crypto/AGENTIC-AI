from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    phone: str | None = Field(default=None, max_length=20)
    # Firebase phone ID token (proves the number via SMS OTP). Optional so signup
    # still works when phone verification isn't enforced.
    phoneIdToken: str | None = Field(default=None, max_length=4096)


class OtpSendRequest(BaseModel):
    email: EmailStr


class OtpVerifyRequest(BaseModel):
    email: EmailStr
    otp: str = Field(min_length=4, max_length=10)
