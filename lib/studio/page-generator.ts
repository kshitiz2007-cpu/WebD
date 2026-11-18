import type { ProjectFramework } from './types';

export type PageTemplatePreset = 'blank' | 'landing' | 'about' | 'contact' | 'pricing';

export interface GeneratedPageFile {
  title: string;
  route: string;
  filePath: string;
  code: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeJsx(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function toTitleCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function normalizePageSlug(value: string): string {
  return value
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .map((segment) =>
      segment
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, '-')
        .replace(/-+/g, '-')
    .replace(/^\/+|\/+$/g, '')
    )
    .filter(Boolean)
    .join('/');
}

function reactPageSource(title: string, template: PageTemplatePreset): string {
  const safeTitle = escapeJsx(title);
  const contentByTemplate: Record<PageTemplatePreset, string> = {
    blank: `<section className="mx-auto w-full max-w-5xl px-6 py-20"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">New page</p><h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">{'${safeTitle}'}</h1><p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">Start designing this page visually. Every change is written back to this React page source.</p></section>`,
    landing: `<><section className="relative overflow-hidden bg-slate-950 px-6 py-24 text-white sm:py-32"><div className="mx-auto max-w-6xl"><span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-indigo-200">BUILT FOR WHAT'S NEXT</span><h1 className="mt-7 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">{'${safeTitle}'}</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">A clear message, confident design and focused actions help visitors understand your value.</p><div className="mt-9 flex flex-wrap gap-3"><a href="#features" className="rounded-xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-400">Explore features</a><a href="#contact" className="rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10">Get in touch</a></div></div></section><section id="features" className="mx-auto grid max-w-6xl gap-5 px-6 py-16 md:grid-cols-3">{['Thoughtful design','Flexible building blocks','Ready to grow'].map((item, index) => <article key={item} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><span className="text-xs font-bold text-indigo-600">0{index + 1}</span><h2 className="mt-3 text-lg font-semibold text-slate-900">{item}</h2><p className="mt-2 text-sm leading-6 text-slate-600">A reusable section that you can select, edit and restyle directly on the visual canvas.</p></article>)}</section><section id="contact" className="mx-auto max-w-6xl px-6 pb-16"><div className="rounded-3xl bg-indigo-50 p-8 sm:p-12"><h2 className="text-2xl font-bold text-slate-950">Make the next step simple.</h2><p className="mt-2 text-sm text-slate-600">Replace this copy and connect the action to your workflow.</p><a href="mailto:hello@example.com" className="mt-5 inline-flex rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Contact us</a></div></section></>`,
    about: `<main className="mx-auto max-w-6xl px-6 py-20"><div className="max-w-3xl"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">Our story</p><h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">{'${safeTitle}'}</h1><p className="mt-6 text-lg leading-8 text-slate-600">Tell visitors who you are, what you believe in and why your work matters. This page is ready for visual editing.</p></div><div className="mt-14 grid gap-6 md:grid-cols-2"><div className="rounded-3xl bg-slate-950 p-8 text-white"><h2 className="text-xl font-semibold">Our mission</h2><p className="mt-3 text-sm leading-7 text-slate-300">Describe the problem you solve and the impact you want to make.</p></div><div className="rounded-3xl border border-slate-200 bg-white p-8"><h2 className="text-xl font-semibold text-slate-950">Our values</h2><p className="mt-3 text-sm leading-7 text-slate-600">Share the principles that guide your team and your decisions.</p></div></div></main>`,
    contact: `<main className="mx-auto grid max-w-6xl gap-12 px-6 py-16 lg:grid-cols-2"><section><p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">Let's talk</p><h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950">{'${safeTitle}'}</h1><p className="mt-5 max-w-lg text-base leading-7 text-slate-600">Have a question or a project in mind? Use this starter form and customize the fields in the visual editor.</p><p className="mt-8 text-sm font-medium text-slate-700">hello@example.com</p></section><form className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" onSubmit={(event) => event.preventDefault()}><label className="block text-sm font-medium text-slate-700">Your name<input required name="name" className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-indigo-500" placeholder="Jane Smith" /></label><label className="block text-sm font-medium text-slate-700">Email address<input required type="email" name="email" className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-indigo-500" placeholder="jane@example.com" /></label><label className="block text-sm font-medium text-slate-700">Message<textarea required name="message" rows={4} className="mt-2 w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-indigo-500" placeholder="How can we help?" /></label><button className="w-full rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-500" type="submit">Send message</button></form></main>`,
    pricing: `<main className="mx-auto max-w-6xl px-6 py-20"><div className="mx-auto max-w-2xl text-center"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">Simple pricing</p><h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950">{'${safeTitle}'}</h1><p className="mt-4 text-base leading-7 text-slate-600">Choose a plan that fits your needs. Edit every card, price and feature directly on the canvas.</p></div><div className="mt-12 grid gap-6 md:grid-cols-3">{[{name:'Starter',price:'Free'},{name:'Pro',price:'$19'},{name:'Team',price:'$49'}].map((plan, index) => <article key={plan.name} className={`rounded-3xl border p-7 ${index === 1 ? 'border-indigo-500 bg-indigo-50 shadow-lg' : 'border-slate-200 bg-white'}`}><h2 className="text-lg font-semibold text-slate-950">{plan.name}</h2><p className="mt-5 text-4xl font-bold text-slate-950">{plan.price}<span className="text-sm font-medium text-slate-500"> / month</span></p><ul className="mt-6 space-y-3 text-sm text-slate-600"><li>✓ Core features included</li><li>✓ Responsive layouts</li><li>✓ Helpful support</li></ul><a href="#get-started" className="mt-8 block rounded-xl bg-slate-950 px-4 py-3 text-center text-sm font-semibold text-white">Choose {plan.name}</a></article>)}</div></main>`,
  };

  return `'use client';
import React from 'react';

export default function ${toTitleCase(title).replace(/[^A-Za-z0-9]/g, '') || 'New'}Page() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <a href="/" className="text-sm font-bold tracking-tight text-slate-950">Your Brand</a>
        <nav className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
          <a href="/">Home</a>
          <a href="/about">About</a>
          <a href="/contact">Contact</a>
        </nav>
      </header>
      ${contentByTemplate[template]}
      <footer className="border-t border-slate-200 px-6 py-8 text-center text-xs text-slate-500">© {new Date().getFullYear()} Your Brand. Built with WebD.</footer>
    </div>
  );
}
`;
}

function htmlPageSource(title: string, template: PageTemplatePreset): string {
  const safeTitle = escapeHtml(title);
  const body =
    template === 'contact'
      ? '<section class="panel"><h1>Contact us</h1><form><label>Name<input placeholder="Your name"></label><label>Email<input type="email" placeholder="you@example.com"></label><label>Message<textarea rows="4"></textarea></label><button>Send message</button></form></section>'
      : template === 'about'
        ? '<section class="panel"><p class="eyebrow">OUR STORY</p><h1>About our team</h1><p>Share your story, mission and values with visitors.</p></section>'
        : template === 'pricing'
          ? '<section class="panel"><p class="eyebrow">SIMPLE PRICING</p><h1>Plans that grow with you</h1><div class="cards"><article><h2>Starter</h2><strong>Free</strong></article><article><h2>Pro</h2><strong>$19 / month</strong></article><article><h2>Team</h2><strong>$49 / month</strong></article></div></section>'
          : template === 'landing'
            ? '<section class="hero"><p class="eyebrow">BUILT FOR WHAT\'S NEXT</p><h1>Make your next idea real.</h1><p>Build a clear, beautiful experience for your visitors.</p><a class="button" href="#features">Explore features</a></section><section id="features" class="cards"><article><h2>Thoughtful design</h2><p>Beautiful sections ready to customize.</p></article><article><h2>Flexible blocks</h2><p>Reusable content that grows with you.</p></article><article><h2>Ready to launch</h2><p>Responsive layouts with clean structure.</p></article></section>'
            : '<section class="panel"><p class="eyebrow">NEW PAGE</p><h1>Start designing</h1><p>Your new page is ready for visual editing.</p></section>';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <style>
    *{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,sans-serif;background:#f8fafc;color:#0f172a}
    header{display:flex;justify-content:space-between;align-items:center;padding:20px max(6vw,24px);background:white;border-bottom:1px solid #e2e8f0}
    header a{color:inherit;text-decoration:none;font-weight:700}nav{display:flex;gap:20px}nav a{font-size:13px;font-weight:500}
    main{max-width:1100px;margin:40px auto;padding:0 24px}.hero,.panel{padding:clamp(32px,7vw,76px);border-radius:24px;background:white;border:1px solid #e2e8f0}
    .hero{background:linear-gradient(135deg,#0f172a,#4338ca);color:white}.eyebrow{font-size:11px;font-weight:800;letter-spacing:.18em;color:#818cf8}
    h1{font-size:clamp(36px,6vw,60px);line-height:1.05;letter-spacing:-.04em;margin:14px 0}p{line-height:1.7;color:#64748b;max-width:650px}.hero p{color:#cbd5e1}
    .button,button{display:inline-block;margin-top:18px;padding:12px 18px;border:0;border-radius:10px;background:#4f46e5;color:white;font-weight:700;text-decoration:none;cursor:pointer}
    .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:18px;margin-top:24px}.cards article{padding:24px;border:1px solid #e2e8f0;border-radius:16px;background:white}
    form{display:grid;gap:14px;max-width:520px}label{display:grid;gap:7px;font-size:13px}input,textarea{width:100%;padding:12px;border:1px solid #cbd5e1;border-radius:9px;font:inherit}
  </style>
</head>
<body><header><a href="index.html">Your Brand</a><nav><a href="index.html">Home</a><a href="about.html">About</a><a href="contact.html">Contact</a></nav></header><main>${body.replace('About our team', safeTitle).replace('Contact us', safeTitle).replace('Plans that grow with you', safeTitle).replace('Make your next idea real.', safeTitle)}</main></body>
</html>`;
}

export function createPageFile(params: {
  framework: ProjectFramework;
  title: string;
  slug: string;
  template: PageTemplatePreset;
  files: Record<string, string>;
}): GeneratedPageFile {
  const title = params.title.trim() || toTitleCase(params.slug);
  const slug = normalizePageSlug(params.slug || title.toLowerCase().replace(/\s+/g, '-'));
  const route = slug ? `/${slug}` : '/';
  let filePath: string;

  if (params.framework === 'nextjs-app') {
    filePath = `app/${slug ? `${slug}/` : ''}page.tsx`;
  } else if (params.framework === 'nextjs-pages') {
    filePath = `pages/${slug || 'index'}.tsx`;
  } else if (params.framework === 'html') {
    filePath = `${slug || 'index'}.html`;
  } else {
    filePath = `src/pages/${slug || 'index'}.tsx`;
  }

  if (params.files[filePath]) {
    throw new Error(`A page already exists at ${route}. Choose another URL.`);
  }

  const code =
    params.framework === 'html'
      ? htmlPageSource(title, params.template)
      : reactPageSource(title, params.template);

  return { title, route, filePath, code };
}
