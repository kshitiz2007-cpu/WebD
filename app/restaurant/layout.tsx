import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { CartProvider } from '@/lib/restaurant/cart-context';
import SiteHeader from '@/components/restaurant/SiteHeader';
import SiteFooter from '@/components/restaurant/SiteFooter';

export const metadata: Metadata = {
  title: 'Zaayka Kitchen | Good food, good mood',
  description: 'Freshly made favourites, comforting classics and a little taste of everywhere.',
};

export default function RestaurantLayout({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      <div className="min-h-screen bg-[#100907] text-[#fff7f0]">
        <SiteHeader />
        {children}
        <SiteFooter />
      </div>
    </CartProvider>
  );
}
