'use client';

import Link from 'next/link';
import { ArrowLeft, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useCart } from '@/lib/restaurant/cart-context';
import { formatINR } from '@/lib/restaurant/products';

export default function RestaurantCheckoutPage() {
  const { items, subtotal, hydrated, setQuantity, removeItem, clearCart } = useCart();
  const deliveryFee = subtotal > 0 ? 40 : 0;
  const total = subtotal + deliveryFee;

  if (!hydrated) return <main className="mx-auto min-h-[70vh] max-w-5xl px-5 py-20 text-center text-[#cbbab0]">Loading your bag…</main>;

  return (
    <main className="mx-auto min-h-[70vh] max-w-5xl px-5 py-14 sm:px-8 sm:py-20">
      <Link href="/restaurant/menu" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#ff8755] hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to menu</Link>
      <div className="mt-7"><p className="text-xs font-bold uppercase tracking-[0.24em] text-[#ff8755]">Almost there · made fresh for you</p><h1 className="mt-3 text-4xl font-black sm:text-5xl">Complete your order<span className="text-[#ff743d]">.</span></h1><p className="mt-3 text-sm text-[#cbbab0]">Review your favourites before placing your order.</p></div>

      {items.length === 0 ? <section className="mt-10 rounded-3xl border border-white/10 bg-[#1b100c] px-6 py-14 text-center"><ShoppingBag className="mx-auto h-9 w-9 text-[#ff743d]" /><h2 className="mt-5 text-xl font-bold">Your bag is looking a little empty.</h2><p className="mt-2 text-sm text-[#bca99e]">Add something delicious from our menu to get started.</p><Link href="/restaurant/menu" className="mt-7 inline-flex rounded-full bg-[#ff743d] px-7 py-3 text-sm font-bold text-[#1b0c07] hover:bg-[#ff986f]">Explore the menu</Link></section> :
      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_340px]">
        <section className="space-y-4">
          {items.map((item) => <article key={item.id} className="flex gap-4 rounded-2xl border border-white/10 bg-[#1b100c] p-4 sm:gap-6 sm:p-5">
            <div className="h-24 w-24 shrink-0 rounded-xl bg-cover bg-center sm:h-28 sm:w-32" style={{ backgroundImage: `url('${item.image}')` }} />
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="font-bold">{item.name}</h2><p className="mt-1 text-xs text-[#bca99e]">{formatINR(item.price)} each</p></div><p className="font-bold text-[#ff8755]">{formatINR(item.price * item.quantity)}</p></div>
              <div className="mt-4 flex items-center gap-3"><button aria-label={`Decrease ${item.name} quantity`} onClick={() => setQuantity(item.id, item.quantity - 1)} className="rounded-full border border-white/15 p-2 hover:border-[#ff743d]"><Minus className="h-3.5 w-3.5" /></button><span className="min-w-5 text-center text-sm font-bold">{item.quantity}</span><button aria-label={`Increase ${item.name} quantity`} onClick={() => setQuantity(item.id, item.quantity + 1)} className="rounded-full border border-white/15 p-2 hover:border-[#ff743d]"><Plus className="h-3.5 w-3.5" /></button><button onClick={() => removeItem(item.id)} className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-[#cbbab0] hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /> Remove</button></div>
            </div>
          </article>)}
          <button onClick={clearCart} className="text-xs font-semibold text-[#bca99e] underline underline-offset-4 hover:text-white">Clear bag</button>
        </section>
        <aside className="h-fit rounded-3xl border border-white/10 bg-[#1b100c] p-6"><h2 className="text-lg font-black">Order summary</h2><div className="mt-6 space-y-3 text-sm text-[#cbbab0]"><div className="flex justify-between"><span>Subtotal</span><span>{formatINR(subtotal)}</span></div><div className="flex justify-between"><span>Delivery</span><span>{deliveryFee ? formatINR(deliveryFee) : '—'}</span></div><div className="border-t border-white/10 pt-4 text-base font-black text-white flex justify-between"><span>Total</span><span className="text-[#ff8755]">{formatINR(total)}</span></div></div><button onClick={() => window.alert('Order checkout is ready to connect to your preferred payment or WhatsApp flow.')} className="mt-7 w-full rounded-full bg-[#ff743d] px-5 py-3.5 text-sm font-black text-[#1b0c07] hover:bg-[#ff986f]">Continue to checkout</button><p className="mt-3 text-center text-[10px] leading-5 text-[#927f74]">Taxes and final delivery details can be confirmed at order placement.</p></aside>
      </div>}
    </main>
  );
}
