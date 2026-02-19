# SkyTurn — Airport Turnaround Operations Platform

A polyglot microservice platform that simulates real-world **airport ground operations**, built from scratch using AI-assisted development (Claude Code) as a learning exercise in distributed systems, event-driven architecture, and multi-language service design.

> **Built with AI vibe coding.** This entire codebase was developed collaboratively with [Claude Code](https://claude.ai/claude-code) (Anthropic's AI coding agent). The goal was to practice and learn microservice patterns, event-driven design, and polyglot architecture — not to ship production software. If you're interested in AI-assisted development, curious about the architecture, or want to contribute your own improvements, you're welcome to explore, fork, and open PRs.

---

## Why This Domain?

Most microservice tutorials use generic e-commerce (orders, products, carts). This project uses **Airport Turnaround Management** instead — based on the real [EUROCONTROL A-CDM](https://www.eurocontrol.int/concept/airport-collaborative-decision-making) framework — because the domain naturally demonstrates why microservices exist:

- **Events cascade organically**: flight arrival &rarr; turnaround initialization &rarr; crew dispatch &rarr; task updates &rarr; delay alerts
- **MongoDB is genuinely justified**: turnaround documents contain polymorphic embedded task arrays (fueling has liters, catering has meal counts, cargo has container IDs) — not forced into MongoDB for resume bullet points
- **The scheduler solves a real problem**: detecting delayed turnarounds, stuck tasks, and crew shortages before they cascade into flight delays
- **Bounded contexts are clean**: each service owns its data and domain logic with no distributed transactions
- **Authentic terminology**: IATA codes, TOBT (Target Off-Block Time), gate assignments, aircraft registration numbers

---

## Architecture

```
                    +--------------+
                    |   Clients    |
                    +------+-------+
                           |
          +--------+-------+-------+--------+
          |        |               |        |
   +------v--+  +--v----------+  +v------+ +v-----------+
   | Flight   |  | Turnaround  |  | Crew  | | Ops Hub    |
   | Service  |  | Service     |  | Svc   | | Service    |
   | Go/chi   |  | NestJS      |  |FastAPI| | Rust/axum  |
   +----+-----+  +-----+-------+  +---+---+ +-----+------+
        |              |              |            |
        +------+ RabbitMQ +-----------+            |
        |  flight.*  | turnaround.* crew.*         |
        |              |              |            |
   +----v-----+  +-----v-------+  +--v----+  +----v------+
   |PostgreSQL |  | MongoDB     |  |Postgre|  | PostgreSQL|
   | flight_db |  |turnaround_db|  |crew_db|  | ops_db    |
   +----------+  +-------------+  +-------+  +----------+
```

### Services

| Service | Language | Framework | Database | Port | Responsibility |
|---------|----------|-----------|----------|------|----------------|
| **Flight Service** | Go | chi + sqlx | PostgreSQL | 8080 | Flight schedules, arrivals/departures, gate assignments |
| **Turnaround Service** | TypeScript | NestJS + Mongoose | MongoDB | 3000 | Turnaround lifecycle, embedded task arrays, progress tracking |
| **Crew Service** | Python | FastAPI + SQLAlchemy | PostgreSQL | 8000 | Crew management, certifications, shifts, auto-assignment |
| **Ops Hub Service** | Rust | axum + sqlx | PostgreSQL | 8001 | Event audit log, alerts, scheduled delay/shortage detection |

### Why 4 Languages?

This is intentional — not complexity for its own sake. Each language was chosen for a reason and to practice polyglot integration:

- **Go** for the Flight Service: fast HTTP server, simple deployment, good for the "front door" of the system
- **TypeScript/NestJS** for Turnaround: Mongoose gives first-class MongoDB support for document-embedded task arrays; NestJS provides structured DI
- **Python/FastAPI** for Crew: the 4-table JOIN availability query (crew + certifications + shifts - assignments) showcases async SQLAlchemy; Python ecosystem for potential ML-based scheduling in future
- **Rust/axum** for Ops Hub: demonstrates systems-level programming; the scheduler and event consumer benefit from Tokio's async runtime and zero-cost abstractions

---

## Event-Driven Design

All inter-service communication flows through **RabbitMQ topic exchanges**. Services are decoupled — they publish domain events and subscribe to events they care about.

### Primary Event Cascade

```
1. Client marks flight as arrived
   └─ Flight Service publishes: flight.arrived

2. Turnaround Service consumes flight.arrived
   ├─ Creates turnaround document with tasks from aircraft template (7 for A380, 5 for B737)
   └─ Publishes: turnaround.started

3. Crew Service consumes turnaround.started
   ├─ Auto-assigns certified crew to each task (4-table JOIN query)
   ├─ Publishes: crew.assigned (per assignment)
   └─ Publishes: crew.unavailable (if no crew available for a cert)

4. Turnaround Service consumes crew.assigned
   └─ Updates assignedCrewId on the relevant task

5. Ops Hub consumes ALL events (flight.#, turnaround.#, crew.#)
   └─ Logs every event to the event_log audit table
```

### Task Completion Flow

```
1. Client completes a turnaround task (e.g., fueling done)
   └─ Turnaround Service recalculates progress, publishes turnaround.task.completed

2. Crew Service consumes turnaround.task.completed
   └─ Frees the crew member for reassignment

3. When ALL tasks complete → turnaround.completed published
```

### Scheduler (Ops Hub)

The Ops Hub runs three periodic jobs that poll other services via HTTP:

| Job | Interval | Detection Logic |
|-----|----------|-----------------|
| **Turnaround Delay** | 2 min | progress < 50% when > 75% of estimated time has elapsed |
| **Stuck Task** | 3 min | Task in_progress for > 1.5x its estimated duration |
| **Crew Shortage** | 5 min | Upcoming arrivals (within 30 min) with no available certified crew |

---

## Database Design Decisions

### PostgreSQL for Flight, Crew, Ops Hub

Relational data with foreign keys, JOINs, and constraints. The crew availability query is the clearest justification:

```sql
SELECT cm.* FROM crew_members cm
  JOIN certifications c ON c.crew_member_id = cm.id
  JOIN shifts s ON s.crew_member_id = cm.id
WHERE cm.is_active = true
  AND c.cert_type = :required_cert AND c.status = 'active'
  AND c.expiry_date > CURRENT_DATE
  AND s.shift_date = CURRENT_DATE
  AND s.start_time <= NOW() AND s.end_time >= NOW()
  AND cm.id NOT IN (SELECT ta.crew_member_id FROM task_assignments ta WHERE ta.status IN ('assigned','active'))
```

This 4-table JOIN with a subquery is exactly where PostgreSQL shines.

### MongoDB for Turnaround

Turnaround documents contain **embedded task arrays** where each task type has different metadata. In a relational model this would require 6+ JOIN tables (fueling_tasks, catering_tasks, cargo_tasks...) or a messy EAV pattern. MongoDB lets us:

- Read the entire turnaround + all tasks in a single document fetch
- Use the positional `$` operator for atomic embedded task updates
- Store polymorphic metadata per task type without schema changes

---

## RabbitMQ Topology

```
Exchanges (all topic, durable):
  flight.events       → published by Flight Service
  turnaround.events   → published by Turnaround Service
  crew.events         → published by Crew Service

Queues (all durable):
  turnaround-flight-queue   ← flight.arrived, flight.gate.changed
  crew-turnaround-queue     ← turnaround.started, turnaround.task.completed
  turnaround-crew-queue     ← crew.assigned
  ops-hub-all-queue         ← flight.#, turnaround.#, crew.# (wildcards)
```

All services use the same event envelope convention:
```json
{
  "id": "uuid",
  "type": "flight.arrived",
  "flight_id": "uuid",
  "timestamp": "2026-02-19T14:35:00Z",
  "data": { ... }
}
```

---

## Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- ~4 GB free RAM (7 containers)
- `curl` and `jq` for testing scripts

### Quick Start

```bash
# Clone the repo
git clone <repo-url>
cd microservice-practice

# Start everything (first build takes ~5-10 min for Rust)
make up
# or: docker compose up --build -d

# Verify all 7 containers are healthy
make ps
```

Wait until all services show `(healthy)`, then:

```bash
# Check health endpoints
curl -s localhost:8080/health   # Flight Service
curl -s localhost:3000/health   # Turnaround Service
curl -s localhost:8000/health   # Crew Service
curl -s localhost:8001/health   # Ops Hub Service
```

### Seed Data and Run the Event Cascade

```bash
# 1. Seed flights
make seed

# 2. Create crew members with certifications and shifts
# (See "Full E2E Test" section below)

# 3. Mark a flight as arrived — triggers the full cascade
FLIGHT_ID=$(curl -s localhost:8080/api/flights | jq -r '.[0].id')
curl -s -X PATCH "localhost:8080/api/flights/$FLIGHT_ID" \
  -H "Content-Type: application/json" \
  -d '{"status":"arrived","actual_arrival":"2026-02-19T14:35:00Z"}'

# 4. Watch events cascade
sleep 3
curl -s localhost:3000/api/turnarounds | jq '.[0].tasks | length'  # → 7 tasks (A380)
curl -s localhost:8000/api/assignments | jq 'length'                # → 5+ assignments
curl -s "localhost:8001/api/events?limit=10" | jq '.[].event_type'  # → all events logged
```

### Full E2E Test

```bash
# Seed 6 crew members with certifications and shifts
for i in {1..6}; do
  curl -s -X POST localhost:8000/api/crew -H "Content-Type: application/json" \
    -d "{\"employee_id\":\"GH-100$i\",\"first_name\":\"Crew$i\",\"last_name\":\"Member\"}"
done

# Add certifications (fueling, catering, cleaning, cargo, boarding)
# Add shifts for today
# Then trigger a flight arrival and watch the cascade

# See scripts/test-flow.sh for the flight service flow test
make test-flow
```

### Useful Commands

```bash
make help          # Show all commands
make logs          # Tail logs for all services
make logs-crew-service   # Tail a specific service
make rabbitmq-ui   # Open RabbitMQ management (guest/guest)
make clean         # Stop everything and delete data
make rebuild       # Full rebuild
```

### Service Ports

| Service | URL | Notes |
|---------|-----|-------|
| Flight Service | http://localhost:8080 | REST API + health |
| Turnaround Service | http://localhost:3000 | REST API + health |
| Crew Service | http://localhost:8000 | REST API + health |
| Ops Hub Service | http://localhost:8001 | REST API + alerts + event log |
| RabbitMQ Management | http://localhost:15672 | Login: guest / guest |
| PostgreSQL | localhost:5432 | User: postgres / postgres |
| MongoDB | localhost:27017 | No auth |

---

## API Reference

### Flight Service (Go) — :8080

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/api/flights` | Schedule a new flight |
| GET | `/api/flights` | List flights (`?limit=&offset=`) |
| GET | `/api/flights/:id` | Get flight by ID |
| PATCH | `/api/flights/:id` | Update flight (status, actual times, gate) |
| GET | `/api/flights/arrivals/upcoming` | Upcoming arrivals (`?within=30m`) |

### Turnaround Service (NestJS) — :3000

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/api/turnarounds` | Create turnaround |
| GET | `/api/turnarounds` | List turnarounds (`?status=&limit=&offset=`) |
| GET | `/api/turnarounds/:id` | Get turnaround with embedded tasks |
| PATCH | `/api/turnarounds/:id/tasks/:taskId` | Update task status/notes/crew |

### Crew Service (FastAPI) — :8000

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/api/crew` | Create crew member |
| GET | `/api/crew` | List crew (`?team_id=&is_active=&limit=&offset=`) |
| GET | `/api/crew/:id` | Get crew member with certifications |
| PATCH | `/api/crew/:id` | Update crew member |
| POST | `/api/crew/:id/certifications` | Add certification |
| GET | `/api/crew/:id/certifications` | List certifications |
| POST | `/api/crew/:id/shifts` | Create shift |
| GET | `/api/crew/:id/shifts` | List shifts (`?date=`) |
| GET | `/api/crew/available` | Find available crew (`?certification=`) |
| GET | `/api/assignments` | List task assignments |

### Ops Hub Service (Rust) — :8001

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/api/alerts` | Create alert |
| GET | `/api/alerts` | List alerts (`?status=&severity=&limit=&offset=`) |
| GET | `/api/alerts/:id` | Get alert by ID |
| PATCH | `/api/alerts/:id` | Update alert status |
| GET | `/api/events` | Event audit log (`?event_type=&source_service=&limit=&offset=`) |

---

## Project Structure

```
microservice-practice/
├── docker-compose.yml          # All 7 containers orchestrated
├── Makefile                    # Developer convenience commands
├── docs/
│   ├── hld.md                  # High-level design with Mermaid diagrams
│   └── adr/
│       ├── 001-monorepo-structure.md
│       └── 002-message-broker-choice.md
├── scripts/
│   ├── init-db.sh              # Creates flight_db, crew_db, ops_db
│   ├── seed-data.sh            # Seeds sample flights
│   └── test-flow.sh            # E2E flight service test
└── services/
    ├── flight-service/         # Go (chi + sqlx + slog)
    ├── turnaround-service/     # TypeScript (NestJS + Mongoose)
    ├── crew-service/           # Python (FastAPI + SQLAlchemy + aio-pika)
    └── ops-hub-service/        # Rust (axum + sqlx + lapin + tokio-cron)
```

---

## Design Thinking & Trade-offs

### What This Project Demonstrates

1. **Database-per-service**: Each service owns its database and schema. No shared tables. Cross-service references are by ID only.
2. **Event-driven eventual consistency**: Services don't call each other synchronously. State propagates through domain events with idempotent consumers.
3. **Idempotent event handling**: Every consumer handles duplicate messages gracefully (turnaround deduplication by flightId, assignment deduplication by turnaround+task).
4. **Polyglot persistence**: PostgreSQL where relations matter, MongoDB where document shape matters. The choice is driven by access patterns, not resume keywords.
5. **Infrastructure as code**: Single `docker-compose.yml` with health checks, dependency ordering, and environment configuration.
6. **Graceful degradation**: Each service starts independently. If RabbitMQ is down, services still respond to HTTP requests — just events don't flow.

### What This Project Does NOT Do

- **No API gateway**: Services are accessed directly. A real system would have Kong/Envoy/Traefik in front.
- **No authentication**: No JWT, no OAuth, no API keys. Focus is on service architecture, not auth.
- **No CI/CD pipeline**: No GitHub Actions, no deployment. This is a local development project.
- **No container orchestration**: Docker Compose only. No Kubernetes, no Helm charts.
- **No observability stack**: No Prometheus, Grafana, Jaeger. Structured JSON logs are the only observability mechanism.
- **No unit tests**: Test coverage is minimal. The focus was on integration-level verification via the event cascade.

These are all things you could add. See [Contributing](#contributing).

---

## Architecture Decision Records

Detailed reasoning for key decisions lives in `docs/adr/`:

- [ADR-001: Monorepo Structure](docs/adr/001-monorepo-structure.md) — Why all 4 services live in one repo
- [ADR-002: Message Broker Choice](docs/adr/002-message-broker-choice.md) — Why RabbitMQ over Kafka or Redis Streams

---

## Built With AI

This project was built entirely through **AI-assisted vibe coding** with [Claude Code](https://claude.ai/claude-code) (Anthropic's CLI coding agent). Every service, every Dockerfile, every database migration, and every event consumer was designed and implemented collaboratively between a human developer and Claude.

### What "Vibe Coding" Means Here

- The human provides the domain vision, architectural direction, and quality bar
- Claude designs the implementation plan, writes the code, debugs issues, and runs integration tests
- Iteration happens conversationally — "this broke, fix it", "add the Ops Hub service", "check the event cascade"
- The human reviews, approves plans, and steers direction; Claude handles the code volume

### What We Learned

- AI coding agents excel at **polyglot projects** — switching between Go, TypeScript, Python, and Rust in a single session
- **Plan-then-implement** works well: design the architecture first, get human approval, then execute
- The agent catches its own mistakes during integration testing and iterates (e.g., fixing async/sync driver mismatches in Python, Rust version compatibility)
- Domain-driven design helps the AI stay focused — clear bounded contexts prevent scope creep
- **Gotchas accumulate**: the agent maintains a memory file of patterns and pitfalls discovered across sessions (e.g., "Alembic doesn't support asyncpg — rewrite URL to psycopg2")

---

## Contributing

This is a learning project, and contributions are welcome. Some ideas:

- **Add unit tests** to any service (Go: `go test`, NestJS: Jest, Python: pytest, Rust: `cargo test`)
- **Add an API gateway** (Traefik, Kong, or Nginx) in front of the services
- **Add OpenTelemetry** tracing across the event cascade
- **Add Prometheus metrics** and a Grafana dashboard
- **Implement dead-letter queues** for failed event processing
- **Add the Certification Expiry Check** scheduler job (documented in HLD but not yet implemented)
- **Build a simple frontend** dashboard showing turnaround progress
- **Add integration tests** that verify the full event cascade programmatically
- **Improve the seed scripts** to create a complete E2E scenario with crew

If you're also experimenting with AI-assisted development, feel free to fork this and try building on it with your own AI tools. PRs with clear descriptions of what changed and why are appreciated.

---

## License

This is a personal learning project. Use it however you like.
