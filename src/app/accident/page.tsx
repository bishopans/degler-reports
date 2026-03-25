'use client';
import { useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import PhotoUploader from '@/components/PhotoUploader';
import { generatePdf, generatePdfBlob } from '@/lib/generatePdf';
import { useDraftSave } from '@/hooks/useDraftSave';
import { DraftBanner } from '@/components/DraftBanner';

// Form data interface
interface FormData {
  // Header Information
  date: string;
  jobName: string;
  technicianName: string;
  jobNumber: string;
  
  // Incident Information
  incidentDate: string;
  incidentTime: string;
  location: string;
  incidentType: string;
  otherIncidentType: string;
  
  // People Involved
  peopleInvolved: string;
  witness: string;
  
  // Incident Details
  description: string;
  cause: string;
  injuries: string;
  treatment: string;
  propertyDamage: string;
  
  // Actions
  immediateActions: string;
  futurePreventionSteps: string;
  reportedTo: string;
  reportedDate: string;
  
  // Standard sections
  otherNotes: string;
  photos: File[];
}

export default function IncidentReportForm() {
  // Initialize form data
  const initialFormData: FormData = {
    date: '',
    jobName: '',
    technicianName: '',
    jobNumber: '',
    incidentDate: '',
    incidentTime: '',
    location: '',
    incidentType: '',
    otherIncidentType: '',
    peopleInvolved: '',
    witness: '',
    description: '',
    cause: '',
    injuries: '',
    treatment: '',
    propertyDamage: '',
    immediateActions: '',
    futurePreventionSteps: '',
    reportedTo: '',
    reportedDate: '',
    otherNotes: '',
    photos: []
  };

  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [textareaHeights, setTextareaHeights] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [submittedSnapshot, setSubmittedSnapshot] = useState<any>(null);

  const uploadId = useMemo(() => crypto.randomUUID(), []);
  const [uploadedPhotoUrls, setUploadedPhotoUrls] = useState<string[]>([]);
  const [localPhotoFiles, setLocalPhotoFiles] = useState<File[]>([]);
  const [photoCaptions, setPhotoCaptions] = useState<Record<string, string>>({});
  const handlePhotosChange = useCallback((urls: string[]) => { setUploadedPhotoUrls(urls); }, []);
  const handleLocalFilesChange = useCallback((files: File[]) => { setLocalPhotoFiles(files); }, []);
  const handleCaptionsChange = useCallback((captions: Record<string, string>) => {
    setPhotoCaptions(captions);
  }, []);

  const { draftRestored, draftTimestamp, lastSaveTime, clearDraft, dismissDraftBanner } = useDraftSave('accident', formData, setFormData, isSubmitted);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const submitData = new FormData();
      submitData.append('report_type', 'accident');
      submitData.append('date', formData.date);
      submitData.append('job_name', formData.jobName);
      submitData.append('job_number', formData.jobNumber);
      submitData.append('technician_name', formData.technicianName);
      submitData.append('form_data', JSON.stringify({
        incidentDate: formData.incidentDate,
        incidentTime: formData.incidentTime,
        location: formData.location,
        incidentType: formData.incidentType,
        otherIncidentType: formData.otherIncidentType,
        peopleInvolved: formData.peopleInvolved,
        witness: formData.witness,
        description: formData.description,
        cause: formData.cause,
        injuries: formData.injuries,
        treatment: formData.treatment,
        propertyDamage: formData.propertyDamage,
        immediateActions: formData.immediateActions,
        futurePreventionSteps: formData.futurePreventionSteps,
        reportedTo: formData.reportedTo,
        reportedDate: formData.reportedDate,
        otherNotes: formData.otherNotes,
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

      // Save snapshot for PDF download
      setSubmittedSnapshot({
        id: result.submission_id,
        created_at: new Date().toISOString(),
        report_type: 'accident',
        date: formData.date,
        job_name: formData.jobName,
        job_number: formData.jobNumber,
        technician_name: formData.technicianName,
        form_data: {
          incidentDate: formData.incidentDate,
          incidentTime: formData.incidentTime,
          location: formData.location,
          incidentType: formData.incidentType,
          otherIncidentType: formData.otherIncidentType,
          peopleInvolved: formData.peopleInvolved,
          witness: formData.witness,
          description: formData.description,
          cause: formData.cause,
          injuries: formData.injuries,
          treatment: formData.treatment,
          propertyDamage: formData.propertyDamage,
          immediateActions: formData.immediateActions,
          futurePreventionSteps: formData.futurePreventionSteps,
          reportedTo: formData.reportedTo,
          reportedDate: formData.reportedDate,
          otherNotes: formData.otherNotes,
        },
        photo_urls: localPhotoFiles.map(p => URL.createObjectURL(p)),
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

  const incidentTypes = [
    'Injury',
    'Near Miss',
    'Property Damage',
    'Equipment Failure',
    'Environmental',
    'Security',
    'Other'
  ];

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
        Accident/Incident Report
      </h1>

      <div className="max-w-3xl mx-auto bg-white p-6 rounded-lg shadow-md">
        {isSubmitted ? (
          <div className="text-center p-8">
            <div className="text-green-600 text-xl mb-4">Incident Report Submitted Successfully!</div>
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
                      await navigator.share({ files: [file], title: 'Incident Report' });
                    } catch (error: unknown) {
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
                Create Another Report
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <DraftBanner draftRestored={draftRestored} draftTimestamp={draftTimestamp} lastSaveTime={lastSaveTime} onDismiss={dismissDraftBanner} onClear={() => { clearDraft(); setFormData(initialFormData); }} />
            {/* Header Information Section */}
            <div className="border-b pb-6">
              <h2 className="text-lg font-medium mb-4">Report Information</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1">Today&apos;s Date</label>
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

              <div className="grid grid-cols-2 gap-4 mt-4">
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
            </div>

            {/* Incident Information Section */}
            <div className="border-b pb-6">
              <h2 className="text-lg font-medium mb-4">Incident Information</h2>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1">Date of Incident</label>
                  <input
                    type="date"
                    value={formData.incidentDate}
                    onChange={e => setFormData({...formData, incidentDate: e.target.value})}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
                
                <div>
                  <label className="block mb-1">Time of Incident</label>
                  <input
                    type="time"
                    value={formData.incidentTime}
                    onChange={e => setFormData({...formData, incidentTime: e.target.value})}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block mb-1">Location of Incident</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={e => setFormData({...formData, location: e.target.value})}
                  className="w-full p-2 border rounded"
                  placeholder="Specific area where incident occurred"
                  required
                />
              </div>

              <div className="mt-4">
                <label className="block mb-1">Type of Incident</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                  {incidentTypes.map((type) => (
                    <div key={type} className="flex items-center">
                      <input
                        type="radio"
                        id={`incident-type-${type}`}
                        name="incidentType"
                        value={type}
                        checked={formData.incidentType === type}
                        onChange={e => setFormData({...formData, incidentType: e.target.value})}
                        className="mr-2"
                        required
                      />
                      <label htmlFor={`incident-type-${type}`}>{type}</label>
                    </div>
                  ))}
                </div>
                
                {formData.incidentType === 'Other' && (
                  <div className="mt-2">
                    <input
                      type="text"
                      value={formData.otherIncidentType}
                      onChange={e => setFormData({...formData, otherIncidentType: e.target.value})}
                      className="w-full p-2 border rounded"
                      placeholder="Please specify incident type"
                      required
                    />
                  </div>
                )}
              </div>
            </div>

            {/* People Involved Section */}
            <div className="border-b pb-6">
              <h2 className="text-lg font-medium mb-4">People Involved</h2>
              
              <div>
                <label className="block mb-1">People Involved</label>
                <textarea
                  value={formData.peopleInvolved}
                  onChange={e => setFormData({...formData, peopleInvolved: e.target.value})}
                  onInput={e => handleTextAreaInput(e, 'people-involved')}
                  className="w-full p-2 border rounded"
                  style={{ 
                    minHeight: '80px',
                    height: textareaHeights['people-involved'] ? `${textareaHeights['people-involved']}px` : 'auto',
                    resize: 'none'
                  }}
                  placeholder="List all people directly involved in the incident (names and roles)"
                  required
                />
              </div>
              
              <div className="mt-4">
                <label className="block mb-1">Witnesses</label>
                <textarea
                  value={formData.witness}
                  onChange={e => setFormData({...formData, witness: e.target.value})}
                  onInput={e => handleTextAreaInput(e, 'witness')}
                  className="w-full p-2 border rounded"
                  style={{ 
                    minHeight: '80px',
                    height: textareaHeights['witness'] ? `${textareaHeights['witness']}px` : 'auto',
                    resize: 'none'
                  }}
                  placeholder="List any witnesses to the incident (names and contact information if available)"
                />
              </div>
            </div>

            {/* Incident Details Section */}
            <div className="border-b pb-6">
              <h2 className="text-lg font-medium mb-4">Incident Details</h2>
              
              <div>
                <label className="block mb-1">Description of Incident</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  onInput={e => handleTextAreaInput(e, 'description')}
                  className="w-full p-2 border rounded"
                  style={{ 
                    minHeight: '100px',
                    height: textareaHeights['description'] ? `${textareaHeights['description']}px` : 'auto',
                    resize: 'none'
                  }}
                  placeholder="Describe in detail what happened"
                  required
                />
              </div>
              
              <div className="mt-4">
                <label className="block mb-1">Cause of Incident</label>
                <textarea
                  value={formData.cause}
                  onChange={e => setFormData({...formData, cause: e.target.value})}
                  onInput={e => handleTextAreaInput(e, 'cause')}
                  className="w-full p-2 border rounded"
                  style={{ 
                    minHeight: '80px',
                    height: textareaHeights['cause'] ? `${textareaHeights['cause']}px` : 'auto',
                    resize: 'none'
                  }}
                  placeholder="What led to this incident? Identify root causes if possible"
                  required
                />
              </div>
              
              <div className="mt-4">
                <label className="block mb-1">Injuries Sustained</label>
                <textarea
                  value={formData.injuries}
                  onChange={e => setFormData({...formData, injuries: e.target.value})}
                  onInput={e => handleTextAreaInput(e, 'injuries')}
                  className="w-full p-2 border rounded"
                  style={{ 
                    minHeight: '80px',
                    height: textareaHeights['injuries'] ? `${textareaHeights['injuries']}px` : 'auto',
                    resize: 'none'
                  }}
                  placeholder="Describe any injuries. If none, write 'None'"
                  required
                />
              </div>
              
              <div className="mt-4">
                <label className="block mb-1">Treatment Provided</label>
                <textarea
                  value={formData.treatment}
                  onChange={e => setFormData({...formData, treatment: e.target.value})}
                  onInput={e => handleTextAreaInput(e, 'treatment')}
                  className="w-full p-2 border rounded"
                  style={{ 
                    minHeight: '80px',
                    height: textareaHeights['treatment'] ? `${textareaHeights['treatment']}px` : 'auto',
                    resize: 'none'
                  }}
                  placeholder="What immediate treatment was provided? Was medical attention sought?"
                />
              </div>
              
              <div className="mt-4">
                <label className="block mb-1">Property/Equipment Damage</label>
                <textarea
                  value={formData.propertyDamage}
                  onChange={e => setFormData({...formData, propertyDamage: e.target.value})}
                  onInput={e => handleTextAreaInput(e, 'property-damage')}
                  className="w-full p-2 border rounded"
                  style={{ 
                    minHeight: '80px',
                    height: textareaHeights['property-damage'] ? `${textareaHeights['property-damage']}px` : 'auto',
                    resize: 'none'
                  }}
                  placeholder="Describe any damage to property or equipment. If none, write 'None'"
                  required
                />
              </div>
            </div>

            {/* Actions Section */}
            <div className="border-b pb-6">
              <h2 className="text-lg font-medium mb-4">Actions Taken</h2>
              
              <div>
                <label className="block mb-1">Immediate Actions Taken</label>
                <textarea
                  value={formData.immediateActions}
                  onChange={e => setFormData({...formData, immediateActions: e.target.value})}
                  onInput={e => handleTextAreaInput(e, 'immediate-actions')}
                  className="w-full p-2 border rounded"
                  style={{ 
                    minHeight: '80px',
                    height: textareaHeights['immediate-actions'] ? `${textareaHeights['immediate-actions']}px` : 'auto',
                    resize: 'none'
                  }}
                  placeholder="What actions were taken immediately after the incident?"
                  required
                />
              </div>
              
              <div className="mt-4">
                <label className="block mb-1">Future Prevention Steps</label>
                <textarea
                  value={formData.futurePreventionSteps}
                  onChange={e => setFormData({...formData, futurePreventionSteps: e.target.value})}
                  onInput={e => handleTextAreaInput(e, 'prevention-steps')}
                  className="w-full p-2 border rounded"
                  style={{ 
                    minHeight: '80px',
                    height: textareaHeights['prevention-steps'] ? `${textareaHeights['prevention-steps']}px` : 'auto',
                    resize: 'none'
                  }}
                  placeholder="What steps should be taken to prevent similar incidents in the future?"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block mb-1">Incident Reported To</label>
                  <input
                    type="text"
                    value={formData.reportedTo}
                    onChange={e => setFormData({...formData, reportedTo: e.target.value})}
                    className="w-full p-2 border rounded"
                    placeholder="Person's name and title"
                    required
                  />
                </div>
                
                <div>
                  <label className="block mb-1">Date Reported</label>
                  <input
                    type="date"
                    value={formData.reportedDate}
                    onChange={e => setFormData({...formData, reportedDate: e.target.value})}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Additional Information */}
            <div className="space-y-4">
              <div>
                <label className="block mb-1">Any other notes or relevant information?</label>
                <textarea
                  value={formData.otherNotes}
                  onChange={e => setFormData({...formData, otherNotes: e.target.value})}
                  onInput={e => handleTextAreaInput(e, 'other-notes')}
                  className="w-full p-2 border rounded"
                  style={{ 
                    minHeight: '100px',
                    height: textareaHeights['other-notes'] ? `${textareaHeights['other-notes']}px` : 'auto',
                    resize: 'none'
                  }}
                  placeholder="Any additional information that might be relevant"
                />
              </div>

              <PhotoUploader
                uploadId={uploadId}
                onPhotosChange={handlePhotosChange}
                onLocalFilesChange={handleLocalFilesChange}
                onCaptionsChange={handleCaptionsChange}
              />
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Incident Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}