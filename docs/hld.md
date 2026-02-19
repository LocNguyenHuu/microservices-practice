# High-Level Design — SkyTurn Airport Turnaround Operations

## System Overview

```mermaid
graph TB
    Client[External Clients / ATC Systems]

    subgraph Services
        FS[Flight Service<br/>Go / chi]
        TS[Turnaround Service<br/>TypeScript / NestJS]
        CS[Crew Service<br/>Python / FastAPI]
        OH[Ops Hub Service<br/>Rust / axum]
    end

    subgraph Message Broker
        RMQ[RabbitMQ]
    end

    subgraph Data Stores
        PG1[(PostgreSQL<br/>flight_db)]
        MDB[(MongoDB<br/>turnaround_db)]
        PG2[(PostgreSQL<br/>crew_db)]
        PG3[(PostgreSQL<br/>ops_db)]
    end

    Client -->|REST| FS
    Client -->|REST| TS
    Client -->|REST| CS
    Client -->|REST| OH

    FS -->|publish events| RMQ
    TS -->|publish events| RMQ
    CS -->|publish events| RMQ
    RMQ -->|consume events| TS
    RMQ -->|consume events| CS
    RMQ -->|consume events| OH

    OH -->|HTTP poll| FS
    OH -->|HTTP poll| TS
    OH -->|HTTP poll| CS

    FS --- PG1
    TS --- MDB
    CS --- PG2
    OH --- PG3
```

## Primary Event Flow: Flight Arrival → Turnaround

```mermaid
sequenceDiagram
    participant C as Client / ATC
    participant FS as Flight Service
    participant RMQ as RabbitMQ
    participant TS as Turnaround Service
    participant CS as Crew Service
    participant OH as Ops Hub

    C->>FS: PATCH /api/flights/:id {status: arrived}
    FS->>FS: Save to PostgreSQL
    FS->>RMQ: Publish flight.arrived

    par Parallel consumers
        RMQ->>TS: Consume flight.arrived
        TS->>TS: Create turnaround in MongoDB (tasks from aircraft template)
        TS->>RMQ: Publish turnaround.started

        RMQ->>CS: Consume flight.arrived
        CS->>CS: Pre-allocate available crew
    and
        RMQ->>OH: Consume flight.arrived
        OH->>OH: Log event, init metrics
    end

    RMQ->>CS: Consume turnaround.started
    CS->>CS: Assign crew to tasks
    CS->>RMQ: Publish crew.assigned

    RMQ->>TS: Consume crew.assigned
    TS->>TS: Update task with assigned crew ID

    Note over C,OH: Ground crew performs physical tasks...

    C->>TS: PATCH /api/turnarounds/:id/tasks/:taskId {status: completed}
    TS->>TS: Update task, recalculate progress
    TS->>RMQ: Publish turnaround.task.completed

    RMQ->>CS: Free crew member
    RMQ->>OH: Update metrics
```

## RabbitMQ Exchange Design

```mermaid
graph LR
    subgraph Exchanges
        FE[flight.events<br/>topic exchange]
        TE[turnaround.events<br/>topic exchange]
        CE[crew.events<br/>topic exchange]
        OE[ops.events<br/>topic exchange]
    end

    subgraph Queues
        TFQ[turnaround-flight-queue]
        CFQ[crew-flight-queue]
        CTQ[crew-turnaround-queue]
        TCQ[turnaround-crew-queue]
        OHQ[ops-hub-all-queue]
    end

    FE -->|flight.arrived| TFQ
    FE -->|flight.gate.changed| TFQ
    FE -->|flight.arrived| CFQ
    TE -->|turnaround.started| CTQ
    TE -->|turnaround.task.completed| CTQ
    CE -->|crew.assigned| TCQ
    CE -->|crew.unavailable| TCQ
    FE -->|flight.#| OHQ
    TE -->|turnaround.#| OHQ
    CE -->|crew.#| OHQ
```

## Scheduler Jobs (Ops Hub)

| Job | Interval | Description |
|---|---|---|
| Turnaround Delay Detector | 2 min | Check in-progress turnarounds: if progress < 50% at > 75% elapsed time → alert |
| Stuck Task Scanner | 3 min | Find tasks in_progress beyond expected duration → alert |
| Upcoming Arrival Pre-check | 5 min | Check flights arriving within 30 min vs available certified crew → alert |
| Certification Expiry Check | Daily 06:00 | Find certifications expiring within 7 days → publish event |

## Service Ports

| Service | Port | Health Endpoint |
|---|---|---|
| Flight Service | 8080 | GET /health |
| Turnaround Service | 3000 | GET /health |
| Crew Service | 8000 | GET /health |
| Ops Hub Service | 8001 | GET /health |
| RabbitMQ Management | 15672 | — |
| PostgreSQL | 5432 | — |
| MongoDB | 27017 | — |
