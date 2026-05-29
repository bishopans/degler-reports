'use client';
import { useState, useCallback, useMemo } from 'react';
import { generatePdf, generatePdfBlob } from '@/lib/generatePdf';
import Link from 'next/link';
import Image from 'next/image';
import { useDraftSave } from '@/hooks/useDraftSave';
import { DraftBanner } from '@/components/DraftBanner';
import PhotoUploader from '@/components/PhotoUploader';
import { equipmentChecklists, type EquipmentType } from '@/lib/equipmentChecklists';

// Form data interface
interface FormData {
  date: string;
  jobName: string;
  technicianName: string;
  jobNumber: string;
  selectedEquipment: EquipmentType[];
  equipmentChecks: Record<string, boolean[]>;
  additionalRepairs: Record<string, string>;
  futurePartsNeeded: Record<string, string>;
  equipmentSafe: Record<string, string>;
  equipmentTurnover: string;
  otherNotes: string;
  photos: File[];
}

// Outdoor bleacher data interface
interface OutdoorBleacherData {
  location: string;
  manufacturer: string;
  height: string;
  length: string;
  meetCode: string;
  codeIssues: string;
}

// Equipment types and per-type service-task checklists are imported from `@/lib/equipmentChecklists`
// so this form and the new /lcps form stay in sync. See that file for the source of truth.

// Additional questions for outdoor bleachers
const outdoorBleacherQuestions = [
  'Location of Outdoor Bleachers (Soccer Field/Baseball Field/Football Field)?',
  'Manufacturer?',
  'Bleacher Height / Rows High?',
  'Bleacher Length?',
  'Does structure meet code requirements listed above? (Yes/No):',
  'What items do not meet code requirements and reason?'
];

