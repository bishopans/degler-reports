'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface TimeEntry {
  id: string;
  entryNumber: number;
  date: string;
  jobNameNumber: string;
  scopeOfWork: string;
  isForeman: boolean;
  regularHours: number;
  overtimeHours: number;
  doubleHours: number;
  miles: number;
  expenses: number;
  expenseDescription: string;
  photos: File[];
}

interface FormData {
  name: string;
  rank: string;
  entries: TimeEntry[];
}

const initialFormData: FormData = {
  name: '',
  rank: '',
  entries: [{
    id: '1',
    entryNumber: 1,
    date: '',
    jobNameNumber: '',
    scopeOfWork: '',
    isForeman: false,
    regularHours: 0,
    overtimeHours: 0,
    doubleHours: 0,
    miles: 0,
    expenses: 0,
    expenseDescription: '',
    photos: []
  }]
};

const rankOptions = [
  'Journeyman',
  'Apprentice 1st Yr',
  'Apprentice 2nd Yr',
  'Apprentice 3rd Yr',
  'Apprentice 4th Yr',
  'Apprentice 5th Yr'
];

export default function TimeSheetForm() {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [receiptPhotos, setReceiptPhotos] = useState<File[]>([]);

  const addRow = () => {
    setFormData(prev => ({
      ...prev,
      entries: [...prev.entries, {
        id: Date.now().toString(),
        entryNumber: prev.entries.length + 1,
        date: '',
        jobNameNumber: '',
        scopeOfWork: '',
        isForeman: false,
        regularHours: 0,
        overtimeHours: 0,
        doubleHours: 0,
        miles: 0,
        expenses: 0,
        expenseDescription: '',
        photos: []
      }]
    }));
  };

  const removeRow = (id: string) => {
    setFormData(prev => ({
      ...prev,
      entries: prev.entries.filter(entry => entry.id !== id).map((entry, index) => ({
        ...entry,
        entryNumber: index + 1
      }))
    }));
  };

  const updateEntry = (id: string, field: keyof TimeEntry, value: string | number | boolean | File[]) => {
    setFormData(prev => ({
      ...prev,
      entries: prev.entries.map(entry => 
        entry.id === id ? { ...entry, [field]: value } : entry
      )
    }));
  };

  const calculateTotals = () => {
    const initial = {
      regularHours: { foreman: 0, regular: 0 },
      overtimeHours: { foreman: 0, regular: 0 },
      doubleHours: { foreman: 0, regular: 0 },
      miles: 0,
      expenses: 0
    };

    return formData.entries.reduce((acc, entry) => {
      const type = entry.isForeman ? 'foreman' : 'regular';
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
    }, initial);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log({ ...formData, receiptPhotos });
    alert('Time Sheet submitted successfully');
    setFormData(initialFormData);
    setReceiptPhotos([]);
  };

  const totals = calculateTotals();

  return (
    <div className="min-h-screen p-6">
      <Link href="/" className="mb-6 inline-block text-blue-600 hover:text-blue-800">
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

      <h1 className="text-2xl font-bold text-center mb-8">Time Sheet</h1>

      <div className="max-w-3xl mx-auto bg-white p-6 rounded-lg shadow-md">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block mb-1">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            
            <div>
              <label className="block mb-1">Primary Rank</label>
              <select
                value={formData.rank}
                onChange={e => setFormData({...formData, rank: e.target.value})}
                className="w-full p-2 border rounded"
                required
              >
                <option value="">Select Rank</option>
                {rankOptions.map(rank => (
                  <option key={rank} value={rank}>{rank}</option>
                ))}
              </select>
            </div>
          </div>

          {formData.entries.map((entry) => (
            <div key={entry.id} className="border rounded p-4 space-y-4">
              <div className="font-bold">Entry #{entry.entryNumber}</div>
              
              <div>
                <label className="block mb-1">Date</label>
                <input
                  type="date"
                  value={entry.date}
                  onChange={e => updateEntry(entry.id, 'date', e.target.value)}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>

              <div>
                <label className="block mb-1">Job Name and Number</label>
                <input
                  type="text"
                  value={entry.jobNameNumber}
                  onChange={e => updateEntry(entry.id, 'jobNameNumber', e.target.value)}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>

              <div>
                <label className="block mb-1">Brief Scope of Work</label>
                <input
                  type="text"
                  value={entry.scopeOfWork}
                  onChange={e => updateEntry(entry.id, 'scopeOfWork', e.target.value)}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>

              <div className="flex items-center space-x-2 mb-4">
                <input
                  type="checkbox"
                  checked={entry.isForeman}
                  onChange={e => updateEntry(entry.id, 'isForeman', e.target.checked)}
                  className="h-4 w-4"
                />
                <label>Working as Foreman</label>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block mb-1">Regular Hours</label>
                  <input
                    type="number"
                    value={entry.regularHours || ''}
                    onChange={e => {
                      const value = e.target.value;
                      if (/^\d*\.?\d*$/.test(value)) {
                        updateEntry(entry.id, 'regularHours', Number(value));
                      }
                    }}
                    className="w-full p-2 border rounded"
                    min="0"
                    step="0.5"
                    required
                  />
                </div>
                <div>
                  <label className="block mb-1">1.5X Hours</label>
                  <input
                    type="number"
                    value={entry.overtimeHours || ''}
                    onChange={e => {
                      const value = e.target.value;
                      if (/^\d*\.?\d*$/.test(value)) {
                        updateEntry(entry.id, 'overtimeHours', Number(value));
                      }
                    }}
                    className="w-full p-2 border rounded"
                    min="0"
                    step="0.5"
                  />
                </div>
                <div>
                  <label className="block mb-1">2X Hours</label>
                  <input
                    type="number"
                    value={entry.doubleHours || ''}
                    onChange={e => {
                      const value = e.target.value;
                      if (/^\d*\.?\d*$/.test(value)) {
                        updateEntry(entry.id, 'doubleHours', Number(value));
                      }
                    }}
                    className="w-full p-2 border rounded"
                    min="0"
                    step="0.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1">Miles</label>
                  <input
                    type="number"
                    value={entry.miles || ''}
                    onChange={e => {
                      const value = e.target.value;
                      if (/^\d*\.?\d*$/.test(value)) {
                        updateEntry(entry.id, 'miles', Number(value));
                      }
                    }}
                    className="w-full p-2 border rounded"
                    min="0"
                    required
                  />
                </div>

                <div>
                  <label className="block mb-1">$ Expenses</label>
                  <input
                    type="number"
                    value={entry.expenses || ''}
                    onChange={e => {
                      const value = e.target.value;
                      if (/^\d*\.?\d*$/.test(value)) {
                        updateEntry(entry.id, 'expenses', Number(value));
                      }
                    }}
                    className="w-full p-2 border rounded"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              {entry.expenses > 0 && (
                <div>
                  <label className="block mb-1">Expense Description</label>
                  <input
                    type="text"
                    value={entry.expenseDescription}
                    onChange={e => updateEntry(entry.id, 'expenseDescription', e.target.value)}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
              )}

              {formData.entries.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(entry.id)}
                  className="w-full bg-red-100 text-red-600 px-4 py-2 rounded hover:bg-red-200"
                >
                  Remove Entry
                </button>
              )}
            </div>
          ))}

          <div className="flex justify-center pt-4 pb-8">
            <button
              type="button"
              onClick={addRow}
              className="bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600"
            >
              Add Entry
            </button>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg space-y-4">
            <h3 className="font-bold mb-2">Week Totals</h3>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Foreman Hours</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm">Regular</label>
                    <div className="font-bold text-lg">{totals.regularHours.foreman}</div>
                  </div>
                  <div>
                    <label className="block text-sm">1.5X</label>
                    <div className="font-bold text-lg">{totals.overtimeHours.foreman}</div>
                  </div>
                  <div>
                    <label className="block text-sm">2X</label>
                    <div className="font-bold text-lg">{totals.doubleHours.foreman}</div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Regular Hours</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm">Regular</label>
                    <div className="font-bold text-lg">{totals.regularHours.regular}</div>
                  </div>
                  <div>
                    <label className="block text-sm">1.5X</label>
                    <div className="font-bold text-lg">{totals.overtimeHours.regular}</div>
                  </div>
                  <div>
                    <label className="block text-sm">2X</label>
                    <div className="font-bold text-lg">{totals.doubleHours.regular}</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm">Total Miles</label>
                  <div className="font-bold text-lg">{totals.miles}</div>
                </div>
                <div>
                  <label className="block text-sm">Total Expenses</label>
                  <div className="font-bold text-lg">${totals.expenses.toFixed(2)}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block mb-1">Upload Receipt Photos</label>
            <p className="text-sm text-gray-600">Please upload any pictures of receipts</p>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                setReceiptPhotos(files);
              }}
              className="w-full p-2 border rounded"
            />
            <div className="text-sm text-gray-500">
              {receiptPhotos.length} photos selected
            </div>
          </div>

         <div className="pt-4">
           <button
             type="submit"
             className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors"
           >
             Submit Time Sheet
           </button>
         </div>
       </form>
     </div>
   </div>
 );
}