# SECURITY_REPORT.md (M12)

## Findings addressed this pass
- Request correlation: `X-Request-ID` generated/propagated in `RequestLoggingMiddleware`
- Partner pharmacy status updates already validate against `VALID_STATUSES` + `TRANSITIONS`
- Partner secrets remain DB-encrypted via partner_auth_service + JWT_SECRET
- Admin partner dashboard no longer sends fake HMAC headers (uses aToken)

## Residual risks (accepted)
- Admin `aToken` bypass on partner routes — intentional for ops analytics; document in AUTH_CONTRACT
- Dual deep-link schemes (`mediclues` + `medichain`) — alias retained one release
- Package applicationId still `com.medichain.*` — deferred (store migration)
- SOCIAL_LOGIN_ALLOW_LEGACY default True — ensure Render sets false in production

## Recommendations
1. Rotate any keys ever pasted in chat
2. Lock partner IP allowlists for production keys
3. Add CSP on admin Vercel if not present
4. Periodic secret scan in CI

**Security score (post-M12 estimate):** 68/100
