'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Code2, Folder, FolderOpen, Smartphone, Play, Hammer, RefreshCw, Plus, ChevronDown, FileCode2, FileJson, FileText, Settings, Terminal, Eye, X } from 'lucide-react';
import MonacoCodeEditorClient from './MonacoCodeEditorClient';

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

export default function AndroidIDEPanel() {
  const [files, setFiles] = useState<AndroidFiles>(starterFiles);\n  const [storageReady, setStorageReady] = useState(false);\n\n  useEffect(() => {\n    try {\n      const saved = localStorage.getItem('webd-android-project-phase1');\n      if (saved) {\n        const parsed = JSON.parse(saved) as AndroidFiles;\n        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) setFiles(parsed);\n      }\n    } catch { /* Ignore malformed local draft data and keep the starter project. */ }\n    setStorageReady(true);\n  }, []);\n\n  useEffect(() => {\n    if (!storageReady) return;\n    try { localStorage.setItem('webd-android-project-phase1', JSON.stringify(files)); }\n    catch { setLogMessage('Could not persist project locally (browser storage may be full or disabled).'); }\n  }, [files, storageReady]);
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

  const tree = useMemo(() => Object.keys(files).sort((a, b) => a.localeCompare(b)), [files]);
  const activeContent = files[activeFile] || '';

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
    setLogMessage('Sending project to Gradle build worker...');
    try {
      const response = await fetch('/api/android/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setLogMessage(result.log || result.error || 'Gradle build failed.');
        return;
      }
      const binary = atob(result.apkBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/vnd.android.package-archive' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.fileName || 'app-debug.apk';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setLogMessage('Build successful! APK downloaded (' + Math.round((result.sizeBytes || bytes.length) / 1024) + ' KB).\n' + (result.log || 'Gradle build finished.'));
    } catch (error) {
      setLogMessage(error instanceof Error ? error.message : 'Android build service unavailable.');
    } finally {
      setIsBuilding(false);
    }
  };

  const handleRun = () => {
    setLogMessage('Phase 1: preview simulator started. Real Gradle build and emulator run will be enabled in later phases.');
    refreshPreview();
  };

  return (
    <div className="absolute inset-0 z-50 flex min-h-0 flex-col bg-[#0b1120] text-slate-200">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-slate-800 bg-[#111827] px-3">
        <div className="flex items-center gap-2">
          <Smartphone size={16} className="text-emerald-400" />
          <span className="text-sm font-semibold">Android Studio Mode</span>
          <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-300">PHASE 1</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="relative">
            <button onClick={() => setShowProjectMenu((v) => !v)} className="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-slate-800"><Plus size={14}/> New project <ChevronDown size={12}/></button>
            {showProjectMenu && <div className="absolute right-0 top-8 z-50 w-44 rounded-md border border-slate-700 bg-slate-900 p-1 shadow-xl">
              <button onClick={() => newProject('empty')} className="w-full rounded px-2 py-2 text-left text-xs hover:bg-slate-800">Empty Compose project</button>
              <button onClick={() => newProject('counter')} className="w-full rounded px-2 py-2 text-left text-xs hover:bg-slate-800">Counter starter</button>
              <button onClick={() => newProject('login')} className="w-full rounded px-2 py-2 text-left text-xs hover:bg-slate-800">Login UI starter</button>
            </div>}
          </div>
          <button onClick={createFile} className="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-slate-800"><Plus size={14}/> File</button>
          <button onClick={refreshPreview} className="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-slate-800"><RefreshCw size={14}/> Preview</button>
          <button onClick={handleBuildApk} disabled={isBuilding} className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"><Hammer size={13}/> {isBuilding ? "Building…" : "Build APK"}</button><button onClick={handleRun} className="flex items-center gap-1 rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500"><Play size={13}/> Run Preview</button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-800 bg-[#0f172a] md:flex">
          <div className="flex h-9 items-center gap-2 border-b border-slate-800 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400"><FolderOpen size={14}/> Project</div>
          <div className="studio-scroll flex-1 overflow-auto p-2">
            <div className="mb-2 px-2 text-xs font-semibold text-slate-300">WebDAndroid</div>
            {tree.map((path) => <button key={path} onClick={() => openFile(path)} className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] ${activeFile === path ? 'bg-indigo-500/15 text-indigo-200' : 'text-slate-300 hover:bg-slate-800'}>{getFileIcon(path)}<span className="truncate">{path.split('/').pop()}</span></button>)}
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
          <div className="flex h-8 shrink-0 items-center gap-2 border-t border-slate-800 bg-[#111827] px-3 text-[10px] text-slate-400"><Code2 size={12}/> {getLanguage(activeFile)} <span className="ml-auto">Ln 1 · Phase 1 editor</span></div>
          <div className="h-32 shrink-0 overflow-auto border-t border-slate-800 bg-[#090e18] p-2 font-mono text-[10px] text-slate-400 md:h-36">
            <div className="mb-1 flex items-center gap-1 text-slate-300"><Terminal size={12}/> Output</div>
            {logMessage}
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
