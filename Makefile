.PHONY: help dev dev-yolox prod build stop logs ps health clean clean-all

COMPOSE_DEV  := docker compose -f docker-compose.yml -f docker-compose.dev.yml
COMPOSE_DEV_YOLOX := docker compose -f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.yolox.dev.yml
COMPOSE_PROD := docker compose -f docker-compose.yml -f docker-compose.prod.yml

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

dev: ## Start development environment
	$(COMPOSE_DEV) up -d --build

dev-yolox: ## Start development environment with YOLOX ONNX enabled
	$(COMPOSE_DEV_YOLOX) up -d --build

prod: ## Start production environment (local)
	$(COMPOSE_PROD) up -d --build

build: ## Build Docker images (dev)
	$(COMPOSE_DEV) build

stop: ## Stop all containers
	$(COMPOSE_DEV) down 2>/dev/null || true
	$(COMPOSE_PROD) down 2>/dev/null || true

logs: ## Show logs (follow mode)
	$(COMPOSE_DEV) logs -f

ps: ## Show container status
	$(COMPOSE_DEV) ps

health: ## Check container health
	@docker inspect devoq-ai-backend --format='Backend: {{.State.Health.Status}}' 2>/dev/null || echo "Backend: not running"
	@docker inspect devoq-ai-frontend --format='Frontend: {{.State.Health.Status}}' 2>/dev/null || echo "Frontend: not running"
	@docker inspect devoq-ai-ai-service --format='AI service: {{.State.Health.Status}}' 2>/dev/null || echo "AI service: not running"

clean: ## Stop and remove volumes
	$(COMPOSE_DEV) down -v

clean-all: ## Stop, remove volumes and images
	$(COMPOSE_DEV) down -v
	docker rmi devoq-ai-backend devoq-ai-frontend 2>/dev/null || true
