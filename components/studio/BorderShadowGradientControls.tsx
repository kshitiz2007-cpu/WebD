'use client';

import React, { useEffect, useMemo, useState } from 'react';

type Props = {
  selectionKey: string;
  borderWidth: number;
  onPreview: (styles: Record<string, string | null>) => void;
  onCommit: (styles: Record<string, string | null>) => void;
};

type SavedHexColors = {
  border: string[];
  shadow: string[];
};

const STORAGE_KEY = 'atelier_studio_border_shadow_hex_v1';
const DEFAULT_BORDER = ['#8B5CF6', '#06B6D4', '#F472B6'];
const DEFAULT_SHADOW = ['#8B5CF6', '#06B6D4', '#F472B6'];
const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

function readSavedColors(): SavedHexColors {
  if (typeof window === 'undefined') return { border: [], shadow: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { border: [], shadow: [] };
    const parsed = JSON.parse(raw) as Partial<SavedHexColors>;
    const clean = (values: unknown) =>
      Array.isArray(values)
        ? Array.from(new Set(values.filter((value): value is string => typeof value === 'string' && HEX_PATTERN.test(value))))
        : [];
    return { border: clean(parsed.border), shadow: clean(parsed.shadow) };
  } catch {
    return { border: [], shadow: [] };
  }
}

export default function BorderShadowGradientControls({ selectionKey, borderWidth, onPreview, onCommit }: Props) {
  const [borderStops, setBorderStops] = useState(DEFAULT_BORDER);
  const [shadowStops, setShadowStops] = useState(DEFAULT_SHADOW);
  const [angle, setAngle] = useState(135);
  const [blur, setBlur] = useState(28);
  const [spread, setSpread] = useState(1);
  const [savedColors, setSavedColors] = useState<SavedHexColors>({ border: [], shadow: [] });
  const [activeSelection, setActiveSelection] = useState(selectionKey);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    setSavedColors(readSavedColors());
  }, []);

  useEffect(() => {
    if (activeSelection === selectionKey) return;
    setActiveSelection(selectionKey);
    setBorderStops(DEFAULT_BORDER);
    setShadowStops(DEFAULT_SHADOW);
    setAngle(135);
    setBlur(28);
    setSpread(1);
  }, [selectionKey, activeSelection]);

  const persistSavedColors = (next: SavedHexColors) => {
    setSavedColors(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      setSaveMessage('Could not save colors in this browser');
    }
  };

  const saveHex = (kind: 'border' | 'shadow', color: string) => {
    if (!HEX_PATTERN.test(color)) return;
    const next = {
      ...savedColors,
      [kind]: [color.toUpperCase(), ...savedColors[kind].filter((item) => item !== color.toUpperCase())].slice(0, 16),
    };
    persistSavedColors(next);
    setSaveMessage(`${color.toUpperCase()} saved to ${kind} colors`);
  };

  const removeSavedHex = (kind: 'border' | 'shadow', color: string) => {
    persistSavedColors({ ...savedColors, [kind]: savedColors[kind].filter((item) => item !== color) });
    setSaveMessage('');
  };

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

  const applySavedHex = (kind: 'border' | 'shadow', index: number, color: string) => {
    updateStop(kind, index, color);
  };

  const renderStops = (kind: 'border' | 'shadow', stops: string[]) => (
    <div className="space-y-2">
      {stops.map((color, index) => (
        <div key={index} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2">
          <input
            type="color"
            aria-label={`${kind} gradient stop ${index + 1} color`}
            value={HEX_PATTERN.test(color) ? color : '#8B5CF6'}
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
              if (!HEX_PATTERN.test(value)) {
                const setter = kind === 'border' ? setBorderStops : setShadowStops;
                setter((current) => current.map((item, i) => i === index ? stops[index] : item));
              } else {
                updateStop(kind, index, value.toUpperCase());
              }
            }}
            className="h-8 min-w-0 rounded-md border border-slate-200 px-2 font-mono text-[11px] uppercase"
          />
          <button
            type="button"
            disabled={!HEX_PATTERN.test(color)}
            onClick={() => saveHex(kind, color.toUpperCase())}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-40"
            title="Save this HEX color for later"
          >
            Save HEX
          </button>
        </div>
      ))}
      {savedColors[kind].length > 0 && (
        <div className="space-y-1.5 rounded-md border border-slate-200 bg-white p-2">
          <div className="text-[10px] font-semibold text-slate-600">Saved {kind} HEX colors · tap to use on Stop 1</div>
          <div className="flex flex-wrap gap-1.5">
            {savedColors[kind].map((color) => (
              <div key={color} className="group inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white py-0.5 pl-1 pr-1.5">
                <button
                  type="button"
                  onClick={() => applySavedHex(kind, 0, color)}
                  className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-700"
                  title={`Apply ${color} to Stop 1`}
                >
                  <span className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ backgroundColor: color }} />
                  {color}
                </button>
                <button
                  type="button"
                  onClick={() => removeSavedHex(kind, color)}
                  aria-label={`Remove saved ${kind} color ${color}`}
                  className="text-[10px] text-slate-400 hover:text-rose-600"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center gap-3">
        {stops.length < 4 && (
          <button
            type="button"
            onClick={() => (kind === 'border' ? setBorderStops : setShadowStops)((current) => [...current, '#F59E0B'])}
            className="text-[10px] font-semibold text-blue-600 hover:underline"
          >
            + Add 4th color stop
          </button>
        )}
        {stops.length > 3 && (
          <button
            type="button"
            onClick={() => (kind === 'border' ? setBorderStops : setShadowStops)((current) => current.slice(0, 3))}
            className="text-[10px] font-semibold text-rose-600 hover:underline"
          >
            Remove 4th stop
          </button>
        )}
      </div>
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
          <label className="col-span-2 space-y-1 text-[10px] text-slate-600">
            Spread ({spread}px)
            <input type="range" min="0" max="12" value={spread} onChange={(event) => setSpread(Number(event.target.value))} className="w-full accent-blue-600" />
          </label>
        </div>
        <div className="h-9 rounded-md border border-slate-200 bg-white" style={{ boxShadow: shadow }} />
        <div className="flex gap-1.5">
          <button type="button" onClick={() => onPreview(shadowStyles)} className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-semibold text-slate-700">Preview shadow</button>
          <button type="button" onClick={() => onCommit(shadowStyles)} className="flex-1 rounded-md bg-blue-600 px-2 py-1.5 text-[10px] font-semibold text-white">Apply shadow</button>
        </div>
      </div>
      {saveMessage && <p role="status" className="text-[10px] text-emerald-700">{saveMessage}</p>}
    </section>
  );
}
