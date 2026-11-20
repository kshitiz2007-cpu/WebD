'use client';

import React, { useState } from 'react';

type Props = {
  selectionKey: string;
  onPreview: (styles: Record<string, string | null>) => void;
  onCommit: (styles: Record<string, string | null>) => void;
};

const blendModes = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'soft-light', 'hard-light'] as const;

export default function ImageBlendDesigner({ selectionKey, onPreview, onCommit }: Props) {
  const [image, setImage] = useState('');
  const [overlay, setOverlay] = useState('#000000');
  const [overlayOpacity, setOverlayOpacity] = useState(35);
  const [blend, setBlend] = useState<(typeof blendModes)[number]>('overlay');
  const [position, setPosition] = useState('center');
  const [size, setSize] = useState('cover');
  const [imageOpacity, setImageOpacity] = useState(100);
  const [softness, setSoftness] = useState(0);
  const [savedFor, setSavedFor] = useState(selectionKey);

  if (savedFor !== selectionKey) {
    setSavedFor(selectionKey);
    setImage('');
    setOverlay('#000000');
    setOverlayOpacity(35);
    setBlend('overlay');
    setPosition('center');
    setSize('cover');
    setImageOpacity(100);
    setSoftness(0);
  }

  const stylesFor = (commit = false): Record<string, string | null> => ({
    backgroundImage: image ? `linear-gradient(${overlay} ${overlayOpacity}%, transparent), url("${image}")` : null,
    backgroundBlendMode: image ? blend : null,
    backgroundSize: image ? size : null,
    backgroundPosition: image ? position : null,
    backgroundRepeat: image ? 'no-repeat' : null,
    opacity: image ? String(imageOpacity / 100) : null,
    filter: image && softness > 0 ? `blur(${softness}px)` : null,
  });

  const upload = (file?: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 8 * 1024 * 1024) {
      alert('Image max size is 8 MB. Please compress it before uploading.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-800">Image &amp; Blend Designer</h3>
        <span className="text-[10px] text-slate-500">Hero / Card / Section</span>
      </div>
      <label className="block text-[10px] font-medium text-slate-600">Upload image (8 MB max)</label>
      <input type="file" accept="image/*" onChange={(e) => upload(e.target.files?.[0])} className="w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-blue-600 file:px-2 file:py-1 file:text-white" />
      <input value={image.startsWith('data:') ? 'Uploaded image' : image} onChange={(e) => setImage(e.target.value)} placeholder="Or paste image URL" className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs" />
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-[10px] text-slate-600">Blend mode
          <select value={blend} onChange={(e) => setBlend(e.target.value as typeof blend)} className="h-8 w-full rounded border border-slate-200 bg-white px-1.5 text-xs">
            {blendModes.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-[10px] text-slate-600">Position
          <select value={position} onChange={(e) => setPosition(e.target.value)} className="h-8 w-full rounded border border-slate-200 bg-white px-1.5 text-xs">
            {['center','top','bottom','left','right','top left','top right','bottom left','bottom right'].map(p => <option key={p}>{p}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-[10px] text-slate-600">Image sizing
          <select value={size} onChange={(e) => setSize(e.target.value)} className="h-8 w-full rounded border border-slate-200 bg-white px-1.5 text-xs">
            {['cover','contain','100% 100%','auto'].map(s => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-[10px] text-slate-600">Overlay color
          <div className="flex h-8 items-center gap-1 rounded border border-slate-200 bg-white px-1">
            <input type="color" value={overlay} onChange={(e) => setOverlay(e.target.value)} className="h-6 w-7 p-0" />
            <span className="font-mono">{overlay}</span>
          </div>
        </label>
      </div>
      <label className="block space-y-1 text-[10px] text-slate-600">Overlay strength ({overlayOpacity}%)
        <input type="range" min="0" max="100" value={overlayOpacity} onChange={(e) => setOverlayOpacity(Number(e.target.value))} className="w-full accent-blue-600" />
      </label>
      <label className="block space-y-1 text-[10px] text-slate-600">Image opacity ({imageOpacity}%)
        <input type="range" min="10" max="100" value={imageOpacity} onChange={(e) => setImageOpacity(Number(e.target.value))} className="w-full accent-blue-600" />
      </label>
      <label className="block space-y-1 text-[10px] text-slate-600">Blur ({softness}px)
        <input type="range" min="0" max="12" value={softness} onChange={(e) => setSoftness(Number(e.target.value))} className="w-full accent-blue-600" />
      </label>
      <div className="h-24 overflow-hidden rounded-lg border border-slate-200 bg-slate-200" style={{ backgroundImage: image ? `linear-gradient(${overlay} ${overlayOpacity}%, transparent), url("${image}")` : undefined, backgroundBlendMode: blend, backgroundSize: 'cover', backgroundPosition: position }} />
      <div className="flex gap-2">
        <button type="button" disabled={!image} onClick={() => onPreview(stylesFor())} className="flex-1 rounded-md border border-slate-200 bg-white py-2 text-xs font-semibold disabled:opacity-40">Preview</button>
        <button type="button" disabled={!image} onClick={() => onCommit(stylesFor(true))} className="flex-1 rounded-md bg-blue-600 py-2 text-xs font-semibold text-white disabled:opacity-40">Apply Image</button>
        <button type="button" onClick={() => { setImage(''); onCommit({ backgroundImage: null, backgroundBlendMode: null, backgroundSize: null, backgroundPosition: null, backgroundRepeat: null, opacity: null, filter: null }); }} className="rounded-md border border-slate-200 bg-white px-2 py-2 text-xs">Clear</button>
      </div>
      <p className="text-[10px] leading-relaxed text-slate-500">Uploaded images are embedded as data URLs in the style change. Keep uploads small for faster page loading.</p>
    </section>
  );
}
