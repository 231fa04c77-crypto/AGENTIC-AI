# MediChain Architecture Upgrade Plan

This document details the architecture and implementation plan to upgrade the **MEDCLUES** codebase to support the enterprise-grade **MediChain Hospital Management Architecture**.

---

## 1. Core Architecture Comparison & Alignments

| Feature Area | Current MEDCLUES State | MediChain Target State | Alignment Action |
| :--- | :--- | :--- | :--- |
| **Platform Hierarchy** | Strictly: `Super Admin` &rarr; `Dean` (Hospital Admin) &rarr; `Doctors` / `Receptionists`. | Flexible: `Platform Admin` &rarr; `Hospital` &rarr; `Hospital Admin` (Optional) &rarr; `Departments` (Optional) &rarr; `Doctors` & `Receptionists`. | Make Dean accounts optional. Introduce dynamic department layers and junction-based doctor mapping. |
| **Hospital Onboarding** | Standard SQL CRUD tables in Super Admin dashboard. | 5-step onboarding wizard. | Create a modular multi-step React wizard component in the Admin portal. |
| **Reception Panel** | Separate individual pages in sidebar for Walk-in, QR Check-in, Queue, etc. | Sidebar with **Dashboard**, **Today's Operations**, **Appointments**, **Patients**, **Billing**, **Reports**, **Settings**. | Consolidate front-desk operations into a single **Today's Operations** page containing tabbed Check-In and Queue tracking. |
| **Doctor Panel** | Basic queue management list + consultation and video rooms. | Tabbed Today's Queue with structured consultation cards, plus a **Patients** records search page. | Add a **Patients** history search tab to the doctor's sidebar to view historical logs without an active appointment. |
| **Scheduling System** | Static pre-generator (hardcoded slots, 5-day limit, static OP hours). | Dynamic multi-session weekly timings, leaves, date overrides, holidays, custom capacities, variable windows, and editing locks. | Build a dynamic DB-backed scheduling engine in the FastAPI backend and slot views. |
| **Departments** | Doctor belongs to one hospital via `hospital_id`. | Doctors support multiple departments (e.g. Diabetology + Cardiology) via a junction table. | Remove any single-department foreign key columns. Build a `doctor_departments` junction table. |
| **Permissions** | Role-based check (`dean`, `receptionist`, `doctor`). | Granular permission flags per receptionist (e.g. Check In, Billing, Refund, Reports). | Add a `permissions` array to receptionist accounts for custom runtime privilege guards. |
| **Audit Logs** | Under-utilized table in DB. | Global audit tracking for key coordinator actions (scheduling, check-ins, prescriptions, refunds, cancels). | Integrate audit-log middleware hooks across backend controller methods. |

---

## 2. Database Schema Upgrades (Phase 1)

All changes will be introduced in a safe, additive, and backward-compatible PostgreSQL migration script.

### New & Modified Tables Schema

```sql
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
    default_closed_days INTEGER[] DEFAULT '{0}'::INTEGER[], -- 0 = Sunday, 6 = Saturday
    holidays JSONB DEFAULT '[]'::jsonb, -- Array of {date: "YYYY-MM-DD", description: "Diwali"}
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Doctor Weekly Schedules (Supports multiple daily sessions/breaks)
CREATE TABLE IF NOT EXISTS doctor_weekly_schedules (
    id SERIAL PRIMARY KEY,
    doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sun, 1 = Mon...
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    mode VARCHAR(20) NOT NULL CHECK (mode IN ('OP', 'Video', 'Emergency', 'Home Visit')),
    slot_duration INTEGER NOT NULL DEFAULT 15 CHECK (slot_duration IN (5, 10, 15, 20, 30)),
    buffer_time INTEGER NOT NULL DEFAULT 2 CHECK (buffer_time IN (0, 2, 5, 10)),
    max_capacity INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Doctor Schedule Overrides (Specific dates with alternate timings)
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
    is_cancelled BOOLEAN DEFAULT FALSE, -- True if doctor decides not to operate on this date
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

-- 7. Add columns to Doctors Table
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS booking_window_days INTEGER DEFAULT 30 CHECK (booking_window_days IN (7, 15, 30, 60));
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS edit_lock_days INTEGER DEFAULT 2;

-- 8. Add Permissions to Receptionists
ALTER TABLE receptionists ADD COLUMN IF NOT EXISTS permissions VARCHAR(64)[] DEFAULT '{CHECK_IN, BILLING, RESCHEDULE}';
```

---

## 3. Implementation Workflow

### Phase 1: Database Migration & Core Models
Generate the migration script and define the ORM models to query these structures.

* #### [NEW] [024_medichain_core.sql](file:///c:/Users/Hanuman/.gemini/antigravity-ide/scratch/medclues/fastapi_back/migrations/024_medichain_core.sql)
  * The migration script containing tables for departments, dynamic scheduling, leaves, and permissions.
* #### [NEW] [department_model.py](file:///c:/Users/Hanuman/.gemini/antigravity-ide/scratch/medclues/fastapi_back/app/models/department_model.py)
  * Logic for managing departments and assigning doctors to multiple departments via junction.
