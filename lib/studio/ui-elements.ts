import type { LucideIcon } from 'lucide-react';

export type UIElementCategory = 'hero' | 'cards' | 'offers' | 'buttons' | 'effects';

export interface UIElementPreset {
  id: string;
  name: string;
  category: UIElementCategory;
  description: string;
  tags: string[];
  snippet: string;
}

export const UI_ELEMENT_CATEGORIES: Array<{ id: UIElementCategory; label: string; description: string }> = [
  { id: 'hero', label: 'Hero', description: 'Eye-catching hero and intro blocks' },
  { id: 'cards', label: 'Cards', description: 'Reusable card and feature layouts' },
  { id: 'offers', label: 'Offers', description: 'Discounts, coupons and promo elements' },
  { id: 'buttons', label: 'Buttons', description: 'Calls to action and floating actions' },
  { id: 'effects', label: 'Effects', description: 'Decorative and motion-ready elements' },
];

export const UI_ELEMENT_PRESETS: UIElementPreset[] = [
  {
    id: 'circular-hero',
    name: 'Circular Hero',
    category: 'hero',
    description: 'Bold headline with a circular gradient visual.',
    tags: ['hero', 'circle', 'gradient', 'headline'],
    snippet: '<section className="relative isolate overflow-hidden rounded-3xl bg-slate-950 px-6 py-16 text-white sm:px-10"><div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2"><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-300">Make it memorable</p><h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-6xl">A bold idea starts here.</h1><p className="mt-5 max-w-lg text-base leading-7 text-slate-300">Add a short description that explains your product or message.</p><a href="#" className="mt-7 inline-flex rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-indigo-100">Explore more</a></div><div className="mx-auto flex aspect-square w-full max-w-sm items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_30%,#c4b5fd,transparent_38%),linear-gradient(135deg,#4f46e5,#0f172a)] p-8 shadow-2xl shadow-indigo-950/40"><div className="flex h-2/3 w-2/3 items-center justify-center rounded-full border border-white/30 bg-white/10 text-center text-xl font-semibold backdrop-blur-sm">Your visual</div></div></div></section>',
  },
  {
    id: 'glass-card',
    name: 'Glass Card',
    category: 'cards',
    description: 'Frosted panel with a soft border and depth.',
    tags: ['glass', 'blur', 'card', 'surface'],
    snippet: '<article className="rounded-3xl border border-white/40 bg-white/70 p-6 shadow-xl shadow-slate-900/5 backdrop-blur-xl"><p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Featured</p><h3 className="mt-3 text-2xl font-bold text-slate-900">A clear focus</h3><p className="mt-2 text-sm leading-6 text-slate-600">Use this glass card for highlights, benefits or short content blocks.</p><a href="#" className="mt-5 inline-flex text-sm font-semibold text-indigo-700 hover:text-indigo-900">Learn more →</a></article>',
  },
  {
    id: 'bento-card',
    name: 'Bento Card',
    category: 'cards',
    description: 'Compact feature card with a colorful visual accent.',
    tags: ['bento', 'grid', 'feature', 'card'],
    snippet: '<article className="overflow-hidden rounded-3xl bg-slate-950 p-6 text-white"><div className="mb-8 flex h-28 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 via-violet-500 to-indigo-500 text-4xl">✦</div><p className="text-xs font-semibold uppercase tracking-widest text-violet-300">Feature highlight</p><h3 className="mt-2 text-2xl font-bold">Designed to stand out</h3><p className="mt-2 text-sm leading-6 text-slate-300">Describe one key feature or benefit in a few words.</p></article>',
  },
  {
    id: 'coupon-ticket',
    name: 'Coupon Ticket',
    category: 'offers',
    description: 'Ticket-style promo card with a discount and coupon code.',
    tags: ['coupon', 'ticket', 'discount', 'offer'],
    snippet: '<article className="relative overflow-hidden rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 p-5 text-amber-950 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">Limited offer</p><p className="mt-2 text-4xl font-black tracking-tight">20% OFF</p><p className="mt-1 text-sm">Your next order</p></div><div className="rounded-xl border border-dashed border-amber-500/60 bg-white/70 px-4 py-3 text-center"><p className="text-[10px] font-semibold uppercase tracking-widest text-amber-700">Use code</p><p className="mt-1 font-mono text-lg font-bold">SAVE20</p></div></div><div className="mt-5 border-t border-dashed border-amber-300 pt-3 text-xs text-amber-800">Offer ends soon · Terms apply</div></article>',
  },
  {
    id: 'sale-badge',
    name: 'Sale Badge',
    category: 'offers',
    description: 'Compact label for promos, launches or sale states.',
    tags: ['badge', 'sale', 'promo', 'label'],
    snippet: '<span className="inline-flex items-center rounded-full bg-rose-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-rose-600/20">Limited offer · 30% off</span>',
  },
  {
    id: 'gradient-cta',
    name: 'Gradient CTA',
    category: 'buttons',
    description: 'Gradient call-to-action button with subtle hover lift.',
    tags: ['button', 'cta', 'gradient', 'hover'],
    snippet: '<a href="#" className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl">Get started <span className="ml-2">→</span></a>',
  },
  {
    id: 'floating-cta',
    name: 'Floating CTA',
    category: 'buttons',
    description: 'Pill-shaped action with a strong contrast.',
    tags: ['floating', 'pill', 'action', 'button'],
    snippet: '<a href="#" className="inline-flex items-center gap-3 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-xl transition hover:scale-[1.02]"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15">↗</span>Contact us</a>',
  },
  {
    id: 'marquee-strip',
    name: 'Marquee Strip',
    category: 'effects',
    description: 'Static repeating strip that can be animated later with editor motion controls.',
    tags: ['marquee', 'ticker', 'strip', 'motion'],
    snippet: '<div className="overflow-hidden rounded-xl bg-indigo-600 py-3 text-white"><div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 text-xs font-bold uppercase tracking-[0.18em]"><span>Design forward</span><span aria-hidden="true">✦</span><span>Build faster</span><span aria-hidden="true">✦</span><span>Stay inspired</span><span aria-hidden="true">✦</span></div></div>',
  },
];

export function getUIElementPreset(id: string): UIElementPreset | undefined {
  return UI_ELEMENT_PRESETS.find((preset) => preset.id === id);
}

export function getUIElementPresets(category?: UIElementCategory): UIElementPreset[] {
  return category ? UI_ELEMENT_PRESETS.filter((preset) => preset.category === category) : UI_ELEMENT_PRESETS;
}
