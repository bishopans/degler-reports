'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface FormData {
  photos: File[];
}

export default function PhotoUploadForm() {
  const initialFormData: FormData = {
    photos: []
  };

  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Handle form submission
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log('Photos:', formData.photos);
    
    // Display success message
    alert('Your photos have been submitted successfully');
    
    // Reset form
    setFormData(initialFormData);
    setIsSubmitted(true);
  };

  // Generate preview images
  const renderPhotoPreview = () => {
    if (formData.photos.length === 0) {
      return <p className="text-gray-500 italic">No photos selected</p>;
    }

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
        {Array.from(formData.photos).map((photo, index) => (
          <div key={index} className="relative">
            <div className="aspect-square bg-gray-100 rounded overflow-hidden relative">
              <img 
                src={URL.createObjectURL(photo)} 
                alt={`Preview ${index + 1}`}
                className="absolute top-0 left-0 w-full h-full object-cover"
              />
            </div>
            <button 
              type="button"
              onClick={() => {
                const newPhotos = Array.from(formData.photos);
                newPhotos.splice(index, 1);
                setFormData({...formData, photos: newPhotos});
              }}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
              aria-label="Remove photo"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    );
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
        Photos to PDF Upload
      </h1>

      <div className="max-w-3xl mx-auto bg-white p-6 rounded-lg shadow-md">
        {isSubmitted ? (
          <div className="text-center p-8">
            <div className="text-green-600 text-xl mb-4">Photos Submitted Successfully!</div>
            <button
              onClick={() => setIsSubmitted(false)}
              className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors"
            >
              Upload More Photos
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <div className="border-2 border-dashed rounded-lg p-6 text-center bg-gray-50">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setFormData(prev => ({
                      ...prev,
                      photos: [...prev.photos, ...files]
                    }));
                  }}
                  className="hidden"
                  id="photo-upload"
                  required={formData.photos.length === 0}
                />
                <label 
                  htmlFor="photo-upload" 
                  className="cursor-pointer inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Select Photos
                </label>
                <p className="text-sm text-gray-500 mt-2">
                  Click to select multiple photos
                </p>
              </div>
              
              <div className="mt-4">
                <h3 className="font-medium mb-2">Selected Photos ({formData.photos.length})</h3>
                {renderPhotoPreview()}
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors"
                disabled={formData.photos.length === 0}
              >
                Submit Photos
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}