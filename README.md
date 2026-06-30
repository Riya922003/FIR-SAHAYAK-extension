# FIR Sahayak

Online FIR filing platform for India. Citizens file complaints digitally; officers manage them through a full lifecycle workflow.

---

## Tech Stack

**Backend** — FastAPI, PostgreSQL (Supabase), SQLModel, Alembic, AsyncPG  
**Frontend** — React, TypeScript, Vite  
**AI** — Groq (LLaMA 3.3 70B)  
**Auth** — JWT with role-based access control

---

## What We've Built

### Authentication & Users
- Registration and login with JWT tokens
- Four roles: Citizen, Officer, Station Admin, Higher Authority
- Password hashing, token refresh, protected routes

### FIR Filing (Citizen)
- 4-step form: Incident → Location & Station → Description → Review
- Geo-based police station search from incident location
- FIR saved immediately on submit — no AI dependency at filing time
- Complainant details auto-filled from the logged-in user profile

### FIR Lifecycle (Officer)
- Unassigned queue: officers claim FIRs from submitted pool
- Status workflow: Submitted → Acknowledged → Under Investigation → Resolved → Closed
- Rejection with mandatory written reason (visible to citizen)
- IPC sections recorded by the officer at any status transition
- Full status history with timestamps and notes

### Citizen Actions
- Real-time status tracking with timeline view
- Close / withdraw FIR while in draft, submitted, or acknowledged state
- Reapply after rejection with an updated description
- Escalate to district higher authority from acknowledged or under-investigation state

### Higher Authority
- District-wide FIR view and stats
- Issue directives on escalated cases
- Officer management per station

### AI Enrichment (Groq-decoupled)
- Separate post-filing step — Groq being down never blocks FIR submission
- 10-question AI-guided interview stored in `ai_conversations` table (survives server restarts)
- Citizen answers saved to DB before each Groq call — no answer is ever lost mid-conversation
- Synthesis on answer 10: generates an enriched case summary + suggested IPC sections
- Resume support: citizen can leave and return mid-interview
- Enrichment locked when officer acknowledges the FIR
- 3-day grace window: if pending for 2+ days, day-2 notification email sent to citizen
- Enrichment status badge on citizen dashboard, FIR list, and officer detail view
- Officer sees enriched description alongside original complaint when complete

### Circuit Breaker (Groq)
- Custom circuit breaker with rolling failure window (5 failures / 60s → open)
- Three states: closed, open, half-open with automatic recovery
- One retry per request before recording a failure
- Circuit state exposed on `/health` endpoint
- 503 returned immediately when circuit is open — frontend shows friendly message

### AI Legal Chat
- Floating chat widget available to citizens on all dashboard views
- Answers questions about IPC sections, FIR process, and legal rights
- Powered by Groq; conversation history maintained per session

### Rate Limiting
- Per-endpoint limits via SlowAPI
- Tighter limits on filing and enrichment start; looser on message submission

### Database
- Alembic migrations with non-destructive `ALTER TABLE IF NOT EXISTS` fallback on startup
- Tables: `users`, `firs`, `fir_status_history`, `police_stations`, `ai_conversations`, `escalations`
- `ai_conversations`: one row per FIR, full message history as JSON, turn count

---

## Project Structure

```
FIR-SAHAYAK/
├── backend/
│   ├── app/
│   │   ├── core/          # config, database, security, limiter, circuit breaker
│   │   ├── models/        # SQLModel table definitions + enums
│   │   ├── repositories/  # async DB access layer
│   │   ├── routers/       # fir, auth, ai, admin, authority, enrichment
│   │   ├── schemas/       # Pydantic request/response models
│   │   └── services/      # ai_service (Groq calls)
│   ├── alembic/           # DB migrations
│   └── main.py
├── frontend/
│   └── src/
│       ├── api/           # typed fetch wrappers (fir, auth, officer, ai)
│       ├── components/
│       │   ├── dashboard/ # citizen views + enrichment chat
│       │   ├── officer/   # officer views
│       │   └── authority/ # higher authority views
│       └── pages/         # CitizenDashboard, OfficerDashboard, AuthorityDashboard
└── docs/
    └── InventoryTracker_ProjectSpec.pdf
```
