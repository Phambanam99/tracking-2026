# Security Checklist

- [x] JWT key rotation + JWKS endpoint
- [x] Refresh token rotation + reuse detection
- [x] API key revoke propagation
- [x] Gateway fail-closed auth
- [x] Route-level rate limit
- [x] CORS allowlist theo môi trường
- [x] Secrets qua env/secret manager (không hardcode)
- [x] Dependency scanning trong CI
- [x] Secret scanning trong CI

## CI coverage
- Pull request: GitHub Dependency Review fail khi có advisory mức `high` trở lên.
- Pull request / push / schedule: Gitleaks quét secrets rò rỉ trong repo history.
- Pull request / schedule: Trivy filesystem scan xuất SARIF vào GitHub Security tab.
- Push `main`: Gradle dependency submission cập nhật dependency graph cho Dependabot/Dependency Review.
- Frontend runtime deps: `npm audit --omit=dev --audit-level=high`.
