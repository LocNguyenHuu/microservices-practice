# Multi-stage build for the Crew Service.
# Stage 1: Install Python dependencies into a prefix directory.
# Stage 2: Copy dependencies + application code, run as non-root user.

# --- Stage 1: Dependencies ---
FROM python:3.12-slim AS builder

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# --- Stage 2: Runtime ---
FROM python:3.12-slim

# Install wget for Docker healthcheck and psycopg2 dependencies for Alembic
RUN apt-get update && \
    apt-get install -y --no-install-recommends wget libpq5 && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r crew && useradd -r -g crew crew

WORKDIR /app

# Copy installed dependencies from builder
COPY --from=builder /install /usr/local

# Copy application code
COPY . .

USER crew
EXPOSE 8000

CMD ["python", "run_migrations.py"]
