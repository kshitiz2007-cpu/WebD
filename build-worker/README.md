# WebD Android Build Worker (Phase 2)

This worker runs real Gradle `assembleDebug` builds and returns the APK. It is a separate service from the Next.js frontend.

## Deploy

Deploy `build-worker/` as a Docker service (Railway, Render, or a private container host). Do not deploy it as a serverless function.

Set worker environment variables:
- `ANDROID_BUILD_TOKEN`: long random secret (at least 32 characters)
- `BUILD_TIMEOUT_SECONDS`: optional, defaults to 240

Set WebD frontend environment variables:
- `ANDROID_BUILD_SERVICE_URL`: private worker base URL (no trailing slash)
- `ANDROID_BUILD_SERVICE_TOKEN`: same secret as the worker token

The worker listens on port 8080. Health check: `GET /health`.

## Security / resource guidance

Gradle project scripts are executable code, so only expose the worker through a private network or authenticated proxy. Use a dedicated container with no production credentials, non-root execution, strict CPU/memory/disk limits, a build timeout, and egress restrictions where possible. Do not run builds on the frontend/serverless host. The bearer token is not passed to Gradle subprocesses.

## API

Frontend calls `POST /api/android/build` with `{ "files": { "relative/path": "text" } }`. The proxy forwards to the worker. On success, the UI downloads `app-debug.apk`; on failure it displays Gradle logs.

Limits: up to 1,200 files and 8 MB source payload. The worker build timeout defaults to 240 seconds.
