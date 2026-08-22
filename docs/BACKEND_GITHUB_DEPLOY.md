# MEDCLUES — Backend GitHub Push Guide (Deploy)

Use this when pushing the **FastAPI backend** (`fastapi_back/`) to GitHub before deploying to Render, Railway, AWS, VPS, etc.

---

## Quick answer — minimum folders to push

Push **only** the `fastapi_back/` folder contents listed below (plus repo root files if you keep a monorepo).

```
fastapi_back/
├── app/                    ✅ REQUIRED — all API code
├── migrations/             ✅ REQUIRED — SQL schema updates
├── main.py                 ✅ REQUIRED — app entry point
├── requirements.txt        ✅ REQUIRED — Python dependencies
├── run_onboarding_migration.py   ✅ RECOMMENDED — onboarding DB migration helper
└── start.ps1               ⚪ OPTIONAL — local Windows start script
```

Optional docs (kept under `docs/`, not required to deploy):

```
docs/BACKEND_GITHUB_DEPLOY.md
docs/backend/README_PHONE.md
docs/backend/AGORA_VIDEO.md
docs/backend/TELEGRAM_BOT.md
```

### Inside `fastapi_back/app/` (all required subfolders)

```
app/
├── config/         ✅ DB, settings, env loading
├── controllers/    ✅ Business logic
├── middleware/     ✅ Auth middleware
├── models/         ✅ Database models
├── routes/         ✅ API routes
├── services/       ✅ Email, Agora, tokens, etc.
└── utils/          ✅ Helpers, formatters
```

---

## Push the whole repo or backend only?

| Strategy | What to push | Best for |
|----------|--------------|----------|
| **Monorepo (current)** | Root `README.md`, `.gitignore`, entire `fastapi_back/` | One GitHub repo for Flutter + Admin + Backend |
| **Backend-only repo** | Only `fastapi_back/` folder (copy into new repo root) | Dedicated deploy repo / smaller CI |

You do **not** need these client folders for **backend deploy**:

| Folder | Push for backend? |
|--------|-------------------|
| `flutter_mobile/` | ❌ No (mobile app) |
| `admin/` | ❌ No (admin portal) |
| `frontend/` | ❌ No (patient web) |
| `mobile/` | ❌ No (Expo legacy) |
| `scratch/` | ❌ No |
| `assets/` (root) | ❌ No |

---

## Never push to GitHub (secrets & junk)

| Item | Why |
|------|-----|
| `fastapi_back/.env` | Database passwords, JWT secret, API keys |
| Any `*.env` file | Same |
| `__pycache__/` | Compiled Python — auto-generated |
| `*.pyc` | Compiled Python |
| `fastapi_back/scratch/` | One-off dev/debug scripts |
| `fastapi_back/scripts/` | Optional — only if you use them in deploy |
| `*_credentials.md` | Plain-text passwords (e.g. `docs/dev/all_doctors_credentials.md`) |
| `analysis_report.txt`, `hospital_doctor_list_utf8.txt` | Local reports |
| `node_modules/` | Not used by Python backend |

Set secrets on the **hosting platform** (Render/Railway/VPS), not in Git.

---

## Recommended `.env` variables on server (do not commit)

Configure these in your deploy dashboard:

```
# CRITICAL: min 32 characters or Render deploy will exit (see validate_settings)
JWT_SECRET=your-random-secret-at-least-32-characters-long
DATABASE_URL=          # or PG_HOST, PG_USER, PG_PASSWORD, PG_DATABASE, PG_PORT
PORT=5000
DEBUG=false
CORS_ALLOWED_ORIGINS=https://medclues.onrender.com

# Email / OTP
BREVO_API_KEY=         # or your SMTP vars

# Payments
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=

# Media
CLOUDINARY_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Video
AGORA_APP_ID=
AGORA_APP_CERTIFICATE=

# AI (if used)
GEMINI_API_KEY=
MISTRAL_API_KEY=
OPENAI_API_KEY=

# Telegram bot (@medcluesBot)
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=medcluesBot
TELEGRAM_BOT_ENABLED=true
```

### Render deploy failure: `JWT_SECRET must be at least 32 characters`

1. Render Dashboard → **medclues** service → **Environment**
2. Set `JWT_SECRET` to a random string **≥ 32 characters** (not `greatstack`)
3. Set `DEBUG=false`, `DATABASE_URL`, `TELEGRAM_BOT_*` as above
4. **Manual Deploy** → wait for **Live** status
5. Test: `GET https://medclues.onrender.com/api/health` (or docs)
6. Test Telegram: `GET /api/user/telegram/status` with auth token (should not 404)

---

## After deploy — run database migrations

On production PostgreSQL, run once (in order):

1. `fastapi_back/migrations/001_refresh_tokens.sql`
2. `fastapi_back/migrations/002_user_onboarding.sql`

Or from the server:

```bash
cd fastapi_back
python run_onboarding_migration.py
```

---

## Suggested git commands (backend-focused push)

From project root:

```bash
# 1. Check what will be committed
git status

# 2. Stage backend only (monorepo)
git add fastapi_back/app/
git add fastapi_back/migrations/
git add fastapi_back/main.py
git add fastapi_back/requirements.txt
git add fastapi_back/run_onboarding_migration.py
git add docs/BACKEND_GITHUB_DEPLOY.md

# 3. Commit
git commit -m "Prepare FastAPI backend for production deploy"

# 4. Push
git push origin main
```

---

## Production start command (typical)

```bash
cd fastapi_back
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port $PORT
```

(Use `PORT` from your host — often `5000` or platform-assigned.)

---

## Checklist before push

- [ ] `.env` is **not** staged
- [ ] No `*_credentials.md` files staged
- [ ] `requirements.txt` is up to date
- [ ] `migrations/` includes latest SQL (`002_user_onboarding.sql`)
- [ ] `main.py` runs locally with production-like env
- [ ] CORS / allowed origins updated for your Flutter/web domains on the server

---

## Optional: add `fastapi_back/.gitignore`

If not already covered by root `.gitignore`, ignore inside backend:

```
.env
__pycache__/
*.pyc
scratch/
*_credentials.md
analysis_report.txt
```

---

*MEDCLUES / PMS FNL 2 — Backend deploy guide*
