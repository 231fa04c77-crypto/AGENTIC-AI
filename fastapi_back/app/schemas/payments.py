from pydantic import BaseModel, ConfigDict, Field, model_validator


class CreateOrderRequest(BaseModel):
    """Appointment Razorpay create-order. `amount` is always paise (integer rupees×100)."""

    model_config = ConfigDict(populate_by_name=True)

    amount: float | None = Field(default=None, ge=0, description="Amount in paise")
    doctor_id: str | int | None = None
    currency: str = Field(default="INR", max_length=8)
    receipt: str | None = Field(default=None, max_length=64)
    appointment_date: str | None = None
    appointment_time: str | None = None
    visit_type: str | None = None
    mode: str | None = None
    notes: str | None = Field(default=None, max_length=500)
    slot_id: int | str | None = None
    slot_type: str | None = None
    symptoms: list[str] | None = None
    actual_patient: dict | None = Field(default=None, alias="actualPatient")

    @model_validator(mode="after")
    def require_amount_or_doctor(self):
        if self.doctor_id is None and self.amount is None:
            raise ValueError("amount is required (paise)")
        return self
