.PHONY: help dev prod build stop logs ps health clean clean-all

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

dev: ## Start development environment
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build

prod: ## Start production environment (local)
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

build: ## Build Docker images (dev)
	docker compose -f docker-compose.yml -f docker-compose.dev.yml build

stop: ## Stop all containers
	docker compose -f docker-compose.yml -f docker-compose.dev.yml down 2>/dev/null || true
	docker compose -f docker-compose.yml -f docker-compose.prod.yml down 2>/dev/null || true

logs: ## Show logs (follow mode)
	docker compose logs -f

ps: ## Show container status
	docker compose ps

health: ## Check container health
	@docker inspect devoq-ai-backend --format='Backend: {{.State.Health.Status}}' 2>/dev/null || echo "Backend: not running"
	@docker inspect devoq-ai-frontend --format='Frontend: {{.State.Health.Status}}' 2>/dev/null || echo "Frontend: not running"

clean: ## Stop and remove volumes
	docker compose down -v

clean-all: ## Stop, remove volumes and images
	docker compose down -v
	docker rmi devoq-ai-backend devoq-ai-frontend 2>/dev/null || true
