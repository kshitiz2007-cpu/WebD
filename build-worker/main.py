from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import os, tempfile, pathlib, subprocess, base64, shutil, re, threading, uuid, time, json

app = FastAPI(title="WebD Android Build Worker")

@app.exception_handler(Exception)
async def internal_error_handler(request, exc):
    return JSONResponse(status_code=500, content={"success": False, "error": "Internal build worker error", "detail": str(exc)[:4000]})

@app.exception_handler(RequestValidationError)
async def validation_error_handler(request, exc):
    return JSONResponse(status_code=422, content={"success": False, "error": "Invalid build request", "detail": str(exc)[:4000]})
TOKEN = os.environ.get("ANDROID_BUILD_TOKEN", "")
MAX_FILES = 1200
MAX_SOURCE_BYTES = 8 * 1024 * 1024
BUILD_TIMEOUT = int(os.environ.get("BUILD_TIMEOUT_SECONDS", "480"))
JOBS = {}
JOBS_LOCK = threading.Lock()

class BuildRequest(BaseModel):
    files: dict[str, str]

def safe_path(root: pathlib.Path, relative: str) -> pathlib.Path:
    if not relative or len(relative) > 240 or relative.startswith("/") or "\\" in relative:
        raise HTTPException(400, "Invalid file path")
    parts = pathlib.PurePosixPath(relative).parts
    if any(p in ("", ".", "..") for p in parts) or any(p.startswith(".git") for p in parts):
        raise HTTPException(400, "Unsafe path")
    resolved = root.joinpath(*parts).resolve()
    if root.resolve() not in resolved.parents and resolved != root.resolve():
        raise HTTPException(400, "Path escapes build directory")
    return resolved

@app.get("/health")
def health():
    return {"ok": True, "service": "webd-android-build-worker"}

def _execute_build(req: BuildRequest):
    files = req.files
    if not isinstance(files, dict) or not files or len(files) > MAX_FILES:
        raise HTTPException(400, "Project file count is invalid")
    total = sum(len(v.encode("utf-8")) for v in files.values() if isinstance(v, str))
    if total > MAX_SOURCE_BYTES:
        raise HTTPException(413, "Project source exceeds 8 MB limit")
    if any(not isinstance(v, str) for v in files.values()):
        raise HTTPException(400, "Files must be UTF-8 text")

    with tempfile.TemporaryDirectory(prefix="webd-build-") as tmp:
        root = pathlib.Path(tmp)
        for rel, content in files.items():
            target = safe_path(root, rel)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")
        # Constrain Gradle memory and parallelism for small Railway containers.
        (root / "gradle.properties").write_text("org.gradle.jvmargs=-Xmx256m -XX:MaxMetaspaceSize=192m -XX:ReservedCodeCacheSize=32m -Dfile.encoding=UTF-8 -XX:-UsePerfData -Dorg.gradle.internal.instrumentation.agent=false\n" + "org.gradle.workers.max=1\n" + "org.gradle.parallel=false\n" + "org.gradle.caching=true\n" + "android.useAndroidX=true\n" + "android.enableJetifier=true\nkotlin.compiler.execution.strategy=in-process\nkotlin.daemon.enabled=false\n", encoding="utf-8")
        # Force Java and Kotlin compilation to the same JVM target (17).
        init_script = root / "webd-jvm-target.gradle"
        init_script.write_text("""allprojects {
    tasks.configureEach {
        def taskName = name.toLowerCase()
        if (taskName.contains("javac") || taskName.contains("java")) {
            if (hasProperty("sourceCompatibility")) sourceCompatibility = "17"
            if (hasProperty("targetCompatibility")) targetCompatibility = "17"
        }
        if (taskName.contains("kotlin") && hasProperty("kotlinOptions")) {
            kotlinOptions.jvmTarget = "17"
        }
    }
}
""", encoding="utf-8")
        gradle_home = root / "gradle-user-home"
        gradle_home.mkdir(parents=True, exist_ok=True)
        gradle = shutil.which("gradle")
        if not gradle:
            raise HTTPException(500, "Gradle is not installed in build worker")
        try:
            proc = subprocess.run([gradle, "--no-daemon", "--max-workers=1", "--init-script", str(init_script), "--stacktrace", "assembleDebug"], cwd=root, capture_output=True, text=True, timeout=BUILD_TIMEOUT, env={"PATH": os.environ.get("PATH", ""), "ANDROID_HOME": os.environ.get("ANDROID_HOME", "/opt/android-sdk"), "ANDROID_SDK_ROOT": os.environ.get("ANDROID_SDK_ROOT", "/opt/android-sdk"), "JAVA_HOME": os.environ.get("JAVA_HOME", ""), "HOME": str(root), "GRADLE_USER_HOME": str(gradle_home), "GRADLE_OPTS": "-Xmx256m -XX:MaxMetaspaceSize=192m -XX:ReservedCodeCacheSize=32m -Dfile.encoding=UTF-8", "LANG": "C.UTF-8"})
        except subprocess.TimeoutExpired as ex:
            timeout_log = ex.stdout or ex.stderr or ""
            if isinstance(timeout_log, bytes): timeout_log = timeout_log.decode(errors="ignore")
            raise HTTPException(408, f"Build timed out after {BUILD_TIMEOUT}s.\\n{timeout_log[-100000:]}")

        log = ((proc.stdout or "") + "\n" + (proc.stderr or ""))[-100000:]
        if proc.returncode != 0:
            return JSONResponse(status_code=422, content={"success": False, "log": log, "error": "Gradle build failed"})
        apk_path = root / "app" / "build" / "outputs" / "apk" / "debug" / "app-debug.apk"
        if not apk_path.exists():
            return JSONResponse(status_code=500, content={"success": False, "log": log, "error": "Build completed but APK was not found"})
        data = apk_path.read_bytes()
        return {"success": True, "fileName": "app-debug.apk", "apkBase64": base64.b64encode(data).decode("ascii"), "sizeBytes": len(data), "log": log}

