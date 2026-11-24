# WebD Independent Android Builder (VPS + Docker)

This removes the GitHub Actions build runner dependency. The WebD frontend remains hosted wherever you currently host it; APK compilation runs on a dedicated Linux VPS in Docker.

## Requirements
- Ubuntu 22.04/24.04 VPS
- Recommended: 4 vCPU, 8 GB RAM, 40+ GB disk (4 GB RAM is a minimum)
- Docker Engine and Docker Compose plugin

## Install on VPS
```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2
sudo systemctl enable --now docker
sudo mkdir -p /opt/webd-builder
```

Copy/clone the WebD repo to the VPS, then from the repository folder:

```bash
cp .env.builder.example .env
nano .env
docker compose up -d --build
docker compose logs -f
```

Set a long random secret in `.env`:
- `ANDROID_BUILD_TOKEN`: same token configured on WebD hosting as `ANDROID_BUILD_SERVICE_TOKEN`
- `WEBD_BUILDER_PORT`: default 8080
- `BUILDER_MEMORY_LIMIT`: default 6g
- `BUILDER_CPUS`: default 4
- `BUILD_TIMEOUT_SECONDS`: default 900

## WebD frontend host environment
Set these environment variables on the WebD frontend deployment:
- `ANDROID_BUILD_SERVICE_URL`: `http://VPS_PUBLIC_IP:8080` (use HTTPS via reverse proxy for production)
- `ANDROID_BUILD_SERVICE_TOKEN`: the same token as builder `ANDROID_BUILD_TOKEN`

Redeploy the frontend after changing env variables.

## Security before public use
Do not expose port 8080 to the public internet without TLS and firewall controls. Prefer a reverse proxy (Caddy/Nginx) with HTTPS and restrict builder access to the frontend host where practical. Keep the build token secret. The worker accepts project source files and runs Gradle; do not give it untrusted shell access. Docker resource limits and build timeout are configured.

## Operations
```bash
docker compose ps
docker compose logs -f webd-android-builder
docker compose restart webd-android-builder
docker compose pull
docker compose up -d --build
```
