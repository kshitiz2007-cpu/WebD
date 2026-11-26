# WebD Android Emulator Worker

This is a separate Docker service for real Android APK execution. It installs an APK into an Android Emulator (API 35), provides a VNC screen through WebSocket/noVNC, and exposes snapshot Logcat.

## Deploy separately
Deploy `emulator-worker/` as a Docker service on a host that can run the Android Emulator. Software rendering is configured (`-accel off`); without KVM this may be very slow. Expect a large image and substantial memory/CPU use. Use a host with at least 4 vCPU and 8 GB RAM; 16 GB is recommended. Do not use serverless functions.

Environment variables:
- `ANDROID_EMULATOR_TOKEN`: random secret, 32+ bytes
- `AVD_NAME`: defaults to `WebD_API_35`
- `SESSION_TTL_SECONDS`: defaults to 3600

The service listens on 8080. Expose HTTP/WebSocket on the same public service domain; WebSocket upgrade must be supported. Worker routes are token protected. The VNC stream endpoint requires an expiring session token.

## Frontend environment
Configure on the Next.js service:
- `ANDROID_EMULATOR_SERVICE_URL`: emulator worker base URL (no trailing slash)
- `ANDROID_EMULATOR_SERVICE_TOKEN`: same token as worker
- `NEXT_PUBLIC_ANDROID_EMULATOR_STREAM_URL`: worker public base URL, e.g. `wss://your-emulator-worker.example` (the component appends `/ws/vnc`)

Redeploy the frontend after adding environment variables.

## Runtime behavior
- `POST /start`: accepts base64 APK, boots AVD if needed, installs and launches the app; returns session token.
- `GET /logcat`: returns a recent Logcat snapshot.
- `POST /input`: accepts tap/swipe/text/key input actions.
- `POST /stop`: shuts down the shared emulator and invalidates sessions.
- `WS /ws/vnc?session=...`: interactive VNC websocket bridge for the session.

## Security and limitations
This is a single shared emulator process (not isolated per user); do not expose it to anonymous users in a public production app. Add user authentication, queueing, per-user session isolation, quotas, cleanup, and worker hardening before public use. Emulator software rendering is not guaranteed to perform well on Railway or hosts without virtualization support. Gradle APKs and app code are untrusted; run worker in a disposable isolated container without credentials.
