import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { put } from '@vercel/blob';

// Note: In App Router, the bodyParser config is ignored. 
// You are bound by your hosting provider's limit (Vercel = 4.5MB).

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-12-15.clover',
  });
}

export async function POST(request: NextRequest) {
  try {
    // 1. Check Config
    if (!process.env.STRIPE_SECRET_KEY || !process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
    }

    // 2. Parse Form Data
    const formData = await request.formData();
    const originalImageBase64 = formData.get('originalImage') as string;
    const processedImageBase64 = formData.get('processedImage') as string;
    
    if (!originalImageBase64 || !processedImageBase64) {
      return NextResponse.json({ error: 'Images too large or missing.' }, { status: 400 });
    }

    // 3. Convert to Buffers
    // We do this BEFORE calling Stripe to ensure the images are valid
    const originalBuffer = Buffer.from(originalImageBase64, 'base64');
    const processedBuffer = Buffer.from(processedImageBase64, 'base64');

    // 4. Upload to Vercel Blob
    const timestamp = Date.now();
    const folder = `temp/${timestamp}`;

    const [originalBlob, processedBlob] = await Promise.all([
      put(`${folder}/original.png`, originalBuffer, { access: 'public', contentType: 'image/png' }),
      put(`${folder}/processed.png`, processedBuffer, { access: 'public', contentType: 'image/png' })
    ]);

    // 5. Create Stripe Session
    const stripe = getStripe();
    const price = parseFloat(formData.get('price') as string || '70');
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: 'Custom Laser Engraving' },
          unit_amount: Math.round(price * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${request.headers.get('origin')}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.headers.get('origin')}/upload`,
      metadata: {
        orderType: 'custom-engraving',
        originalUrl: originalBlob.url,
        processedUrl: processedBlob.url,
      },
    });

    return NextResponse.json({ url: session.url });

  } catch (error: any) {
    console.error('Checkout Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}