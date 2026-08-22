-- MediChain Core Architecture Upgrade
-- Migration: 024_medichain_core
-- Safe, additive-only migration. No existing columns or tables are dropped.

-- 1. Departments Table
CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    hospital_id INTEGER NOT NULL REFERENCES hospital_tieups(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Doctor-Department Junction Table (Supports multi-department doctors)
CREATE TABLE IF NOT EXISTS doctor_departments (
    doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    is_hod BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (doctor_id, department_id)
);

-- 3. Hospital Working Calendar (Global Holiday and Weekend defaults)
CREATE TABLE IF NOT EXISTS hospital_working_calendars (
    id SERIAL PRIMARY KEY,
    hospital_id INTEGER UNIQUE NOT NULL REFERENCES hospital_tieups(id) ON DELETE CASCADE,
    default_closed_days INTEGER[] DEFAULT '{0}'::INTEGER[],
    holidays JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Doctor Weekly Schedules (Supports multiple daily sessions/breaks per doctor)
CREATE TABLE IF NOT EXISTS doctor_weekly_schedules (
    id SERIAL PRIMARY KEY,
    doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    mode VARCHAR(20) NOT NULL CHECK (mode IN ('OP', 'Video', 'Emergency', 'Home Visit')),
    slot_duration INTEGER NOT NULL DEFAULT 15 CHECK (slot_duration IN (5, 10, 15, 20, 30)),
    buffer_time INTEGER NOT NULL DEFAULT 2 CHECK (buffer_time IN (0, 2, 5, 10)),
    max_capacity INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Doctor Schedule Overrides (Specific dates with alternate or cancelled timings)
CREATE TABLE IF NOT EXISTS doctor_schedule_overrides (
    id SERIAL PRIMARY KEY,
    doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    override_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    mode VARCHAR(20) CHECK (mode IN ('OP', 'Video', 'Emergency', 'Home Visit')),
    slot_duration INTEGER,
    buffer_time INTEGER,
    max_capacity INTEGER,
    is_cancelled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Doctor Leaves Table
CREATE TABLE IF NOT EXISTS doctor_leaves (
    id SERIAL PRIMARY KEY,
    doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    leave_type VARCHAR(32) NOT NULL CHECK (leave_type IN ('Casual Leave', 'Medical Leave', 'Conference', 'Vacation')),
    reason TEXT,
    status VARCHAR(20) DEFAULT 'approved',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT date_range_check CHECK (start_date <= end_date)
);

-- 7. Add scheduling config columns to Doctors Table (safe: defaults preserve existing rows)
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS booking_window_days INTEGER DEFAULT 30 CHECK (booking_window_days IN (7, 15, 30, 60));
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS edit_lock_days INTEGER DEFAULT 2;

-- 8. Add granular permissions to Receptionists (safe: defaults preserve existing rows)
ALTER TABLE receptionists ADD COLUMN IF NOT EXISTS permissions VARCHAR(64)[] DEFAULT '{CHECK_IN, BILLING, RESCHEDULE}';
