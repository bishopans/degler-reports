'use client';
import React, { useState, FormEvent, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { generatePdf, generatePdfBlob } from '@/lib/generatePdf';
import { useDraftSave } from '@/hooks/useDraftSave';
import { DraftBanner } from '@/components/DraftBanner';
import PhotoUploader from '@/components/PhotoUploader';

interface TimeEntry {
  id: string;
  entryNumber: number;
  date: string;
  jobNameNumber: string;
  scopeOfWork: string;
  isForeman: boolean;
  regularHours: number;
  overtimeHours: number;
  doubleHours: number;
  miles: number;
  expenses: number;
  expenseDescription: string;
  photos: File[];
}

interface FormData {
  name: string;
  rank: string;
  entries: TimeEntry[];
}

const initialFormData: FormData = {
  name: '',
  rank: '',
  entries: [{
    id: '1',
    entryNumber: 1,
    date: '',
    jobNameNumber: '',
    scopeOfWork: '',
    isForeman: false,
    regularHours: 0,
    overtimeHours: 0,
    doubleHours: 0,
    miles: 0,
    expenses: 0,
    expenseDescription: '',
    photos: []
  }]
};

const rankOptions = [
  'Journeyman',
  'Apprentice 1st Yr',
  'Apprentice 2nd Yr',
  'Apprentice 3rd Yr',
  'Apprentice 4th Yr',
  'Apprentice 5th Yr',
  'Other'
];

export default function TimeSheetForm() {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [submittedSnapshot, setSubmittedSnapshot] = useState<any>(null);

  const uploadId = useMemo(() => crypto.randomUUID(), []);
  const [uploadedPhotoUrls, setUploadedPhotoUrls] = useState<string[]>([]);
  const [photoCaptions, setPhotoCaptions] = useState<Record<string, string>>({});
  const handlePhotosChange = useCallback((urls: string[]) => { setUploadedPhotoUrls(urls); }, []);
  const handleCaptionsChange = useCallback((captions: Record<string, string>) => {
    setPhotoCaptions(captions);
  }, []);

  // Draft save — strip photos from entries before saving
  const { draftRestored, draftTimestamp, lastSaveTime, clearDraft, dismissDraftBanner } = useDraftSave('time-sheets', formData, setFormData, isSubmitted, ['photos']);

  const addRow = () => {
    setFormData(prev => ({
      ...prev,
      entries: [...prev.entries, {
        id: Date.now().toString(),
        entryNumber: prev.entries.length + 1,
        date: '',
        jobNameNumber: '',
        scopeOfWork: '',
        isForeman: false,
        regularHours: 0,
        overtimeHours: 0,
        doubleHours: 0,
        miles: 0,
        expenses: 0,
        expenseDescription: '',
        photos: []
      }]
    }));
  };

  const removeRow = (id: string) => {
    setFormData(prev => ({
      ...prev,
      entries: prev.entries.filter(entry => entry.id !== id).map((entry, index) => ({
        ...entry,
        entryNumber: index + 1
      }))
    }));
  };

  const updateEntry = (id: string, field: keyof TimeEntry, value: string | number | boolean | File[]) => {
    setFormData(prev => ({
      ...prev,
      entries: prev.entries.map(entry =>
        entry.id === id ? { ...entry, [field]: value } : entry
      )
    }));
  };

  const calculateTotals = () => {
    const initial = {
      regularHours: { foreman: 0, regular: 0 },
      overtimeHours: { foreman: 0, regular: 0 },
      doubleHours: { foreman: 0, regular: 0 },
      miles: 0,
      expenses: 0
    };

    return formData.entries.reduce((acc, entry) => {
      const type = entry.isForeman ? 'foreman' : 'regular';
      return {
        regularHours: {
          ...acc.regularHours,
          [type]: acc.regularHours[type] + (Number(entry.regularHours) || 0)
        },
        overtimeHours: {
          ...acc.overtimeHours,
          [type]: acc.overtimeHours[type] + (Number(entry.overtimeHours) || 0)
        },
        doubleHours: {
          ...acc.doubleHours,
          [type]: acc.doubleHours[type] + (Number(entry.doubleHours) || 0)
        },
        miles: acc.miles + (Number(entry.miles) || 0),
        expenses: acc.expenses + (Number(entry.expenses) || 0)
      };
    }, initial);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const submitData = new FormData();
      submitData.append('report_type', 'time-sheets');
      submitData.append('date', new Date().toISOString().split('T')[0]);
      submitData.append('job_name', formData.name);
      submitData.append('job_number', 'TIMESHEET');
      submitData.append('technician_name', formData.name);
      submitData.append('form_data', JSON.stringify({
        name: formData.name,
        rank: formData.rank,
        entries: formData.entries.map(({photos, ...rest}) => rest),
        totals: calculateTotals(),
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

      // Remap captions from Supabase URLs to blob URLs for local PDF
      const snapshotCaptions: Record<string, string> = {};
      uploadedPhotoUrls.forEach((supaUrl: string, idx: number) => {
        if (photoCaptions[supaUrl]) {
          // For time-sheets, we create blob URLs on-the-fly from form entries
          // We'll use a placeholder key since photos aren't embedded in snapshot
          snapshotCaptions[supaUrl] = photoCaptions[supaUrl];
        }
      });

      // Save snapshot for PDF download
      setSubmittedSnapshot({
        id: result.submission_id,
        created_at: new Date().toISOString(),
        report_type: 'time-sheets',
        date: new Date().toISOString().split('T')[0],
        job_name: formData.name,
        job_number: 'TIMESHEET',
        technician_name: formData.name,
        form_data: {
          name: formData.name,
          rank: formData.rank,
          entries: formData.entries.map(({photos, ...rest}) => rest),
          totals: calculateTotals(),
          photo_captions: snapshotCaptions
        },
        photo_urls: [],
        signature_urls: [],
        status: 'submitted',
        notes: null,
      });

      setIsSubmitted(true);
      setFormData(initialFormData);
    } catch (error) {
      console.error('Submission error:', error);
      alert('Error submitting report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totals = calculateTotals();

  return (
    <div className="min-h-screen p-6">
      <Link href="/" className="mb-6 inline-block text-blue-600 hover:text-blue-800">
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

      <h1 className="text-2xl font-bold text-center mb-8">Time Sheet</h1>

      <div className="max-w-3xl mx-auto bg-white p-6 rounded-lg shadow-md">
        {isSubmitted ? (
          <div className="text-center p-8">
            <div className="text-green-600 text-xl mb-4">Time Sheet Submitted Successfully!</div>
            <p className="text-gray-600 mb-6">Would you like to download a copy for your records?</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={async () => {
                  if (!submittedSnapshot) return;
                  setIsGeneratingPdf(true);
                  try {
                    await generatePdf(submittedSnapshot);
                  } catch (error) {
                    console.error('PDF error:', error);
                    alert('Error generating PDF.');
                  } finally {
                    setIsGeneratingPdf(false);
                  }
                }}
                disabled={isGeneratingPdf || !submittedSnapshot}
                className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {isGeneratingPdf ? 'Generating...' : 'Download PDF'}
              </button>
              {typeof navigator !== 'undefined' && !!navigator.share && (
                <button
                  onClick={async () => {
                    if (!submittedSnapshot) return;
                    setIsSharing(true);
                    try {
                      const { blob, filename } = await generatePdfBlob(submittedSnapshot);
                      const file = new File([blob], filename, { type: 'application/pdf' });
                      await navigator.share({ files: [file], title: 'Time Sheet' });
                    } catch (error: unknown) {
                      // User cancelled share — not an error
                      if (error instanceof Error && error.name !== 'AbortError') {
                        console.error('Share error:', error);
                        alert('Error sharing PDF.');
                      }
                    } finally {
                      setIsSharing(false);
                    }
                  }}
                  disabled={isSharing || !submittedSnapshot}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#7c3aed',
                    color: 'white',
                    borderRadius: '0.375rem',
                    border: 'none',
                    cursor: isSharing ? 'not-allowed' : 'pointer',
                    fontWeight: 500,
                    opacity: isSharing ? 0.5 : 1,
                  }}
                >
                  {isSharing ? 'Sharing...' : 'Share / Save to Phone'}
                </button>
              )}
              <button
                onClick={() => { setIsSubmitted(false); setSubmittedSnapshot(null); }}
                className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors"
              >
                Create Another Time Sheet
              </button>
            </div>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <DraftBanner draftRestored={draftRestored} draftTimestamp={draftTimestamp} lastSaveTime={lastSaveTime} onDismiss={dismissDraftBanner} onClear={() => { clearDraft(); setFormData(initialFormData); }} />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-1">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full p-2 border rounded"
                required
              />
            </div>

            <div>
              <label className="block mb-1">Primary Rank</label>
              <select
                value={formData.rank}
                onChange={e => setFormData({...formData, rank: e.target.value})}
                className="w-full p-2 border rounded"
                required
              >
                <option value="">Select Rank</option>
                {rankOptions.map(rank => (
                  <option key={rank} value={rank}>{rank}</option>
                ))}
              </select>
            </div>
          </div>

          {formData.entries.map((entry) => (
            <div key={entry.id} className="border rounded p-4 space-y-4">
              <div className="font-bold">Entry #{entry.entryNumber}</div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1">Date Worked</label>
                  <input
                    type="date"
                    value={entry.date}
                    onChange={e => updateEntry(entry.id, 'date', e.target.value)}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>

                <div>
                  <label className="block mb-1">Job Name and Number</label>
                  <input
                    type="text"
                    value={entry.jobNameNumber}
                    onChange={e => updateEntry(entry.id, 'jobNameNumber', e.target.value)}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1">Brief Scope of Work</label>
                <input
                  type="text"
                  value={entry.scopeOfWork}
                  onChange={e => updateEntry(entry.id, 'scopeOfWork', e.target.value)}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={entry.isForeman}
                  onChange={e => updateEntry(entry.id, 'isForeman', e.target.checked)}
                  className="h-4 w-4"
                />
                <label>Working as Foreman</label>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block mb-1">Regular Hours</label>
                  <input
                    type="number"
                    value={entry.regularHours || ''}
                    onChange={e => {
                      const value = e.target.value;
                      if (/^\d*\.?\d*$/.test(value)) {
                        updateEntry(entry.id, 'regularHours', Number(value));
                      }
                    }}
                    className="w-full p-2 border rounded"
                    min="0"
                    step="0.5"
                    required
                  />
                </div>
                <div>
                  <label className="block mb-1">1.5X Hours</label>
                  <input
                    type="number"
                    value={entry.overtimeHours || ''}
                    onChange={e => {
                      const value = e.target.value;
                      if (/^\d*\.?\d*$/.test(value)) {
                        updateEntry(entry.id, 'overtimeHours', Number(value));
                      }
                    }}
                    className="w-full p-2 border rounded"
                    min="0"
                    step="0.5"
                  />
                </div>
                <div>
                  <label className="block mb-1">2X Hours</label>
                  <input
                    type="number"
                    value={entry.doubleHours || ''}
                    onChange={e => {
                      const value = e.target.value;
                      if (/^\d*\.?\d*$/.test(value)) {
                        updateEntry(entry.id, 'doubleHours', Number(value));
                      }
                    }}
                    className="w-full p-2 border rounded"
                    min="0"
                    step="0.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1">Miles</label>
                  <input
                    type="number"
                    value={entry.miles || ''}
                    onChange={e => {
                      const value = e.target.value;
                      if (/^\d*\.?\d*$/.test(value)) {
                        updateEntry(entry.id, 'miles', Number(value));
                      }
                    }}
                    className="w-full p-2 border rounded"
                    min="0"
                    required
                  />
                </div>

                <div>
                  <label className="block mb-1">$ Expenses</label>
                  <input
                    type="number"
                    value={entry.expenses || ''}
                    onChange={e => {
                      const value = e.target.value;
                      if (/^\d*\.?\d*$/.test(value)) {
                        updateEntry(entry.id, 'expenses', Number(value));
                      }
                    }}
                    className="w-full p-2 border rounded"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              {entry.expenses > 0 && (
                <div>
                  <label className="block mb-1">Expense Description</label>
                  <input
                    type="text"
                    value={entry.expenseDescription}
                    onChange={e => updateEntry(entry.id, 'expenseDescription', e.target.value)}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
              )}

              {formData.entries.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(entry.id)}
                  className="w-full bg-red-100 text-red-600 px-4 py-2 rounded hover:bg-red-200"
                >
                  Remove Entry
                </button>
              )}
            </div>
          ))}

          <div className="flex justify-center pt-4 pb-8">
            <button
              type="button"
              onClick={addRow}
              className="bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600"
            >
              Add Entry
            </button>
          </div>

          {/* Week Totals Summary */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-4">
            <h3 className="font-bold mb-2">Timesheet Totals</h3>

            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Foreman Hours</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm">Regular</label>
                    <div className="font-bold text-lg">{totals.regularHours.foreman}</div>
                  </div>
                  <div>
                    <label className="block text-sm">1.5X</label>
                    <div className="font-bold text-lg">{totals.overtimeHours.foreman}</div>
                  </div>
                  <div>
                    <label className="block text-sm">2X</label>
                    <div className="font-bold text-lg">{totals.doubleHours.foreman}</div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Regular Hours</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm">Regular</label>
                    <div className="font-bold text-lg">{totals.regularHours.regular}</div>
                  </div>
                  <div>
                    <label className="block text-sm">1.5X</label>
                    <div className="font-bold text-lg">{totals.overtimeHours.regular}</div>
                  </div>
                  <div>
                    <label className="block text-sm">2X</label>
                    <div className="font-bold text-lg">{totals.doubleHours.regular}</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm">Total Miles</label>
                  <div className="font-bold text-lg">{totals.miles}</div>
                </div>
                <div>
                  <label className="block text-sm">Total Expenses</label>
                  <div className="font-bold text-lg">${totals.expenses.toFixed(2)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Receipt Photos */}
          <div className="space-y-2">
            <label className="block mb-1">Upload Receipt Photos</label>
            <p className="text-sm text-gray-600 mb-2">Please upload any pictures of receipts</p>
            <PhotoUploader
              uploadId={uploadId}
              onPhotosChange={handlePhotosChange}
              onCaptionsChange={handleCaptionsChange}
            />
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Time Sheet'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
