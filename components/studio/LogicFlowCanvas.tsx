'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { LogicAction, LogicTrigger, VisualLogicRule } from '@/lib/studio/logic-engine';

type Choice<T extends string> = { value: T; label: string };
interface Props {
  rule: VisualLogicRule;
  triggers: Choice<LogicTrigger>[];
  actions: Choice<LogicAction>[];
  onChange: (patch: Partial<VisualLogicRule>) => void;
}
type Point = { x: number; y: number };
const NODE_W = 188;
const NODE_H = 104;
const initial = (index: number): Record<string, Point> => ({
  trigger: { x: 22, y: 34 + index * 0 },
  condition: { x: 260, y: 34 },
  yes: { x: 530, y: 4 },
  no: { x: 530, y: 164 },
});
const actionLabels: Record<string, string> = {
  show: 'Show element', hide: 'Hide element', toggle: 'Toggle element', setText: 'Set text',
  setTextFromValue: 'Copy event value', setValue: 'Set control value', increment: 'Increment',
  decrement: 'Decrement', navigate: 'Navigate', toast: 'Show toast', setState: 'Set global state',
  incrementState: 'Increment state', addToArray: 'Add to array', removeFromArray: 'Remove from array',
  persistState: 'Save state', loadState: 'Load state',
};

