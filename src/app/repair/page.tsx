'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

// Define equipment types - same as maintenance form
type EquipmentType = 
  | 'Backstops' 
  | 'Bleachers' 
  | 'Gym Divider Curtain' 
  | 'Folding Partitions'
  | 'Wrestling Mat Hoists'
  | 'Batting Cages'
  | 'Outdoor Bleachers/Grandstands'
  | 'Scoreboard Equipment'
  | 'Stage Rigging'
  | 'Cafeteria Tables/Benches'
  | 'Climbing Ropes/Volleyball/Gymnastics'
  | 'Other';

// Form data interface
interface FormData {
  date: string;
  jobName: string;
  technicianName: string;
  jobNumber: string;
  selectedEquipment: EquipmentType[];
  repairSummaries: Record<string, string>;
  partsNeeded: Record<string, string>;
  equipmentTurnover: string;
  otherNotes: string;
  photos: File[];
}

// Equipment list - same as maintenance form
const equipmentList: EquipmentType[] = [
  'Backstops',
  'Bleachers',
  'Gym Divider Curtain',
  'Folding Partitions',
  'Wrestling Mat Hoists',
  'Batting Cages',
  'Outdoor Bleachers/Grandstands',
  'Scoreboard Equipment',
  'Stage Rigging',
  'Cafeteria Tables/Benches',
  'Climbing Ropes/Volleyball/Gymnastics',
  'Other'
];

