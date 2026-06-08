'use client';
import { useState, FormEvent, useCallback, useMemo } from 'react';
import { generatePdf, generatePdfBlob } from '@/lib/generatePdf';
import Link from 'next/link';
import Image from 'next/image';
import { useDraftSave } from '@/hooks/useDraftSave';
import { DraftBanner } from '@/components/DraftBanner';
import PhotoUploader from '@/components/PhotoUploader';

// Returns today's date in the user's local timezone as YYYY-MM-DD
const getTodayLocal = () => {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const emptyForm = {
  date: '',
  jobName: '',
  technicianName: '',
  jobNumber: '',
  equipment: '',
  notes: '',
  isJobComplete: '',
  completionDate: '',
  estimatedCompletionDate: '',
  photos: [] as File[]
};

export default function JobSiteProgressForm() {
  const [formData, setFormData] = useState({ ...emptyForm });
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

  const { draftRestored, draftTimestamp, lastSaveTime, clearDraft, dismissDraftBanner } = useDraftSave('jobsite-progress', formData, setFormData, isSubmitted);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const submitData = new FormData();
      submitData.append('report_type', 'jobsite-progress');
      submitData.append('date', formData.date);
      submitData.append('job_name', formData.jobName);
      submitData.append('job_number', formData.jobNumber);
      submitData.append('technician_name', formData.technicianName);
      submitData.append('form_data', JSON.stringify({
        equipment: formData.equipment,
        notes: formData.notes,
        isJobComplete: formData.isJobComplete,
        completionDate: formData.completionDate,
        estimatedCompletionDate: formData.estimatedCompletionDate,
        photo_captions: photoCaptions
      }));

      // Send pre-uploaded photo URLs
      submitData.append('upload_id', uploadId);
      submitData.append('photo_urls', JSON.stringify(uploadedPhotoUrls));

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

      // Remap captions from Supabase URLs to blob URLs for local PDF
      const snapshotCaptions: Record<string, string> = {};
      uploadedPhotoUrls.forEach((supaUrl: string, idx: number) => {
        if (photoCaptions[supaUrl] && photoBlobUrls[idx]) {
          snapshotCaptions[photoBlobUrls[idx]] = photoCaptions[supaUrl];
        }
      });

      setSubmittedSnapshot({
        id: result.submission_id,
        created_at: new Date().toISOString(),
        report_type: 'jobsite-progress',
        date: formData.date,
        job_name: formData.jobName,
        job_number: formData.jobNumber,
        technician_name: formData.technicianName,
        status: 'new',
        photo_urls: photoBlobUrls,
        signature_urls: [],
        notes: null,
        form_data: {
          equipment: formData.equipment,
          notes: formData.notes,
          isJobComplete: formData.isJobComplete,
          completionDate: formData.completionDate,
          estimatedCompletionDate: formData.estimatedCompletionDate,
          photo_captions: snapshotCaptions
        },
      });

      setIsSubmitted(true);
      setFormData({ ...emptyForm });
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
        Job Status Report
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

              <button
                onClick={() => { window.location.href = '/'; }}
                className="w-full py-3 px-4 rounded font-medium transition-colors"
                style={{ backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' }}
              >
                Return to Home
              </button>
            </div>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <DraftBanner draftRestored={draftRestored} draftTimestamp={draftTimestamp} lastSaveTime={lastSaveTime} onDismiss={dismissDraftBanner} onClear={() => { clearDraft(); setFormData({ ...emptyForm }); }} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1">Date of Install</label>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          {/* Equipment Section */}
          <div className="space-y-2">
            <label className="block mb-1">Equipment Being Installed</label>
            <textarea
              value={formData.equipment}
              onChange={e => setFormData({...formData, equipment: e.target.value})}
              className="w-full p-2 border rounded min-h-[150px]"
              placeholder="List what equipment is being installed"
              required
            />
          </div>

          {/* Notes Section */}
          <div className="space-y-2">
            <label className="block mb-1">Job Status Notes</label>
            <textarea
              value={formData.notes}
              onChange={e => setFormData({...formData, notes: e.target.value})}
              className="w-full p-2 border rounded min-h-[150px]"
              placeholder="Job status notes; site conditions, equipment being worked on, issues found onsite, etc"
              required
            />
          </div>

          {/* Is Job Complete? */}
          <div className="space-y-2">
            <label className="block mb-1">Is Job Complete?</label>
            <div className="flex gap-6">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="isJobComplete"
                  value="Yes"
                  required
                  checked={formData.isJobComplete === 'Yes'}
                  onChange={() => setFormData(prev => ({
                    ...prev,
                    isJobComplete: 'Yes',
                    completionDate: prev.completionDate || getTodayLocal(),
                    estimatedCompletionDate: '',
                  }))}
                />
                Yes
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="isJobComplete"
                  value="No"
                  required
                  checked={formData.isJobComplete === 'No'}
                  onChange={() => setFormData(prev => ({ ...prev, isJobComplete: 'No' }))}
                />
                No
              </label>
            </div>
          </div>

          {/* Completion Date — shown when job is complete, defaults to today */}
          {formData.isJobComplete === 'Yes' && (
            <div className="space-y-2 p-3 rounded" style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <label className="block mb-1 font-medium" style={{ color: '#166534' }}>✓ Job Complete — Completion Date</label>
              <input
                type="date"
                value={formData.completionDate}
                onChange={e => setFormData({...formData, completionDate: e.target.value})}
                className="w-full p-2 border rounded"
              />
            </div>
          )}

          {/* Estimated Completion Date — hidden once the job is marked complete */}
          {formData.isJobComplete !== 'Yes' && (
            <div className="space-y-2">
              <label className="block mb-1">Estimated Completion Date</label>
              <input
                type="date"
                value={formData.estimatedCompletionDate}
                onChange={e => setFormData({...formData, estimatedCompletionDate: e.target.value})}
                className="w-full p-2 border rounded"
              />
            </div>
          )}

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
