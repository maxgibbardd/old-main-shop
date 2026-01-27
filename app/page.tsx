// file: app/page.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ShoppingBag, Star, ShieldCheck, Truck, Loader2 } from 'lucide-react';

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOldMainPurchase = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/create-checkout-old-main', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ price: '50' }), // $50.00 for Old Main Classic
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start checkout');
      setIsLoading(false);
      console.error('Checkout error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-[#041E42] text-white py-4 px-6 shadow-md">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          {/* Replaced NITTANY CRAFT text with your logo */}
          <div className="flex items-center">
            <img 
              src="/favicon.ico" 
              alt="Nittany Craft Logo" 
              className="h-20 w-auto" 
            />
          </div>

          <button
            onClick={handleOldMainPurchase}
            disabled={isLoading}
            className="bg-white text-[#041E42] px-5 py-2 rounded-full font-medium hover:bg-slate-100 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Loading...
              </>
            ) : (
              'Buy Now'
            )}
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative bg-[#041E42] text-white py-24 px-6 text-center overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[url('/noise.png')]"></div> {/* Texture overlay if available */}
        <div className="relative max-w-4xl mx-auto z-10">
          <span className="uppercase tracking-[0.2em] text-slate-300 text-sm font-semibold mb-4 block">
            Limited Edition Woodwork
          </span>
          <h2 className="text-5xl md:text-7xl font-serif font-bold mb-6 leading-tight">
            Old Main,<br/>Etched in History.
          </h2>
          <p className="text-lg md:text-xl text-slate-200 max-w-2xl mx-auto mb-10 leading-relaxed">
            Bring the heart of Happy Valley into your home. A precision laser-cut masterpiece crafted from premium hardwood, capturing every architectural detail of Penn State's iconic landmark.
          </p>
          <button
            onClick={handleOldMainPurchase}
            disabled={isLoading}
            className="inline-flex items-center gap-2 bg-white text-[#041E42] px-8 py-4 rounded-full font-bold text-lg hover:bg-slate-100 hover:scale-105 transition transform shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <ShoppingBag size={20} />
                Order Your Piece - $50
              </>
            )}
          </button>
          <p className="mt-4 text-slate-400 text-sm">Free shipping to State College & beyond.</p>
        </div>
      </header>

      {/* Product Showcase */}
      <section className="max-w-6xl mx-auto py-20 px-6 grid md:grid-cols-2 gap-12 items-center">
        <div className="relative group">
          <div className="absolute -inset-2 bg-[#041E42] rounded-2xl opacity-10 group-hover:opacity-20 transition blur-lg"></div>
          {/* PLACEHOLDER FOR THE IMAGE */}
          <div className="relative bg-white p-4 rounded-2xl shadow-xl rotate-1 group-hover:rotate-0 transition duration-500">
             <img 
              src="/old-main-wood.jpg" 
              alt="Laser engraved wooden Old Main" 
              className="rounded-lg w-full h-auto object-cover grayscale-[20%] group-hover:grayscale-0 transition"
            />
          </div>
        </div>
        <div>
          <h3 className="text-3xl font-serif font-bold text-[#041E42] mb-6">Precision Meets Tradition.</h3>
          <p className="text-slate-600 mb-6 leading-relaxed">
            We take the iconic outline of Old Main and laser-burn it onto sustainably sourced maple. The result is a high-contrast, tactile piece of art that ages beautifully.
          </p>
          
          <ul className="space-y-4 mb-8">
            <li className="flex items-start gap-3">
              <div className="bg-slate-100 p-2 rounded-full text-[#041E42]"><Star size={18}/></div>
              <div>
                <strong className="block text-[#041E42]">High-Definition Detail</strong>
                <span className="text-slate-500 text-sm">Captures the clock tower and columns perfectly.</span>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="bg-slate-100 p-2 rounded-full text-[#041E42]"><ShieldCheck size={18}/></div>
              <div>
                <strong className="block text-[#041E42]">Protected Finish</strong>
                <span className="text-slate-500 text-sm">Sealed to protect against humidity and UV light.</span>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="bg-slate-100 p-2 rounded-full text-[#041E42]"><Truck size={18}/></div>
              <div>
                <strong className="block text-[#041E42]">Safe Shipping</strong>
                <span className="text-slate-500 text-sm">Packaged securely to arrive in pristine condition.</span>
              </div>
            </li>
          </ul>
        </div>
      </section>

      {/* Two-Option Selection Section */}
      <section className="max-w-6xl mx-auto py-20 px-6">
        <h2 className="text-4xl font-serif font-bold text-center text-[#041E42] mb-12">Choose Your Canvas</h2>
        
        <div className="grid md:grid-cols-2 gap-8">
          {/* Option 1: The Classic Old Main */}
          <div className="bg-white border-2 border-slate-200 p-8 rounded-3xl hover:border-[#041E42] transition group">
            <h3 className="text-2xl font-serif font-bold mb-2 text-[#041E42]">The Old Main Classic</h3>
            <p className="text-slate-500 mb-6 text-sm">Our signature Penn State landmark engraving.</p>
            <div className="text-3xl font-bold mb-6">$50</div>
            <button
              onClick={handleOldMainPurchase}
              disabled={isLoading}
              className="w-full text-center bg-[#041E42] text-white py-4 rounded-xl font-bold hover:bg-[#001433] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Loading...
                </>
              ) : (
                'Buy Original'
              )}
            </button>
          </div>

          {/* Option 2: Custom Upload */}
          <div className="bg-white border-2 border-[#041E42] p-8 rounded-3xl relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-[#041E42] text-white px-4 py-1 text-xs font-bold uppercase">New</div>
            <h3 className="text-2xl font-serif font-bold mb-2 text-[#041E42]">Custom Masterpiece</h3>
            <p className="text-slate-500 mb-6 text-sm">Upload your own photo to be laser-sketched on wood.</p>
            <div className="text-3xl font-bold mb-6">$70</div>
            
            <div className="space-y-4">
               <Link 
                href="/upload"
                className="block text-center bg-[#041E42] text-white py-4 rounded-xl font-bold hover:bg-[#001433] transition"
              >
                Upload & Preview Your Image
              </Link>
              <p className="text-[10px] text-slate-400 text-center">Upload your image to see a preview, then purchase when ready.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Error Message */}
      {error && (
        <div className="max-w-6xl mx-auto px-6 mb-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
            {error}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 px-6 text-center">
        <p className="font-serif text-slate-200 text-lg mb-4">NITTANY CRAFT.</p>
        <p className="text-sm">Not officially affiliated with Pennsylvania State University.</p>
        <p className="text-sm mt-2">&copy; {new Date().getFullYear()} All Rights Reserved.</p>
      </footer>
    </div>
  );
}