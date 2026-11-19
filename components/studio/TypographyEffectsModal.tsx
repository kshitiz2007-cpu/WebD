'use client';

import React, { useState } from 'react';
import { PackagePlus, Sparkles, Type, X } from 'lucide-react';
import { parseNpmInstallCommand } from '@/lib/studio/library-importer';

export type TextMotionPreset = 'none' | 'fade-up' | 'fade-in' | 'slide-left' | 'slide-right' | 'pop' | 'float' | 'glow' | 'wave';

interface TypographyEffectsModalProps {
  open: boolean;
  hasSelection: boolean;
  onClose: () => void;
  onApplyFont: (family: string) => void;
  onApplyMotion: (preset: TextMotionPreset, duration: number, delay: number) => void;
  onInstallNpmPackage: (params: { command: string; kind: 'font' | 'motion'; fontFamily?: string; cssImport?: string; componentName?: string; componentExport?: string }) => { ok: boolean; error?: string };
}

const FONT_SUGGESTIONS = ['Inter', 'Poppins', 'Roboto', 'Montserrat', 'Playfair Display', 'DM Sans', 'Lato', 'Oswald', 'Merriweather', 'Space Grotesk'];
const MOTIONS: Array<{ id: TextMotionPreset; label: string; hint: string }> = [
  { id: 'none', label: 'Remove motion', hint: 'Clear animation' },
  { id: 'fade-up', label: 'Fade Up', hint: 'Soft entrance from below' },
  { id: 'fade-in', label: 'Fade In', hint: 'Simple opacity reveal' },
  { id: 'slide-left', label: 'Slide Left', hint: 'Enter from right' },
  { id: 'slide-right', label: 'Slide Right', hint: 'Enter from left' },
  { id: 'pop', label: 'Pop', hint: 'Scale and fade entrance' },
  { id: 'float', label: 'Float', hint: 'Gentle continuous movement' },
  { id: 'glow', label: 'Glow', hint: 'Soft glowing loop' },
  { id: 'wave', label: 'Wave', hint: 'Subtle vertical text motion' },
];

