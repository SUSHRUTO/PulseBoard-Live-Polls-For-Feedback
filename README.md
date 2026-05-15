# PollPulse

PollPulse is a full-stack real-time polling platform for hackathon submission. Creators can sign in, create polls with multiple single-choice questions, share public links, collect anonymous or authenticated responses, watch analytics update live, and publish final results to the same public poll URL.

## Features

- Email/password authentication with secure hashed passwords and HTTP-only JWT cookies
- Optional generic OIDC login through environment variables
- Protected creator routes and public respondent routes
- Dynamic React poll builder with mandatory and optional question validation
- Anonymous and authenticated response modes
- Poll expiry enforcement on both frontend and backend
- Single-option questions with validated option IDs
- Creator analytics dashboard with totals, option counts, skip counts, and completion insight
- Public result publishing through the same shared poll link
- Socket.io live analytics updates when responses are submitted
- Redis-backed rate limiting when `REDIS_URL` is configured, with in-memory fallback for local demos
- Single repository containing backend, frontend, database schema, and deployment notes

## Tech Stack

- React, Vite, React Router, Socket.io Client, Lucide icons
- Node.js, Express, Socket.io
- Drizzle ORM with PostgreSQL
- Redis for production-ready rate limiting
- Bcrypt password hashing, JWT session cookies, optional OIDC

## Project Structure

```text
.
|-- server/db/schema.js         # Drizzle database schema
|-- server/                     # Express API, auth, rate limits, sockets
|-- src/                        # React frontend
|-- docker-compose.yml          # Local PostgreSQL and Redis services
|-- .env.example                # Required environment variables
`-- package.json                # Single-repo scripts
```

## Local Setup

1. Install dependencies.

```bash
npm install
```

2. Create your environment file.

```bash
cp .env.example .env
```

3. Start PostgreSQL and Redis.

```bash
docker compose up -d postgres redis
```

PostgreSQL stores users, polls, responses, answers, and published results. Redis is recommended for the hackathon rate-limiting requirement. If Redis is not running, the app still runs with in-memory rate limiting for local development.

4. Create the PostgreSQL database tables.

```bash
npm run db:push
```

5. Run the full-stack app.

```bash
npm run dev
```

Frontend: `http://localhost:5173`  
Backend: `http://localhost:4000`

## Environment Variables

```env
NODE_ENV=development
PORT=4000
CLIENT_URL=http://localhost:5173
DATABASE_URL=postgres://pollpulse:pollpulse@localhost:5433/pollpulse
DATABASE_SSL=false
JWT_SECRET=replace-with-a-long-random-secret
REDIS_URL=redis://localhost:6379

OIDC_ISSUER_URL=
OIDC_CLIENT_ID=
OIDC_CLIENT_SECRET=
OIDC_CALLBACK_URL=http://localhost:4000/api/auth/oidc/callback

VITE_API_URL=http://localhost:4000
```

OIDC is optional. When the OIDC variables are empty, the app uses email/password auth only. You can connect a provider such as Keycloak, Auth0, or any standards-compliant OIDC server by filling the issuer, client ID, client secret, and callback URL.

## Main User Flow

1. Register or sign in.
2. Create a poll with a title, expiry time, response mode, and questions.
3. Share the public `/p/:slug` link.
4. Respondents submit answers until the expiry time.
5. Creator watches live analytics on `/polls/:pollId`.
6. Creator publishes final results.
7. The same public poll link shows published summaries.

## API Overview

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create email/password account |
| `POST` | `/api/auth/login` | Sign in |
| `POST` | `/api/auth/logout` | Sign out |
| `GET` | `/api/auth/me` | Read current session |
| `GET` | `/api/auth/oidc/login` | Start optional OIDC login |
| `GET` | `/api/polls` | List creator polls |
| `POST` | `/api/polls` | Create poll |
| `GET` | `/api/polls/:pollId/analytics` | Creator analytics |
| `PATCH` | `/api/polls/:pollId/publish` | Publish final results |
| `GET` | `/api/public/polls/:slug` | Open shared poll link |
| `POST` | `/api/public/polls/:slug/responses` | Submit poll response |

## Socket.io Events

- Client emits `poll:join` with `{ pollId }` on analytics pages.
- Client emits `poll:join` with `{ slug }` on public pages.
- Server emits `poll:analytics` to creator analytics rooms after each submission.
- Server emits `poll:submitted` to public rooms with the live total response count.

## Deployment Notes

Use one repository for both frontend and backend. Use a managed PostgreSQL database for deployment, such as Neon, Supabase, Railway Postgres, Render Postgres, or another hosted Postgres provider.

Recommended Render/Railway style commands:

```bash
npm install
npm run build
npm run db:push
npm start
```

Set `NODE_ENV=production`, `CLIENT_URL` to the deployed frontend/backend origin, a strong `JWT_SECRET`, a hosted PostgreSQL `DATABASE_URL`, and a managed `REDIS_URL`. Set `DATABASE_SSL=true` if your hosted database requires SSL.

## Hackathon Checklist

- Frontend and backend are in one repository.
- Authentication is implemented with real sessions and password hashing.
- Optional OIDC is available through config.
- Redis is supported for rate limiting.
- Socket.io powers live analytics updates.
- Public poll links, expiry, anonymous/authenticated response modes, mandatory validation, analytics, and publishing are implemented.


## Screenshots

### Login Page
![Login](screenshots/login.png)

### Dashboard
![Dashboard](screenshots/dashboard.png)

### Poll Creation
![Poll](screenshots/polls.png)

### Preview
![Poll](screenshots/preview.png)
