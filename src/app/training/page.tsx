'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const SignaturePad = dynamic(() => import('react-signature-canvas'), {
  ssr: false
});

type Equipment = string;

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
  photos: File[];
}

const initialFormData: FormData = {
  date: '',
  jobName: '',
  technicianName: '',
  jobNumber: '',
  attendanceList: '',
  selectedEquipment: [],
  signature: '',
  equipmentTurnover: '',
  photos: [],
  notes: ''
};

export default function TrainingForm() {
  const [formData, setFormData] = useState<FormData>(initialFormData);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Create PDF
    const doc = new jsPDF();
    const fileName = `${formData.jobNumber}-${formData.jobName}-Report.pdf`;

    // Add company logo (coordinates and size may need adjustment)
    doc.addImage('/images/logo.png', 'PNG', 15, 15, 60, 30);
    
    // Add title
    doc.setFontSize(20);
    doc.text('Training Report', 105, 40, { align: 'center' });

    // Add basic info
    doc.setFontSize(12);
    doc.text(`Date: ${formData.date}`, 20, 60);
    doc.text(`Job Number: ${formData.jobNumber}`, 20, 70);
    doc.text(`Job Name: ${formData.jobName}`, 20, 80);
    doc.text(`Technician: ${formData.technicianName}`, 20, 90);

    // Add Attendance List
    doc.text('Attendance:', 20, 110);
    const attendees = formData.attendanceList.split('\n');
    attendees.forEach((attendee, index) => {
        doc.text(`• ${attendee}`, 30, 120 + (index * 10));
    });

    // Add Equipment Trained
    const yPos = 120 + (attendees.length * 10) + 10;
    doc.text('Equipment Trained:', 20, yPos);
    formData.selectedEquipment.forEach((equipment, index) => {
        doc.text(`• ${equipment}`, 30, yPos + 10 + (index * 10));
    });

    // Add signature if exists
    if (formData.signature) {
        const signatureYPos = yPos + 20 + (formData.selectedEquipment.length * 10);
        doc.text('Signature:', 20, signatureYPos);
        doc.addImage(formData.signature, 'PNG', 20, signatureYPos + 5, 50, 20);
    }

    // Convert PDF to blob
    const pdfBlob = doc.output('blob');

    // Create form data for sending
    const sendData = new FormData();
    sendData.append('pdf', pdfBlob, fileName);
    sendData.append('subject', `${formData.jobNumber}-${formData.jobName}-Report`);
    sendData.append('emailTo', 'andrew@deglerwhiting.com');

    try {
      const response = await fetch('/api/send-email', {
          method: 'POST',
          body: sendData,
      });

      if (response.ok) {
          alert('Your report has been submitted');
          setFormData(initialFormData);
      } else {
          const errorData = await response.json();
          console.error('Server response:', errorData);
          throw new Error(`Failed to send report: ${JSON.stringify(errorData)}`);
      }
  } catch (error) {
      console.error('Detailed error:', error);
      alert('Error sending report. Check console for details.');
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
                  onClick={() => setFormData(prev => ({
                    ...prev,
                    selectedEquipment: prev.selectedEquipment.includes(equipment)
                      ? prev.selectedEquipment.filter(e => e !== equipment)
                      : [...prev.selectedEquipment, equipment]
                  }))}
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

          {/* Signature Section */}
          <div className="space-y-2">
            <label className="block mb-1">Signature of main attendee:</label>
            <div className="border rounded p-2 bg-white">
              <div className="border rounded h-40 bg-white">
                <SignaturePad
                  canvasProps={{
                    className: 'w-full h-full signature-pad'
                  }}
                  onEnd={() => {
                    const pad = document.querySelector('.signature-pad') as HTMLCanvasElement;
                    if (pad) {
                      const dataUrl = pad.toDataURL();
                      setFormData(prev => ({
                        ...prev,
                        signature: dataUrl
                      }));
                    }
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  const pad = document.querySelector('.signature-pad') as HTMLCanvasElement;
                  if (pad) {
                    const context = pad.getContext('2d');
                    context?.clearRect(0, 0, pad.width, pad.height);
                  }
                  setFormData(prev => ({
                    ...prev,
                    signature: ''
                  }));
                }}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800"
              >
                Clear Signature
              </button>
            </div>
          </div>

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
            <label className="block mb-1">Upload Photos</label>
            <p className="text-sm text-gray-600 mb-2">
              Please upload any pictures of training or equipment turnover
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
              {formData.photos?.length || 0} photos selected
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