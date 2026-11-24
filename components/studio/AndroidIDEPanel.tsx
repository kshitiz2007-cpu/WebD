'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import { Code2, Folder, FolderOpen, Smartphone, Play, Hammer, RefreshCw, Plus, ChevronDown, FileCode2, FileJson, FileText, Settings, Terminal, Eye, X } from 'lucide-react';
import MonacoCodeEditorClient from './MonacoCodeEditorClient';
import AndroidEmulatorScreen from './AndroidEmulatorScreen';

type AndroidFiles = Record<string, string>;

const starterFiles: AndroidFiles = {
  'settings.gradle.kts': `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "WebDAndroid"
include(":app")`,
  'build.gradle.kts': `plugins {
    id("com.android.application") version "8.7.3" apply false
    id("org.jetbrains.kotlin.android") version "2.0.21" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.0.21" apply false
}`,
  'gradle.properties': `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
kotlin.code.style=official
`,
  'app/build.gradle.kts': `plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}
android {
    namespace = "com.webd.starter"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.webd.starter"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
    }
}
dependencies {
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.compose.ui:ui:1.7.5")
    implementation("androidx.compose.ui:ui-tooling-preview:1.7.5")
    implementation("androidx.compose.material3:material3:1.3.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
}`,
  'app/src/main/AndroidManifest.xml': `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application android:theme="@android:style/Theme.Material.Light.NoActionBar" android:label="WebD Starter">
        <activity android:name=".MainActivity" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>`,
  'app/src/main/java/com/webd/starter/MainActivity.kt': `package com.webd.starter

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                StarterScreen()
            }
        }
    }
}

@Composable
fun StarterScreen() {
    var count by remember { mutableIntStateOf(0) }
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("Hello, Android!", style = MaterialTheme.typography.headlineMedium)
        Text("Your Compose app is ready.")
        Button(onClick = { count++ }) {
            Text("Tap count: $count")
        }
    }
}`,
  'app/src/main/res/values/strings.xml': `<resources>
    <string name="app_name">WebD Starter</string>
</resources>`,
};

