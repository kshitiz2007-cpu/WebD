from fastapi import FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import os, subprocess, base64, pathlib, time, asyncio, shutil, secrets

app = FastAPI(title="WebD Android Emulator Worker")
TOKEN = os.environ.get("ANDROID_EMULATOR_TOKEN", "")
ADB = os.environ.get("ADB", "/opt/android-sdk/platform-tools/adb")
EMULATOR = os.environ.get("EMULATOR", "/opt/android-sdk/emulator/emulator")
AVD = os.environ.get("AVD_NAME", "WebD_API_35")
VNC_PORT = 5900
SESSION_DIR = pathlib.Path("/tmp/webd-emulator")
APK_PATH = SESSION_DIR / "session.apk"
MAX_APK_BYTES = 180 * 1024 * 1024
SESSION_TTL = int(os.environ.get("SESSION_TTL_SECONDS", "3600"))
SESSIONS: dict[str, float] = {}

def auth(token: str | None):
    if not TOKEN or token != TOKEN:
        raise HTTPException(401, "Unauthorized")

def session_auth(session: str | None):
    expiry = SESSIONS.get(session or "")
    if not expiry or expiry < time.time():
        SESSIONS.pop(session or "", None)
        raise HTTPException(401, "Emulator session expired")

def run(args, timeout=60):
    p = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    return {"code": p.returncode, "stdout": p.stdout[-12000:], "stderr": p.stderr[-12000:]}

def adb(*args, timeout=60):
    return run([ADB, "-s", "emulator-5554", *args], timeout=timeout)

def emulator_ready():
    try:
        return adb("shell", "getprop", "sys.boot_completed", timeout=8)["stdout"].strip().endswith("1")
    except Exception:
        return False

@app.get("/health")
def health():
    return {"ok": True, "service": "webd-android-emulator", "emulatorRunning": emulator_ready()}

class StartRequest(BaseModel):
    apkBase64: str
    packageName: str = "com.webd.starter"

@app.post("/start")
def start(req: StartRequest, authorization: str | None = Header(default=None)):
    auth(authorization.removeprefix("Bearer ") if authorization else None)
    try:
        apk = base64.b64decode(req.apkBase64, validate=True)
    except Exception:
        raise HTTPException(400, "Invalid APK base64")
    if not apk or len(apk) > MAX_APK_BYTES:
        raise HTTPException(413, "APK missing or exceeds 180 MB limit")
    SESSION_DIR.mkdir(parents=True, exist_ok=True)
    APK_PATH.write_bytes(apk)
    if not emulator_ready():
        if not pathlib.Path(EMULATOR).exists():
            raise HTTPException(503, "Android Emulator binary missing")
        if not shutil.which("Xvfb") or not shutil.which("x11vnc"):
            raise HTTPException(503, "Display runtime missing")
        subprocess.Popen(["Xvfb", ":99", "-screen", "0", "1080x1920x24"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(2)
        subprocess.Popen(["x11vnc", "-display", ":99", "-rfbport", str(VNC_PORT), "-forever", "-shared", "-nopw"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        env = dict(os.environ, DISPLAY=":99")
        with open("/tmp/emulator.log", "a") as log:
            subprocess.Popen([EMULATOR, "-avd", AVD, "-no-window", "-no-audio", "-no-boot-anim", "-gpu", "swiftshader_indirect", "-accel", "off", "-camera-back", "none"], env=env, stdout=log, stderr=subprocess.STDOUT)
        deadline = time.time() + 240
        while time.time() < deadline:
            if emulator_ready():
                break
            time.sleep(3)
        if not emulator_ready():
            log = pathlib.Path("/tmp/emulator.log").read_text(errors="ignore")[-6000:]
            return JSONResponse(status_code=504, content={"ok": False, "error": "Emulator boot timed out", "log": log})
    install = adb("install", "-r", str(APK_PATH), timeout=180)
    if install["code"] != 0:
        return JSONResponse(status_code=500, content={"ok": False, "error": "APK install failed", "log": install})
    launch = adb("shell", "monkey", "-p", req.packageName, "-c", "android.intent.category.LAUNCHER", "1", timeout=30)
    session = secrets.token_urlsafe(24)
    SESSIONS[session] = time.time() + SESSION_TTL
    return {"ok": True, "install": install, "launch": launch, "sessionToken": session, "streamPath": "/ws/vnc"}

@app.get("/logcat")
def logcat(authorization: str | None = Header(default=None)):
    auth(authorization.removeprefix("Bearer ") if authorization else None)
    if not emulator_ready():
        raise HTTPException(409, "Emulator is not running")
    return adb("logcat", "-d", "-t", "400", timeout=20)

class InputRequest(BaseModel):
    action: str
    x: int = 0
    y: int = 0
    x2: int = 0
    y2: int = 0
    duration: int = 350
    text: str = ""
    keycode: int = 0

@app.post("/input")
def input_action(req: InputRequest, authorization: str | None = Header(default=None)):
    auth(authorization.removeprefix("Bearer ") if authorization else None)
    if not emulator_ready():
        raise HTTPException(409, "Emulator is not running")
    if req.action == "tap":
        args = ["shell", "input", "tap", str(req.x), str(req.y)]
    elif req.action == "swipe":
        args = ["shell", "input", "swipe", str(req.x), str(req.y), str(req.x2), str(req.y2), str(req.duration)]
    elif req.action == "text":
        args = ["shell", "input", "text", req.text[:500]]
    elif req.action == "key":
        args = ["shell", "input", "keyevent", str(req.keycode)]
    else:
        raise HTTPException(400, "Unsupported input action")
    return adb(*args, timeout=15)

@app.post("/stop")
def stop(authorization: str | None = Header(default=None)):
    auth(authorization.removeprefix("Bearer ") if authorization else None)
    result = adb("emu", "kill", timeout=15)
    SESSIONS.clear()
    return {"ok": True, "result": result}

@app.websocket("/ws/vnc")
async def vnc(websocket: WebSocket):
    session = websocket.query_params.get("session")
    if not session or SESSIONS.get(session, 0) < time.time():
        await websocket.close(code=1008)
        return
    await websocket.accept()
    try:
        import websockets
        async with websockets.connect("ws://127.0.0.1:6080", max_size=None) as upstream:
            async def client_to_vnc():
                while True:
                    msg = await websocket.receive()
                    if msg.get("type") == "websocket.disconnect":
                        break
                    if msg.get("bytes") is not None:
                        await upstream.send(msg["bytes"])
                    elif msg.get("text") is not None:
                        await upstream.send(msg["text"])
            async def vnc_to_client():
                async for msg in upstream:
                    if isinstance(msg, bytes):
                        await websocket.send_bytes(msg)
                    else:
                        await websocket.send_text(msg)
            tasks = [asyncio.create_task(client_to_vnc()), asyncio.create_task(vnc_to_client())]
            _, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
            for task in pending:
                task.cancel()
    except WebSocketDisconnect:
        pass
    except Exception:
        try:
            await websocket.close(code=1011)
        except Exception:
            pass
