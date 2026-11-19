'use client';

import { useState, type FormEvent } from 'react';
import { Clock3, Mail, MapPin, Phone, Send } from 'lucide-react';

export default function RestaurantContactPage() {
  const [sent, setSent] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSent(true);
    setName('');
    setEmail('');
    setMessage('');
  }

  return (
    <main className="mx-auto min-h-[70vh] max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
      <div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.24em] text-[#ff8755]">We would love to hear from you</p><h1 className="mt-3 text-4xl font-black sm:text-5xl">Let’s talk<span className="text-[#ff743d]">.</span></h1><p className="mt-4 text-sm leading-7 text-[#cbbab0]">Questions about the menu, a special gathering or just want to say hello? Send us a note or visit the kitchen.</p></div>
      <div className="mt-10 grid gap-8 lg:grid-cols-[.8fr_1.2fr]">
        <section className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-[#1b100c] p-6"><MapPin className="h-5 w-5 text-[#ff8755]" /><h2 className="mt-4 font-bold">Visit us</h2><p className="mt-2 text-sm leading-6 text-[#bca99e]">Bhopal, Madhya Pradesh, India<br />Add your restaurant’s full street address here.</p></div>
          <div className="rounded-2xl border border-white/10 bg-[#1b100c] p-6"><Clock3 className="h-5 w-5 text-[#ff8755]" /><h2 className="mt-4 font-bold">Opening hours</h2><p className="mt-2 text-sm leading-6 text-[#bca99e]">Every day<br />11:00 AM – 11:00 PM</p></div>
          <div className="rounded-2xl border border-white/10 bg-[#1b100c] p-6"><Phone className="h-5 w-5 text-[#ff8755]" /><h2 className="mt-4 font-bold">Call the kitchen</h2><p className="mt-2 text-sm text-[#bca99e]">Add your restaurant phone number</p><Mail className="mt-5 h-5 w-5 text-[#ff8755]" /><p className="mt-2 text-sm text-[#bca99e]">Add your contact email</p></div>
        </section>
        <form onSubmit={handleSubmit} className="rounded-3xl border border-white/10 bg-[#1b100c] p-6 sm:p-9">
          <h2 className="text-2xl font-black">Send us a message</h2><p className="mt-2 text-sm text-[#bca99e]">We’ll be happy to help with your questions.</p>
          {sent && <p role="status" className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">Thanks! Your message has been prepared. Connect this form to an email service to receive submissions.</p>}
          <label className="mt-6 block text-xs font-bold text-[#d6c6bc]">Your name<input required value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#100907] px-4 py-3 text-sm text-white outline-none focus:border-[#ff743d]" placeholder="Name" /></label>
          <label className="mt-4 block text-xs font-bold text-[#d6c6bc]">Email address<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#100907] px-4 py-3 text-sm text-white outline-none focus:border-[#ff743d]" placeholder="you@example.com" /></label>
          <label className="mt-4 block text-xs font-bold text-[#d6c6bc]">Message<textarea required rows={5} value={message} onChange={(event) => setMessage(event.target.value)} className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-[#100907] px-4 py-3 text-sm text-white outline-none focus:border-[#ff743d]" placeholder="How can we help?" /></label>
          <button type="submit" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#ff743d] px-7 py-3 text-sm font-black text-[#1b0c07] hover:bg-[#ff986f]"><Send className="h-4 w-4" /> Send message</button>
        </form>
      </div>
    </main>
  );
}
