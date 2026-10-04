# Security Notes

This project is security-hardened for an internship/demo application, but no software should be described as perfectly vulnerability-free.

Implemented protections include:

- Bcrypt password hashing with configurable work factor.
- Short-lived signed access tokens.
- Random rotating refresh tokens stored server-side only as SHA-256 hashes.
- HttpOnly, SameSite refresh cookie; Secure is enabled in production.
- JWT verification during the Socket.IO handshake.
- Server-derived socket identity; the client cannot choose its sender ID.
- Database membership checks before private room joins and message creation.
- Zod validation for authentication, IDs, rooms and message payloads.
- 2,000-character message limit and Socket.IO payload-size limit.
- Prisma parameterized database operations.
- React text rendering instead of unsafe HTML insertion.
- Helmet, explicit CORS origin and JSON request-size limits.
- HTTP rate limiting on API/authentication routes.
- Generic production error responses.
- Secrets loaded from environment variables and excluded from Git.

## Production additions

For a larger deployment, add a Redis-backed Socket.IO adapter and distributed rate limiter, central logging, HTTPS-only transport at the reverse proxy, secret rotation, automated dependency scanning, database backups and monitoring.
