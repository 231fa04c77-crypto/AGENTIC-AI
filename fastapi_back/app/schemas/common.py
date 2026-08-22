from pydantic import BaseModel, Field


class PaginationQuery(BaseModel):
    limit: int | None = Field(default=None, ge=1, le=200)
    offset: int = Field(default=0, ge=0)
