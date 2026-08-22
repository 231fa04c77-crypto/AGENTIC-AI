from pydantic import BaseModel, Field


class EmergencyAlertRequest(BaseModel):
    phone: str = Field(min_length=10, max_length=20)
    patientName: str = Field(min_length=1, max_length=120)
    location: str | dict | None = None
    source: str | None = Field(default=None, max_length=32)
