# WebD Self-hosted Android Build Engine

Dockerized Android/Gradle build API for WebD, hosted on your own Ubuntu VPS. Compatible with the WebD `/api/android/build` proxy.

## Requirements
- Ubuntu 22.04/24.04 x86_64
- Recommended: 4+ vCPU, 8 GB RAM, 30+ GB disk
- Docker Engine + Compose plugin
- VPS public IP; firewall should restrict port 8080 to WebD's host if possible

## Install
```bash
sudo apt update && sudo apt install -y git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# log out and log back in, then:
git clone https://github.com/kshitiz2007-cpu/WebD.git
cd WebD/android-build-server
cp .env.example .env
nano .env # set a long random token
docker compose up -d --build
```
Health check: `http://YOUR_VPS_IP:8080/health`.

## Connect WebD
On the WebD web service, set:
- `ANDROID_BUILD_SERVICE_URL` = `http://YOUR_VPS_IP:8080` (prefer HTTPS/reverse proxy for production)
- `ANDROID_BUILD_SERVICE_TOKEN` = same token as `android-build-server/.env`
Then redeploy WebD. Project source files are uploaded to this VPS, Gradle runs there, and the APK is returned to WebD.

## Security notes
- Don't expose port 8080 to the whole internet without an HTTPS proxy and firewall policy.
- Keep `.env` private and use a long random token.
- Gradle build scripts execute arbitrary code; do not build untrusted projects on a VPS with secrets.
- Current prototype keeps job state and APK base64 in RAM. Restart loses jobs/results. It is intended for a single VPS, not a multi-tenant public build service.
