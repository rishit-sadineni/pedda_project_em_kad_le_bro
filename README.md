# SignalForge — Indie Game Playtest Intelligence

SignalForge is a full-stack capstone application for turning unstructured playtest feedback into traceable, evidence-led investigation work. It includes separate tester and developer portals, report-scoped conversations, issue workflow, retesting, and a bounded Playtest Detective integration.

## Stack and architecture

- **Client:** React, JavaScript, Vite, semantic HTML, plain CSS
- **Server:** Node.js, Express REST APIs, server-side sessions, bcrypt password hashing
- **Persistence:** MongoDB Atlas and Mongoose
- **AI:** Ollama generation/embeddings integration point, Zod input validation, Atlas Vector Search-ready report metadata

The client only communicates with Express. Ollama is never exposed to the browser. The server checks the authenticated session and role for every protected operation. In the absence of `MONGODB_URI`, the app uses clearly labelled in-memory demo data so the UI can be reviewed without pretending that writes are durable or that fallback output is AI.

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

Open <http://localhost:5173>. Demo accounts are prefilled:

| Portal | Email | Password |
| --- | --- | --- |
| Tester | `tester@signalforge.demo` | `DemoPass123!` |
| Developer | `developer@signalforge.demo` | `DemoPass123!` |

For durable MongoDB Atlas persistence, set `MONGODB_URI`, replace `SESSION_SECRET`, set `DEMO_MODE=false`, and run `npm run seed`. The seed command refuses to run without a MongoDB URI.
Production startup also refuses a missing or short `SESSION_SECRET`; use a randomly generated value of at least 32 characters.

## Feature walkthrough

1. Open the tester portal and inspect **My reports**.
2. Open `SF-1042` to see the original evidence and report-specific developer conversation.
3. Switch to the developer portal to change issue status, message the tester, and run Playtest Detective.
4. Configure Ollama locally (`ollama serve`, then `ollama pull llama3.2`). Ollama works with demo-mode persistence; MongoDB is not required for Playtest Detective.
5. When a report is awaiting retest, the tester can submit Pass, Fail, or Unable to Reproduce. Pass verifies the issue, while a failed retest reopens investigation.

## API overview

- `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET /api/games`, `POST /api/games`
- `GET /api/reports`, `POST /api/reports`, `GET /api/reports/:id`
- `PATCH /api/reports/:id/status`
- `GET/POST /api/reports/:id/messages`
- `POST /api/reports/:id/retests`
- `POST /api/reports/:id/investigate`

## AI and data safety

Playtest Detective receives only records already authorized by the server. Its output is labelled as either `ollama` or `unavailable`; no fallback is presented as genuine AI. Ollama is independent of demo-mode persistence, so it can be used before MongoDB is configured. The current integration preserves evidence identifiers and distinct session counts. Atlas Vector Search can be added by creating a vector index over `embedding` and `embeddingModel`; the schema already keeps model metadata so records can be re-embedded after a model change. Similarity never deletes, merges, or silently changes reports.

## Validation

```bash
npm test
npm run build
```

The tests cover the health/configuration boundary and unauthenticated access control. Known limitations for this capstone slice are local attachment storage, email delivery, and Atlas vector index provisioning; these are intentionally surfaced rather than replaced with fake success.
