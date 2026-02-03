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

/**
 * Create Stripe Checkout Session with image URLs in metadata
 * This allows the webhook to access image URLs after payment
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Check Config
    if (!process.env.STRIPE_SECRET_KEY || !process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
    }

    const stripe = getStripe();

    // 2. Parse Form Data
    const formData = await request.formData();
    
    // Accept URLs (preferred method to avoid request size limits) or base64 (fallback)
    const originalImageUrl = formData.get('originalImageUrl') as string | null;
    const processedImageUrl = formData.get('processedImageUrl') as string | null;
    const originalImageBase64 = formData.get('originalImage') as string | null; // Fallback for backwards compatibility
    const processedImageBase64 = formData.get('processedImage') as string | null; // Fallback
    const originalMimeType = formData.get('originalMimeType') as string || 'image/png';
    const processedMimeType = formData.get('processedMimeType') as string || 'image/png';
    
    // Get price from form data (in dollars, e.g., "70" for $70.00)
    const priceString = formData.get('price') as string;
    const testMode = formData.get('testMode') === 'true'; // Check for test mode flag
    let price = priceString ? parseFloat(priceString) : 55.00; // Default to $70 if not provided
    
    // Override price to 51 cents in test mode
    if (testMode) {
      price = 0.51;
    }
    
    const unitAmount = Math.round(price * 100); // Convert to cents

    // Validate that we have either URLs or base64 data
    if (!originalImageUrl && !originalImageBase64) {
      return NextResponse.json(
        { error: 'Missing original image data (URL or base64 required)' },
        { status: 400 }
      );
    }

    if (!processedImageUrl && !processedImageBase64) {
      return NextResponse.json(
        { error: 'Missing processed image data (URL or base64 required)' },
        { status: 400 }
      );
    }

    if (isNaN(price) || price <= 0) {
      return NextResponse.json(
        { error: 'Invalid price provided' },
        { status: 400 }
      );
    }

    // Use URLs if provided, otherwise save base64 to blob storage
    let finalOriginalUrl: string;
    let finalProcessedUrl: string;

    if (originalImageUrl && processedImageUrl) {
      // URLs already provided - use them directly
      finalOriginalUrl = originalImageUrl;
      finalProcessedUrl = processedImageUrl;
    } else {
      // Fallback: Save base64 images to blob storage (for backwards compatibility)
      if (!originalImageBase64 || !processedImageBase64) {
        return NextResponse.json(
          { error: 'Missing image data - URLs or base64 required' },
          { status: 400 }
        );
      }

      // 3. Convert to Buffers (before calling Stripe to ensure images are valid)
      const originalBuffer = Buffer.from(originalImageBase64, 'base64');
      const processedBuffer = Buffer.from(processedImageBase64, 'base64');

      // 4. Upload to Vercel Blob (in parallel for efficiency)
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 9);
      const tempFolder = `temp/${timestamp}-${randomSuffix}`;

      const [originalBlob, processedBlob] = await Promise.all([
        put(
          `${tempFolder}/original.${originalMimeType.split('/')[1] || 'png'}`,
          originalBuffer,
          {
            access: 'public',
            contentType: originalMimeType,
          }
        ),
        put(
          `${tempFolder}/processed.png`,
          processedBuffer,
          {
            access: 'public',
            contentType: processedMimeType,
          }
        )
      ]);

      finalOriginalUrl = originalBlob.url;
      finalProcessedUrl = processedBlob.url;
    }

    // 5. Create Stripe Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { 
            name: 'Custom Laser Engraving',
            description: 'Custom photo laser-engraved on wood',
          },
          unit_amount: unitAmount,
        },
        quantity: 1,
      }],
      mode: 'payment',
      shipping_address_collection: {
        allowed_countries: ['US'], // Only allow US addresses for now
      },
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: {
              amount: 0, // Free shipping
              currency: 'usd',
            },
            display_name: 'Free Shipping',
          },
        },
      ],
      success_url: `${request.headers.get('origin') || 'https://your-domain.vercel.app'}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.headers.get('origin') || 'https://your-domain.vercel.app'}/upload?canceled=true`,
      metadata: {
        orderType: 'custom-engraving',
        price: price.toString(), // Store price in metadata for email
        testMode: testMode ? 'true' : 'false', // Store test mode flag
        originalUrl: finalOriginalUrl,
        processedUrl: finalProcessedUrl,
        originalMimeType: originalMimeType,
        processedMimeType: processedMimeType,
      },
    });

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      url: session.url, // Redirect user to this URL
      imageUrls: {
        original: finalOriginalUrl,
        processed: finalProcessedUrl,
      },
    });
  } catch (error: any) {
    console.error('Checkout Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
