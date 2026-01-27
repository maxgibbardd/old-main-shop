import nodemailer from 'nodemailer';
import { EMAIL_LIST } from '@/config/email-list';

// Create transporter using Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER, // Your Gmail address
    pass: process.env.GMAIL_APP_PASSWORD, // Gmail App Password (not your regular password)
  },
});

export interface EmailImageData {
  originalUrl?: string;
  processedUrl?: string;
  originalBuffer?: Buffer;
  processedBuffer?: Buffer;
  orderId: string;
  customerEmail?: string;
  orderType?: 'custom-engraving' | 'old-main-classic';
  productName?: string;
  productPrice?: number;
}

/**
 * Send email notification to email list with images
 */
export async function sendPurchaseNotification(data: EmailImageData) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.error('Gmail credentials not configured');
    return { success: false, error: 'Email service not configured' };
  }

  // Check if we have any recipients (either email list or customer email)
  if (EMAIL_LIST.length === 0 && !data.customerEmail) {
    console.log('No email recipients configured (email list empty and no customer email)');
    return { success: true, skipped: true };
  }

  try {
    // Prepare email attachments if buffers are provided
    const attachments: Array<{ filename: string; content: Buffer }> = [];
    
    if (data.originalBuffer) {
      attachments.push({
        filename: `original-${data.orderId}.png`,
        content: data.originalBuffer,
      });
    }
    
    if (data.processedBuffer) {
      attachments.push({
        filename: `laser-engraved-${data.orderId}.png`,
        content: data.processedBuffer,
      });
    }

    const isCustomEngraving = data.orderType === 'custom-engraving' && data.originalUrl && data.processedUrl;
    const productName = data.productName || (isCustomEngraving ? 'Custom Laser Engraving' : 'Old Main Classic');
    const productPrice = data.productPrice || (isCustomEngraving ? 40.00 : 30.00);
    const orderTitle = isCustomEngraving ? 'New Custom Engraving Order!' : 'New Old Main Classic Order!';

    // Create HTML email with images and links (for internal notifications)
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #041E42; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .image-section { margin: 20px 0; text-align: center; }
            .image-section img { max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 8px; margin: 10px 0; }
            .links { margin: 20px 0; padding: 15px; background-color: white; border-radius: 8px; }
            .links a { color: #041E42; text-decoration: none; display: block; margin: 5px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            .order-info { background-color: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${orderTitle}</h1>
            </div>
            <div class="content">
              <p>A new order has been completed.</p>
              <div class="order-info">
                <p><strong>Order ID:</strong> ${data.orderId}</p>
                <p><strong>Product:</strong> ${productName}</p>
                <p><strong>Price:</strong> $${productPrice.toFixed(2)}</p>
                ${data.customerEmail ? `<p><strong>Customer Email:</strong> ${data.customerEmail}</p>` : ''}
              </div>
              
              ${isCustomEngraving ? `
              <div class="image-section">
                <h3>Original Image</h3>
                <img src="${data.originalUrl}" alt="Original Image" />
                <p><a href="${data.originalUrl}" target="_blank">View Original Image</a></p>
              </div>
              
              <div class="image-section">
                <h3>Laser Engraved Preview</h3>
                <img src="${data.processedUrl}" alt="Laser Engraved Preview" />
                <p><a href="${data.processedUrl}" target="_blank">View Processed Image</a></p>
              </div>
              
              <div class="links">
                <h3>Image Links:</h3>
                <p><strong>Original:</strong> <a href="${data.originalUrl}" target="_blank">${data.originalUrl}</a></p>
                <p><strong>Processed:</strong> <a href="${data.processedUrl}" target="_blank">${data.processedUrl}</a></p>
              </div>
              ` : ''}
            </div>
            <div class="footer">
              <p>NITTANY CRAFT - Order Notifications</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Prepare customer confirmation email (different content)
    const customerEmailContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #041E42; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .image-section { margin: 20px 0; text-align: center; }
            .image-section img { max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 8px; margin: 10px 0; }
            .order-info { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .order-info h3 { margin-top: 0; color: #041E42; }
            .order-info table { width: 100%; border-collapse: collapse; }
            .order-info td { padding: 8px 0; border-bottom: 1px solid #eee; }
            .order-info td:first-child { font-weight: bold; width: 40%; }
            .price { font-size: 24px; font-weight: bold; color: #041E42; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            .contact { background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Order Confirmation</h1>
              <p style="margin: 0; font-size: 18px;">Thank You for Your Purchase!</p>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>Thank you for your order! We've received your payment and your ${productName.toLowerCase()} is confirmed.</p>
              
              <div class="order-info">
                <h3>Order Summary</h3>
                <table>
                  <tr>
                    <td>Order Number:</td>
                    <td>${data.orderId}</td>
                  </tr>
                  <tr>
                    <td>Order Date:</td>
                    <td>${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                  </tr>
                  <tr>
                    <td>Item:</td>
                    <td>${productName}</td>
                  </tr>
                  <tr>
                    <td>Total Paid:</td>
                    <td class="price">$${productPrice.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td>Status:</td>
                    <td><strong style="color: green;">Confirmed</strong></td>
                  </tr>
                </table>
              </div>
              
              ${isCustomEngraving ? `
              <div class="image-section">
                <h3>Your Custom Design Preview</h3>
                <p>Here's a preview of your laser-engraved design:</p>
                <img src="${data.processedUrl}" alt="Laser Engraved Preview" style="max-width: 100%; height: auto; border: 2px solid #041E42; border-radius: 8px;" />
                <p><a href="${data.processedUrl}" target="_blank" style="color: #041E42; text-decoration: underline;">View Full Size Preview</a></p>
              </div>
              
              <div class="image-section">
                <h3>Original Image</h3>
                <img src="${data.originalUrl}" alt="Original Image" style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 8px;" />
                <p><a href="${data.originalUrl}" target="_blank" style="color: #041E42; text-decoration: underline;">View Original Image</a></p>
              </div>
              ` : `
              <div class="order-info">
                <p>Your Old Main Classic laser engraving will be crafted with precision and care. This signature Penn State landmark engraving captures every architectural detail of Penn State's iconic building.</p>
              </div>
              `}
              
              <div class="order-info">
                <h3>What Happens Next?</h3>
                <ul style="margin: 10px 0; padding-left: 20px;">
                  <li style="margin: 8px 0;">Your order is confirmed and in production</li>
                  <li style="margin: 8px 0;">We'll send you shipping updates via email</li>
                  <li style="margin: 8px 0;">Expected processing time: 3-5 business days</li>
                  <li style="margin: 8px 0;">You'll receive tracking information once your order ships</li>
                </ul>
              </div>
              
              <div class="contact">
                <h3 style="margin-top: 0; color: #041E42;">Need Help?</h3>
                <p style="margin: 5px 0;">If you have any questions about your order, please reply to this email or contact us.</p>
                <p style="margin: 5px 0;"><strong>Order Reference:</strong> ${data.orderId}</p>
              </div>
              
              <p>We appreciate your business and look forward to creating your ${isCustomEngraving ? 'custom laser engraving' : 'Old Main Classic'}!</p>
            </div>
            <div class="footer">
              <p style="font-weight: bold; color: #041E42;">NITTANY CRAFT</p>
              <p>Laser Engraving Orders</p>
              <p style="margin-top: 10px; font-size: 11px; color: #999;">Not officially affiliated with Pennsylvania State University.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send emails: both to internal list AND to customer
    const emailPromises: Promise<any>[] = [];
    
    // Send to internal email list (notification) - only if list is not empty
    if (EMAIL_LIST.length > 0) {
      EMAIL_LIST.forEach(email => {
        emailPromises.push(
          transporter.sendMail({
            from: `"NITTANY CRAFT" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: `New Order - ${productName} - ${data.orderId}`,
            html: htmlContent,
            attachments: attachments.length > 0 ? attachments : undefined,
          })
        );
      });
    }

    // Send confirmation email to customer (if email provided)
    if (data.customerEmail && data.customerEmail.trim() !== '') {
      const customerEmailTrimmed = data.customerEmail.trim();
      console.log(`[CUSTOMER EMAIL] Preparing to send to: ${customerEmailTrimmed}`);
      
      emailPromises.push(
        transporter.sendMail({
          from: `"NITTANY CRAFT" <${process.env.GMAIL_USER}>`,
          to: customerEmailTrimmed,
          subject: `Order Confirmation - ${data.orderId}`,
          html: customerEmailContent,
          attachments: attachments.length > 0 ? attachments : undefined,
        }).then(result => {
          console.log(`[CUSTOMER EMAIL] ✅ Successfully sent to ${customerEmailTrimmed}:`, {
            messageId: result.messageId,
            accepted: result.accepted,
            rejected: result.rejected,
          });
          return result;
        }).catch(error => {
          console.error(`[CUSTOMER EMAIL] ❌ Failed to send to ${customerEmailTrimmed}:`, {
            message: error?.message,
            code: error?.code,
            response: error?.response,
          });
          throw error;
        })
      );
    } else {
      console.warn(`[CUSTOMER EMAIL] No customer email provided (value: "${data.customerEmail}") - customer email not sent`);
    }

    const results = await Promise.allSettled(emailPromises);

    // Check results with detailed logging
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    // Log detailed results
    let emailIndex = 0;
    results.forEach((result, index) => {
      emailIndex++;
      if (result.status === 'fulfilled') {
        const value = result.value as any;
        const isCustomerEmail = index >= EMAIL_LIST.length;
        console.log(`[EMAIL ${emailIndex}] ${isCustomerEmail ? 'CUSTOMER' : 'INTERNAL'} email sent successfully:`, {
          messageId: value?.messageId,
          accepted: value?.accepted,
          rejected: value?.rejected,
        });
      } else {
        const isCustomerEmail = index >= EMAIL_LIST.length;
        console.error(`[EMAIL ${emailIndex}] ${isCustomerEmail ? 'CUSTOMER' : 'INTERNAL'} email failed:`, {
          error: result.reason?.message || result.reason,
          code: result.reason?.code,
          response: result.reason?.response,
        });
      }
    });

    console.log(`Email sent: ${successful} successful, ${failed} failed`);
    console.log(`Total emails attempted: ${emailPromises.length} (${EMAIL_LIST.length} internal + ${data.customerEmail ? '1 customer' : '0 customer'})`);

    return {
      success: successful > 0,
      sent: successful,
      failed: failed,
    };
  } catch (error: any) {
    console.error('Error sending email:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}
