'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';

const SignaturePad = dynamic(() => import('react-signature-canvas'), {
 ssr: false
});

export default function MaterialTurnoverForm() {
 const [formData, setFormData] = useState({
   date: '',
   jobName: '',
   installerName: '',
   jobNumber: '',
   turnoverItems: '',
   recipientName: '',
   recipientType: '',
   signature: '',
   photos: [] as File[]
 });

 const handleSubmit = async (e: React.FormEvent) => {
   e.preventDefault();
   console.log(formData);
   alert('Your report has been submitted');
   setFormData({
     date: '',
     jobName: '',
     installerName: '',
     jobNumber: '',
     turnoverItems: '',
     recipientName: '',
     recipientType: '',
     signature: '',
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
       Material Turnover Report
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

         {/* Turnover Items Section */}
         <div className="space-y-2">
           <label className="block mb-1">What are you turning over?</label>
           <textarea
             value={formData.turnoverItems}
             onChange={e => setFormData({...formData, turnoverItems: e.target.value})}
             className="w-full p-2 border rounded min-h-[150px]"
             placeholder="List each item and quantity of equipment being turned over. Example: 2 pair of keys, 1 bleacher pendant switch, 2 MP-80 scoreboard controllers"
             required
           />
         </div>

         {/* Recipient Section */}
         <div>
           <label className="block mb-1">Full Name of recipient:</label>
           <input
             type="text"
             value={formData.recipientName}
             onChange={e => setFormData({...formData, recipientName: e.target.value})}
             className="w-full p-2 border rounded"
             required
           />
         </div>

         {/* Recipient Type Selection */}
         <div className="space-y-2">
           <label className="block mb-1">They are with: (select one)</label>
           <div className="flex space-x-4">
             {['Site Staff', 'GC', 'Other'].map((type) => (
               <button
                 key={type}
                 type="button"
                 onClick={() => setFormData({...formData, recipientType: type})}
                 className={`p-2 border rounded ${
                   formData.recipientType === type ? 'bg-blue-100 border-blue-500' : ''
                 }`}
               >
                 {type}
               </button>
             ))}
           </div>
         </div>

         {/* Signature Section */}
         <div className="space-y-2">
           <label className="block mb-1">Signature of recipient:</label>
           <div className="border rounded p-2 bg-white">
             <div id="signature-pad" className="border rounded h-40">
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
           <p className="text-sm text-gray-600 italic mt-2">
             "Signer assumes responsibility and ownership of listed equipment from this day forth and Degler 
             Whiting will no longer be liable or obligated to provide listed equipment."
           </p>
         </div>

         {/* Photo Upload Section */}
         <div className="space-y-2">
           <label className="block mb-1">Upload Turnover Photos</label>
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