* #### [NEW] [doctor_schedule_model.py](file:///c:/Users/Hanuman/.gemini/antigravity-ide/scratch/medclues/fastapi_back/app/models/doctor_schedule_model.py)
  * Data layer for weekly schedules, exceptions, leaves, overrides, and calendar settings.

---

### Phase 2: Dynamic Scheduling Engine (Backend Logic)
Upgrade the scheduling service to dynamically read weekly configurations and generate slots.

* #### [MODIFY] [doctor_slot_service.py](file:///c:/Users/Hanuman/.gemini/antigravity-ide/scratch/medclues/fastapi_back/app/services/doctor_slot_service.py)
  * **Dynamic Generation:** Loop through the doctor's chosen `booking_window_days` (e.g. 7, 15, 30, 60 days).
  * **Inheritance Rules:**
    1. Check if the date is closed in `hospital_working_calendars` (weekends, national holidays).
    2. Check if the doctor has an approved leave in `doctor_leaves` for that date.
    3. Check for specific day overrides in `doctor_schedule_overrides`.
    4. If none of the above block the date, pull the weekly timings from `doctor_weekly_schedules` to generate slots.
  * **Preservation Rule:** Differential generation. Delete ONLY `available` slots that mismatch new rules. Never touch `booked`, `completed`, or `cancelled` slots.
  * **Editing Lock:** Block any slot changes (deletions/timing updates) if the date is within the `edit_lock_days` (default 2 days), unless overridden by a Platform Admin.

---

### Phase 3: Reception Panel Upgrade (Frontend)
Streamline receptionist workflows into a single multi-tab layout under **Today's Operations**.

* #### [NEW] [TodaysOperations.jsx](file:///c:/Users/Hanuman/.gemini/antigravity-ide/scratch/medclues/admin/src/pages/Reception/TodaysOperations.jsx)
  * A single, focused workspace containing two main tabs:
    * **Check-In:** Handles patient search, scanning QR / Booking IDs, walk-in registration, digital/cash payments, and token generation.
    * **Today's Queue:** High-performance, real-time board tracking patients through **Waiting**, **Called**, **Completed**, and **Skipped** queues using Socket.IO.
* #### [MODIFY] [admin/App.jsx](file:///c:/Users/Hanuman/.gemini/antigravity-ide/scratch/medclues/admin/src/App.jsx)
  * Update receptionist navigation routes to mount the unified **Today's Operations** panel.
* #### [MODIFY] [receptionist_model.py](file:///c:/Users/Hanuman/.gemini/antigravity-ide/scratch/medclues/fastapi_back/app/models/receptionist_model.py)
  * Check receptionist array permissions before authorizing payment refunds or daily report exports.

---

### Phase 4: Doctor Portal Upgrades
Provide doctors with a patients record search tab and improve patient flow controls.

* #### [NEW] [PatientsSearch.jsx](file:///c:/Users/Hanuman/.gemini/antigravity-ide/scratch/medclues/admin/src/pages/Doctor/PatientsSearch.jsx)
  * A lookup page enabling doctors to search any patient record, pull up prescription archives, or download prior medical records without requiring a scheduled appointment today.
* #### [MODIFY] [DoctorDashboard.jsx](file:///c:/Users/Hanuman/.gemini/antigravity-ide/scratch/medclues/admin/src/pages/Doctor/DoctorDashboard.jsx)
  * Update sidebar to render the new `Patients` route.
  * Integrate the queue controller cards: **Call Next**, **Skip**, and **Complete Consultation**.

---

### Phase 5: Onboarding Wizard & Audit Log hooks
Create the step-by-step wizard in Super Admin, and implement logging checks on database edits.

* #### [NEW] [HospitalWizard.jsx](file:///c:/Users/Hanuman/.gemini/antigravity-ide/scratch/medclues/admin/src/pages/Admin/HospitalWizard.jsx)
  * Multi-step creation wizard for details, hospital type, self-managed vs. admin mapping, departments, and user seeds.
* #### [MODIFY] [audit_service.py](file:///c:/Users/Hanuman/.gemini/antigravity-ide/scratch/medclues/fastapi_back/app/services/audit_service.py)
  * Add hooks to write record events to `audit_logs` for:
    * Doctor editing schedule timings.
    * Reception checking in a patient.
    * Doctor completing a consultation / updating a prescription.
    * Platform admin issuing a manual refund.

---

## 4. Verification Plan

### Automated Database Tests
* Run safety migrations:
  ```bash
  cd fastapi_back
  python scripts/run_migrations.py
  ```
* Execute test suite (mocking different booking windows, overrides, and leave slots):
  ```bash
  python -m unittest tests/test_dynamic_slots.py
  ```

### Manual Quality Check
1. **Multiple Departments:** Assign a doctor to two departments (e.g. Cardiology and General Medicine) and verify that they list correctly under both categories in the booking app.
2. **Scheduling Window:** Set a doctor's window to `7 days`. Verify that the booking page only displays slots up to next week.
3. **Calendar Inheritance:** Set Sunday as closed in the Hospital Calendar. Verify no Sunday slots are generated. Add a leave entry for Wednesday, verify that slots on Wednesday disappear.
4. **Action Logging:** Run a check-in and edit a schedule, then query `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 5` to verify records exist.
