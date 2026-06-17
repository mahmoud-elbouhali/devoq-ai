# Devoq AI

**A Microservice-Based Software Platform for Real-Time Object Counting**

Built as a modern microservice architecture with Vue.js frontend, an Express.js orchestration backend, and a dedicated AI counting microservice, fully containerized with Docker.

---

## Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Frontend   | Vue 3, Vite, Tailwind CSS 4, Pinia |
| Backend    | Node.js, Express, TypeScript        |
| AI Service | Python, FastAPI, Pillow, NumPy      |
| Infra      | Docker, Traefik, Nginx              |
| Testing    | Vitest                              |

## Architecture

```
devoq-ai/
├── ai-service/       # AI counting microservice (FastAPI)
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
# Start the development environment with the real YOLOX ONNX detector
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
| `/api/health` | GET    | Backend health check |
| `/api/v1/info`| GET    | Engine info and capabilities |
| `/api/v1/count` | POST | Count objects from an image |

## Current Counting Strategy

The default development stack now runs the real `yolox_onnx` detector path through the AI microservice.

The repository also still includes a simpler baseline detector intended for stable top-down views with dark objects on a light background. It performs:

- image decoding from data URL
- grayscale thresholding
- simple morphology
- connected-component counting

This baseline remains available as a fallback and troubleshooting path, but it is no longer the main development default.

## YOLOX Integration Path

The AI microservice now supports two detector modes selected with `AI_DETECTOR_MODE`:

- `yolox_onnx`: ONNX Runtime inference for a trained or mounted YOLOX model
- `baseline`: connected-components fallback for simple controlled scenes

For `yolox_onnx`, provide at least:

- `AI_YOLOX_MODEL_PATH=/models/yolox.onnx`
- `AI_MODEL_VERSION=yolox-screws-v1` or the version name of the mounted runtime model
- `AI_YOLOX_CLASS_NAMES=screw`
- `AI_YOLOX_TARGET_CLASSES=screw`

The frontend and backend do not need API changes when switching from `baseline` to `yolox_onnx`.

## License

MIT
