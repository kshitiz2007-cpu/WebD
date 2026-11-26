'use client';

import React, { useMemo, useState } from 'react';
import { Copy, PenTool, Check, X, Undo2 } from 'lucide-react';

type Point = { x: number; y: number; inX: number; inY: number; outX: number; outY: number };

function pathFromPoints(points: Point[], closed: boolean, curved: boolean) {
  if (!points.length) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1], cur = points[i];
    if (cur.inX || cur.inY || prev.outX || prev.outY || curved) {
      d += ` C ${prev.x + prev.outX} ${prev.y + prev.outY}, ${cur.x + cur.inX} ${cur.y + cur.inY}, ${cur.x} ${cur.y}`;
    } else d += ` L ${cur.x} ${cur.y}`;
  }
  if (closed && points.length > 2) {
    const last = points[points.length - 1], first = points[0];
    d += ` C ${last.x + last.outX} ${last.y + last.outY}, ${first.x + first.inX} ${first.y + first.inY}, ${first.x} ${first.y} Z`;
  }
  return d;
}

export default function VectorPenOverlay({ width, height }: { width: number; height: number }) {
  const [active, setActive] = useState(false);
  const [points, setPoints] = useState<Point[]>([]);
  const [closed, setClosed] = useState(false);
  const [curved, setCurved] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ index: number; kind: 'node' | 'handle'; startX: number; startY: number; point: Point } | null>(null);
  const d = useMemo(() => pathFromPoints(points, closed, curved), [points, closed, curved]);
  const reset = () => { setPoints([]); setClosed(false); setSelected(null); setDrag(null); };
  const finish = () => { if (points.length > 2) setClosed(true); setActive(false); };
  const copy = async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
    try { await navigator.clipboard.writeText(svg); } catch { await navigator.clipboard.writeText(d); }
  };
  const pointAt = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * width / rect.width, y: (e.clientY - rect.top) * height / rect.height };
  };
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!active || drag) return;
    e.preventDefault();
    const p = pointAt(e);
    if (points.length > 2 && Math.hypot(p.x - points[0].x, p.y - points[0].y) < 14) { finish(); return; }
    setPoints(prev => [...prev, { ...p, inX: 0, inY: 0, outX: 0, outY: 0 }]);
    setSelected(points.length);
  };
  const onNodeDown = (e: React.PointerEvent, index: number) => {
    e.stopPropagation(); e.preventDefault();
    setSelected(index);
    setDrag({ index, kind: 'node', startX: e.clientX, startY: e.clientY, point: points[index] });
    (e.currentTarget as SVGElement).setPointerCapture?.(e.pointerId);
  };
  const onHandleDown = (e: React.PointerEvent, index: number) => {
    e.stopPropagation(); e.preventDefault();
    setSelected(index);
    setDrag({ index, kind: 'handle', startX: e.clientX, startY: e.clientY, point: points[index] });
    (e.currentTarget as SVGElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = (e.clientX - drag.startX) * width / rect.width;
    const dy = (e.clientY - drag.startY) * height / rect.height;
    setPoints(prev => prev.map((p, i) => {
      if (i !== drag.index) return p;
      if (drag.kind === 'node') return { ...p, x: drag.point.x + dx, y: drag.point.y + dy };
      return { ...p, outX: dx, outY: dy, inX: -dx, inY: -dy };
    }));
  };
  return (
    <div className="pointer-events-none absolute inset-0 z-[70]">
      <div className="pointer-events-auto absolute left-2 top-2 z-10 flex items-center gap-1 rounded-lg border border-indigo-200 bg-white/95 p-1.5 shadow-lg backdrop-blur">
        <button onClick={() => { setActive(v => !v); setClosed(false); }} className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold ${active ? 'bg-indigo-600 text-white' : 'text-slate-700 hover:bg-slate-100'}`}><PenTool className="h-3.5 w-3.5"/> Pen {active ? 'On' : ''}</button>
        <button onClick={() => setCurved(v => !v)} className={`rounded px-2 py-1 text-xs ${curved ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}>Curve</button>
        <button onClick={finish} disabled={points.length < 2} className="rounded px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-40">Finish</button>
        <button onClick={() => setPoints(p => p.slice(0,-1))} disabled={!points.length} title="Undo node" className="rounded p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40"><Undo2 className="h-3.5 w-3.5"/></button>
        <button onClick={copy} disabled={!d} title="Copy SVG path" className="rounded p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40"><Copy className="h-3.5 w-3.5"/></button>
        <button onClick={reset} title="Clear vector" className="rounded p-1 text-slate-600 hover:bg-slate-100"><X className="h-3.5 w-3.5"/></button>
        <span className="px-1 text-[10px] text-slate-500">{points.length} nodes</span>
      </div>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="absolute inset-0 h-full w-full" style={{ cursor: active ? 'crosshair' : 'default', pointerEvents: active ? 'auto' : 'none' }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)}>
        <path d={d} fill={closed ? 'rgba(99,102,241,.08)' : 'none'} stroke="#6366f1" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeDasharray={active && !closed ? '5 4' : undefined}/>
        {points.map((p,i) => <g key={i}>
          {selected === i && (curved || p.outX !== 0 || p.outY !== 0) && <g>
            <line x1={p.x} y1={p.y} x2={p.x+p.outX} y2={p.y+p.outY} stroke="#94a3b8" strokeDasharray="3 3"/>
            <circle cx={p.x+p.outX} cy={p.y+p.outY} r={5} fill="white" stroke="#6366f1" onPointerDown={e=>onHandleDown(e,i)} style={{cursor:'grab', pointerEvents:'auto'}}/>
          </g>}
          <circle cx={p.x} cy={p.y} r={5} fill={selected===i?'#4f46e5':'white'} stroke="#4f46e5" strokeWidth={2} onPointerDown={e=>onNodeDown(e,i)} style={{cursor:'move', pointerEvents:'auto'}}/>
        </g>)}
      </svg>
    </div>
  );
}
