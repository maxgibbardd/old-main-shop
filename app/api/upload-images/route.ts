import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';

/**
 * API Route to upload both original and processed images to Vercel Blob Storage
 * This endpoint accepts images as Files (not base64) to avoid request size limits
 * Returns URLs that can be used in checkout session metadata
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
    const originalFile = formData.get('originalImage') as File;
    const processedFile = formData.get('processedImage') as File;
    const originalMimeType = formData.get('originalMimeType') as string || 'image/png';
    const processedMimeType = formData.get('processedMimeType') as string || 'image/png';
    
    if (!originalFile || !processedFile) {
      return NextResponse.json(
        { error: 'Both original and processed images are required' },
        { status: 400 }
      );
    }

    // Validate file types
    if (!originalFile.type.startsWith('image/') || !processedFile.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Both files must be images' },
        { status: 400 }
      );
    }

    // Create unique folder for this upload
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 9);
    const tempFolder = `temp/${timestamp}-${randomSuffix}`;

    // Upload original image
    const originalBlob = await put(
      `${tempFolder}/original.${originalMimeType.split('/')[1] || 'png'}`,
      originalFile,
      {
        access: 'public',
        contentType: originalMimeType,
      }
    );

    // Upload processed image
    const processedBlob = await put(
      `${tempFolder}/processed.png`,
      processedFile,
      {
        access: 'public',
        contentType: processedMimeType,
      }
    );

    return NextResponse.json({
      success: true,
      originalUrl: originalBlob.url,
      processedUrl: processedBlob.url,
    });

  } catch (error: any) {
    console.error('Error uploading images:', error);
    return NextResponse.json(
      { 
        error: 'Failed to upload images',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

