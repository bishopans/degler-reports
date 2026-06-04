'use client';
import { useState, useCallback, useMemo } from 'react';
import { generatePdf, generatePdfBlob } from '@/lib/generatePdf';
import Link from 'next/link';
import Image from 'next/image';
import { useDraftSave } from '@/hooks/useDraftSave';
import { DraftBanner } from '@/components/DraftBanner';
import PhotoUploader from '@/components/PhotoUploader';
import {
  equipmentChecklists,
  type EquipmentType,
  type ConditionGrade,
  CONDITION_GRADE_LABELS,
  CONDITION_GRADE_COLORS,
  PRODUCT_INFO_TYPES,
  type ProductInfo,
} from '@/lib/equipmentChecklists';

// One inspected piece of equipment on an LCPS report.
// Multiple instances of the same type share the type-level checklist (typeChecks below).
interface InspectionInstance {
  id: string;
  type: EquipmentType;
  label: string;             // editable, defaults to "Backstops #1"
  conditionGrade: ConditionGrade;
  additionalRepairs: string;
  futurePartsNeeded: string;
  equipmentSafe: 'Yes' | 'No' | '';
  unsafeReason?: string;     // shown only when equipmentSafe === 'No'
  // Per-instance extras for special equipment types
  outdoorBleacherData?: {
    location: string;
    manufacturer: string;
    height: string;
    length: string;
    meetCode: string;
    codeIssues: string;
  };
  otherEquipmentDescription?: string;
  otherTasksPerformed?: string;
}

interface LcpsFormData {
  date: string;
  jobName: string;
  technicianName: string;
  jobNumber: string;
  inspectedEquipment: InspectionInstance[];
  // Service-task checks shared across all instances of a given type.
  // Keyed by equipment type, length matches equipmentChecklists[type].
  typeChecks: Partial<Record<EquipmentType, boolean[]>>;
  typeProductInfo: Partial<Record<EquipmentType, ProductInfo>>;
  equipmentTurnover: string;
  otherNotes: string;
}

const CONDITION_GRADE_OPTIONS: ConditionGrade[] = [5, 4, 3, 2, 1, 0];
const EQUIPMENT_TYPES: EquipmentType[] = Object.keys(equipmentChecklists) as EquipmentType[];

const outdoorBleacherQuestions = [
  'Location of Outdoor Bleachers (Soccer Field/Baseball Field/Football Field)?',
  'Manufacturer?',
  'Bleacher Height / Rows High?',
  'Bleacher Length?',
  'Does structure meet code requirements listed above? (Yes/No):',
  'What items do not meet code requirements and reason?',
];

function makeInstance(type: EquipmentType, index: number): InspectionInstance {
  const base: InspectionInstance = {
    id: crypto.randomUUID(),
    type,
    label: `${type} #${index}`,
    conditionGrade: 5,
    additionalRepairs: '',
    futurePartsNeeded: '',
    equipmentSafe: '',
  };
  if (type === 'Outdoor Bleachers/Grandstands') {
    base.outdoorBleacherData = {
      location: '', manufacturer: '', height: '', length: '', meetCode: '', codeIssues: '',
    };
  }
  if (type === 'Other') {
    base.otherEquipmentDescription = '';
    base.otherTasksPerformed = '';
  }
  return base;
}

