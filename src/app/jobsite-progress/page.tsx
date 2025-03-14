'use client';
import { useState, FormEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { generatePDF, PDFDownloadButton } from '../../utils/pdfGenerator';

export default function JobSiteProgressForm() {
  const [formData, setFormData] = useState({
    date: '',
    jobName: '',
    installerName: '',
    jobNumber: '',
    equipment: '',
    notes: '',
    estimatedCompletionDate: '',
    photos: [] as File[]
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      // Generate PDF
      const filename = await generatePDF(formData, 'Job Site Progress');
      console.log(`PDF generated and saved as: ${filename}`);
      
      // Reset form
      setFormData({
        date: '',
        jobName: '',
        installerName: '',
        jobNumber: '',
        equipment: '',
        notes: '',
        estimatedCompletionDate: '',
        photos: []
      });
      alert('Job Site Progress report submitted successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
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
        Job Site Progress Report
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

         {/* Equipment Section */}
         <div className="space-y-2">
            <label className="block mb-1">Equipment Being Installed</label>
            <textarea
              value={formData.equipment}
              onChange={e => setFormData({...formData, equipment: e.target.value})}
              className="w-full p-2 border rounded min-h-[150px]"
              placeholder="List what equipment is being installed"
              required
            />
          </div>

{/* Notes Section */}
<div className="space-y-2">
            <label className="block mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={e => setFormData({...formData, notes: e.target.value})}
              className="w-full p-2 border rounded min-h-[150px]"
              placeholder="Install progress notes; site conditions, equipment being worked on, issues found onsite, etc"
              required
            />
          </div>

          {/* Estimated Completion Date */}
          <div className="space-y-2">
            <label className="block mb-1">Estimated Completion Date</label>
            <input
              type="date"
              value={formData.estimatedCompletionDate}
              onChange={e => setFormData({...formData, estimatedCompletionDate: e.target.value})}
              className="w-full p-2 border rounded"
            />
          </div>

          {/* Photo Upload Section */}
          <div className="space-y-2">
            <label className="block mb-1">Upload Photos</label>
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
          <div className="flex space-x-4 mt-6">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors"
            >
              Submit Report
            </button>
            
            <div className="inline-flex items-center">
              <PDFDownloadButton formData={formData} title="Job Site Progress" />
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}