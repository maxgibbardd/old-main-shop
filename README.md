# Old Main Shop - Laser Engraved Collection

A Next.js e-commerce site for custom laser-engraved wood art, featuring Penn State's Old Main and custom image uploads.

## Application Flow

This document explains the complete user journey through the application, highlighting which parts of the codebase handle each step.

### Flow Overview

```
User selects custom image → Uploads image → Gemini generates preview → 
User completes payment on Stripe → Stripe webhook triggered → 
Images saved to blob storage & emails sent → Redirected to thank you page
```

---

## Step-by-Step Flow Breakdown

### 1. User Selects Custom Image

**Location:** `app/page.tsx`

- User visits the home page and sees two options:
  - **Old Main Classic** - Pre-made design ($30)
  - **Custom Masterpiece** - Upload your own photo ($40)
- User clicks "Upload & Preview Your Image" button
- This links to `/upload` route

**Key Code:**
```tsx
<Link href="/upload">
  Upload & Preview Your Image
</Link>
```

---

### 2. User Uploads Image

**Location:** `app/upload/page.tsx`

- User lands on the upload page (`/upload`)
- User can either:
  - Click to select an image file
  - Drag and drop an image file
- Image is validated (must be an image type, max 10MB)
- Selected image is stored in React state (`selectedFile`)
- A preview of the original image is displayed

**Key Functions:**
- `handleFileSelect()` - Handles file input selection
- `handleDrop()` - Handles drag-and-drop
- Image preview is created using `URL.createObjectURL()`

---

### 3. Gemini Generates Preview

**Location:** 
- Frontend: `app/upload/page.tsx` (calls API)
- Backend: `app/api/process-image/route.ts`

**Process:**
1. User clicks "Generate Laser Engraving Preview" button
2. Frontend calls `handleProcess()` function
3. Image is sent to `/api/process-image` endpoint via POST request
4. **Backend processing** (`app/api/process-image/route.ts`):
   - Validates image file (type, size)
   - Converts image to base64
   - Initializes Google Gemini AI with API key from `GEMINI_API_KEY` env var
   - Uses laser engraving prompt from `config/prompt.ts`
   - Calls Gemini API to generate laser-engraved version
   - Returns processed image as base64
5. Frontend receives processed image and displays both:
   - Original image
   - Laser-engraved preview
6. Both images are stored as base64 in React state for later use

**Key Files:**
- `app/api/process-image/route.ts` - API endpoint that handles Gemini AI integration
- `config/prompt.ts` - Contains the prompt instructions for laser engraving conversion
- `app/upload/page.tsx` - Frontend that triggers processing and displays results

**Environment Variables Required:**
- `GEMINI_API_KEY` - Your Google Gemini API key

---

### 4. User Completes Payment on Stripe

**Location:**
- Frontend: `app/upload/page.tsx` (calls API)
- Backend: `app/api/create-checkout/route.ts`

**Process:**
1. User reviews the preview and clicks "Purchase Custom Engraving - $40"
2. Frontend calls `handlePurchase()` function
3. Both original and processed images (as base64) are sent to `/api/create-checkout`
4. **Backend processing** (`app/api/create-checkout/route.ts`):
   - Converts base64 images to buffers
   - **Saves images to Vercel Blob Storage** (temporary location: `temp/{timestamp}-{random}/`)
   - Creates Stripe Checkout Session with:
     - Product: "Custom Laser Engraving" ($40.00)
     - Image URLs stored in session metadata
     - Success URL: `/thank-you?session_id={CHECKOUT_SESSION_ID}`
     - Cancel URL: `/upload?canceled=true`
   - Returns Stripe checkout URL
5. User is redirected to Stripe's hosted checkout page
6. User enters payment information and completes payment

**Key Files:**
- `app/api/create-checkout/route.ts` - Creates Stripe checkout session and saves images
- `app/upload/page.tsx` - Frontend that initiates purchase flow

**Environment Variables Required:**
- `STRIPE_SECRET_KEY` - Your Stripe secret key
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob Storage token

**Important:** Images are saved to blob storage **before** redirecting to Stripe, so they're available even if the user abandons checkout.

---

### 5. Stripe Webhook is Triggered

**Location:** `app/api/stripe-webhook/route.ts`

**Process:**
1. After successful payment, Stripe sends a webhook event to `/api/stripe-webhook`
2. **Backend processing** (`app/api/stripe-webhook/route.ts`):
   - Verifies webhook signature using `STRIPE_WEBHOOK_SECRET`
   - Handles `checkout.session.completed` event
   - Extracts order information:
     - Order ID (Stripe session ID)
     - Customer email
     - Image URLs from session metadata
   - Fetches images from blob storage URLs
   - Converts images to buffers for email attachments

**Key Files:**
- `app/api/stripe-webhook/route.ts` - Webhook handler that processes completed payments

**Environment Variables Required:**
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- `STRIPE_SECRET_KEY` - Stripe secret key (for webhook verification)

