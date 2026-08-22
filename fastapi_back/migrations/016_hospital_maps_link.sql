-- Google Maps share link for hospital tie-ups (patient Navigate button)

ALTER TABLE hospital_tieups ADD COLUMN IF NOT EXISTS maps_link TEXT;
