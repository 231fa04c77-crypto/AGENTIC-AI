# Auth contract — MedClues (M8)

Additive login/refresh response and request-header conventions. Legacy field names remain valid.

## Login / refresh response

Issued by `token_service.issue_token_pair` / `build_login_response` for patient, doctor, dean, receptionist, and admin.

| Field | Notes |
|-------|--------|
| `token` | Legacy access JWT (kept) |
| `accessToken` | Alias of `token` |
| `refresh_token` | Refresh JWT when returned in body (kept) |
| `refreshToken` | CamelCase alias of `refresh_token` |
| `expires_in` | Access TTL in seconds (kept) |
| `expiresAt` | Access expiry ISO-8601 UTC (`…Z`) |
| `userId` | Numeric id when role uses id claims (not admin) |
| `role` | `patient` \| `doctor` \| `dean` \| `receptionist` \| `admin` |
| `permissions` | Array of permission strings; may be empty |
| `profile` | Role profile object when available |
| `email` / `hospitalId` | Present when applicable |

Dean/reception also keep legacy nested objects `dean` / `reception` (same shape as `profile`).

Web clients using cookie storage: refresh may be set as HttpOnly cookie and omitted from JSON (`build_auth_response`). Mobile/API clients still receive `refresh_token` + `refreshToken` in the body.

## Request auth headers (role APIs)

Prefer `Authorization: Bearer <accessJwt>`. Role-specific headers remain supported for existing admin/doctor/reception/dean clients.

| Role | Headers accepted (in addition to Bearer) |
|------|------------------------------------------|
| Patient | `token` / `Token`; raw `Authorization` without `Bearer ` |
| Doctor | `dtoken` / `dToken` / `token` |
| Admin | `aToken` / `atoken` / `token` |
| Reception | `rectoken` / `reception-token` / `token` |
| Dean | `deantoken` / `dean-token` / `token` |
| Dispatch (dean or reception) | Bearer, then `deantoken`, `rectoken`, aliases, `token` |

Middleware: `fastapi_back/app/middleware/auth.py`.

## Partner HMAC (B2B)

Partner routes use API key + HMAC, not role JWTs.

| Header | Purpose |
|--------|---------|
| `X-Api-Key` | Partner public key (`pk_…`) |
| `X-Timestamp` | Unix seconds; ±5 minute window |
| `X-Signature` | HMAC-SHA256 hex of `{timestamp}.{METHOD}.{path}.{sha256(body)}` |
| `X-Sandbox-Bypass` | Sandbox only: `true` skips HMAC when environment is sandbox |

Signing helper: `partner_auth_service.compute_request_signature`. Middleware: `partner_auth.py`.

Outbound webhooks use `sha256=` + HMAC of raw body (`build_webhook_signature`).

## Refresh / logout

- `POST /api/auth/refresh` — body `refresh_token` or `refreshToken`, plus `role`
- Cookie-backed web clients may omit body refresh; cookie is read by role
- Logout endpoints accept the same refresh field names
