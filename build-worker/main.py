from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel
import os, tempfile, pathlib, subprocess, base64, shutil, re, threading, uuid, time, select
from concurrent.futures import ThreadPoolExecutor

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
BUILD_TIMEOUT = int(os.environ.get("BUILD_TIMEOUT_SECONDS", "600"))
class BuildRequest(BaseModel):
    files: dict[str, str]

jobs = {}
jobs_lock = threading.Lock()
executor = ThreadPoolExecutor(max_workers=1)

def safe_path(root: pathlib.Path, relative: str) -> pathlib.Path:
    # Normalize paths sent by browser IDEs (some emit ./ prefixes or Windows separators).
    if not isinstance(relative, str) or not relative or len(relative) > 240 or "\\x00" in relative:
        raise HTTPException(400, "Invalid file path")
    normalized = relative.replace("\\\\", "/").strip()
    while normalized.startswith("./"):
        normalized = normalized[2:]
    if normalized.startswith("/") or re.match(r"^[A-Za-z]:", normalized):
        raise HTTPException(400, "Absolute paths are not allowed")
    parts = [p for p in normalized.split("/") if p not in ("", ".")]
    # Permit ordinary hidden metadata files (e.g. .github/FUNDING.yml), but block Git internals and traversal.
    if not parts or any(p == ".." for p in parts) or any(p.lower() == ".git" or p.lower().startswith(".git/") for p in parts):
        raise HTTPException(400, "Unsafe path: " + relative[:120])
    resolved = root.joinpath(*parts).resolve()
    if root.resolve() not in resolved.parents and resolved != root.resolve():
        raise HTTPException(400, "Path escapes build directory: " + relative[:120])
    return resolved

@app.get("/health")
def health():
    with jobs_lock:
        active = sum(1 for j in jobs.values() if j["status"] == "running")
    return {"ok": True, "service": "webd-android-build-worker", "activeBuilds": active}

