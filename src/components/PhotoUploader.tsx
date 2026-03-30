'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import PhotoAnnotator from './PhotoAnnotator';

// Detect HEIC/HEIF files by MIME type or extension
function isHeicFile(file: File): boolean {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return (
    type === 'image/heic' ||
    type === 'image/heif' ||
    name.endsWith('.heic') ||
    name.endsWith('.heif')
  );
}

// Convert HEIC/HEIF file to JPEG using heic2any (loaded dynamically)
async function convertHeicToJpeg(file: File): Promise<File> {
  try {
    const heic2any = (await import('heic2any')).default;
    const blob = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.92,
    });
    // heic2any can return a single blob or an array
    const resultBlob = Array.isArray(blob) ? blob[0] : blob;
    return new File(
      [resultBlob],
      file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg'),
      { type: 'image/jpeg', lastModified: Date.now() }
    );
  } catch (err) {
    console.error('HEIC conversion failed:', err);
    throw err;
  }
}

interface UploadedPhoto {
  url: string;
  name: string;
}

interface PhotoInProgress {
  name: string;
  preview: string;
  status: 'converting' | 'compressing' | 'uploading' | 'done' | 'error';
  progress: number; // 0-100
  url?: string;
  errorMsg?: string;
  caption?: string;
  annotatedPreview?: string; // blob URL of annotated version
}

interface PhotoUploaderProps {
  uploadId: string;
  onPhotosChange: (urls: string[]) => void;
  /** Optional: also keep local File refs for PDF snapshot (blob URLs) */
  onLocalFilesChange?: (files: File[]) => void;
  /** Optional: callback for caption changes - maps photo URL to caption text */
  onCaptionsChange?: (captions: Record<string, string>) => void;
}

// Compress an image file using canvas
async function compressImage(file: File, maxDimension = 2000, quality = 0.8): Promise<File> {
  return new Promise((resolve, reject) => {
    // If it's already small (under 500KB), skip compression
    if (file.size < 500 * 1024) {
      resolve(file);
      return;
    }

    const img = new window.Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Scale down if needed
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file); // Fallback to original
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          // Use the compressed version only if it's actually smaller
          if (blob.size < file.size) {
            const compressed = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressed);
          } else {
            resolve(file);
          }
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file); // Fallback to original on error
    };

    img.src = url;
  });
}