const ANDROID_DRAFT_DB = 'webd-android-drafts';
function openDraftDb(): Promise<IDBDatabase> { return new Promise((resolve, reject) => { const req = indexedDB.open(ANDROID_DRAFT_DB, 1); req.onupgradeneeded = () => req.result.createObjectStore('projects'); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); }
async function readDraft(): Promise<AndroidFiles | null> { const db = await openDraftDb(); return new Promise((resolve, reject) => { const req = db.transaction('projects', 'readonly').objectStore('projects').get('current'); req.onsuccess = () => { db.close(); resolve(req.result || null); }; req.onerror = () => { db.close(); reject(req.error); }; }); }
async function writeDraft(files: AndroidFiles): Promise<void> { const db = await openDraftDb(); await new Promise<void>((resolve, reject) => { const req = db.transaction('projects', 'readwrite').objectStore('projects').put(files, 'current'); req.onsuccess = () => resolve(); req.onerror = () => reject(req.error); }); db.close(); }
const fileIcons: Record<string, React.ReactNode> = {
  kt: <FileCode2 size={14} className="text-violet-400" />,
  kts: <Code2 size={14} className="text-emerald-400" />,
  xml: <FileJson size={14} className="text-orange-400" />,
  properties: <Settings size={14} className="text-slate-400" />,
};

function getFileIcon(path: string) {
  const ext = path.split('.').pop() || '';
  return fileIcons[ext] || <FileText size={14} className="text-slate-400" />;
}

function getLanguage(path: string) {
  if (path.endsWith('.kt')) return 'kotlin';
  if (path.endsWith('.kts')) return 'kotlin';
  if (path.endsWith('.xml')) return 'xml';
  if (path.endsWith('.properties')) return 'properties';
  return 'plaintext';
}

export default function AndroidIDEPanel({ onExitAndroid }: { onExitAndroid?: () => void }) {
  const zipInputRef = useRef<HTMLInputElement>(null);
  const [showOutput, setShowOutput] = useState(true);
  const [showFullLog, setShowFullLog] = useState(false);
  const [builtApkBase64, setBuiltApkBase64] = useState<string | null>(null);
  const [emulatorSession, setEmulatorSession] = useState<string | null>(null);
  const [files, setFiles] = useState<AndroidFiles>(starterFiles);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => { let cancelled = false; readDraft().then((saved) => { if (!cancelled && saved && typeof saved === 'object') setFiles(saved); }).catch(() => {}).finally(() => { if (!cancelled) setStorageReady(true); }); return () => { cancelled = true; }; }, []);
  useEffect(() => { if (!storageReady) return; writeDraft(files).catch(() => setLogMessage('Project imported, but browser storage could not save the draft. Use Export ZIP for backup.')); }, [files, storageReady]);
  const [activeFile, setActiveFile] = useState('app/src/main/java/com/webd/starter/MainActivity.kt');
  const [openFiles, setOpenFiles] = useState<string[]>([activeFile]);
  const [expanded, setExpanded] = useState<string[]>(['app', 'app/src', 'app/src/main', 'app/src/main/java', 'app/src/main/java/com', 'app/src/main/java/com/webd', 'app/src/main/java/com/webd/starter', 'app/src/main/res', 'app/src/main/res/values']);
  const [device, setDevice] = useState('Pixel 8');
  const [logMessage, setLogMessage] = useState('Android preview is a Compose UI simulator in Phase 1. Gradle builds and emulator execution are planned for Phase 2/3.');
  const [previewCount, setPreviewCount] = useState(0);
  const [isBuilding, setIsBuilding] = useState(false);
  const [previewTitle, setPreviewTitle] = useState('Hello, Android!');
  const [previewText, setPreviewText] = useState('Your Compose app is ready.');
  const [previewButton, setPreviewButton] = useState('Tap count: 0');
  const [counter, setCounter] = useState(0);
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [expandedOutput, setExpandedOutput] = useState(false);
  const [buildLogSearch, setBuildLogSearch] = useState('');

  const tree = useMemo(() => Object.keys(files).sort((a, b) => a.localeCompare(b)), [files]);
  const activeContent = files[activeFile] || '';
  const diagnosticLines = useMemo(() => logMessage.split(/\r?\n/).filter((line) => /\b(error|failed|warning|warn)\b/i.test(line)), [logMessage]);
  const filteredBuildLog = useMemo(() => buildLogSearch ? logMessage.split(/\r?\n/).filter((line) => line.toLowerCase().includes(buildLogSearch.toLowerCase())).join('\n') : logMessage, [logMessage, buildLogSearch]);
  const diagnosticLocations = useMemo(() => {
    const found: Array<{ path: string; line: number }> = [];
    for (const line of logMessage.split(/\r?\n/)) {
      const match = line.match(/([\w./-]+\.(?:kt|kts|xml|java)):(\d+)/);
      if (match && files[match[1]]) found.push({ path: match[1], line: Number(match[2]) });
    }
    return found;
  }, [logMessage, files]);

  const updateFile = (value: string) => setFiles((old) => ({ ...old, [activeFile]: value }));

  const openFile = (path: string) => {
    setActiveFile(path);
    setOpenFiles((old) => old.includes(path) ? old : [...old, path]);
  };


  const refreshPreview = () => {
    const source = files['app/src/main/java/com/webd/starter/MainActivity.kt'] || '';
    const textMatches = [...source.matchAll(/Text\s*\(\s*["']([^"']+)["']/g)].map((m) => m[1]);
    setPreviewTitle(textMatches[0] || 'Compose preview');
    setPreviewText(textMatches[1] || 'Live mock preview of your Kotlin source.');
    const buttonText = source.match(/Button\s*\([\s\S]*?\)\s*\{\s*Text\s*\(\s*["']([^"']+)/);
    setPreviewButton(buttonText?.[1] || 'Button preview');
    setCounter(0);
    setPreviewCount((n) => n + 1);
    setLogMessage('Preview refreshed from MainActivity.kt · Compose source heuristics');
  };

  const importProjectFiles = (incoming: Record<string, string>, source: string) => {
    const cleaned: Record<string, string> = {};
    for (const [raw, value] of Object.entries(incoming)) {
      const path = raw.replace(/^\/+/, '');
      if (!path || path.includes('..') || path.startsWith('.git/') || path.length > 240) continue;
      if (typeof value !== 'string' || value.length > 1_000_000) continue;
      cleaned[path] = value;
    }
    if (!Object.keys(cleaned).length) { setLogMessage('Import archive contains no usable text files.'); return; }
    setFiles(cleaned);
    const first = Object.keys(cleaned).find((p) => p.endsWith('MainActivity.kt')) || Object.keys(cleaned)[0];
    setActiveFile(first);
    setOpenFiles([first]);
    setBuiltApkBase64(null);
    setEmulatorSession(null);
    setLogMessage(source + ' imported: ' + Object.keys(cleaned).length + ' files. Build APK to continue.');
  };
  const importZipFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { setLogMessage('ZIP upload limit is 8 MB.'); return; }
    try {
      setLogMessage('Extracting ZIP project…');
      const zip = await JSZip.loadAsync(file);
      const entries = Object.values(zip.files).filter((entry) => !entry.dir);
      const firstSegments = entries.map((entry) => entry.name.split('/')[0]);
      const hasSingleRoot = firstSegments.length > 0 && firstSegments.every((segment) => segment === firstSegments[0]) && entries.every((entry) => entry.name.includes('/'));
      const incoming: Record<string, string> = {};
      for (const entry of entries) {
        let path = hasSingleRoot ? entry.name.slice(firstSegments[0].length + 1) : entry.name;
        path = path.replace(/^\/+/, '');
        if (!path || path.startsWith('/') || path.split('/').includes('..') || path.startsWith('.git/')) continue;
        if (Object.keys(incoming).length >= 1200) break;
        if (/\.(png|jpe?g|gif|webp|ico|apk|aab|jar|class|so|zip|pdf|mp4|mp3|woff2?|ttf|otf)$/i.test(path)) continue;
        try {
          const text = await entry.async('string');
          if (text.length <= 1_000_000) incoming[path] = text;
        } catch { /* Skip binary or unreadable files */ }
      }
      importProjectFiles(incoming, 'ZIP');
    } catch (e) { setLogMessage(e instanceof Error ? e.message : 'ZIP import failed'); }
  };
  const importGithubRepo = async () => {
    const url = window.prompt('Public GitHub repository URL (branch optional):');
    if (!url) return;
    try {
      setLogMessage('Downloading public GitHub repository archive…');
      const response = await fetch('/api/android/import/github', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
      const data = await response.json();
      if (!response.ok || !data.success) { setLogMessage(data.error || 'GitHub import failed.'); return; }
      importProjectFiles(data.files, 'GitHub ' + (data.repo || 'repository'));
    } catch (e) { setLogMessage(e instanceof Error ? e.message : 'GitHub import failed'); }
  };

  const createFile = () => {
    const name = window.prompt('New file path (relative to project root):', 'app/src/main/java/com/webd/starter/NewScreen.kt');
    if (!name) return;
    const path = name.trim().replace(/^\/+/, '');
    if (!path || files[path]) return;
    setFiles((old) => ({ ...old, [path]: path.endsWith('.kt') ? 'package com.webd.starter\n\nimport androidx.compose.runtime.Composable\n\n@Composable\nfun NewScreen() {\n    // Start building your screen\n}\n' : '' }));
    openFile(path);
    setLogMessage(`Created ${path}`);
  };

  const newProject = (kind: 'empty' | 'counter' | 'login') => {
    setFiles(starterFiles);
    setActiveFile('app/src/main/java/com/webd/starter/MainActivity.kt');
    setOpenFiles(['app/src/main/java/com/webd/starter/MainActivity.kt']);
    setCounter(0);
    if (kind === 'empty') {
      const mainPath = 'app/src/main/java/com/webd/starter/MainActivity.kt';
      setFiles((old) => ({ ...old, [mainPath]: old[mainPath].replace('        Button(onClick = { count++ }) {\n            Text("Tap count: $count")\n        }\n', '') }));
    }
    if (kind === 'login') {
      setFiles((old) => ({ ...old, 'app/src/main/java/com/webd/starter/MainActivity.kt': old['app/src/main/java/com/webd/starter/MainActivity.kt'].replace('Hello, Android!', 'Welcome back').replace('Your Compose app is ready.', 'Sign in to continue') }));
    }
    setLogMessage(`New ${kind === 'empty' ? 'Empty Compose' : kind === 'counter' ? 'Counter' : 'Login UI'} project created`);
    setShowProjectMenu(false);
  };

  const handleBuildApk = async () => {
    if (isBuilding) return;
    setIsBuilding(true);
    setShowOutput(true);
    setBuiltApkBase64(null);
    setLogMessage('Checking GitHub Actions build connection…');
    let buildStage = 'health check';
    try {
      const healthResponse = await fetch('/api/android/build', { method: 'GET', cache: 'no-store', signal: AbortSignal.timeout(25000) });
      const healthRaw = await healthResponse.text();
      let health: any;
      try { health = JSON.parse(healthRaw); } catch { health = { error: healthRaw }; }
      if (!healthResponse.ok || !health?.reachable) {
        setLogMessage(['GITHUB ACTIONS CONNECTION DIAGNOSTICS', 'Status: BUILD API UNREACHABLE', 'HTTP: ' + healthResponse.status, '', healthRaw || '(empty response)'].join('\n'));
        setShowOutput(true); setShowFullLog(true); return;
      }
      buildStage = 'project upload and workflow dispatch';
      setLogMessage('Connection verified. Uploading project and starting build…');
      const startResponse = await fetch('/api/android/build', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files }), signal: AbortSignal.timeout(120000) });
      const startRaw = await startResponse.text();
      let startData: any;
      try { startData = JSON.parse(startRaw); } catch { startData = { error: startRaw }; }
      if (!startResponse.ok || !startData.jobId) {
        setLogMessage(['ANDROID BUILD START FAILED', 'HTTP: ' + startResponse.status, startData.error || startData.detail || startRaw].join('\n'));
        setShowOutput(true); setShowFullLog(true); return;
      }
      const jobId = startData.jobId;
      buildStage = 'GitHub Actions status polling';
      const maxPolls = 300;
      let result: any = null;
      for (let poll = 0; poll < maxPolls; poll++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const statusResponse = await fetch('/api/android/build?jobId=' + encodeURIComponent(jobId), { cache: 'no-store', signal: AbortSignal.timeout(15000) });
        const statusRaw = await statusResponse.text();
        try { result = JSON.parse(statusRaw); } catch { result = { status: 'failed', error: statusRaw }; }
        if (!statusResponse.ok) throw new Error(result.error || result.detail || 'Build status request failed (HTTP ' + statusResponse.status + ')');
        if (result.status === 'completed' || result.status === 'failed') break;
        setLogMessage(['ANDROID BUILD LIVE LOG', 'Status: ' + (result.status || 'running').toUpperCase(), 'Job: ' + jobId, 'Elapsed: ' + Math.round((poll + 1) * 2) + 's', '', 'GRADLE OUTPUT:', result.log || 'Gradle is starting; waiting for first output…'].join('\n'));
      }
      if (!result || (result.status !== 'completed' && result.status !== 'failed')) {
        setLogMessage('Build is taking longer than the UI wait limit. Job ID: ' + jobId + '\nThe worker continues running; please check again shortly.');
        setShowOutput(true); setShowFullLog(true); return;
      }
      if (result.status === 'failed' || !result.success) {
        setLogMessage(['WEBD ANDROID BUILD REPORT', 'Status: FAILED', 'Job: ' + jobId, '', 'ERROR:', result.error || 'Gradle build failed', '', 'BUILD LOGS:', result.log || '(No logs returned)'].join('\n'));
        setShowOutput(true); setShowFullLog(true); return;
      }
      setBuiltApkBase64(result.apkBase64);
      const binary = atob(result.apkBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/vnd.android.package-archive' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = result.fileName || 'app-debug.apk';
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
      setLogMessage('Build successful! APK downloaded (' + Math.round((result.sizeBytes || bytes.length) / 1024) + ' KB).\n' + (result.log || 'Gradle build finished.'));
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setLogMessage(['ANDROID BUILD CONNECTION DIAGNOSTICS', 'Status: REQUEST FAILED', 'Failed stage: ' + buildStage, '', 'Error: ' + detail, '', 'Check the failing stage above; this is not necessarily a polling failure.'].join('\n'));
      setShowOutput(true); setShowFullLog(true);
    } finally { setIsBuilding(false); }
  };

  const handleRun = async () => {
    if (!builtApkBase64) { setLogMessage('Build APK first, then tap Run Emulator.'); return; }
    setLogMessage('Starting Android Emulator and installing APK…');
    try {
      const response = await fetch('/api/android/emulator/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apkBase64: builtApkBase64, packageName: 'com.webd.starter' }) });
      const result = await response.json();
      if (!response.ok || !result.ok) { setLogMessage(result.error || 'Emulator start failed.'); return; }
      setEmulatorSession(result.sessionToken);
      setLogMessage('APK installed and launched. Live stream starting…');
    } catch (e) { setLogMessage(e instanceof Error ? e.message : 'Emulator service unavailable.'); }
  };
  const stopEmulator = async () => {
    if (!emulatorSession) return;
    try { await fetch('/api/android/emulator/stop', { method: 'POST' }); } catch {}
    setEmulatorSession(null);
    setLogMessage('Emulator stopped.');
  };
  const fetchLogcat = async () => {
    try {
      const res = await fetch('/api/android/emulator/logcat', { cache: 'no-store' });
      const data = await res.json();
      setLogMessage(data.stdout || data.stderr || JSON.stringify(data));
      setShowOutput(true);
    } catch (e) { setLogMessage(e instanceof Error ? e.message : 'Logcat unavailable.'); }
  };

  return (
    <div className="absolute inset-0 z-50 flex min-h-0 flex-col bg-[#0b1120] text-slate-200">
      {emulatorSession && <div className="fixed inset-0 z-[100] flex min-h-0 flex-col bg-black"><AndroidEmulatorScreen sessionToken={emulatorSession} onDisconnect={stopEmulator} /></div>}
      {showFullLog && <div className="fixed inset-0 z-[120] flex flex-col bg-[#070b13] text-slate-200">
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-700 bg-[#111827] p-3"><Terminal size={16}/><strong className="text-sm">Build Diagnostics</strong><span className="rounded bg-red-500/15 px-2 py-1 text-xs text-red-300">{diagnosticLines.length} errors/warnings</span><button onClick={() => setShowFullLog(false)} className="ml-auto rounded bg-slate-700 px-3 py-1 text-sm">Close</button><button onClick={() => void navigator.clipboard?.writeText(logMessage)} className="rounded bg-indigo-600 px-3 py-1 text-sm">Copy All</button><button onClick={() => void handleBuildApk()} disabled={isBuilding} className="rounded bg-emerald-600 px-3 py-1 text-sm disabled:opacity-50">{isBuilding ? 'Building…' : 'Retry Build'}</button></div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
          <aside className="max-h-44 shrink-0 overflow-auto border-b border-slate-800 p-3 md:max-h-none md:w-80 md:border-b-0 md:border-r"><div className="mb-2 text-xs font-semibold">Errors & Warnings</div>{diagnosticLines.length ? diagnosticLines.map((line, i) => <div key={i} className="mb-1 rounded border border-slate-800 bg-slate-900 p-2 text-[11px] text-rose-200">{line}</div>) : <div className="text-xs text-slate-500">No diagnostic lines were detected.</div>}<div className="mt-3 text-xs font-semibold">Detected file locations</div>{diagnosticLocations.length ? diagnosticLocations.map((loc, i) => <button key={i} onClick={() => openFile(loc.path)} className="mt-1 block w-full rounded bg-slate-900 p-2 text-left text-xs text-indigo-300 hover:bg-slate-800">{loc.path}:{loc.line} · Open file</button>) : <div className="mt-1 text-xs text-slate-500">No file locations found in logs.</div>}</aside>
          <section className="flex min-h-0 flex-1 flex-col"><div className="shrink-0 border-b border-slate-800 p-2"><input value={buildLogSearch} onChange={(e) => setBuildLogSearch(e.target.value)} placeholder="Search build log…" className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-xs outline-none focus:border-indigo-500"/></div><pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-xs leading-5">{filteredBuildLog || "No output yet."}</pre></section>
        </div>
      </div>}
      <header className="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-y-1 border-b border-slate-800 bg-[#111827] px-2 py-1 sm:flex-nowrap sm:px-3">
        <div className="flex items-center gap-2">
          {onExitAndroid && <button onClick={onExitAndroid} className="rounded px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-800">Web IDE</button>}
          <Smartphone size={16} className="text-emerald-400" />
          <span className="text-sm font-semibold">Android Studio Mode</span>
          <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-300">PHASE 3 · MOBILE</span>
        </div>
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-1 overflow-x-auto">
          <div className="relative shrink-0">
            <button onClick={() => setShowProjectMenu((v) => !v)} className="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-slate-800"><Plus size={14}/> New project <ChevronDown size={12}/></button>
            {showProjectMenu && <div className="absolute right-0 top-8 z-50 w-44 rounded-md border border-slate-700 bg-slate-900 p-1 shadow-xl">
              <button onClick={() => newProject('empty')} className="w-full rounded px-2 py-2 text-left text-xs hover:bg-slate-800">Empty Compose project</button>
              <button onClick={() => newProject('counter')} className="w-full rounded px-2 py-2 text-left text-xs hover:bg-slate-800">Counter starter</button>
              <button onClick={() => newProject('login')} className="w-full rounded px-2 py-2 text-left text-xs hover:bg-slate-800">Login UI starter</button>
            </div>}
          </div>
          <button onClick={createFile} className="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-slate-800"><Plus size={14}/> File</button>
          <button type="button" onClick={() => zipInputRef.current?.click()} className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs hover:bg-slate-800"><FolderOpen size={14}/> ZIP</button><input ref={zipInputRef} type="file" accept=".zip,application/zip" className="sr-only" onChange={(e) => { void importZipFile(e.target.files?.[0]); e.currentTarget.value = ''; }} />
          <button onClick={importGithubRepo} className="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-slate-800"><Code2 size={14}/> GitHub</button>
          <button onClick={refreshPreview} className="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-slate-800"><RefreshCw size={14}/> Preview</button>
          <button onClick={handleBuildApk} disabled={isBuilding} className="flex shrink-0 items-center gap-1 rounded bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"><Hammer size={13}/> {isBuilding ? "Building…" : "Build APK"}</button><button onClick={handleRun} className="flex shrink-0 items-center gap-1 rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500"><Play size={13}/> {emulatorSession ? "Emulator Live" : "Run Emulator"}</button><button onClick={fetchLogcat} className="flex shrink-0 items-center gap-1 rounded bg-slate-700 px-2 py-1 text-xs text-white"><Terminal size={13}/> Logcat</button><button onClick={() => setShowOutput(v => !v)} className="flex shrink-0 items-center gap-1 rounded bg-slate-700 px-2 py-1 text-xs text-white sm:hidden"><Terminal size={13}/> Output</button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-800 bg-[#0f172a] md:flex">
          <div className="flex h-9 items-center gap-2 border-b border-slate-800 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400"><FolderOpen size={14}/> Project</div>
          <div className="studio-scroll flex-1 overflow-auto p-2">
            <div className="mb-2 px-2 text-xs font-semibold text-slate-300">WebDAndroid</div>
            {tree.map((path) => <button key={path} onClick={() => openFile(path)} className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] ${activeFile === path ? 'bg-indigo-500/15 text-indigo-200' : 'text-slate-300 hover:bg-slate-800'}`}>{getFileIcon(path)}<span className="truncate">{path.split('/').pop()}</span></button>)}
          </div>
          <div className="border-t border-slate-800 p-2 text-[10px] text-slate-500"><Folder size={12} className="mr-1 inline"/> Gradle project structure</div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col bg-[#0b1120]">
          <div className="flex h-9 shrink-0 items-center overflow-x-auto border-b border-slate-800 bg-[#111827]">
            {openFiles.map((path) => <div key={path} className={`flex h-full items-center border-r border-slate-800 px-2 text-[11px] ${path === activeFile ? 'bg-[#0b1120] text-slate-100' : 'text-slate-400'}`}><button onClick={() => setActiveFile(path)} className="mr-2 flex items-center gap-1.5">{getFileIcon(path)}{path.split('/').pop()}</button><button onClick={() => setOpenFiles((old) => old.filter((p) => p !== path))} className="rounded p-0.5 hover:bg-slate-700"><X size={12}/></button></div>)}
          </div>
          <div className="min-h-0 flex-1">
            <MonacoCodeEditorClient filePath={activeFile} value={activeContent} onChange={updateFile} theme="vs-dark" wordWrap="on" />
          </div>
          <div className="flex h-8 shrink-0 items-center gap-2 border-t border-slate-800 bg-[#111827] px-3 text-[10px] text-slate-400"><Code2 size={12}/> {getLanguage(activeFile)} <span className="ml-auto">Ln 1 · Android editor</span></div>
          <div className={(showOutput ? "block " : "hidden ") + (expandedOutput ? "h-[45vh] md:h-64" : "h-32 md:h-36") + " shrink-0 overflow-hidden border-t border-slate-800 bg-[#090e18] font-mono text-[10px] text-slate-300"}>
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-800 bg-[#090e18] px-2 py-1.5 text-slate-200"><Terminal size={12}/> Build / Output Log <button type="button" onClick={() => setShowFullLog(true)} className="ml-auto rounded bg-slate-800 px-2 py-1 text-[10px]">Full log</button><button type="button" onClick={() => { navigator.clipboard?.writeText(logMessage); }} className="rounded bg-slate-800 px-2 py-1 text-[10px]">Copy</button></div>
            <pre className="h-[calc(100%-30px)] overflow-auto whitespace-pre-wrap break-words p-2 select-text">{logMessage || "No output yet."}</pre>
          </div>
        </section>

        <aside className="flex w-[320px] shrink-0 flex-col border-l border-slate-800 bg-[#0f172a] max-lg:hidden">
          <div className="flex h-9 items-center gap-2 border-b border-slate-800 px-3 text-xs font-semibold"><Eye size={14}/> Compose Preview <span className="ml-auto text-[10px] text-slate-500">#{previewCount}</span></div>
          <div className="flex flex-1 items-center justify-center overflow-auto p-3">
            <div className="relative h-[620px] w-[300px] max-h-full rounded-[36px] border-[8px] border-slate-700 bg-black p-2 shadow-2xl">
              <div className="relative flex h-full flex-col overflow-hidden rounded-[27px] bg-[#f7f7fb] text-slate-900">
                <div className="flex h-7 items-center justify-between bg-[#f7f7fb] px-4 text-[9px]"><span>9:41</span><span>●●● ▰</span></div>
                <div className="flex-1 overflow-auto p-5">
                  <div className="mb-5 mt-4 text-xl font-bold">{previewTitle}</div>
                  <p className="mb-6 text-sm text-slate-600">{previewText}</p>
                  <button onClick={() => setCounter((n) => n + 1)} className="rounded-lg bg-[#6750a4] px-4 py-2 text-xs font-semibold text-white shadow"> {previewButton.replace(/\d+/g, String(counter))} </button>
                  <div className="mt-5 text-xs text-slate-400">Preview state · counter {counter}</div>
                </div>
                <div className="h-5 bg-[#f7f7fb] flex items-center justify-center"><div className="h-1 w-24 rounded-full bg-slate-900/50"/></div>
              </div>
            </div>
          </div>
          <div className="border-t border-slate-800 p-3">
            <div className="mb-2 text-[10px] uppercase tracking-wide text-slate-500">Device</div>
            <select value={device} onChange={(e) => setDevice(e.target.value)} className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"><option>Pixel 8</option><option>Pixel 7</option><option>Pixel 6a</option><option>Pixel 5</option><option>Generic 6.1&quot;</option></select>
            <div className="mt-2 text-[10px] text-slate-500">Device profile: {device} · Mock preview</div>
          </div>
        </aside>
      </div>
    </div>
  );
}
