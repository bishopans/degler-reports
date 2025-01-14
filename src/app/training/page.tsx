'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import SignaturePad from 'react-signature-canvas';

// Define equipment type
type Equipment = string;

// Define the form data structure
interface FormData {
  date: string;
  jobName: string;
  technicianName: string;
  jobNumber: string;
  attendanceList: string;
  selectedEquipment: Equipment[];
  signature: string;
  equipmentTurnover: string;
  notes: string;
}

// Define initial state
const initialFormData: FormData = {
  date: '',
  jobName: '',
  technicianName: '',
  jobNumber: '',
  attendanceList: '',
  selectedEquipment: [],
  signature: '',
  equipmentTurnover: '',
  notes: ''
};

export default function TrainingForm() {
  const [formData, setFormData] = useState<FormData>(initialFormData);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log(formData);
    
    // Clear form
    setFormData(initialFormData);
    
    // Show message
    alert('Your report has been submitted');
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
        Training Report
      </h1>

      <div className="max-w-2xl mx-auto bg-white p-6 rounded-lg shadow-md">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Top row of form fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-1">Training Date</label>
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

          {/* Attendance List Section */}
          <div className="space-y-2">
            <label className="block mb-1">Attendance List: Who was trained?</label>
            <div className="relative">
              <textarea
                value={formData.attendanceList}
                onChange={e => setFormData({...formData, attendanceList: e.target.value})}
                className="w-full p-2 border rounded min-h-[100px]"
                placeholder="Enter names (one per line):
John Smith
Jane Doe
..."
              />
              <div className="text-sm text-gray-500 mt-1">
                Enter each name on a new line
              </div>
            </div>
          </div>
{/* Equipment Selection */}
<div className="space-y-2">
            <label className="block mb-2 font-medium">Select all trained equipment:</label>
            <div className="grid grid-cols-2 gap-4">
              {[
                'Bleachers',
                'Basketball Backstops',
                'Divider Curtains',
                'Mat Hoists',
                'Batting Cages',
                'Volleyball',
                'Scoreboards',
                'Folding Partitions'
              ].map((equipment) => (
                <button
                  key={equipment}
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({
                      ...prev,
                      selectedEquipment: prev.selectedEquipment.includes(equipment)
                        ? prev.selectedEquipment.filter(e => e !== equipment)
                        : [...prev.selectedEquipment, equipment]
                    }));
                  }}
                  className={`p-4 border-2 rounded-lg text-left ${
                    formData.selectedEquipment.includes(equipment)
                      ? 'bg-blue-100 border-blue-500'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  {equipment}
                </button>
              ))}
            </div>
          </div>
          {/* Equipment Turnover Section */}
          <div className="space-y-2">
            <label className="block mb-1">Equipment Turnover:</label>
            <p className="text-sm text-gray-600 mb-2">
              Did you leave scoreboard controller, key switch keys, or bleacher controller
              any place or with anyone?
            </p>
            <textarea
              value={formData.equipmentTurnover}
              onChange={e => setFormData({...formData, equipmentTurnover: e.target.value})}
              className="w-full p-2 border rounded min-h-[80px]"
              placeholder="Describe any equipment left and with whom..."
            />
          </div>
          {/* Photo Upload Section */}
          <div className="space-y-2">
            <label className="block mb-1">Upload Photos:</label>
            <p className="text-sm text-gray-600 mb-2">
              Please upload any pictures of training or equipment turnover
            </p>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                // Handle file upload logic here
                console.log('Files selected:', files);
              }}
              className="w-full p-2 border rounded"
            />
          </div>
          {/* Notes Section */}
          <div className="space-y-2">
            <label className="block mb-1">Any other notes?</label>
            <p className="text-sm text-gray-600 mb-2">
              i.e. equipment was not working or anything worth mentioning
            </p>
            <textarea
              value={formData.notes}
              onChange={e => setFormData({...formData, notes: e.target.value})}
              className="w-full p-2 border rounded min-h-[100px]"
              placeholder="Enter any additional notes here..."
            />
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