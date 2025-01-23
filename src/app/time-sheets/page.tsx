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
 regularHours: number;
 overtimeHours: number;
 doubleHours: number;
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
   entryNumber: 1,
   date: '',
   jobNameNumber: '',
   scopeOfWork: '',
   regularHours: 0,
   overtimeHours: 0,
   doubleHours: 0,
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
       entryNumber: prev.entries.length + 1,
       date: '',
       jobNameNumber: '',
       scopeOfWork: '',
       regularHours: 0,
       overtimeHours: 0,
       doubleHours: 0,
       miles: 0,
       expenses: 0,
       expenseDescription: ''
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

 const updateEntry = (id: string, field: keyof TimeEntry, value: string | number) => {
   setFormData(prev => ({
     ...prev,
     entries: prev.entries.map(entry => 
       entry.id === id ? { ...entry, [field]: value } : entry
     )
   }));
 };

 const calculateTotals = () => {
   return formData.entries.reduce((acc, entry) => ({
     regularHours: acc.regularHours + (Number(entry.regularHours) || 0),
     overtimeHours: acc.overtimeHours + (Number(entry.overtimeHours) || 0),
     doubleHours: acc.doubleHours + (Number(entry.doubleHours) || 0),
     miles: acc.miles + (Number(entry.miles) || 0),
     expenses: acc.expenses + (Number(entry.expenses) || 0)
   }), { regularHours: 0, overtimeHours: 0, doubleHours: 0, miles: 0, expenses: 0 });
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

             <div>
               <label className="block mb-1">Expense Description</label>
               <input
                 type="text"
                 value={entry.expenseDescription}
                 onChange={e => updateEntry(entry.id, 'expenseDescription', e.target.value)}
                 className="w-full p-2 border rounded"
               />
             </div>

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

         <div className="bg-gray-50 p-4 rounded-lg">
           <h3 className="font-bold mb-2">Week Totals</h3>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div>
               <label className="block text-sm">Regular Hours</label>
               <div className="font-bold text-lg">{totals.regularHours}</div>
             </div>
             <div>
               <label className="block text-sm">1.5X Hours</label>
               <div className="font-bold text-lg">{totals.overtimeHours}</div>
             </div>
             <div>
               <label className="block text-sm">2X Hours</label>
               <div className="font-bold text-lg">{totals.doubleHours}</div>
             </div>
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

         <div className="flex justify-center">
           <button
             type="button"
             onClick={addRow}
             className="bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600"
           >
             Add Entry
           </button>
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