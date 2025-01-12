'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function MaterialTurnoverForm() {
  const [formData, setFormData] = useState({
    date: '',
    jobName: '',
    technicianName: '',
    jobNumber: ''
  });

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
        Material Turnover Report
      </h1>

      <div className="max-w-2xl mx-auto bg-white p-6 rounded-lg shadow-md">
        <form className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-1">Service Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
                className="w-full p-2 border rounded"
              />
            </div>
            
            <div>
              <label className="block mb-1">Job Name</label>
              <input
                type="text"
                value={formData.jobName}
                onChange={e => setFormData({...formData, jobName: e.target.value})}
                className="w-full p-2 border rounded"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-1">Technician Name</label>
              <input
                type="text"
                value={formData.technicianName}
                onChange={e => setFormData({...formData, technicianName: e.target.value})}
                className="w-full p-2 border rounded"
              />
            </div>
            
            <div>
              <label className="block mb-1">Job Number</label>
              <input
                type="text"
                value={formData.jobNumber}
                onChange={e => setFormData({...formData, jobNumber: e.target.value})}
                className="w-full p-2 border rounded"
              />
            </div>
          </div>

          <div className="text-center p-8 bg-gray-50 rounded mt-8">
            <p className="text-gray-500 text-lg">Form Under Construction</p>
          </div>
        </form>
      </div>
    </div>
  );
}