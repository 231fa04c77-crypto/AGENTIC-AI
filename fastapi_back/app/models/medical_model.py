from app.config.db import db
import json

async def search_medical_knowledge_db(term: str):
    # Supports legacy `symptom` + additive `keyword`/`source` columns (migration 037).
    # `conditions` is JSONB in production — search via jsonb_array_elements_text.
    sql = """
        SELECT * FROM medical_knowledge
        WHERE
            COALESCE(keyword, '') ILIKE $1
            OR COALESCE(symptom, '') ILIKE $1
            OR COALESCE(source, '') ILIKE $1
            OR EXISTS (
                SELECT 1
                FROM jsonb_array_elements_text(COALESCE(conditions, '[]'::jsonb)) AS c(val)
                WHERE c.val ILIKE $1 OR $1 ILIKE ('%' || c.val || '%')
            )
    """
    return await db.fetch_all(sql, f"%{term}%")

async def get_medical_knowledge_by_keyword(keyword: str):
    sql = """
        SELECT * FROM medical_knowledge
        WHERE keyword ILIKE $1 OR symptom ILIKE $1
        LIMIT 1
    """
    return await db.fetch_one(sql, keyword)

async def get_emergency_records(query_text: str):
    sql = """
        SELECT * FROM medical_knowledge
        WHERE COALESCE(category, '') = 'emergency'
          AND (
            $1 ILIKE ('%' || COALESCE(keyword, symptom, '') || '%')
            OR COALESCE(keyword, symptom, '') ILIKE ('%' || $1 || '%')
          )
    """
    return await db.fetch_all(sql, query_text)

async def add_medical_record(data: dict):
    sql = """
        INSERT INTO medical_knowledge (
            keyword, symptom, category, severity, conditions, otc_medicines,
            precautions, when_to_see_doctor, immediate_action, do_not, source
        ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9, $10::jsonb, $11)
        RETURNING *
    """
    keyword = data.get('keyword') or data.get('symptom')
    values = [
        keyword,
        data.get('symptom') or keyword,
        data.get('category', 'symptom'),
        data.get('severity', 'Low'),
        json.dumps(data.get('conditions', [])),
        json.dumps(data.get('otc_medicines', [])),
        json.dumps(data.get('precautions', [])),
        data.get('when_to_see_doctor'),
        data.get('immediate_action'),
        json.dumps(data.get('do_not', [])),
        data.get('source', 'Medical Knowledge Base')
    ]
    return await db.fetch_one(sql, *values)
