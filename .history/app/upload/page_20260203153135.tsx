'use client';

import React, { useState, useRef } from 'react';
import { Upload, Loader2, Download, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function UploadPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [originalDimensions, setOriginalDimensions] = useState<{ width: number; height: number } | null>(null);
  const [savedOriginalUrl, setSavedOriginalUrl] = useState<string | null>(null);
  const [savedProcessedUrl, setSavedProcessedUrl] = useState<string | null>(null);
  const [originalImageBase64, setOriginalImageBase64] = useState<string | null>(null);
  const [processedImageBase64, setProcessedImageBase64] = useState<string | null>(null);
  const [isPreparingPurchase, setIsPreparingPurchase] = useState(false);
  // const [isTestingPurchase, setIsTestingPurchase] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
      setProcessedImageUrl(null);
      
      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);

      // Get image dimensions
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
        // Convert base64 to blob URL for preview
        const imageBlob = await fetch(`data:${data.mimeType};base64,${data.image}`).then(r => r.blob());
        const imageUrl = URL.createObjectURL(imageBlob);
        setProcessedImageUrl(imageUrl);
        
        // Store base64 data for purchase
        setProcessedImageBase64(data.image);
        
        // Also store original image as base64 (using FileReader to avoid call stack issues)
        if (selectedFile) {
          const originalBase64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(reader.error);
            reader.onload = () => {
              const result = reader.result as string; // "data:image/png;base64,AAAA..."
              const base64 = result.split(',')[1]; // Extract just the base64 part
              resolve(base64);
            };
            reader.readAsDataURL(selectedFile);
          });
          setOriginalImageBase64(originalBase64);
        }
        
        // Store saved URLs if available
        if (data.originalImageUrl) {
          setSavedOriginalUrl(data.originalImageUrl);
        }
        if (data.processedImageUrl) {
          setSavedProcessedUrl(data.processedImageUrl);
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

  const handleDownload = () => {
    if (processedImageUrl) {
      const link = document.createElement('a');
      link.href = processedImageUrl;
      link.download = `laser-engraved-${selectedFile?.name || 'preview.png'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handlePurchase = async () => {
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
      checkoutFormData.append('price', '35'); // $70.00 for custom engraving

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

      // Redirect to Stripe Checkout
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

  // TEST FUNCTION - COMMENTED OUT
  /*
  const handleTestPurchase = async () => {
    if (!originalImageBase64 || !processedImageBase64 || !selectedFile) {
      setError('Missing image data. Please process the image first.');
      return;
    }

    setIsTestingPurchase(true);
    setError(null);

    try {
      // Simulate purchase completion: save images and send email
      const testOrderId = `test-${Date.now()}`;

      // Save original image to blob storage
      const saveOriginalFormData = new FormData();
      saveOriginalFormData.append('image', selectedFile);
      saveOriginalFormData.append('type', 'original');
      saveOriginalFormData.append('orderId', testOrderId);

      const saveOriginalResponse = await fetch('/api/save-image', {
        method: 'POST',
        body: saveOriginalFormData,
      });

      const originalData = await saveOriginalResponse.json();
      if (!saveOriginalResponse.ok) {
        throw new Error('Failed to save original image');
      }

      // Save processed image to blob storage
      const processedBlob = await fetch(`data:image/png;base64,${processedImageBase64}`).then(r => r.blob());
      const processedFile = new File([processedBlob], 'processed.png', { type: 'image/png' });

      const saveProcessedFormData = new FormData();
      saveProcessedFormData.append('image', processedFile);
      saveProcessedFormData.append('type', 'processed');
      saveProcessedFormData.append('orderId', testOrderId);

      const saveProcessedResponse = await fetch('/api/save-image', {
        method: 'POST',
        body: saveProcessedFormData,
      });

      const processedData = await saveProcessedResponse.json();
      if (!saveProcessedResponse.ok) {
        throw new Error('Failed to save processed image');
      }

      // Fetch images and convert to base64 for email attachment
      const originalBufferResponse = await fetch(originalData.url);
      const processedBufferResponse = await fetch(processedData.url);
      const originalBlobForEmail = await originalBufferResponse.blob();
      const processedBlobForEmail = await processedBufferResponse.blob();
      
      // Convert blobs to base64
      const originalBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(originalBlobForEmail);
      });
      
      const processedBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(processedBlobForEmail);
      });

      // Send test email
      const emailFormData = new FormData();
      emailFormData.append('originalUrl', originalData.url);
      emailFormData.append('processedUrl', processedData.url);
      emailFormData.append('orderId', testOrderId);
      emailFormData.append('customerEmail', 'test@example.com');
      emailFormData.append('originalBuffer', originalBase64);
      emailFormData.append('processedBuffer', processedBase64);

      const emailResponse = await fetch('/api/send-test-email', {
        method: 'POST',
        body: emailFormData,
      });

      const emailResult = await emailResponse.json();
      
      if (!emailResponse.ok) {
        throw new Error(emailResult.error || 'Failed to send test email');
      }

      // Show success message
      alert(`✅ Test purchase completed!\n\nOrder ID: ${testOrderId}\n\nImages saved:\n- Original: ${originalData.url}\n- Processed: ${processedData.url}\n\nEmail sent: ${emailResult.email?.sent || 0} successful, ${emailResult.email?.failed || 0} failed`);
      
    } catch (err: any) {
      setError(err.message || 'Failed to simulate purchase');
      console.error('Test purchase error:', err);
    } finally {
      setIsTestingPurchase(false);
    }
  };
  */

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-[#041E42] text-white py-4 px-6 shadow-md">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <Link href="/" className="text-xl font-serif font-bold tracking-wider hover:opacity-80 transition">
            NITTANY CRAFT.
          </Link>
          <Link 
            href="/"
            className="flex items-center gap-2 text-sm hover:opacity-80 transition"
          >
            <ArrowLeft size={16} />
            Back to Home
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto py-12 px-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-serif font-bold text-[#041E42] mb-4">
            Custom Masterpiece
          </h1>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Upload your photo to see a preview of how it will look as a laser-engraved sketch on wood.
          </p>
        </div>

        {/* Upload Area */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center cursor-pointer hover:border-[#041E42] transition"
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
                <Upload size={48} className="mx-auto mb-4 text-slate-400" />
                <p className="text-slate-600 mb-2">
                  Click to upload or drag and drop
                </p>
                <p className="text-sm text-slate-400">
                  PNG, JPG, GIF up to 10MB
                </p>
              </>
            ) : (
              <div className="space-y-4">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-h-64 mx-auto rounded-lg"
                />
                <p className="text-sm text-slate-600">
                  {selectedFile?.name} ({originalDimensions?.width} × {originalDimensions?.height}px)
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                    setPreviewUrl(null);
                    setProcessedImageUrl(null);
                    setOriginalDimensions(null);
                  }}
                  className="text-sm text-red-600 hover:text-red-700"
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
              className="w-full mt-6 bg-[#041E42] text-white py-4 rounded-xl font-bold hover:bg-[#001433] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Processing...
                </>
              ) : (
                'Generate Laser Engraving Preview'
              )}
            </button>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Results */}
        {processedImageUrl && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-serif font-bold text-[#041E42] mb-6 text-center">
              Laser Engraving Preview
            </h2>
            <div className="grid md:grid-cols-2 gap-8 mb-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-600 mb-2">Original</h3>
                <img
                  src={previewUrl!}
                  alt="Original"
                  className="w-full rounded-lg border border-slate-200"
                />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-600 mb-2">Laser Engraved Preview</h3>
                <img
                  src={processedImageUrl}
                  alt="Laser Engraved Preview"
                  className="w-full rounded-lg border border-slate-200"
                />
              </div>
            </div>
            {(savedOriginalUrl || savedProcessedUrl) && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-semibold text-green-800 mb-2">Images saved successfully!</p>
                <div className="text-xs text-green-700 space-y-1">
                  {savedOriginalUrl && (
                    <p>Original: <a href={savedOriginalUrl} target="_blank" rel="noopener noreferrer" className="underline break-all">{savedOriginalUrl}</a></p>
                  )}
                  {savedProcessedUrl && (
                    <p>Processed: <a href={savedProcessedUrl} target="_blank" rel="noopener noreferrer" className="underline break-all">{savedProcessedUrl}</a></p>
                  )}
                </div>
              </div>
            )}
            <div className="flex flex-col gap-4">
              <div className="flex gap-4 justify-center">
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 bg-[#041E42] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#001433] transition"
                >
                  <Download size={20} />
                  Download Preview
                </button>
                <button
                  onClick={handlePurchase}
                  disabled={isPreparingPurchase || !originalImageBase64 || !processedImageBase64}
                  className="flex items-center gap-2 bg-white border-2 border-[#041E42] text-[#041E42] px-6 py-3 rounded-xl font-bold hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPreparingPurchase ? 'Preparing Purchase...' : 'Purchase Custom Engraving - $70'}
                </button>
              </div>
              
              {/* Test Purchase Section - COMMENTED OUT */}
              {/*
              <div className="flex items-center justify-center gap-2 pt-4 border-t border-slate-200">
                <button
                  onClick={handleTestPurchase}
                  disabled={isTestingPurchase || !originalImageBase64 || !processedImageBase64}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isTestingPurchase ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Testing...
                    </>
                  ) : (
                    '🧪 Simulate Purchase (Test)'
                  )}
                </button>
                <span className="text-xs text-slate-400">(Saves images & sends email)</span>
              </div>
              */}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

