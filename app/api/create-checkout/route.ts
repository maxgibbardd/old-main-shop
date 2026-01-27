import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { put } from '@vercel/blob';

// Initialize Stripe lazily (only when needed)
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-12-15.clover',
  });
}

/**
 * Create Stripe Checkout Session with image URLs in metadata
 * This allows the webhook to access image URLs after payment
 */
export async function POST(request: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY || !process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: 'Stripe or Blob storage not configured.' },
        { status: 500 }
      );
    }

    const stripe = getStripe();

    const formData = await request.formData();
    const originalImageBase64 = formData.get('originalImage') as string;
    const processedImageBase64 = formData.get('processedImage') as string;
    const originalMimeType = formData.get('originalMimeType') as string || 'image/png';
    const processedMimeType = formData.get('processedMimeType') as string || 'image/png';

    if (!originalImageBase64 || !processedImageBase64) {
      return NextResponse.json(
        { error: 'Missing image data' },
        { status: 400 }
      );
    }

    // Save images to blob storage first
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 9);
    const tempFolder = `temp/${timestamp}-${randomSuffix}`;

    // Convert base64 to buffers
    const originalBuffer = Buffer.from(originalImageBase64, 'base64');
    const processedBuffer = Buffer.from(processedImageBase64, 'base64');

    // Save original image
    const originalBlob = await put(
      `${tempFolder}/original.${originalMimeType.split('/')[1] || 'png'}`,
      originalBuffer,
      {
        access: 'public',
        contentType: originalMimeType,
      }
    );

    // Save processed image
    const processedBlob = await put(
      `${tempFolder}/processed.png`,
      processedBuffer,
      {
        access: 'public',
        contentType: processedMimeType,
      }
    );

    // Create Stripe Checkout Session with image URLs in metadata
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Custom Laser Engraving',
              description: 'Custom photo laser-engraved on wood',
            },
            unit_amount: 4000, // $40.00
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${request.headers.get('origin') || 'https://your-domain.vercel.app'}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.headers.get('origin') || 'https://your-domain.vercel.app'}/upload?canceled=true`,
      metadata: {
        orderType: 'custom-engraving',
        originalUrl: originalBlob.url,
        processedUrl: processedBlob.url,
        // Store base64 as fallback (if URLs are too long for metadata)
        originalImage: originalImageBase64.substring(0, 500), // Truncate if needed
        processedImage: processedImageBase64.substring(0, 500),
        originalMimeType: originalMimeType,
        processedMimeType: processedMimeType,
      },
    });

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      url: session.url, // Redirect user to this URL
      imageUrls: {
        original: originalBlob.url,
        processed: processedBlob.url,
      },
    });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session', details: error.message },
      { status: 500 }
    );
  }
}

