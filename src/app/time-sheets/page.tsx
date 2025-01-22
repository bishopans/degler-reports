'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface TimeEntry {
  id: string;
  date: string;
  jobNameNumber: string;
  scopeOfWork: string;
  hours: number;
  miles: number;
  expenses: number;
  expenseDescription: string;
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
    date: '',
    jobNameNumber: '',
    scopeOfWork: '',
    hours: 0,
    miles: 0,
    expenses: 0,
    expenseDescription: ''
  }]
};

const rankOptions = [
  'Foreman',
  'Journeyman',
  'Apprentice 1st Yr',
  'Apprentice 2nd Yr',
  'Apprentice 3rd Yr',
  'Apprentice 4th Yr'
];

export default function TimeSheetForm() {
  const [formData, setFormData] = useState<FormData>(initialFormData);

  const addRow = () => {
    setFormData(prev => ({
      ...prev,
      entries: [...prev.entries, {
        id: Date.now().toString(),
        date: '',
        jobNameNumber: '',
        scopeOfWork: '',
        hours: 0,
        miles: 0,
        expenses: 0,
        expenseDescription: ''
      }]
    }));
  };

  const removeRow = (id: string) => {
    setFormData(prev => ({
      ...prev,
      entries: prev.entries.filter(entry => entry.id !== id)
    }));
  };

  const updateEntry = (id: string, field: keyof TimeEntry, value: any) => {
    setFormData(prev => ({
      ...prev,
      entries: prev.entries.map(entry => 
        entry.id === id ? { ...entry, [field]: value } : entry
      )
    }));
  };

  const calculateTotals = () => {
    return formData.entries.reduce((acc, entry) => ({
      hours: acc.hours + (Number(entry.hours) || 0),
      miles: acc.miles + (Number(entry.miles) || 0),
      expenses: acc.expenses + (Number(entry.expenses) || 0)
    }), { hours: 0, miles: 0, expenses: 0 });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log(formData);
    alert('Time Sheet submitted successfully');
    setFormData(initialFormData);
  };

  const totals = calculateTotals();

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
        Time Sheet
      </h1>

      <div className="max-w-7xl mx-auto bg-white p-6 rounded-lg shadow-md">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Header Information */}
          <div className="grid grid-cols-2 gap-4">
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
              <label className="block mb-1">Rank</label>
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

          {/* Time Entries Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border">
              <thead>
                <tr>
                  <th className="border p-2">Date</th>
                  <th className="border p-2">Job Name and Number</th>
                  <th className="border p-2">Brief Scope of Work</th>
                  <th className="border p-2">Hours</th>
                  <th className="border p-2">Miles</th>
                  <th className="border p-2">$ Expenses</th>
                  <th className="border p-2">Expense Description</th>
                  <th className="border p-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {formData.entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="border p-2">
                      <input
                        type="date"
                        value={entry.date}
                        onChange={e => updateEntry(entry.id, 'date', e.target.value)}
                        className="w-full p-1"
                        required
                      />
                    </td>
                    <td className="border p-2">
                      <input
                        type="text"
                        value={entry.jobNameNumber}
                        onChange={e => updateEntry(entry.id, 'jobNameNumber', e.target.value)}
                        className="w-full p-1"
                        required
                      />
                    </td>
                    <td className="border p-2">
                      <input
                        type="text"
                        value={entry.scopeOfWork}
                        onChange={e => updateEntry(entry.id, 'scopeOfWork', e.target.value)}
                        className="w-full p-1"
                        required
                      />
                    </td>
                    <td className="border p-2">
                      <input
                        type="number"
                        value={entry.hours || ''}
                        onChange={e => updateEntry(entry.id, 'hours', Number(e.target.value))}
                        className="w-full p-1"
                        min="0"
                        step="0.5"
                        required
                      />
                    </td>
                    <td className="border p-2">
                      <input
                        type="number"
                        value={entry.miles || ''}
                        onChange={e => updateEntry(entry.id, 'miles', Number(e.target.value))}
                        className="w-full p-1"
                        min="0"
                        required
                      />
                    </td>
                    <td className="border p-2">
                      <input
                        type="number"
                        value={entry.expenses || ''}
                        onChange={e => updateEntry(entry.id, 'expenses', Number(e.target.value))}
                        className="w-full p-1"
                        min="0"
                        step="0.01"
                      />
                    </td>
                    <td className="border p-2">
                      <input
                        type="text"
                        value={entry.expenseDescription}
                        onChange={e => updateEntry(entry.id, 'expenseDescription', e.target.value)}
                        className="w-full p-1"
                      />
                    </td>
                    <td className="border p-2">
                      <button
                        type="button"
                        onClick={() => removeRow(entry.id)}
                        className="text-red-600 hover:text-red-800"
                        disabled={formData.entries.length === 1}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="border p-2 text-right font-bold">Totals:</td>
                  <td className="border p-2 font-bold">{totals.hours}</td>
                  <td className="border p-2 font-bold">{totals.miles}</td>
                  <td className="border p-2 font-bold">${totals.expenses.toFixed(2)}</td>
                  <td colSpan={2} className="border p-2"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Add Row Button */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={addRow}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              Add Row
            </button>
          </div>

          {/* Submit Button */}
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