'use client';
import { useState, FormEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function MaterialDeliveryForm() {
  const [formData, setFormData] = useState({
    date: '',
    jobName: '',
    installerName: '',
    jobNumber: '',
    deliveredItems: '',
    storageLocation: '',
    photos: [] as File[]
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log(formData);
    alert('Your report has been submitted');
    setFormData({
      date: '',
      jobName: '',
      installerName: '',
      jobNumber: '',
      deliveredItems: '',
      storageLocation: '',
      photos: []
    });
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
        Material Delivery Report
      </h1>

      <div className="max-w-2xl mx-auto bg-white p-6 rounded-lg shadow-md">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-1">Date</label>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-1">Installer Name</label>
              <input
                type="text"
                value={formData.installerName}
                onChange={e => setFormData({...formData, installerName: e.target.value})}
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

          {/* Delivered Items Section */}
          <div className="space-y-2">
            <label className="block mb-1">List all products that delivered</label>
            <textarea
              value={formData.deliveredItems}
              onChange={e => setFormData({...formData, deliveredItems: e.target.value})}
              className="w-full p-2 border rounded min-h-[150px]"
              placeholder="List each item and quantity of equipment delivered"
              required
            />
          </div>

          {/* Storage Location Section */}
          <div className="space-y-2">
            <label className="block mb-1">What room is the material stored?</label>
            <textarea
              value={formData.storageLocation}
              onChange={e => setFormData({...formData, storageLocation: e.target.value})}
              className="w-full p-2 border rounded min-h-[100px]"
              placeholder="Describe where the materials are being stored"
              required
            />
          </div>

          {/* Photo Upload Section */}
          <div className="space-y-2">
            <label className="block mb-1">Upload Photos</label>
            <p className="text-sm text-gray-600 mb-2">
              Take pictures of all equipment as thorough as possible
            </p>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                setFormData(prev => ({
                  ...prev,
                  photos: files
                }));
              }}
              className="w-full p-2 border rounded"
            />
            <div className="text-sm text-gray-500 mt-1">
              {formData.photos.length} photos selected
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors"
            >
              Submit Report
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}