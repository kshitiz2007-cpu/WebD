'use client';

import { useEffect, useRef, useState } from 'react';
import RFB from '@novnc/novnc';

export default function AndroidEmulatorScreen({ sessionToken, onDisconnect }: { sessionToken: string; onDisconnect?: () => void }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rfbRef = useRef<any>(null);
  const [status, setStatus] = useState('Connecting to emulator display…');
  useEffect(() => {
    let disposed = false;
    const mount = mountRef.current;
    const base = process.env.NEXT_PUBLIC_ANDROID_EMULATOR_STREAM_URL;
    if (!mount || !base) {
      setStatus('Live stream not configured. Set NEXT_PUBLIC_ANDROID_EMULATOR_STREAM_URL to the emulator worker WebSocket URL.');
      return;
    }
    const ws = base.replace(/^http/, 'ws').replace(/\/$/, '') + '/ws/vnc?session=' + encodeURIComponent(sessionToken);
    import('@novnc/novnc').then(({ default: RFBClass }) => {
      if (disposed || !mount) return;
      const rfb = new RFBClass(mount, ws, { shared: true });
      rfb.scaleViewport = true;
      rfb.resizeSession = false;
      rfbRef.current = rfb;
      rfb.addEventListener('connect', () => setStatus('Connected · touch and mouse controls enabled'));
      rfb.addEventListener('disconnect', () => setStatus('Disconnected from emulator'));
      rfb.addEventListener('credentialsrequired', () => setStatus('Emulator VNC credentials required'));
    }).catch((e) => setStatus('Stream connection failed: ' + (e?.message || 'unknown error')));
    return () => {
      disposed = true;
      try { rfbRef.current?.disconnect(); } catch {}
      rfbRef.current = null;
    };
  }, [sessionToken]);
  return <section className="flex min-h-0 flex-1 flex-col bg-black">
    <div className="flex shrink-0 items-center justify-between border-b border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200">
      <span>{status}</span>{onDisconnect && <button onClick={onDisconnect} className="rounded bg-slate-700 px-2 py-1">Stop</button>}
    </div>
    <div ref={mountRef} className="min-h-0 flex-1 overflow-hidden [&>canvas]:h-full [&>canvas]:w-full" />
  </section>;
}
