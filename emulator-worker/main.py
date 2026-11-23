from fastapi import FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import os, subprocess, tempfile, base64, pathlib, time, asyncio, shutil

app = FastAPI(title="WebD Android Emulator Worker")
TOKEN = os.environ.get("ANDROID_EMULATOR_TOKEN", "")
ADB = os.environ.get("ADB", "/opt/android-sdk/platform-tools/adb")
EMULATOR = os.environ.get("EMULATOR", "/opt/android-sdk/emulator/emulator")
VNC_PORT = 5900
SESSION_DIR = pathlib.Path("/tmp/webd-emulator")
APK_PATH = SESSION_DIR / "session.apk"
AVD = os.environ.get("AVD_NAME", "WebD_API_35")
MAX_APK_BYTES = 180 * 1024 * 1024

def auth(token: str | None):
    if not TOKEN or token != TOKEN:
        raise HTTPException(401, "Unauthorized")

def run(args, timeout=60):
    p = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    return {"code": p.returncode, "stdout": p.stdout[-12000:], "stderr": p.stderr[-12000:]}

def adb(*args, timeout=60):
    return run([ADB, "-s", "emulator-5554", *args], timeout=timeout)

def emulator_ready():
    try:
        return adb("shell", "getprop", "sys.boot_completed", timeout=10)["stdout"].strip().endswith("1")
    except Exception:
        return False

@app.get("/health")
def health():
    return {"ok": True, "service": "webd-emulator-worker", "emulatorRunning": emulator_ready()}

class StartRequest(BaseModel):
    apkBase64: str
    packageName: str = "com.webd.starter"
    activityName: str = ""

@app.post("/start")
def start(req: StartRequest, authorization: str | None = Header(default=None)):
    auth(authorization.removeprefix("Bearer ") if authorization else None)
    try:
        data = base64.b64decode(req.apkBase64, validate=True)
    except Exception:
        raise HTTPException(400, "APK is not valid base64")
    if not data or len(data) > MAX_APK_BYTES:
        raise HTTPException(413, "APK missing or exceeds 180 MB limit")
    SESSION_DIR.mkdir(parents=True, exist_ok=True)
    APK_PATH.write_bytes(data)
    if not emulator_ready():
        if not shutil.which("xvfb-run") or not pathlib.Path(EMULATOR).exists():
            raise HTTPException(503, "Emulator runtime is unavailable in this worker")
        subprocess.Popen(["bash", "-lc", f"x11vnc -display :99 -rfbport {VNC_PORT} -forever -shared -nopw >/tmp/vnc.log 2>&1 &"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        subprocess.Popen(["xvfb-run", "-a", "-s", "-screen 0 1080x1920x24", EMULATOR, "-avd", AVD, "-no-window", "-no-audio", "-no-boot-anim", "-gpu", "swiftshader_indirect", "-accel", "off", "-camera-back", "none"], stdout=open("/tmp/emulator.log","a"), stderr=subprocess.STDOUT)
        deadline=time.time()+240
        while time.time()<deadline:
            if emulator_ready(): break
            time.sleep(3)
        if not emulator_ready():
            return JSONResponse(status_code=504, content={"ok":False,"error":"Emulator boot timed out","log":pathlib.Path("/tmp/emulator.log").read_text(errors="ignore")[-6000:]})
    install=adb("install", "-r", str(APK_PATH), timeout=180)
    if install["code"] != 0:
        return JSONResponse(status_code=500, content={"ok":False,"error":"APK install failed","log":install})
    launch=adb("shell","monkey","-p",req.packageName,"-c","android.intent.category.LAUNCHER","1",timeout=30)
    return {"ok":True,"message":"APK installed and launched","install":install,"launch":launch,"streamUrl":"/ws/vnc"}

@app.get("/logcat")
def logcat(authorization: str | None = Header(default=None)):
    auth(authorization.removeprefix("Bearer ") if authorization else None)
    if not emulator_ready(): raise HTTPException(409, "Emulator is not running")
    return adb("logcat", "-d", "-t", "400", timeout=20)

class InputRequest(BaseModel):
    action: str
    x: int = 0
    y: int = 0
    text: str = ""

@app.post("/input")
def input_action(req: InputRequest, authorization: str | None = Header(default=None)):
    auth(authorization.removeprefix("Bearer ") if authorization else None)
    if not emulator_ready(): raise HTTPException(409, "Emulator is not running")
    if req.action == "tap": args=["shell","input","tap",str(req.x),str(req.y)]
    elif req.action == "swipe": args=["shell","input","swipe",str(req.x),str(req.y),str(req.x2),str(req.y2),str(req.duration)]
    elif req.action == "text": args=["shell","input","text",req.text[:500]]
    elif req.action == "key": args=["shell","input","keyevent",str(req.keycode)]
    else: raise HTTPException(400, "Unsupported input action")
    return adb(*args, timeout=15)

@app.post("/stop")
def stop(authorization: str | None = Header(default=None)):
    auth(authorization.removeprefix("Bearer ") if authorization else None)
    adb("emu","kill",timeout=15)
    return {"ok":True,"stopped":True}

@app.websocket("/ws/vnc")
async def vnc(websocket: WebSocket):
    await websocket.accept()
    # VNC is not exposed unauthenticated; front-end proxy must validate the session token.
    try:
        import websockets
        async with websockets.connect("ws://127.0.0.1:6080", max_size=None) as upstream:
            async def to_vnc():
                while True:
                    msg=await websocket.receive()
                    if msg.get("type")=="websocket.disconnect": break
                    if msg.get("bytes") is not None: await upstream.send(msg["bytes"])
                    elif msg.get("text") is not None: await upstream.send(msg["text"])
            async def from_vnc():
                async for msg in upstream:
                    if isinstance(msg,bytes): await websocket.send_bytes(msg)
                    else: await websocket.send_text(msg)
            tasks=[asyncio.create_task(to_vnc()),asyncio.create_task(from_vnc())]
            done,pending=await asyncio.wait(tasks,return_when=asyncio.FIRST_COMPLETED)
            for t in pending: t.cancel()
    except WebSocketDisconnect: pass
    except Exception:
        try: await websocket.close(code=1011)
        except Exception: pass
