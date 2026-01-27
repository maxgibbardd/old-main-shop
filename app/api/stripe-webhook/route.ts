import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { put } from '@vercel/blob';
import { sendPurchaseNotification } from '@/lib/email';

// Initialize Stripe lazily (only when needed)
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-12-15.clover',
  });
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'No signature provided' },
      { status: 400 }
    );
  }

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: 'Stripe not configured' },
      { status: 500 }
    );
  }

  const stripe = getStripe();

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    );
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    
    // Get metadata from Stripe session (contains image data)
    const metadata = session.metadata || {};
    const orderId = session.id; // Use Stripe session ID as order ID
    const customerEmail = session.customer_email || session.customer_details?.email || session.customer_details?.email;
    
    // Log customer email for debugging
    console.log('Customer email from Stripe:', {
      customer_email: session.customer_email,
      customer_details_email: session.customer_details?.email,
      final_customerEmail: customerEmail,
    });

    // Check if this is a custom engraving order
    // Images are already saved before redirect, so we fetch them from blob URLs
    // or use metadata if provided
    try {
      let originalUrl: string;
      let processedUrl: string;
      let originalBuffer: Buffer | undefined;
      let processedBuffer: Buffer | undefined;

      // Check if image URLs are in metadata (from prepare-purchase)
      if (metadata.originalUrl && metadata.processedUrl) {
        originalUrl = metadata.originalUrl;
        processedUrl = metadata.processedUrl;
        
        // Fetch images to attach to email
        const originalResponse = await fetch(originalUrl);
        const processedResponse = await fetch(processedUrl);
        originalBuffer = Buffer.from(await originalResponse.arrayBuffer());
        processedBuffer = Buffer.from(await processedResponse.arrayBuffer());
      } else {
        // Fallback: If images weren't saved before, save them now
        // This shouldn't happen if purchase flow works correctly
        const originalImageBase64 = metadata.originalImage;
        const processedImageBase64 = metadata.processedImage;
        const originalMimeType = metadata.originalMimeType || 'image/png';
        const processedMimeType = metadata.processedMimeType || 'image/png';

        if (!originalImageBase64 || !processedImageBase64) {
          console.error('Missing image data - images should be saved before purchase');
          return NextResponse.json(
            { error: 'Missing image data' },
            { status: 400 }
          );
        }

        // Save images to blob storage
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 9);
        const folder = `orders/${orderId}`;

        // Convert base64 to buffers
        originalBuffer = Buffer.from(originalImageBase64, 'base64');
        processedBuffer = Buffer.from(processedImageBase64, 'base64');

        // Save original image
        const originalBlob = await put(
          `${folder}/original-${timestamp}-${randomSuffix}.${originalMimeType.split('/')[1] || 'png'}`,
          originalBuffer,
          {
            access: 'public',
            contentType: originalMimeType,
          }
        );

        // Save processed image
        const processedBlob = await put(
          `${folder}/processed-${timestamp}-${randomSuffix}.png`,
          processedBuffer,
          {
            access: 'public',
            contentType: processedMimeType,
          }
        );

        originalUrl = originalBlob.url;
        processedUrl = processedBlob.url;
      }

      console.log('Processing order with images:', {
        original: originalUrl,
        processed: processedUrl,
        customerEmail: customerEmail,
        hasCustomerEmail: !!customerEmail,
      });

      // Send email notification
      const emailResult = await sendPurchaseNotification({
        originalUrl: originalUrl,
        processedUrl: processedUrl,
        originalBuffer: originalBuffer,
        processedBuffer: processedBuffer,
        orderId: orderId,
        customerEmail: customerEmail || undefined,
      });
      
      console.log('Email send result:', {
        success: emailResult.success,
        sent: emailResult.sent,
        failed: emailResult.failed,
        error: emailResult.error,
      });

      return NextResponse.json({
        success: true,
        orderId: orderId,
        images: {
          original: originalUrl,
          processed: processedUrl,
        },
        email: emailResult,
      });
    } catch (error: any) {
      console.error('Error processing order:', error);
      return NextResponse.json(
        {
          error: 'Failed to process order',
          details: error.message,
        },
        { status: 500 }
      );
    }
  }

  // Return success for other event types
  return NextResponse.json({ received: true });
}

