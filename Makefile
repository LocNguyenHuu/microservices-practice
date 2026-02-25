.PHONY: up down rebuild logs ps test-flight test-turnaround test-crew test-ops-hub seed test-flow help clean rabbitmq-ui up-core up-flight up-ops demo

help: ## Show available commands
	@echo "SkyTurn — Airport Turnaround Operations Platform"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ── Startup Profiles ──────────────────────────────────────────────

up: ## Start all services (full stack)
	docker compose --profile full up --build -d

up-core: ## Start infrastructure only (Postgres, RabbitMQ, MongoDB)
	docker compose --profile core up --build -d

up-flight: ## Start infra + Flight Service
	docker compose --profile flight up --build -d

up-ops: ## Start core operational services (no dashboard/ingestion)
	docker compose --profile ops up --build -d

demo: ## Full stack + seed data + open dashboard
	docker compose --profile full up --build -d
	@echo "Waiting for services to be healthy..."
	@sleep 15
	./scripts/seed-data.sh
	@echo "Opening dashboard..."
	open http://localhost:5173

# ── Lifecycle ─────────────────────────────────────────────────────

down: ## Stop all services
	docker compose --profile full down

rebuild: ## Rebuild and restart all services
	docker compose --profile full down && docker compose --profile full up --build -d

clean: ## Stop services and remove all data volumes
	docker compose --profile full down -v

# ── Logs & Status ─────────────────────────────────────────────────

logs: ## Show logs for all services
	docker compose logs -f

logs-%: ## Show logs for a specific service (e.g. make logs-flight-service)
	docker compose logs -f $*

ps: ## Show running containers
	docker compose ps

stats: ## Show container resource usage
	docker stats --no-stream

# ── Testing ───────────────────────────────────────────────────────

test-flight: ## Run flight-service unit tests
	cd services/flight-service && go test ./...

test-turnaround: ## Run turnaround-service unit tests
	cd services/turnaround-service && npm test

test-crew: ## Run crew-service unit tests
	cd services/crew-service && python -m pytest

test-ops-hub: ## Run ops-hub-service unit tests
	cd services/ops-hub-service && cargo test

# ── Data & Tools ──────────────────────────────────────────────────

seed: ## Seed test flight data
	./scripts/seed-data.sh

test-flow: ## Run end-to-end flow test
	./scripts/test-flow.sh

rabbitmq-ui: ## Open RabbitMQ management UI
	open http://localhost:15672

dashboard: ## Open the Ops Dashboard
	open http://localhost:5173

ingest: ## Trigger a manual data ingestion
	curl -s -X POST http://localhost:8002/api/ingest/trigger | python3 -m json.tool
