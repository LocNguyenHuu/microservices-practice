# ADR-002: Message Broker Choice — RabbitMQ

## Status
Accepted

## Context
SkyTurn services need asynchronous event-driven communication for domain events (flight.arrived, turnaround.started, crew.assigned, etc.). Events cascade across bounded contexts — a flight arrival triggers turnaround creation, which triggers crew dispatch. We evaluated three options:

1. **RabbitMQ** with topic exchanges
2. **Apache Kafka** with topics and consumer groups
3. **Redis Streams** with consumer groups

## Decision
We will use **RabbitMQ 3.x** with topic exchanges for all inter-service messaging.

### Why RabbitMQ over Kafka
- SkyTurn processes ~100–500 flights/day, not millions of events/sec — RabbitMQ's throughput is sufficient
- Topic exchanges provide flexible routing (`flight.arrived`, `flight.#`, `turnaround.*`) that maps naturally to our domain events
- Simpler operational model: no ZooKeeper/KRaft, no partition rebalancing
- Built-in management UI (port 15672) for debugging during development
- Per-message acknowledgment gives fine-grained delivery guarantees (vs. offset-based commits in Kafka)

### Why RabbitMQ over Redis Streams
- RabbitMQ provides durable queues with dead-letter exchanges out of the box
- Topic exchange routing is more expressive than Redis Stream consumer groups
- Mature client libraries for all four service languages (Go: amqp091-go, TypeScript: @golevelup/nestjs-rabbitmq, Python: pika, Rust: lapin)

## Consequences

### Positive
- Topic exchanges allow services to selectively subscribe (e.g., turnaround service binds to `flight.arrived` + `flight.gate.changed` only, while Ops Hub uses `flight.#` wildcard)
- Persistent delivery mode ensures messages survive broker restarts
- Management UI aids debugging, monitoring queue depths, and tracing message flow
- Exchange/queue topology is declarative — services declare what they need on startup (idempotent)

### Negative
- Additional infrastructure component to operate (mitigated: single-node Docker container is sufficient for this project)
- Messages are consumed and removed — no replay capability. If we later need event sourcing or replay, we would add a separate event store
- No built-in schema registry — message format consistency relies on convention (shared event envelope documented in HLD)

### Risks
- If message volume grew to >50,000 msgs/sec, we would need to evaluate Kafka for throughput
- For this scope (4 services, <1,000 events/day), RabbitMQ is the pragmatic choice
