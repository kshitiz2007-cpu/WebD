import type { ReactUiLibraryEntry } from './react-ui-catalog';

// Additional framework-free blocks. These use native React/HTML primitives so they
// remain previewable without loading another runtime package.
const noPackages: ReactUiLibraryEntry['packages'] = [];

export const EXTRA_REACT_UI_LIBRARY_ITEMS: ReactUiLibraryEntry[] = [
  {
    id: 'ui-modal-dialog',
    componentName: 'UiModalDialog',
    title: 'Modal Dialog',
    category: 'Feedback',
    description: 'Accessible dialog with title, description, close and confirm actions.',
    tags: ['modal', 'dialog', 'popup', 'overlay'],
    packages: noPackages,
    defaultProps: { title: 'Confirm your action', description: 'Are you sure you want to continue?', confirmLabel: 'Continue' },
    componentSource: `'use client';
import React, { useState } from 'react';
export default function UiModalDialog({ title = 'Confirm your action', description = 'Are you sure you want to continue?', confirmLabel = 'Continue' }: { title?: string; description?: string; confirmLabel?: string }) {
  const [open, setOpen] = useState(false);
  return <div className="w-full">
    <button type="button" onClick={() => setOpen(true)} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Open dialog</button>
    {open && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="webd-dialog-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h2 id="webd-dialog-title" className="text-lg font-bold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm text-slate-600">{description}</p>
        <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} className="rounded-lg border px-3 py-2 text-sm">Cancel</button><button type="button" onClick={() => setOpen(false)} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">{confirmLabel}</button></div>
      </section>
    </div>}
  </div>;
}`,
    inlineJsx: `<div className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="font-semibold text-slate-900">Dialog preview</h3><p className="mt-1 text-sm text-slate-600">Insert the reusable modal component for an interactive dialog.</p><button type="button" className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white">Open dialog</button></div>`,
  },
  {
    id: 'ui-progress-tracker',
    componentName: 'UiProgressTracker',
    title: 'Progress Tracker',
    category: 'Feedback',
    description: 'Progress bar with label, percentage and configurable completion value.',
    tags: ['progress', 'loading', 'meter', 'status'],
    packages: noPackages,
    defaultProps: { label: 'Project completion', value: '72' },
    componentSource: `import React from 'react';
export default function UiProgressTracker({ label = 'Project completion', value = '72' }: { label?: string; value?: string }) {
  const amount = Math.max(0, Math.min(100, Number(value) || 0));
  return <section className="w-full rounded-xl border border-slate-200 bg-white p-4"><div className="mb-2 flex items-center justify-between gap-3"><span className="text-sm font-semibold text-slate-800">{label}</span><span className="text-sm font-bold tabular-nums text-indigo-600">{amount}%</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={amount} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: amount + '%' }} /></div></section>;
}`,
    inlineJsx: `<section className="w-full rounded-xl border border-slate-200 bg-white p-4"><div className="mb-2 flex justify-between"><span className="text-sm font-semibold">Project completion</span><span className="text-sm font-bold text-indigo-600">72%</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-[72%] rounded-full bg-indigo-600" /></div></section>`,
  },
  {
    id: 'ui-avatar-group',
    componentName: 'UiAvatarGroup',
    title: 'Team Avatar Group',
    category: 'Content',
    description: 'Compact team member avatar stack with initials and overflow count.',
    tags: ['avatar', 'team', 'users', 'profile'],
    packages: noPackages,
    defaultProps: { title: 'Project team' },
    componentSource: `import React from 'react';
export default function UiAvatarGroup({ title = 'Project team' }: { title?: string }) {
 const people = [{ name: 'Alex Morgan', initials: 'AM', color: 'bg-indigo-600' }, { name: 'Jamie Lee', initials: 'JL', color: 'bg-emerald-600' }, { name: 'Taylor Kim', initials: 'TK', color: 'bg-amber-600' }, { name: 'Sam Rivera', initials: 'SR', color: 'bg-sky-600' }];
 return <section className="rounded-xl border border-slate-200 bg-white p-4"><p className="mb-3 text-sm font-semibold text-slate-800">{title}</p><div className="flex items-center -space-x-2">{people.map(person => <span key={person.initials} title={person.name} className={person.color + ' flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white'}>{person.initials}</span>)}<span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-[10px] font-bold text-slate-600">+3</span></div></section>;
}`,
    inlineJsx: `<div className="rounded-xl border border-slate-200 bg-white p-4"><p className="mb-3 text-sm font-semibold">Project team</p><div className="flex -space-x-2"><span className="grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-indigo-600 text-xs font-bold text-white">AM</span><span className="grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-emerald-600 text-xs font-bold text-white">JL</span><span className="grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-amber-600 text-xs font-bold text-white">TK</span><span className="grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-slate-100 text-xs font-bold">+3</span></div></div>`,
  },
  {
    id: 'ui-empty-state',
    componentName: 'UiEmptyState',
    title: 'Empty State Panel',
    category: 'Content',
    description: 'Friendly empty state with icon, supporting text and primary action.',
    tags: ['empty', 'placeholder', 'no results', 'onboarding'],
    packages: noPackages,
    defaultProps: { title: 'Nothing here yet', description: 'Create your first item to get started.', actionLabel: 'Create item' },
    componentSource: `import React from 'react';
export default function UiEmptyState({ title = 'Nothing here yet', description = 'Create your first item to get started.', actionLabel = 'Create item' }: { title?: string; description?: string; actionLabel?: string }) {
 return <section className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-100 text-xl text-indigo-700">✦</span><h3 className="mt-4 text-base font-bold text-slate-900">{title}</h3><p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p><button type="button" className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">{actionLabel}</button></section>;
}`,
    inlineJsx: `<section className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-100 text-xl text-indigo-700">✦</span><h3 className="mt-4 text-base font-bold text-slate-900">Nothing here yet</h3><p className="mt-1 text-sm text-slate-500">Create your first item to get started.</p><button type="button" className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Create item</button></section>`,
  },
  {
    id: 'ui-form-input',
    componentName: 'UiFormInput',
    title: 'Labeled Form Input',
    category: 'Forms',
    description: 'Accessible labeled input with helper text and required state.',
    tags: ['input', 'form', 'field', 'label'],
    packages: noPackages,
    defaultProps: { label: 'Email address', placeholder: 'you@example.com', helper: 'We will never share your email.' },
    componentSource: `import React from 'react';
export default function UiFormInput({ label = 'Email address', placeholder = 'you@example.com', helper = 'We will never share your email.' }: { label?: string; placeholder?: string; helper?: string }) {
 const id = 'webd-email-field';
 return <div className="w-full space-y-1.5"><label htmlFor={id} className="block text-sm font-medium text-slate-800">{label}</label><input id={id} type="email" placeholder={placeholder} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /><p className="text-xs text-slate-500">{helper}</p></div>;
}`,
    inlineJsx: `<div className="w-full space-y-1.5"><label className="block text-sm font-medium text-slate-800">Email address</label><input type="email" placeholder="you@example.com" className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" /><p className="text-xs text-slate-500">We will never share your email.</p></div>`,
  },
  {
    id: 'ui-select-field',
    componentName: 'UiSelectField',
    title: 'Select Dropdown Field',
    category: 'Forms',
    description: 'Native select field with label and common options, ready for change rules.',
    tags: ['select', 'dropdown', 'form', 'options'],
    packages: noPackages,
    defaultProps: { label: 'Choose a plan' },
    componentSource: `import React from 'react';
export default function UiSelectField({ label = 'Choose a plan' }: { label?: string }) {
 return <div className="w-full space-y-1.5"><label htmlFor="webd-plan-select" className="block text-sm font-medium text-slate-800">{label}</label><select id="webd-plan-select" defaultValue="" className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none"><option value="" disabled>Select an option</option><option value="starter">Starter</option><option value="pro">Professional</option><option value="team">Team</option></select></div>;
}`,
    inlineJsx: `<div className="w-full space-y-1.5"><label className="block text-sm font-medium text-slate-800">Choose a plan</label><select defaultValue="" className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="" disabled>Select an option</option><option>Starter</option><option>Professional</option><option>Team</option></select></div>`,
  },
  {
    id: 'ui-toggle-switch',
    componentName: 'UiToggleSwitch',
    title: 'Toggle Switch',
    category: 'Forms',
    description: 'Keyboard-friendly native checkbox styled as a switch.',
    tags: ['toggle', 'switch', 'checkbox', 'setting'],
    packages: noPackages,
    defaultProps: { label: 'Enable notifications' },
    componentSource: `'use client';
import React, { useState } from 'react';
export default function UiToggleSwitch({ label = 'Enable notifications' }: { label?: string }) {
 const [enabled, setEnabled] = useState(true);
 return <label className="inline-flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white p-4"><span className="text-sm font-medium text-slate-800">{label}</span><input type="checkbox" role="switch" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="peer sr-only" /><span aria-hidden="true" className={\\`relative h-6 w-11 rounded-full transition-colors \\${enabled ? 'bg-indigo-600' : 'bg-slate-300'}\\`}><span className={\\`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform \\${enabled ? 'translate-x-6' : 'translate-x-1'}\\`} /></span></label>;
}`,
    inlineJsx: `<label className="inline-flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white p-4"><span className="text-sm font-medium">Enable notifications</span><input type="checkbox" className="h-4 w-4 accent-indigo-600" defaultChecked /></label>`,
  },
  {
    id: 'ui-checkbox-list',
    componentName: 'UiCheckboxList',
    title: 'Checkbox Option List',
    category: 'Forms',
    description: 'Selectable checklist for preferences, filters and multi-step forms.',
    tags: ['checkbox', 'checklist', 'preferences', 'multi select'],
    packages: noPackages,
    defaultProps: { title: 'Notification preferences' },
    componentSource: `'use client';
import React, { useState } from 'react';
export default function UiCheckboxList({ title = 'Notification preferences' }: { title?: string }) {
 const [selected, setSelected] = useState(['Product updates']);
 const options = ['Product updates', 'Weekly summary', 'Security alerts'];
 return <fieldset className="rounded-xl border border-slate-200 bg-white p-4"><legend className="px-1 text-sm font-semibold text-slate-900">{title}</legend><div className="mt-2 space-y-3">{options.map(option => <label key={option} className="flex items-center gap-2.5 text-sm text-slate-700"><input type="checkbox" checked={selected.includes(option)} onChange={e => setSelected(prev => e.target.checked ? [...prev, option] : prev.filter(item => item !== option))} className="h-4 w-4 rounded accent-indigo-600" />{option}</label>)}</div></fieldset>;
}`,
    inlineJsx: `<fieldset className="rounded-xl border border-slate-200 bg-white p-4"><legend className="px-1 text-sm font-semibold">Notification preferences</legend><div className="mt-2 space-y-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" defaultChecked />Product updates</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" />Weekly summary</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" />Security alerts</label></div></fieldset>`,
  },
  {
    id: 'ui-product-card',
    componentName: 'UiProductCard',
    title: 'Product Card',
    category: 'Commerce',
    description: 'Product tile with image placeholder, price, rating and add-to-cart action.',
    tags: ['product', 'commerce', 'shop', 'cart', 'ecommerce'],
    packages: noPackages,
    defaultProps: { name: 'Everyday Backpack', price: '$79.00', badge: 'Bestseller' },
    componentSource: `'use client';
import React, { useState } from 'react';
export default function UiProductCard({ name = 'Everyday Backpack', price = '$79.00', badge = 'Bestseller' }: { name?: string; price?: string; badge?: string }) {
 const [added, setAdded] = useState(false);
 return <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="relative grid h-40 place-items-center bg-gradient-to-br from-slate-100 to-indigo-100"><span className="text-5xl">▧</span><span className="absolute left-3 top-3 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-slate-700">{badge}</span></div><div className="p-4"><p className="text-xs text-amber-600">★★★★★ <span className="text-slate-500">(128 reviews)</span></p><h3 className="mt-1 font-semibold text-slate-900">{name}</h3><div className="mt-3 flex items-center justify-between gap-3"><span className="text-lg font-bold text-slate-900">{price}</span><button type="button" onClick={() => setAdded(true)} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">{added ? 'Added' : 'Add to cart'}</button></div></div></article>;
}`,
    inlineJsx: `<article className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="grid h-36 place-items-center bg-gradient-to-br from-slate-100 to-indigo-100 text-5xl">▧</div><div className="p-4"><p className="text-xs text-amber-600">★★★★★ <span className="text-slate-500">(128 reviews)</span></p><h3 className="mt-1 font-semibold">Everyday Backpack</h3><div className="mt-3 flex items-center justify-between"><span className="text-lg font-bold">$79.00</span><button type="button" className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-white">Add to cart</button></div></div></article>`,
  },
  {
    id: 'ui-stat-card',
    componentName: 'UiStatCard',
    title: 'Metric Stat Card',
    category: 'Dashboard',
    description: 'Single KPI card with trend indicator and supporting caption.',
    tags: ['metric', 'kpi', 'stat', 'dashboard'],
    packages: noPackages,
    defaultProps: { label: 'Total revenue', value: '$48,290', change: '+12.8%' },
    componentSource: `import React from 'react';
export default function UiStatCard({ label = 'Total revenue', value = '$48,290', change = '+12.8%' }: { label?: string; value?: string; change?: string }) {
 return <article className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-xs font-medium text-slate-500">{label}</p><div className="mt-2 flex items-end justify-between gap-3"><strong className="text-2xl font-bold tracking-tight text-slate-900">{value}</strong><span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">{change}</span></div><p className="mt-2 text-[11px] text-slate-400">Compared with previous period</p></article>;
}`,
    inlineJsx: `<article className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-xs font-medium text-slate-500">Total revenue</p><div className="mt-2 flex items-end justify-between"><strong className="text-2xl font-bold">$48,290</strong><span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">+12.8%</span></div><p className="mt-2 text-[11px] text-slate-400">Compared with previous period</p></article>`,
  },
  {
    id: 'ui-pagination',
    componentName: 'UiPagination',
    title: 'Pagination Controls',
    category: 'Interactive & Data',
    description: 'Interactive page navigation with previous/next and active page state.',
    tags: ['pagination', 'table', 'navigation', 'pages'],
    packages: noPackages,
    defaultProps: { totalPages: '5' },
    componentSource: `'use client';
import React, { useState } from 'react';
export default function UiPagination({ totalPages = '5' }: { totalPages?: string }) {
 const total = Math.max(1, Math.min(20, Number(totalPages) || 5));
 const [page, setPage] = useState(1);
 return <nav aria-label="Pagination" className="flex items-center gap-1"><button type="button" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="rounded-lg border px-3 py-2 text-xs disabled:opacity-40">Previous</button>{Array.from({ length: total }, (_, i) => i + 1).map(n => <button key={n} type="button" aria-current={page === n ? 'page' : undefined} onClick={() => setPage(n)} className={\`h-9 w-9 rounded-lg text-xs font-semibold \${page === n ? 'bg-indigo-600 text-white' : 'border text-slate-600'}\`}>{n}</button>)}<button type="button" disabled={page === total} onClick={() => setPage(p => Math.min(total, p + 1))} className="rounded-lg border px-3 py-2 text-xs disabled:opacity-40">Next</button></nav>;
}`,
    inlineJsx: `<nav aria-label="Pagination" className="flex items-center gap-1"><button type="button" className="rounded-lg border px-3 py-2 text-xs">Previous</button><button type="button" className="h-9 w-9 rounded-lg bg-indigo-600 text-xs font-semibold text-white">1</button><button type="button" className="h-9 w-9 rounded-lg border text-xs">2</button><button type="button" className="h-9 w-9 rounded-lg border text-xs">3</button><button type="button" className="rounded-lg border px-3 py-2 text-xs">Next</button></nav>`,
  },
];