**Webhook Setup:**
- Configure webhook endpoint in Stripe Dashboard: `https://your-domain.com/api/stripe-webhook`
- Listen for event: `checkout.session.completed`
- Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`

---

### 6. Images Saved to Blob Storage & Emails Sent

**Location:**
- Blob Storage: Already saved in step 4, but webhook may move them to permanent location
- Email: `lib/email.ts` (called from webhook)

**Process:**
1. **Images are already saved** (from step 4), but webhook ensures they're accessible
2. Webhook calls `sendPurchaseNotification()` from `lib/email.ts`
3. **Email processing** (`lib/email.ts`):
   - Prepares email attachments (original and processed images as buffers)
   - Creates HTML email content with:
     - Order details
     - Image previews
     - Links to full-size images
   - Sends emails to:
     - **Internal email list** (from `config/email-list.ts`) - Notification emails
     - **Customer email** (from Stripe session) - Order confirmation email
   - Uses Gmail SMTP via nodemailer

**Key Files:**
- `lib/email.ts` - Email sending logic with HTML templates
- `config/email-list.ts` - List of internal email addresses to notify

**Environment Variables Required:**
- `GMAIL_USER` - Gmail address for sending emails
- `GMAIL_APP_PASSWORD` - Gmail App Password (not regular password)

**Email Types:**
- **Internal notification** - Sent to email list in `config/email-list.ts`
- **Customer confirmation** - Sent to customer's email from Stripe

---

### 7. User Redirected to Thank You Page

**Location:** `app/thank-you/page.tsx`

**Process:**
1. After Stripe checkout completes, user is redirected to `/thank-you?session_id={CHECKOUT_SESSION_ID}`
2. Thank you page displays:
   - Success message
   - Order ID (from URL parameter)
   - What happens next (order confirmed, email sent, production, shipping)
   - Links to return home or create another engraving

**Key Files:**
- `app/thank-you/page.tsx` - Thank you confirmation page

---

## Project Structure

```
app/
  ├── page.tsx                    # Home page (step 1)
  ├── upload/
  │   └── page.tsx                # Upload & preview page (steps 2-4)
  ├── thank-you/
  │   └── page.tsx                # Thank you page (step 7)
  └── api/
      ├── process-image/
      │   └── route.ts            # Gemini AI preview generation (step 3)
      ├── create-checkout/
      │   └── route.ts            # Stripe checkout creation (step 4)
      ├── stripe-webhook/
      │   └── route.ts            # Stripe webhook handler (steps 5-6)
      ├── save-image/
      │   └── route.ts            # Utility: save images to blob storage
      ├── prepare-purchase/
      │   └── route.ts            # Utility: prepare purchase data
      └── send-test-email/
          └── route.ts            # Utility: test email sending

config/
  ├── prompt.ts                   # Gemini AI prompt for laser engraving
  └── email-list.ts               # Internal email notification list

lib/
  └── email.ts                    # Email sending logic (step 6)
```

---

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory with:

```bash
# Gemini AI
GEMINI_API_KEY=your_gemini_api_key_here

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret_here

# Vercel Blob Storage
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token_here

# Gmail SMTP (for email notifications)
GMAIL_USER=your_gmail_address@gmail.com
GMAIL_APP_PASSWORD=your_gmail_app_password_here
```

**Get your API keys:**
- **Gemini API Key:** [Google AI Studio](https://aistudio.google.com/app/apikey)
- **Stripe Keys:** [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
- **Vercel Blob Token:** [Vercel Dashboard](https://vercel.com/dashboard) → Storage → Blob
- **Gmail App Password:** [Google Account Settings](https://myaccount.google.com/apppasswords)

### 3. Configure Email List

Edit `config/email-list.ts` to add email addresses that should receive order notifications:

```typescript
export const EMAIL_LIST = [
  'your-email@example.com',
  'another-email@example.com',
];
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Set Up Stripe Webhook (for production)

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Add endpoint: `https://your-domain.com/api/stripe-webhook`
3. Select event: `checkout.session.completed`
4. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`

---

## Deploy

The site can be deployed to Vercel (recommended) or any platform that supports Next.js:

```bash
npm run build
```

**For Vercel:**
1. Push your code to GitHub
2. Import the project in Vercel
3. Add all environment variables in Vercel's dashboard
4. Deploy!

---

## Customization

### Modify Laser Engraving Prompt

Edit `config/prompt.ts` to change how Gemini converts images to laser-engraved style.

### Change Email Templates

Edit `lib/email.ts` to customize email content and styling.

### Update Email Recipients

Edit `config/email-list.ts` to add/remove internal notification recipients.

---

## Technology Stack

- **Framework:** Next.js 16 (App Router)
- **AI:** Google Gemini API (image-to-image generation)
- **Payments:** Stripe Checkout
- **Storage:** Vercel Blob Storage
- **Email:** Nodemailer (Gmail SMTP)
- **Styling:** Tailwind CSS
- **Icons:** Lucide React

---

## Notes

- Images are saved to blob storage **before** Stripe checkout to ensure they're available even if checkout is abandoned
- The webhook handler processes completed payments asynchronously
- Customer email is extracted from Stripe session (customer must provide email during checkout)
- Internal notification emails are sent to all addresses in `config/email-list.ts`
- All API routes run as serverless functions (no separate backend needed)
