"""Validate JSON bodies with Pydantic while preserving legacy error shape."""
from pydantic import BaseModel, ValidationError
from fastapi.responses import JSONResponse


def validate_body(model: type[BaseModel], body: dict) -> BaseModel | JSONResponse:
    try:
        return model.model_validate(body)
    except ValidationError as exc:
        first = exc.errors()[0] if exc.errors() else {}
        loc = ".".join(str(x) for x in first.get("loc", ()))
        msg = first.get("msg", "Invalid request")
        detail = f"{loc}: {msg}" if loc else msg
        return JSONResponse(
            status_code=400,
            content={"success": False, "message": detail, "detail": exc.errors()},
        )
