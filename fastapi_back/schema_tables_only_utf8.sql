--
-- STALE SNAPSHOT — NOT CANONICAL SCHEMA SOURCE OF TRUTH
-- Prefer fastapi_back/migrations/*.sql. Runtime ensure_* helpers are
-- transitional only. See docs/backend/DB_AUDIT_REPORT.md.
--
-- PostgreSQL database dump
--


-- Dumped from database version 18.4 (6e15e70)
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
--




--
-- Name: public; Type: SCHEMA; Schema: -; Owner: neondb_owner
--

-- *not* creating schema, since initdb creates it



--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: neondb_owner
--



SET default_tablespace = '';

SET default_table_access_method = heap;

--
--

    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "accountId" text NOT NULL,
    "providerId" text NOT NULL,
    "userId" uuid NOT NULL,
    "accessToken" text,
    "refreshToken" text,
    "idToken" text,
    "accessTokenExpiresAt" timestamp with time zone,
    "refreshTokenExpiresAt" timestamp with time zone,
    scope text,
    password text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);



--
--

    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "organizationId" uuid NOT NULL,
    email text NOT NULL,
    role text,
    status text NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "inviterId" uuid NOT NULL
);



--
--

    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "publicKey" text NOT NULL,
    "privateKey" text NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "expiresAt" timestamp with time zone
);



--
--

    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "organizationId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    role text NOT NULL,
    "createdAt" timestamp with time zone NOT NULL
);



--
--

    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    logo text,
    "createdAt" timestamp with time zone NOT NULL,
    metadata text
);



--
--

    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    endpoint_id text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    trusted_origins jsonb NOT NULL,
    social_providers jsonb NOT NULL,
    email_provider jsonb,
    email_and_password jsonb,
    allow_localhost boolean NOT NULL,
    plugin_configs jsonb,
    webhook_config jsonb
);



--
--

    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    token text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "ipAddress" text,
    "userAgent" text,
    "userId" uuid NOT NULL,
    "impersonatedBy" text,
    "activeOrganizationId" text
);



--
--

    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    "emailVerified" boolean NOT NULL,
    image text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    role text,
    banned boolean,
    "banReason" text,
    "banExpires" timestamp with time zone
);



--
--

    id uuid DEFAULT gen_random_uuid() NOT NULL,
    identifier text NOT NULL,
    value text NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);



--
-- Name: admins; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.admins (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: admins_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.admins_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- Name: admins_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.admins_id_seq OWNED BY public.admins.id;


--
-- Name: appointment_reminder_sent; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.appointment_reminder_sent (
    appointment_id integer NOT NULL,
    reminder_24h_sent_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: appointments; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.appointments (
    id integer NOT NULL,
    user_id integer NOT NULL,
    doctor_id integer NOT NULL,
    slot_date character varying(50) NOT NULL,
    slot_time character varying(50) NOT NULL,
    user_data jsonb,
    doctor_data jsonb,
    amount numeric(10,2) NOT NULL,
    consultation_fee numeric(10,2) DEFAULT 0,
    platform_fee numeric(10,2) DEFAULT 0,
    gst numeric(10,2) DEFAULT 0,
    cost_breakdown jsonb,
    date bigint,
    cancelled boolean DEFAULT false,
    payment boolean DEFAULT false,
    payment_status character varying(20) DEFAULT 'pending'::character varying,
    transaction_id character varying(255),
    upi_transaction_id character varying(255),
    payer_vpa character varying(255),
    payment_timestamp timestamp without time zone,
    payment_method character varying(50) DEFAULT 'payOnVisit'::character varying,
    is_completed boolean DEFAULT false,
    token_number integer,
    queue_position integer,
    estimated_wait_time integer DEFAULT 0,
    actual_start_time bigint,
    actual_end_time bigint,
    consultation_duration integer,
    status character varying(20) DEFAULT 'pending'::character varying,
    is_delayed boolean DEFAULT false,
    delay_reason text DEFAULT ''::text,
    alerted boolean DEFAULT false,
    selected_symptoms text[],
    actual_patient_name character varying(255),
    actual_patient_age character varying(10),
    actual_patient_gender character varying(50),
    actual_patient_relationship character varying(100),
    actual_patient_medical_history text[],
    actual_patient_symptoms text,
    actual_patient_phone character varying(20),
    actual_patient_is_self boolean DEFAULT true,
    recent_prescription text,
    mode character varying(20) DEFAULT 'In-person'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    session character varying,
    call_started_at timestamp without time zone,
    call_ended_at timestamp without time zone,
    call_duration integer,
    channel_name character varying(255),
    doctor_joined_at timestamp without time zone,
    booking_id character varying(12),
    slot_id integer,
    CONSTRAINT appointments_mode_check CHECK (((mode)::text = ANY (ARRAY[('In-person'::character varying)::text, ('Video'::character varying)::text]))),
    CONSTRAINT appointments_payment_status_check CHECK (((payment_status)::text = ANY (ARRAY[('pending'::character varying)::text, ('paid'::character varying)::text, ('failed'::character varying)::text, ('refunded'::character varying)::text]))),
    CONSTRAINT appointments_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('in-queue'::character varying)::text, ('in-consult'::character varying)::text, ('completed'::character varying)::text, ('no-show'::character varying)::text, ('cancelled'::character varying)::text])))
);



--
-- Name: appointments_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.appointments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- Name: appointments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.appointments_id_seq OWNED BY public.appointments.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.audit_logs (
    id bigint NOT NULL,
    actor_id bigint,
    actor_role character varying(32),
    action character varying(64) NOT NULL,
    resource character varying(128) NOT NULL,
    resource_id character varying(64),
    ip_address character varying(45),
    user_agent text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: blood_banks; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.blood_banks (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    location character varying(255) NOT NULL,
    city character varying(100) NOT NULL,
    latitude numeric(10,8),
    longitude numeric(11,8),
    partner_type character varying(50) DEFAULT 'normal'::character varying,
    available_blood jsonb DEFAULT '{"A+": "Available", "A-": "Available", "B+": "Available", "B-": "Available", "O+": "Available", "O-": "Available", "AB+": "Available", "AB-": "Available"}'::jsonb,
    image character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: blood_banks_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.blood_banks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- Name: blood_banks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.blood_banks_id_seq OWNED BY public.blood_banks.id;


--
-- Name: call_sessions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.call_sessions (
    id integer NOT NULL,
    appointment_id integer NOT NULL,
    consultation_id integer,
    patient_user_id integer NOT NULL,
    doctor_id integer NOT NULL,
    status character varying(24) DEFAULT 'requested'::character varying NOT NULL,
    requested_at timestamp with time zone DEFAULT now(),
    accepted_at timestamp with time zone,
    rejected_at timestamp with time zone,
    ended_at timestamp with time zone,
    reject_reason character varying(64),
    agora_channel character varying(128),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);



--
-- Name: call_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.call_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- Name: call_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.call_sessions_id_seq OWNED BY public.call_sessions.id;


--
-- Name: consultations; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.consultations (
    id integer NOT NULL,
    appointment_id integer,
    doctor_id integer,
    user_id integer,
    notes text,
    prescription text,
    follow_up_date date,
    status character varying(20) DEFAULT 'scheduled'::character varying,
    type character varying(20) DEFAULT 'video'::character varying,
    meeting_link text,
    meeting_id character varying(255),
    meeting_provider character varying(50) DEFAULT 'google-meet'::character varying,
    scheduled_at timestamp without time zone,
    started_at timestamp without time zone,
    ended_at timestamp without time zone,
    duration integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT consultations_status_check CHECK (((status)::text = ANY (ARRAY[('scheduled'::character varying)::text, ('ongoing'::character varying)::text, ('completed'::character varying)::text, ('cancelled'::character varying)::text]))),
    CONSTRAINT consultations_type_check CHECK (((type)::text = ANY (ARRAY[('video'::character varying)::text, ('audio'::character varying)::text, ('chat'::character varying)::text])))
);



--
-- Name: consultations_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.consultations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- Name: consultations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.consultations_id_seq OWNED BY public.consultations.id;


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.conversations (
    id integer NOT NULL,
    user_id integer,
    doctor_id integer,
    messages jsonb DEFAULT '[]'::jsonb,
    last_message text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: conversations_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.conversations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- Name: conversations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.conversations_id_seq OWNED BY public.conversations.id;


--
-- Name: deans; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.deans (
    id integer NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    hospital_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);



--
-- Name: deans_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.deans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- Name: deans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.deans_id_seq OWNED BY public.deans.id;


--
-- Name: doctor_slots; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.doctor_slots (
    id integer NOT NULL,
    slot_code character varying(40),
    doctor_ref character varying(32) NOT NULL,
    doctor_numeric_id integer NOT NULL,
    slot_date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    mode character varying(16) NOT NULL,
    slot_type character varying(24) NOT NULL,
    status character varying(16) DEFAULT 'available'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT doctor_slots_mode_check CHECK (((mode)::text = ANY ((ARRAY['offline'::character varying, 'online'::character varying])::text[]))),
    CONSTRAINT doctor_slots_status_check CHECK (((status)::text = ANY ((ARRAY['available'::character varying, 'booked'::character varying, 'cancelled'::character varying, 'completed'::character varying])::text[])))
);



--
-- Name: doctor_slots_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.doctor_slots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- Name: doctor_slots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.doctor_slots_id_seq OWNED BY public.doctor_slots.id;


--
-- Name: doctors; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.doctors (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    image text,
    speciality character varying(100) NOT NULL,
    degree character varying(255) NOT NULL,
    experience character varying(50) NOT NULL,
    about text NOT NULL,
    fees numeric(10,2) NOT NULL,
    address_line1 character varying(255),
    address_line2 character varying(255),
    available boolean DEFAULT true,
    slots_booked jsonb DEFAULT '{}'::jsonb,
    date bigint NOT NULL,
    status character varying(20) DEFAULT 'in-clinic'::character varying,
    current_appointment_id integer,
    average_consultation_time integer DEFAULT 15,
    break_start_time bigint,
    break_duration integer DEFAULT 15,
    video_consult boolean DEFAULT false,
    location_lat numeric(10,8),
    location_lng numeric(11,8),
    hospital character varying(255) DEFAULT ''::character varying,
    hospital_id integer,
    reset_password_otp character varying(10),
    reset_password_otp_expiry timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    rating real,
    reviews integer DEFAULT 0,
    video_consultation_fee numeric(10,2) DEFAULT 450,
    followup_video_fee numeric(10,2) DEFAULT 250,
    CONSTRAINT doctors_status_check CHECK (((status)::text = ANY (ARRAY['available'::text, 'Available'::text, 'busy'::text, 'Busy'::text, 'emergency'::text, 'Emergency'::text, 'unavailable'::text, 'Unavailable'::text, 'in-clinic'::text, 'in-consult'::text, 'on-break'::text, 'online'::text, 'Inactive'::text, 'active'::text, 'Active'::text, 'In-clinic'::text, 'In-consult'::text])))
);



--
-- Name: doctors_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.doctors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- Name: doctors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.doctors_id_seq OWNED BY public.doctors.id;


--
-- Name: emergency_contacts; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.emergency_contacts (
    id integer NOT NULL,
    user_id integer,
    name character varying(255) NOT NULL,
    phone character varying(20) NOT NULL,
    relation character varying(100) NOT NULL,
    contact_type character varying(20),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT emergency_contacts_contact_type_check CHECK (((contact_type)::text = ANY (ARRAY[('friend'::character varying)::text, ('family'::character varying)::text])))
);



--
-- Name: emergency_contacts_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.emergency_contacts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- Name: emergency_contacts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.emergency_contacts_id_seq OWNED BY public.emergency_contacts.id;


--
-- Name: emergency_events; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.emergency_events (
    id bigint NOT NULL,
    user_id integer,
    event_type character varying(64) NOT NULL,
    severity character varying(32),
    latitude double precision,
    longitude double precision,
    location_text text,
    symptoms jsonb DEFAULT '[]'::jsonb NOT NULL,
    recipient_phone character varying(20),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    source character varying(32),
    ip_address character varying(45),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: emergency_events_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.emergency_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- Name: emergency_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.emergency_events_id_seq OWNED BY public.emergency_events.id;


--
-- Name: health_records; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.health_records (
    id integer NOT NULL,
    user_id integer,
    doctor_id integer,
    appointment_id integer,
    diagnosis text,
    prescription text,
    notes text,
    attachments text,
    record_type character varying(50) DEFAULT 'general'::character varying,
    title character varying(255),
    description text,
    doctor_name character varying(255),
    record_date timestamp without time zone,
    tags text,
    is_important boolean DEFAULT false,
    uploaded_before_appointment boolean DEFAULT false,
    viewed_by_doctor boolean DEFAULT false,
    viewed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: health_records_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.health_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- Name: health_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.health_records_id_seq OWNED BY public.health_records.id;


--
-- Name: hospital_tieup_doctors; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.hospital_tieup_doctors (
    id integer NOT NULL,
    hospital_tieup_id integer,
    name character varying(255) NOT NULL,
    qualification character varying(255),
    specialization character varying(255),
    experience character varying NOT NULL,
    image text DEFAULT ''::text,
    available boolean DEFAULT true,
    show_on_hospital_page boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    about text,
    fees integer DEFAULT 50,
    email character varying,
    slots_booked jsonb DEFAULT '{}'::jsonb,
    rating real,
    reviews integer DEFAULT 0
);



--
-- Name: hospital_tieup_doctors_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.hospital_tieup_doctors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- Name: hospital_tieup_doctors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.hospital_tieup_doctors_id_seq OWNED BY public.hospital_tieup_doctors.id;


--
-- Name: hospital_tieups; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.hospital_tieups (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    address text NOT NULL,
    contact character varying(20) NOT NULL,
    specialization character varying(255) NOT NULL,
    type character varying(100) DEFAULT 'General'::character varying,
    show_on_home boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    latitude double precision,
    longitude double precision
);



--
-- Name: hospital_tieups_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.hospital_tieups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- Name: hospital_tieups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.hospital_tieups_id_seq OWNED BY public.hospital_tieups.id;


--
-- Name: hospitals; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.hospitals (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    image text,
    address_line1 character varying(255),
    address_line2 character varying(255),
    speciality text[],
    about text,
    available boolean DEFAULT true,
    date bigint,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    latitude double precision,
    longitude double precision
);



--
-- Name: hospitals_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.hospitals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- Name: hospitals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.hospitals_id_seq OWNED BY public.hospitals.id;


--
-- Name: job_applications; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.job_applications (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(20) NOT NULL,
    "position" character varying(255) NOT NULL,
    resume_url text,
    cover_letter text,
    city character varying(100),
    qualification character varying(255),
    experience character varying(50),
    skills text,
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT job_applications_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'interview'::character varying, 'rejected'::character varying, 'approved'::character varying])::text[])))
);



--
-- Name: job_applications_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.job_applications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- Name: job_applications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.job_applications_id_seq OWNED BY public.job_applications.id;


--
-- Name: lab_bookings; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.lab_bookings (
    id integer NOT NULL,
    user_id integer,
    lab_id integer,
    lab_name character varying(255) NOT NULL,
    full_name character varying(255) NOT NULL,
    test_name character varying(255) NOT NULL,
    dob character varying(50) NOT NULL,
    phone character varying(20) NOT NULL,
    email character varying(255) NOT NULL,
    preferred_date character varying(50) NOT NULL,
    notes text,
    payment boolean DEFAULT false,
    cancelled boolean DEFAULT false,
    status character varying(50) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: lab_bookings_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.lab_bookings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- Name: lab_bookings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.lab_bookings_id_seq OWNED BY public.lab_bookings.id;


--
-- Name: labs; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.labs (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    location character varying(255) NOT NULL,
    city character varying(100) NOT NULL,
    latitude numeric(10,8),
    longitude numeric(11,8),
    rating numeric(2,1) DEFAULT 0,
    verified boolean DEFAULT false,
    services jsonb DEFAULT '[]'::jsonb,
    open_now boolean DEFAULT true,
    partner_type character varying(50) DEFAULT 'normal'::character varying,
    image character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: labs_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.labs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- Name: labs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.labs_id_seq OWNED BY public.labs.id;


--
-- Name: medical_knowledge; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.medical_knowledge (
    id integer NOT NULL,
    symptom character varying(255) NOT NULL,
    conditions jsonb DEFAULT '[]'::jsonb,
    severity character varying(50),
    otc_medicines jsonb DEFAULT '[]'::jsonb,
    precautions jsonb DEFAULT '[]'::jsonb,
    when_to_see_doctor text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: medical_knowledge_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.medical_knowledge_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- Name: medical_knowledge_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.medical_knowledge_id_seq OWNED BY public.medical_knowledge.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id integer,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    type character varying(50) DEFAULT 'general'::character varying,
    is_read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: payment_transactions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.payment_transactions (
    id bigint NOT NULL,
    external_id uuid DEFAULT gen_random_uuid() NOT NULL,
    razorpay_order_id character varying(64) NOT NULL,
    razorpay_payment_id character varying(64),
    checkout_token character varying(64),
    user_id integer,
    doctor_id character varying(64),
    appointment_id character varying(64),
    status character varying(32) DEFAULT 'pending'::character varying NOT NULL,
    amount_paise integer NOT NULL,
    currency character varying(8) DEFAULT 'INR'::character varying NOT NULL,
    doctor_name text,
    customer_name text,
    customer_email text,
    customer_phone text,
    booking_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    paid_at timestamp with time zone,
    CONSTRAINT payment_transactions_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'paid'::character varying, 'failed'::character varying])::text[])))
);



--
-- Name: payment_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.payment_transactions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- Name: payment_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.payment_transactions_id_seq OWNED BY public.payment_transactions.id;


--
-- Name: queue_settings; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.queue_settings (
    id integer NOT NULL,
    doctor_id integer,
    is_active boolean DEFAULT true,
    avg_consultation_time integer DEFAULT 15,
    max_queue_length integer DEFAULT 20,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: queue_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.queue_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- Name: queue_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.queue_settings_id_seq OWNED BY public.queue_settings.id;


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.refresh_tokens (
    id bigint NOT NULL,
    user_id character varying(128) NOT NULL,
    role character varying(32) NOT NULL,
    token_hash character varying(128) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    device_info text,
    ip_address character varying(45),
    CONSTRAINT refresh_tokens_role_check CHECK (((role)::text = ANY ((ARRAY['patient'::character varying, 'doctor'::character varying, 'dean'::character varying, 'admin'::character varying])::text[])))
);



--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.refresh_tokens_id_seq OWNED BY public.refresh_tokens.id;


--
-- Name: saved_profiles; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.saved_profiles (
    id integer NOT NULL,
    user_id integer,
    name character varying(255) NOT NULL,
    age character varying(10) NOT NULL,
    gender character varying(50) NOT NULL,
    relationship character varying(100) NOT NULL,
    phone character varying(20) DEFAULT ''::character varying,
    medical_history text[],
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: saved_profiles_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.saved_profiles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- Name: saved_profiles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.saved_profiles_id_seq OWNED BY public.saved_profiles.id;


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.schema_migrations (
    id integer NOT NULL,
    version character varying(64) NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: schema_migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.schema_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- Name: schema_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.schema_migrations_id_seq OWNED BY public.schema_migrations.id;


--
-- Name: specialties; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.specialties (
    id integer NOT NULL,
    specialty_name character varying(255) NOT NULL,
    helpline_number character varying(20),
    availability character varying(20) DEFAULT '24x7'::character varying,
    status character varying(20) DEFAULT 'Active'::character varying,
    last_updated timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_by character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: specialties_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.specialties_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- Name: specialties_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.specialties_id_seq OWNED BY public.specialties.id;


--
-- Name: super_appointments; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.super_appointments (
    id integer NOT NULL,
    user_name text NOT NULL,
    email text NOT NULL,
    appointment_date date NOT NULL,
    appointment_time time without time zone NOT NULL,
    service_type text NOT NULL,
    status text DEFAULT 'Pending'::text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: super_appointments_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.super_appointments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- Name: super_appointments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.super_appointments_id_seq OWNED BY public.super_appointments.id;


--
-- Name: telegram_link_codes; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.telegram_link_codes (
    code text NOT NULL,
    user_id integer NOT NULL,
    expires_at timestamp with time zone NOT NULL
);



--
-- Name: telegram_user_links; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.telegram_user_links (
    chat_id bigint NOT NULL,
    user_id integer NOT NULL,
    telegram_username text,
    linked_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: user_fcm_tokens; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.user_fcm_tokens (
    id integer NOT NULL,
    user_id integer NOT NULL,
    fcm_token text NOT NULL,
    platform character varying(16) DEFAULT 'android'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);



--
-- Name: user_fcm_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.user_fcm_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- Name: user_fcm_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.user_fcm_tokens_id_seq OWNED BY public.user_fcm_tokens.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    image text DEFAULT 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAPAAAADwCAYAAAA+VemSAAAACXBIWXMAABCcAAAQnAEmzTo0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAA5uSURBVHgB7d0JchvHFcbxN+C+iaQolmzFsaWqHMA5QXID+wZJTmDnBLZu4BvER4hvYJ/AvoHlimPZRUngvoAg4PkwGJOiuGCd6df9/1UhoJZYJIBvXndPL5ndofljd8NW7bP8y79bZk+tmz8ATFdmu3nWfuiYfdNo2383389e3P5Xb9B82X1qs/YfU3AB1Cuzr+3cnt8U5Mb132i+7n5mc/a9EV4gDF37Z15Qv3/9a/fz63/0VgXOw/uFdexLAxCqLze3s+flL/4IcK/yduwrAxC0zoX9e+u9rJfVXoB7fV41m7u2YQBCt2tt+6v6xEUfeM6+ILyAGxv9QWbL+iPOPxoAX2Zts9GZtU8NgDudln3eyNvQnxgAd/Lw/k194I8NgD+ZPc2aO92uAXCpYQDcIsCAYwQYcIwAA44RYMAxAgw4RoABxwgw4BgBBhwjwIBjBBhwjAADjhFgwDECDDhGgAHHCDDgGAEGHCPAgGMEGHCMAAOOEWDAMQIMOEaAAccIMOAYAQYcI8CAYwQYcIwAA44RYMAxAgw4RoABxwgw4BgBBhwjwIBjBBhwjAADjhFgwDECDDhGgAHHCDDgGAEGHCPAgGMEGHCMAAOOEWDAMQIMOEaAAccIMOAYAQYcI8CAYwQYcIwAA44RYMAxAgw4RoABxwgw4BgBBhwjwIBjBBhwjAADjhFgwDECDDhGgAHHCDDgGAEGHCPAgGOzBlfanfzRNrvo5o8Ls46eO8VDut3i966babz7rMfcjFmWP8/rOTM4Q4ADpjCenZu18sCe52FtX9wczkGUAS+fb6IwK9Tzc/kHI/96gU9H8HiLAnOWh/WsZXZ6fnfYpkEXCT30b0sjr8jz+SdkYb4I8gwdruAQ4AAotCdnRbUdtcJOg74XhbkMtCr08iJhDgkBrkmv0uWV9vgsrNDeRd/z3lHxtSrz0kIe6HlDjQhwxVRtD0+Kfq1n+v5b/Z9lKQ/x8gJVuQ5Zc6fr5PrvWyzBvYuCvLZEkKtEBZ6yFIJbOmkVD4JcHQI8JSkF9zqFWANyalYryJoeAjxh6pAc5ME9OrOkaWDu8LQI8+oSg13TQoAnSKPKe8d+RpWroHvZGrlundOsngYCPAGqurtHl/dL8S5VYnUnqMaTRYDHpL6uKkzVs6Y8Kqux5nKrGjP3enwEeAwHp8VAFYaj8QG1VrbWaFKPi5dvBGoyvz4gvONQNX61X4wbYHQEeEj64O3sp3l7aNI02Nc8KkbtMRqa0EPQXODmIf3dSdPtJrVqHiwbhkQFHpDC++aA8E6L+sW7R4YhUYEHcNy6XIWD6dGtJm1aoMEtRqgHQwW+B+Gtllo6GiBkic1gCPAdrq5/RXX0utOcHgwBvkXZ50U9dJ+YEN+PAN9AA1UabWZOc73UJ+YW090I8DXlJA1Gm8OgW0xHp4ZbEOBrdpnXHJz9RNdVD4IAX6G5zawoChMX1psR4L5yBw2ESeFlUOtdBNgul7khbGpG0x9+GwG2YqST5pkP6g9rthYKyQdYG6ufsKTNFZrSl5IOsKruIU0ydzTJhvvDhaQDTNPZL7WceO8SDrDefJrOfnW6NKUl2eWEmioZi0b/TN/FhfwN7Z8c2Ji5/PPz/qmHZ6f9s4Yjudddns80n/Ci2CR/dDW/zp2PZCq0G+tmaytFcBtDtKUU4OO8+7C3n9+Wcd6XVDdI64dTlWSAPQ9cKahbm2YPN4YL7VVzebVe1+NBEeadN0WYPUq9Cid3OqGqr05P8OhhHtzth6MH9y4KsILssXmt8KZahZMbxPJafR9v549H0wmvqBp/9KeiOntTVuEUJRVgzXf2eOtB4VWTedoU3mcf+gxxqveFkwqwx8UKj7aqCW9JI9iqxA1nn4xUq3AyAVbl9fYGqxKqz1vHv/vkPXMnxYUOyQTYYxPryWOrjW5PrTg7nFsX6NR2s0wmwN6q7/JS8aiTmu+eaLLKcWIHqycRYI+DVxsPrHa6gHjrC6e2o0oSAfZYhTceWO10AXG3o0oSAT5xeFVeDuScoBAuJMNoOb3TMKo0KrCzq/LCQj6QFMjMolAuJMNI6cjS6AOs5rO3/Z1Dmha4OG/upNSMjj/ADq/GqsCh0C0lj/eEUxmNjj7AHm/uhzYTambG3EllrXfUAdZghsdlgzNsNTi2VDa+i/qjcs5u/hPhcaleKtMqow6w1zcxtNsgHl9HtbxS6AfHXYGdNqM6gX3fF05fR++7rgwi6gB77QeF1PRXa6DjdGJECl2oaAOsq6/X831D2hXjzPHcYiqwY54P5z4OaOXUqeMleimMREcbYM9vnpqtoYT40PHeyynMiY42wF4HXkpHAWy8p6a8521n1QqLfSQ63gA7v/o2d6123veMFs9dqUHQBw5U70DrmvdqfvXG3Iu9GR1tgGNoOtUZIF08YjiCJfaBLCpwwBSgN02rnO77xlB9U0AFDpyCVPWEhJ3X8RyAxiCWU7EMXqgP9/Mv1c2GUsV/E8AA2qQwiIXanZ6Z/bpjU6d/57dXBkcSPlnVl/L0wGntFa2JI//7xeAMAXZEIdbc5A+eTHbTOzWbqbw+0YR2Rs3cn36ezD1iDVTpv0V4/Yq2Amtbmlhv4it4L38rRqgfPRx+72YNiL3uD1Z5XSo4qNi3J6IJ7djVIOsUhbXVYvub67taKqT6u4fHxeKEkFY7YTzRBriR5RXY0qBw7p1fDnRJubOlFnXEXmXvMutwR81hRN2ETmFB921imYiBu0XbQ8gyA6LvA0f947G3MoQAO0WAMRd5/1ei/ZiHcrof6pNCNyrqQayUXD1P6aaTFMrN2VMalU6hAkd9GymmyRwKqI76nMsfC/PFgWOLC8XPOMrpgVqiqJHq3vlRrWLE/uw0jm10SguBHRI3DVE3NFWJvJ5Sp8BqYoYmaKwsTf6IT3Ux/uhmrLz9Z5queXxcTPg4cLwrZQqtsKgDPOcswArp1qbZ+oN6+/Cq7Ho83Cx+rRDv7fkKs1pgsU/ikOgrsAeqsttbxXOI1laKR2+LHwX5MPyJIimEV+KuwDPFlTjUXRlU5R5vhxvc69Ssf/wor8zrRZDr2K9rUIsJ9H8l+pstuhKHeDymKq5WEnl0Ncg//T/MapzCAJZE383XyG1I9OF/9qHf8F6ln+UvTy/7yqHQ4FUqTejoA7wUUID1gf/og6LpHBNVY7UoQuFl7GMSog+w+sAhvKFleGOdIaYWRSghDumiPW1JzFeaD6A/FHN4Swrx+pC7g0yams+p9H8liQCv1NxkfbSVztxsjarP1RiglJrPkkSA62xG68O8HcGA1aBUAev8eZcjG1+4TzJT/lcWrRYphbfUm0lWQxXWxYMKHCm9sY2Kl5fpA1V3n7AuG2tWuTUnE2ImKZkAK7zLFVdhLzOspqHqC1eK1VeSWjWrwawqq3DKAVYTulHhp0vhTXEXlqR+5KqrcOynw9+l6k0DUmw+S3LXrCqrsDZc11m7qSmPbKkqxJq4keoeaMn1GsoqfFjRzhMKsdbR/vlJ/PeC6zqyJdXqK1lzJ/YzzN+l5YU7e9UvM1SfWIM7G5GNTNd51pJaVA+WLVlJBlgOTqurwtdpgKc8y2ga2+VUQcec7h8W2+7UddaSms1ba2lvIZxsgFV9X+2HMdCk1Uk6kEyb1S0tFr8OKdTaAE/7ZLVaZicnxcZ3IexsubGS1sKFmyS7e7L6wvoAvD6w2ikcelylACvIWogxO1v8er4/WNPbiXJm/D61QqgLWOeieG6dF9vOti/6O1W2i98LcRtavQaph1eS3v5c9w619cppgDtKKDTDNE8HnboYy77QWzXM9ApR8ucXrOdVuFXDgNakpXQa4dryR+eUkn8Z1JReXzE4oeCuJnzb6DquY1Y0o+teM4z76WJL0/ltBLhPV3WaZWHjPXoXL0dfeXWveskhBqMWEq2kdxHgK3R1T3lWT6i0QT/vy80I8DW6t5jy3NrQ6KK6uWq4BQG+weoizbUQlN0a+r2346W5hZpszPSpj8L7kPDei5fnDppqmcIp7yFa57UfCAG+h6oAH6Rq6cKZyumC4yLA9yibcnygpk+vtQas6LoMjgAPgA/W9HGhHA0BHoKadtximjwNVD16QFdlFMmvRhqWbjFlebXYPzZMgEKr1g2jzaMhwCPQPWKtJW4epr117Lj0OqpFkzF9dWRc90akyqFJBimeBjAu9Xd1n10PwjseAjyGclM1+sWD04VP/V1muk0G9WMC1C/WCLX216JJfTtd6FZrOiUyVsnuSjkth6dmBzVtsxoqhSgGh1tMB50vbTak1qxXeFWtaS5PDwGeAvWNe9MB54vbTak1qxXclf6KLgapposAT5FmFS2uF5VYFTn2IBPc6hHgCqhJrYeCfKwTDtoWFYJbHwJcoTLICrCC7L2PrEEpdRMIbn0IcA00KquHbquUYfZSlVVtdRFScJnEUj/eghqV5/voof6xjng5bYUX5quhVdWl2oaD+8AB0jty1i7C3Dto7MIqpcD2WglzRWCptOHirQmQKlxvBLu/NlaBPu8HuXdaYLcI9iTOc1IrQCEtnxVaVgb5QQV2TO9cu1M8K8xdHRVqN58+ONsPZVYeT5oR1BhQgR1TpWZ6Ytq4BgOOEWDAMQIMOEaAAccIMOAYAQYcI8CAYwQYcIwAA44RYMAxAgw4RoABxwgw4BgBBhwjwIBjBBhwjAADjhFgwDECDDhGgAHHCDDgGAEGHCPAgGMEGHCMAAOOEWDAMQIMOEaAAccIMOAYAQYcI8CAYwQYcIwAA44RYMAxAgw4RoABxwgw4BgBBhwjwIBjBBhwjAADjhFgwDECDDjWsMxeGACPdhvWJcCAUz80OmbfGQB3Ohf2TdZsdjesbU0D4EvbnjU2N7Pd/MtvDYAfmX29+X72ohiFbtu/8v/dNQAe7Nq5PdcXvQAryfnTcwPgwfN+Zi/vA29uZ18ZIQbC1snDW2S1J7v+582d7uf50xf5Y8MAhEJd3LfCK9lNf7P5svu0M2NfNjL7hwGo27capyqbzVdld/2/FGSbtU/zLz/JHx8bVRmYPs2OLCZYfWeH9tXms+zWAebfASz7TK2tFnyYAAAAAElFTkSuQmCC'::text,
    phone character varying(20) DEFAULT '000000000'::character varying,
    address_line1 character varying(255) DEFAULT ''::character varying,
    address_line2 character varying(255) DEFAULT ''::character varying,
    gender character varying(50) DEFAULT 'Not Selected'::character varying,
    dob character varying(50) DEFAULT 'Not Selected'::character varying,
    age integer,
    blood_group character varying(10) DEFAULT ''::character varying,
    role character varying(20) DEFAULT 'patient'::character varying,
    password character varying(255) NOT NULL,
    reset_password_otp text,
    reset_password_otp_expiry timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    telegram_chat_id bigint,
    onboarding_completed boolean DEFAULT false,
    tutorial_completed boolean DEFAULT false,
    emergency_contact_completed boolean DEFAULT false,
    profile_completed boolean DEFAULT false,
    onboarding_step integer DEFAULT 0,
    CONSTRAINT users_role_check CHECK (((role)::text = ANY (ARRAY[('patient'::character varying)::text, ('doctor'::character varying)::text, ('admin'::character varying)::text])))
);



--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: admins id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.admins ALTER COLUMN id SET DEFAULT nextval('public.admins_id_seq'::regclass);


--
-- Name: appointments id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.appointments ALTER COLUMN id SET DEFAULT nextval('public.appointments_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: blood_banks id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.blood_banks ALTER COLUMN id SET DEFAULT nextval('public.blood_banks_id_seq'::regclass);


--
-- Name: call_sessions id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.call_sessions ALTER COLUMN id SET DEFAULT nextval('public.call_sessions_id_seq'::regclass);


--
-- Name: consultations id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.consultations ALTER COLUMN id SET DEFAULT nextval('public.consultations_id_seq'::regclass);


--
-- Name: conversations id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.conversations ALTER COLUMN id SET DEFAULT nextval('public.conversations_id_seq'::regclass);


--
-- Name: deans id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.deans ALTER COLUMN id SET DEFAULT nextval('public.deans_id_seq'::regclass);


--
-- Name: doctor_slots id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.doctor_slots ALTER COLUMN id SET DEFAULT nextval('public.doctor_slots_id_seq'::regclass);


--
-- Name: doctors id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.doctors ALTER COLUMN id SET DEFAULT nextval('public.doctors_id_seq'::regclass);


--
-- Name: emergency_contacts id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.emergency_contacts ALTER COLUMN id SET DEFAULT nextval('public.emergency_contacts_id_seq'::regclass);


--
-- Name: emergency_events id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.emergency_events ALTER COLUMN id SET DEFAULT nextval('public.emergency_events_id_seq'::regclass);


--
-- Name: health_records id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.health_records ALTER COLUMN id SET DEFAULT nextval('public.health_records_id_seq'::regclass);


--
-- Name: hospital_tieup_doctors id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.hospital_tieup_doctors ALTER COLUMN id SET DEFAULT nextval('public.hospital_tieup_doctors_id_seq'::regclass);


--
-- Name: hospital_tieups id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.hospital_tieups ALTER COLUMN id SET DEFAULT nextval('public.hospital_tieups_id_seq'::regclass);


--
-- Name: hospitals id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.hospitals ALTER COLUMN id SET DEFAULT nextval('public.hospitals_id_seq'::regclass);


--
-- Name: job_applications id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.job_applications ALTER COLUMN id SET DEFAULT nextval('public.job_applications_id_seq'::regclass);


--
-- Name: lab_bookings id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.lab_bookings ALTER COLUMN id SET DEFAULT nextval('public.lab_bookings_id_seq'::regclass);


--
-- Name: labs id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.labs ALTER COLUMN id SET DEFAULT nextval('public.labs_id_seq'::regclass);


--
-- Name: medical_knowledge id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.medical_knowledge ALTER COLUMN id SET DEFAULT nextval('public.medical_knowledge_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: payment_transactions id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payment_transactions ALTER COLUMN id SET DEFAULT nextval('public.payment_transactions_id_seq'::regclass);


--
-- Name: queue_settings id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.queue_settings ALTER COLUMN id SET DEFAULT nextval('public.queue_settings_id_seq'::regclass);


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('public.refresh_tokens_id_seq'::regclass);


--
-- Name: saved_profiles id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.saved_profiles ALTER COLUMN id SET DEFAULT nextval('public.saved_profiles_id_seq'::regclass);


--
-- Name: schema_migrations id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.schema_migrations ALTER COLUMN id SET DEFAULT nextval('public.schema_migrations_id_seq'::regclass);


--
-- Name: specialties id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.specialties ALTER COLUMN id SET DEFAULT nextval('public.specialties_id_seq'::regclass);


--
-- Name: super_appointments id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.super_appointments ALTER COLUMN id SET DEFAULT nextval('public.super_appointments_id_seq'::regclass);


--
-- Name: user_fcm_tokens id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_fcm_tokens ALTER COLUMN id SET DEFAULT nextval('public.user_fcm_tokens_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
--

    ADD CONSTRAINT account_pkey PRIMARY KEY (id);


--
--

    ADD CONSTRAINT invitation_pkey PRIMARY KEY (id);


--
--

    ADD CONSTRAINT jwks_pkey PRIMARY KEY (id);


--
--

    ADD CONSTRAINT member_pkey PRIMARY KEY (id);


--
--

    ADD CONSTRAINT organization_pkey PRIMARY KEY (id);


--
--

    ADD CONSTRAINT organization_slug_key UNIQUE (slug);


--
--

    ADD CONSTRAINT project_config_endpoint_id_key UNIQUE (endpoint_id);


--
--

    ADD CONSTRAINT project_config_pkey PRIMARY KEY (id);


--
--

    ADD CONSTRAINT session_pkey PRIMARY KEY (id);


--
--

    ADD CONSTRAINT session_token_key UNIQUE (token);


--
--

    ADD CONSTRAINT user_email_key UNIQUE (email);


--
--

    ADD CONSTRAINT user_pkey PRIMARY KEY (id);


--
--

    ADD CONSTRAINT verification_pkey PRIMARY KEY (id);


--
-- Name: admins admins_email_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_email_key UNIQUE (email);


--
-- Name: admins admins_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_pkey PRIMARY KEY (id);


--
-- Name: appointment_reminder_sent appointment_reminder_sent_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.appointment_reminder_sent
    ADD CONSTRAINT appointment_reminder_sent_pkey PRIMARY KEY (appointment_id);


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: blood_banks blood_banks_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.blood_banks
    ADD CONSTRAINT blood_banks_pkey PRIMARY KEY (id);


--
-- Name: call_sessions call_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.call_sessions
    ADD CONSTRAINT call_sessions_pkey PRIMARY KEY (id);


--
-- Name: consultations consultations_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.consultations
    ADD CONSTRAINT consultations_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: deans deans_email_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.deans
    ADD CONSTRAINT deans_email_key UNIQUE (email);


--
-- Name: deans deans_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.deans
    ADD CONSTRAINT deans_pkey PRIMARY KEY (id);


--
-- Name: doctor_slots doctor_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.doctor_slots
    ADD CONSTRAINT doctor_slots_pkey PRIMARY KEY (id);


--
-- Name: doctor_slots doctor_slots_slot_code_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.doctor_slots
    ADD CONSTRAINT doctor_slots_slot_code_key UNIQUE (slot_code);


--
-- Name: doctors doctors_email_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.doctors
    ADD CONSTRAINT doctors_email_key UNIQUE (email);


--
-- Name: doctors doctors_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.doctors
    ADD CONSTRAINT doctors_pkey PRIMARY KEY (id);


--
-- Name: emergency_contacts emergency_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.emergency_contacts
    ADD CONSTRAINT emergency_contacts_pkey PRIMARY KEY (id);


--
-- Name: emergency_events emergency_events_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.emergency_events
    ADD CONSTRAINT emergency_events_pkey PRIMARY KEY (id);


--
-- Name: health_records health_records_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.health_records
    ADD CONSTRAINT health_records_pkey PRIMARY KEY (id);


--
-- Name: hospital_tieup_doctors hospital_tieup_doctors_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.hospital_tieup_doctors
    ADD CONSTRAINT hospital_tieup_doctors_pkey PRIMARY KEY (id);


--
-- Name: hospital_tieups hospital_tieups_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.hospital_tieups
    ADD CONSTRAINT hospital_tieups_pkey PRIMARY KEY (id);


--
-- Name: hospitals hospitals_email_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.hospitals
    ADD CONSTRAINT hospitals_email_key UNIQUE (email);


--
-- Name: hospitals hospitals_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.hospitals
    ADD CONSTRAINT hospitals_pkey PRIMARY KEY (id);


--
-- Name: job_applications job_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.job_applications
    ADD CONSTRAINT job_applications_pkey PRIMARY KEY (id);


--
-- Name: lab_bookings lab_bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.lab_bookings
    ADD CONSTRAINT lab_bookings_pkey PRIMARY KEY (id);


--
-- Name: labs labs_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.labs
    ADD CONSTRAINT labs_pkey PRIMARY KEY (id);


--
-- Name: medical_knowledge medical_knowledge_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.medical_knowledge
    ADD CONSTRAINT medical_knowledge_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: payment_transactions payment_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_pkey PRIMARY KEY (id);


--
-- Name: queue_settings queue_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.queue_settings
    ADD CONSTRAINT queue_settings_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: saved_profiles saved_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.saved_profiles
    ADD CONSTRAINT saved_profiles_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_version_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_version_key UNIQUE (version);


--
-- Name: specialties specialties_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.specialties
    ADD CONSTRAINT specialties_pkey PRIMARY KEY (id);


--
-- Name: specialties specialties_specialty_name_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.specialties
    ADD CONSTRAINT specialties_specialty_name_key UNIQUE (specialty_name);


--
-- Name: super_appointments super_appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.super_appointments
    ADD CONSTRAINT super_appointments_pkey PRIMARY KEY (id);


--
-- Name: telegram_link_codes telegram_link_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.telegram_link_codes
    ADD CONSTRAINT telegram_link_codes_pkey PRIMARY KEY (code);


--
-- Name: telegram_user_links telegram_user_links_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.telegram_user_links
    ADD CONSTRAINT telegram_user_links_pkey PRIMARY KEY (chat_id);


--
-- Name: telegram_user_links telegram_user_links_user_id_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.telegram_user_links
    ADD CONSTRAINT telegram_user_links_user_id_key UNIQUE (user_id);


--
-- Name: payment_transactions uq_payment_razorpay_order; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT uq_payment_razorpay_order UNIQUE (razorpay_order_id);


--
-- Name: refresh_tokens uq_refresh_token_hash; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT uq_refresh_token_hash UNIQUE (token_hash);


--
-- Name: user_fcm_tokens user_fcm_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_fcm_tokens
    ADD CONSTRAINT user_fcm_tokens_pkey PRIMARY KEY (id);


--
-- Name: user_fcm_tokens user_fcm_tokens_user_id_fcm_token_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_fcm_tokens
    ADD CONSTRAINT user_fcm_tokens_user_id_fcm_token_key UNIQUE (user_id, fcm_token);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_telegram_chat_id_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_telegram_chat_id_key UNIQUE (telegram_chat_id);


--
--



--
--



--
--



--
--



--
--



--
--



--
--



--
--



--
-- Name: idx_appointments_booking_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX idx_appointments_booking_id ON public.appointments USING btree (booking_id) WHERE (booking_id IS NOT NULL);


--
-- Name: idx_appointments_created_at; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_appointments_created_at ON public.appointments USING btree (created_at DESC);


--
-- Name: idx_appointments_date; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_appointments_date ON public.appointments USING btree (date DESC);


--
-- Name: idx_appointments_doctor_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_appointments_doctor_id ON public.appointments USING btree (doctor_id);


--
-- Name: idx_appointments_payment_status; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_appointments_payment_status ON public.appointments USING btree (payment_status);


--
-- Name: idx_appointments_slot_date; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_appointments_slot_date ON public.appointments USING btree (slot_date);


--
-- Name: idx_appointments_status; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_appointments_status ON public.appointments USING btree (status);


--
-- Name: idx_appointments_user_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_appointments_user_id ON public.appointments USING btree (user_id);


--
-- Name: idx_audit_action_created; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_audit_action_created ON public.audit_logs USING btree (action, created_at DESC);


--
-- Name: idx_audit_actor; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_audit_actor ON public.audit_logs USING btree (actor_id, created_at DESC);


--
-- Name: idx_audit_resource; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_audit_resource ON public.audit_logs USING btree (resource, resource_id);


--
-- Name: idx_call_sessions_appointment; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_call_sessions_appointment ON public.call_sessions USING btree (appointment_id);


--
-- Name: idx_call_sessions_doctor_status; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_call_sessions_doctor_status ON public.call_sessions USING btree (doctor_id, status);


--
-- Name: idx_call_sessions_patient; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_call_sessions_patient ON public.call_sessions USING btree (patient_user_id, appointment_id);


--
-- Name: idx_consultations_appointment_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_consultations_appointment_id ON public.consultations USING btree (appointment_id);


--
-- Name: idx_consultations_doctor_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_consultations_doctor_id ON public.consultations USING btree (doctor_id);


--
-- Name: idx_consultations_status; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_consultations_status ON public.consultations USING btree (status);


--
-- Name: idx_consultations_user_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_consultations_user_id ON public.consultations USING btree (user_id);


--
-- Name: idx_conversations_doctor_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_conversations_doctor_id ON public.conversations USING btree (doctor_id);


--
-- Name: idx_conversations_user_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_conversations_user_id ON public.conversations USING btree (user_id);


--
-- Name: idx_deans_email; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_deans_email ON public.deans USING btree (email);


--
-- Name: idx_doctor_slots_lookup; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_doctor_slots_lookup ON public.doctor_slots USING btree (doctor_ref, slot_date, mode, status);


--
-- Name: idx_doctor_slots_unique_window; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX idx_doctor_slots_unique_window ON public.doctor_slots USING btree (doctor_ref, slot_date, start_time, mode) WHERE ((status)::text = ANY ((ARRAY['available'::character varying, 'booked'::character varying])::text[]));


--
-- Name: idx_doctors_available; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_doctors_available ON public.doctors USING btree (available);


--
-- Name: idx_doctors_created_at; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_doctors_created_at ON public.doctors USING btree (created_at DESC);


--
-- Name: idx_doctors_date; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_doctors_date ON public.doctors USING btree (date DESC);


--
-- Name: idx_doctors_email; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_doctors_email ON public.doctors USING btree (email);


--
-- Name: idx_doctors_hospital_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_doctors_hospital_id ON public.doctors USING btree (hospital_id);


--
-- Name: idx_doctors_speciality; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_doctors_speciality ON public.doctors USING btree (speciality);


--
-- Name: idx_emergency_contacts_user_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_emergency_contacts_user_id ON public.emergency_contacts USING btree (user_id);


--
-- Name: idx_emergency_events_type_created; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_emergency_events_type_created ON public.emergency_events USING btree (event_type, created_at DESC);


--
-- Name: idx_emergency_events_user_created; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_emergency_events_user_created ON public.emergency_events USING btree (user_id, created_at DESC);


--
-- Name: idx_health_records_appointment_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_health_records_appointment_id ON public.health_records USING btree (appointment_id);


--
-- Name: idx_health_records_doctor_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_health_records_doctor_id ON public.health_records USING btree (doctor_id);


--
-- Name: idx_health_records_user_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_health_records_user_id ON public.health_records USING btree (user_id);


--
-- Name: idx_hospital_tieup_doctors_created_at; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_hospital_tieup_doctors_created_at ON public.hospital_tieup_doctors USING btree (created_at DESC);


--
-- Name: idx_hospital_tieup_doctors_hospital_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_hospital_tieup_doctors_hospital_id ON public.hospital_tieup_doctors USING btree (hospital_tieup_id);


--
-- Name: idx_hospitals_available; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_hospitals_available ON public.hospitals USING btree (available);


--
-- Name: idx_hospitals_email; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_hospitals_email ON public.hospitals USING btree (email);


--
-- Name: idx_job_applications_email; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_job_applications_email ON public.job_applications USING btree (email);


--
-- Name: idx_job_applications_status; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_job_applications_status ON public.job_applications USING btree (status);


--
-- Name: idx_medical_knowledge_symptom; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_medical_knowledge_symptom ON public.medical_knowledge USING btree (symptom);


--
-- Name: idx_notifications_is_read; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_notifications_is_read ON public.notifications USING btree (is_read);


--
-- Name: idx_notifications_user_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);


--
-- Name: idx_payment_checkout_token; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX idx_payment_checkout_token ON public.payment_transactions USING btree (checkout_token) WHERE (checkout_token IS NOT NULL);


--
-- Name: idx_payment_status_created; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_payment_status_created ON public.payment_transactions USING btree (status, created_at DESC);


--
-- Name: idx_payment_user_status; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_payment_user_status ON public.payment_transactions USING btree (user_id, status, created_at DESC);


--
-- Name: idx_queue_settings_doctor_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_queue_settings_doctor_id ON public.queue_settings USING btree (doctor_id);


--
-- Name: idx_refresh_tokens_expires; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_refresh_tokens_expires ON public.refresh_tokens USING btree (expires_at) WHERE (revoked_at IS NULL);


--
-- Name: idx_refresh_tokens_user_role; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_refresh_tokens_user_role ON public.refresh_tokens USING btree (user_id, role) WHERE (revoked_at IS NULL);


--
-- Name: idx_saved_profiles_user_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_saved_profiles_user_id ON public.saved_profiles USING btree (user_id);


--
-- Name: idx_specialties_name; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_specialties_name ON public.specialties USING btree (specialty_name);


--
-- Name: idx_specialties_status; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_specialties_status ON public.specialties USING btree (status);


--
-- Name: idx_telegram_user_links_user_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_telegram_user_links_user_id ON public.telegram_user_links USING btree (user_id);


--
-- Name: idx_user_fcm_tokens_user_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_user_fcm_tokens_user_id ON public.user_fcm_tokens USING btree (user_id);


--
-- Name: idx_users_created_at; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_users_created_at ON public.users USING btree (created_at DESC);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
--



--
--



--
--



--
--



--
--



--
--



--
-- Name: appointment_reminder_sent appointment_reminder_sent_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.appointment_reminder_sent
    ADD CONSTRAINT appointment_reminder_sent_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;


--
-- Name: appointments appointments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: consultations consultations_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.consultations
    ADD CONSTRAINT consultations_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;


--
-- Name: consultations consultations_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.consultations
    ADD CONSTRAINT consultations_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id);


--
-- Name: consultations consultations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.consultations
    ADD CONSTRAINT consultations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: conversations conversations_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: deans deans_hospital_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.deans
    ADD CONSTRAINT deans_hospital_id_fkey FOREIGN KEY (hospital_id) REFERENCES public.hospital_tieups(id) ON DELETE CASCADE;


--
-- Name: emergency_contacts emergency_contacts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.emergency_contacts
    ADD CONSTRAINT emergency_contacts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: appointments fk_appt_user; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT fk_appt_user FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: consultations fk_consult_user; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.consultations
    ADD CONSTRAINT fk_consult_user FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: emergency_contacts fk_ec_user; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.emergency_contacts
    ADD CONSTRAINT fk_ec_user FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: health_records fk_hr_user; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.health_records
    ADD CONSTRAINT fk_hr_user FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: health_records health_records_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.health_records
    ADD CONSTRAINT health_records_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);


--
-- Name: health_records health_records_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.health_records
    ADD CONSTRAINT health_records_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id);


--
-- Name: health_records health_records_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.health_records
    ADD CONSTRAINT health_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: hospital_tieup_doctors hospital_tieup_doctors_hospital_tieup_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.hospital_tieup_doctors
    ADD CONSTRAINT hospital_tieup_doctors_hospital_tieup_id_fkey FOREIGN KEY (hospital_tieup_id) REFERENCES public.hospital_tieups(id) ON DELETE CASCADE;


--
-- Name: lab_bookings lab_bookings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.lab_bookings
    ADD CONSTRAINT lab_bookings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: queue_settings queue_settings_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.queue_settings
    ADD CONSTRAINT queue_settings_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON DELETE CASCADE;


--
-- Name: saved_profiles saved_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.saved_profiles
    ADD CONSTRAINT saved_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: telegram_link_codes telegram_link_codes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.telegram_link_codes
    ADD CONSTRAINT telegram_link_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: telegram_user_links telegram_user_links_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.telegram_user_links
    ADD CONSTRAINT telegram_user_links_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: neondb_owner
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO neon_superuser WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON TABLES TO neon_superuser WITH GRANT OPTION;


--
-- PostgreSQL database dump complete
--


