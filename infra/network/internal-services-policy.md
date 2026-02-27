# Internal Services Policy

## Allowed flows
- gateway -> auth
- gateway -> ingestion
- gateway -> broadcaster
- ingestion -> kafka
- processing -> kafka
- storage -> kafka + postgres
- broadcaster -> kafka
- auth -> postgres + kafka (revocation events)

## Disallowed flows
- internet -> internal services
- frontend -> internal services (bypass gateway)
