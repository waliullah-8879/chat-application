# Deployment

The simplest production model is one Node.js service that serves both the built React application and the Express/Socket.IO backend.

## Build

```bash
npm install
npm run prisma:generate
npm run build
```

## Required environment variables

Copy `.env.example` and provide production values. `CLIENT_ORIGIN` must match the public HTTPS origin of the deployed application. Use a long random `JWT_ACCESS_SECRET`.

## Database

Provision PostgreSQL, set `DATABASE_URL`, then run migrations:

```bash
npx prisma migrate deploy
```

## Start

```bash
npm start
```

Use a host that supports persistent Node.js processes and WebSockets. If multiple backend replicas are added, configure the Socket.IO Redis adapter and shared presence state. Depending on the load balancer and enabled transports, sticky sessions may also be required.
