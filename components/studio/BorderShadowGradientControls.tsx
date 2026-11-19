'use client';

import React, { useMemo, useState } from 'react';

type Props = {
  selectionKey: string;
  borderWidth: number;
  onPreview: (styles: Record<string, string | null>) => void;
  onCommit: (styles: Record<string, string | null>) => void;
};

const DEFAULT_BORDER = ['#8B5CF6', '#06B6D4', '#F472B6'];
const DEFAULT_SHADOW = ['#8B5CF6', '#06B6D4', '#F472B6'];

export default function BorderShadowGradientControls({ selectionKey, borderWidth, onPreview, onCommit }: Props) {
  const [borderStops, setBorderStops] = useState(DEFAULT_BORDER);
  const [shadowStops, setShadowStops] = useState(DEFAULT_SHADOW);
  const [angle, setAngle] = useState(135);
  const [blur, setBlur] = useState(28);
  const [spread, setSpread] = useState(1);
  const [lastSelection, setLastSelection] = useState(selectionKey);

  if (lastSelection !== selectionKey) {
    setLastSelection(selectionKey);
    setBorderStops(DEFAULT_BORDER);
    setShadowStops(DEFAULT_SHADOW);
    setAngle(135);
    setBlur(28);
    setSpread(1);
  }

  const gradient = (stops: string[]) => `linear-gradient(${angle}deg, ${stops.join(', ')})`;
  const shadow = useMemo(
    () => shadowStops.map((color, index) => {
      const layerBlur = Math.max(2, Math.round(blur * (0.45 + index * 0.28)));
      const layerSpread = spread + index * 2;
      return `0 0 ${layerBlur}px ${layerSpread}px ${color}`;
    }).join(', '),
    [shadowStops, blur, spread]
  );

  const updateStop = (kind: 'border' | 'shadow', index: number, value: string) => {
    const setter = kind === 'border' ? setBorderStops : setShadowStops;
    setter((current) => current.map((color, i) => i === index ? value.toUpperCase() : color));
  };

  const renderStops = (kind: 'border' | 'shadow', stops: string[]) => (
    <div className="space-y-2">
      {stops.map((color, index) => (
        <div key={index} className="grid grid-cols-[28px_1fr_auto] items-center gap-2">
          <input
            type="color"
            aria-label={`${kind} gradient stop ${index + 1} color`}
            value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : '#8B5CF6'}
            onChange={(event) => updateStop(kind, index, event.target.value)}
            className="h-8 w-7 cursor-pointer rounded border border-slate-200 p-0.5"
          />
          <input
            aria-label={`${kind} gradient stop ${index + 1} HEX`}
            value={color}
            maxLength={7}
            onChange={(event) => updateStop(kind, index, event.target.value)}
            onBlur={(event) => {
              const value = event.target.value.trim();
              if (!/^#[0-9a-fA-F]{6}$/.test(value)) {
                const setter = kind === 'border' ? setBorderStops : setShadowStops;
                setter((current) => current.map((item, i) => i === index ? stops[index] : item));
              }
            }}
            className="h-8 min-w-0 rounded-md border border-slate-200 px-2 font-mono text-[11px] uppercase"
          />
          <span className="text-[10px] text-slate-400">Stop {index + 1}</span>
        </div>
      ))}
      {stops.length < 4 && (
        <button
          type="button"
          onClick={() => (kind === 'border' ? setBorderStops : setShadowStops)((current) => [...current, '#F59E0B'])}
          className="text-[10px] font-semibold text-blue-600 hover:underline"
        >
          + Add 4th color stop
        </button>
      )}
    </div>
  );

  const borderStyles = {
    borderImage: `${gradient(borderStops)} 1`,
    borderStyle: 'solid',
    borderWidth: `${Math.max(1, borderWidth)}px`,
  };
  const shadowStyles = { boxShadow: shadow };

  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-[11px] font-semibold text-slate-700">Gradient Border</h4>
          <span className="text-[10px] text-slate-400">3–4 HEX stops</span>
        </div>
        {renderStops('border', borderStops)}
        <div className="h-7 rounded-md" style={{ border: `${Math.max(2, borderWidth)}px solid transparent`, borderImage: `${gradient(borderStops)} 1` }} />
        <div className="flex gap-1.5">
          <button type="button" onClick={() => onPreview(borderStyles)} className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-semibold text-slate-700">Preview border</button>
          <button type="button" onClick={() => onCommit(borderStyles)} className="flex-1 rounded-md bg-blue-600 px-2 py-1.5 text-[10px] font-semibold text-white">Apply border</button>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-3">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-[11px] font-semibold text-slate-700">Gradient Color Shadow</h4>
          <span className="text-[10px] text-slate-400">3–4 HEX stops</span>
        </div>
        {renderStops('shadow', shadowStops)}
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-[10px] text-slate-600">
            Direction ({angle}°)
            <input type="range" min="0" max="360" value={angle} onChange={(event) => setAngle(Number(event.target.value))} className="w-full accent-blue-600" />
          </label>
          <label className="space-y-1 text-[10px] text-slate-600">
            Blur ({blur}px)
            <input type="range" min="4" max="64" value={blur} onChange={(event) => setBlur(Number(event.target.value))} className="w-full accent-blue-600" />
          </label>
        </div>
        <div className="h-9 rounded-md border border-slate-200 bg-white" style={{ boxShadow: shadow }} />
        <div className="flex gap-1.5">
          <button type="button" onClick={() => onPreview(shadowStyles)} className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-semibold text-slate-700">Preview shadow</button>
          <button type="button" onClick={() => onCommit(shadowStyles)} className="flex-1 rounded-md bg-blue-600 px-2 py-1.5 text-[10px] font-semibold text-white">Apply shadow</button>
        </div>
      </div>
    </section>
  );
}
