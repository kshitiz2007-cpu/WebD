'use client';

import { useMemo, useState } from 'react';
import { Check, ShoppingBag } from 'lucide-react';
import { RESTAURANT_PRODUCTS, formatINR } from '@/lib/restaurant/products';
import { useCart } from '@/lib/restaurant/cart-context';

const categories = ['All', 'Mains', 'Pizza', 'Pasta', 'Sides'] as const;

export default function RestaurantMenuPage() {
  const [category, setCategory] = useState<(typeof categories)[number]>('All');
  const [addedId, setAddedId] = useState<string | null>(null);
  const { addItem } = useCart();
  const products = useMemo(() => category === 'All' ? RESTAURANT_PRODUCTS : RESTAURANT_PRODUCTS.filter((item) => item.category === category), [category]);

  return (
    <main className="mx-auto min-h-[70vh] max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
      <div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.24em] text-[#ff8755]">Made with love, delivered fresh</p><h1 className="mt-3 text-4xl font-black sm:text-5xl">The menu<span className="text-[#ff743d]">.</span></h1><p className="mt-4 text-sm leading-7 text-[#cbbab0]">A few kitchen favourites, prepared fresh and ready for your table. Add a dish to your bag whenever you are ready.</p></div>
      <div className="mt-9 flex flex-wrap gap-2">{categories.map((item) => <button key={item} onClick={() => setCategory(item)} className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${category === item ? 'bg-[#ff743d] text-[#1b0c07]' : 'border border-white/15 text-[#d6c6bc] hover:border-[#ff743d]'}`}>{item}</button>)}</div>
      <div className="mt-9 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => <article key={product.id} className="overflow-hidden rounded-3xl border border-white/10 bg-[#1b100c]">
          <div className="relative h-56 bg-cover bg-center" style={{ backgroundImage: `url('${product.image}')` }}>{product.badge && <span className="absolute left-4 top-4 rounded-full bg-[#ff743d] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#1b0c07]">{product.badge}</span>}</div>
          <div className="p-6"><div className="flex items-start justify-between gap-3"><h2 className="text-lg font-bold">{product.name}</h2><span className="whitespace-nowrap text-sm font-bold text-[#ff8755]">{formatINR(product.price)}</span></div><p className="mt-2 min-h-12 text-sm leading-6 text-[#bca99e]">{product.description}</p><button onClick={() => { addItem(product); setAddedId(product.id); window.setTimeout(() => setAddedId((current) => current === product.id ? null : current), 1300); }} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#ff743d] px-5 py-3 text-sm font-bold text-[#1b0c07] transition hover:bg-[#ff986f]">{addedId === product.id ? <><Check className="h-4 w-4" /> Added to bag</> : <><ShoppingBag className="h-4 w-4" /> Add to bag</>}</button></div>
        </article>)}
      </div>
    </main>
  );
}
