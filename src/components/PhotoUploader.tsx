'use client';
import { useState, useRef, useCallback, useEffect } from 'react';

interface UploadedPhoto {
  url: string;
  name: string;
}

interface PhotoInProgress {
  name: string;
  preview: string;
  status: 'compressing' | 'uploading' | 'done' | 'error';
  progress: number; // 0-100
  url?: string;
  errorMsg?: string;
}

interface PhotoUploaderProps {
  uploadId: string;
  onPhotosChange: (urls: string[]) => void;
  /** Optional: also keep local File refs for PDF snapshot (blob URLs) */
  onLocalFilesChange?: (files: File[]) => void;
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

export default function PhotoUploader({ uploadId, onPhotosChange, onLocalFilesChange }: PhotoUploaderProps) {
  const [photos, setPhotos] = useState<PhotoInProgress[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadedUrlsRef = useRef<string[]>([]);
  const localFilesRef = useRef<File[]>([]);
  const photoCounterRef = useRef(0);

  // Sync URLs back to parent whenever a photo finishes uploading
  useEffect(() => {
    const doneUrls = photos.filter(p => p.status === 'done' && p.url).map(p => p.url!);
    if (JSON.stringify(doneUrls) !== JSON.stringify(uploadedUrlsRef.current)) {
      uploadedUrlsRef.current = doneUrls;
      onPhotosChange(doneUrls);
    }
  }, [photos, onPhotosChange]);

  const uploadSinglePhoto = useCallback(async (file: File, idx: number, photoIndex: number) => {
    // Update status to compressing
    setPhotos(prev => {
      const updated = [...prev];
      if (updated[idx]) updated[idx] = { ...updated[idx], status: 'compressing', progress: 10 };
      return updated;
    });

    // Compress
    let compressedFile: File;
    try {
      compressedFile = await compressImage(file);
    } catch {
      compressedFile = file;
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

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const startIdx = photos.length;
    const startCounter = photoCounterRef.current;

    // Create preview entries
    const newPhotos: PhotoInProgress[] = files.map((file) => ({
      name: file.name,
      preview: URL.createObjectURL(file),
      status: 'compressing' as const,
      progress: 0,
    }));

    setPhotos(prev => [...prev, ...newPhotos]);
    photoCounterRef.current += files.length;

    // Start uploading each one
    files.forEach((file, i) => {
      uploadSinglePhoto(file, startIdx + i, startCounter + i + 1);
    });

    // Reset file input so same files can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [photos.length, uploadSinglePhoto]);

  const removePhoto = useCallback((idx: number) => {
    setPhotos(prev => {
      const updated = [...prev];
      // Revoke preview URL
      if (updated[idx]) {
        URL.revokeObjectURL(updated[idx].preview);
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

  const doneCount = photos.filter(p => p.status === 'done').length;
  const errorCount = photos.filter(p => p.status === 'error').length;
  const inProgressCount = photos.filter(p => p.status === 'compressing' || p.status === 'uploading').length;

  return (
    <div className="space-y-3">
      <div>
        <label className="block mb-1">Upload Photos</label>
        <p className="text-sm text-gray-600 mb-2">
          Please upload any pictures of equipment or maintenance performed
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="w-full p-2 border rounded"
        />
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

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {photos.map((photo, idx) => (
              <div key={idx} className="relative group" style={{ paddingTop: '4px', paddingRight: '4px' }}>
                <div className="aspect-square rounded overflow-hidden border bg-gray-100">
                  <img
                    src={photo.preview}
                    alt={photo.name}
                    className={`w-full h-full object-cover ${
                      photo.status === 'error' ? 'opacity-40' :
                      photo.status !== 'done' ? 'opacity-60' : ''
                    }`}
                  />

                  {/* Overlay for in-progress */}
                  {(photo.status === 'compressing' || photo.status === 'uploading') && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
                      <div style={{ width: '2rem', height: '2rem', border: '3px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                      <span style={{ color: 'white', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                        {photo.status === 'compressing' ? 'Resizing...' : 'Uploading...'}
                      </span>
                    </div>
                  )}

                  {/* Done checkmark - bottom left corner */}
                  {photo.status === 'done' && (
                    <div style={{
                      position: 'absolute',
                      bottom: '4px',
                      left: '4px',
                      width: '1.5rem',
                      height: '1.5rem',
                      backgroundColor: '#22c55e',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <svg style={{ width: '0.875rem', height: '0.875rem', color: 'white' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}

                  {/* Error indicator */}
                  {photo.status === 'error' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
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

                {/* Remove button - top right, outside the image */}
                <button
                  type="button"
                  onClick={() => removePhoto(idx)}
                  className="photo-remove-btn"
                  style={{
                    position: 'absolute',
                    top: '-2px',
                    right: '-2px',
                    width: '1.625rem',
                    height: '1.625rem',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    borderRadius: '50%',
                    fontSize: '1rem',
                    lineHeight: '1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid white',
                    cursor: 'pointer',
                    padding: 0,
                    zIndex: 10,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
