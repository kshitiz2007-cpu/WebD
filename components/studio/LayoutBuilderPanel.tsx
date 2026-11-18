'use client';

import React from 'react';
import { Columns2, Heading, Image as ImageIcon, LayoutPanelTop, MousePointerClick, Plus, Rows3, Type, X } from 'lucide-react';

export interface LayoutBlock {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  snippet: string;
}

export const LAYOUT_BLOCKS: LayoutBlock[] = [
  {
    id: 'section',
    label: 'Section',
    description: 'Full-width section with inner content container',
    icon: LayoutPanelTop,
    snippet: '<section className="w-full px-5 py-12 sm:px-8"><div className="mx-auto max-w-6xl"><h2 className="text-2xl font-bold text-slate-900">New section</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Add your section content here.</p></div></section>',
  },
  {
    id: 'container',
    label: 'Container',
    description: 'Centered responsive content wrapper',
    icon: Rows3,
    snippet: '<div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8"><div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">Container content</div></div>',
  },
  {
    id: 'two-column',
    label: 'Two columns',
    description: 'Responsive grid that stacks on phones',
    icon: Columns2,
    snippet: '<section className="grid grid-cols-1 gap-6 px-5 py-8 md:grid-cols-2"><div className="rounded-xl border border-slate-200 bg-white p-6"><h3 className="font-semibold text-slate-900">Column one</h3><p className="mt-2 text-sm text-slate-600">Add content here.</p></div><div className="rounded-xl border border-slate-200 bg-white p-6"><h3 className="font-semibold text-slate-900">Column two</h3><p className="mt-2 text-sm text-slate-600">Add content here.</p></div></section>',
  },
  {
    id: 'heading',
    label: 'Heading',
    description: 'Responsive heading text',
    icon: Heading,
    snippet: '<h2 className="px-5 py-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Your heading</h2>',
  },
  {
    id: 'paragraph',
    label: 'Paragraph',
    description: 'Readable body copy',
    icon: Type,
    snippet: '<p className="max-w-3xl px-5 py-3 text-base leading-7 text-slate-600">Write your paragraph here. Edit this copy in the canvas or code editor.</p>',
  },
  {
    id: 'button',
    label: 'Button',
    description: 'Single clickable CTA button',
    icon: MousePointerClick,
    snippet: '<button type="button" className="mx-5 my-3 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700">Get started</button>',
  },
  {
    id: 'image',
    label: 'Image',
    description: 'Responsive image placeholder',
    icon: ImageIcon,
    snippet: '<img src="https://placehold.co/1200x600" alt="Replace with your image" className="my-4 h-auto w-full rounded-xl object-cover" />',
  },
];

interface LayoutBuilderPanelProps {
  onClose: () => void;
  onInsert: (snippet: string) => void;
}

export default function LayoutBuilderPanel({ onClose, onInsert }: LayoutBuilderPanelProps) {
  const handleDragStart = (event: React.DragEvent<HTMLButtonElement>, snippet: string) => {
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('application/x-webd-layout-block', snippet);
    event.dataTransfer.setData('text/plain', snippet);
  };

  return (
    <section className="absolute inset-x-2 top-2 z-40 mx-auto flex max-h-[min(72vh,620px)] w-[min(460px,calc(100%-1rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:inset-x-auto sm:right-4 sm:top-4">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Drag &amp; Drop Layout Builder</h2>
          <p className="mt-0.5 text-[11px] text-slate-500">Drag a block onto the canvas, or tap Insert on mobile</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close layout builder" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
      </header>
      <div className="grid grid-cols-1 gap-2 overflow-y-auto p-3 sm:grid-cols-2">
        {LAYOUT_BLOCKS.map((block) => {
          const Icon = block.icon;
          return (
            <article key={block.id} className="rounded-xl border border-slate-200 bg-white p-3 transition-colors hover:border-indigo-300 hover:bg-indigo-50/40">
              <button type="button" draggable onDragStart={(event) => handleDragStart(event, block.snippet)} onClick={() => onInsert(block.snippet)} className="flex w-full items-start gap-2.5 text-left">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700"><Icon className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-slate-900">{block.label}</span>
                  <span className="mt-1 block text-[10px] leading-4 text-slate-500">{block.description}</span>
                </span>
              </button>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[10px] text-slate-400">Drag to canvas</span>
                <button type="button" onClick={() => onInsert(block.snippet)} className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1.5 text-[10px] font-semibold text-white hover:bg-indigo-700"><Plus className="h-3 w-3" /> Insert</button>
              </div>
            </article>
          );
        })}
      </div>
      <footer className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-[10px] leading-4 text-slate-500">New blocks use responsive Tailwind layouts. Choose an element on the canvas first to insert the block after it; otherwise the block is added near the page root.</footer>
    </section>
  );
}
