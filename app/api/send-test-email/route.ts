import { NextRequest, NextResponse } from 'next/server';
import { sendPurchaseNotification } from '@/lib/email';

/**
 * Test endpoint to simulate purchase completion
 * Saves images and sends email notification
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const originalUrl = formData.get('originalUrl') as string;
    const processedUrl = formData.get('processedUrl') as string;
    const orderId = formData.get('orderId') as string;
    const customerEmail = formData.get('customerEmail') as string | null;
    const originalBufferBase64 = formData.get('originalBuffer') as string;
    const processedBufferBase64 = formData.get('processedBuffer') as string;

    if (!originalUrl || !processedUrl || !orderId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Convert base64 back to buffers
    const originalBuffer = originalBufferBase64 
      ? Buffer.from(originalBufferBase64, 'base64')
      : undefined;
    const processedBuffer = processedBufferBase64
      ? Buffer.from(processedBufferBase64, 'base64')
      : undefined;

    // Send email notification
    const emailResult = await sendPurchaseNotification({
      originalUrl,
      processedUrl,
      originalBuffer,
      processedBuffer,
      orderId,
      customerEmail: customerEmail || undefined,
    });

    return NextResponse.json({
      success: true,
      orderId,
      email: emailResult,
    });
  } catch (error: any) {
    console.error('Error in test email:', error);
    return NextResponse.json(
      { error: 'Failed to send test email', details: error.message },
      { status: 500 }
    );
  }
}

