'use client';

import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { useCart } from '@/lib/restaurant/cart-context';

const links = [
  { href: '/restaurant', label: 'Home' },
  { href: '/restaurant/menu', label: 'Menu' },
  { href: '/restaurant/contact', label: 'Contact' },
];

export default function SiteHeader() {
  const { itemCount } = useCart();
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#100907]/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/restaurant" className="text-2xl font-black tracking-[0.16em] text-[#ff743d]">ZAAYKA<span className="text-white">.</span></Link>
        <nav className="hidden items-center gap-8 md:flex">
          {links.map((link) => <Link key={link.href} href={link.href} className="text-sm font-medium text-[#d6c6bc] transition hover:text-[#ff8755]">{link.label}</Link>)}
        </nav>
        <Link href="/restaurant/checkout" className="inline-flex items-center gap-2 rounded-full border border-[#ff743d]/50 px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#ff743d]">
          <ShoppingBag className="h-4 w-4" /> Bag <span className="rounded-full bg-[#ff743d] px-2 py-0.5 text-xs text-white">{itemCount}</span>
        </Link>
      </div>
      <nav className="flex justify-center gap-7 border-t border-white/5 px-4 py-2 md:hidden">
        {links.map((link) => <Link key={link.href} href={link.href} className="text-xs font-medium text-[#d6c6bc]">{link.label}</Link>)}
        <Link href="/restaurant/checkout" className="text-xs font-semibold text-[#ff8755]">Checkout</Link>
      </nav>
    </header>
  );
}