export default function LcpsInspectionForm() {
  const createInitialFormData = (): LcpsFormData => ({
    date: '',
    jobName: '',
    technicianName: '',
    jobNumber: '',
    inspectedEquipment: [],
    typeChecks: {},
    typeProductInfo: {},
    equipmentTurnover: '',
    otherNotes: '',
  });

  const [formData, setFormData] = useState<LcpsFormData>(createInitialFormData);
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

  const { draftRestored, draftTimestamp, lastSaveTime, clearDraft, dismissDraftBanner } =
    useDraftSave('lcps-inspection', formData, setFormData, isSubmitted);

  const handlePhotosChange = useCallback((urls: string[]) => setUploadedPhotoUrls(urls), []);
  const handleLocalFilesChange = useCallback((files: File[]) => setLocalPhotoFiles(files), []);
  const handleCaptionsChange = useCallback((c: Record<string, string>) => setPhotoCaptions(c), []);

  // Per-type prompt overrides so the wording matches how the inspector thinks about the equipment.
  // Falls back to "How many <type> are you inspecting?" if no override is defined.
  const ADD_EQUIPMENT_PROMPTS: Partial<Record<EquipmentType, string>> = {
    'Bleachers': 'How many separate banks of Bleachers are you inspecting? (default 1)',
  };

  // Add N instances of an equipment type. If this is the first instance of that type,
  // initialize its shared service-task checklist (all checked by default).
  const handleAddEquipment = (type: EquipmentType) => {
    const existingCount = formData.inspectedEquipment.filter(i => i.type === type).length;
    const promptText = ADD_EQUIPMENT_PROMPTS[type] || `How many ${type} are you inspecting? (default 1)`;
    const raw = window.prompt(promptText, '1');
    if (raw === null) return;
    const qty = Math.max(1, Math.min(50, parseInt(raw, 10) || 1));
    const newInstances: InspectionInstance[] = [];
    for (let i = 0; i < qty; i++) {
      newInstances.push(makeInstance(type, existingCount + i + 1));
    }
    setFormData(prev => {
      const nextTypeChecks = { ...prev.typeChecks };
      if (!nextTypeChecks[type]) {
        // Initialize this type's shared checklist with all items checked
        nextTypeChecks[type] = Array(equipmentChecklists[type].length).fill(true);
      }
      const nextTypeProductInfo = { ...prev.typeProductInfo };
      if (PRODUCT_INFO_TYPES.includes(type) && !nextTypeProductInfo[type]) {
        // Initialize this type's shared product-info block when first added
        nextTypeProductInfo[type] = { manufacturer: '', serial: '', make: '', model: '' };
      }
      return {
        ...prev,
        inspectedEquipment: [...prev.inspectedEquipment, ...newInstances],
        typeChecks: nextTypeChecks,
        typeProductInfo: nextTypeProductInfo,
      };
    });
  };

  const handleRemoveInstance = (id: string) => {
    if (!window.confirm('Remove this equipment instance from the report?')) return;
    setFormData(prev => {
      const removed = prev.inspectedEquipment.find(i => i.id === id);
      const nextInstances = prev.inspectedEquipment.filter(i => i.id !== id);
      // If we just removed the LAST instance of this type, drop its shared checklist + product info
      const nextTypeChecks = { ...prev.typeChecks };
      const nextTypeProductInfo = { ...prev.typeProductInfo };
      if (removed && !nextInstances.some(i => i.type === removed.type)) {
        delete nextTypeChecks[removed.type];
        delete nextTypeProductInfo[removed.type];
      }
      return {
        ...prev,
        inspectedEquipment: nextInstances,
        typeChecks: nextTypeChecks,
        typeProductInfo: nextTypeProductInfo,
      };
    });
  };

  const handleDuplicateInstance = (id: string) => {
    setFormData(prev => {
      const source = prev.inspectedEquipment.find(i => i.id === id);
      if (!source) return prev;
      const sameTypeCount = prev.inspectedEquipment.filter(i => i.type === source.type).length;
      const copy: InspectionInstance = {
        ...source,
        id: crypto.randomUUID(),
        label: `${source.type} #${sameTypeCount + 1}`,
      };
      const idx = prev.inspectedEquipment.findIndex(i => i.id === id);
      const next = [...prev.inspectedEquipment];
      next.splice(idx + 1, 0, copy);
      return { ...prev, inspectedEquipment: next };
    });
  };

  const updateInstance = (id: string, patch: Partial<InspectionInstance>) => {
    setFormData(prev => ({
      ...prev,
      inspectedEquipment: prev.inspectedEquipment.map(i =>
        i.id === id ? { ...i, ...patch } : i
      ),
    }));
  };

  // Update one or more product-info fields for a given equipment type.
  const updateTypeProductInfo = (type: EquipmentType, patch: Partial<ProductInfo>) => {
    setFormData(prev => {
      const current = prev.typeProductInfo[type] || { manufacturer: '', serial: '', make: '', model: '' };
      return {
        ...prev,
        typeProductInfo: { ...prev.typeProductInfo, [type]: { ...current, ...patch } },
      };
    });
  };

  // Toggle a single check in a type-level checklist.
  const toggleTypeCheck = (type: EquipmentType, index: number) => {
    setFormData(prev => {
      const current = prev.typeChecks[type] || Array(equipmentChecklists[type].length).fill(true);
      const next = [...current];
      next[index] = !next[index];
      return { ...prev, typeChecks: { ...prev.typeChecks, [type]: next } };
    });
  };

  const handleBulkSetGrade = (type: EquipmentType, grade: ConditionGrade) => {
    setFormData(prev => ({
      ...prev,
      inspectedEquipment: prev.inspectedEquipment.map(i =>
        i.type === type ? { ...i, conditionGrade: grade } : i
      ),
    }));
  };

  const handleTextAreaInput = (e: React.FormEvent<HTMLTextAreaElement>, id: string) => {
    const textarea = e.currentTarget;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
    setTextareaHeights(prev => ({ ...prev, [id]: textarea.scrollHeight }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Collect every missing required field so the user sees one consolidated list,
    // not one-at-a-time browser tooltips.
    const missing: string[] = [];
    if (!formData.date) missing.push('Date of Inspection');
    if (!formData.jobName.trim()) missing.push('Facility / Job Name');
    if (!formData.technicianName.trim()) missing.push('Technician Name');
    if (!formData.jobNumber.trim()) missing.push('Job Number');

    if (formData.inspectedEquipment.length === 0) {
      missing.push('At least one piece of equipment must be added');
    } else {
      formData.inspectedEquipment.forEach(i => {
        if (!i.equipmentSafe) {
          missing.push(`"Equipment Safe for Use" answer for ${i.label}`);
        }
      });
      formData.inspectedEquipment.forEach(i => {
        if (i.equipmentSafe === 'No' && !(i.unsafeReason && i.unsafeReason.trim())) {
          missing.push(`Reason why ${i.label} is not safe for use`);
        }
      });
    }

    if (missing.length > 0) {
      alert(`Please complete the following before submitting:\n\n• ${missing.join('\n• ')}`);
      return;
    }

    setIsSubmitting(true);

    try {
      const submitData = new FormData();
      submitData.append('report_type', 'lcps-inspection');
      submitData.append('date', formData.date);
      submitData.append('job_name', formData.jobName);
      submitData.append('job_number', formData.jobNumber);
      submitData.append('technician_name', formData.technicianName);

      submitData.append('form_data', JSON.stringify({
        inspectedEquipment: formData.inspectedEquipment,
        typeChecks: formData.typeChecks,
        typeProductInfo: formData.typeProductInfo,
        equipmentTurnover: formData.equipmentTurnover,
        otherNotes: formData.otherNotes,
        photo_captions: photoCaptions,
      }));

      submitData.append('upload_id', uploadId);
      submitData.append('photo_urls', JSON.stringify(uploadedPhotoUrls));

      const response = await fetch('/api/submit-report', { method: 'POST', body: submitData });
      if (!response.ok) throw new Error('Failed to submit report');
      const result = await response.json();

      const photoBlobUrls = localPhotoFiles.map(p => URL.createObjectURL(p));
      const snapshotCaptions: Record<string, string> = {};
      uploadedPhotoUrls.forEach((supaUrl: string, idx: number) => {
        if (photoCaptions[supaUrl] && photoBlobUrls[idx]) {
          snapshotCaptions[photoBlobUrls[idx]] = photoCaptions[supaUrl];
        }
      });

      setSubmittedSnapshot({
        id: result.submission_id,
        created_at: new Date().toISOString(),
        report_type: 'lcps-inspection',
        date: formData.date,
        job_name: formData.jobName,
        job_number: formData.jobNumber,
        technician_name: formData.technicianName,
        status: 'new',
        photo_urls: photoBlobUrls,
        signature_urls: [],
        notes: null,
        form_data: {
          inspectedEquipment: formData.inspectedEquipment,
          typeChecks: formData.typeChecks,
          typeProductInfo: formData.typeProductInfo,
          equipmentTurnover: formData.equipmentTurnover,
          otherNotes: formData.otherNotes,
          photo_captions: snapshotCaptions,
        },
      });

      setFormData(createInitialFormData);
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

  // Group instances by type, preserving the order each type was first added in.
  const groupedByType = useMemo(() => {
    const groups: { type: EquipmentType; instances: InspectionInstance[] }[] = [];
    const seen = new Map<EquipmentType, InspectionInstance[]>();
    formData.inspectedEquipment.forEach(inst => {
      let bucket = seen.get(inst.type);
      if (!bucket) {
        bucket = [];
        seen.set(inst.type, bucket);
        groups.push({ type: inst.type, instances: bucket });
      }
      bucket.push(inst);
    });
    return groups;
  }, [formData.inspectedEquipment]);

  return (
    <div className="min-h-screen p-6">
      <Link href="/" className="mb-6 inline-block text-blue-600 hover:text-blue-800">
        ← Back to Reports
      </Link>

      <div className="w-[100px] mx-auto mb-6">
        <Image src="/images/logo.png" alt="Degler Whiting Logo" width={100} height={100} className="w-full" priority />
      </div>

      <h1 className="text-2xl font-bold text-center mb-2">
        LCPS Building Inspection Report
      </h1>
      <p className="text-center text-sm text-gray-600 mb-8">
        Per ICC-300 requirements — equipment-by-equipment condition assessment
      </p>

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
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <DraftBanner
              draftRestored={draftRestored}
              draftTimestamp={draftTimestamp}
              lastSaveTime={lastSaveTime}
              onDismiss={dismissDraftBanner}
              onClear={() => { clearDraft(); setFormData(createInitialFormData()); }}
            />

            {/* Common header fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1">Date of Inspection</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block mb-1">Facility / Job Name</label>
                <input
                  type="text"
                  value={formData.jobName}
                  onChange={e => setFormData({ ...formData, jobName: e.target.value })}
                  className="w-full p-2 border rounded"
                  required
                  placeholder="e.g. Arcola Elementary School"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1">Technician Name</label>
                <input
                  type="text"
                  value={formData.technicianName}
                  onChange={e => setFormData({ ...formData, technicianName: e.target.value })}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block mb-1">Job Number</label>
                <input
                  type="text"
                  value={formData.jobNumber}
                  onChange={e => setFormData({ ...formData, jobNumber: e.target.value })}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
            </div>

            {/* Condition Grade legend */}
            <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
              <div className="font-medium mb-2">Condition Grade Key</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                {CONDITION_GRADE_OPTIONS.map(g => (
                  <div key={g} className="flex items-center gap-2">
                    <span
                      style={{
                        display: 'inline-block',
                        width: '28px',
                        height: '28px',
                        lineHeight: '26px',
                        textAlign: 'center',
                        borderRadius: '9999px',
                        flexShrink: 0,
                        fontWeight: 700,
                        fontSize: '0.875rem',
                        boxSizing: 'border-box',
                        backgroundColor: CONDITION_GRADE_COLORS[g].bg,
                        color: CONDITION_GRADE_COLORS[g].text,
                        border: `1px solid ${CONDITION_GRADE_COLORS[g].border}`,
                      }}
                    >
                      {g}
                    </span>
                    <span>{CONDITION_GRADE_LABELS[g]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Equipment picker */}
            <div>
              <label className="block mb-2 font-medium">Add Equipment Inspected:</label>
              <p className="text-sm text-gray-600 mb-3">
                Tap an equipment type and enter how many you&apos;re inspecting. The service task checklist for that type is shown once; you then rate each piece of equipment individually below.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {EQUIPMENT_TYPES.map(type => {
                  const count = formData.inspectedEquipment.filter(i => i.type === type).length;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleAddEquipment(type)}
                      className="p-4 border-2 rounded-lg text-center flex flex-col items-center justify-center min-h-[4rem] hover:bg-gray-50"
                    >
                      <span>{type}</span>
                      {count > 0 && (
                        <span className="mt-1 text-xs text-blue-700 font-medium">
                          {count} added — tap to add more
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Type-grouped sections: shared checklist once, then per-instance compact rows */}
            {groupedByType.length > 0 && (
              <div className="space-y-6">
                {groupedByType.map(({ type, instances }) => {
                  const checklist = equipmentChecklists[type];
                  const typeChecks = formData.typeChecks[type]
                    ?? Array(checklist.length).fill(true);
                  return (
                    <div key={type} className="border rounded-lg overflow-hidden">
                      {/* Type-group header */}
                      <div className="bg-blue-700 text-white px-4 py-2 font-semibold">
                        {type} <span className="text-blue-100 text-sm font-normal">({instances.length} inspected)</span>
                      </div>

                      <div className="p-4 space-y-4 bg-white">
                        {/* Shared product info — only for select equipment types */}
                        {PRODUCT_INFO_TYPES.includes(type) && (
                          <div>
                            <div className="text-sm font-medium text-gray-700 mb-2">
                              Product Information
                              <span className="ml-2 text-xs text-gray-500 font-normal">
                                (applies to all {instances.length} {type})
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="block mb-1 text-xs text-gray-600">Manufacturer</label>
                                <input
                                  type="text"
                                  value={formData.typeProductInfo[type]?.manufacturer || ''}
                                  onChange={e => updateTypeProductInfo(type, { manufacturer: e.target.value })}
                                  className="w-full p-2 border rounded text-sm"
                                />
                              </div>
                              <div>
                                <label className="block mb-1 text-xs text-gray-600">Serial #</label>
                                <input
                                  type="text"
                                  value={formData.typeProductInfo[type]?.serial || ''}
                                  onChange={e => updateTypeProductInfo(type, { serial: e.target.value })}
                                  className="w-full p-2 border rounded text-sm"
                                />
                              </div>
                              <div>
                                <label className="block mb-1 text-xs text-gray-600">Make</label>
                                <input
                                  type="text"
                                  value={formData.typeProductInfo[type]?.make || ''}
                                  onChange={e => updateTypeProductInfo(type, { make: e.target.value })}
                                  className="w-full p-2 border rounded text-sm"
                                />
                              </div>
                              <div>
                                <label className="block mb-1 text-xs text-gray-600">Model</label>
                                <input
                                  type="text"
                                  value={formData.typeProductInfo[type]?.model || ''}
                                  onChange={e => updateTypeProductInfo(type, { model: e.target.value })}
                                  className="w-full p-2 border rounded text-sm"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Shared service-task checklist (once per type) */}
                        {type !== 'Other' && checklist.length > 0 && (
                          <div>
                            <div className="text-sm font-medium text-gray-700 mb-1">
                              Service Tasks Performed
                              <span className="ml-2 text-xs text-gray-500 font-normal">
                                (applies to all {instances.length} {type} below)
                              </span>
                            </div>
                            <div className="bg-gray-50 rounded p-2">
                              {checklist.map((item, index) => (
                                <label
                                  key={index}
                                  htmlFor={`${type}-check-${index}`}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '0.75rem',
                                    padding: '0.375rem 0.25rem',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem',
                                    lineHeight: '1.4',
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    id={`${type}-check-${index}`}
                                    checked={typeChecks[index]}
                                    onChange={() => toggleTypeCheck(type, index)}
                                    style={{ flexShrink: 0, marginTop: '0.125rem' }}
                                  />
                                  <span>{item}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Bulk grade control (shown when 2+ instances) */}
                        {instances.length > 1 && (
                          <div className="p-3 border border-blue-200 bg-blue-50 rounded text-sm flex flex-wrap items-center gap-2">
                            <span className="font-medium">Set all {instances.length} to:</span>
                            {CONDITION_GRADE_OPTIONS.map(g => (
                              <button
                                key={g}
                                type="button"
                                onClick={() => handleBulkSetGrade(type, g)}
                                className="px-2 py-1 rounded text-xs font-bold"
                                style={{
                                  backgroundColor: CONDITION_GRADE_COLORS[g].bg,
                                  color: CONDITION_GRADE_COLORS[g].text,
                                  border: `1px solid ${CONDITION_GRADE_COLORS[g].border}`,
                                }}
                              >
                                {g} — {CONDITION_GRADE_LABELS[g]}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Per-instance compact rows */}
                        <div className="space-y-3">
                          {instances.map(inst => {
                            const colors = CONDITION_GRADE_COLORS[inst.conditionGrade];
                            return (
                              <div
                                key={inst.id}
                                className="p-3 border rounded bg-white"
                                style={{ borderLeft: `5px solid ${colors.border}` }}
                              >
                                {/* Top row: label + grade + actions */}
                                <div className="flex flex-wrap items-end gap-2 mb-2">
                                  <div className="flex-1 min-w-[160px]">
                                    <label className="block text-xs uppercase text-gray-500 mb-1">Label / Location</label>
                                    <input
                                      type="text"
                                      value={inst.label}
                                      onChange={e => updateInstance(inst.id, { label: e.target.value })}
                                      className="w-full p-2 border rounded font-medium text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs uppercase text-gray-500 mb-1">Condition</label>
                                    <select
                                      value={inst.conditionGrade}
                                      onChange={e => updateInstance(inst.id, { conditionGrade: Number(e.target.value) as ConditionGrade })}
                                      className="p-2 border rounded font-bold text-sm"
                                      style={{ backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }}
                                    >
                                      {CONDITION_GRADE_OPTIONS.map(g => (
                                        <option key={g} value={g}>{g} — {CONDITION_GRADE_LABELS[g]}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="flex gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleDuplicateInstance(inst.id)}
                                      className="text-xs px-2 py-2 rounded border border-gray-300 hover:bg-gray-50"
                                      title="Duplicate"
                                    >
                                      Duplicate
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveInstance(inst.id)}
                                      className="text-xs px-2 py-2 rounded border border-red-300 text-red-700 hover:bg-red-50"
                                      title="Remove"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>

                                {/* Outdoor Bleachers extra fields */}
                                {inst.type === 'Outdoor Bleachers/Grandstands' && inst.outdoorBleacherData && (
                                  <div className="mt-3 p-3 bg-gray-50 rounded space-y-2">
                                    <div className="text-xs font-medium text-gray-700">Additional Information:</div>
                                    {(['location', 'manufacturer', 'height', 'length', 'meetCode'] as const).map((key, idx) => (
                                      <div key={key}>
                                        <label className="block mb-1 text-xs">{outdoorBleacherQuestions[idx]}</label>
                                        <input
                                          type="text"
                                          value={inst.outdoorBleacherData![key]}
                                          onChange={e => updateInstance(inst.id, {
                                            outdoorBleacherData: { ...inst.outdoorBleacherData!, [key]: e.target.value },
                                          })}
                                          className="w-full p-2 border rounded text-sm"
                                        />
                                      </div>
                                    ))}
                                    <div>
                                      <label className="block mb-1 text-xs">{outdoorBleacherQuestions[5]}</label>
                                      <textarea
                                        value={inst.outdoorBleacherData.codeIssues}
                                        onChange={e => updateInstance(inst.id, {
                                          outdoorBleacherData: { ...inst.outdoorBleacherData!, codeIssues: e.target.value },
                                        })}
                                        onInput={e => handleTextAreaInput(e, `${inst.id}-codeissues`)}
                                        className="w-full p-2 border rounded text-sm"
                                        style={{
                                          minHeight: '60px',
                                          height: textareaHeights[`${inst.id}-codeissues`] ? `${textareaHeights[`${inst.id}-codeissues`]}px` : 'auto',
                                          resize: 'none',
                                        }}
                                      />
                                    </div>
                                  </div>
                                )}

                                {/* Other equipment description fields */}
                                {inst.type === 'Other' && (
                                  <div className="mt-3 p-3 bg-gray-50 rounded space-y-2">
                                    <div>
                                      <label className="block mb-1 font-medium text-xs">What equipment was inspected?</label>
                                      <textarea
                                        value={inst.otherEquipmentDescription || ''}
                                        onChange={e => updateInstance(inst.id, { otherEquipmentDescription: e.target.value })}
                                        onInput={e => handleTextAreaInput(e, `${inst.id}-otherdesc`)}
                                        className="w-full p-2 border rounded text-sm"
                                        placeholder="Describe the equipment..."
                                        style={{
                                          minHeight: '60px',
                                          height: textareaHeights[`${inst.id}-otherdesc`] ? `${textareaHeights[`${inst.id}-otherdesc`]}px` : 'auto',
                                          resize: 'none',
                                        }}
                                      />
                                    </div>
                                    <div>
                                      <label className="block mb-1 font-medium text-xs">What tasks were performed / inspected?</label>
                                      <textarea
                                        value={inst.otherTasksPerformed || ''}
                                        onChange={e => updateInstance(inst.id, { otherTasksPerformed: e.target.value })}
                                        onInput={e => handleTextAreaInput(e, `${inst.id}-othertasks`)}
                                        className="w-full p-2 border rounded text-sm"
                                        placeholder="Describe the tasks..."
                                        style={{
                                          minHeight: '60px',
                                          height: textareaHeights[`${inst.id}-othertasks`] ? `${textareaHeights[`${inst.id}-othertasks`]}px` : 'auto',
                                          resize: 'none',
                                        }}
                                      />
                                    </div>
                                  </div>
                                )}

                                {/* Per-instance notes */}
                                <div className="mt-3 space-y-2">
                                  <div>
                                    <label className="block mb-1 font-medium text-xs">Repairs / notes specific to this {inst.type.replace(/s$/, '').toLowerCase()}:</label>
                                    <textarea
                                      value={inst.additionalRepairs}
                                      onChange={e => updateInstance(inst.id, { additionalRepairs: e.target.value })}
                                      onInput={e => handleTextAreaInput(e, `${inst.id}-repairs`)}
                                      className="w-full p-2 border rounded text-sm"
                                      placeholder="e.g. Tightened cables, adjusted limit switch..."
                                      style={{
                                        minHeight: '50px',
                                        height: textareaHeights[`${inst.id}-repairs`] ? `${textareaHeights[`${inst.id}-repairs`]}px` : 'auto',
                                        resize: 'none',
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <label className="block mb-1 font-medium text-xs">Future parts or service needed:</label>
                                    <textarea
                                      value={inst.futurePartsNeeded}
                                      onChange={e => updateInstance(inst.id, { futurePartsNeeded: e.target.value })}
                                      onInput={e => handleTextAreaInput(e, `${inst.id}-future`)}
                                      className="w-full p-2 border rounded text-sm"
                                      placeholder="Describe any parts or service recommended..."
                                      style={{
                                        minHeight: '50px',
                                        height: textareaHeights[`${inst.id}-future`] ? `${textareaHeights[`${inst.id}-future`]}px` : 'auto',
                                      }}
                                    />
                                  </div>

                                  {/* Safe-for-use radio */}
                                  <div>
                                    <label className="block mb-1 font-medium text-xs">Equipment Working &amp; Safe for Use?</label>
                                    <div className="flex gap-6 mt-1">
                                      <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                          type="radio"
                                          name={`safe-${inst.id}`}
                                          value="Yes"
                                          checked={inst.equipmentSafe === 'Yes'}
                                          onChange={() => updateInstance(inst.id, { equipmentSafe: 'Yes', unsafeReason: '' })}
                                          className="w-4 h-4"
                                        />
                                        <span className="text-sm">Yes</span>
                                      </label>
                                      <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                          type="radio"
                                          name={`safe-${inst.id}`}
                                          value="No"
                                          checked={inst.equipmentSafe === 'No'}
                                          onChange={() => updateInstance(inst.id, { equipmentSafe: 'No' })}
                                          className="w-4 h-4"
                                        />
                                        <span className="text-sm">No</span>
                                      </label>
                                    </div>
                                  </div>

                                  {/* Conditional unsafe-reason textarea — only when Safe = No */}
                                  {inst.equipmentSafe === 'No' && (
                                    <div className="p-3 bg-red-50 border border-red-200 rounded">
                                      <label className="block mb-1 font-medium text-xs text-red-800">
                                        Why is this equipment not safe for use? <span className="text-red-600">*</span>
                                      </label>
                                      <textarea
                                        value={inst.unsafeReason || ''}
                                        onChange={e => updateInstance(inst.id, { unsafeReason: e.target.value })}
                                        onInput={e => handleTextAreaInput(e, `${inst.id}-unsafe`)}
                                        className="w-full p-2 border border-red-300 rounded text-sm"
                                        placeholder="Describe the safety issue, what's broken, what needs to be done before it can be used..."
                                        style={{
                                          minHeight: '70px',
                                          height: textareaHeights[`${inst.id}-unsafe`] ? `${textareaHeights[`${inst.id}-unsafe`]}px` : 'auto',
                                          resize: 'none',
                                          backgroundColor: '#fff',
                                        }}
                                        required
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Equipment Turnover */}
            <div className="space-y-2">
              <label className="block mb-1">Equipment Turnover:</label>
              <p className="text-sm text-gray-600 mb-2">
                Did you leave scoreboard controller, key switch keys, or bleacher controller any place or with anyone?
              </p>
              <textarea
                value={formData.equipmentTurnover}
                onChange={e => setFormData({ ...formData, equipmentTurnover: e.target.value })}
                onInput={e => handleTextAreaInput(e, 'equipment-turnover')}
                className="w-full p-2 border rounded"
                style={{
                  minHeight: '80px',
                  height: textareaHeights['equipment-turnover'] ? `${textareaHeights['equipment-turnover']}px` : 'auto',
                  resize: 'none',
                }}
                placeholder="Describe any equipment left and with whom..."
              />
            </div>

            <div className="space-y-2">
              <label className="block mb-1">Any other notes?</label>
              <textarea
                value={formData.otherNotes}
                onChange={e => setFormData({ ...formData, otherNotes: e.target.value })}
                onInput={e => handleTextAreaInput(e, 'other-notes')}
                className="w-full p-2 border rounded"
                style={{
                  minHeight: '100px',
                  height: textareaHeights['other-notes'] ? `${textareaHeights['other-notes']}px` : 'auto',
                  resize: 'none',
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
                {isSubmitting ? 'Submitting...' : 'Submit Inspection Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
