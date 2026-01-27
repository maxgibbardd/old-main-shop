import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { put } from '@vercel/blob';
import { LASER_ENGRAVING_PROMPT } from '@/config/prompt';

export async function POST(request: NextRequest) {
  try {
    // Get API key from environment
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured. Please add it to your .env.local file.' },
        { status: 500 }
      );
    }

    // Parse the request body
    const formData = await request.formData();
    const file = formData.get('image') as File;
    const saveImages = formData.get('saveImages') === 'true'; // Optional: save to blob storage
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

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
      );
    }

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString('base64');
    const mimeType = file.type;

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Use gemini-2.5-flash-image for image-to-image generation
    // This model supports text-and-image-to-image editing
    // Note: Image generation models require paid API plan (not available on free tier)
    const model = genAI.getGenerativeModel({ 
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash-preview-image' 
    });

    // Prepare the image part
    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType: mimeType,
      },
    };

    // Generate the laser-engraved version
    // Using text-and-image-to-image generation with gemini-2.5-flash-image
    // Format: array with text prompt object and image data object
    const result = await model.generateContent([
      { text: LASER_ENGRAVING_PROMPT },
      imagePart,
    ]);

    const response = await result.response;
    
    // Check if response has image data
    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
      const parts = candidates[0].content.parts;
      
      // Look for image data in the response
      for (const part of parts) {
        if ('inlineData' in part && part.inlineData) {
          const processedImageBase64 = part.inlineData.data;
          const processedMimeType = part.inlineData.mimeType || 'image/png';
          
          // Optionally save images to blob storage
          let originalImageUrl: string | null = null;
          let processedImageUrl: string | null = null;
          
          if (saveImages && process.env.BLOB_READ_WRITE_TOKEN) {
            try {
              const timestamp = Date.now();
              const randomSuffix = Math.random().toString(36).substring(2, 9);
              const folder = orderId ? `orders/${orderId}` : 'uploads';
              
              // Save original image
              const originalBlob = await put(
                `${folder}/original-${timestamp}-${randomSuffix}.${file.name.split('.').pop() || 'png'}`,
                file,
                { access: 'public' }
              );
              originalImageUrl = originalBlob.url;
              
              // Save processed image (convert base64 to blob)
              const processedBuffer = Buffer.from(processedImageBase64, 'base64');
              const processedBlob = new Blob([processedBuffer], { type: processedMimeType });
              const processedFile = new File([processedBlob], `processed-${timestamp}.png`, { type: processedMimeType });
              
              const savedProcessedBlob = await put(
                `${folder}/processed-${timestamp}-${randomSuffix}.png`,
                processedFile,
                { access: 'public' }
              );
              processedImageUrl = savedProcessedBlob.url;
            } catch (saveError) {
              console.error('Error saving images to blob storage:', saveError);
              // Continue even if save fails - return the image data anyway
            }
          }
          
          return NextResponse.json({
            success: true,
            image: processedImageBase64,
            mimeType: processedMimeType,
            // Include saved URLs if available
            ...(originalImageUrl && { originalImageUrl }),
            ...(processedImageUrl && { processedImageUrl }),
          });
        }
      }
    }

    // If no image found, the model returned text
    // This means we need to use an image generation model instead
    // For now, return an informative error
    const textResponse = response.text();
    
    return NextResponse.json(
      { 
        error: 'Image generation not available with current model',
        details: 'The Gemini model returned text instead of an image. You may need to use a model that supports image generation (e.g., gemini-2.0-flash-exp or similar).',
        suggestion: 'Check Google AI Studio for available image generation models, or consider using a different approach for image-to-image conversion.',
        textResponse: textResponse.substring(0, 200) // Preview of what was returned
      },
      { status: 500 }
    );

  } catch (error: any) {
    console.error('Error processing image:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process image',
        details: error.message || 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

