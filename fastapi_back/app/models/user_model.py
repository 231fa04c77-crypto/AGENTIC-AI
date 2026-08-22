import json
from datetime import datetime
from typing import Optional, List, Dict, Any
from app.config.db import db

async def get_all_users():
    sql = 'SELECT * FROM users ORDER BY created_at DESC'
    return await db.query(sql)

async def get_all_users_minimal():
    """Fetch only basic user info for management lists to improve performance."""
    sql = 'SELECT id, public_id, name, email, phone, image, address_line1, address_line2, gender, dob, age, blood_group, role, created_at, trust_score, trust_level, total_no_shows, completed_visits FROM users ORDER BY created_at DESC'
    return await db.query(sql)

async def get_user_by_id(user_id: int):
    sql = 'SELECT * FROM users WHERE id = $1'
    return await db.fetch_row(sql, user_id)

async def get_user_by_email(email: str):
    sql = 'SELECT * FROM users WHERE email = $1'
    return await db.fetch_row(sql, email)

async def search_users(q: str, limit: int = 20):
    """Search patients by name, phone, email or public_id (reception lookup)."""
    term = (q or "").strip()
    if not term:
        return []
    like = f"%{term}%"
    sql = """
        SELECT id, public_id, name, email, phone, image, gender, dob, age,
               address_line1, address_line2, blood_group
        FROM users
        WHERE role = 'patient'
          AND (
            name ILIKE $1
            OR phone ILIKE $1
            OR email ILIKE $1
            OR public_id ILIKE $1
          )
        ORDER BY name ASC
        LIMIT $2
    """
    return await db.query(sql, like, int(limit))

async def create_user(user_data: Dict[str, Any]):
    from app.services import public_id_service

    public_id = await public_id_service.new_patient_public_id()
    sql = """
        INSERT INTO users (
            name, email, password, image, phone, address_line1, address_line2,
            gender, dob, age, blood_group, role, public_id, phone_verified, email_verified
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *
    """
    values = (
        user_data.get('name'),
        user_data.get('email'),
        user_data.get('password'),
        user_data.get('image'),
        user_data.get('phone', '000000000'),
        user_data.get('address', {}).get('line1', ''),
        user_data.get('address', {}).get('line2', ''),
        user_data.get('gender', 'Not Selected'),
        user_data.get('dob', 'Not Selected'),
        user_data.get('age'),
        user_data.get('bloodGroup', ''),
        user_data.get('role', 'patient'),
        public_id,
        bool(user_data.get('phone_verified', False)),
        bool(user_data.get('email_verified', False)),
    )
    return await db.fetch_row(sql, *values)


async def set_email_verified(user_id: int, verified: bool = True):
    sql = """
        UPDATE users
        SET email_verified = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
    """
    return await db.fetch_row(sql, bool(verified), user_id)

async def update_user(user_id: int, user_data: Dict[str, Any]):
    fields = []
    values = []
    param_count = 1

    # Mapping of frontend keys to DB columns
    mapping = {
        'name': 'name',
        'phone': 'phone',
        'gender': 'gender',
        'dob': 'dob',
        'age': 'age',
        'bloodGroup': 'blood_group',
        'image': 'image',
        'onboardingCompleted': 'onboarding_completed',
        'tutorialCompleted': 'tutorial_completed',
        'emergencyContactCompleted': 'emergency_contact_completed',
        'profileCompleted': 'profile_completed',
        'onboardingStep': 'onboarding_step',
    }

    for key, column in mapping.items():
        if key in user_data:
            fields.append(f"{column} = ${param_count}")
            values.append(user_data[key])
            param_count += 1

    # Special handling for address
    if 'address' in user_data:
        addr = user_data['address']
        if 'line1' in addr:
            fields.append(f"address_line1 = ${param_count}")
            values.append(addr['line1'])
            param_count += 1
        if 'line2' in addr:
            fields.append(f"address_line2 = ${param_count}")
            values.append(addr['line2'])
            param_count += 1

    # JSON fields
    if 'savedProfiles' in user_data:
        fields.append(f"saved_profiles = ${param_count}")
        values.append(json.dumps(user_data['savedProfiles']))
        param_count += 1

    if 'emergencyContacts' in user_data:
        fields.append(f"emergency_contacts = ${param_count}")
        values.append(json.dumps(user_data['emergencyContacts']))
        param_count += 1

    if not fields:
        return None

    fields.append(f"updated_at = CURRENT_TIMESTAMP")
    sql = f"UPDATE users SET {', '.join(fields)} WHERE id = ${param_count} RETURNING *"
    values.append(user_id)

    return await db.fetch_row(sql, *values)

async def update_user_password(user_id: int, hashed_password: str):
    sql = 'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *'
    return await db.fetch_row(sql, hashed_password, user_id)

