# Security Checklist

- [x] JWT key rotation + JWKS endpoint
- [x] Refresh token rotation + reuse detection
- [x] API key revoke propagation
- [ ] Gateway fail-closed auth
- [ ] Route-level rate limit
- [ ] CORS allowlist theo môi trường
- [x] Secrets qua env/secret manager (không hardcode)
- [ ] Dependency scanning trong CI
