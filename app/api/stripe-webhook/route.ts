import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { put } from '@vercel/blob';
import { sendPurchaseNotification } from '@/lib/email';

// Disable body parsing - we need raw body for Stripe webhook signature verification
export const runtime = 'nodejs';

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
    
    // Retrieve the full session to get shipping details
    // The webhook event might not include shipping_details, so we need to fetch it
    const fullSession = await stripe.checkout.sessions.retrieve(session.id);
    
    // Debug: Log the entire session to see what's available
    console.log('Full session keys:', Object.keys(fullSession));
    console.log('Session shipping property:', (fullSession as any).shipping);
    console.log('Session shipping_details property:', (fullSession as any).shipping_details);
    console.log('Session shipping_address_collection:', (fullSession as any).shipping_address_collection);
    console.log('Session collected_information:', JSON.stringify((fullSession as any).collected_information, null, 2));
    console.log('Session customer_details:', JSON.stringify(fullSession.customer_details, null, 2));
    
    // Get metadata from Stripe session
    const metadata = fullSession.metadata || {};
    const orderId = fullSession.id; // Use Stripe session ID as order ID
    const orderType = metadata.orderType || 'old-main-classic'; // Default to old-main-classic
    const customerEmail = fullSession.customer_email || fullSession.customer_details?.email || fullSession.customer_details?.email;
    
    // Get the ACTUAL amount charged from Stripe (source of truth)
    // amount_total is in cents, so convert to dollars
    const actualAmountCharged = fullSession.amount_total ? fullSession.amount_total / 100 : null;
    const amountSubtotal = fullSession.amount_subtotal ? fullSession.amount_subtotal / 100 : null;
    const amountTax = (fullSession as any).amount_tax ? (fullSession as any).amount_tax / 100 : null;
    
    // Log amounts for verification
    console.log('Payment amounts from Stripe:', {
      amount_total: actualAmountCharged,
      amount_subtotal: amountSubtotal,
      amount_tax: amountTax,
      metadata_price: metadata.price,
    });
    
    // Use actual charged amount as primary source, fallback to metadata if needed
    // This ensures emails always show what was actually charged
    const productPrice = actualAmountCharged ?? (metadata.price ? parseFloat(metadata.price) : null);
    
    if (productPrice === null) {
      console.error('⚠️ WARNING: Could not determine product price from Stripe session!');
    }
    
    // Extract shipping address from Stripe session
    // When shipping_address_collection is enabled, Stripe stores it in the 'shipping' property
    // But it might be null if customer didn't complete shipping form
    const shipping = (fullSession as any).shipping;
    const collectedInfo = (fullSession as any).collected_information;
    
    // Debug: Log the entire shipping object and collected_information
    console.log('Shipping object from Stripe:', JSON.stringify(shipping, null, 2));
    console.log('Collected information:', JSON.stringify(collectedInfo, null, 2));
    
    // Extract shipping address - try shipping property first, then check collected_information
    let shippingAddress = null;
    let shippingName = '';
    
    if (shipping?.address) {
      // Standard shipping property (this is where Stripe stores it when shipping_address_collection is used)
      shippingAddress = {
        line1: shipping.address.line1 || '',
        line2: shipping.address.line2 || '',
        city: shipping.address.city || '',
        state: shipping.address.state || '',
        postal_code: shipping.address.postal_code || '',
        country: shipping.address.country || '',
      };
      shippingName = shipping.name || '';
      console.log('✅ Found shipping address in shipping property');
    } else if (collectedInfo?.shipping_address) {
      // Check collected_information for shipping address
      shippingAddress = {
        line1: collectedInfo.shipping_address.line1 || '',
        line2: collectedInfo.shipping_address.line2 || '',
        city: collectedInfo.shipping_address.city || '',
        state: collectedInfo.shipping_address.state || '',
        postal_code: collectedInfo.shipping_address.postal_code || '',
        country: collectedInfo.shipping_address.country || '',
      };
      shippingName = collectedInfo.shipping_address.name || '';
      console.log('✅ Found shipping address in collected_information');
    } else if (fullSession.customer_details?.address) {
      // Fallback to customer_details address if shipping not collected separately
      shippingAddress = {
        line1: fullSession.customer_details.address.line1 || '',
        line2: fullSession.customer_details.address.line2 || '',
        city: fullSession.customer_details.address.city || '',
        state: fullSession.customer_details.address.state || '',
        postal_code: fullSession.customer_details.address.postal_code || '',
        country: fullSession.customer_details.address.country || '',
      };
      shippingName = fullSession.customer_details.name || '';
      console.log('✅ Found address in customer_details (fallback)');
    } else {
      console.warn('⚠️ No shipping address found in any location!');
      console.warn('This means the customer did not enter a shipping address during checkout.');
      console.warn('Please verify that Stripe Checkout is showing the shipping address form.');
    }
    
    // Log customer email and shipping for debugging
    console.log('Processing order:', {
      orderId: orderId,
      orderType: orderType,
      customer_email: fullSession.customer_email,
      customer_details_email: fullSession.customer_details?.email,
      final_customerEmail: customerEmail,
      hasShippingAddress: !!shippingAddress,
      shippingAddress: shippingAddress,
      shippingName: shippingName,
      shippingExists: !!shipping,
    });

    try {
      // Handle different order types
      if (orderType === 'custom-engraving') {
        // Custom engraving order - has images
        let originalUrl: string;
        let processedUrl: string;
        let originalBuffer: Buffer | undefined;
        let processedBuffer: Buffer | undefined;

        // Check if image URLs are in metadata (from create-checkout)
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

        console.log('Processing custom engraving order with images:', {
          original: originalUrl,
          processed: processedUrl,
          customerEmail: customerEmail,
          actualAmountCharged: productPrice,
        });

        // Validate price was found
        if (productPrice === null) {
          console.error('ERROR: Product price is null, cannot send email');
          return NextResponse.json(
            { error: 'Product price not found in Stripe session' },
            { status: 400 }
          );
        }

        // Send email notification for custom engraving
        // Use actual charged amount (verified from Stripe)
        const emailResult = await sendPurchaseNotification({
          originalUrl: originalUrl,
          processedUrl: processedUrl,
          originalBuffer: originalBuffer,
          processedBuffer: processedBuffer,
          orderId: orderId,
          customerEmail: customerEmail || undefined,
          orderType: 'custom-engraving',
          productName: 'Custom Laser Engraving',
          productPrice: productPrice, // Actual amount charged from Stripe
          shippingAddress: shippingAddress,
          shippingName: shippingName,
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
          orderType: 'custom-engraving',
          images: {
            original: originalUrl,
            processed: processedUrl,
          },
          email: emailResult,
        });
      } else {
        // Old Main Classic order - no images
        console.log('Processing Old Main Classic order', {
          actualAmountCharged: productPrice,
        });

        // Validate price was found
        if (productPrice === null) {
          console.error('ERROR: Product price is null, cannot send email');
          return NextResponse.json(
            { error: 'Product price not found in Stripe session' },
            { status: 400 }
          );
        }

        // Send email notification for Old Main Classic
        // Use actual charged amount (verified from Stripe)
        const emailResult = await sendPurchaseNotification({
          orderId: orderId,
          customerEmail: customerEmail || undefined,
          orderType: 'old-main-classic',
          productName: 'Old Main Classic',
          productPrice: productPrice, // Actual amount charged from Stripe
          shippingAddress: shippingAddress,
          shippingName: shippingName,
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
          orderType: 'old-main-classic',
          email: emailResult,
        });
      }
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

