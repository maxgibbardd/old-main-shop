import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';

/**
 * API Route to save images to Vercel Blob Storage
 * 
 * This stores both original and processed images permanently.
 * Returns URLs that can be used to display/download images later.
 */

export async function POST(request: NextRequest) {
  try {
    // Check if blob storage is configured
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: 'Blob storage not configured. Add BLOB_READ_WRITE_TOKEN to environment variables.' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('image') as File;
    const imageType = formData.get('type') as string; // 'original' or 'processed'
    const orderId = formData.get('orderId') as string | null; // Optional: associate with order
    
    if (!file) {
      return NextResponse.json(
        { error: 'No image file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 }
      );
    }

    // Create unique filename
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 9);
    const fileExtension = file.name.split('.').pop() || 'png';
    const folder = orderId ? `orders/${orderId}` : 'uploads';
    const filename = `${folder}/${imageType || 'image'}-${timestamp}-${randomSuffix}.${fileExtension}`;

    // Upload to Vercel Blob Storage
    const blob = await put(filename, file, {
      access: 'public', // Make images publicly accessible
      addRandomSuffix: false, // We're already adding our own suffix
    });

    return NextResponse.json({
      success: true,
      url: blob.url,
      filename: filename,
      size: file.size,
    });

  } catch (error: any) {
    console.error('Error saving image:', error);
    return NextResponse.json(
      { 
        error: 'Failed to save image',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