def _job_runner(job_id: str, req: BuildRequest):
    with JOBS_LOCK:
        JOBS[job_id]["status"] = "running"
        JOBS[job_id]["startedAt"] = time.time()
    try:
        result = _execute_build(req)
        payload = json.loads(result.body.decode("utf-8")) if isinstance(result, JSONResponse) else result
        with JOBS_LOCK:
            JOBS[job_id].update(status="completed", result=payload, finishedAt=time.time())
    except Exception as exc:
        with JOBS_LOCK:
            JOBS[job_id].update(status="completed", result={"success": False, "error": str(exc)[:4000]}, finishedAt=time.time())

@app.post("/build")
def start_build(req: BuildRequest, authorization: str | None = Header(default=None)):
    if not TOKEN or authorization != f"Bearer {TOKEN}":
        raise HTTPException(401, "Unauthorized")
    if not req.files or len(req.files) > MAX_FILES or any(not isinstance(v, str) for v in req.files.values()):
        raise HTTPException(400, "Project files invalid")
    if sum(len(v.encode("utf-8")) for v in req.files.values()) > MAX_SOURCE_BYTES:
        raise HTTPException(413, "Project source exceeds 8 MB limit")
    job_id = uuid.uuid4().hex
    with JOBS_LOCK:
        JOBS[job_id] = {"status": "queued", "createdAt": time.time()}
    threading.Thread(target=_job_runner, args=(job_id, req), daemon=True).start()
    return JSONResponse(status_code=202, content={"success": True, "jobId": job_id, "status": "queued"})

@app.get("/build/status/{job_id}")
def build_status(job_id: str, authorization: str | None = Header(default=None)):
    if not TOKEN or authorization != f"Bearer {TOKEN}":
        raise HTTPException(401, "Unauthorized")
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if not job:
            raise HTTPException(404, "Build job not found")
        return dict(job)
