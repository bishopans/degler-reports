'use client';
import { useState, useEffect } from 'react';
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
  selectedEquipment: EquipmentType[];
  equipmentChecks: Record<EquipmentType, boolean[]>;
  additionalRepairs: Record<EquipmentType | string, string>;
  equipmentTurnover: string;
  otherNotes: string;
  photos: File[];
}

interface OutdoorBleacherData {
  location: string;
  manufacturer: string;
  height: string;
  length: string;
  meetCode: string;
  codeIssues: string;
}

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
  'Other': [] // No checklist for Other, we'll use separate text fields
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
  // Initialize form data
  const createInitialFormData = (): FormData => {
    const equipmentTypes = Object.keys(equipmentChecklists) as EquipmentType[];
    
    const initialEquipmentChecks: Record<EquipmentType, boolean[]> = {} as Record<EquipmentType, boolean[]>;
    const initialAdditionalRepairs: Record<EquipmentType, string> = {} as Record<EquipmentType, string>;
    
    equipmentTypes.forEach(type => {
      initialEquipmentChecks[type] = Array(equipmentChecklists[type].length).fill(true);
      initialAdditionalRepairs[type] = '';
    });
    
    return {
      date: '',
      jobName: '',
      technicianName: '',
      jobNumber: '',
      selectedEquipment: [],
      equipmentChecks: initialEquipmentChecks,
      additionalRepairs: initialAdditionalRepairs,
      equipmentTurnover: '',
      otherNotes: '',
      photos: []
    };
  };

  const [formData, setFormData] = useState<FormData>(createInitialFormData);
  const [outdoorBleacherData, setOutdoorBleacherData] = useState<OutdoorBleacherData>({
    location: '',
    manufacturer: '',
    height: '',
    length: '',
    meetCode: '',
    codeIssues: ''
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [textareaHeights, setTextareaHeights] = useState<Record<string, number>>({});

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log('Form data:', formData);
    console.log('Outdoor bleacher data:', outdoorBleacherData);
    
    // Display success message
    alert('Your report has been submitted successfully');
    
    // Reset form
    setFormData(createInitialFormData);
    setOutdoorBleacherData({
      location: '',
      manufacturer: '',
      height: '',
      length: '',
      meetCode: '',
      codeIssues: ''
    });
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

  // Handle checkbox change
  const handleCheckboxChange = (equipment: EquipmentType, index: number) => {
    setFormData(prev => {
      const newChecks = {...prev.equipmentChecks};
      newChecks[equipment] = [...newChecks[equipment]];
      newChecks[equipment][index] = !newChecks[equipment][index];
      
      return {
        ...prev,
        equipmentChecks: newChecks
      };
    });
  };

  // Handle additional repairs text change
  const handleAdditionalRepairsChange = (equipment: EquipmentType, value: string) => {
    setFormData(prev => {
      const newAdditionalRepairs = {...prev.additionalRepairs};
      newAdditionalRepairs[equipment] = value;
      
      return {
        ...prev,
        additionalRepairs: newAdditionalRepairs
      };
    });
  };

  // Auto-resize textarea
  const handleTextAreaInput = (e: React.ChangeEvent<HTMLTextAreaElement>, id: string) => {
    const textarea = e.target;
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
              <label className="block mb-2 font-medium">Select Equipment Type(s):</label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(Object.keys(equipmentChecklists) as EquipmentType[]).map((equipment) => {
                  // Find the longest equipment name to calculate min height
                  const longestName = Object.keys(equipmentChecklists).reduce((a, b) => 
                    a.length > b.length ? a : b
                  );
                  
                  return (
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
                  );
                })}
              </div>
            </div>

            {formData.selectedEquipment.length > 0 && (
              <div className="space-y-8">
                {formData.selectedEquipment.map((equipment) => (
                  <div key={equipment} className="p-4 border rounded-lg bg-gray-50 space-y-4">
                    <h3 className="font-bold text-lg">{equipment} Checklist</h3>
                    
                    {equipment !== 'Other' && (
                      <div className="space-y-2">
                        {equipmentChecklists[equipment].map((item, index) => (
                          <div key={index} className="flex items-start">
                            <div className="flex-shrink-0 mt-0.5">
                              <input 
                                type="checkbox" 
                                id={`${equipment}-checklist-${index}`} 
                                checked={formData.equipmentChecks[equipment][index]}
                                onChange={() => handleCheckboxChange(equipment, index)}
                                className="h-4 w-4" 
                              />
                            </div>
                            <label htmlFor={`${equipment}-checklist-${index}`} className="ml-2 text-sm">
                              {item}
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {equipment === 'Outdoor Bleachers/Grandstands' && (
                      <div className="mt-4 space-y-4">
                        <h4 className="font-medium">Additional Information:</h4>
                        <div>
                          <label className="block mb-1">{outdoorBleacherQuestions[0]}</label>
                          <input
                            type="text"
                            value={outdoorBleacherData.location}
                            onChange={(e) => setOutdoorBleacherData({...outdoorBleacherData, location: e.target.value})}
                            className="w-full p-2 border rounded"
                          />
                        </div>
                        <div>
                          <label className="block mb-1">{outdoorBleacherQuestions[1]}</label>
                          <input
                            type="text"
                            value={outdoorBleacherData.manufacturer}
                            onChange={(e) => setOutdoorBleacherData({...outdoorBleacherData, manufacturer: e.target.value})}
                            className="w-full p-2 border rounded"
                          />
                        </div>
                        <div>
                          <label className="block mb-1">{outdoorBleacherQuestions[2]}</label>
                          <input
                            type="text"
                            value={outdoorBleacherData.height}
                            onChange={(e) => setOutdoorBleacherData({...outdoorBleacherData, height: e.target.value})}
                            className="w-full p-2 border rounded"
                          />
                        </div>
                        <div>
                          <label className="block mb-1">{outdoorBleacherQuestions[3]}</label>
                          <input
                            type="text"
                            value={outdoorBleacherData.length}
                            onChange={(e) => setOutdoorBleacherData({...outdoorBleacherData, length: e.target.value})}
                            className="w-full p-2 border rounded"
                          />
                        </div>
                        <div>
                          <label className="block mb-1">{outdoorBleacherQuestions[4]}</label>
                          <input
                            type="text"
                            value={outdoorBleacherData.meetCode}
                            onChange={(e) => setOutdoorBleacherData({...outdoorBleacherData, meetCode: e.target.value})}
                            className="w-full p-2 border rounded"
                          />
                        </div>
                        <div>
                          <label className="block mb-1">{outdoorBleacherQuestions[5]}</label>
                          <textarea
                            value={outdoorBleacherData.codeIssues}
                            onChange={(e) => setOutdoorBleacherData({...outdoorBleacherData, codeIssues: e.target.value})}
                            onInput={(e) => handleTextAreaInput(e as React.ChangeEvent<HTMLTextAreaElement>, 'outdoor-code-issues')}
                            className="w-full p-2 border rounded"
                            style={{ 
                              minHeight: '80px',
                              height: textareaHeights['outdoor-code-issues'] ? `${textareaHeights['outdoor-code-issues']}px` : 'auto',
                              resize: 'none'
                            }}
                          />
                        </div>
                      </div>
                    )}
                    
                    {equipment === 'Other' && (
                      <div className="mt-4 space-y-4">
                        <div>
                          <label className="block mb-1">What equipment was serviced?</label>
                          <textarea
                            value={formData.additionalRepairs['Other-Equipment'] || ''}
                            onChange={(e) => handleAdditionalRepairsChange('Other-Equipment' as any, e.target.value)}
                            onInput={(e) => handleTextAreaInput(e as React.ChangeEvent<HTMLTextAreaElement>, 'other-equipment')}
                            className="w-full p-2 border rounded"
                            style={{ 
                              minHeight: '80px',
                              height: textareaHeights['other-equipment'] ? `${textareaHeights['other-equipment']}px` : 'auto',
                              resize: 'none'
                            }}
                          />
                        </div>
                        <div>
                          <label className="block mb-1">What tasks were performed?</label>
                          <textarea
                            value={formData.additionalRepairs['Other-Tasks'] || ''}
                            onChange={(e) => handleAdditionalRepairsChange('Other-Tasks' as any, e.target.value)}
                            onInput={(e) => handleTextAreaInput(e as React.ChangeEvent<HTMLTextAreaElement>, 'other-tasks')}
                            className="w-full p-2 border rounded"
                            style={{ 
                              minHeight: '80px',
                              height: textareaHeights['other-tasks'] ? `${textareaHeights['other-tasks']}px` : 'auto',
                              resize: 'none'
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {equipment !== 'Other' && (
                      <div>
                        <label className="block mb-1">List any other repairs made and if any other parts are recommended:</label>
                        <textarea
                          value={formData.additionalRepairs[equipment]}
                          onChange={(e) => handleAdditionalRepairsChange(equipment, e.target.value)}
                          onInput={(e) => handleTextAreaInput(e as React.ChangeEvent<HTMLTextAreaElement>, `repairs-${equipment}`)}
                          className="w-full p-2 border rounded"
                          style={{ 
                            minHeight: '100px',
                            height: textareaHeights[`repairs-${equipment}`] ? `${textareaHeights[`repairs-${equipment}`]}px` : 'auto',
                            resize: 'none'
                          }}
                        />
                      </div>
                    )}
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
                onInput={(e) => handleTextAreaInput(e as React.ChangeEvent<HTMLTextAreaElement>, 'equipment-turnover')}
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
                onInput={(e) => handleTextAreaInput(e as React.ChangeEvent<HTMLTextAreaElement>, 'other-notes')}
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