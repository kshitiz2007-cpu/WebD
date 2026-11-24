from __future__ import annotations

import base64
import os
import re
import shutil
import subprocess
import tempfile
import threading
import time
import zipfile
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

app = FastAPI(title="WebD Android Build Engine", version="1.0.0")
TOKEN = os.environ.get("ANDROID_BUILD_SERVICE_TOKEN", "")
MAX_PROJECT_BYTES = int(os.environ.get("MAX_PROJECT_BYTES", "12000000"))
MAX_FILES = int(os.environ.get("MAX_PROJECT_FILES", "1200"))
BUILD_TIMEOUT = int(os.environ.get("BUILD_TIMEOUT_SECONDS", "1200"))
JOBS: dict[str, dict[str, Any]] = {}
LOCK = threading.Lock()
WORK_ROOT = Path(os.environ.get("BUILD_WORK_ROOT", "/work/jobs"))
WORK_ROOT.mkdir(parents=True, exist_ok=True)

class BuildRequest(BaseModel):
    files: dict[str, str]

def auth(authorization: str | None):
    if not TOKEN:
        raise HTTPException(503, "Build server token is not configured.")
    if authorization != "Bearer " + TOKEN:
        raise HTTPException(401, "Unauthorized")

def safe_path(root: Path, raw: str) -> Path:
    raw = raw.replace("\\", "/").strip("/")
    if not raw or raw.startswith("/") or any(part in ("", ".", "..") for part in raw.split("/")):
        raise HTTPException(400, "Unsafe project file path.")
    target = (root / raw).resolve()
    if not target.is_relative_to(root.resolve()):
        raise HTTPException(400, "Unsafe project file path.")
    return target

def run_build(job_id: str, files: dict[str, str]):
    work = WORK_ROOT / job_id
    project = work / "project"
    work.mkdir(parents=True, exist_ok=True)
    project.mkdir(parents=True, exist_ok=True)
    def addlog(s: str):
        with LOCK:
            JOBS[job_id]["log"] += s + "\\n"
    try:
        for name, content in files.items():
            target = safe_path(project, name)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")
        # Android Gradle builds run with a bounded heap and daemon disabled.
        gradle = project / "gradlew"
        if not gradle.exists():
            addlog("Gradle wrapper missing; generating wrapper with installed Gradle.")
            subprocess.run(["gradle", "wrapper", "--gradle-version", "8.9"], cwd=project, check=True, timeout=180, capture_output=True, text=True)
        gradle.chmod(0o755)
        with LOCK:
            JOBS[job_id]["status"] = "running"
        cmd = ["./gradlew", "--no-daemon", "--stacktrace", "--console=plain", "assembleDebug"]
        proc = subprocess.Popen(cmd, cwd=project, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1, env={**os.environ, "GRADLE_OPTS": os.environ.get("GRADLE_OPTS", "-Xmx3g -XX:MaxMetaspaceSize=1g")})
        try:
            stdout, _ = proc.communicate(timeout=BUILD_TIMEOUT)
        except subprocess.TimeoutExpired:
            proc.kill()
            stdout, _ = proc.communicate()
            raise TimeoutError(f"Gradle build exceeded {BUILD_TIMEOUT} seconds.")
        output = stdout.splitlines(keepends=True)
        with LOCK:
            JOBS[job_id]["log"] += stdout[-250000:]
        code = proc.returncode
        if code != 0:
            raise RuntimeError("Gradle exited with code " + str(code))
        apk = next((p for p in project.glob("**/build/outputs/apk/debug/*.apk") if p.is_file()), None)
        if not apk:
            raise RuntimeError("Gradle succeeded but no debug APK was found.")
        raw = apk.read_bytes()
        with LOCK:
            JOBS[job_id].update(status="completed", success=True, fileName=apk.name, sizeBytes=len(raw), apkBase64=base64.b64encode(raw).decode("ascii"), log="".join(output)[-250000:])
    except Exception as exc:
        with LOCK:
            JOBS[job_id].update(status="failed", success=False, error=str(exc), log=JOBS[job_id].get("log", "")[-250000:])
    finally:
        # Retain status/APK in memory; remove working tree to save disk.
        shutil.rmtree(work, ignore_errors=True)

@app.get("/health")
def health():
    return {"ok": True, "provider": "Self-hosted Docker Android Build Engine", "queue": sum(1 for j in JOBS.values() if j.get("status") in ("queued", "running"))}

@app.post("/build")
def start_build(payload: BuildRequest, authorization: str | None = Header(default=None)):
    auth(authorization)
    files = payload.files
    if not files or len(files) > MAX_FILES:
        raise HTTPException(400, f"Project must contain 1-{MAX_FILES} text files.")
    total = sum(len(v.encode("utf-8")) for v in files.values())
    if total > MAX_PROJECT_BYTES:
        raise HTTPException(413, f"Project upload exceeds {MAX_PROJECT_BYTES} bytes.")
    for name, value in files.items():
        if not isinstance(name, str) or not isinstance(value, str):
            raise HTTPException(400, "File names and contents must be strings.")
        safe_path(Path("/tmp/webd-validate"), name)
    job_id = os.urandom(16).hex()
    with LOCK:
        JOBS[job_id] = {"jobId": job_id, "status": "queued", "success": False, "log": "Build queued.\n", "createdAt": time.time()}
    threading.Thread(target=run_build, args=(job_id, files), daemon=True).start()
    return {"jobId": job_id, "status": "queued"}

@app.get("/build/{job_id}")
def get_build(job_id: str, authorization: str | None = Header(default=None)):
    auth(authorization)
    if not re.fullmatch(r"[a-f0-9]{32}", job_id):
        raise HTTPException(400, "Invalid build ID.")
    with LOCK:
        job = JOBS.get(job_id)
        if not job:
            raise HTTPException(404, "Build job not found (server restarted or expired).")
        result = dict(job)
    result.pop("createdAt", None)
    return result
