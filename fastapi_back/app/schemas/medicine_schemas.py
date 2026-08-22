"""Pydantic schemas for the Medicine Information module."""
from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class MedicineCard(BaseModel):
    medicineKey: str
    medicineName: str
    brandName: Optional[str] = None
    genericName: Optional[str] = None
    manufacturer: Optional[str] = None
    dosageForm: Optional[str] = None
    route: Optional[str] = None
    shortDescription: Optional[str] = None
    placeholderType: str = "tablet"


class MedicineDetails(BaseModel):
    medicineKey: str
    medicineName: str
    brandName: Optional[str] = None
    genericName: Optional[str] = None
    manufacturer: Optional[str] = None
    purpose: Optional[str] = None
    uses: Optional[str] = None
    indications: Optional[str] = None
    activeIngredients: list[str] = Field(default_factory=list)
    inactiveIngredients: list[str] = Field(default_factory=list)
    dosageForm: Optional[str] = None
    route: Optional[str] = None
    warnings: Optional[str] = None
    boxedWarning: Optional[str] = None
    pregnancyWarning: Optional[str] = None
    pediatricUse: Optional[str] = None
    geriatricUse: Optional[str] = None
    drugAbuse: Optional[str] = None
    drugInteractions: Optional[str] = None
    contraindications: Optional[str] = None
    sideEffects: Optional[str] = None
    storage: Optional[str] = None
    howSupplied: Optional[str] = None
    packageLabel: Optional[str] = None
    stopUse: Optional[str] = None
    askDoctor: Optional[str] = None
    doNotUse: Optional[str] = None
    dosageAndAdministration: Optional[str] = None
    placeholderType: str = "tablet"
    rawOpenFda: Optional[dict[str, Any]] = None


class MedicineSearchResponse(BaseModel):
    success: bool = True
    count: int = 0
    results: list[MedicineCard] = Field(default_factory=list)
    page: int = 1
    limit: int = 10
    message: Optional[str] = None
    cached: bool = False
    responseTimeMs: Optional[float] = None


class MedicineFavoriteCreate(BaseModel):
    medicineKey: str
    brandName: Optional[str] = None
    genericName: Optional[str] = None
    manufacturer: Optional[str] = None
    dosageForm: Optional[str] = None
    shortDescription: Optional[str] = None