def run_build(job_id: str, files: dict):
    def set_job(**updates):
        with jobs_lock:
            jobs[job_id].update(updates)
    set_job(status="running", startedAt=time.time())
    try:
        with tempfile.TemporaryDirectory(prefix="webd-build-") as tmp:
            root = pathlib.Path(tmp)
            for rel, content in files.items():
                target = safe_path(root, rel)
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(content, encoding="utf-8")
            (root / "gradle.properties").write_text("org.gradle.jvmargs=-Xmx512m -XX:MaxMetaspaceSize=384m -XX:ReservedCodeCacheSize=48m -Xss512k -XX:+UseSerialGC -Dfile.encoding=UTF-8 -XX:-UsePerfData -Dorg.gradle.internal.instrumentation.agent=false\norg.gradle.workers.max=1\norg.gradle.parallel=false\norg.gradle.configureondemand=true\norg.gradle.caching=true\norg.gradle.configuration-cache=false\norg.gradle.kotlin.dsl.precompiled.script.reuse=false\norg.gradle.vfs.watch=false\nandroid.useAndroidX=true\nandroid.enableJetifier=true\nkotlin.compiler.execution.strategy=in-process\nkotlin.daemon.enabled=false\n", encoding="utf-8")
            init_script = root / "webd-jvm-target.gradle"
            init_script.write_text("""gradle.projectsEvaluated {
    allprojects {
        // Apply targets after Android/Kotlin plugins and module build scripts
        // have finished configuring their compile tasks, so their defaults
        // cannot reset Java back to 1.8 after this script runs.
        tasks.each { task ->
            def taskName = task.getName().toLowerCase()
            if (taskName.contains("javac")) {
                task.setSourceCompatibility("17")
                task.setTargetCompatibility("17")
            }
            if (taskName.contains("kotlin")) {
                try { task.kotlinOptions.jvmTarget = "17" } catch (Throwable ignored) {}
            }
        }
    }
}
""", encoding="utf-8")
            gradle_home = root / "gradle-user-home"
            gradle_home.mkdir(parents=True, exist_ok=True)
            gradle = shutil.which("gradle")
            if not gradle:
                raise RuntimeError("Gradle is not installed in build worker")
            command = [gradle, "--no-daemon", "--max-workers=1", "--no-watch-fs", "--console=plain", "--info", "--init-script", str(init_script), "--stacktrace", "assembleDebug"]
            env = {"PATH": os.environ.get("PATH", ""), "ANDROID_HOME": os.environ.get("ANDROID_HOME", "/opt/android-sdk"), "ANDROID_SDK_ROOT": os.environ.get("ANDROID_SDK_ROOT", "/opt/android-sdk"), "JAVA_HOME": os.environ.get("JAVA_HOME", ""), "HOME": str(root), "GRADLE_USER_HOME": str(gradle_home), "GRADLE_OPTS": "-Xmx512m -XX:MaxMetaspaceSize=384m -XX:ReservedCodeCacheSize=48m -Xss512k -XX:+UseSerialGC -Dfile.encoding=UTF-8", "LANG": "C.UTF-8"}
            proc = subprocess.Popen(command, cwd=root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1, env=env)
            log_lines = []
            started = time.time()
            while proc.poll() is None:
                ready, _, _ = select.select([proc.stdout], [], [], 1.0)
                if ready:
                    line = proc.stdout.readline()
                    if line:
                        log_lines.append(line.rstrip())
                        log = "\n".join(log_lines)[-100000:]
                        set_job(log=log, lastLine=line.rstrip(), elapsedSeconds=int(time.time() - started))
                if time.time() - started > BUILD_TIMEOUT:
                    proc.kill()
                    proc.wait()
                    log = "\n".join(log_lines)[-100000:]
                    set_job(status="failed", success=False, error=f"Build timed out after {BUILD_TIMEOUT}s", log=log, finishedAt=time.time())
                    return
            if proc.stdout:
                remaining = proc.stdout.read()
                if remaining:
                    log_lines.extend(remaining.splitlines())
            log = "\n".join(log_lines)[-100000:]
            if proc.returncode != 0:
                set_job(status="failed", success=False, error="Gradle build failed", log=log, finishedAt=time.time())
                return
            apk_path = root / "app" / "build" / "outputs" / "apk" / "debug" / "app-debug.apk"
            if not apk_path.exists():
                set_job(status="failed", success=False, error="Build completed but APK was not found", log=log, finishedAt=time.time())
                return
            data = apk_path.read_bytes()
            set_job(status="completed", success=True, fileName="app-debug.apk", apkBase64=base64.b64encode(data).decode("ascii"), sizeBytes=len(data), log=log, finishedAt=time.time())
    except subprocess.TimeoutExpired as ex:
        output = ex.stdout or b""
        if isinstance(output, bytes): output = output.decode(errors="ignore")
        set_job(status="failed", success=False, error=f"Build timed out after {BUILD_TIMEOUT}s", log=output[-100000:], finishedAt=time.time())
    except Exception as ex:
        set_job(status="failed", success=False, error=str(ex)[:4000], log="", finishedAt=time.time())

@app.post("/build")
def start_build(req: BuildRequest, authorization: str | None = Header(default=None)):
    if not TOKEN or authorization != f"Bearer {TOKEN}":
        raise HTTPException(401, "Unauthorized")
    files = req.files
    if not files or len(files) > MAX_FILES:
        raise HTTPException(400, "Project file count is invalid")
    total = sum(len(v.encode("utf-8")) for v in files.values() if isinstance(v, str))
    if total > MAX_SOURCE_BYTES:
        raise HTTPException(413, "Project source exceeds 8 MB")
    if any(not isinstance(v, str) for v in files.values()):
        raise HTTPException(400, "Files must be UTF-8 text")
    job_id = uuid.uuid4().hex
    with jobs_lock:
        jobs[job_id] = {"jobId": job_id, "status": "queued", "createdAt": time.time()}
    executor.submit(run_build, job_id, dict(files))
    return {"success": True, "jobId": job_id, "status": "queued"}

@app.get("/build/{job_id}")
def build_status(job_id: str, authorization: str | None = Header(default=None)):
    if not TOKEN or authorization != f"Bearer {TOKEN}":
        raise HTTPException(401, "Unauthorized")
    with jobs_lock:
        job = jobs.get(job_id)
        if not job: raise HTTPException(404, "Build job not found")
        return dict(job)
