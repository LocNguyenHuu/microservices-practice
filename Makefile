.PHONY: up down rebuild logs ps test-flight test-turnaround test-crew test-ops-hub seed test-flow help clean rabbitmq-ui

help: ## Show available commands
	@echo "SkyTurn — Airport Turnaround Operations Platform"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

up: ## Start all services
	docker compose up --build -d

down: ## Stop all services
	docker compose down

rebuild: ## Rebuild and restart all services
	docker compose down && docker compose up --build -d

clean: ## Stop services and remove all data volumes
	docker compose down -v

logs: ## Show logs for all services
	docker compose logs -f

logs-%: ## Show logs for a specific service (e.g. make logs-flight-service)
	docker compose logs -f $*

ps: ## Show running containers
	docker compose ps

test-flight: ## Run flight-service unit tests
	cd services/flight-service && go test ./...

test-turnaround: ## Run turnaround-service unit tests
	cd services/turnaround-service && npm test

test-crew: ## Run crew-service unit tests
	cd services/crew-service && python -m pytest

test-ops-hub: ## Run ops-hub-service unit tests
	cd services/ops-hub-service && cargo test

seed: ## Seed test flight data
	./scripts/seed-data.sh

test-flow: ## Run end-to-end flow test
	./scripts/test-flow.sh

rabbitmq-ui: ## Open RabbitMQ management UI
	open http://localhost:15672
