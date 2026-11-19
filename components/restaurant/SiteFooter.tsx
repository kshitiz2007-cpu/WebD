import Link from 'next/link';

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#0b0807] px-5 py-9 text-[#a9988e] sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-lg font-black tracking-[0.16em] text-[#ff743d]">ZAAYKA.</p><p className="mt-1 text-xs">Good food. Good mood. Made with love.</p></div>
        <div className="flex gap-5 text-sm"><Link href="/restaurant/menu" className="hover:text-white">Menu</Link><Link href="/restaurant/contact" className="hover:text-white">Contact</Link><Link href="/restaurant/checkout" className="hover:text-white">Your bag</Link></div>
        <p className="text-xs">© {new Date().getFullYear()} Zaayka Kitchen. All rights reserved.</p>
      </div>
    </footer>
  );
}
