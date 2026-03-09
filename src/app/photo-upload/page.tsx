'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { generatePdf, generatePdfBlob } from '@/lib/generatePdf';
import { useDraftSave } from '@/hooks/useDraftSave';
import { DraftBanner } from '@/components/DraftBanner';

interface FormData {
  yourName: string;
  jobName: string;
  photos: File[];
}

interface SubmittedSnapshot {
  id: string;
  created_at: string;
  report_type: string;
  date: string;
  job_name: string;
  job_number: string;
  technician_name: string;
  status: string;
  photo_urls: string[];
  signature_urls: string[];
  notes: string | null;
  form_data: Record<string, unknown> | null;
}

export default function PhotoUploadForm() {
  const initialFormData: FormData = {
    yourName: '',
    jobName: '',
    photos: []
  };

  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [submittedSnapshot, setSubmittedSnapshot] = useState<SubmittedSnapshot | null>(null);

  const { draftRestored, draftTimestamp, lastSaveTime, clearDraft, dismissDraftBanner } = useDraftSave('photo-upload', formData, setFormData, isSubmitted);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const submitData = new FormData();
      submitData.append('report_type', 'photo-upload');
      submitData.append('date', new Date().toISOString().split('T')[0]);
      submitData.append('job_name', formData.jobName || 'Photo Upload');
      submitData.append('job_number', 'PHOTOS');
      submitData.append('technician_name', formData.yourName);
      submitData.append('form_data', JSON.stringify({
        uploadedBy: formData.yourName,
        jobName: formData.jobName,
      }));

      // Append photos
      formData.photos.forEach(photo => {
        submitData.append('photos', photo);
      });

      const response = await fetch('/api/submit-report', {
        method: 'POST',
        body: submitData,
      });

      if (!response.ok) {
        throw new Error('Failed to submit report');
      }

      const result = await response.json();

      // Build snapshot with photo blob URLs for PDF generation
      const photoBlobUrls = formData.photos.map(photo => URL.createObjectURL(photo));

      setSubmittedSnapshot({
        id: result.submission_id,
        created_at: new Date().toISOString(),
        report_type: 'photo-upload',
        date: new Date().toISOString().split('T')[0],
        job_name: formData.jobName || 'Photo Upload',
        job_number: 'PHOTOS',
        technician_name: formData.yourName,
        status: 'submitted',
        photo_urls: photoBlobUrls,
        signature_urls: [],
        notes: null,
        form_data: {
          uploadedBy: formData.yourName,
          jobName: formData.jobName,
        },
      });

      // Reset form and show success
      setFormData(initialFormData);
      setIsSubmitted(true);
    } catch (error) {
      console.error('Submission error:', error);
      alert('Error submitting report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!submittedSnapshot) return;
    setIsGeneratingPdf(true);
    try {
      await generatePdf(submittedSnapshot as any);
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Error generating PDF. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleSharePdf = async () => {
    if (!submittedSnapshot) return;
    setIsSharing(true);
    try {
      const { blob, filename } = await generatePdfBlob(submittedSnapshot as any);
      const file = new File([blob], filename, { type: 'application/pdf' });
      await navigator.share({ files: [file], title: filename });
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Share error:', error);
        alert('Error sharing PDF. Please try again.');
      }
    } finally {
      setIsSharing(false);
    }
  };

  // Generate preview images
  const renderPhotoPreview = () => {
    if (formData.photos.length === 0) {
      return <p className="text-gray-500 italic">No photos selected</p>;
    }

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
        {Array.from(formData.photos).map((photo, index) => (
          <div key={index} className="relative">
            <div className="aspect-square bg-gray-100 rounded overflow-hidden relative">
              <img
                src={URL.createObjectURL(photo)}
                alt={`Preview ${index + 1}`}
                className="absolute top-0 left-0 w-full h-full object-cover"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                const newPhotos = Array.from(formData.photos);
                newPhotos.splice(index, 1);
                setFormData({...formData, photos: newPhotos});
              }}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
              aria-label="Remove photo"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen p-6">
      <Link
        href="/"
        className="mb-6 inline-block text-blue-600 hover:text-blue-800"
      >
        ← Back to Reports
      </Link>

      <div className="w-[100px] mx-auto mb-6">
        <Image
          src="/images/logo.png"
          alt="Degler Whiting Logo"
          width={100}
          height={100}
          className="w-full"
          priority
        />
      </div>

      <h1 className="text-2xl font-bold text-center mb-8">
        Photos to PDF Upload
      </h1>

      <div className="max-w-3xl mx-auto bg-white p-6 rounded-lg shadow-md">
        {isSubmitted ? (
          <div className="text-center p-8">
            <div className="text-green-600 text-xl font-semibold mb-6">Photos Submitted Successfully!</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '320px', margin: '0 auto' }}>
              {/* Download PDF */}
              <button
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                className="w-full py-3 px-4 rounded text-white font-medium transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#16a34a' }}
              >
                {isGeneratingPdf ? 'Generating PDF...' : 'Download PDF'}
              </button>

              {/* Share / Save to Phone (mobile only) */}
              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <button
                  onClick={handleSharePdf}
                  disabled={isSharing}
                  className="w-full py-3 px-4 rounded text-white font-medium transition-colors disabled:opacity-50"
                  style={{ backgroundColor: '#7c3aed' }}
                >
                  {isSharing ? 'Preparing...' : 'Share / Save to Phone'}
                </button>
              )}

              {/* Upload More */}
              <button
                onClick={() => { setIsSubmitted(false); setSubmittedSnapshot(null); }}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded hover:bg-blue-700 transition-colors font-medium"
              >
                Upload More Photos
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <DraftBanner draftRestored={draftRestored} draftTimestamp={draftTimestamp} lastSaveTime={lastSaveTime} onDismiss={dismissDraftBanner} onClear={() => { clearDraft(); setFormData(initialFormData); }} />
            {/* Your Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
              <input
                type="text"
                value={formData.yourName}
                onChange={(e) => setFormData({ ...formData, yourName: e.target.value })}
                className="w-full p-3 border rounded"
                required
              />
            </div>

            {/* Job Name (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Job Name</label>
              <input
                type="text"
                value={formData.jobName}
                onChange={(e) => setFormData({ ...formData, jobName: e.target.value })}
                placeholder="optional"
                className="w-full p-3 border rounded"
              />
            </div>

            {/* Photo Upload */}
            <div className="space-y-2">
              <div className="border-2 border-dashed rounded-lg p-6 text-center bg-gray-50">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setFormData(prev => ({
                      ...prev,
                      photos: [...prev.photos, ...files]
                    }));
                  }}
                  className="hidden"
                  id="photo-upload"
                  required={formData.photos.length === 0}
                />
                <label
                  htmlFor="photo-upload"
                  className="cursor-pointer inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Select Photos
                </label>
                <p className="text-sm text-gray-500 mt-2">
                  Click to select multiple photos
                </p>
              </div>

              <div className="mt-4">
                <h3 className="font-medium mb-2">Selected Photos ({formData.photos.length})</h3>
                {renderPhotoPreview()}
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                disabled={formData.photos.length === 0 || !formData.yourName.trim() || isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Photos'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
