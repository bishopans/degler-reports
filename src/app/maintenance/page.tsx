'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

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

interface FormData {
  date: string;
  jobName: string;
  technicianName: string;
  jobNumber: string;
  selectedEquipment: EquipmentType | null;
  additionalRepairs: string;
  equipmentTurnover: string;
  otherNotes: string;
  photos: File[];
}

const initialFormData: FormData = {
  date: '',
  jobName: '',
  technicianName: '',
  jobNumber: '',
  selectedEquipment: null,
  additionalRepairs: '',
  equipmentTurnover: '',
  otherNotes: '',
  photos: []
};

// Equipment checklists
const equipmentChecklists = {
  'Backstops': [
    'Inspect and tighten all building point attachments and fasteners',
    'Inspect and tighten all integral connections',
    'Inspect all welds and frame metals for signs of cracking or weakness',
    'Lubricate all fittings and moving parts where required',
    'Check and adjust all Winch settings, cables and pulleys',
    'Adjust all Backboards to 10\' rim height and square them with the court as needed',
    'Check all Goals for proper height alignment, broken welds and net attachment points',
    'Inspect all electrical motors, wiring and limit switches for proper function',
    'Inspect and test all Safety Straps for fraying belts, proper alignment and function',
    'Inspect and tighten all attachment bolts on board Safety Pads',
    'Overall Inspection of equipment for proper function and to ensure they are safe for everyday use and operation under normal conditions'
  ],
  'Bleachers': [
    'Inspect all building point attachments and correct as needed',
    'Inspect understructure for broken welds and fatigued metal',
    'Inspect and align all row locks and linkage assemblies to the same locking point',
    'Lubricate row locks and all moving parts as needed with White Lithium Grease',
    'Adjust row operating clearance (spacing between rows)',
    'Inspect all wheels and wheel channels for proper operation',
    'Align and adjust all bleachers for proper stacking and operation',
    'Inspect all rollers, drive chains and sprockets',
    'Inspect and clean motors and wiring for proper function (if equipped)',
    'Inspect all remote and pendant controllers for proper function (if equipped)',
    'Inspect the top side aisles/seats/handrails/end rails/deck boards and tighten and adjust as required',
    'Perform overall Inspection of bleachers for safety and everyday use and operation under normal conditions per ICC-300 bleacher standards'
  ],
  'Gym Divider Curtain': [
    'Inspect and tighten all building point attachments and fasteners',
    'Adjust the line shaft for level',
    'Re/spool and center the cable drums or straps (where needed)',
    'Adjust height for 1" clearance under curtain in down position',
    'Inspect all pipe connections (top & bottom Of curtain) and reattach if required',
    'Grease all fittings where required',
    'Adjust Limit Switches',
    'Inspect all electrical motors, wiring switches for proper function',
    'Inspect and test all Safety Straps for fraying belts, proper alignment and function',
    'Overall Inspection of equipment for proper function and to ensure they are safe for everyday use and operation under normal conditions'
  ],
  'Folding Partitions': [
    'Adjust all Doors for Plumb and Level',
    'Check all building point attachments',
    'Check all integral connections and make all necessary repairs',
    'Check and correct all Hinge locations where required',
    'Inspect, Clean and Grease Track',
    'Inspect (CLEAN) and correct floor seal operation',
    'Make a list of any manufactured Parts needed (if any)',
    'Check all pass doors and make all necessary adjustments',
    'Insurer ease of use and safety during normal operation'
  ],
  'Wrestling Mat Hoists': [
    'Inspect and tighten all building point attachments and fasteners',
    'Adjust the load bar for level',
    'Re/spool and center the cable drums (where needed)',
    'Clean reed devices',
    'Inspect all pipe connections (top & bottom Of curtain) and reattach if required',
    'Grease all fittings where required',
    'Adjust Limit Switches',
    'Inspect all electrical motors, wiring switches for proper function',
    'Inspect and test all Safety Straps for fraying belts, proper alignment and function',
    'Overall Inspection of equipment for proper function and to ensure they are safe for everyday use and operation under normal conditions'
  ],
  'Batting Cages': [
    'Inspect and tighten all building point attachments and fasteners',
    'Adjust the cage frame for level',
    'Re/spool and center the cable drums (where needed)',
    'Inspect the netting for holes and note any large gaps needing patching',
    'Inspect all pipe connections (top & bottom Of curtain) and reattach if required',
    'Grease all fittings where required',
    'Adjust Limit Switches',
    'Inspect all electrical motors, wiring switches for proper function',
    'Inspect and test all Safety Straps for fraying belts, proper alignment and function',
    'Overall Inspection of equipment for proper function and to ensure they are safe for everyday use and operation under normal conditions'
  ],
  'Outdoor Bleachers/Grandstands': [
    'Provide an Inspection of the Home and Visitors Sections & Press Box or any other Outdoor Bleachers per ICC-300 Code Standards',
    'Inspect all structural connections / walkways / kickboards / seat benches',
    'Inspect all welds, bolted connections and frame metals for signs of rust, cracking or weakness',
    'Inspect and tighten all loose hardware, nuts, bolts, screws, etc., throughout entire structure including all aisle & barrier railings, seat & riser planks and kick boards',
    'Inspect all seat planks, riser planks and kickboards for any damage, excessive bowing and deflection',
    'Inspect and replace any missing nuts, bolts, screws, rivets and seat clips (if possible)',
    'Check all safety fencing at sides, rear and along the front edge of structure for any gaps exceeding 4" per code',
    'Check and inspect all aisle railings and front, side & rear barriers for any gaps exceeding 4" per code',
    'Confirm that all side barrier railings extend to 42" high from the leading edge of the walking deck per code',
    'Confirm that all rear barrier railings extend to 42" high from the top row seat bench per code',
    'Confirm that all front barrier railings extend to 36" high from the surface of the 1st row walking deck per code',
    'Inspect all understructure, including all anchor points at concrete foundation',
    'Confirm that all points on grandstands or outdoor bleachers greater than 30" in height has fencing, railings, or barriers installed per code (4" gap rule also applies)',
    'Overall inspection of grandstands and outdoor bleachers to ensure they are safe for everyday use under normal conditions',
    'Provide a list of any needed parts or recommended repairs; make sure to document location and take pictures'
  ],
  'Scoreboard Equipment': [
    'Inspect and perform general maintenance for safe everyday use',
    'Inspect and tighten as needed all anchor hardware, brackets, and clamps',
    'Inspect all wiring, LEDs, harnesses, and electronics ensuring a proper connection, cleaning any corrosion',
    'Ensure equipment is communicating properly with control systems'
  ],
  'Stage Rigging': [
    'Inspect and Tighten as needed all building Point attachments',
    'Inspect all rope hoists and rope for signs of wear',
    'Inspect all counterbalance floor plates',
    'Grease all fittings where required',
    'Check and adjust all Winch settings, cables, cable clamps',
    'Check all pulleys',
    'Inspect all overhead track, light-bars, support-battens, cleats, and chains'
  ],
  'Cafeteria Tables/Benches': [
    'Check all hardware and tighten where required',
    'Ensure proper operation of all Gas Springs',
    'Ensure proper operation of all locking mechanisms on tables and benches',
    'Check wall pockets for fatigued metal, damaged locking channels, wall anchors',
    'Check all tables tops and benches for loose border stripping and damage',
    'Check all wheels and axels to ensure proper operation',
    'Check all floor protection pads are present on table/bench legs',
    'Check frames for any broken welds or damaged components'
  ],
  'Climbing Ropes/Volleyball/Gymnastics': [
    'Tighten all upper structure clamps or fasteners',
    'Inspect all hardware and connections, tighten/replace as needed',
    'Lubricate as required',
    'Inspect all cables and pulleys and foundation structures for signs of fatigue',
    'Ensure equipment is safe for everyday use and operation under normal conditions'
  ],
  'Other': [
    'What equipment was serviced?',
    'What tasks were performed?'
  ]
};

