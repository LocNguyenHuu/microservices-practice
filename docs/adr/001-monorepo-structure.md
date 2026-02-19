# ADR-001: Monorepo Structure

## Status
Accepted

## Context
SkyTurn is built as 4 microservices in 4 different languages (Go, TypeScript, Python, Rust). We need to decide whether to use a monorepo (all services in one repository) or a polyrepo (one repository per service).

## Decision
We will use a **monorepo** with each service in its own directory under `services/`.

```
microservice-practice/
├── services/
│   ├── flight-service/        (Go)
│   ├── turnaround-service/    (TypeScript)
│   ├── crew-service/          (Python)
│   └── ops-hub-service/       (Rust)
├── docs/
├── scripts/
└── docker-compose.yml
```

## Consequences

### Positive
- Single `docker-compose.yml` orchestrates everything — easy to spin up the full system locally
- Shared documentation, ADRs, and architecture diagrams live alongside code
- Atomic commits across services when changing shared contracts (e.g., event schemas)
- Simpler CI/CD — one pipeline definition with per-service jobs
- Easier onboarding — clone once, see everything

### Negative
- Repository size will grow as services are added (mitigated: 4 services is manageable)
- Language-specific tooling (go.mod, package.json, Cargo.toml) must be scoped per service directory
- CI must detect which services changed to avoid rebuilding everything on every commit

### Risks
- If the project scaled to 20+ services, a polyrepo or build tool like Bazel would be more appropriate
- For this POC scope (4 services), a monorepo is the pragmatic choice
