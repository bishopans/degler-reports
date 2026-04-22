'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import HeicImage from '@/components/HeicImage';
import { isHeicUrl } from '@/lib/heicSupport';
import { generatePdf } from '@/lib/generatePdf';

// Detect HEIC/HEIF files by MIME type or extension
function isHeicFile(file: File): boolean {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return type === 'image/heic' || type === 'image/heif' || name.endsWith('.heic') || name.endsWith('.heif');
}

// Convert HEIC/HEIF file to JPEG using heic2any (loaded dynamically)
async function convertHeicToJpeg(file: File): Promise<File> {
  const heic2any = (await import('heic2any')).default;
  const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
  const resultBlob = Array.isArray(blob) ? blob[0] : blob;
  return new File(
    [resultBlob],
    file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg'),
    { type: 'image/jpeg', lastModified: Date.now() }
  );
}

// Compress an image file using canvas (same as technician-facing forms)
async function compressImage(file: File, maxDimension = 2000, quality = 0.8): Promise<File> {
  return new Promise((resolve) => {
    if (file.size < 500 * 1024) { resolve(file); return; }
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) { height = Math.round((height * maxDimension) / width); width = maxDimension; }
        else { width = Math.round((width * maxDimension) / height); height = maxDimension; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (!blob || blob.size >= file.size) { resolve(file); return; }
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg', lastModified: Date.now() }));
      }, 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

const REPORT_TYPE_LABELS: Record<string, string> = {
  'maintenance': 'Preventative Maintenance/Inspection',
  'repair': 'Repair',
  'material-delivery': 'Material Delivery',
  'material-turnover': 'Material Turnover',
  'training': 'Training',
  'jobsite-progress': 'Job Site Progress',
  'time-sheets': 'Time Sheets',
  'accident': 'Accident/Incident',
  'photo-upload': 'Photo Upload',
};

// Equipment checklists (mirrored from maintenance form)
const equipmentChecklists: Record<string, string[]> = {
  'Backstops': [
    'Inspect and tighten all building point attachments and fasteners',
    'Inspect and tighten all integral connections',
    'Inspect all welds and frame metals for signs of cracking or weakness',
    'Lubricate all fittings and moving parts where required',
    'Check and adjust all Winch settings, cables and pulleys',
    'Adjust all Backboards to 10\' rim height and square them with the court as needed',
    'Check all Goals for proper height alignment, broken welds and net attachment points',
    'Inspect all electrical motors, wiring and limit switches for proper function',
    'Inspect and test all Safety Straps for fraying belts, proper alignment and function',
    'Inspect and tighten all attachment bolts on board Safety Pads',
    'Overall Inspection of equipment for proper function and to ensure they are safe for everyday use and operation under normal conditions'
  ],
  'Bleachers': [
    'Inspect all building point attachments and correct as needed',
    'Inspect understructure for broken welds and fatigued metal',
    'Inspect and align all row locks and linkage assemblies to the same locking point',
    'Lubricate row locks and all moving parts as needed with White Lithium Grease',
    'Adjust row operating clearance (spacing between rows)',
    'Inspect all wheels and wheel channels for proper operation',
    'Align and adjust all bleachers for proper stacking and operation',
    'Inspect all rollers, drive chains and sprockets',
    'Inspect and clean motors and wiring for proper function (if equipped)',
    'Inspect all remote and pendant controllers for proper function (if equipped)',
    'Inspect the top side aisles/seats/handrails/end rails/deck boards and tighten and adjust as required',
    'Perform overall Inspection of bleachers for safety and everyday use and operation under normal conditions per ICC-300 bleacher standards'
  ],
  'Gym Divider Curtain': [
    'Inspect and tighten all building point attachments and fasteners',
    'Adjust the line shaft for level',
    'Re/spool and center the cable drums or straps (where needed)',
    'Adjust height for 1" clearance under curtain in down position',
    'Inspect all pipe connections (top & bottom Of curtain) and reattach if required',
    'Grease all fittings where required',
    'Adjust Limit Switches',
    'Inspect all electrical motors, wiring switches for proper function',
    'Inspect and test all Safety Straps for fraying belts, proper alignment and function',
    'Overall Inspection of equipment for proper function and to ensure they are safe for everyday use and operation under normal conditions'
  ],
  'Folding Partitions': [
    'Adjust all Doors for Plumb and Level',
    'Check all building point attachments',
    'Check all integral connections and make all necessary repairs',
    'Check and correct all Hinge locations where required',
    'Inspect, Clean and Grease Track',
    'Inspect (CLEAN) and correct floor seal operation',
    'Make a list of any manufactured Parts needed (if any)',
    'Check all pass doors and make all necessary adjustments',
    'Insurer ease of use and safety during normal operation'
  ],
  'Wrestling Mat Hoists': [
    'Inspect and tighten all building point attachments and fasteners',
    'Adjust the load bar for level',
    'Re/spool and center the cable drums (where needed)',
    'Clean reed devices',
    'Inspect all pipe connections (top & bottom Of curtain) and reattach if required',
    'Grease all fittings where required',
    'Adjust Limit Switches',
    'Inspect all electrical motors, wiring switches for proper function',
    'Inspect and test all Safety Straps for fraying belts, proper alignment and function',
    'Overall Inspection of equipment for proper function and to ensure they are safe for everyday use and operation under normal conditions'
  ],
  'Batting Cages': [
    'Inspect and tighten all building point attachments and fasteners',
    'Adjust the cage frame for level',
    'Re/spool and center the cable drums (where needed)',
    'Inspect the netting for holes and note any large gaps needing patching',
    'Inspect all pipe connections (top & bottom Of curtain) and reattach if required',
    'Grease all fittings where required',
    'Adjust Limit Switches',
    'Inspect all electrical motors, wiring switches for proper function',
    'Inspect and test all Safety Straps for fraying belts, proper alignment and function',
    'Overall Inspection of equipment for proper function and to ensure they are safe for everyday use and operation under normal conditions'
  ],
  'Outdoor Bleachers/Grandstands': [
    'Provide an Inspection of the Home and Visitors Sections & Press Box or any other Outdoor Bleachers per ICC-300 Code Standards',
    'Inspect all structural connections / walkways / kickboards / seat benches',
    'Inspect all welds, bolted connections and frame metals for signs of rust, cracking or weakness',
    'Inspect and tighten all loose hardware, nuts, bolts, screws, etc., throughout entire structure including all aisle & barrier railings, seat & riser planks and kick boards',
    'Inspect all seat planks, riser planks and kickboards for any damage, excessive bowing and deflection',
    'Inspect and replace any missing nuts, bolts, screws, rivets and seat clips (if possible)',
    'Check all safety fencing at sides, rear and along the front edge of structure for any gaps exceeding 4" per code',
    'Check and inspect all aisle railings and front, side & rear barriers for any gaps exceeding 4" per code',
    'Confirm that all side barrier railings extend to 42" high from the leading edge of the walking deck per code',
    'Confirm that all rear barrier railings extend to 42" high from the top row seat bench per code',
    'Confirm that all front barrier railings extend to 36" high from the surface of the 1st row walking deck per code',
    'Inspect all understructure, including all anchor points at concrete foundation',
    'Confirm that all points on grandstands or outdoor bleachers greater than 30" in height has fencing, railings, or barriers installed per code (4" gap rule also applies)',
    'Overall inspection of grandstands and outdoor bleachers to ensure they are safe for everyday use under normal conditions',
    'Provide a list of any needed parts or recommended repairs; make sure to document location and take pictures'
  ],
  'Scoreboard Equipment': [
    'Inspect and perform general maintenance for safe everyday use',
    'Inspect and tighten as needed all anchor hardware, brackets, and clamps',
    'Inspect all wiring, LEDs, harnesses, and electronics ensuring a proper connection, cleaning any corrosion',
    'Ensure equipment is communicating properly with control systems'
  ],
  'Stage Rigging': [
    'Inspect and Tighten as needed all building Point attachments',
    'Inspect all rope hoists and rope for signs of wear',
    'Inspect all counterbalance floor plates',
    'Grease all fittings where required',
    'Check and adjust all Winch settings, cables, cable clamps',
    'Check all pulleys',
    'Inspect all overhead track, light-bars, support-battens, cleats, and chains'
  ],
  'Cafeteria Tables/Benches': [
    'Check all hardware and tighten where required',
    'Ensure proper operation of all Gas Springs',
    'Ensure proper operation of all locking mechanisms on tables and benches',
    'Check wall pockets for fatigued metal, damaged locking channels, wall anchors',
    'Check all tables tops and benches for loose border stripping and damage',
    'Check all wheels and axels to ensure proper operation',
    'Check all floor protection pads are present on table/bench legs',
    'Check frames for any broken welds or damaged components'
  ],
  'Climbing Ropes/Volleyball/Gymnastics': [
    'Tighten all upper structure clamps or fasteners',
    'Inspect all hardware and connections, tighten/replace as needed',
    'Lubricate as required',
    'Inspect all cables and pulleys and foundation structures for signs of fatigue',
    'Ensure equipment is safe for everyday use and operation under normal conditions'
  ],
};

const ALL_EQUIPMENT_TYPES = [
  'Backstops',
  'Bleachers',
  'Gym Divider Curtain',
  'Folding Partitions',
  'Wrestling Mat Hoists',
  'Batting Cages',
  'Outdoor Bleachers/Grandstands',
  'Scoreboard Equipment',
  'Stage Rigging',
  'Cafeteria Tables/Benches',
  'Climbing Ropes/Volleyball/Gymnastics',
  'Other',
];

interface Submission {
  id: string;
  created_at: string;
  updated_at: string;
  report_type: string;
  date: string;
  job_name: string;
  job_number: string;
  technician_name: string;
  form_data: Record<string, unknown>;
  photo_urls: string[];
  signature_urls: string[];
  status: string;
  notes: string | null;
  edited_by: string | null;
  edited_at: string | null;
  claimed_by: string | null;
}

export default function ReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [editData, setEditData] = useState<Submission | null>(null);
  const [isConvertingHeic, setIsConvertingHeic] = useState(false);
  const heicConvertedRef = useRef(false);

  // Auto-convert any HEIC photos to JPEG permanently in Supabase
  const convertHeicPhotos = useCallback(async (sub: Submission) => {
    if (heicConvertedRef.current) return;
    if (!sub.photo_urls?.length) return;

    const heicUrls = sub.photo_urls.filter(url => isHeicUrl(url));
    if (heicUrls.length === 0) return;

    heicConvertedRef.current = true;
    setIsConvertingHeic(true);
    console.log(`Converting ${heicUrls.length} HEIC photo(s) to JPEG...`);

    try {
      const heic2any = (await import('heic2any')).default;
      const newPhotoUrls = [...sub.photo_urls];
      const captions = (sub.form_data as Record<string, Record<string, string>>)?.photo_captions || {};
      const newCaptions = { ...captions };
      let changed = false;

      for (const heicUrl of heicUrls) {
        try {
          // Fetch the HEIC file from Supabase
          const resp = await fetch(heicUrl);
          if (!resp.ok) continue;
          const heicBlob = await resp.blob();

          // Convert to JPEG
          const jpegBlob = await heic2any({ blob: heicBlob, toType: 'image/jpeg', quality: 0.92 });
          const result = Array.isArray(jpegBlob) ? jpegBlob[0] : jpegBlob;

          // Compress if needed
          const jpegFile = new File([result], 'converted.jpg', { type: 'image/jpeg' });
          const compressed = await compressImage(jpegFile);

          // Upload the JPEG via existing admin upload endpoint
          const formData = new FormData();
          formData.append('submission_id', sub.id);
          formData.append('photo', compressed);

          const uploadResp = await fetch('/api/admin/upload-photo', {
            method: 'POST',
            body: formData,
          });

          if (!uploadResp.ok) continue;
          const uploadResult = await uploadResp.json();

          // The upload-photo endpoint already appends to photo_urls, but we need
          // to replace the old HEIC URL, not append. We'll collect all changes
          // and do a single PATCH at the end.
          const idx = newPhotoUrls.indexOf(heicUrl);
          if (idx !== -1) {
            // Get the newly uploaded URL from the response (it was appended)
            const newUrl = uploadResult.photo_urls?.[uploadResult.photo_urls.length - 1];
            if (newUrl) {
              newPhotoUrls[idx] = newUrl;
              // Move caption to new URL
              if (newCaptions[heicUrl]) {
                newCaptions[newUrl] = newCaptions[heicUrl];
                delete newCaptions[heicUrl];
              }
              // Remove the duplicate that upload-photo appended
              const dupeIdx = newPhotoUrls.lastIndexOf(newUrl);
              if (dupeIdx !== idx && dupeIdx !== -1) {
                newPhotoUrls.splice(dupeIdx, 1);
              }
              changed = true;
            }
          }
        } catch (err) {
          console.warn('Failed to convert HEIC photo:', heicUrl, err);
        }
      }

      if (changed) {
        // PATCH the submission with cleaned-up photo_urls (HEIC replaced with JPEG)
        const patchResp = await fetch(`/api/admin/submissions/${sub.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            photo_urls: newPhotoUrls,
            form_data: { ...sub.form_data, photo_captions: newCaptions },
          }),
        });

        if (patchResp.ok) {
          const updated = await patchResp.json();
          setSubmission(updated);
          setEditData(updated);
          console.log('HEIC photos permanently converted to JPEG.');
        }
      }
    } catch (err) {
      console.error('HEIC auto-conversion error:', err);
    } finally {
      setIsConvertingHeic(false);
    }
  }, [id]);

  useEffect(() => {
    const unlocked = sessionStorage.getItem('dw-admin-unlocked');
    if (unlocked !== 'true') {
      router.push('/admin');
      return;
    }
    fetchSubmission();
  }, [id]);

  const fetchSubmission = async () => {
    try {
      const response = await fetch(`/api/admin/submissions/${id}`);
      if (response.ok) {
        const data = await response.json();
        setSubmission(data);
        setEditData(data);
        // Auto-convert HEIC photos in background
        convertHeicPhotos(data);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editData) return;
    setIsSaving(true);

    try {
      const response = await fetch(`/api/admin/submissions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_name: editData.job_name,
          job_number: editData.job_number,
          technician_name: editData.technician_name,
          date: editData.date,
          status: editData.status,
          form_data: editData.form_data,
          notes: editData.notes,
          claimed_by: editData.claimed_by,
        }),
      });

      if (response.ok) {
        const updated = await response.json();
        setSubmission(updated);
        setEditData(updated);
        setIsEditing(false);
        alert('Report saved successfully!');
      } else {
        alert('Failed to save changes.');
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Error saving changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditData(submission);
    setIsEditing(false);
  };

  const handlePdf = async () => {
    if (!submission) return;
    setIsGeneratingPdf(true);
    try {
      await generatePdf(submission);

      // Auto-update status to 'submitted' if currently 'new'
      if (submission.status === 'new') {
        try {
          const response = await fetch(`/api/admin/submissions/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'submitted' }),
          });
          if (response.ok) {
            const updated = await response.json();
            setSubmission(updated);
            setEditData(updated);
          }
        } catch (statusError) {
          console.error('Failed to update status:', statusError);
        }
      }
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const updateFormData = (key: string, value: unknown) => {
    setEditData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        form_data: { ...prev.form_data, [key]: value },
      };
    });
  };

  const handleDeleteReport = async () => {
    if (!window.confirm('Are you sure you want to delete this report? It will be moved to the Deleted section and permanently removed after 30 days.')) {
      return;
    }
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/submissions/${id}`, { method: 'DELETE' });
      if (response.ok) {
        alert('Report deleted successfully.');
        router.push('/admin');
      } else {
        alert('Failed to delete report.');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Error deleting report.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeletePhoto = async (photoUrl: string, index: number) => {
    if (!submission) return;
    if (!window.confirm(`Are you sure you want to delete Photo ${index + 1}?`)) return;

    try {
      // Remove from the photo_urls array
      const updatedPhotos = submission.photo_urls.filter((_, i) => i !== index);

      // Try to delete from storage
      const parts = photoUrl.split('/report-photos/');
      if (parts.length > 1) {
        const storagePath = decodeURIComponent(parts[1]);
        await fetch(`/api/admin/submissions/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photo_urls: updatedPhotos }),
        });
      }

      // Update local state
      const updated = { ...submission, photo_urls: updatedPhotos };
      setSubmission(updated);
      setEditData(updated);
    } catch (error) {
      console.error('Photo delete error:', error);
      alert('Error deleting photo.');
    }
  };

  // Core photo upload logic — shared by file input and drag-and-drop
  const uploadPhotoFiles = async (files: File[]) => {
    if (!submission || files.length === 0) return;
    // Filter to only image files
    const imageFiles = files.filter(f => f.type.startsWith('image/') || isHeicFile(f));
    if (imageFiles.length === 0) return;

    setIsUploadingPhoto(true);

    try {
      for (let rawFile of imageFiles) {
        // Convert HEIC/HEIF to JPEG first
        if (isHeicFile(rawFile)) {
          try {
            rawFile = await convertHeicToJpeg(rawFile);
          } catch (err) {
            console.error('HEIC conversion failed:', err);
            alert(`Could not convert ${rawFile.name} from HEIC format. Please try a JPEG or PNG file.`);
            continue;
          }
        }
        const file = await compressImage(rawFile);
        const formData = new window.FormData();
        formData.append('submission_id', id);
        formData.append('photo', file);

        const response = await fetch('/api/admin/upload-photo', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const updated = await response.json();
          setSubmission(updated);
          setEditData(updated);
        } else {
          alert(`Failed to upload ${file.name}`);
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Error uploading photo.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleAddPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await uploadPhotoFiles(Array.from(e.target.files || []));
    e.target.value = '';
  };

  // Drag-and-drop state for admin photo section
  const [isDraggingAdmin, setIsDraggingAdmin] = useState(false);
  const adminDragCounterRef = useRef(0);

  const handleAdminDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    adminDragCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingAdmin(true);
    }
  };

  const handleAdminDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    adminDragCounterRef.current--;
    if (adminDragCounterRef.current === 0) {
      setIsDraggingAdmin(false);
    }
  };

  const handleAdminDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleAdminDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingAdmin(false);
    adminDragCounterRef.current = 0;
    await uploadPhotoFiles(Array.from(e.dataTransfer.files));
  };

  // Visual feedback for paste
  const [pasteNotice, setPasteNotice] = useState<string | null>(null);

  // Photo lightbox state
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Keyboard navigation for photo lightbox
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowLeft' && lightboxIndex > 0) setLightboxIndex(lightboxIndex - 1);
      if (e.key === 'ArrowRight') setLightboxIndex(prev => prev !== null ? prev + 1 : null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex]);

  // Paste handler for admin panel — Ctrl+V / Cmd+V with images on clipboard
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (!submission) return;

      // Don't intercept paste if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      // Check for direct image blobs (from "Copy Image" right-click)
      const imageFiles: File[] = [];
      let hasHtml = false;
      let htmlContent = '';

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            const ext = file.type.split('/')[1] || 'png';
            const named = new File([file], `pasted-photo-${Date.now()}-${i}.${ext}`, {
              type: file.type,
              lastModified: Date.now(),
            });
            imageFiles.push(named);
          }
        } else if (item.type === 'text/html') {
          hasHtml = true;
          htmlContent = await new Promise<string>((resolve) => {
            item.getAsString(resolve);
          });
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        setPasteNotice(`Pasting ${imageFiles.length} photo${imageFiles.length > 1 ? 's' : ''}...`);
        setTimeout(() => setPasteNotice(null), 3000);
        await uploadPhotoFiles(imageFiles);
        return;
      }

      // Check HTML for embedded <img> tags (from email body copy-paste)
      if (hasHtml && htmlContent) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        const imgs = doc.querySelectorAll('img');

        if (imgs.length > 0) {
          e.preventDefault();
          setPasteNotice(`Extracting ${imgs.length} photo${imgs.length > 1 ? 's' : ''} from clipboard...`);

          const extractedFiles: File[] = [];
          for (let i = 0; i < imgs.length; i++) {
            const src = imgs[i].getAttribute('src');
            if (!src) continue;

            try {
              let blob: Blob;
              if (src.startsWith('data:')) {
                const resp = await fetch(src);
                blob = await resp.blob();
              } else if (src.startsWith('http')) {
                const resp = await fetch(src, { mode: 'cors' });
                blob = await resp.blob();
              } else {
                continue;
              }

              if (blob.type.startsWith('image/')) {
                const ext = blob.type.split('/')[1] || 'png';
                const file = new File([blob], `pasted-photo-${Date.now()}-${i}.${ext}`, {
                  type: blob.type,
                  lastModified: Date.now(),
                });
                extractedFiles.push(file);
              }
            } catch {
              console.warn('Could not extract pasted image');
            }
          }

          if (extractedFiles.length > 0) {
            setPasteNotice(`Pasting ${extractedFiles.length} photo${extractedFiles.length > 1 ? 's' : ''}...`);
            setTimeout(() => setPasteNotice(null), 3000);
            await uploadPhotoFiles(extractedFiles);
          } else {
            setPasteNotice('Could not extract images — try "Copy Image" on individual photos');
            setTimeout(() => setPasteNotice(null), 4000);
          }
          return;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [submission]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div style={{ color: '#374151' }}>Loading report...</div>
      </div>
    );
  }

  if (!submission || !editData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white">
        <div className="mb-4" style={{ color: '#374151' }}>Report not found</div>
        <Link href="/admin" className="text-blue-600">← Back to Dashboard</Link>
      </div>
    );
  }

  const data = isEditing ? editData : submission;

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Image src="/images/logo.png" alt="Logo" width={50} height={50} />
          <div>
            <h1 className="text-xl font-bold" style={{ color: '#111827' }}>
              {REPORT_TYPE_LABELS[data.report_type] || data.report_type} Report
            </h1>
            <p className="text-sm" style={{ color: '#4b5563' }}>
              Submitted {new Date(data.created_at).toLocaleString('en-US')}
              {data.edited_at && ` • Last edited ${new Date(data.edited_at).toLocaleString('en-US')}`}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link
            href="/admin"
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#f3f4f6',
              color: '#374151',
              borderRadius: '0.375rem',
              border: '1px solid #d1d5db',
              textDecoration: 'none',
              fontSize: '0.875rem',
            }}
          >
            ← Back
          </Link>

          {!isEditing && (
            <button
              onClick={handlePdf}
              disabled={isGeneratingPdf || isConvertingHeic}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#16a34a',
                color: 'white',
                borderRadius: '0.375rem',
                border: 'none',
                cursor: (isGeneratingPdf || isConvertingHeic) ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
                opacity: (isGeneratingPdf || isConvertingHeic) ? 0.5 : 1,
              }}
            >
              {isConvertingHeic ? 'Converting photos...' : isGeneratingPdf ? 'Generating...' : 'Save to PDF'}
            </button>
          )}

          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#2563eb',
                color: 'white',
                borderRadius: '0.375rem',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              Edit Report
            </button>
          ) : (
            <>
              <button
                onClick={handleCancel}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  borderRadius: '0.375rem',
                  border: '1px solid #d1d5db',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#16a34a',
                  color: 'white',
                  borderRadius: '0.375rem',
                  border: 'none',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  opacity: isSaving ? 0.5 : 1,
                }}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          )}

          <button
            onClick={handleDeleteReport}
            disabled={isDeleting}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#dc2626',
              color: 'white',
              borderRadius: '0.375rem',
              border: 'none',
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
              opacity: isDeleting ? 0.5 : 1,
            }}
          >
            {isDeleting ? 'Deleting...' : 'Delete Report'}
          </button>
        </div>
      </div>

      {/* Common Fields */}
      <div className="bg-white p-4 rounded-lg shadow-sm mb-4">
        <h2 className="font-bold mb-4" style={{ fontSize: '1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem', color: '#111827' }}>Report Information</h2>
        <div className="admin-report-info-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <FieldDisplay
            label={['maintenance','repair','material-delivery','material-turnover','training','jobsite-progress'].includes(data.report_type) ? 'Date of Service' : 'Date'}
            value={data.date}
            isEditing={isEditing}
            type="date"
            onChange={(v) => setEditData({ ...editData, date: v })}
          />
          {data.report_type !== 'time-sheets' && data.report_type !== 'photo-upload' && (
            <FieldDisplay
              label="Job Name"
              value={data.job_name}
              isEditing={isEditing}
              onChange={(v) => setEditData({ ...editData, job_name: v })}
            />
          )}
          {data.report_type === 'photo-upload' && data.job_name && data.job_name !== 'Photo Upload' && (
            <FieldDisplay
              label="Job Name"
              value={data.job_name}
              isEditing={isEditing}
              onChange={(v) => setEditData({ ...editData, job_name: v })}
            />
          )}
          {data.report_type !== 'time-sheets' && data.report_type !== 'photo-upload' && (
            <FieldDisplay
              label="Job Number"
              value={data.job_number}
              isEditing={isEditing}
              onChange={(v) => setEditData({ ...editData, job_number: v })}
            />
          )}
          <FieldDisplay
            label={data.report_type === 'time-sheets' ? 'Name' : data.report_type === 'photo-upload' ? 'Uploaded by' : 'Technician / Installer'}
            value={data.technician_name}
            isEditing={isEditing}
            onChange={(v) => setEditData({ ...editData, technician_name: v })}
          />
          <div>
            <label className="block text-sm mb-1" style={{ color: '#1f2937' }}>Status</label>
            {isEditing ? (
              <select
                value={data.status}
                onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                className="w-full p-2 border rounded"
              >
                <option value="new">New</option>
                <option value="submitted">Submitted</option>
                <option value="reviewed">Reviewed</option>
                <option value="archived">Archived</option>
              </select>
            ) : (
              <span style={{
                display: 'inline-block',
                padding: '0.125rem 0.5rem',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: 500,
                backgroundColor: data.status === 'new' ? '#dbeafe' : data.status === 'reviewed' ? '#dcfce7' : data.status === 'archived' ? '#f3f4f6' : '#fef9c3',
                color: data.status === 'new' ? '#1e40af' : data.status === 'reviewed' ? '#166534' : data.status === 'archived' ? '#374151' : '#854d0e',
              }}>
                {data.status}
              </span>
            )}
          </div>
          <div>
            <label className="block text-sm mb-1" style={{ color: '#1f2937' }}>Claim Report</label>
            <select
              value={submission?.claimed_by || ''}
              onChange={async (e) => {
                const newClaim = e.target.value || null;
                try {
                  const resp = await fetch(`/api/admin/submissions/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ claimed_by: newClaim }),
                  });
                  if (resp.ok) {
                    const updated = await resp.json();
                    setSubmission(updated);
                    setEditData(updated);
                  }
                } catch (err) { console.error('Claim update error:', err); }
              }}
              className="w-full p-2 border rounded"
            >
              <option value="">— Unclaimed —</option>
              <option value="service-north">Service - North</option>
              <option value="service-south">Service - South</option>
              <option value="operations-north">Operations - North</option>
              <option value="operations-south">Operations - South</option>
              <option value="sales">Sales</option>
            </select>
            {submission?.claimed_by === 'sales' && (
              <input
                type="email"
                placeholder="Enter sales rep email..."
                value={(submission?.form_data?.salesClaimEmail as string) || ''}
                onBlur={async (e) => {
                  const email = e.target.value;
                  const updatedFormData = { ...submission.form_data, salesClaimEmail: email };
                  try {
                    const resp = await fetch(`/api/admin/submissions/${id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ form_data: updatedFormData }),
                    });
                    if (resp.ok) {
                      const updated = await resp.json();
                      setSubmission(updated);
                      setEditData(updated);
                    }
                  } catch (err) { console.error('Sales email save error:', err); }
                }}
                onChange={(e) => {
                  const updatedFormData = { ...submission.form_data, salesClaimEmail: e.target.value };
                  setSubmission({ ...submission, form_data: updatedFormData });
                  setEditData({ ...submission, form_data: updatedFormData });
                }}
                className="w-full p-2 border rounded mt-2"
              />
            )}
          </div>
        </div>
      </div>

      {/* Form-Specific Data */}
      <div className="bg-white p-4 rounded-lg shadow-sm mb-4">
        <h2 className="font-bold mb-4" style={{ fontSize: '1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>Report Details</h2>
        <FormDataDisplay
          reportType={data.report_type}
          formData={data.form_data}
          isEditing={isEditing}
          onUpdate={updateFormData}
        />
      </div>

      {/* Admin Comments (included in PDF) */}
      <div className="bg-white p-4 rounded-lg shadow-sm mb-4">
        <h2 className="font-bold mb-4" style={{ fontSize: '1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
          Admin Comments <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#374151' }}>(included in PDF)</span>
        </h2>
        {isEditing ? (
          <textarea
            value={(data.form_data?.adminComments as string) || ''}
            onChange={(e) => {
              const updated = { ...data.form_data, adminComments: e.target.value };
              setEditData({ ...editData, form_data: updated });
            }}
            className="w-full p-2 border rounded"
            style={{ minHeight: '80px' }}
            placeholder="Add comments that will appear in the report PDF..."
          />
        ) : (
          <p className="text-sm" style={{ color: '#1f2937' }}>{(data.form_data?.adminComments as string) || 'No comments yet.'}</p>
        )}
      </div>

      {/* Admin Notes (internal only) */}
      <div className="bg-white p-4 rounded-lg shadow-sm mb-4">
        <h2 className="font-bold mb-4" style={{ fontSize: '1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
          Admin Notes <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#374151' }}>(internal only)</span>
        </h2>
        {isEditing ? (
          <textarea
            value={data.notes || ''}
            onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
            className="w-full p-2 border rounded"
            style={{ minHeight: '80px' }}
            placeholder="Add internal notes about this report..."
          />
        ) : (
          <p className="text-sm" style={{ color: '#1f2937' }}>{data.notes || 'No notes yet.'}</p>
        )}
      </div>

      {/* Recipient Signature */}
      {data.signature_urls && data.signature_urls.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow-sm mb-4">
          <h2 className="font-bold mb-4" style={{ fontSize: '1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
            Recipient Signature
          </h2>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {data.signature_urls.map((url: string, i: number) => (
              <img
                key={i}
                src={url}
                alt={`Recipient Signature ${i + 1}`}
                style={{
                  maxWidth: '300px',
                  height: 'auto',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  padding: '0.5rem',
                  backgroundColor: 'white',
                }}
              />
            ))}
          </div>
          <p style={{ fontSize: '0.75rem', color: '#374151', fontStyle: 'italic', marginTop: '0.75rem' }}>
            By signing, the recipient acknowledges receipt of the above-listed materials and assumes full possession and responsibility. Degler Whiting is hereby released from any further liability or obligation regarding said materials from the date of transfer forward.
          </p>
        </div>
      )}

      {/* Photos */}
      <div
        className="bg-white p-4 rounded-lg shadow-sm mb-4"
        onDragEnter={handleAdminDragEnter}
        onDragLeave={handleAdminDragLeave}
        onDragOver={handleAdminDragOver}
        onDrop={handleAdminDrop}
        style={{
          border: isDraggingAdmin ? '2px dashed #2563eb' : '1px solid transparent',
          background: isDraggingAdmin ? '#eff6ff' : 'white',
          transition: 'border 0.2s, background 0.2s',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
          <h2 className="font-bold" style={{ fontSize: '1rem', color: '#111827' }}>
            Photos ({data.photo_urls?.length || 0})
            {isConvertingHeic && (
              <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#2563eb', marginLeft: '0.5rem' }}>
                Converting HEIC photos...
              </span>
            )}
          </h2>
          <label style={{
            padding: '0.375rem 0.75rem',
            backgroundColor: '#2563eb',
            color: 'white',
            borderRadius: '0.375rem',
            cursor: isUploadingPhoto ? 'not-allowed' : 'pointer',
            fontSize: '0.8rem',
            fontWeight: 500,
            opacity: isUploadingPhoto ? 0.5 : 1,
          }}>
            {isUploadingPhoto ? 'Uploading...' : '+ Add Photos'}
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleAddPhoto}
              disabled={isUploadingPhoto}
              style={{ display: 'none' }}
            />
          </label>
        </div>
        {isDraggingAdmin && (
          <div style={{
            textAlign: 'center',
            padding: '1rem',
            color: '#2563eb',
            fontWeight: 600,
            fontSize: '0.9rem',
          }}>
            Drop photos here to upload
          </div>
        )}
        {pasteNotice && (
          <div style={{
            padding: '0.5rem 0.75rem',
            marginBottom: '0.75rem',
            backgroundColor: '#dbeafe',
            color: '#1e40af',
            borderRadius: '0.5rem',
            fontSize: '0.85rem',
            fontWeight: 500,
            textAlign: 'center',
          }}>
            {pasteNotice}
          </div>
        )}
        {data.photo_urls && data.photo_urls.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            {data.photo_urls.map((url, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <div onClick={() => setLightboxIndex(i)} style={{ cursor: 'pointer' }}>
                  <HeicImage
                    src={url}
                    alt={`Photo ${i + 1}`}
                    style={{
                      width: '100%',
                      height: '200px',
                      objectFit: 'cover',
                      borderRadius: '0.5rem',
                      border: '1px solid #e5e7eb',
                    }}
                  />
                </div>
                <button
                  onClick={() => handleDeletePhoto(url, i)}
                  style={{
                    position: 'absolute',
                    top: '0.375rem',
                    right: '0.375rem',
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(220, 38, 38, 0.9)',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 1,
                  }}
                  title={`Delete Photo ${i + 1}`}
                >
                  ×
                </button>
                <p style={{
                  textAlign: 'center', fontSize: '0.7rem', marginTop: '0.25rem',
                  color: '#374151',
                }}>
                  Photo {i + 1}
                </p>
                {isEditing ? (
                  <input
                    type="text"
                    value={(editData?.form_data as Record<string, Record<string, string>>)?.photo_captions?.[url] || ''}
                    placeholder="Add caption..."
                    onChange={(e) => {
                      if (!editData) return;
                      const currentCaptions = ((editData.form_data as Record<string, Record<string, string>>)?.photo_captions) || {};
                      const updatedCaptions = { ...currentCaptions, [url]: e.target.value };
                      setEditData({
                        ...editData,
                        form_data: { ...editData.form_data, photo_captions: updatedCaptions },
                      });
                    }}
                    style={{
                      width: '100%',
                      fontSize: '0.75rem',
                      padding: '0.25rem 0.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.25rem',
                      textAlign: 'center',
                      marginTop: '0.125rem',
                    }}
                  />
                ) : (
                  (data.form_data as Record<string, Record<string, string>>)?.photo_captions?.[url] ? (
                    <p style={{
                      textAlign: 'center', fontSize: '0.75rem', marginTop: '0.125rem',
                      color: '#374151', fontWeight: 500, fontStyle: 'italic',
                    }}>
                      {(data.form_data as Record<string, Record<string, string>>)?.photo_captions?.[url]}
                    </p>
                  ) : null
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm" style={{ color: '#374151' }}>No photos uploaded yet.</p>
        )}
      </div>

      {/* Photo Lightbox Modal */}
      {lightboxIndex !== null && data.photo_urls && lightboxIndex < data.photo_urls.length && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setLightboxIndex(null)}
        >
          {/* Close button */}
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxIndex(null); }}
            style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1.5rem',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10001,
            }}
            title="Close"
          >
            \u00d7
          </button>
          {/* Previous arrow */}
          {lightboxIndex > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
              style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1.5rem',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10001,
              }}
              title="Previous photo"
            >
              \u2039
            </button>
          )}
          {/* Next arrow */}
          {lightboxIndex < data.photo_urls.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
              style={{
                position: 'absolute',
                right: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1.5rem',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10001,
              }}
              title="Next photo"
            >
              \u203a
            </button>
          )}
          {/* Photo counter */}
          <div style={{
            position: 'absolute',
            bottom: '1rem',
            left: '50%',
            transform: 'translateX(-50%)',
            color: 'white',
            fontSize: '0.875rem',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            padding: '0.25rem 0.75rem',
            borderRadius: '1rem',
          }}>
            {lightboxIndex + 1} / {data.photo_urls.length}
          </div>
          {/* Main image */}
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '85vh' }}>
            <HeicImage
              src={data.photo_urls[lightboxIndex]}
              alt={`Photo ${lightboxIndex + 1}`}
              style={{
                maxWidth: '90vw',
                maxHeight: '85vh',
                objectFit: 'contain',
                borderRadius: '0.5rem',
              }}
            />
          </div>
        </div>
      )}

    </div>
  );
}

// Reusable field display/edit component
function FieldDisplay({
  label, value, isEditing, type = 'text', onChange
}: {
  label: string;
  value: string;
  isEditing: boolean;
  type?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
      <label className="text-sm font-bold" style={{ minWidth: '110px', flexShrink: 0, color: '#374151' }}>{label}:</label>
      {isEditing ? (
        <input
          type={type}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="p-2 border rounded"
          style={{ flex: 1 }}
        />
      ) : (
        <p className="text-sm" style={{ color: '#1f2937' }}>{type === 'date' ? new Date(value + 'T00:00:00').toLocaleDateString('en-US') : value}</p>
      )}
    </div>
  );
}

// Renders form-specific fields based on report type
function FormDataDisplay({
  reportType, formData, isEditing, onUpdate
}: {
  reportType: string;
  formData: Record<string, unknown>;
  isEditing: boolean;
  onUpdate: (key: string, value: unknown) => void;
}) {
  // Keys that hold date values (YYYY-MM-DD format)
  const dateFieldKeys = ['incidentDate', 'reportedDate', 'estimatedCompletionDate'];

  // Helper to render a text field from form_data
  const renderTextField = (key: string, label: string) => {
    const value = (formData[key] as string) || '';
    const isDateField = dateFieldKeys.includes(key);
    const displayValue = isDateField && value
      ? new Date(value + 'T00:00:00').toLocaleDateString('en-US')
      : value;
    return (
      <div key={key} style={{ marginBottom: '1rem' }}>
        <label className="block text-sm mb-1" style={{ color: '#1f2937' }}>{label}</label>
        {isEditing ? (
          isDateField ? (
            <input
              type="date"
              value={value}
              onChange={(e) => onUpdate(key, e.target.value)}
              className="w-full p-2 border rounded"
            />
          ) : (
            <textarea
              value={value}
              onChange={(e) => onUpdate(key, e.target.value)}
              className="w-full p-2 border rounded"
              style={{ minHeight: '60px' }}
            />
          )
        ) : (
          <p className="text-sm" style={{ whiteSpace: 'pre-wrap', color: '#1f2937' }}>{displayValue || '—'}</p>
        )}
      </div>
    );
  };

  // Helper to render a list/array from form_data
  const renderArrayField = (key: string, label: string) => {
    const value = (formData[key] as string[]) || [];
    return (
      <div key={key} style={{ marginBottom: '1rem' }}>
        <label className="block text-sm mb-1" style={{ color: '#1f2937' }}>{label}</label>
        {value.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
            {value.map((item, i) => (
              <span key={i} style={{
                display: 'inline-block',
                padding: '0.125rem 0.5rem',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                backgroundColor: '#eff6ff',
                color: '#1e40af',
                border: '1px solid #bfdbfe',
              }}>
                {item}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm" style={{ color: '#374151' }}>None</p>
        )}
      </div>
    );
  };

  // Helper to render key-value record (e.g., repairSummaries per equipment)
  const renderRecordField = (key: string, label: string) => {
    const record = (formData[key] as Record<string, string>) || {};
    const entries = Object.entries(record).filter(([, v]) => v && v.trim());
    if (entries.length === 0) return null;

    return (
      <div key={key} style={{ marginBottom: '1rem' }}>
        <label className="block text-sm mb-1 font-medium" style={{ color: '#111827' }}>{label}</label>
        {entries.map(([equipKey, val]) => (
          <div key={equipKey} style={{ marginBottom: '0.5rem', paddingLeft: '0.75rem', borderLeft: '2px solid #dbeafe' }}>
            <span className="text-sm font-medium">{equipKey}:</span>
            {isEditing ? (
              <textarea
                value={val}
                onChange={(e) => {
                  const updated = { ...record, [equipKey]: e.target.value };
                  onUpdate(key, updated);
                }}
                className="w-full p-2 border rounded mt-1"
                style={{ minHeight: '40px' }}
              />
            ) : (
              <p className="text-sm" style={{ whiteSpace: 'pre-wrap', color: '#1f2937' }}>{val}</p>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Render based on report type
  switch (reportType) {
    case 'maintenance': {
      const selectedEquip = (formData.selectedEquipment as string[]) || [];
      const checks = (formData.equipmentChecks as Record<string, boolean[]>) || {};
      const repairs = (formData.additionalRepairs as Record<string, string>) || {};
      const futureParts = (formData.futurePartsNeeded as Record<string, string>) || {};
      const maintEquipSafe = (formData.equipmentSafe as Record<string, string>) || {};
      const bleacherData = formData.outdoorBleacherData as Record<string, string> | undefined;
      const bleacherLabels: Record<string, string> = {
        location: 'Location of Outdoor Bleachers',
        manufacturer: 'Manufacturer',
        height: 'Height of Bleachers/Grandstands',
        length: 'Length of Bleachers/Grandstands',
        meetCode: 'Do Bleachers Meet Current Code?',
        codeIssues: 'Code Issues Found',
      };

      const toggleEquipment = (equip: string) => {
        const current = [...selectedEquip];
        const idx = current.indexOf(equip);
        if (idx >= 0) {
          // Remove equipment and clean up associated data
          current.splice(idx, 1);
          const updatedChecks = { ...checks };
          delete updatedChecks[equip];
          const updatedRepairs = { ...repairs };
          delete updatedRepairs[equip];
          if (equip === 'Other') {
            delete updatedRepairs['Other-Equipment'];
            delete updatedRepairs['Other-Tasks'];
          }
          const updatedFutureParts = { ...futureParts };
          delete updatedFutureParts[equip];
          const updatedSafe = { ...maintEquipSafe };
          delete updatedSafe[equip];
          onUpdate('selectedEquipment', current);
          onUpdate('equipmentChecks', updatedChecks);
          onUpdate('additionalRepairs', updatedRepairs);
          onUpdate('futurePartsNeeded', updatedFutureParts);
          onUpdate('equipmentSafe', updatedSafe);
        } else {
          // Add equipment and initialize its checklist
          current.push(equip);
          onUpdate('selectedEquipment', current);
          if (equip !== 'Other' && equipmentChecklists[equip]) {
            const updatedChecks = { ...checks };
            updatedChecks[equip] = Array(equipmentChecklists[equip].length).fill(true);
            onUpdate('equipmentChecks', updatedChecks);
          }
        }
      };

      return (
        <div>
          {/* Editable Equipment Selection */}
          <div style={{ marginBottom: '1rem' }}>
            <label className="block text-sm mb-1" style={{ color: '#1f2937' }}>Equipment Inspected</label>
            {isEditing ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                {ALL_EQUIPMENT_TYPES.map((equip) => {
                  const isSelected = selectedEquip.includes(equip);
                  return (
                    <button
                      key={equip}
                      type="button"
                      onClick={() => toggleEquipment(equip)}
                      style={{
                        padding: '0.5rem',
                        border: isSelected ? '2px solid #2563eb' : '2px solid #e5e7eb',
                        borderRadius: '0.5rem',
                        backgroundColor: isSelected ? '#eff6ff' : '#fff',
                        color: isSelected ? '#1e40af' : '#374151',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        textAlign: 'center',
                        minHeight: '2.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {equip}
                    </button>
                  );
                })}
              </div>
            ) : (
              selectedEquip.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                  {selectedEquip.map((item, i) => (
                    <span key={i} style={{
                      display: 'inline-block',
                      padding: '0.125rem 0.5rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      backgroundColor: '#eff6ff',
                      color: '#1e40af',
                      border: '1px solid #bfdbfe',
                    }}>
                      {item}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm" style={{ color: '#374151' }}>None</p>
              )
            )}
          </div>

          {/* Equipment Checklists */}
          {selectedEquip.filter(e => e !== 'Other').map((equipment) => {
            const checklistItems = equipmentChecklists[equipment] || [];
            const equipChecks = checks[equipment] || [];
            if (checklistItems.length === 0 && equipChecks.length === 0) return null;

            return (
              <div key={`checklist-${equipment}`} style={{ marginBottom: '1.5rem', padding: '0.75rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                <label className="block text-sm mb-2 font-medium" style={{ color: '#111827' }}>{equipment} — Checklist</label>
                {checklistItems.map((item, idx) => {
                  const checked = equipChecks[idx] ?? false;
                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.375rem' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!isEditing}
                        onChange={() => {
                          if (!isEditing) return;
                          const updated = { ...checks };
                          updated[equipment] = [...(updated[equipment] || [])];
                          updated[equipment][idx] = !checked;
                          onUpdate('equipmentChecks', updated);
                        }}
                        style={{ marginTop: '3px', accentColor: '#16a34a' }}
                      />
                      <span className="text-sm" style={{ color: checked ? '#111' : '#6b7280' }}>{item}</span>
                    </div>
                  );
                })}

                {/* Repairs for this equipment */}
                {equipment !== 'Other' && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <label className="block text-xs mb-1" style={{ color: '#1f2937' }}>Repairs Made During This Service:</label>
                    {isEditing ? (
                      <textarea
                        value={repairs[equipment] || ''}
                        onChange={(e) => {
                          const updated = { ...repairs, [equipment]: e.target.value };
                          onUpdate('additionalRepairs', updated);
                        }}
                        className="w-full p-2 border rounded"
                        style={{ minHeight: '40px' }}
                      />
                    ) : (
                      <p className="text-sm" style={{ whiteSpace: 'pre-wrap', color: '#1f2937' }}>{repairs[equipment] || '—'}</p>
                    )}
                  </div>
                )}

                {/* Future parts for this equipment */}
                {equipment !== 'Other' && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <label className="block text-xs mb-1" style={{ color: '#1f2937' }}>Future Parts or Service Needed:</label>
                    {isEditing ? (
                      <textarea
                        value={futureParts[equipment] || ''}
                        onChange={(e) => {
                          const updated = { ...futureParts, [equipment]: e.target.value };
                          onUpdate('futurePartsNeeded', updated);
                        }}
                        className="w-full p-2 border rounded"
                        style={{ minHeight: '40px' }}
                      />
                    ) : (
                      <p className="text-sm" style={{ whiteSpace: 'pre-wrap', color: '#1f2937' }}>{futureParts[equipment] || '—'}</p>
                    )}
                  </div>
                )}

                {/* Equipment Safe for Use */}
                {(maintEquipSafe[equipment] || isEditing) && (
                  <div style={{ marginTop: '0.5rem', paddingLeft: '0.5rem' }}>
                    <span className="text-xs font-medium" style={{ color: '#111827' }}>Equipment Safe for Use</span>
                    {isEditing ? (
                      <select
                        value={maintEquipSafe[equipment] || ''}
                        onChange={(e) => onUpdate('equipmentSafe', { ...maintEquipSafe, [equipment]: e.target.value })}
                        className="w-full p-2 border rounded mt-1"
                      >
                        <option value="">—</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    ) : (
                      <p className="text-sm" style={{ color: maintEquipSafe[equipment] === 'No' ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                        {maintEquipSafe[equipment] === 'Yes' ? '✅ ' : maintEquipSafe[equipment] === 'No' ? '❌ ' : ''}{maintEquipSafe[equipment]}
                      </p>
                    )}
                  </div>
                )}

                {/* Outdoor Bleacher Details — inline with its checklist */}
                {equipment === 'Outdoor Bleachers/Grandstands' && bleacherData && (
                  <div style={{ marginTop: '0.75rem', padding: '0.75rem', backgroundColor: '#f0f9ff', borderRadius: '0.5rem' }}>
                    <label className="block text-sm mb-2 font-medium" style={{ color: '#111827' }}>Outdoor Bleacher Details</label>
                    {Object.entries(bleacherLabels).map(([key, label]) => {
                      const val = bleacherData[key] || '';
                      if (!val && !isEditing) return null;
                      return (
                        <div key={key} style={{ marginBottom: '0.5rem' }}>
                          <label className="block text-xs mb-1" style={{ color: '#1f2937' }}>{label}:</label>
                          {isEditing ? (
                            key === 'codeIssues' ? (
                              <textarea
                                value={val}
                                onChange={(e) => {
                                  const updated = { ...bleacherData, [key]: e.target.value };
                                  onUpdate('outdoorBleacherData', updated);
                                }}
                                className="w-full p-2 border rounded"
                                style={{ minHeight: '40px' }}
                              />
                            ) : (
                              <input
                                type="text"
                                value={val}
                                onChange={(e) => {
                                  const updated = { ...bleacherData, [key]: e.target.value };
                                  onUpdate('outdoorBleacherData', updated);
                                }}
                                className="w-full p-2 border rounded"
                              />
                            )
                          ) : (
                            <p className="text-sm" style={{ color: '#1f2937' }}>{val || '—'}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Other Equipment section */}
          {selectedEquip.includes('Other') && (
            <div style={{ marginBottom: '1.5rem', padding: '0.75rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
              <label className="block text-sm mb-2 font-medium" style={{ color: '#111827' }}>Other Equipment</label>

              <div style={{ marginBottom: '0.5rem' }}>
                <label className="block text-xs mb-1" style={{ color: '#1f2937' }}>Equipment Serviced:</label>
                {isEditing ? (
                  <textarea
                    value={repairs['Other-Equipment'] || ''}
                    onChange={(e) => {
                      const updated = { ...repairs, ['Other-Equipment']: e.target.value };
                      onUpdate('additionalRepairs', updated);
                    }}
                    className="w-full p-2 border rounded"
                    style={{ minHeight: '40px' }}
                  />
                ) : (
                  <p className="text-sm" style={{ whiteSpace: 'pre-wrap', color: '#1f2937' }}>{repairs['Other-Equipment'] || '—'}</p>
                )}
              </div>

              <div style={{ marginBottom: '0.5rem' }}>
                <label className="block text-xs mb-1" style={{ color: '#1f2937' }}>Tasks Performed:</label>
                {isEditing ? (
                  <textarea
                    value={repairs['Other-Tasks'] || ''}
                    onChange={(e) => {
                      const updated = { ...repairs, ['Other-Tasks']: e.target.value };
                      onUpdate('additionalRepairs', updated);
                    }}
                    className="w-full p-2 border rounded"
                    style={{ minHeight: '40px' }}
                  />
                ) : (
                  <p className="text-sm" style={{ whiteSpace: 'pre-wrap', color: '#1f2937' }}>{repairs['Other-Tasks'] || '—'}</p>
                )}
              </div>

              <div style={{ marginBottom: '0.5rem' }}>
                <label className="block text-xs mb-1" style={{ color: '#1f2937' }}>Future Parts or Service Needed:</label>
                {isEditing ? (
                  <textarea
                    value={futureParts['Other'] || ''}
                    onChange={(e) => {
                      const updated = { ...futureParts, ['Other']: e.target.value };
                      onUpdate('futurePartsNeeded', updated);
                    }}
                    className="w-full p-2 border rounded"
                    style={{ minHeight: '40px' }}
                  />
                ) : (
                  <p className="text-sm" style={{ whiteSpace: 'pre-wrap', color: '#1f2937' }}>{futureParts['Other'] || '—'}</p>
                )}
              </div>

              {/* Equipment Safe for Use — Other */}
              {(maintEquipSafe['Other'] || isEditing) && (
                <div style={{ marginTop: '0.5rem', paddingLeft: '0.5rem' }}>
                  <span className="text-xs font-medium" style={{ color: '#111827' }}>Equipment Safe for Use</span>
                  {isEditing ? (
                    <select
                      value={maintEquipSafe['Other'] || ''}
                      onChange={(e) => onUpdate('equipmentSafe', { ...maintEquipSafe, ['Other']: e.target.value })}
                      className="w-full p-2 border rounded mt-1"
                    >
                      <option value="">—</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  ) : (
                    <p className="text-sm" style={{ color: maintEquipSafe['Other'] === 'No' ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                      {maintEquipSafe['Other'] === 'Yes' ? '✅ ' : maintEquipSafe['Other'] === 'No' ? '❌ ' : ''}{maintEquipSafe['Other']}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {renderTextField('equipmentTurnover', 'Equipment Turnover')}
          {renderTextField('otherNotes', 'Other Notes')}
        </div>
      );
    }

    case 'repair': {
      const selectedEquipment = (formData.selectedEquipment as string[]) || [];
      const initialProblems = (formData.initialProblems as Record<string, string>) || {};
      const repairSummaries = (formData.repairSummaries as Record<string, string>) || {};
      const partsNeeded = (formData.partsNeeded as Record<string, string>) || {};
      const equipmentSafe = (formData.equipmentSafe as Record<string, string>) || {};

      const toggleRepairEquipment = (equip: string) => {
        const current = [...selectedEquipment];
        const idx = current.indexOf(equip);
        if (idx >= 0) {
          // Remove equipment and clean up associated data
          current.splice(idx, 1);
          const updatedProblems = { ...initialProblems };
          delete updatedProblems[equip];
          const updatedSummaries = { ...repairSummaries };
          delete updatedSummaries[equip];
          const updatedParts = { ...partsNeeded };
          delete updatedParts[equip];
          const updatedSafe = { ...equipmentSafe };
          delete updatedSafe[equip];
          onUpdate('selectedEquipment', current);
          onUpdate('initialProblems', updatedProblems);
          onUpdate('repairSummaries', updatedSummaries);
          onUpdate('partsNeeded', updatedParts);
          onUpdate('equipmentSafe', updatedSafe);
        } else {
          current.push(equip);
          onUpdate('selectedEquipment', current);
        }
      };

      return (
        <div>
          {/* Editable Equipment Selection */}
          <div style={{ marginBottom: '1rem' }}>
            <label className="block text-sm mb-2 font-medium" style={{ color: '#111827' }}>Equipment Serviced</label>
            {isEditing ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
                {ALL_EQUIPMENT_TYPES.map((equip) => {
                  const isSelected = selectedEquipment.includes(equip);
                  return (
                    <button
                      key={equip}
                      type="button"
                      onClick={() => toggleRepairEquipment(equip)}
                      style={{
                        padding: '0.5rem',
                        border: isSelected ? '2px solid #2563eb' : '2px solid #e5e7eb',
                        borderRadius: '0.5rem',
                        backgroundColor: isSelected ? '#eff6ff' : '#fff',
                        color: isSelected ? '#1e40af' : '#374151',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        textAlign: 'center',
                        minHeight: '2.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {equip}
                    </button>
                  );
                })}
              </div>
            ) : (
              selectedEquipment.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '1rem' }}>
                  {selectedEquipment.map((item, i) => (
                    <span key={i} style={{
                      display: 'inline-block',
                      padding: '0.125rem 0.5rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      backgroundColor: '#eff6ff',
                      color: '#1e40af',
                      border: '1px solid #bfdbfe',
                    }}>
                      {item}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm mb-1" style={{ color: '#374151' }}>None</p>
              )
            )}
          </div>

          {/* Equipment detail cards */}
          {selectedEquipment.map((equip: string) => (
            <div key={equip} style={{ marginBottom: '1.25rem', padding: '0.75rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem', borderLeft: '3px solid #2563eb' }}>
              <div className="font-semibold text-sm mb-2" style={{ color: '#1e40af' }}>{equip}</div>

              {(initialProblems[equip]?.trim() || isEditing) && (
                <div style={{ marginBottom: '0.5rem', paddingLeft: '0.5rem' }}>
                  <span className="text-xs font-medium" style={{ color: '#111827' }}>Initial Problem</span>
                  {isEditing ? (
                    <textarea
                      value={initialProblems[equip] || ''}
                      onChange={(e) => onUpdate('initialProblems', { ...initialProblems, [equip]: e.target.value })}
                      className="w-full p-2 border rounded mt-1"
                      style={{ minHeight: '40px' }}
                    />
                  ) : (
                    <p className="text-sm" style={{ whiteSpace: 'pre-wrap', color: '#1f2937' }}>{initialProblems[equip]}</p>
                  )}
                </div>
              )}

              {(repairSummaries[equip]?.trim() || isEditing) && (
                <div style={{ marginBottom: '0.5rem', paddingLeft: '0.5rem' }}>
                  <span className="text-xs font-medium" style={{ color: '#111827' }}>Repairs Made</span>
                  {isEditing ? (
                    <textarea
                      value={repairSummaries[equip] || ''}
                      onChange={(e) => onUpdate('repairSummaries', { ...repairSummaries, [equip]: e.target.value })}
                      className="w-full p-2 border rounded mt-1"
                      style={{ minHeight: '40px' }}
                    />
                  ) : (
                    <p className="text-sm" style={{ whiteSpace: 'pre-wrap', color: '#1f2937' }}>{repairSummaries[equip]}</p>
                  )}
                </div>
              )}

              {(partsNeeded[equip]?.trim() || isEditing) && (
                <div style={{ marginBottom: '0.5rem', paddingLeft: '0.5rem' }}>
                  <span className="text-xs font-medium" style={{ color: '#111827' }}>Future Parts/Service Needed</span>
                  {isEditing ? (
                    <textarea
                      value={partsNeeded[equip] || ''}
                      onChange={(e) => onUpdate('partsNeeded', { ...partsNeeded, [equip]: e.target.value })}
                      className="w-full p-2 border rounded mt-1"
                      style={{ minHeight: '40px' }}
                    />
                  ) : (
                    <p className="text-sm" style={{ whiteSpace: 'pre-wrap', color: '#1f2937' }}>{partsNeeded[equip]}</p>
                  )}
                </div>
              )}

              {(equipmentSafe[equip] || isEditing) && (
                <div style={{ paddingLeft: '0.5rem' }}>
                  <span className="text-xs font-medium" style={{ color: '#111827' }}>Equipment Safe for Use</span>
                  {isEditing ? (
                    <select
                      value={equipmentSafe[equip] || ''}
                      onChange={(e) => onUpdate('equipmentSafe', { ...equipmentSafe, [equip]: e.target.value })}
                      className="w-full p-2 border rounded mt-1"
                    >
                      <option value="">—</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  ) : (
                    <p className="text-sm" style={{ color: equipmentSafe[equip] === 'No' ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                      {equipmentSafe[equip] === 'Yes' ? '✅ ' : equipmentSafe[equip] === 'No' ? '❌ ' : ''}{equipmentSafe[equip]}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
          {renderTextField('equipmentTurnover', 'Equipment Turnover')}
          {renderTextField('otherNotes', 'Other Notes')}
        </div>
      );
    }

    case 'material-delivery':
      return (
        <div>
          {renderTextField('deliveredItems', 'Products Delivered')}
          {renderTextField('storageLocation', 'Storage Location (Room/Area)')}
          {renderTextField('missingItems', 'Missing Items from Shipment')}
        </div>
      );

    case 'material-turnover':
      return (
        <div>
          {renderTextField('turnoverItems', 'Items Turned Over')}
          {renderTextField('recipientName', 'Recipient Name')}
          {renderTextField('recipientType', 'Recipient Is With (GC, Facility Staff, Other)')}
          {(formData.otherSpecification as string) && renderTextField('otherSpecification', 'Other Specification')}
        </div>
      );

    case 'training':
      return (
        <div>
          {renderTextField('attendanceList', 'Attendance List')}
          {renderArrayField('selectedEquipment', 'Equipment Trained')}
          {(formData.otherEquipment as string) && renderTextField('otherEquipment', 'Other Equipment')}
          {renderTextField('equipmentTurnover', 'Equipment Turnover')}
          {renderTextField('notes', 'Notes')}
        </div>
      );

    case 'jobsite-progress':
      return (
        <div>
          {renderTextField('equipment', 'Equipment Being Installed')}
          {renderTextField('notes', 'Progress Notes')}
          {renderTextField('estimatedCompletionDate', 'Estimated Completion Date')}
        </div>
      );

    case 'time-sheets':
      return (
        <div>
          {renderTextField('name', 'Worker Name')}
          {renderTextField('rank', 'Rank')}
          {/* Week Totals — computed from entries, shown above entry breakdown */}
          {formData.entries ? (() => {
            interface HoursByType { foreman: number; regular: number; }
            interface TimesheetTotals { regularHours: HoursByType; overtimeHours: HoursByType; doubleHours: HoursByType; miles: number; expenses: number; }
            const entries = formData.entries as Array<Record<string, unknown>>;
            const totals = entries.reduce<TimesheetTotals>((acc, entry) => {
              const type: keyof HoursByType = entry.isForeman ? 'foreman' : 'regular';
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
            }, {
              regularHours: { foreman: 0, regular: 0 },
              overtimeHours: { foreman: 0, regular: 0 },
              doubleHours: { foreman: 0, regular: 0 },
              miles: 0,
              expenses: 0
            });

            return (
              <div style={{ padding: '1rem', backgroundColor: '#f0fdf4', borderRadius: '0.5rem', marginTop: '0.5rem' }}>
                <label className="block text-sm font-bold mb-3" style={{ color: '#166534' }}>Timesheet Totals</label>

                <div style={{ marginBottom: '0.75rem' }}>
                  <div className="text-xs font-semibold mb-1" style={{ color: '#111827' }}>Foreman Hours</div>
                  <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.875rem' }}>
                    <span>Regular: <strong>{totals.regularHours.foreman}</strong></span>
                    <span>1.5X: <strong>{totals.overtimeHours.foreman}</strong></span>
                    <span>2X: <strong>{totals.doubleHours.foreman}</strong></span>
                  </div>
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                  <div className="text-xs font-semibold mb-1" style={{ color: '#111827' }}>Regular Hours</div>
                  <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.875rem' }}>
                    <span>Regular: <strong>{totals.regularHours.regular}</strong></span>
                    <span>1.5X: <strong>{totals.overtimeHours.regular}</strong></span>
                    <span>2X: <strong>{totals.doubleHours.regular}</strong></span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.875rem' }}>
                  <span>Total Miles: <strong>{totals.miles}</strong></span>
                  <span>Total Expenses: <strong>${totals.expenses.toFixed(2)}</strong></span>
                </div>
              </div>
            );
          })() : null}
          {/* Entry breakdown below totals */}
          {formData.entries ? (
            <div style={{ marginTop: '1rem' }}>
              <label className="block text-sm mb-2 font-medium" style={{ color: '#111827' }}>Time Entries</label>
              {(formData.entries as Array<Record<string, unknown>>).map((entry, i) => (
                <div key={i} style={{ padding: '0.5rem', backgroundColor: '#f9fafb', borderRadius: '0.375rem', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                  <p><span className="font-medium">#{String(entry.entryNumber)}</span> — {new Date(String(entry.date) + 'T00:00:00').toLocaleDateString('en-US')} — {String(entry.jobNameNumber)}</p>
                  <p>{String(entry.scopeOfWork)}</p>
                  <p>Regular: {String(entry.regularHours)}h | OT: {String(entry.overtimeHours)}h | 2X: {String(entry.doubleHours)}h | Miles: {String(entry.miles)}{entry.isForeman ? ' | Foreman' : ''}</p>
                  {Number(entry.expenses) > 0 && <p>Expenses: ${Number(entry.expenses).toFixed(2)} — {String(entry.expenseDescription)}</p>}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      );

    case 'accident':
      return (
        <div>
          {renderTextField('incidentDate', 'Incident Date')}
          {renderTextField('incidentTime', 'Incident Time')}
          {renderTextField('location', 'Location')}
          {renderTextField('incidentType', 'Incident Type')}
          {(formData.otherIncidentType as string) && renderTextField('otherIncidentType', 'Other Incident Type')}
          {renderTextField('peopleInvolved', 'People Involved')}
          {renderTextField('witness', 'Witnesses')}
          {renderTextField('description', 'Description')}
          {renderTextField('cause', 'Cause')}
          {renderTextField('injuries', 'Injuries')}
          {renderTextField('treatment', 'Treatment')}
          {renderTextField('propertyDamage', 'Property/Equipment Damage')}
          {renderTextField('immediateActions', 'Immediate Actions')}
          {renderTextField('futurePreventionSteps', 'Future Prevention Steps')}
          {renderTextField('reportedTo', 'Reported To')}
          {renderTextField('reportedDate', 'Date Reported')}
          {renderTextField('otherNotes', 'Other Notes')}
        </div>
      );

    case 'photo-upload':
      return (
        <div>
          {(formData.uploadedBy as string) && (
            <div style={{ marginBottom: '0.75rem' }}>
              <label className="block text-sm mb-1" style={{ color: '#1f2937' }}>Uploaded by</label>
              <p className="text-sm" style={{ color: '#1f2937' }}>{String(formData.uploadedBy)}</p>
            </div>
          )}
          {(formData.jobName as string) && (
            <div style={{ marginBottom: '0.75rem' }}>
              <label className="block text-sm mb-1" style={{ color: '#1f2937' }}>Job Name</label>
              <p className="text-sm" style={{ color: '#1f2937' }}>{String(formData.jobName)}</p>
            </div>
          )}
          <p className="text-sm" style={{ color: '#374151' }}>See photos below.</p>
        </div>
      );

    default:
      // Generic fallback — render all form_data keys
      return (
        <div>
          {Object.entries(formData).map(([key, value]) => (
            <div key={key} style={{ marginBottom: '0.75rem' }}>
              <label className="block text-sm mb-1" style={{ color: '#1f2937' }}>{key}</label>
              <p className="text-sm" style={{ whiteSpace: 'pre-wrap', color: '#1f2937' }}>
                {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
              </p>
            </div>
          ))}
        </div>
      );
  }
}
