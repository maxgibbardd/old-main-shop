'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { Upload, Loader2, ShoppingBag, ArrowLeft, TestTube } from 'lucide-react';

export default function TestingPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [originalDimensions, setOriginalDimensions] = useState<{ width: number; height: number } | null>(null);
  const [originalImageBase64, setOriginalImageBase64] = useState<string | null>(null);
  const [processedImageBase64, setProcessedImageBase64] = useState<string | null>(null);
  const [isPreparingPurchase, setIsPreparingPurchase] = useState(false);
  const [isLoadingOldMain, setIsLoadingOldMain] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
      setProcessedImageUrl(null);
      
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);

      const img = new Image();
      img.onload = () => {
        setOriginalDimensions({ width: img.width, height: img.height });
      };
      img.src = url;
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      setError(null);
      setProcessedImageUrl(null);
      
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);

      const img = new Image();
      img.onload = () => {
        setOriginalDimensions({ width: img.width, height: img.height });
      };
      img.src = url;
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleProcess = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);

      const response = await fetch('/api/process-image', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process image');
      }

      if (data.success && data.image) {
        const imageBlob = await fetch(`data:${data.mimeType};base64,${data.image}`).then(r => r.blob());
        const imageUrl = URL.createObjectURL(imageBlob);
        setProcessedImageUrl(imageUrl);
        setProcessedImageBase64(data.image);
        
        if (selectedFile) {
          const originalBase64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(reader.error);
            reader.onload = () => {
              const result = reader.result as string;
              const base64 = result.split(',')[1];
              resolve(base64);
            };
            reader.readAsDataURL(selectedFile);
          });
          setOriginalImageBase64(originalBase64);
        }
      } else {
        throw new Error('No processed image received');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while processing the image');
      console.error('Processing error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOldMainPurchase = async () => {
    setIsLoadingOldMain(true);
    setError(null);

    try {
      const response = await fetch('/api/create-checkout-old-main', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          price: '50', // Will be overridden to 0.01 in test mode
          testMode: true // Test mode flag
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start checkout');
      setIsLoadingOldMain(false);
      console.error('Checkout error:', err);
    }
  };

  const handleCustomPurchase = async () => {
    if (!originalImageBase64 || !processedImageBase64 || !selectedFile) {
      setError('Missing image data. Please process the image first.');
      return;
    }

    setIsPreparingPurchase(true);
    setError(null);

    try {
      // Step 1: Upload images to blob storage first (to avoid request size limits)
      // Convert processed base64 image to File/Blob for upload
      const processedImageBlob = await fetch(`data:image/png;base64,${processedImageBase64}`).then(r => r.blob());
      const processedImageFile = new File([processedImageBlob], 'processed.png', { type: 'image/png' });

      const uploadFormData = new FormData();
      uploadFormData.append('originalImage', selectedFile); // Use the original file directly
      uploadFormData.append('processedImage', processedImageFile);
      uploadFormData.append('originalMimeType', selectedFile.type);
      uploadFormData.append('processedMimeType', 'image/png');

      const uploadResponse = await fetch('/api/upload-images', {
        method: 'POST',
        body: uploadFormData,
      });

      if (!uploadResponse.ok) {
        // Try to parse error, but handle HTML error pages gracefully
        let errorMessage = 'Failed to upload images';
        try {
          const errorData = await uploadResponse.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If response is not JSON (e.g., HTML error page), use status text
          errorMessage = `Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const uploadData = await uploadResponse.json();

      // Step 2: Create Stripe Checkout Session with image URLs
      const checkoutFormData = new FormData();
      checkoutFormData.append('originalImageUrl', uploadData.originalUrl);
      checkoutFormData.append('processedImageUrl', uploadData.processedUrl);
      checkoutFormData.append('originalMimeType', selectedFile.type);
      checkoutFormData.append('processedMimeType', 'image/png');
      checkoutFormData.append('price', '70'); // Will be overridden to 0.51 in test mode
      checkoutFormData.append('testMode', 'true'); // Test mode flag

      const checkoutResponse = await fetch('/api/create-checkout', {
        method: 'POST',
        body: checkoutFormData,
      });

      if (!checkoutResponse.ok) {
        // Try to parse error, but handle HTML error pages gracefully
        let errorMessage = 'Failed to create checkout session';
        try {
          const errorData = await checkoutResponse.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If response is not JSON (e.g., HTML error page), use status text
          errorMessage = `Checkout failed: ${checkoutResponse.status} ${checkoutResponse.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const checkoutData = await checkoutResponse.json();

      if (checkoutData.url) {
        window.location.href = checkoutData.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to prepare purchase');
      setIsPreparingPurchase(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-[#041E42] text-white py-4 px-6 shadow-md">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <Link href="/" className="text-xl font-serif font-bold tracking-wider hover:opacity-80 transition">
            NITTANY CRAFT.
          </Link>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-yellow-500 text-[#041E42] px-3 py-1 rounded-full text-xs font-bold">
              <TestTube size={14} />
              TEST MODE
            </div>
            <Link 
              href="/"
              className="flex items-center gap-2 text-sm hover:opacity-80 transition"
            >
              <ArrowLeft size={16} />
              Back to Home
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto py-12 px-6">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full text-sm font-semibold mb-4">
            <TestTube size={16} />
            Testing Environment
          </div>
          <h1 className="text-4xl font-serif font-bold text-[#041E42] mb-4">
            Test Purchase Workflows
          </h1>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Test both purchase workflows with 1 cent transactions. All purchases will be charged $0.01 for testing purposes.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Two Workflow Options */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Workflow 1: Old Main Classic */}
          <div className="bg-white border-2 border-slate-200 p-8 rounded-3xl">
            <div className="text-center mb-6">
              <ShoppingBag size={48} className="mx-auto mb-4 text-[#041E42]" />
              <h3 className="text-2xl font-serif font-bold mb-2 text-[#041E42]">Old Main Classic</h3>
              <p className="text-slate-500 mb-4 text-sm">Test the pre-made design purchase flow</p>
              <div className="text-3xl font-bold mb-2">$0.51</div>
              <p className="text-xs text-slate-400">(Test Price)</p>
            </div>
            <button
              onClick={handleOldMainPurchase}
              disabled={isLoadingOldMain}
              className="w-full text-center bg-[#041E42] text-white py-4 rounded-xl font-bold hover:bg-[#001433] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoadingOldMain ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <ShoppingBag size={16} />
                  Test Purchase - $0.51
                </>
              )}
            </button>
          </div>

          {/* Workflow 2: Custom Engraving */}
          <div className="bg-white border-2 border-[#041E42] p-8 rounded-3xl">
            <div className="text-center mb-6">
              <Upload size={48} className="mx-auto mb-4 text-[#041E42]" />
              <h3 className="text-2xl font-serif font-bold mb-2 text-[#041E42]">Custom Engraving</h3>
              <p className="text-slate-500 mb-4 text-sm">Test the custom image upload and purchase flow</p>
              <div className="text-3xl font-bold mb-2">$0.51</div>
              <p className="text-xs text-slate-400">(Test Price)</p>
            </div>
            
            {/* Upload Area */}
            <div className="mb-4">
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:border-[#041E42] transition"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {!previewUrl ? (
                  <>
                    <Upload size={32} className="mx-auto mb-2 text-slate-400" />
                    <p className="text-slate-600 text-sm mb-1">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-slate-400">
                      PNG, JPG, GIF up to 10MB
                    </p>
                  </>
                ) : (
                  <div className="space-y-2">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="max-h-32 mx-auto rounded-lg"
                    />
                    <p className="text-xs text-slate-600">
                      {selectedFile?.name}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        setPreviewUrl(null);
                        setProcessedImageUrl(null);
                        setOriginalDimensions(null);
                        setOriginalImageBase64(null);
                        setProcessedImageBase64(null);
                      }}
                      className="text-xs text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              {previewUrl && !processedImageUrl && (
                <button
                  onClick={handleProcess}
                  disabled={isProcessing}
                  className="w-full mt-4 bg-slate-200 text-[#041E42] py-2 rounded-lg font-semibold hover:bg-slate-300 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Generate Preview'
                  )}
                </button>
              )}
            </div>

            {/* Processed Image Preview */}
            {processedImageUrl && (
              <div className="mb-4 p-4 bg-slate-50 rounded-lg">
                <p className="text-xs font-semibold text-slate-600 mb-2">Preview:</p>
                <img
                  src={processedImageUrl}
                  alt="Processed Preview"
                  className="w-full rounded-lg border border-slate-200"
                />
              </div>
            )}

            <button
              onClick={handleCustomPurchase}
              disabled={isPreparingPurchase || !originalImageBase64 || !processedImageBase64}
              className="w-full text-center bg-[#041E42] text-white py-4 rounded-xl font-bold hover:bg-[#001433] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isPreparingPurchase ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Preparing...
                </>
              ) : (
                <>
                  <ShoppingBag size={16} />
                  Test Purchase - $0.51
                </>
              )}
            </button>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h4 className="font-semibold text-blue-900 mb-2">Test Mode Information</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• All purchases will be charged $0.51 (51 cents) for testing</li>
            <li>• Both workflows use the same Stripe webhook handler</li>
            <li>• Test cards: Use Stripe test card numbers (4242 4242 4242 4242)</li>
            <li>• Webhook events will be processed normally, just with test pricing</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

