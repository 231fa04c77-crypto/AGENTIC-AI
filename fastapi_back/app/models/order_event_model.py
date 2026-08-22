import json
from typing import List, Dict, Any, Optional
from app.config.db import db

async def create_order_event(
    entity_type: str,
    entity_id: int,
    event_type: str,
    payload: Dict[str, Any] = {}
) -> Dict[str, Any]:
    sql = """
        INSERT INTO order_events (entity_type, entity_id, event_type, payload)
        VALUES ($1, $2, $3, $4)
        RETURNING *
    """
    return await db.fetch_row(sql, entity_type, entity_id, event_type, json.dumps(payload))

async def get_order_events(entity_type: str, entity_id: int) -> List[Dict[str, Any]]:
    sql = """
        SELECT * FROM order_events 
        WHERE entity_type = $1 AND entity_id = $2 
        ORDER BY created_at ASC
    """
    return await db.query(sql, entity_type, entity_id)
