# Multi-stage Rust build for the Ops Hub Service.
# Stage 1: Cache dependency compilation with dummy main.rs.
# Stage 2: Build real application code.
# Stage 3: Minimal runtime image with non-root user.

# --- Stage 1: Dependency cache ---
FROM rust:1.88-slim AS builder

RUN apt-get update && \
    apt-get install -y pkg-config libssl-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY Cargo.toml Cargo.lock* ./

# Dummy main.rs to compile only dependencies (cached layer)
RUN mkdir src && echo "fn main() {}" > src/main.rs && \
    cargo build --release && \
    rm -rf src

# --- Stage 2: Build application ---
COPY src/ src/
COPY migrations/ migrations/
RUN touch src/main.rs && cargo build --release

# --- Stage 3: Runtime ---
FROM debian:bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates wget libssl3 && \
    rm -rf /var/lib/apt/lists/*

RUN groupadd -r opshub && useradd -r -g opshub opshub

WORKDIR /app
COPY --from=builder /app/target/release/ops-hub-service .
COPY --from=builder /app/migrations/ ./migrations/

USER opshub
EXPOSE 8001

CMD ["./ops-hub-service"]
