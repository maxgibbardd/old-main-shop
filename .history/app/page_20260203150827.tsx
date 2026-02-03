'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { ShoppingBag, Star, ShieldCheck, Truck, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Ref for the scroll container
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth : scrollLeft + clientWidth;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  const handleOldMainPurchase = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/create-checkout-old-main', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: '35' }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create checkout session');
      if (data.url) window.location.href = data.url;
    } catch (err: any) {
      setError(err.message || 'Failed to start checkout');
      setIsLoading(false);
    }
  };

  const images = [
    { src: "/Stack_Picture.png", alt: "Stacked wooden engravings" },
    { src: "/Hanging_Image.png", alt: "Old Main engraving hanging on a wall" },
    // You can easily add more images here
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-[#041E42] text-white py-4 px-6 shadow-md">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <img src="/favicon.ico" alt="Nittany Craft Logo" className="h-16 w-auto" />
          <button
            onClick={handleOldMainPurchase}
            disabled={isLoading}
            className="bg-white text-[#041E42] px-5 py-2 rounded-full font-medium hover:bg-slate-100 transition text-sm disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : 'Buy Now'}
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative bg-[#041E42] text-white py-24 px-6 text-center overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[url('/noise.png')]"></div>
        <div className="relative max-w-4xl mx-auto z-10">
          <span className="uppercase tracking-[0.2em] text-slate-300 text-sm font-semibold mb-4 block">Limited Edition Woodwork</span>
          <h2 className="text-5xl md:text-7xl font-serif font-bold mb-6">Old Main,<br/>Etched in History.</h2>
          <button
            onClick={handleOldMainPurchase}
            className="inline-flex items-center gap-2 bg-white text-[#041E42] px-8 py-4 rounded-full font-bold text-lg hover:scale-105 transition shadow-lg"
          >
            <ShoppingBag size={20} /> Order Your Piece - $35
          </button>
        </div>
      </header>

      {/* Product Showcase with Scroll Wheel */}
      <section className="max-w-6xl mx-auto py-20 px-6 grid md:grid-cols-2 gap-16 items-center">
        <div className="relative group">
          {/* Scroll Container */}
          <div 
            ref={scrollRef}
            className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-4 pb-4"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {images.map((img, idx) => (
              <div key={idx} className="min-w-full snap-center">
                <div className="bg-white p-2 rounded-2xl shadow-xl border border-slate-100">
                  <div className="aspect-square w-full overflow-hidden rounded-xl bg-slate-100">
                    <img 
                      src={img.src} 
                      alt={img.alt} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Navigation Arrows */}
          <button 
            onClick={() => scroll('left')}
            className="absolute left-[-20px] top-1/2 -translate-y-1/2 bg-white p-3 rounded-full shadow-lg text-[#041E42] hover:bg-slate-50 transition z-30"
          >
            <ChevronLeft size={24} />
          </button>
          <button 
            onClick={() => scroll('right')}
            className="absolute right-[-20px] top-1/2 -translate-y-1/2 bg-white p-3 rounded-full shadow-lg text-[#041E42] hover:bg-slate-50 transition z-30"
          >
            <ChevronRight size={24} />
          </button>
          
          {/* Visual Indicator */}
          <div className="flex justify-center gap-2 mt-4">
            {images.map((_, i) => (
              <div key={i} className="w-2 h-2 rounded-full bg-slate-300"></div>
            ))}
          </div>
        </div>

        <div className="pl-4">
          <h3 className="text-4xl font-serif font-bold text-[#041E42] mb-6">Precision Meets Tradition.</h3>
          <p className="text-lg text-slate-600 mb-8">
            We take the iconic outline of Old Main and laser-burn it onto sustainably sourced maple. The result is a high-contrast, tactile piece of art that ages beautifully.
          </p>
          
          <ul className="space-y-6">
            <li className="flex items-start gap-4">
              <div className="bg-slate-100 p-3 rounded-full text-[#041E42] shadow-sm"><Star size={22}/></div>
              <div>
                <strong className="block text-[#041E42] text-lg">High-Definition Detail</strong>
                <span className="text-slate-500">Captures the clock tower and columns perfectly.</span>
              </div>
            </li>
            <li className="flex items-start gap-4">
              <div className="bg-slate-100 p-3 rounded-full text-[#041E42] shadow-sm"><ShieldCheck size={22}/></div>
              <div>
                <strong className="block text-[#041E42] text-lg">Protected Finish</strong>
                <span className="text-slate-500">Sealed to protect against humidity and UV light.</span>
              </div>
            </li>
          </ul>
        </div>
      </section>

      {/* Pricing Options */}
      <section className="max-w-6xl mx-auto py-20 px-6">
        <h2 className="text-4xl font-serif font-bold text-center text-[#041E42] mb-12">Choose Your Canvas</h2>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white border-2 border-slate-200 p-8 rounded-3xl hover:border-[#041E42] transition group">
            <h3 className="text-2xl font-serif font-bold mb-2 text-[#041E42]">The Old Main Classic</h3>
            <div className="text-3xl font-bold mb-6">$35</div>
            <button
              onClick={handleOldMainPurchase}
              disabled={isLoading}
              className="w-full bg-[#041E42] text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : 'Buy Original'}
            </button>
          </div>

          <div className="bg-white border-2 border-[#041E42] p-8 rounded-3xl relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-[#041E42] text-white px-4 py-1 text-xs font-bold uppercase">New</div>
            <h3 className="text-2xl font-serif font-bold mb-2 text-[#041E42]">Custom Masterpiece</h3>
            <div className="text-3xl font-bold mb-6">$70</div>
            <Link href="/upload" className="block text-center bg-[#041E42] text-white py-4 rounded-xl font-bold">
              Upload & Preview Your Image
            </Link>
          </div>
        </div>
      </section>

      <footer className="bg-slate-900 text-slate-400 py-12 px-6 text-center">
        <p className="font-serif text-slate-200 text-lg mb-4">NITTANY CRAFT.</p>
        <p className="text-sm">&copy; {new Date().getFullYear()} All Rights Reserved.</p>
      </footer>
    </div>
  );
}