async def set_reset_password_otp(email: str, otp: str, expiry: datetime):
    sql = """
        UPDATE users 
        SET reset_password_otp = $1, reset_password_otp_expiry = $2, updated_at = CURRENT_TIMESTAMP
        WHERE email = $3
        RETURNING *
    """
    return await db.fetch_row(sql, otp, expiry, email)

# --- Emergency Contacts ---

async def get_emergency_contacts(user_id: int):
    sql = 'SELECT * FROM emergency_contacts WHERE user_id = $1'
    return await db.query(sql, user_id)


async def get_emergency_contact_by_id(contact_id: int):
    sql = 'SELECT * FROM emergency_contacts WHERE id = $1 LIMIT 1'
    return await db.fetch_row(sql, contact_id)

async def add_emergency_contact(user_id: int, contact_data: Dict[str, Any]):
    contact_type = (
        contact_data.get('contact_type')
        or contact_data.get('type')
        or 'family'
    )
    name = contact_data.get('name')
    phone = contact_data.get('phone')
    relation = contact_data.get('relation')

    # Idempotent: a given user must not accumulate duplicate rows for the same
    # phone number (e.g. if a flaky network makes the client retry the save).
    # Update the existing record instead of inserting a second one.
    if phone:
        existing = await db.fetch_row(
            'SELECT * FROM emergency_contacts WHERE user_id = $1 AND phone = $2 LIMIT 1',
            user_id,
            phone,
        )
        if existing:
            update_sql = """
                UPDATE emergency_contacts SET
                    name = COALESCE($1, name),
                    relation = COALESCE($2, relation),
                    contact_type = COALESCE($3, contact_type)
                WHERE id = $4
                RETURNING *
            """
            return await db.fetch_row(update_sql, name, relation, contact_type, existing.get('id'))

    sql = """
        INSERT INTO emergency_contacts (user_id, name, phone, relation, contact_type)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    """
    values = (user_id, name, phone, relation, contact_type)
    return await db.fetch_row(sql, *values)

async def delete_emergency_contact(contact_id: int):
    sql = 'DELETE FROM emergency_contacts WHERE id = $1 RETURNING *'
    return await db.fetch_one(sql, contact_id)

async def update_emergency_contact(contact_id: int, contact_data: Dict[str, Any]):
    sql = """
        UPDATE emergency_contacts SET 
            name = COALESCE($1, name), 
            phone = COALESCE($2, phone), 
            relation = COALESCE($3, relation),
            contact_type = COALESCE($4, contact_type),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
        RETURNING *
    """
    values = (
        contact_data.get('name'), contact_data.get('phone'), contact_data.get('relation'),
        contact_data.get('contact_type'), contact_id
    )
    return await db.fetch_row(sql, *values)

# --- Saved Profiles ---

async def get_saved_profiles(user_id: int):
    sql = 'SELECT * FROM saved_profiles WHERE user_id = $1'
    return await db.query(sql, user_id)

async def add_saved_profile(user_id: int, profile_data: Dict[str, Any]):
    sql = """
        INSERT INTO saved_profiles (user_id, name, age, gender, relationship, phone, medical_history)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
    """
    values = (
        user_id, profile_data.get('name'), profile_data.get('age'), profile_data.get('gender'),
        profile_data.get('relationship'), profile_data.get('phone', ''),
        [str(item) for item in (profile_data.get('medicalHistory') or [])]
    )
    return await db.fetch_row(sql, *values)

async def update_saved_profile(user_id: int, profile_id: int, profile_data: Dict[str, Any]):
    return await db.fetch_row(
        """
        UPDATE saved_profiles
        SET name = $1, age = $2, gender = $3, relationship = $4,
            phone = $5, medical_history = $6
        WHERE id = $7 AND user_id = $8
        RETURNING *
        """,
        profile_data.get('name'),
        profile_data.get('age'),
        profile_data.get('gender'),
        profile_data.get('relationship'),
        profile_data.get('phone', ''),
        [str(item) for item in (profile_data.get('medicalHistory') or [])],
        profile_id,
        user_id,
    )


async def delete_saved_profile(user_id: int, profile_id: int):
    sql = 'DELETE FROM saved_profiles WHERE id = $1 AND user_id = $2 RETURNING *'
    return await db.fetch_row(sql, profile_id, user_id)


async def get_patients_by_hospital_id(hospital_id: int):
    """Fetch unique users who have booked appointments with any doctor from a specific hospital."""
    sql = """
        SELECT u.*
        FROM users u
        WHERE u.id IN (
            SELECT DISTINCT a.user_id
            FROM appointments a
            WHERE a.doctor_id IN (SELECT id FROM doctors WHERE hospital_id = $1)
            OR a.doctor_id IN (SELECT id FROM hospital_tieup_doctors WHERE hospital_tieup_id = $1)
        )
        ORDER BY u.name ASC
    """
    return await db.query(sql, hospital_id)
