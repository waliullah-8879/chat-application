# Real-Time Pipeline

```mermaid
sequenceDiagram
  participant U as Browser
  participant API as Express API
  participant S as Socket.IO
  participant DB as PostgreSQL

  U->>API: Login credentials
  API->>DB: Verify user/password hash
  API-->>U: Access token + HttpOnly refresh cookie
  U->>S: Connect with access token
  S->>S: Verify JWT handshake
  S-->>U: Connected
  U->>S: conversation:join
  S->>DB: Verify conversation membership
  S-->>U: Room joined
  U->>S: message:send
  S->>DB: Re-check membership + save message
  DB-->>S: Authoritative message record
  S-->>U: message:new + acknowledgement
```

## Important events

- `conversation:join` — validates membership before joining `conversation:<id>`.
- `conversation:leave` — leaves the active real-time room.
- `message:send` — validates content, checks authorization, persists, then emits.
- `message:new` — carries the database-confirmed message.
- `typing:start` / `typing:stop` — ephemeral room events; never stored.
- `presence:online` / `presence:offline` — update contact status.
- `conversation:updated` — refreshes conversation previews after new messages.

The sender supplies only the conversation, content and a client message ID. The server derives sender identity from the authenticated socket.
