'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle, Mail, Home, ArrowLeft } from 'lucide-react';

export default function ThankYouPage() {
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    // Get order ID from URL params if available
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (sessionId) {
      setOrderId(sessionId);
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-[#041E42] text-white py-4 px-6 shadow-md">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <Link href="/" className="text-xl font-serif font-bold tracking-wider hover:opacity-80 transition">
            NITTANY CRAFT.
          </Link>
          <Link 
            href="/"
            className="flex items-center gap-2 text-sm hover:opacity-80 transition"
          >
            <Home size={16} />
            Back to Home
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto py-20 px-6">
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          {/* Success Icon */}
          <div className="mb-6 flex justify-center">
            <div className="bg-green-100 rounded-full p-6">
              <CheckCircle size={64} className="text-green-600" />
            </div>
          </div>

          {/* Thank You Message */}
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-[#041E42] mb-4">
            Thank You for Your Purchase!
          </h1>
          
          <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto">
            Your custom laser engraving order has been received and is being processed.
            {orderId && (
              <span className="block mt-2 text-sm text-slate-500">
                Order ID: {orderId}
              </span>
            )}
          </p>

          {/* What Happens Next */}
          <div className="bg-slate-50 rounded-xl p-8 mb-8 text-left max-w-2xl mx-auto">
            <h2 className="text-xl font-serif font-bold text-[#041E42] mb-4">
              What Happens Next?
            </h2>
            <ul className="space-y-3 text-slate-600">
              <li className="flex items-start gap-3">
                <div className="bg-[#041E42] text-white rounded-full p-1 mt-1">
                  <CheckCircle size={16} />
                </div>
                <div>
                  <strong className="text-[#041E42]">Order Confirmed</strong>
                  <p className="text-sm">We've received your payment and order details.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="bg-[#041E42] text-white rounded-full p-1 mt-1">
                  <Mail size={16} />
                </div>
                <div>
                  <strong className="text-[#041E42]">Email Notification</strong>
                  <p className="text-sm">You'll receive a confirmation email with your order details and image previews.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="bg-[#041E42] text-white rounded-full p-1 mt-1">
                  <CheckCircle size={16} />
                </div>
                <div>
                  <strong className="text-[#041E42]">Production</strong>
                  <p className="text-sm">Your custom laser engraving will be crafted and prepared for shipping.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="bg-[#041E42] text-white rounded-full p-1 mt-1">
                  <CheckCircle size={16} />
                </div>
                <div>
                  <strong className="text-[#041E42]">Shipping</strong>
                  <p className="text-sm">We'll notify you when your order ships with tracking information.</p>
                </div>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div className="mb-8 p-6 bg-blue-50 rounded-xl border border-blue-200">
            <p className="text-sm text-slate-700">
              <strong>Questions about your order?</strong>
              <br />
              Check your email for order details, or contact us if you need assistance.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/"
              className="flex items-center justify-center gap-2 bg-[#041E42] text-white px-8 py-4 rounded-xl font-bold hover:bg-[#001433] transition"
            >
              <Home size={20} />
              Return to Home
            </Link>
            <Link
              href="/upload"
              className="flex items-center justify-center gap-2 bg-white border-2 border-[#041E42] text-[#041E42] px-8 py-4 rounded-xl font-bold hover:bg-slate-50 transition"
            >
              <ArrowLeft size={20} />
              Create Another
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 px-6 text-center mt-20">
        <p className="font-serif text-slate-200 text-lg mb-4">NITTANY CRAFT.</p>
        <p className="text-sm">Not officially affiliated with Pennsylvania State University.</p>
        <p className="text-sm mt-2">&copy; {new Date().getFullYear()} All Rights Reserved.</p>
      </footer>
    </div>
  );
}