export default function PhotoUploader({ uploadId, onPhotosChange, onLocalFilesChange, onCaptionsChange }: PhotoUploaderProps) {
  const [photos, setPhotos] = useState<PhotoInProgress[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadedUrlsRef = useRef<string[]>([]);
  const localFilesRef = useRef<File[]>([]);
  const photoCounterRef = useRef(0);
  const [annotatingIdx, setAnnotatingIdx] = useState<number | null>(null);
  const [editingCaptionIdx, setEditingCaptionIdx] = useState<number | null>(null);

  // Sync URLs back to parent whenever a photo finishes uploading
  useEffect(() => {
    const doneUrls = photos.filter(p => p.status === 'done' && p.url).map(p => p.url!);
    if (JSON.stringify(doneUrls) !== JSON.stringify(uploadedUrlsRef.current)) {
      uploadedUrlsRef.current = doneUrls;
      onPhotosChange(doneUrls);
    }
  }, [photos, onPhotosChange]);

  // Sync captions back to parent
  useEffect(() => {
    if (!onCaptionsChange) return;
    const captions: Record<string, string> = {};
    for (const p of photos) {
      if (p.status === 'done' && p.url && p.caption) {
        captions[p.url] = p.caption;
      }
    }
    onCaptionsChange(captions);
  }, [photos, onCaptionsChange]);

  const uploadSinglePhoto = useCallback(async (file: File, idx: number, photoIndex: number) => {
    let processedFile = file;

    // Convert HEIC/HEIF to JPEG first
    if (isHeicFile(file)) {
      setPhotos(prev => {
        const updated = [...prev];
        if (updated[idx]) updated[idx] = { ...updated[idx], status: 'converting', progress: 5 };
        return updated;
      });
      try {
        processedFile = await convertHeicToJpeg(file);
        // Update the preview with the converted file
        const newPreview = URL.createObjectURL(processedFile);
        setPhotos(prev => {
          const updated = [...prev];
          if (updated[idx]) {
            URL.revokeObjectURL(updated[idx].preview);
            updated[idx] = { ...updated[idx], preview: newPreview };
          }
          return updated;
        });
      } catch {
        setPhotos(prev => {
          const updated = [...prev];
          if (updated[idx]) updated[idx] = { ...updated[idx], status: 'error', progress: 0, errorMsg: 'HEIC conversion failed' };
          return updated;
        });
        return;
      }
    }

    // Update status to compressing
    setPhotos(prev => {
      const updated = [...prev];
      if (updated[idx]) updated[idx] = { ...updated[idx], status: 'compressing', progress: 10 };
      return updated;
    });

    // Compress
    let compressedFile: File;
    try {
      compressedFile = await compressImage(processedFile);
    } catch {
      compressedFile = processedFile;
    }

    // Keep reference for local PDF generation
    localFilesRef.current = [...localFilesRef.current, compressedFile];
    onLocalFilesChange?.(localFilesRef.current);

    // Update status to uploading
    setPhotos(prev => {
      const updated = [...prev];
      if (updated[idx]) updated[idx] = { ...updated[idx], status: 'uploading', progress: 40 };
      return updated;
    });

    // Upload
    const formData = new FormData();
    formData.append('photo', compressedFile);
    formData.append('upload_id', uploadId);
    formData.append('index', String(photoIndex));

    try {
      const response = await fetch('/api/upload-photo', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();

      setPhotos(prev => {
        const updated = [...prev];
        if (updated[idx]) {
          updated[idx] = { ...updated[idx], status: 'done', progress: 100, url: result.url };
        }
        return updated;
      });
    } catch (error) {
      console.error('Photo upload error:', error);
      setPhotos(prev => {
        const updated = [...prev];
        if (updated[idx]) {
          updated[idx] = { ...updated[idx], status: 'error', progress: 0, errorMsg: 'Upload failed' };
        }
        return updated;
      });
    }
  }, [uploadId, onLocalFilesChange]);

  // Core file processing — shared by file input and drag-and-drop
  const processFiles = useCallback((files: File[]) => {
    if (files.length === 0) return;

    // Filter to only image files
    const imageFiles = files.filter(f =>
      f.type.startsWith('image/') || isHeicFile(f)
    );
    if (imageFiles.length === 0) return;

    const startIdx = photos.length;
    const startCounter = photoCounterRef.current;

    // Create preview entries — HEIC files start as 'converting'
    const newPhotos: PhotoInProgress[] = imageFiles.map((file) => ({
      name: file.name,
      preview: URL.createObjectURL(file),
      status: (isHeicFile(file) ? 'converting' : 'compressing') as PhotoInProgress['status'],
      progress: 0,
      caption: '',
    }));

    setPhotos(prev => [...prev, ...newPhotos]);
    photoCounterRef.current += imageFiles.length;

    // Upload in batches of 3 to avoid overwhelming serverless function limits
    const BATCH_SIZE = 3;
    const uploadBatches = async () => {
      for (let batch = 0; batch < imageFiles.length; batch += BATCH_SIZE) {
        const batchFiles = imageFiles.slice(batch, batch + BATCH_SIZE);
        await Promise.all(
          batchFiles.map((file, i) =>
            uploadSinglePhoto(file, startIdx + batch + i, startCounter + batch + i + 1)
          )
        );
      }
    };
    uploadBatches();
  }, [photos.length, uploadSinglePhoto]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(Array.from(e.target.files || []));
    // Reset file input so same files can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [processFiles]);

  // Drag-and-drop handlers
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  }, [processFiles]);

  const removePhoto = useCallback((idx: number) => {
    setPhotos(prev => {
      const updated = [...prev];
      // Revoke preview URL
      if (updated[idx]) {
        URL.revokeObjectURL(updated[idx].preview);
        if (updated[idx].annotatedPreview) {
          URL.revokeObjectURL(updated[idx].annotatedPreview!);
        }
      }
      updated.splice(idx, 1);
      return updated;
    });
    // Also remove from local files
    localFilesRef.current.splice(idx, 1);
    onLocalFilesChange?.(localFilesRef.current);
  }, [onLocalFilesChange]);

  const retryPhoto = useCallback((idx: number) => {
    const photo = photos[idx];
    if (!photo) return;
    // Re-upload by creating a fetch from the preview blob
    fetch(photo.preview)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], photo.name, { type: blob.type });
        photoCounterRef.current += 1;
        uploadSinglePhoto(file, idx, photoCounterRef.current);
      });
  }, [photos, uploadSinglePhoto]);

  const updateCaption = useCallback((idx: number, caption: string) => {
    setPhotos(prev => {
      const updated = [...prev];
      if (updated[idx]) {
        updated[idx] = { ...updated[idx], caption };
      }
      return updated;
    });
  }, []);

  // Handle saving annotated photo — re-upload the annotated version
  const handleAnnotationSave = useCallback(async (blob: Blob) => {
    if (annotatingIdx === null) return;
    const idx = annotatingIdx;
    const photo = photos[idx];
    if (!photo) { setAnnotatingIdx(null); return; }

    // Create new preview from annotated blob
    const annotatedPreview = URL.createObjectURL(blob);
    // Revoke old annotated preview if exists
    if (photo.annotatedPreview) {
      URL.revokeObjectURL(photo.annotatedPreview);
    }

    // Update preview to show annotated version
    setPhotos(prev => {
      const updated = [...prev];
      if (updated[idx]) {
        updated[idx] = {
          ...updated[idx],
          annotatedPreview,
          status: 'uploading',
          progress: 50,
        };
      }
      return updated;
    });

    setAnnotatingIdx(null);

    // Re-upload the annotated photo
    const file = new File([blob], photo.name.replace(/\.[^.]+$/, '-annotated.jpg'), {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });

    // Update local files ref
    if (localFilesRef.current[idx]) {
      localFilesRef.current[idx] = file;
      onLocalFilesChange?.(localFilesRef.current);
    }

    photoCounterRef.current += 1;
    const newIndex = photoCounterRef.current;

    const formData = new FormData();
    formData.append('photo', file);
    formData.append('upload_id', uploadId);
    formData.append('index', String(newIndex));

    try {
      const response = await fetch('/api/upload-photo', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');
      const result = await response.json();

      setPhotos(prev => {
        const updated = [...prev];
        if (updated[idx]) {
          updated[idx] = { ...updated[idx], status: 'done', progress: 100, url: result.url };
        }
        return updated;
      });
    } catch (error) {
      console.error('Annotated photo upload error:', error);
      setPhotos(prev => {
        const updated = [...prev];
        if (updated[idx]) {
          updated[idx] = { ...updated[idx], status: 'error', progress: 0, errorMsg: 'Upload failed' };
        }
        return updated;
      });
    }
  }, [annotatingIdx, photos, uploadId, onLocalFilesChange]);

  const doneCount = photos.filter(p => p.status === 'done').length;
  const errorCount = photos.filter(p => p.status === 'error').length;
  const inProgressCount = photos.filter(p => p.status === 'converting' || p.status === 'compressing' || p.status === 'uploading').length;

  return (
    <div className="space-y-3">
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .photo-card {
          position: relative;
          padding-top: 4px;
          padding-right: 4px;
        }
        .photo-caption-input {
          width: 100%;
          padding: 0.25rem 0.375rem;
          font-size: 0.7rem;
          border: 1px solid #d1d5db;
          border-radius: 0 0 0.25rem 0.25rem;
          background: white;
          color: #374151;
          outline: none;
          box-sizing: border-box;
        }
        .photo-caption-input:focus {
          border-color: #3b82f6;
        }
        .photo-caption-display {
          font-size: 0.7rem;
          color: #374151;
          background: #f3f4f6;
          padding: 0.2rem 0.375rem;
          border-radius: 0 0 0.25rem 0.25rem;
          cursor: pointer;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .photo-markup-btn {
          position: absolute;
          bottom: 4px;
          right: 8px;
          background: rgba(0,0,0,0.6);
          color: white;
          border: none;
          border-radius: 0.25rem;
          padding: 0.125rem 0.375rem;
          font-size: 0.65rem;
          font-weight: 600;
          cursor: pointer;
          z-index: 5;
          transition: background 0.15s;
        }
        .photo-markup-btn:hover {
          background: rgba(0,0,0,0.8);
        }
        @media (max-width: 640px) {
          .photo-caption-input, .photo-caption-display {
            font-size: 0.65rem;
          }
        }
        .photo-upload-zone {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 1.5rem 1rem;
          border: 2px dashed #3b82f6;
          border-radius: 0.75rem;
          background: #eff6ff;
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s;
        }
        .photo-upload-zone:hover {
          background: #dbeafe;
          border-color: #2563eb;
        }
        .photo-upload-zone:active {
          background: #bfdbfe;
        }
        .photo-upload-zone.dragging {
          background: #dbeafe;
          border-color: #2563eb;
          border-width: 3px;
        }
        .photo-upload-icon {
          width: 48px;
          height: 48px;
          background: #2563eb;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .photo-upload-icon svg {
          width: 24px;
          height: 24px;
          color: white;
        }
        .photo-upload-title {
          font-size: 1rem;
          font-weight: 600;
          color: #1e40af;
        }
        .photo-upload-subtitle {
          font-size: 0.8rem;
          color: #6b7280;
          text-align: center;
        }
      `}</style>

      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <div
          className={`photo-upload-zone${isDragging ? ' dragging' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div className="photo-upload-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
            </svg>
          </div>
          <div className="photo-upload-title">
            {isDragging ? 'Drop Photos Here' : photos.length > 0 ? 'Add More Photos' : 'Tap to Add Photos'}
          </div>
          <div className="photo-upload-subtitle">
            {isDragging
              ? 'Release to upload'
              : 'Take a photo, choose from your library, or drag & drop files here.'}
          </div>
        </div>
      </div>

      {photos.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm text-gray-600">
            {doneCount} of {photos.length} photo{photos.length !== 1 ? 's' : ''} uploaded
            {inProgressCount > 0 && ` (${inProgressCount} in progress)`}
            {errorCount > 0 && (
              <span className="text-red-600"> ({errorCount} failed)</span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {photos.map((photo, idx) => (
              <div key={idx} className="photo-card">
                <div style={{ borderRadius: '0.25rem 0.25rem 0 0', overflow: 'hidden', border: '1px solid #e5e7eb', borderBottom: 'none', position: 'relative' }}>
                  <div style={{ aspectRatio: '1', position: 'relative', backgroundColor: '#f3f4f6' }}>
                    <img
                      src={photo.annotatedPreview || photo.preview}
                      alt={photo.caption || photo.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        opacity: photo.status === 'error' ? 0.4 : (photo.status !== 'done' ? 0.6 : 1),
                      }}
                    />

                    {/* Overlay for in-progress */}
                    {(photo.status === 'converting' || photo.status === 'compressing' || photo.status === 'uploading') && (
                      <div style={{
                        position: 'absolute', inset: 0,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        backgroundColor: 'rgba(0,0,0,0.3)',
                      }}>
                        <div style={{ width: '2rem', height: '2rem', border: '3px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        <span style={{ color: 'white', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                          {photo.status === 'converting' ? 'Converting...' : photo.status === 'compressing' ? 'Resizing...' : 'Uploading...'}
                        </span>
                      </div>
                    )}

                    {/* Done checkmark - bottom left */}
                    {photo.status === 'done' && (
                      <div style={{
                        position: 'absolute', bottom: '4px', left: '4px',
                        width: '1.5rem', height: '1.5rem', backgroundColor: '#22c55e',
                        borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <svg style={{ width: '0.875rem', height: '0.875rem', color: 'white' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}

                    {/* Markup button - bottom right, only when done */}
                    {photo.status === 'done' && (
                      <button
                        type="button"
                        className="photo-markup-btn"
                        onClick={() => setAnnotatingIdx(idx)}
                      >
                        Markup
                      </button>
                    )}

                    {/* Error indicator */}
                    {photo.status === 'error' && (
                      <div style={{
                        position: 'absolute', inset: 0,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        backgroundColor: 'rgba(0,0,0,0.3)',
                      }}>
                        <div style={{ width: '1.75rem', height: '1.75rem', backgroundColor: '#ef4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.25rem' }}>
                          <span style={{ color: 'white', fontSize: '0.8rem', fontWeight: 'bold' }}>!</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => retryPhoto(idx)}
                          style={{ color: 'white', fontSize: '0.75rem', textDecoration: 'underline', background: 'none', border: 'none', padding: '0.25rem 0.5rem', cursor: 'pointer' }}
                        >
                          Retry
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Caption area */}
                {editingCaptionIdx === idx ? (
                  <input
                    type="text"
                    className="photo-caption-input"
                    value={photo.caption || ''}
                    onChange={e => updateCaption(idx, e.target.value)}
                    onBlur={() => setEditingCaptionIdx(null)}
                    onKeyDown={e => { if (e.key === 'Enter') setEditingCaptionIdx(null); }}
                    placeholder="Add a caption..."
                    autoFocus
                  />
                ) : (
                  <div
                    className="photo-caption-display"
                    onClick={() => setEditingCaptionIdx(idx)}
                    title="Click to edit caption"
                  >
                    {photo.caption || 'Tap to add caption...'}
                  </div>
                )}

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => removePhoto(idx)}
                  className="photo-remove-btn"
                  style={{
                    position: 'absolute', top: '-2px', right: '-2px',
                    width: '1.625rem', height: '1.625rem',
                    backgroundColor: '#ef4444', color: 'white', borderRadius: '50%',
                    fontSize: '1rem', lineHeight: '1',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '2px solid white', cursor: 'pointer', padding: 0, zIndex: 10,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Annotation overlay */}
      {annotatingIdx !== null && photos[annotatingIdx] && (
        <PhotoAnnotator
          imageUrl={photos[annotatingIdx].annotatedPreview || photos[annotatingIdx].preview}
          onSave={handleAnnotationSave}
          onCancel={() => setAnnotatingIdx(null)}
        />
      )}
    </div>
  );
}
