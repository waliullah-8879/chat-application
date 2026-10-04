# Nexus Chat — Real-Time Chat Application

A production-style Week 04 EncoderX Full Stack Development internship project demonstrating authenticated WebSocket communication, private chat rooms, live presence, typing indicators and persistent PostgreSQL message history.

## Core features

- React + TypeScript responsive chat dashboard
- Express REST API and Socket.IO on one HTTP server
- PostgreSQL + Prisma persistence
- Register, login, logout and rotating refresh sessions
- Authenticated Socket.IO handshake
- Server-authorized private rooms
- Database-confirmed real-time messages
- Multi-tab online/offline presence
- Typing indicators
- Cursor-based message history pagination
- Duplicate message protection using client message IDs
- Input validation, rate limiting, Helmet and explicit CORS

## Project structure

```text
realtime-chat-app/
├── src/
│   ├── backend/
│   ├── frontend/
│   └── shared/
├── prisma/
├── docs/
├── tests/
├── package.json
└── README.md
```

Everything belongs to one npm project and one Git repository.

## Local setup

### 1. Requirements

- Node.js 20+
- PostgreSQL

### 2. Install

```bash
npm install
```

Optional: if you have Docker, start PostgreSQL with:

```bash
docker compose up -d
```

The included development `DATABASE_URL` matches this Docker database.

### 3. Environment

Copy `.env.example` to `.env` and update `DATABASE_URL` and `JWT_ACCESS_SECRET`.

### 4. Create the database tables

```bash
npm run prisma:generate
npm run prisma:migrate -- --name init
```

### 5. Start frontend and backend together

```bash
npm run dev
```

Frontend: `http://localhost:5173`
Backend: `http://localhost:4000`

Open a normal browser window and an incognito/private window, create two accounts and chat between them.

## Security architecture

The browser never supplies a trusted sender ID. After login, the Socket.IO handshake sends the short-lived access token. The backend verifies that token and stores the verified user ID in `socket.data.userId`. Room joins and message sends also verify conversation membership in PostgreSQL.

Refresh tokens use HttpOnly cookies and are stored in the database only as hashes. Access tokens remain in React memory rather than long-term browser storage.

See `docs/SECURITY.md` for more detail.

## Real-time flow

1. User logs in over HTTP.
2. Server returns an access token and refresh cookie.
3. Socket.IO connects with the access token.
4. Handshake middleware verifies identity.
5. User selects a conversation.
6. Server verifies membership before joining the room.
7. Message payload is validated.
8. Server saves the message in PostgreSQL.
9. The database-confirmed message is emitted to the appropriate users/room.
10. React appends it immediately without refreshing.

See `docs/REALTIME-PIPELINE.md`.

## Tests

```bash
npm test
```

The included tests cover validation boundaries and multi-socket presence behavior. Add database-backed integration tests before treating this as a larger production system.

## Production

```bash
npm run build
npm start
```

Use a WebSocket-capable Node.js host and managed PostgreSQL. See `docs/DEPLOYMENT.md`.

## EncoderX requirement mapping

- WebSocket communication: Socket.IO attached to Node HTTP server
- Connection/disconnection lifecycle: handled in `socketServer.ts`
- Handshake authentication: JWT middleware on Socket.IO
- User/socket mapping: `PresenceManager` tracks multiple socket IDs per user
- Message persistence: Prisma `Message` model
- Sender/receiver/timestamp storage: explicit message fields
- Real-time rooms: `conversation:<conversationId>`
- Messaging dashboard: responsive React UI
- Instant messages: `message:new`
- Online/offline status: presence events
- Typing indicator: typing room events
- Technical architecture: `docs/ARCHITECTURE.md`
- Real-time pipeline: `docs/REALTIME-PIPELINE.md`
- Security notes: `docs/SECURITY.md`

## Suggested 3–5 minute demo

1. Introduce the architecture and technologies.
2. Open two browser sessions and sign into two accounts.
3. Show one user appearing online.
4. Start a private conversation.
5. Type and show the real-time typing indicator.
6. Send messages in both directions without refreshing.
7. Refresh one browser and show persisted message history.
8. Close one session and show offline/last-seen state.
9. Briefly show the Prisma schema and Socket.IO authentication middleware.
10. End on the deployed application and GitHub repository.

## LinkedIn post draft

Built a real-time chat application for Week 04 of my EncoderX Full Stack Development internship. The project moved beyond standard HTTP request/response flows by using Socket.IO for persistent bi-directional communication, with PostgreSQL/Prisma for message persistence.

The most valuable part was securing the real-time pipeline: user identity is verified during the WebSocket handshake, private rooms are authorized server-side, and sender identity is never trusted from the client. I also implemented live presence, typing indicators, persistent history, refresh-token sessions and a responsive React interface.

This task gave me a much clearer understanding of connection lifecycles, real-time state synchronization, authentication vs authorization, and how a chat architecture can scale beyond a single server.

#EncoderX #FullStackDevelopment #WebDevelopment #WebSockets #RealTime #Internship #LearningInPublic

## Submission PDF placeholders

- GitHub Repository: `<ADD_GITHUB_LINK>`
- Deployed Application: `<ADD_DEPLOYED_APP_LINK>`
- LinkedIn Post: `<ADD_LINKEDIN_POST_LINK>`
- Demo Video: `<ADD_VIDEO_LINK>`