// Additional questions for outdoor bleachers
const outdoorBleacherQuestions = [
  'Location of Outdoor Bleachers (Soccer Field/Baseball Field/Football Field)?',
  'Manufacturer?',
  'Bleacher Height / Rows High?',
  'Bleacher Length?',
  'Does structure meet code requirements listed above? (Yes/No):',
  'What items do not meet code requirements and reason?'
];

export default function MaintenanceForm() {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [outdoorBleacherAnswers, setOutdoorBleacherAnswers] = useState<string[]>(Array(outdoorBleacherQuestions.length).fill(''));
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log('Form data:', formData);
    console.log('Outdoor bleacher answers:', outdoorBleacherAnswers);
    
    // Display success message
    alert('Your report has been submitted successfully');
    
    // Reset form
    setFormData(initialFormData);
    setOutdoorBleacherAnswers(Array(outdoorBleacherQuestions.length).fill(''));
    setIsSubmitted(true);
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
        Preventative Maintenance/Inspection Report
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
              <label className="block mb-2 font-medium">Select Equipment Type:</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {(Object.keys(equipmentChecklists) as EquipmentType[]).map((equipment) => (
                  <button
                    key={equipment}
                    type="button"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      selectedEquipment: equipment
                    }))}
                    className={`p-4 border-2 rounded-lg text-left ${
                      formData.selectedEquipment === equipment
                        ? 'bg-blue-100 border-blue-500'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    {equipment}
                  </button>
                ))}
              </div>
            </div>

            {formData.selectedEquipment && (
              <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                <h3 className="font-bold text-lg">{formData.selectedEquipment} Checklist</h3>
                
                <div className="space-y-2">
                  {equipmentChecklists[formData.selectedEquipment].map((item, index) => (
                    <div key={index} className="flex items-start">
                      <div className="flex-shrink-0 mt-0.5">
                        <input 
                          type="checkbox" 
                          id={`checklist-${index}`} 
                          checked={true}
                          readOnly
                          className="h-4 w-4" 
                        />
                      </div>
                      <label htmlFor={`checklist-${index}`} className="ml-2 text-sm">
                        {item}
                      </label>
                    </div>
                  ))}
                </div>
                
                {formData.selectedEquipment === 'Outdoor Bleachers/Grandstands' && (
                  <div className="mt-4 space-y-4">
                    <h4 className="font-medium">Additional Information:</h4>
                    {outdoorBleacherQuestions.map((question, index) => (
                      <div key={index}>
                        <label className="block mb-1">{question}</label>
                        <input
                          type="text"
                          value={outdoorBleacherAnswers[index]}
                          onChange={(e) => {
                            const newAnswers = [...outdoorBleacherAnswers];
                            newAnswers[index] = e.target.value;
                            setOutdoorBleacherAnswers(newAnswers);
                          }}
                          className="w-full p-2 border rounded"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <label className="block mb-1">List any other repairs made and if any other parts are recommended:</label>
                  <textarea
                    value={formData.additionalRepairs}
                    onChange={e => setFormData({...formData, additionalRepairs: e.target.value})}
                    className="w-full p-2 border rounded min-h-[100px]"
                    placeholder="Detail any repairs made or parts recommended..."
                  />
                </div>
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
                className="w-full p-2 border rounded min-h-[80px]"
                placeholder="Describe any equipment left and with whom..."
              />
            </div>

            <div className="space-y-2">
              <label className="block mb-1">Any other notes?</label>
              <textarea
                value={formData.otherNotes}
                onChange={e => setFormData({...formData, otherNotes: e.target.value})}
                className="w-full p-2 border rounded min-h-[100px]"
                placeholder="Enter any additional notes or observations..."
              />
            </div>

            <div className="space-y-2">
              <label className="block mb-1">Upload Photos</label>
              <p className="text-sm text-gray-600 mb-2">
                Please upload any pictures of equipment or maintenance performed
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