export default function TypographyEffectsModal({ open, hasSelection, onClose, onApplyFont, onApplyMotion, onInstallNpmPackage }: TypographyEffectsModalProps) {
  const [font, setFont] = useState('Inter');
  const [customFont, setCustomFont] = useState('');
  const [duration, setDuration] = useState(0.8);
  const [delay, setDelay] = useState(0);
  const [motion, setMotion] = useState<TextMotionPreset>('fade-up');
  const [npmKind, setNpmKind] = useState<'font' | 'motion'>('motion');
  const [npmCommand, setNpmCommand] = useState('npm install motion');
  const [npmFontFamily, setNpmFontFamily] = useState('');
  const [npmCssImport, setNpmCssImport] = useState('');
  const [npmComponentName, setNpmComponentName] = useState('');
  const [npmComponentExport, setNpmComponentExport] = useState('default');
  const [npmNotice, setNpmNotice] = useState('');
  const [npmError, setNpmError] = useState('');
  if (!open) return null;
  const family = (customFont.trim() || font).replace(/[<>;{}]/g, '');
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-3" role="dialog" aria-modal="true" aria-labelledby="typefx-title">
      <div className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2"><span className="rounded-lg bg-violet-100 p-2 text-violet-700"><Type className="h-4 w-4" /></span><div><h2 id="typefx-title" className="text-sm font-semibold text-slate-900">Fonts & Motion Text</h2><p className="text-[11px] text-slate-500">Import Google Fonts and apply motion presets visually</p></div></div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-5 p-4">
          <section className="space-y-2 rounded-xl border border-slate-200 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800"><Type className="h-4 w-4 text-violet-600" /> Import & apply font</div>
            <p className="text-[11px] text-slate-500">Choose a font or enter a Google Fonts family name. It will be added to your project's CSS and applied to the selected element.</p>
            <select value={font} onChange={e => { setFont(e.target.value); setCustomFont(''); }} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs">
              {FONT_SUGGESTIONS.map(item => <option key={item}>{item}</option>)}
            </select>
            <input value={customFont} onChange={e => setCustomFont(e.target.value)} placeholder="Or enter font family, e.g. 'Cormorant Garamond'" className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs" />
            <button type="button" disabled={!hasSelection || !family} onClick={() => onApplyFont(family)} className="w-full rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40">Import font & apply to selected text</button>
          </section>
          <section className="space-y-3 rounded-xl border border-violet-200 bg-violet-50/40 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800"><PackagePlus className="h-4 w-4 text-violet-600" /> Import typography packages with npm</div>
            <p className="text-[11px] text-slate-500">Add animation libraries or non-Google font packages directly to this project's package.json. These are project dependencies, not global installs on the editor server.</p>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
              <button type="button" onClick={() => { setNpmKind('motion'); setNpmCommand('npm install motion'); setNpmNotice(''); setNpmError(''); }} className={`rounded-md px-2 py-2 text-xs font-medium ${npmKind === 'motion' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-600'}`}>Kinetic / Motion</button>
              <button type="button" onClick={() => { setNpmKind('font'); setNpmCommand('npm install @fontsource/roboto'); setNpmFontFamily('Roboto'); setNpmCssImport('@fontsource/roboto/400.css'); setNpmNotice(''); setNpmError(''); }} className={`rounded-md px-2 py-2 text-xs font-medium ${npmKind === 'font' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-600'}`}>Font package</button>
            </div>
            <label className="block text-[11px] font-medium text-slate-600">NPM install command</label>
            <input value={npmCommand} onChange={e => setNpmCommand(e.target.value)} placeholder="npm install package-name" className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-xs" />
            {npmKind === 'font' ? <>
              <input value={npmFontFamily} onChange={e => setNpmFontFamily(e.target.value)} placeholder="Font family name, e.g. Roboto" className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs" />
              <input value={npmCssImport} onChange={e => setNpmCssImport(e.target.value)} placeholder="CSS entry, e.g. @fontsource/roboto/400.css" className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-xs" />
              <p className="text-[10px] text-slate-500">Examples: @fontsource/roboto/400.css, @fontsource-variable/inter, @fontsource/playfair-display/700.css.</p>
            </> : <>
              <p className="text-[10px] text-slate-500">Examples: npm install motion, npm install gsap, npm install react-type-animation, npm install react-typing-effect.</p>
              <div className="grid grid-cols-2 gap-2">
                <input value={npmComponentName} onChange={e => setNpmComponentName(e.target.value)} placeholder="Optional component name" className="h-9 min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-xs" />
                <input value={npmComponentExport} onChange={e => setNpmComponentExport(e.target.value)} placeholder="Export (default)" className="h-9 min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-xs" />
              </div>
              <p className="text-[10px] text-slate-500">Optional: enter a React component export to also create a reusable item in Your Components. Leave blank to add only the package.</p>
            </>}
            <button type="button" onClick={() => {
              setNpmError(''); setNpmNotice('');
              const parsed = parseNpmInstallCommand(npmCommand);
              if (!parsed) { setNpmError('Use a single-package command such as npm install package-name or npm i package-name.'); return; }
              const result = onInstallNpmPackage({ command: npmCommand, kind: npmKind, fontFamily: npmFontFamily, cssImport: npmCssImport, componentName: npmComponentName, componentExport: npmComponentExport });
              if (!result.ok) setNpmError(result.error || 'Could not add npm package.');
              else { setNpmNotice(`Added ${parsed.packageName}@${parsed.version} to this project.`); setNpmCommand(''); }
            }} className="w-full rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100">Install & add to project</button>
            {npmError && <p role="alert" className="text-[11px] text-rose-600">{npmError}</p>}
            {npmNotice && <p role="status" className="text-[11px] text-emerald-700">{npmNotice}</p>}
          </section>
          <section className="space-y-3 rounded-xl border border-slate-200 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800"><Sparkles className="h-4 w-4 text-violet-600" /> Motion text shortcuts</div>
            <p className="text-[11px] text-slate-500">Select a text element on the canvas first. Entrance presets play once; Float, Glow and Wave loop gently.</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {MOTIONS.map(item => <button key={item.id} type="button" onClick={() => setMotion(item.id)} className={`rounded-lg border p-2 text-left transition-colors ${motion === item.id ? 'border-violet-500 bg-violet-50' : 'border-slate-200 hover:bg-slate-50'}`}><span className="block text-xs font-semibold text-slate-800">{item.label}</span><span className="mt-0.5 block text-[10px] text-slate-500">{item.hint}</span></button>)}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-[11px] text-slate-600">Duration: {duration.toFixed(1)}s<input type="range" min="0.2" max="3" step="0.1" value={duration} onChange={e => setDuration(Number(e.target.value))} className="mt-1 w-full" /></label>
              <label className="text-[11px] text-slate-600">Delay: {delay.toFixed(1)}s<input type="range" min="0" max="2" step="0.1" value={delay} onChange={e => setDelay(Number(e.target.value))} className="mt-1 w-full" /></label>
            </div>
            <button type="button" disabled={!hasSelection} onClick={() => onApplyMotion(motion, duration, delay)} className="w-full rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">Apply motion to selected element</button>
          </section>
        </div>
      </div>
    </div>
  );
}
