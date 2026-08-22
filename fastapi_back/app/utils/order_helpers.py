from datetime import datetime, timedelta, date
from typing import Dict, Any

def is_investigation_pending_review(inv: Dict[str, Any], threshold_minutes: int = 30) -> bool:
    """Returns True if the investigation has a report available but hasn't been reviewed

    and has exceeded the threshold minutes since the report was made available.
    """
    status = inv.get("status")
    if status != "REPORT_AVAILABLE":
        return False
    rrs = str(inv.get("report_review_status") or "PENDING").upper()
    return rrs == "PENDING"
