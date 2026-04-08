# Devoq AI

**Intelligent AI-powered platform for smart automation and decision-making.**

Built as a modern microservice architecture with Vue.js frontend and Express.js backend, fully containerized with Docker.

---

## Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Frontend   | Vue 3, Vite, Tailwind CSS 4, Pinia |
| Backend    | Node.js, Express, TypeScript        |
| Infra      | Docker, Traefik, Nginx              |
| Testing    | Vitest                              |

## Architecture

```
devoq-ai/
├── backend/          # Express API (TypeScript)
├── frontend/         # Vue 3 SPA (Vite + Tailwind)
├── shared/           # Shared types & utilities
├── scripts/          # Build & deploy scripts
├── docker-compose.yml
├── docker-compose.dev.yml
└── docker-compose.prod.yml
```

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 20+
- [Traefik](https://traefik.io/) running on `apps_network`

### Development

```bash
# Start the development environment
make dev

# View logs
make logs

# Check service health
make health

# Stop services
make stop
```

### Production

```bash
# Build for production
./scripts/build.sh

# Deploy to VPS
./scripts/deploy.sh
```

## Available Commands

| Command         | Description                        |
|-----------------|------------------------------------|
| `make dev`      | Start development environment      |
| `make prod`     | Start production (local)           |
| `make build`    | Build Docker images                |
| `make stop`     | Stop all containers                |
| `make logs`     | Tail container logs                |
| `make health`   | Check container health status      |
| `make clean`    | Remove containers and volumes      |
| `make clean-all`| Remove containers, volumes & images|

## API

| Endpoint      | Method | Description        |
|---------------|--------|--------------------|
| `/health`     | GET    | Health check       |
| `/api/hello`  | GET    | Test endpoint      |

## License

MIT
