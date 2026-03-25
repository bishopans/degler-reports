'use client';
import { useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { generatePdf, generatePdfBlob } from '@/lib/generatePdf';
import { useDraftSave } from '@/hooks/useDraftSave';
import { DraftBanner } from '@/components/DraftBanner';
import PhotoUploader from '@/components/PhotoUploader';

const SignaturePad = dynamic(() => import('react-signature-canvas'), {
  ssr: false
});

export default function MaterialTurnoverForm() {
  const [formData, setFormData] = useState({
    date: '',
    jobName: '',
    technicianName: '',
    jobNumber: '',
    turnoverItems: '',
    recipientName: '',
    recipientType: '',
    otherSpecification: '',
    signature: '',
    photos: [] as File[]
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [submittedSnapshot, setSubmittedSnapshot] = useState<Record<string, unknown> | null>(null);

  const uploadId = useMemo(() => crypto.randomUUID(), []);
  const [uploadedPhotoUrls, setUploadedPhotoUrls] = useState<string[]>([]);
  const [localPhotoFiles, setLocalPhotoFiles] = useState<File[]>([]);
  const [photoCaptions, setPhotoCaptions] = useState<Record<string, string>>({});
  const handlePhotosChange = useCallback((urls: string[]) => { setUploadedPhotoUrls(urls); }, []);
  const handleLocalFilesChange = useCallback((files: File[]) => { setLocalPhotoFiles(files); }, []);
  const handleCaptionsChange = useCallback((captions: Record<string, string>) => {
    setPhotoCaptions(captions);
  }, []);

  const { draftRestored, draftTimestamp, lastSaveTime, clearDraft, dismissDraftBanner } = useDraftSave('material-turnover', formData, setFormData, isSubmitted, ['photos', 'signature']);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const submitData = new FormData();
      submitData.append('report_type', 'material-turnover');
      submitData.append('date', formData.date);
      submitData.append('job_name', formData.jobName);
      submitData.append('job_number', formData.jobNumber);
      submitData.append('technician_name', formData.technicianName);
      submitData.append('form_data', JSON.stringify({
        turnoverItems: formData.turnoverItems,
        recipientName: formData.recipientName,
        recipientType: formData.recipientType,
        otherSpecification: formData.otherSpecification,
        photo_captions: photoCaptions
      }));

      // Send pre-uploaded photo URLs
      submitData.append('upload_id', uploadId);
      submitData.append('photo_urls', JSON.stringify(uploadedPhotoUrls));

      // Append signature if exists
      if (formData.signature) {
        submitData.append('signature_base64', formData.signature);
      }

      const response = await fetch('/api/submit-report', {
        method: 'POST',
        body: submitData,
      });

      if (!response.ok) {
        throw new Error('Failed to submit report');
      }

      const result = await response.json();

      // Capture snapshot for PDF before resetting
      const photoBlobUrls = localPhotoFiles.map(p => URL.createObjectURL(p));
      setSubmittedSnapshot({
        id: result.submission_id,
        created_at: new Date().toISOString(),
        report_type: 'material-turnover',
        date: formData.date,
        job_name: formData.jobName,
        job_number: formData.jobNumber,
        technician_name: formData.technicianName,
        status: 'submitted',
        photo_urls: photoBlobUrls,
        signature_urls: [],
        notes: null,
        form_data: {
          turnoverItems: formData.turnoverItems,
          recipientName: formData.recipientName,
          recipientType: formData.recipientType,
          otherSpecification: formData.otherSpecification
        },
      });

      setIsSubmitted(true);
      setFormData({
        date: '',
        jobName: '',
        technicianName: '',
        jobNumber: '',
        turnoverItems: '',
        recipientName: '',
        recipientType: '',
        otherSpecification: '',
        signature: '',
        photos: []
      });
      const pad = document.querySelector('.signature-pad') as HTMLCanvasElement;
      if (pad) {
        const context = pad.getContext('2d');
        context?.clearRect(0, 0, pad.width, pad.height);
      }
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

  const clearSignature = () => {
    const pad = document.querySelector('.signature-pad') as HTMLCanvasElement;
    if (pad) {
      const context = pad.getContext('2d');
      context?.clearRect(0, 0, pad.width, pad.height);
    }
    setFormData(prev => ({ ...prev, signature: '' }));
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
        Material Turnover Report
      </h1>

      <div className="max-w-2xl mx-auto bg-white p-6 rounded-lg shadow-md">
        {isSubmitted ? (
          <div className="text-center p-8">
            <div className="text-green-600 text-xl font-semibold mb-6">Report Submitted Successfully!</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '320px', margin: '0 auto' }}>
              <button
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                className="w-full py-3 px-4 rounded text-white font-medium transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#16a34a' }}
              >
                {isGeneratingPdf ? 'Generating PDF...' : 'Download PDF'}
              </button>

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

              <button
                onClick={() => { setIsSubmitted(false); setSubmittedSnapshot(null); }}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded hover:bg-blue-700 transition-colors font-medium"
              >
                Create Another Report
              </button>
            </div>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <DraftBanner draftRestored={draftRestored} draftTimestamp={draftTimestamp} lastSaveTime={lastSaveTime} onDismiss={dismissDraftBanner} onClear={() => { clearDraft(); setFormData({ date: '', jobName: '', technicianName: '', jobNumber: '', turnoverItems: '', recipientName: '', recipientType: '', otherSpecification: '', signature: '', photos: [] }); }} />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-1">Date of Service</label>
              <input
                type="date"
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
                className="w-full p-2 border rounded"
                required
              />
            </div>

            <div>
              <label className="block mb-1">Job Name</label>
              <input
                type="text"
                value={formData.jobName}
                onChange={e => setFormData({...formData, jobName: e.target.value})}
                className="w-full p-2 border rounded"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-1">Technician Name</label>
              <input
                type="text"
                value={formData.technicianName}
                onChange={e => setFormData({...formData, technicianName: e.target.value})}
                className="w-full p-2 border rounded"
                required
              />
            </div>

            <div>
              <label className="block mb-1">Job Number</label>
              <input
                type="text"
                value={formData.jobNumber}
                onChange={e => setFormData({...formData, jobNumber: e.target.value})}
                className="w-full p-2 border rounded"
                required
              />
            </div>
          </div>

          {/* Turnover Items Section */}
          <div className="space-y-2">
            <label className="block mb-1">What are you turning over?</label>
            <textarea
              value={formData.turnoverItems}
              onChange={e => setFormData({...formData, turnoverItems: e.target.value})}
              className="w-full p-2 border rounded min-h-[150px]"
              placeholder="List each item and quantity of equipment being turned over. Example: 2 pair of keys, 1 bleacher pendant switch, 2 MP-80 scoreboard controllers"
              required
            />
          </div>

          {/* Recipient Section */}
          <div>
            <label className="block mb-1">Full name of recipient:</label>
            <input
              type="text"
              value={formData.recipientName}
              onChange={e => setFormData({...formData, recipientName: e.target.value})}
              className="w-full p-2 border rounded"
              required
            />
          </div>

          {/* Recipient Type Selection */}
          <div className="space-y-2">
            <label className="block mb-1">Is recipient with GC, facility staff, or something else?</label>
            <div className="flex space-x-4">
              {['Facility Staff', 'GC', 'Other'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFormData({...formData, recipientType: type})}
                  className={`p-2 border rounded ${
                    formData.recipientType === type ? 'bg-blue-100 border-blue-500' : ''
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
            {formData.recipientType === 'Other' && (
              <div className="mt-2">
                <label className="block mb-1">Please specify:</label>
                <input
                  type="text"
                  value={formData.otherSpecification}
                  onChange={e => setFormData({...formData, otherSpecification: e.target.value})}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
            )}
          </div>

          {/* Signature Section */}
          <div className="space-y-2">
            <label className="block mb-1">Signature of recipient:</label>
            <div className="border rounded p-2 bg-white">
              <div className="border rounded h-40 bg-white">
                <SignaturePad
                  canvasProps={{
                    className: 'w-full h-full signature-pad'
                  }}
                  onEnd={() => {
                    const pad = document.querySelector('.signature-pad') as HTMLCanvasElement;
                    if (pad) {
                      // Create a new canvas with white background to avoid black box in PDF
                      const exportCanvas = document.createElement('canvas');
                      exportCanvas.width = pad.width;
                      exportCanvas.height = pad.height;
                      const ctx = exportCanvas.getContext('2d');
                      if (ctx) {
                        ctx.fillStyle = '#FFFFFF';
                        ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
                        ctx.drawImage(pad, 0, 0);
                      }
                      const dataUrl = exportCanvas.toDataURL('image/png');
                      setFormData(prev => ({
                        ...prev,
                        signature: dataUrl
                      }));
                    }
                  }}
                />
              </div>
              <button
                type="button"
                onClick={clearSignature}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800"
              >
                Clear Signature
              </button>
            </div>
            <p className="text-sm text-gray-600 italic mt-2">
              By signing above, the recipient acknowledges receipt of the above-listed materials and assumes
              full possession and responsibility effective as of the date of this report. Degler Whiting, Inc.
              is hereby released from any further liability or obligation regarding said materials from the
              date of transfer forward. In the event that any items are lost, damaged, or otherwise unaccounted
              for after transfer, Degler Whiting, Inc. shall bear no responsibility.
            </p>
          </div>

          {/* Photo Upload Section */}
          <PhotoUploader
            uploadId={uploadId}
            onPhotosChange={handlePhotosChange}
            onLocalFilesChange={handleLocalFilesChange}
            onCaptionsChange={handleCaptionsChange}
          />

          {/* Submit Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
