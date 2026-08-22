-- App home promo banners (Flutter carousel). Managed from Super Admin; no app release needed.
CREATE TABLE IF NOT EXISTS app_home_banners (
    id              SERIAL PRIMARY KEY,
    title           VARCHAR(120) NOT NULL,
    subtitle        VARCHAR(240),
    cta_label       VARCHAR(80) NOT NULL DEFAULT 'Explore →',
    route_key       VARCHAR(64) NOT NULL DEFAULT 'hospitals',
    image_url       TEXT,
    gradient_start  VARCHAR(16) DEFAULT '#002855',
    gradient_mid    VARCHAR(16) DEFAULT '#1565C0',
    gradient_end    VARCHAR(16) DEFAULT '#7DD3FC',
    icon_key        VARCHAR(64) DEFAULT 'hospital',
    sort_order      INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    starts_at       TIMESTAMPTZ,
    ends_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_home_banners_active_sort
    ON app_home_banners (is_active, sort_order, id);

COMMENT ON TABLE app_home_banners IS 'Flutter home promo carousel slides; edit via Super Admin';

-- Seed defaults matching previous hardcoded Flutter slides (image optional).
INSERT INTO app_home_banners (title, subtitle, cta_label, route_key, gradient_start, gradient_mid, gradient_end, icon_key, sort_order)
SELECT * FROM (VALUES
    ('Explore hospitals', 'Care finds you when you need it most.', 'Explore Now →', 'hospitals', '#002855', '#1565C0', '#7DD3FC', 'hospital', 0),
    ('Pharmacy', 'The right medicine, right when you need it.', 'Shop Now →', 'pharmacy', '#0F766E', '#009F93', '#99F6E4', 'pharmacy', 1),
    ('Find doctors', 'Good health begins with the right doctor.', 'Browse Doctors →', 'doctors', '#0D9488', '#14B8A6', '#57D2E8', 'doctors', 2),
    ('Health Protection', 'Protect today. Peace of mind tomorrow.', 'Protect Now →', 'healthProtection', '#1E3A5F', '#3B82A8', '#A5B4FC', 'health', 3)
) AS v(title, subtitle, cta_label, route_key, gradient_start, gradient_mid, gradient_end, icon_key, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM app_home_banners LIMIT 1);
