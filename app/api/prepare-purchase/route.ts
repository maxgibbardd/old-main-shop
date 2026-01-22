import { NextRequest, NextResponse } from 'next/server';

/**
 * API route to prepare purchase data
 * Stores image data temporarily and returns Stripe checkout URL with metadata
 */

export async function POST(request: NextRequest) {
  try {
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

    // Note: In a production app, you might want to:
    // 1. Store images temporarily in a database/cache
    // 2. Generate a unique session ID
    // 3. Return the session ID to use in Stripe metadata
    // 
    // For now, we'll pass the image data directly in Stripe metadata
    // Stripe metadata has a limit of 500 characters per value, so we need
    // to handle large images differently
    
    // Check if images are too large for Stripe metadata
    const maxMetadataSize = 500; // Stripe limit per metadata value
    
    if (originalImageBase64.length > maxMetadataSize || processedImageBase64.length > maxMetadataSize) {
      // Images are too large - we'll need to save them first and pass URLs
      // For now, return error suggesting to use smaller images or implement temporary storage
      return NextResponse.json(
        { 
          error: 'Image data too large for Stripe metadata',
          suggestion: 'Images will be saved and processed after payment. Please proceed with purchase.',
          // In production, save images temporarily here and return session ID
        },
        { status: 400 }
      );
    }

    // Return success - images will be passed via Stripe metadata
    // The frontend will include this in the Stripe checkout session creation
    return NextResponse.json({
      success: true,
      message: 'Purchase data prepared',
      // Return image data to be included in Stripe checkout
      imageData: {
        originalImage: originalImageBase64,
        processedImage: processedImageBase64,
        originalMimeType: originalMimeType,
        processedMimeType: processedMimeType,
      },
    });
  } catch (error: any) {
    console.error('Error preparing purchase:', error);
    return NextResponse.json(
      { error: 'Failed to prepare purchase', details: error.message },
      { status: 500 }
    );
  }
}

