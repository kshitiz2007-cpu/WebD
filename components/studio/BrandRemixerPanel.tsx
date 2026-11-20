'use client';

import React from 'react';
import { Check, Moon, RotateCcw, Sparkles, Sun, X } from 'lucide-react';
import {
  BRAND_FONT_PAIRINGS,
  BRAND_PALETTES,
  BRAND_RADIUS_SCALES,
  BRAND_SHADOW_MOODS,
  BrandRemixConfig,
} from '@/lib/studio/brand-remixer';

interface BrandRemixerPanelProps {
  config: BrandRemixConfig;
  onApplyConfig: (next: BrandRemixConfig, actionLabel: string) => void;
  onResetRemix: () => void;
  onClose: () => void;
  isBottomSheet?: boolean;
}

export default function BrandRemixerPanel({
  config,
  onApplyConfig,
  onResetRemix,
  onClose,
  isBottomSheet = false,
}: BrandRemixerPanelProps) {
  const update = (patch: Partial<BrandRemixConfig>, label: string) => {
    onApplyConfig({ ...config, ...patch }, label);
  };

  return (
    <aside
      aria-label="Brand Remixer Studio"
      data-testid="brand-remixer-panel"
      className={`flex h-full flex-col bg-white ${
        isBottomSheet
          ? 'w-full rounded-t-2xl border-t border-slate-200'
          : 'w-[340px] border-l border-slate-200'
      }`}
    >
      {isBottomSheet && (
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-slate-300" aria-hidden="true" />
      )}

      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-slate-900">1-Tap Brand Remixer</h2>
            <p className="truncate text-[11px] text-slate-500">
              Harmonize palette, fonts, corners &amp; depth
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Brand Remixer"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 space-y-5 overflow-y-auto p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {/* Light / Dark Mode Switch */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Surface Theme Mode</span>
            <span className="font-mono text-[10px] uppercase text-slate-400">
              {config.themeMode}
            </span>
          </div>
          <div
            className="grid grid-cols-2 gap-1.5 rounded-xl border border-slate-200 bg-slate-100 p-1"
            role="group"
            aria-label="Brand surface theme mode"
          >
            <button
              type="button"
              onClick={() => update({ themeMode: 'light' }, 'Switched Brand Theme to Light')}
              aria-pressed={config.themeMode === 'light'}
              className={`inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-colors ${
                config.themeMode === 'light'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sun className="h-3.5 w-3.5 text-amber-500" />
              <span>Light Mode</span>
            </button>
            <button
              type="button"
              onClick={() => update({ themeMode: 'dark' }, 'Switched Brand Theme to Dark')}
              aria-pressed={config.themeMode === 'dark'}
              className={`inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-colors ${
                config.themeMode === 'dark'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Moon className="h-3.5 w-3.5 text-sky-400" />
              <span>Dark Mode</span>
            </button>
          </div>
        </section>

        {/* Curated Color Palettes */}
        <section className="space-y-2">
          <div className="text-xs font-semibold text-slate-700">Curated Color Palettes</div>
          <div className="grid grid-cols-1 gap-2">
            {BRAND_PALETTES.map((palette) => {
              const active = config.paletteId === palette.id;
              return (
                <button
                  key={palette.id}
                  type="button"
                  onClick={() =>
                    update({ paletteId: palette.id }, `Applied ${palette.name} palette`)
                  }
                  aria-pressed={active}
                  className={`flex items-center justify-between gap-3 rounded-xl border p-2.5 text-left transition-all ${
                    active
                      ? 'border-blue-600 bg-blue-50/60 ring-1 ring-blue-200'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-900">{palette.name}</span>
                      {active && <Check className="h-3.5 w-3.5 text-blue-600 shrink-0" />}
                    </div>
                    <p className="truncate text-[11px] text-slate-500">{palette.tagline}</p>
                  </div>
                  <div className="flex shrink-0 items-center -space-x-1">
                    {palette.swatches.map((hex, idx) => (
                      <span
                        key={`${palette.id}-${idx}`}
                        className="h-5 w-5 rounded-full border border-slate-300/80 shadow-2xs"
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Font Pairings */}
        <section className="space-y-2">
          <div className="text-xs font-semibold text-slate-700">Typography Pairings</div>
          <div className="grid grid-cols-1 gap-1.5">
            {BRAND_FONT_PAIRINGS.map((pair) => {
              const active = config.fontPairingId === pair.id;
              return (
                <button
                  key={pair.id}
                  type="button"
                  onClick={() =>
                    update({ fontPairingId: pair.id }, `Applied ${pair.name} font pairing`)
                  }
                  aria-pressed={active}
                  className={`flex min-h-[44px] items-center justify-between rounded-xl border px-3 py-2 text-left transition-colors ${
                    active
                      ? 'border-blue-600 bg-blue-50/60 text-blue-900'
                      : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold">{pair.name}</div>
                    <div className="text-[11px] text-slate-500">{pair.mood}</div>
                  </div>
                  {active && <Check className="h-3.5 w-3.5 shrink-0 text-blue-600" />}
                </button>
              );
            })}
          </div>
        </section>

        {/* Radius Scales */}
        <section className="space-y-2">
          <div className="text-xs font-semibold text-slate-700">Corner Radius Scale</div>
          <div className="grid grid-cols-3 gap-2">
            {BRAND_RADIUS_SCALES.map((scale) => {
              const active = config.radiusScaleId === scale.id;
              return (
                <button
                  key={scale.id}
                  type="button"
                  onClick={() =>
                    update({ radiusScaleId: scale.id }, `Set corner radius to ${scale.label}`)
                  }
                  aria-pressed={active}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-center transition-colors ${
                    active
                      ? 'border-blue-600 bg-blue-50/70 text-blue-800'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span
                    className="h-6 w-10 border-2 border-current bg-white/80"
                    style={{ borderRadius: scale.md }}
                    aria-hidden="true"
                  />
                  <span className="text-xs font-semibold">{scale.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Shadow Moods */}
        <section className="space-y-2">
          <div className="text-xs font-semibold text-slate-700">Shadow &amp; Depth Mood</div>
          <div className="grid grid-cols-2 gap-2">
            {BRAND_SHADOW_MOODS.map((mood) => {
              const active = config.shadowMoodId === mood.id;
              return (
                <button
                  key={mood.id}
                  type="button"
                  onClick={() =>
                    update({ shadowMoodId: mood.id }, `Set shadow mood to ${mood.label}`)
                  }
                  aria-pressed={active}
                  className={`flex flex-col items-start rounded-xl border p-2.5 text-left transition-colors ${
                    active
                      ? 'border-blue-600 bg-blue-50/70 text-blue-900'
                      : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-xs font-semibold">{mood.label}</span>
                  <span className="mt-0.5 text-[10px] leading-snug text-slate-500">
                    {mood.summary}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2.5">
        <button
          type="button"
          onClick={onResetRemix}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-100"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Reset Remix</span>
        </button>
        <span className="text-[11px] font-medium text-emerald-700">Live-synced to Global CSS</span>
      </div>
    </aside>
  );
}
