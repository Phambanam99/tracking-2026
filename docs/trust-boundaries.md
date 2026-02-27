# Trust Boundaries

- Boundary 1: Internet -> Gateway
- Boundary 2: Gateway -> Internal services
- Boundary 3: Internal services -> Kafka/Postgres/Redis

## Security controls
- AuthN/AuthZ tại gateway (fail-closed)
- Rate limiting theo route/principal
- Network policy deny-by-default cho internal services
- Không log token/api-key/credential
