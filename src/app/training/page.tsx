'use client';
import { useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { generatePdf, generatePdfBlob } from '@/lib/generatePdf';
import dynamic from 'next/dynamic';
import { useDraftSave } from '@/hooks/useDraftSave';
import { DraftBanner } from '@/components/DraftBanner';
import PhotoUploader from '@/components/PhotoUploader';
import { VoiceInput, VoiceTextarea } from '@/components/VoiceFields';

const SignaturePad = dynamic(() => import('react-signature-canvas'), {
  ssr: false
});

type Equipment = string;

interface FormData {
  date: string;
  jobName: string;
  technicianName: string;
  jobNumber: string;
  attendanceList: string;
  selectedEquipment: Equipment[];
  otherEquipment: string;
  signature: string;
  equipmentTurnover: string;
  notes: string;
  photos: File[];
}

const initialFormData: FormData = {
  date: '',
  jobName: '',
  technicianName: '',
  jobNumber: '',
  attendanceList: '',
  selectedEquipment: [],
  otherEquipment: '',
  signature: '',
  equipmentTurnover: '',
  notes: '',
  photos: []
};

export default function TrainingForm() {
  const [formData, setFormData] = useState<FormData>(initialFormData);
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

  const { draftRestored, draftTimestamp, lastSaveTime, clearDraft, dismissDraftBanner } = useDraftSave('training', formData, setFormData, isSubmitted, ['photos', 'signature']);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const submitData = new FormData();
      submitData.append('report_type', 'training');
      submitData.append('date', formData.date);
      submitData.append('job_name', formData.jobName);
      submitData.append('job_number', formData.jobNumber);
      submitData.append('technician_name', formData.technicianName);
      submitData.append('form_data', JSON.stringify({
        attendanceList: formData.attendanceList,
        selectedEquipment: formData.selectedEquipment,
        otherEquipment: formData.otherEquipment,
        equipmentTurnover: formData.equipmentTurnover,
        notes: formData.notes,
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
        report_type: 'training',
        date: formData.date,
        job_name: formData.jobName,
        job_number: formData.jobNumber,
        technician_name: formData.technicianName,
        status: 'submitted',
        photo_urls: photoBlobUrls,
        signature_urls: [],
        notes: null,
        form_data: {
          attendanceList: formData.attendanceList,
          selectedEquipment: formData.selectedEquipment,
          otherEquipment: formData.otherEquipment,
          equipmentTurnover: formData.equipmentTurnover,
          notes: formData.notes,
          photo_captions: snapshotCaptions
        },
      });

      setIsSubmitted(true);
      setFormData(initialFormData);
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
        Training Report
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
          <DraftBanner draftRestored={draftRestored} draftTimestamp={draftTimestamp} lastSaveTime={lastSaveTime} onDismiss={dismissDraftBanner} onClear={() => { clearDraft(); setFormData(initialFormData); }} />
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
              <VoiceInput
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
              <VoiceInput
                type="text"
                value={formData.technicianName}
                onChange={e => setFormData({...formData, technicianName: e.target.value})}
                className="w-full p-2 border rounded"
                required
              />
            </div>

            <div>
              <label className="block mb-1">Job Number</label>
              <VoiceInput
                type="text"
                value={formData.jobNumber}
                onChange={e => setFormData({...formData, jobNumber: e.target.value})}
                className="w-full p-2 border rounded"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block mb-1">Attendance List: Who was trained?</label>
            <div className="relative">
              <VoiceTextarea
                value={formData.attendanceList}
                onChange={e => setFormData({...formData, attendanceList: e.target.value})}
                className="w-full p-2 border rounded min-h-[100px]"
                placeholder="Enter names (one per line):
John Smith
Jane Doe
..."
                required
              />
              <div className="text-sm text-gray-500 mt-1">
                Enter each name on a new line
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block mb-2 font-medium">Select all trained equipment:</label>
            <div className="grid grid-cols-2 gap-4">
              {[
                'Bleachers',
                'Basketball Backstops',
                'Divider Curtains',
                'Mat Hoists',
                'Batting Cages',
                'Volleyball',
                'Scoreboards',
                'Folding Partitions'
              ].map((equipment) => (
                <button
                  key={equipment}
                  type="button"
                  onClick={() => setFormData(prev => ({
                    ...prev,
                    selectedEquipment: prev.selectedEquipment.includes(equipment)
                      ? prev.selectedEquipment.filter(e => e !== equipment)
                      : [...prev.selectedEquipment, equipment]
                  }))}
                  className={`p-4 border-2 rounded-lg text-left ${
                    formData.selectedEquipment.includes(equipment)
                      ? 'bg-blue-100 border-blue-500'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  {equipment}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setFormData(prev => ({
                  ...prev,
                  selectedEquipment: prev.selectedEquipment.includes('Other')
                    ? prev.selectedEquipment.filter(e => e !== 'Other')
                    : [...prev.selectedEquipment, 'Other']
                }))}
                className={`p-4 border-2 rounded-lg text-left ${
                  formData.selectedEquipment.includes('Other') ? 'bg-blue-100 border-blue-500' : 'hover:bg-gray-50'
                }`}
              >
                Other
              </button>

              {formData.selectedEquipment.includes('Other') && (
                <div className="col-span-2">
                  <label className="block mb-1">Specify Other Equipment:</label>
                  <VoiceInput
                    type="text"
                    value={formData.otherEquipment}
                    onChange={e => setFormData(prev => ({
                      ...prev,
                      otherEquipment: e.target.value
                    }))}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
              )}
            </div>
          </div>

          {/* Equipment Turnover */}
          <div className="space-y-2">
            <label className="block mb-1">Equipment Turnover:</label>
            <p className="text-sm text-gray-600 mb-2">
              Did you leave scoreboard controller, key switch keys, or bleacher controller
              any place or with anyone?
            </p>
            <VoiceTextarea
              value={formData.equipmentTurnover}
              onChange={e => setFormData({...formData, equipmentTurnover: e.target.value})}
              className="w-full p-2 border rounded min-h-[80px]"
              placeholder="Describe any equipment left and with whom..."
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="block mb-1">Notes</label>
            <VoiceTextarea
              value={formData.notes}
              onChange={e => setFormData({...formData, notes: e.target.value})}
              className="w-full p-2 border rounded min-h-[80px]"
              placeholder="Any additional notes..."
            />
          </div>

          {/* Signature Section */}
          <div className="space-y-2">
            <label className="block mb-1">Signature of main attendee:</label>
            <div className="border rounded p-2 bg-white">
              <div className="border rounded h-40 bg-white">
                <SignaturePad
                  canvasProps={{
                    className: 'w-full h-full signature-pad'
                  }}
                  onEnd={() => {
                    const pad = document.querySelector('.signature-pad') as HTMLCanvasElement;
                    if (pad) {
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
                onClick={() => {
                  const pad = document.querySelector('.signature-pad') as HTMLCanvasElement;
                  if (pad) {
                    const context = pad.getContext('2d');
                    context?.clearRect(0, 0, pad.width, pad.height);
                  }
                  setFormData(prev => ({
                    ...prev,
                    signature: ''
                  }));
                }}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800"
              >
                Clear Signature
              </button>
            </div>
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
