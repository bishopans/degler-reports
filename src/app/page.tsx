'use client';
import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
 return (
   <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white">
     <div className="w-[300px] mb-8">
       <Image
         src="/images/logo.png"
         alt="Degler Whiting Logo"
         width={300}
         height={300}
         className="w-full"
         priority
       />
     </div>

     <h1 className="text-3xl font-bold mb-12">Select a Report</h1>
     
     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl">
       <Link 
         href="/maintenance" 
         className="p-8 border-2 rounded-lg hover:bg-blue-50 text-center shadow-sm hover:shadow-md transition-all flex items-center justify-center min-h-[100px]"
       >
         <div className="text-center">
           <div>Preventative Maintenance</div>
           <div>/Inspection</div>
         </div>
       </Link>
       
       <Link 
         href="/repair" 
         className="p-8 border-2 rounded-lg hover:bg-blue-50 text-center shadow-sm hover:shadow-md transition-all flex items-center justify-center min-h-[100px]"
       >
         Repair
       </Link>
       
       <Link 
         href="/material-delivery" 
         className="p-8 border-2 rounded-lg hover:bg-blue-50 text-center shadow-sm hover:shadow-md transition-all flex items-center justify-center min-h-[100px]"
       >
         Material Delivery
       </Link>
       
       <Link 
         href="/material-turnover" 
         className="p-8 border-2 rounded-lg hover:bg-blue-50 text-center shadow-sm hover:shadow-md transition-all flex items-center justify-center min-h-[100px]"
       >
         Material Turnover
       </Link>
       
       <Link 
         href="/training" 
         className="p-8 border-2 rounded-lg hover:bg-blue-50 text-center shadow-sm hover:shadow-md transition-all flex items-center justify-center min-h-[100px]"
       >
         Training
       </Link>

       <Link 
         href="/jobsite-progress" 
         className="p-8 border-2 rounded-lg hover:bg-blue-50 text-center shadow-sm hover:shadow-md transition-all flex items-center justify-center min-h-[100px]"
       >
         Job Site Progress
       </Link>

       <Link 
         href="/time-sheets" 
         className="p-8 border-2 rounded-lg hover:bg-blue-50 text-center shadow-sm hover:shadow-md transition-all flex items-center justify-center min-h-[100px]"
       >
         Time Sheets
       </Link>

       <Link 
         href="/other" 
         className="p-8 border-2 rounded-lg hover:bg-blue-50 text-center shadow-sm hover:shadow-md transition-all flex items-center justify-center min-h-[100px]"
       >
         Other
       </Link>
     </div>
   </div>
 );
}