#!/usr/bin/env bash
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | bash
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose plugin is missing. Install docker-compose-plugin and run again."
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.production.example .env
  echo "Created .env from .env.production.example. Edit .env first, then rerun this script."
  exit 1
fi

docker compose up -d --build
docker compose ps
