import Link from 'next/link';
import { ArrowRight, Clock3, MapPin, Sparkles } from 'lucide-react';
import { RESTAURANT_PRODUCTS, formatINR } from '@/lib/restaurant/products';

export default function RestaurantHomePage() {
  const featured = RESTAURANT_PRODUCTS.slice(0, 3);
  return (
    <main>
      <section className="relative isolate overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_75%_35%,rgba(244,105,52,.25),transparent_35%),linear-gradient(115deg,#160b08,#24100b_55%,#0e0908)]" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:py-28">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#ff743d]/30 bg-[#ff743d]/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-[#ff9a70]"><Sparkles className="h-3.5 w-3.5" /> A little taste of everywhere</p>
            <h1 className="max-w-2xl text-5xl font-black leading-[1.04] tracking-tight sm:text-7xl">Food worth <span className="text-[#ff743d]">gathering</span> for.</h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-[#cbbab0]">From comforting classics to new favourites, discover thoughtfully prepared dishes, fresh ingredients and flavours made to bring everyone to the table.</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/restaurant/menu" className="inline-flex items-center gap-3 rounded-full bg-[#ff743d] px-6 py-3.5 text-sm font-bold text-[#1b0c07] transition hover:bg-[#ff986f]">Explore the menu <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/restaurant/contact" className="rounded-full border border-white/20 px-6 py-3.5 text-sm font-semibold text-white hover:border-[#ff743d]">Find us</Link>
            </div>
            <div className="mt-12 flex flex-wrap gap-7 text-xs text-[#cbbab0]"><span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4 text-[#ff743d]" /> Daily, 11 AM – 11 PM</span><span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-[#ff743d]" /> Bhopal, India</span></div>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 rounded-[2rem] border border-[#ff743d]/20 rotate-3" />
            <div className="h-[420px] overflow-hidden rounded-[1.7rem] border border-white/10 bg-cover bg-center shadow-2xl shadow-black/50" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=1400&q=90')" }} />
            <div className="absolute -bottom-5 -left-4 rounded-2xl border border-white/10 bg-[#21110c] px-5 py-4 shadow-xl"><p className="text-xs text-[#cbbab0]">Made fresh, served happy</p><p className="mt-1 text-xl font-black text-[#ff9a70]">Every single day.</p></div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
        <div className="mb-9 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.22em] text-[#ff8755]">From our kitchen</p><h2 className="mt-3 text-3xl font-black sm:text-4xl">Guest favourites</h2></div><Link href="/restaurant/menu" className="text-sm font-bold text-[#ff8755] hover:text-white">View full menu →</Link></div>
        <div className="grid gap-6 md:grid-cols-3">
          {featured.map((product) => <article key={product.id} className="overflow-hidden rounded-3xl border border-white/10 bg-[#1b100c]">
            <div className="h-56 bg-cover bg-center" style={{ backgroundImage: `url('${product.image}')` }} />
            <div className="p-6"><div className="flex items-start justify-between gap-3"><h3 className="text-lg font-bold">{product.name}</h3><span className="whitespace-nowrap text-sm font-bold text-[#ff8755]">{formatINR(product.price)}</span></div><p className="mt-2 text-sm leading-6 text-[#bca99e]">{product.description}</p></div>
          </article>)}
        </div>
      </section>
      <section className="mx-auto mb-20 max-w-7xl px-5 sm:px-8"><div className="rounded-[2rem] border border-[#ff743d]/20 bg-[linear-gradient(110deg,#2a130c,#160c09)] px-7 py-12 text-center sm:px-12"><p className="text-xs font-bold uppercase tracking-[0.24em] text-[#ff9a70]">Come hungry, leave happy</p><h2 className="mt-3 text-3xl font-black sm:text-4xl">Your table is waiting.</h2><p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[#cbbab0]">Pick your favourites, add them to your bag and let us take care of the delicious part.</p><Link href="/restaurant/menu" className="mt-7 inline-flex rounded-full bg-[#ff743d] px-7 py-3 text-sm font-bold text-[#1b0c07] hover:bg-[#ff986f]">Order now</Link></div></section>
    </main>
  );
}