export default function LogicFlowCanvas({ rule, triggers, actions, onChange }: Props) {
  const [positions, setPositions] = useState<Record<string, Point>>(() => initial(0));
  const [dragging, setDragging] = useState<{ node: string; x: number; y: number } | null>(null);
  const [stateSnapshot, setStateSnapshot] = useState<Record<string, unknown> | null>(null);
  const [inspectorError, setInspectorError] = useState('Waiting for Preview state…');
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const canvasSize = { width: 760, height: 310 };

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (!dragging) return;
      setPositions((current) => ({
        ...current,
        [dragging.node]: {
          x: Math.max(0, Math.min(canvasSize.width - NODE_W, positions[dragging.node].x + event.clientX - dragging.x)),
          y: Math.max(0, Math.min(canvasSize.height - NODE_H, positions[dragging.node].y + event.clientY - dragging.y)),
        },
      }));
      setDragging({ ...dragging, x: event.clientX, y: event.clientY });
    };
    const onUp = () => setDragging(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging, canvasSize, positions]);

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== window && event.data?.type === 'studio:workflow-state' && event.data.state && typeof event.data.state === 'object') {
        setStateSnapshot(event.data.state);
        setInspectorError('');
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, []);

  const conditionLabel = useMemo(() => ({
    always: 'Always', equals: 'Equals', notEquals: 'Does not equal', contains: 'Contains',
    greaterThan: 'Greater than', lessThan: 'Less than', isEmpty: 'Is empty', isNotEmpty: 'Is not empty',
  }[rule.conditionOperator || 'always']), [rule.conditionOperator]);

  const startDrag = (node: string) => (event: React.MouseEvent) => {
    event.preventDefault();
    setDragging({ node, x: event.clientX, y: event.clientY });
  };
  const node = (key: string, title: string, subtitle: string, tone: string, content?: React.ReactNode) => {
    const point = positions[key];
    return <div onMouseDown={startDrag(key)} style={{ left: point.x, top: point.y, width: NODE_W, minHeight: NODE_H }} className={`absolute z-10 cursor-grab select-none overflow-hidden rounded-xl border bg-white shadow-lg active:cursor-grabbing ${tone}`}>
      <div className="border-b border-current/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider opacity-80">{title}</div>
      <div className="px-3 py-2"><div className="text-xs font-semibold text-slate-900">{subtitle}</div>{content}</div>
    </div>;
  };
  const edge = (from: string, to: string, label?: string, color = '#64748b') => {
    const a = positions[from], b = positions[to];
    const x1 = a.x + NODE_W, y1 = a.y + NODE_H / 2, x2 = b.x, y2 = b.y + NODE_H / 2;
    const mid = (x1 + x2) / 2;
    return <g key={from + to}><path d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`} fill="none" stroke={color} strokeWidth="2.5" /><path d={`M ${x2 - 7} ${y2 - 5} L ${x2} ${y2} L ${x2 - 7} ${y2 + 5}`} fill="none" stroke={color} strokeWidth="2.5" />{label && <text x={mid} y={(y1 + y2) / 2 - 8} fontSize="10" fill={color} textAnchor="middle">{label}</text>}</g>;
  };
  const branchEditor = (branch: 'yes' | 'no') => {
    const isYes = branch === 'yes';
    const action = isYes ? rule.action : (rule.elseAction || 'toast');
    const target = isYes ? rule.target : (rule.elseTarget || '');
    const value = isYes ? rule.value : (rule.elseValue || '');
    const set = (patch: Partial<VisualLogicRule>) => onChange(patch);
    return <div className="mt-2 space-y-1.5" onMouseDown={(e) => e.stopPropagation()}>
      <select aria-label={isYes ? 'IF action' : 'ELSE action'} value={action} onChange={(e) => set(isYes ? { action: e.target.value as LogicAction } : { elseAction: e.target.value as LogicAction })} className="w-full rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[10px] text-slate-700">
        {actions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
      <input aria-label={isYes ? 'IF target' : 'ELSE target'} value={target} onChange={(e) => set(isYes ? { target: e.target.value } : { elseTarget: e.target.value })} placeholder="Target / state key / route" className="w-full rounded-md border border-slate-200 px-1.5 py-1 text-[10px]" />
      <input aria-label={isYes ? 'IF value' : 'ELSE value'} value={value} onChange={(e) => set(isYes ? { value: e.target.value } : { elseValue: e.target.value })} placeholder="Value (optional)" className="w-full rounded-md border border-slate-200 px-1.5 py-1 text-[10px]" />
      {!isYes && <button type="button" onClick={() => onChange({ elseAction: undefined, elseTarget: '', elseValue: '' })} className="text-[10px] font-semibold text-rose-600">Remove ELSE branch</button>}
    </div>;
  };
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500"><span>Drag nodes to arrange the workflow · wires show execution paths</span><button type="button" onClick={() => setPositions(initial(0))} className="rounded-md border border-slate-200 px-2 py-1 font-semibold hover:bg-slate-50">Reset layout</button></div>
    <div className="relative overflow-auto rounded-xl border border-slate-700 bg-slate-950" style={{ minHeight: 330 }}>
      <div className="relative" style={{ width: Math.max(canvasSize.width, 750), height: canvasSize.height }}>
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`} preserveAspectRatio="none">
          {edge('trigger', 'condition')}
          {edge('condition', 'yes', 'IF true', '#34d399')}
          {edge('condition', 'no', 'ELSE', '#fbbf24')}
        </svg>
        {node('trigger', '01 · Trigger', triggers.find((item) => item.value === rule.trigger)?.label || rule.trigger, 'border-blue-400/50 text-blue-300', <p className="mt-1 truncate text-[10px] text-slate-500">{rule.componentLabel}</p>)}
        {node('condition', '02 · Condition', conditionLabel, 'border-violet-400/50 text-violet-300', <p className="mt-1 truncate text-[10px] text-slate-500">{rule.conditionValue || 'No comparison value'}</p>)}
        {node('yes', '03 · IF true', actionLabels[rule.action] || rule.action, 'border-emerald-400/50 text-emerald-300', branchEditor('yes'))}
        {node('no', '04 · ELSE', rule.elseAction ? actionLabels[rule.elseAction] || rule.elseAction : 'No action configured', 'border-amber-400/50 text-amber-300', branchEditor('no'))}
      </div>
    </div>
    <section className="overflow-hidden rounded-xl border border-slate-200">
      <button type="button" onClick={() => setInspectorOpen((value) => !value)} className="flex w-full items-center justify-between bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700"><span>Live state inspector</span><span>{inspectorOpen ? '−' : '+'}</span></button>
      {inspectorOpen && <div className="p-3">
        {inspectorError && <p className="text-[10px] text-slate-500">{inspectorError} Open Preview → Interact and trigger a workflow to stream state here.</p>}
        <pre className="max-h-48 overflow-auto rounded-lg bg-slate-950 p-3 text-[10px] leading-relaxed text-emerald-300">{JSON.stringify(stateSnapshot || {}, null, 2)}</pre>
        <div className="mt-2 flex justify-end"><button type="button" onClick={() => { setStateSnapshot(null); setInspectorError('Waiting for next Preview state update…'); }} className="text-[10px] font-semibold text-slate-500">Clear inspector</button></div>
      </div>}
    </section>
  </div>;
}