export default function RepairForm() {
  // Initialize form data
  const createInitialFormData = (): FormData => {
    const initialRepairSummaries: Record<string, string> = {};
    const initialPartsNeeded: Record<string, string> = {};
    
    equipmentList.forEach(type => {
      initialRepairSummaries[type] = '';
      initialPartsNeeded[type] = '';
    });
    
    return {
      date: '',
      jobName: '',
      technicianName: '',
      jobNumber: '',
      selectedEquipment: [],
      repairSummaries: initialRepairSummaries,
      partsNeeded: initialPartsNeeded,
      equipmentTurnover: '',
      otherNotes: '',
      photos: []
    };
  };

  const [formData, setFormData] = useState<FormData>(createInitialFormData);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [textareaHeights, setTextareaHeights] = useState<Record<string, number>>({});

  // Handle form submission
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log('Form data:', formData);
    
    // Display success message
    alert('Your repair report has been submitted successfully');
    
    // Reset form
    setFormData(createInitialFormData);
    setIsSubmitted(true);
  };

  // Toggle equipment selection
  const toggleEquipmentSelection = (equipment: EquipmentType) => {
    setFormData(prev => {
      const isSelected = prev.selectedEquipment.includes(equipment);
      
      if (isSelected) {
        // Remove from selection
        return {
          ...prev,
          selectedEquipment: prev.selectedEquipment.filter(e => e !== equipment)
        };
      } else {
        // Add to selection
        return {
          ...prev,
          selectedEquipment: [...prev.selectedEquipment, equipment]
        };
      }
    });
  };

  // Update repair summary
  const handleRepairSummaryChange = (equipment: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      repairSummaries: {
        ...prev.repairSummaries,
        [equipment]: value
      }
    }));
  };

  // Update parts needed
  const handlePartsNeededChange = (equipment: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      partsNeeded: {
        ...prev.partsNeeded,
        [equipment]: value
      }
    }));
  };

  // Auto-resize textarea
  const handleTextAreaInput = (e: React.FormEvent<HTMLTextAreaElement>, id: string) => {
    const textarea = e.currentTarget;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
    
    setTextareaHeights(prev => ({
      ...prev,
      [id]: textarea.scrollHeight
    }));
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
        Repair Report
      </h1>

      <div className="max-w-3xl mx-auto bg-white p-6 rounded-lg shadow-md">
        {isSubmitted ? (
          <div className="text-center p-8">
            <div className="text-green-600 text-xl mb-4">Report Submitted Successfully!</div>
            <button
              onClick={() => setIsSubmitted(false)}
              className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors"
            >
              Create Another Report
            </button>
          </div>
        ) : (
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

            <div>
              <label className="block mb-2 font-medium">Select Equipment Serviced:</label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {equipmentList.map((equipment) => (
                  <button
                    key={equipment}
                    type="button"
                    onClick={() => toggleEquipmentSelection(equipment)}
                    className={`p-4 border-2 rounded-lg text-center flex items-center justify-center min-h-[4rem] ${
                      formData.selectedEquipment.includes(equipment)
                        ? 'bg-blue-100 border-blue-500'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <span>{equipment}</span>
                  </button>
                ))}
              </div>
            </div>

            {formData.selectedEquipment.length > 0 && (
              <div className="space-y-8">
                {formData.selectedEquipment.map((equipment) => (
                  <div key={equipment} className="p-4 border rounded-lg bg-gray-50 space-y-4">
                    <h3 className="font-bold text-lg">{equipment}</h3>
                    
                    <div>
                      <label className="block mb-1">Repair Service Summary:</label>
                      <p className="text-sm text-gray-600 mb-2">
                        Description of work performed
                      </p>
                      <textarea
                        value={formData.repairSummaries[equipment] || ''}
                        onChange={(e) => handleRepairSummaryChange(equipment, e.target.value)}
                        onInput={(e) => handleTextAreaInput(e, `summary-${equipment}`)}
                        className="w-full p-2 border rounded"
                        style={{ 
                          minHeight: '100px',
                          height: textareaHeights[`summary-${equipment}`] ? `${textareaHeights[`summary-${equipment}`]}px` : 'auto',
                          resize: 'none'
                        }}
                      />
                    </div>

                    <div>
                      <label className="block mb-1">Parts or Service Needed:</label>
                      <p className="text-sm text-gray-600 mb-2">
                        Do you need any other parts or labor after today to get equipment functional?
                      </p>
                      <textarea
                        value={formData.partsNeeded[equipment] || ''}
                        onChange={(e) => handlePartsNeededChange(equipment, e.target.value)}
                        onInput={(e) => handleTextAreaInput(e, `parts-${equipment}`)}
                        className="w-full p-2 border rounded"
                        style={{ 
                          minHeight: '100px',
                          height: textareaHeights[`parts-${equipment}`] ? `${textareaHeights[`parts-${equipment}`]}px` : 'auto',
                          resize: 'none'
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <label className="block mb-1">Equipment Turnover:</label>
              <p className="text-sm text-gray-600 mb-2">
                Did you leave scoreboard controller, key switch keys, or bleacher controller
                any place or with anyone?
              </p>
              <textarea
                value={formData.equipmentTurnover}
                onChange={e => setFormData({...formData, equipmentTurnover: e.target.value})}
                onInput={(e) => handleTextAreaInput(e, 'equipment-turnover')}
                className="w-full p-2 border rounded"
                style={{ 
                  minHeight: '80px',
                  height: textareaHeights['equipment-turnover'] ? `${textareaHeights['equipment-turnover']}px` : 'auto',
                  resize: 'none'
                }}
                placeholder="Describe any equipment left and with whom..."
              />
            </div>

            <div className="space-y-2">
              <label className="block mb-1">Any other notes?</label>
              <textarea
                value={formData.otherNotes}
                onChange={e => setFormData({...formData, otherNotes: e.target.value})}
                onInput={(e) => handleTextAreaInput(e, 'other-notes')}
                className="w-full p-2 border rounded"
                style={{ 
                  minHeight: '100px',
                  height: textareaHeights['other-notes'] ? `${textareaHeights['other-notes']}px` : 'auto',
                  resize: 'none'
                }}
                placeholder="Enter any additional notes or observations..."
              />
            </div>

            <div className="space-y-2">
              <label className="block mb-1">Upload Photos</label>
              <p className="text-sm text-gray-600 mb-2">
                Please upload any pictures of repairs performed
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

            <div className="pt-4">
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors"
              >
                Submit Report
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}