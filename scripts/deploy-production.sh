#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
BRANCH="${BRANCH:-main}"

cd "$APP_DIR"

if ! command -v docker >/dev/null 2>&1; then
  if ! command -v apt-get >/dev/null 2>&1; then
    echo "Docker is not installed, and this script only auto-installs Docker on apt-based servers." >&2
    exit 1
  fi

  sudo apt-get update
  sudo apt-get install -y ca-certificates curl gnupg
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo systemctl enable --now docker
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose plugin is not available." >&2
  exit 1
fi

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example. Update production secrets before exposing this service publicly." >&2
fi

if grep -q '^REDIS_URL=' .env; then
  sed -i 's#^REDIS_URL=.*#REDIS_URL=redis://redis:6379#' .env
else
  printf '\nREDIS_URL=redis://redis:6379\n' >> .env
fi

docker compose pull redis
docker compose up --build -d
docker compose ps
docker compose logs --tail=80 backend
