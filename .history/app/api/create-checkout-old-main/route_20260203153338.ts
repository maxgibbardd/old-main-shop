import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

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
 * Create Stripe Checkout Session for Old Main Classic product
 * This generates a dynamic checkout link using the Stripe API key
 * Price is passed from the frontend to ensure it matches what's displayed
 */
export async function POST(request: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: 'STRIPE_SECRET_KEY not configured' },
        { status: 500 }
      );
    }

    const stripe = getStripe();

    // Get price from request body (in dollars, e.g., "35" for $35.00)
    const body = await request.json();
    const priceString = body.price;
    const testMode = body.testMode === true; // Check for test mode flag
    let price = priceString ? parseFloat(priceString) : 50.00; // Default to $50 if not provided
    
    // Override price to 51 cents in test mode
    if (testMode) {
      price = 0.51;
    }
    const unitAmount = Math.round(price * 100); // Convert to cents

    if (isNaN(price) || price <= 0) {
      return NextResponse.json(
        { error: 'Invalid price provided' },
        { status: 400 }
      );
    }

    // Create Stripe Checkout Session for Old Main Classic
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Old Main Classic',
              description: 'Signature Penn State landmark laser engraving',
            },
            unit_amount: unitAmount, // Dynamic price in cents
          },
          quantity: 1,
        },
      ],
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
      cancel_url: `${request.headers.get('origin') || 'https://your-domain.vercel.app'}?canceled=true`,
      metadata: {
        orderType: 'old-main-classic',
        price: price.toString(), // Store price in metadata for email
        // testMode: testMode ? 'true' : 'false', // Store test mode flag
      },
    });

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      url: session.url, // Redirect user to this URL
    });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session', details: error.message },
      { status: 500 }
    );
  }
}
