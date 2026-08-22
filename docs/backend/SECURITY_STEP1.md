# Step 1 — Security Hardening (Completed)

## Changes (backward compatible)

| Change | Class | Frontend impact |
|--------|-------|-----------------|
| Removed hardcoded secret defaults | Safe | None |
| Startup validation (`validate_settings`) | Safe | None |
| CORS allowlist in production | Safe | Set `CORS_ALLOWED_ORIGINS` on Render |
| Removed `DATABASE_URL` from AI external payload | Safe | None |
| Google idToken verification (when sent) | Safe | Optional `idToken` in social-login body |
| Legacy social login flag | Safe | Default allows current clients |
| Refresh token reuse detection | Safe | None |
| `POST /api/auth/logout-all` (+ role variants) | Safe | New additive endpoints |
| Separate `REFRESH_TOKEN_SECRET` (optional) | Safe | None |
| Structured logging with redaction | Safe | None |
| `.env.example` | Safe | None |

## Render production env (required)

```
DEBUG=false
JWT_SECRET=<64-char-random>
DATABASE_URL=<neon-url>
CORS_ALLOWED_ORIGINS=https://medclues.onrender.com,https://medclues-admin.vercel.app,http://localhost:5173
GOOGLE_CLIENT_ID=<firebase-web-client-id>
SOCIAL_LOGIN_ALLOW_LEGACY=true
```

Set `SOCIAL_LOGIN_ALLOW_LEGACY=false` after clients send `idToken`.

## Credential rotation

Rotate all secrets in `.env` after deploy (see plan in chat).

## Testing

1. `pip install -r requirements.txt`
2. `DEBUG=true` — server starts without JWT_SECRET
3. `DEBUG=false` without JWT_SECRET — server exits
4. Social login with existing payload — still works if `SOCIAL_LOGIN_ALLOW_LEGACY=true`
5. Social login with `idToken` — verified via Google
6. `/api/auth/refresh` — rotation works
7. Reuse old refresh token — all sessions revoked
8. `POST /api/auth/logout-all` with Bearer token — success