export default function MaintenanceForm() {
  // Initialize form data
  const createInitialFormData = (): FormData => {
    const equipmentTypes = Object.keys(equipmentChecklists) as EquipmentType[];
    
    const initialEquipmentChecks: Record<string, boolean[]> = {};
    const initialAdditionalRepairs: Record<string, string> = {};
    const initialFuturePartsNeeded: Record<string, string> = {};
    const initialEquipmentSafe: Record<string, string> = {};

    equipmentTypes.forEach(type => {
      initialEquipmentChecks[type] = Array(equipmentChecklists[type].length).fill(true);
      initialAdditionalRepairs[type] = '';
      initialFuturePartsNeeded[type] = '';
      initialEquipmentSafe[type] = '';
    });

    return {
      date: '',
      jobName: '',
      technicianName: '',
      jobNumber: '',
      selectedEquipment: [],
      equipmentChecks: initialEquipmentChecks,
      additionalRepairs: initialAdditionalRepairs,
      futurePartsNeeded: initialFuturePartsNeeded,
      equipmentSafe: initialEquipmentSafe,
      equipmentTurnover: '',
      otherNotes: '',
      photos: []
    };
  };

  const [formData, setFormData] = useState<FormData>(createInitialFormData);
  const [outdoorBleacherData, setOutdoorBleacherData] = useState<OutdoorBleacherData>({
    location: '',
    manufacturer: '',
    height: '',
    length: '',
    meetCode: '',
    codeIssues: ''
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [submittedSnapshot, setSubmittedSnapshot] = useState<Record<string, unknown> | null>(null);
  const [textareaHeights, setTextareaHeights] = useState<Record<string, number>>({});

  const uploadId = useMemo(() => crypto.randomUUID(), []);
  const [uploadedPhotoUrls, setUploadedPhotoUrls] = useState<string[]>([]);
  const [localPhotoFiles, setLocalPhotoFiles] = useState<File[]>([]);
  const [photoCaptions, setPhotoCaptions] = useState<Record<string, string>>({});

  const { draftRestored, draftTimestamp, lastSaveTime, clearDraft, dismissDraftBanner } = useDraftSave('maintenance', formData, setFormData, isSubmitted);

  const handlePhotosChange = useCallback((urls: string[]) => {
    setUploadedPhotoUrls(urls);
  }, []);

  const handleLocalFilesChange = useCallback((files: File[]) => {
    setLocalPhotoFiles(files);
  }, []);

  const handleCaptionsChange = useCallback((captions: Record<string, string>) => {
    setPhotoCaptions(captions);
  }, []);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Require at least one equipment type to be selected
    if (formData.selectedEquipment.length === 0) {
      alert('Please select at least one equipment type before submitting.');
      return;
    }

    // Require "Equipment Safe for Use" for every selected equipment
    const missingSafe = formData.selectedEquipment.filter(
      equip => !formData.equipmentSafe[equip]
    );
    if (missingSafe.length > 0) {
      alert(`Please select "Equipment Safe for Use" (Yes or No) for: ${missingSafe.join(', ')}`);
      return;
    }

    setIsSubmitting(true);

    try {
      const submitData = new FormData();
      submitData.append('report_type', 'maintenance');
      submitData.append('date', formData.date);
      submitData.append('job_name', formData.jobName);
      submitData.append('job_number', formData.jobNumber);
      submitData.append('technician_name', formData.technicianName);
      // Only include checks, repairs, future parts, and safe status for selected equipment
      const filteredChecks: Record<string, boolean[]> = {};
      const filteredRepairs: Record<string, string> = {};
      const filteredFutureParts: Record<string, string> = {};
      const filteredEquipmentSafe: Record<string, string> = {};
      formData.selectedEquipment.forEach(equip => {
        if (formData.equipmentChecks[equip]) {
          filteredChecks[equip] = formData.equipmentChecks[equip];
        }
        if (formData.additionalRepairs[equip]?.trim()) {
          filteredRepairs[equip] = formData.additionalRepairs[equip];
        }
        if (formData.futurePartsNeeded[equip]?.trim()) {
          filteredFutureParts[equip] = formData.futurePartsNeeded[equip];
        }
        if (formData.equipmentSafe[equip]) {
          filteredEquipmentSafe[equip] = formData.equipmentSafe[equip];
        }
      });
      // Also include Other sub-fields if Other is selected
      if (formData.selectedEquipment.includes('Other' as EquipmentType)) {
        if (formData.additionalRepairs['Other-Equipment']?.trim()) {
          filteredRepairs['Other-Equipment'] = formData.additionalRepairs['Other-Equipment'];
        }
        if (formData.additionalRepairs['Other-Tasks']?.trim()) {
          filteredRepairs['Other-Tasks'] = formData.additionalRepairs['Other-Tasks'];
        }
      }

      // Only include outdoor bleacher data if that equipment is selected
      const includeOutdoorBleacher = formData.selectedEquipment.includes('Outdoor Bleachers/Grandstands' as EquipmentType);

      submitData.append('form_data', JSON.stringify({
        selectedEquipment: formData.selectedEquipment,
        equipmentChecks: filteredChecks,
        additionalRepairs: filteredRepairs,
        futurePartsNeeded: filteredFutureParts,
        equipmentSafe: filteredEquipmentSafe,
        equipmentTurnover: formData.equipmentTurnover,
        otherNotes: formData.otherNotes,
        photo_captions: photoCaptions,
        ...(includeOutdoorBleacher ? { outdoorBleacherData: outdoorBleacherData } : {})
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
        report_type: 'maintenance',
        date: formData.date,
        job_name: formData.jobName,
        job_number: formData.jobNumber,
        technician_name: formData.technicianName,
        status: 'new',
        photo_urls: photoBlobUrls,
        signature_urls: [],
        notes: null,
        form_data: {
          selectedEquipment: formData.selectedEquipment,
          equipmentChecks: filteredChecks,
          additionalRepairs: filteredRepairs,
          futurePartsNeeded: filteredFutureParts,
          equipmentSafe: filteredEquipmentSafe,
          equipmentTurnover: formData.equipmentTurnover,
          otherNotes: formData.otherNotes,
          photo_captions: snapshotCaptions,
          ...(includeOutdoorBleacher ? { outdoorBleacherData: outdoorBleacherData } : {})
        },
      });

      // Reset form
      setFormData(createInitialFormData);
      setOutdoorBleacherData({
        location: '',
        manufacturer: '',
        height: '',
        length: '',
        meetCode: '',
        codeIssues: ''
      });
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

  // Toggle equipment selection
  const toggleEquipmentSelection = (equipment: EquipmentType) => {
    setFormData(prev => {
      const isSelected = prev.selectedEquipment.includes(equipment);
      
      if (isSelected) {
        // Remove from selection
        return {
          ...prev,
          selectedEquipment: prev.selectedEquipment.filter(e => e !== equipment)
        };
      } else {
        // Add to selection
        return {
          ...prev,
          selectedEquipment: [...prev.selectedEquipment, equipment]
        };
      }
    });
  };

  // Handle checkbox change
  const handleCheckboxChange = (equipment: string, index: number) => {
    setFormData(prev => {
      const newChecks = {...prev.equipmentChecks};
      newChecks[equipment] = [...newChecks[equipment]];
      newChecks[equipment][index] = !newChecks[equipment][index];
      
      return {
        ...prev,
        equipmentChecks: newChecks
      };
    });
  };

  // Handle additional repairs text change
  const handleAdditionalRepairsChange = (key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      additionalRepairs: { ...prev.additionalRepairs, [key]: value }
    }));
  };

  // Handle future parts needed text change
  const handleFuturePartsChange = (key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      futurePartsNeeded: { ...prev.futurePartsNeeded, [key]: value }
    }));
  };

  // Handle equipment safe change
  const handleEquipmentSafeChange = (equipment: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      equipmentSafe: {
        ...prev.equipmentSafe,
        [equipment]: value
      }
    }));
  };

  // Auto-resize textarea
  const handleTextAreaInput = (e: React.FormEvent<HTMLTextAreaElement>, id: string) => {
    const textarea = e.currentTarget;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
    
    setTextareaHeights(prev => ({
      ...prev,
      [id]: textarea.scrollHeight
    }));
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
        Preventative Maintenance/Inspection Report
      </h1>

      <div className="max-w-3xl mx-auto bg-white p-6 rounded-lg shadow-md">
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
            <DraftBanner draftRestored={draftRestored} draftTimestamp={draftTimestamp} lastSaveTime={lastSaveTime} onDismiss={dismissDraftBanner} onClear={() => { clearDraft(); setFormData(createInitialFormData()); }} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <div>
              <label className="block mb-2 font-medium">Select Equipment Type(s):</label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(Object.keys(equipmentChecklists) as EquipmentType[]).map((equipment) => (
                  <button
                    key={equipment}
                    type="button"
                    onClick={() => toggleEquipmentSelection(equipment)}
                    className={`p-4 border-2 rounded-lg text-center flex items-center justify-center min-h-[4rem] ${
                      formData.selectedEquipment.includes(equipment)
                        ? 'bg-blue-100 border-blue-500'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <span>{equipment}</span>
                  </button>
                ))}
              </div>
            </div>

            {formData.selectedEquipment.length > 0 && (
              <div className="space-y-8">
                {formData.selectedEquipment.map((equipment) => (
                  <div key={equipment} className="p-4 border rounded-lg bg-gray-50 space-y-4">
                    <h3 className="font-bold text-lg">{equipment} Checklist</h3>
                    
                    {equipment !== 'Other' && (
                      <div className="space-y-2">
                        {equipmentChecklists[equipment].map((item, index) => (
                          <label
                            key={index}
                            htmlFor={`${equipment}-checklist-${index}`}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '0.75rem',
                              padding: '0.5rem 0.25rem',
                              cursor: 'pointer',
                              borderRadius: '0.375rem',
                              fontSize: '0.875rem',
                              lineHeight: '1.4',
                            }}
                          >
                            <input
                              type="checkbox"
                              id={`${equipment}-checklist-${index}`}
                              checked={formData.equipmentChecks[equipment][index]}
                              onChange={() => handleCheckboxChange(equipment, index)}
                              style={{ flexShrink: 0, marginTop: '0.125rem' }}
                            />
                            <span>{item}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    
                    {equipment === 'Outdoor Bleachers/Grandstands' && (
                      <div className="mt-4 space-y-4">
                        <h4 className="font-medium">Additional Information:</h4>
                        <div>
                          <label className="block mb-1">{outdoorBleacherQuestions[0]}</label>
                          <input
                            type="text"
                            value={outdoorBleacherData.location}
                            onChange={(e) => setOutdoorBleacherData({...outdoorBleacherData, location: e.target.value})}
                            className="w-full p-2 border rounded"
                          />
                        </div>
                        <div>
                          <label className="block mb-1">{outdoorBleacherQuestions[1]}</label>
                          <input
                            type="text"
                            value={outdoorBleacherData.manufacturer}
                            onChange={(e) => setOutdoorBleacherData({...outdoorBleacherData, manufacturer: e.target.value})}
                            className="w-full p-2 border rounded"
                          />
                        </div>
                        <div>
                          <label className="block mb-1">{outdoorBleacherQuestions[2]}</label>
                          <input
                            type="text"
                            value={outdoorBleacherData.height}
                            onChange={(e) => setOutdoorBleacherData({...outdoorBleacherData, height: e.target.value})}
                            className="w-full p-2 border rounded"
                          />
                        </div>
                        <div>
                          <label className="block mb-1">{outdoorBleacherQuestions[3]}</label>
                          <input
                            type="text"
                            value={outdoorBleacherData.length}
                            onChange={(e) => setOutdoorBleacherData({...outdoorBleacherData, length: e.target.value})}
                            className="w-full p-2 border rounded"
                          />
                        </div>
                        <div>
                          <label className="block mb-1">{outdoorBleacherQuestions[4]}</label>
                          <input
                            type="text"
                            value={outdoorBleacherData.meetCode}
                            onChange={(e) => setOutdoorBleacherData({...outdoorBleacherData, meetCode: e.target.value})}
                            className="w-full p-2 border rounded"
                          />
                        </div>
                        <div>
                          <label className="block mb-1">{outdoorBleacherQuestions[5]}</label>
                          <textarea
                            value={outdoorBleacherData.codeIssues}
                            onChange={(e) => setOutdoorBleacherData({...outdoorBleacherData, codeIssues: e.target.value})}
                            onInput={(e) => handleTextAreaInput(e, 'outdoor-code-issues')}
                            className="w-full p-2 border rounded"
                            style={{
                              minHeight: '80px',
                              height: textareaHeights['outdoor-code-issues'] ? `${textareaHeights['outdoor-code-issues']}px` : 'auto',
                              resize: 'none'
                            }}
                          />
                        </div>
                      </div>
                    )}
                    
                    {equipment === 'Other' && (
                      <div className="mt-4 space-y-4">
                        <div>
                          <label className="block mb-1 font-medium">What equipment was serviced?</label>
                          <textarea
                            value={formData.additionalRepairs['Other-Equipment'] || ''}
                            onChange={(e) => handleAdditionalRepairsChange('Other-Equipment', e.target.value)}
                            onInput={(e) => handleTextAreaInput(e, 'other-equipment')}
                            className="w-full p-2 border rounded"
                            placeholder="Describe the equipment..."
                            style={{
                              minHeight: '80px',
                              height: textareaHeights['other-equipment'] ? `${textareaHeights['other-equipment']}px` : 'auto',
                              resize: 'none'
                            }}
                          />
                        </div>
                        <div>
                          <label className="block mb-1 font-medium">What tasks were performed?</label>
                          <textarea
                            value={formData.additionalRepairs['Other-Tasks'] || ''}
                            onChange={(e) => handleAdditionalRepairsChange('Other-Tasks', e.target.value)}
                            onInput={(e) => handleTextAreaInput(e, 'other-tasks')}
                            className="w-full p-2 border rounded"
                            placeholder="Describe the tasks..."
                            style={{
                              minHeight: '80px',
                              height: textareaHeights['other-tasks'] ? `${textareaHeights['other-tasks']}px` : 'auto',
                              resize: 'none'
                            }}
                          />
                        </div>
                        <div>
                          <label className="block mb-1 font-medium">List any future parts or service needed:</label>
                          <textarea
                            value={formData.futurePartsNeeded['Other'] || ''}
                            onChange={(e) => handleFuturePartsChange('Other', e.target.value)}
                            onInput={(e) => handleTextAreaInput(e, 'other-future')}
                            className="w-full p-2 border rounded"
                            placeholder="Describe any parts or service recommended..."
                            style={{
                              minHeight: '80px',
                              height: textareaHeights['other-future'] ? `${textareaHeights['other-future']}px` : 'auto',
                              resize: 'none'
                            }}
                          />
                        </div>
                        <div>
                          <label className="block mb-1 font-medium">Equipment Working & Safe for Use?</label>
                          <div className="flex gap-6 mt-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="safe-Other"
                                value="Yes"
                                checked={formData.equipmentSafe['Other'] === 'Yes'}
                                onChange={() => handleEquipmentSafeChange('Other', 'Yes')}
                                className="w-5 h-5"
                              />
                              <span className="text-base">Yes</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="safe-Other"
                                value="No"
                                checked={formData.equipmentSafe['Other'] === 'No'}
                                onChange={() => handleEquipmentSafeChange('Other', 'No')}
                                className="w-5 h-5"
                              />
                              <span className="text-base">No</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    )}

                    {equipment !== 'Other' && (
                      <div className="space-y-4">
                        <div>
                          <label className="block mb-1 font-medium">List any repairs made during this service:</label>
                          <textarea
                            value={formData.additionalRepairs[equipment] || ''}
                            onChange={(e) => handleAdditionalRepairsChange(equipment, e.target.value)}
                            onInput={(e) => handleTextAreaInput(e, `repairs-${equipment}`)}
                            className="w-full p-2 border rounded"
                            placeholder="Describe any repairs performed..."
                            style={{
                              minHeight: '80px',
                              height: textareaHeights[`repairs-${equipment}`] ? `${textareaHeights[`repairs-${equipment}`]}px` : 'auto',
                              resize: 'none'
                            }}
                          />
                        </div>
                        <div>
                          <label className="block mb-1 font-medium">List any future parts or service needed:</label>
                          <textarea
                            value={formData.futurePartsNeeded[equipment] || ''}
                            onChange={(e) => handleFuturePartsChange(equipment, e.target.value)}
                            onInput={(e) => handleTextAreaInput(e, `future-${equipment}`)}
                            className="w-full p-2 border rounded"
                            placeholder="Describe any parts or service recommended..."
                            style={{
                              minHeight: '80px',
                              height: textareaHeights[`future-${equipment}`] ? `${textareaHeights[`future-${equipment}`]}px` : 'auto',
                              resize: 'none'
                            }}
                          />
                        </div>
                        <div>
                          <label className="block mb-1 font-medium">Equipment Working & Safe for Use?</label>
                          <div className="flex gap-6 mt-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name={`safe-${equipment}`}
                                value="Yes"
                                checked={formData.equipmentSafe[equipment] === 'Yes'}
                                onChange={() => handleEquipmentSafeChange(equipment, 'Yes')}
                                className="w-5 h-5"
                              />
                              <span className="text-base">Yes</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name={`safe-${equipment}`}
                                value="No"
                                checked={formData.equipmentSafe[equipment] === 'No'}
                                onChange={() => handleEquipmentSafeChange(equipment, 'No')}
                                className="w-5 h-5"
                              />
                              <span className="text-base">No</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <label className="block mb-1">Equipment Turnover:</label>
              <p className="text-sm text-gray-600 mb-2">
                Did you leave scoreboard controller, key switch keys, or bleacher controller
                any place or with anyone?
              </p>
              <textarea
                value={formData.equipmentTurnover}
                onChange={e => setFormData({...formData, equipmentTurnover: e.target.value})}
                onInput={(e) => handleTextAreaInput(e, 'equipment-turnover')}
                className="w-full p-2 border rounded"
                style={{
                  minHeight: '80px',
                  height: textareaHeights['equipment-turnover'] ? `${textareaHeights['equipment-turnover']}px` : 'auto',
                  resize: 'none'
                }}
                placeholder="Describe any equipment left and with whom..."
              />
            </div>

            <div className="space-y-2">
              <label className="block mb-1">Any other notes?</label>
              <textarea
                value={formData.otherNotes}
                onChange={e => setFormData({...formData, otherNotes: e.target.value})}
                onInput={(e) => handleTextAreaInput(e, 'other-notes')}
                className="w-full p-2 border rounded"
                style={{
                  minHeight: '100px',
                  height: textareaHeights['other-notes'] ? `${textareaHeights['other-notes']}px` : 'auto',
                  resize: 'none'
                }}
                placeholder="Enter any additional notes or observations..."
              />
            </div>

            <PhotoUploader
              uploadId={uploadId}
              onPhotosChange={handlePhotosChange}
              onLocalFilesChange={handleLocalFilesChange}
              onCaptionsChange={handleCaptionsChange}
            />

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
