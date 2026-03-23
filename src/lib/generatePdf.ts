'use client';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Submission {
  id: string;
  created_at: string;
  updated_at?: string;
  report_type: string;
  date: string;
  job_name: string;
  job_number: string;
  technician_name: string;
  form_data: Record<string, unknown>;
  photo_urls: string[];
  signature_urls: string[];
  status: string;
  notes: string | null;
  edited_by?: string | null;
  edited_at?: string | null;
}

// Helper to load an image URL as base64 using an img element (avoids CORS fetch issues)
// Set whiteBackground=true for logos with transparency
async function loadImageAsBase64(url: string, whiteBackground = false): Promise<string | null> {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      console.warn('Image load timed out:', url);
      resolve(null);
    }, 10000); // 10 second timeout

    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      clearTimeout(timeoutId);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          if (whiteBackground) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
          ctx.drawImage(img, 0, 0);
          const format = whiteBackground ? 'image/png' : 'image/jpeg';
          resolve(canvas.toDataURL(format, 0.92));
        } else {
          resolve(null);
        }
      } catch (e) {
        console.warn('Canvas draw failed:', e);
        resolve(null);
      }
    };
    img.onerror = () => {
      clearTimeout(timeoutId);
      console.warn('Image failed to load:', url);
      resolve(null);
    };
    img.src = url;
  });
}

// Constants
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_LEFT = 15;
const MARGIN_RIGHT = 15;
const MARGIN_TOP = 15;
const MARGIN_BOTTOM = 15;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const LINE_HEIGHT = 7;
const SECTION_SPACING = 6;

// Brand colors
const BRAND_BLUE = { r: 0, g: 69, b: 124 };
const BRAND_RED = { r: 171, g: 5, b: 52 };
const BRAND_GOLD = { r: 200, g: 164, b: 21 }; // logo gold (eagle, stars, laurel)
const LIGHT_BLUE_BG = { r: 230, g: 240, b: 250 }; // light blue for checklist background
const LIGHT_GRAY_BG = { r: 245, g: 245, b: 245 };

let currentY = MARGIN_TOP;
let logoBase64: string | null = null;
let qrBase64: string | null = null;
let faviconBase64: string | null = null;

// Load and convert logo to base64
async function loadLogoAsBase64(): Promise<string> {
  if (logoBase64) return logoBase64;

  try {
    const result = await loadImageAsBase64('/images/logo.png', true);
    if (result) {
      logoBase64 = result;
      return result;
    }
    return '';
  } catch (error) {
    console.warn('Failed to load logo:', error);
    return '';
  }
}

// Load QR code image
async function loadQrAsBase64(): Promise<string> {
  if (qrBase64) return qrBase64;

  try {
    const result = await loadImageAsBase64('/images/qr-code.jpg', true);
    if (result) {
      qrBase64 = result;
      return result;
    }
    return '';
  } catch (error) {
    console.warn('Failed to load QR code:', error);
    return '';
  }
}

// Load favicon/crest icon for use as section divider
async function loadFaviconAsBase64(): Promise<string> {
  if (faviconBase64) return faviconBase64;

  try {
    const result = await loadImageAsBase64('/favicon.ico', true);
    if (result) {
      faviconBase64 = result;
      return result;
    }
    return '';
  } catch (error) {
    console.warn('Failed to load favicon:', error);
    return '';
  }
}

// Draws the DW crest icon centered between two thin lines as a section divider
async function addCrestDivider(doc: jsPDF) {
  currentY += 4;
  const iconData = await loadFaviconAsBase64();
  const iconSize = 16; // mm
  const centerX = PAGE_WIDTH / 2;
  const lineGap = 3; // gap between line end and icon

  // Left line
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_LEFT, currentY + iconSize / 2, centerX - iconSize / 2 - lineGap, currentY + iconSize / 2);

  // Right line
  doc.line(centerX + iconSize / 2 + lineGap, currentY + iconSize / 2, PAGE_WIDTH - MARGIN_RIGHT, currentY + iconSize / 2);

  // Crest icon centered
  if (iconData) {
    doc.addImage(iconData, 'PNG', centerX - iconSize / 2, currentY, iconSize, iconSize);
  }

  currentY += iconSize + 2;
}

function addText(
  doc: jsPDF,
  text: string,
  label?: string,
  isBold = false,
  fontSize = 10
) {
  const fontStyle = isBold ? 'bold' : 'normal';

  doc.setFont('helvetica', fontStyle);
  doc.setFontSize(fontSize);

  if (label) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const labelStr = `${label}:  `;
    const labelWidth = doc.getTextWidth(labelStr) + 1; // measure while bold font is set, +1mm buffer
    doc.text(`${label}: `, MARGIN_LEFT, currentY);

    doc.setFont('helvetica', fontStyle);
    doc.setFontSize(fontSize);
    const maxTextWidth = CONTENT_WIDTH - labelWidth;
    const wrappedText = doc.splitTextToSize(text, maxTextWidth);

    wrappedText.forEach((line: string, index: number) => {
      if (index === 0) {
        doc.text(line, MARGIN_LEFT + labelWidth, currentY);
      } else {
        currentY += LINE_HEIGHT;
        checkPageBreak(doc, LINE_HEIGHT);
        doc.text(line, MARGIN_LEFT + labelWidth, currentY);
      }
    });
    currentY += LINE_HEIGHT + 2; // extra padding after labeled fields
  } else {
    const wrappedText = doc.splitTextToSize(text, CONTENT_WIDTH);
    wrappedText.forEach((line: string) => {
      checkPageBreak(doc, LINE_HEIGHT);
      doc.text(line, MARGIN_LEFT, currentY);
      currentY += LINE_HEIGHT;
    });
  }
}

function addHeading(doc: jsPDF, text: string, fontSize = 12) {
  checkPageBreak(doc, fontSize + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fontSize);
  doc.text(text, MARGIN_LEFT, currentY);
  currentY += 2;

  // Add subtle horizontal line
  doc.setDrawColor(150, 150, 150);
  doc.line(MARGIN_LEFT, currentY, PAGE_WIDTH - MARGIN_RIGHT, currentY);
  currentY += 4;
}

function addHorizontalLine(doc: jsPDF) {
  doc.setDrawColor(150, 150, 150);
  doc.line(MARGIN_LEFT, currentY, PAGE_WIDTH - MARGIN_RIGHT, currentY);
  currentY += 4;
}

// Branded equipment section header — blue bar with white text
function addEquipmentHeader(doc: jsPDF, text: string) {
  checkPageBreak(doc, 16);
  // Blue background bar
  doc.setFillColor(BRAND_BLUE.r, BRAND_BLUE.g, BRAND_BLUE.b);
  doc.rect(MARGIN_LEFT, currentY - 1, CONTENT_WIDTH, 10, 'F');
  // White text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(text.toUpperCase(), MARGIN_LEFT + 4, currentY + 5.5);
  doc.setTextColor(0, 0, 0);
  currentY += 14;
}

// Red divider bar between equipment sections — with extra spacing
function addBrandDivider(doc: jsPDF) {
  currentY += 4; // extra space before divider
  checkPageBreak(doc, 10);
  doc.setFillColor(BRAND_RED.r, BRAND_RED.g, BRAND_RED.b);
  doc.rect(MARGIN_LEFT, currentY, CONTENT_WIDTH, 1.5, 'F');
  currentY += 10; // extra space after divider
}

// Checklist item with checkmark or X — dynamically sized rows
function addChecklistItem(doc: jsPDF, text: string, checked: boolean, index: number) {
  const TEXT_FONT_SIZE = 8.5;
  const LINE_SPACING = 4.2; // spacing between wrapped lines
  const ROW_PADDING_TOP = 3.5; // padding above text inside row
  const ROW_PADDING_BOTTOM = 3; // padding below text inside row
  const MIN_ROW_HEIGHT = 8; // minimum row height for single-line items

  // Pre-calculate wrapped text to determine row height
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(TEXT_FONT_SIZE);
  const wrappedText: string[] = doc.splitTextToSize(text, CONTENT_WIDTH - 14);
  const textHeight = wrappedText.length === 1
    ? 0
    : (wrappedText.length - 1) * LINE_SPACING;
  const rowHeight = Math.max(MIN_ROW_HEIGHT, ROW_PADDING_TOP + textHeight + ROW_PADDING_BOTTOM + 1);

  checkPageBreak(doc, rowHeight + 1);

  // Row background
  const rowTopY = currentY - ROW_PADDING_TOP;
  if (index % 2 === 0) {
    doc.setFillColor(LIGHT_BLUE_BG.r, LIGHT_BLUE_BG.g, LIGHT_BLUE_BG.b);
  } else {
    doc.setFillColor(255, 255, 255);
  }
  doc.rect(MARGIN_LEFT, rowTopY, CONTENT_WIDTH, rowHeight, 'F');

  // Light bottom border for each row
  doc.setDrawColor(210, 220, 230);
  doc.setLineWidth(0.15);
  doc.line(MARGIN_LEFT, rowTopY + rowHeight, MARGIN_LEFT + CONTENT_WIDTH, rowTopY + rowHeight);

  // Draw checkmark or X as vector graphics (unicode doesn't render reliably in jsPDF)
  const iconX = MARGIN_LEFT + 2.5;
  const iconCenterY = currentY - 0.5; // vertically center icon with first line of text
  const iconSize = 2.5;
  doc.setLineWidth(0.55);

  if (checked) {
    // Green checkmark — two lines forming a check shape
    doc.setDrawColor(0, 130, 0);
    doc.line(iconX, iconCenterY, iconX + iconSize * 0.35, iconCenterY + iconSize * 0.5);
    doc.line(iconX + iconSize * 0.35, iconCenterY + iconSize * 0.5, iconX + iconSize, iconCenterY - iconSize * 0.5);
  } else {
    // Red X — two diagonal lines
    doc.setDrawColor(200, 0, 0);
    doc.line(iconX, iconCenterY - iconSize * 0.4, iconX + iconSize, iconCenterY + iconSize * 0.4);
    doc.line(iconX + iconSize, iconCenterY - iconSize * 0.4, iconX, iconCenterY + iconSize * 0.4);
  }
  doc.setLineWidth(0.2); // reset

  // Item text
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(TEXT_FONT_SIZE);
  wrappedText.forEach((line: string, lineIdx: number) => {
    const lineY = currentY + (lineIdx * LINE_SPACING);
    doc.text(line, MARGIN_LEFT + 10, lineY + 0.5);
  });

  currentY = rowTopY + rowHeight + 0.5;
}

// Sub-label in bold with value text below — for notes under equipment
function addLabeledNote(doc: jsPDF, label: string, value: string) {
  if (!value || !value.trim()) return;
  checkPageBreak(doc, 14);
  currentY += 2; // breathing room before label
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(BRAND_BLUE.r, BRAND_BLUE.g, BRAND_BLUE.b);
  doc.text(label, MARGIN_LEFT + 2, currentY);
  doc.setTextColor(0, 0, 0);
  currentY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const wrapped = doc.splitTextToSize(value, CONTENT_WIDTH - 8);
  wrapped.forEach((line: string) => {
    checkPageBreak(doc, 5);
    doc.text(line, MARGIN_LEFT + 4, currentY);
    currentY += 4.5;
  });
  currentY += 3;
}

// Equipment safe status with green checkmark or red X icon
function addSafeStatusNote(doc: jsPDF, label: string, value: string) {
  if (!value || !value.trim()) return;
  checkPageBreak(doc, 14);
  currentY += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(BRAND_BLUE.r, BRAND_BLUE.g, BRAND_BLUE.b);
  doc.text(label, MARGIN_LEFT + 2, currentY);
  currentY += 5;

  // Draw icon
  const iconX = MARGIN_LEFT + 4;
  const iconCenterY = currentY - 2;
  const iconSize = 3;
  doc.setLineWidth(0.6);
  if (value.toLowerCase() === 'yes') {
    // Green checkmark
    doc.setDrawColor(0, 150, 0);
    doc.line(iconX, iconCenterY, iconX + iconSize * 0.35, iconCenterY + iconSize * 0.5);
    doc.line(iconX + iconSize * 0.35, iconCenterY + iconSize * 0.5, iconX + iconSize, iconCenterY - iconSize * 0.5);
    doc.setTextColor(0, 130, 0);
  } else {
    // Red X
    doc.setDrawColor(200, 0, 0);
    doc.line(iconX, iconCenterY - iconSize * 0.4, iconX + iconSize, iconCenterY + iconSize * 0.4);
    doc.line(iconX + iconSize, iconCenterY - iconSize * 0.4, iconX, iconCenterY + iconSize * 0.4);
    doc.setTextColor(200, 0, 0);
  }
  doc.setLineWidth(0.2);

  // Value text next to icon
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(value, MARGIN_LEFT + 4 + iconSize + 3, currentY);
  doc.setTextColor(0, 0, 0);
  currentY += 6;
}

function addSpacer(height = SECTION_SPACING) {
  currentY += height;
}

function checkPageBreak(doc: jsPDF, requiredHeight: number) {
  if (currentY + requiredHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
    doc.addPage();
    currentY = MARGIN_TOP;
  }
}

function addImage(doc: jsPDF, imageData: string, width = 50, height = 50) {
  checkPageBreak(doc, height + 10);
  doc.addImage(imageData, 'PNG', MARGIN_LEFT, currentY, width, height);
  currentY += height + 5;
}

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

function formatTime(timeString: string): string {
  if (!timeString) return '';
  try {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10);
    const minute = parseInt(minutes, 10);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
  } catch {
    return timeString;
  }
}

// Helper: filter a Record to only entries with non-empty string values
function filterNonEmpty(record: Record<string, unknown>): [string, string][] {
  return Object.entries(record)
    .filter(([, v]) => v && String(v).trim().length > 0)
    .map(([k, v]) => [k, String(v)]);
}

// Equipment checklists — must match the front-end form definitions
const EQUIPMENT_CHECKLISTS: Record<string, string[]> = {
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
    'Inspect all pipe connections (top & bottom of curtain) and reattach if required',
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
    'Ensure ease of use and safety during normal operation'
  ],
  'Wrestling Mat Hoists': [
    'Inspect and tighten all building point attachments and fasteners',
    'Adjust the load bar for level',
    'Re/spool and center the cable drums (where needed)',
    'Clean reed devices',
    'Inspect all pipe connections and reattach if required',
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
    'Inspect all pipe connections and reattach if required',
    'Grease all fittings where required',
    'Adjust Limit Switches',
    'Inspect all electrical motors, wiring switches for proper function',
    'Inspect and test all Safety Straps for fraying belts, proper alignment and function',
    'Overall Inspection of equipment for proper function and to ensure they are safe for everyday use and operation under normal conditions'
  ],
  'Outdoor Bleachers/Grandstands': [
    'Provide an Inspection per ICC-300 Code Standards',
    'Inspect all structural connections / walkways / kickboards / seat benches',
    'Inspect all welds, bolted connections and frame metals for signs of rust, cracking or weakness',
    'Inspect and tighten all loose hardware throughout entire structure including all railings, seat & riser planks and kick boards',
    'Inspect all seat planks, riser planks and kickboards for any damage, excessive bowing and deflection',
    'Inspect and replace any missing nuts, bolts, screws, rivets and seat clips (if possible)',
    'Check all safety fencing for any gaps exceeding 4" per code',
    'Check all aisle railings and barriers for any gaps exceeding 4" per code',
    'Confirm side barrier railings extend to 42" high per code',
    'Confirm rear barrier railings extend to 42" high per code',
    'Confirm front barrier railings extend to 36" high per code',
    'Inspect all understructure, including all anchor points at concrete foundation',
    'Confirm all points greater than 30" in height have proper fencing/railings per code',
    'Overall inspection to ensure safe for everyday use under normal conditions',
    'Provide a list of needed parts or recommended repairs with documentation and pictures'
  ],
  'Scoreboard Equipment': [
    'Inspect and perform general maintenance for safe everyday use',
    'Inspect and tighten all anchor hardware, brackets, and clamps',
    'Inspect all wiring, LEDs, harnesses, and electronics ensuring proper connection',
    'Ensure equipment is communicating properly with control systems'
  ],
  'Stage Rigging': [
    'Inspect and tighten all building point attachments',
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
    'Ensure proper operation of all locking mechanisms',
    'Check wall pockets for fatigued metal, damaged locking channels, wall anchors',
    'Check all table tops and benches for loose border stripping and damage',
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
};

// Report-specific handlers
function handleMaintenanceReport(doc: jsPDF, submission: Submission) {
  const data = submission.form_data as any;
  const selectedEquipment: string[] = Array.isArray(data.selectedEquipment) ? data.selectedEquipment : [];
  const equipmentChecks: Record<string, boolean[]> = data.equipmentChecks || {};
  const additionalRepairs: Record<string, string> = data.additionalRepairs || {};
  const futurePartsNeeded: Record<string, string> = data.futurePartsNeeded || {};
  const equipmentSafe: Record<string, string> = data.equipmentSafe || {};

  // Section header before all equipment
  if (selectedEquipment.length > 0) {
    addHeading(doc, 'Equipment Serviced');
  }

  // Loop through each selected equipment — each gets its own branded section
  selectedEquipment.forEach((equipment, eqIdx) => {
    // Add divider bar between equipment sections (not before the first one)
    if (eqIdx > 0) {
      addBrandDivider(doc);
    }

    // Equipment header — blue bar with white text
    addEquipmentHeader(doc, equipment);

    // Checklist items with check/X marks
    const checklist = EQUIPMENT_CHECKLISTS[equipment];
    const checks = equipmentChecks[equipment];

    if (checklist && checklist.length > 0) {
      checklist.forEach((item, idx) => {
        const isChecked = checks ? checks[idx] !== false : true; // default to checked
        addChecklistItem(doc, item, isChecked, idx);
      });
      addSpacer(3);
    }

    // Repairs and future parts for non-Other equipment (Other has its own custom block below)
    if (equipment !== 'Other') {
      const repairNote = additionalRepairs[equipment];
      if (repairNote && repairNote.trim()) {
        addLabeledNote(doc, 'Repairs Made During This Service:', repairNote);
      }

      const futureParts = futurePartsNeeded[equipment];
      if (futureParts && futureParts.trim()) {
        addLabeledNote(doc, 'Future Parts or Service Needed:', futureParts);
      }
    }

    // Equipment Working & Safe for Use
    const safe = equipmentSafe[equipment];
    if (safe) {
      addSafeStatusNote(doc, 'Equipment Working & Safe for Use:', safe);
    }

    // Outdoor bleacher extra data
    if (equipment === 'Outdoor Bleachers/Grandstands' && data.outdoorBleacherData) {
      const bleacherData = data.outdoorBleacherData as Record<string, string>;
      if (bleacherData.location) addLabeledNote(doc, 'Location:', bleacherData.location);
      if (bleacherData.manufacturer) addLabeledNote(doc, 'Manufacturer:', bleacherData.manufacturer);
      if (bleacherData.height) addLabeledNote(doc, 'Height / Rows:', bleacherData.height);
      if (bleacherData.length) addLabeledNote(doc, 'Length:', bleacherData.length);
      if (bleacherData.meetCode) addLabeledNote(doc, 'Meets Code:', bleacherData.meetCode);
      if (bleacherData.codeIssues) addLabeledNote(doc, 'Code Issues:', bleacherData.codeIssues);
    }

    // "Other" equipment special fields — Equipment first, then Tasks, then Future Parts
    if (equipment === 'Other') {
      if (additionalRepairs['Other-Equipment']) {
        addLabeledNote(doc, 'Equipment Serviced:', additionalRepairs['Other-Equipment']);
      }
      if (additionalRepairs['Other-Tasks']) {
        addLabeledNote(doc, 'Tasks Performed:', additionalRepairs['Other-Tasks']);
      }
      // Only show future parts once (from futurePartsNeeded, not additionalRepairs)
      const otherFutureParts = futurePartsNeeded['Other'];
      if (otherFutureParts && otherFutureParts.trim()) {
        addLabeledNote(doc, 'Future Parts or Service Needed:', otherFutureParts);
      }
    }
  });

  // Final divider after all equipment
  if (selectedEquipment.length > 0) {
    addBrandDivider(doc);
  }

  // Equipment Turnover
  if (data.equipmentTurnover) {
    addText(doc, data.equipmentTurnover, 'Equipment Turnover');
    addSpacer();
  }

  // Other Notes
  if (data.otherNotes) {
    addText(doc, data.otherNotes, 'Other Notes');
  }
}

function handleRepairReport(doc: jsPDF, submission: Submission) {
  const data = submission.form_data as any;
  const selectedEquipment: string[] = Array.isArray(data.selectedEquipment) ? data.selectedEquipment : [];
  const initialProblems: Record<string, string> = data.initialProblems || {};
  const repairSummaries: Record<string, string> = data.repairSummaries || {};
  const partsNeeded: Record<string, string> = data.partsNeeded || {};
  const equipmentSafe: Record<string, string> = data.equipmentSafe || {};

  // Section header before all equipment
  if (selectedEquipment.length > 0) {
    addHeading(doc, 'Equipment Serviced');
  }

  // Loop through each selected equipment — each gets its own branded section
  selectedEquipment.forEach((equipment, eqIdx) => {
    // Add red divider bar between equipment sections (not before the first one)
    if (eqIdx > 0) {
      addBrandDivider(doc);
    }

    // Equipment header — blue bar with white text
    addEquipmentHeader(doc, equipment);

    // 1. Initial Problem
    const problem = initialProblems[equipment];
    if (problem && problem.trim()) {
      addLabeledNote(doc, 'Initial Problem:', problem);
    }

    // 2. Repairs Made
    const summary = repairSummaries[equipment];
    if (summary && summary.trim()) {
      addLabeledNote(doc, 'Repairs Made:', summary);
    }

    // 3. Future Parts or Service Needed
    const parts = partsNeeded[equipment];
    if (parts && parts.trim()) {
      addLabeledNote(doc, 'Future Parts or Service Needed:', parts);
    }

    // 4. Equipment Working & Safe for Use
    const safe = equipmentSafe[equipment];
    if (safe) {
      addSafeStatusNote(doc, 'Equipment Working & Safe for Use:', safe);
    }
  });

  // Final divider after all equipment
  if (selectedEquipment.length > 0) {
    addBrandDivider(doc);
  }

  // Equipment Turnover
  if (data.equipmentTurnover) {
    addText(doc, data.equipmentTurnover, 'Equipment Turnover');
    addSpacer();
  }

  // Other Notes
  if (data.otherNotes) {
    addText(doc, data.otherNotes, 'Other Notes');
  }
}

function handleMaterialDeliveryReport(doc: jsPDF, submission: Submission) {
  const data = submission.form_data as any;

  // Products Delivered section
  if (data.deliveredItems) {
    addEquipmentHeader(doc, 'Products Delivered');
    addLabeledNote(doc, 'Items & Quantities:', data.deliveredItems);
  }

  if (data.deliveredItems && data.storageLocation) {
    addBrandDivider(doc);
  }

  // Storage Location section
  if (data.storageLocation) {
    addEquipmentHeader(doc, 'Storage Location');
    addLabeledNote(doc, 'Room / Area:', data.storageLocation);
  }

  // Missing Items section
  if (data.missingItems && data.missingItems.trim()) {
    if (data.storageLocation || data.deliveredItems) {
      addBrandDivider(doc);
    }
    addEquipmentHeader(doc, 'Missing Items');
    addLabeledNote(doc, 'Missing or Damaged Items:', data.missingItems);
  }

  // Final divider
  if (data.deliveredItems || data.storageLocation || data.missingItems) {
    addBrandDivider(doc);
  }
}

function handleMaterialTurnoverReport(doc: jsPDF, submission: Submission) {
  const data = submission.form_data as any;

  if (data.turnoverItems) {
    addEquipmentHeader(doc, 'Items Turned Over');
    addLabeledNote(doc, 'Items & Quantities:', data.turnoverItems);
  }

  if (data.turnoverItems && data.recipientName) {
    addBrandDivider(doc);
  }

  if (data.recipientName) {
    addEquipmentHeader(doc, 'Recipient Information');
    addLabeledNote(doc, 'Full Name:', data.recipientName);

    if (data.recipientType) {
      const recipientLabel = data.recipientType === 'Other' && data.otherSpecification
        ? `Other - ${data.otherSpecification}`
        : data.recipientType;
      addLabeledNote(doc, 'Recipient Is With:', recipientLabel);
    }
  }

  if (data.recipientName || data.turnoverItems) {
    addBrandDivider(doc);
  }
}

function handleTrainingReport(doc: jsPDF, submission: Submission) {
  const data = submission.form_data as any;

  if (data.attendanceList) {
    addEquipmentHeader(doc, 'Attendance List');
    addLabeledNote(doc, 'Trainees:', data.attendanceList);
  }

  if (data.attendanceList && (Array.isArray(data.selectedEquipment) && data.selectedEquipment.length > 0)) {
    addBrandDivider(doc);
  }

  if (Array.isArray(data.selectedEquipment) && data.selectedEquipment.length > 0) {
    addEquipmentHeader(doc, 'Equipment Trained');
    const equipmentList = data.selectedEquipment.map((eq: string) => `• ${eq}`).join('\n');
    addLabeledNote(doc, 'Selected Equipment:', equipmentList);

    if (data.otherEquipment) {
      addLabeledNote(doc, 'Other Equipment:', data.otherEquipment);
    }
  }

  if (data.equipmentTurnover && data.equipmentTurnover.trim()) {
    addBrandDivider(doc);
    addEquipmentHeader(doc, 'Equipment Turnover');
    addLabeledNote(doc, 'Details:', data.equipmentTurnover);
  }

  if (data.notes && data.notes.trim()) {
    addBrandDivider(doc);
    addEquipmentHeader(doc, 'Notes');
    addLabeledNote(doc, 'Additional Notes:', data.notes);
  }

  if (data.attendanceList || (Array.isArray(data.selectedEquipment) && data.selectedEquipment.length > 0) || data.equipmentTurnover || data.notes) {
    addBrandDivider(doc);
  }
}

function handleJobsiteProgressReport(doc: jsPDF, submission: Submission) {
  const data = submission.form_data as any;

  if (data.equipment) {
    addEquipmentHeader(doc, 'Equipment Being Installed');
    addLabeledNote(doc, 'Equipment:', data.equipment);
  }

  if (data.notes) {
    if (data.equipment) { addBrandDivider(doc); }
    addEquipmentHeader(doc, 'Progress Notes');
    addLabeledNote(doc, 'Details:', data.notes);
  }

  if (data.estimatedCompletionDate) {
    if (data.equipment || data.notes) { addBrandDivider(doc); }
    addEquipmentHeader(doc, 'Estimated Completion');
    addLabeledNote(doc, 'Target Date:', formatDate(data.estimatedCompletionDate));
  }

  if (data.equipment || data.notes || data.estimatedCompletionDate) {
    addBrandDivider(doc);
  }
}

function handleTimeSheetsReport(doc: jsPDF, submission: Submission) {
  const data = submission.form_data as any;

  // Worker info section
  addEquipmentHeader(doc, 'Worker Information');
  if (data.name) {
    addLabeledNote(doc, 'Name:', data.name);
  }
  if (data.rank) {
    addLabeledNote(doc, 'Rank:', data.rank);
  }

  addBrandDivider(doc);

  // Handle totals with branded styling — shown before entry breakdown
  if (data.totals) {
    addEquipmentHeader(doc, 'Timesheet Totals');

    const t = data.totals;

    // Foreman hours
    if (t.regularHours?.foreman || t.overtimeHours?.foreman || t.doubleHours?.foreman) {
      addLabeledNote(doc, 'Foreman Hours:',
        `Regular: ${t.regularHours?.foreman || 0}  |  1.5X: ${t.overtimeHours?.foreman || 0}  |  2X: ${t.doubleHours?.foreman || 0}`
      );
    }

    // Regular hours
    if (t.regularHours?.regular || t.overtimeHours?.regular || t.doubleHours?.regular) {
      addLabeledNote(doc, 'Regular Hours:',
        `Regular: ${t.regularHours?.regular || 0}  |  1.5X: ${t.overtimeHours?.regular || 0}  |  2X: ${t.doubleHours?.regular || 0}`
      );
    }

    // Miles & expenses
    addLabeledNote(doc, 'Total Miles:', String(t.miles || 0));
    addLabeledNote(doc, 'Total Expenses:', `$${(t.expenses || 0).toFixed(2)}`);

    addBrandDivider(doc);
  }

  // Handle entries table — shown after totals
  if (Array.isArray(data.entries) && data.entries.length > 0) {
    checkPageBreak(doc, 60);
    addEquipmentHeader(doc, 'Time Entries');

    const tableData = data.entries.map((entry: any) => [
      entry.entryNumber || '',
      formatDate(entry.date || ''),
      entry.jobNameNumber || '',
      entry.scopeOfWork || '',
      entry.regularHours || '0',
      entry.overtimeHours || '0',
      entry.doubleHours || '0',
      entry.miles || '0',
      entry.isForeman ? 'Yes' : 'No',
      entry.expenses ? `$${Number(entry.expenses).toFixed(2)}` : '$0.00',
      entry.expenseDescription || '',
    ]);
    autoTable(doc, {
      startY: currentY,
      head: [
        [
          '#',
          'Date',
          'Job',
          'Scope',
          'Reg',
          '1.5X',
          '2X',
          'Miles',
          'Foreman',
          'Expenses',
          'Exp. Desc.',
        ],
      ],
      body: tableData,
      margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
      styles: {
        fontSize: 7,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [0, 69, 124],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7,
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250],
      },
      columnStyles: {
        0: { cellWidth: 8 },
        3: { cellWidth: 25 },
        10: { cellWidth: 25 },
      },
    });
    currentY = (doc as any).lastAutoTable.finalY + 5;
  }

  addBrandDivider(doc);
}

function handleAccidentReport(doc: jsPDF, submission: Submission) {
  const data = submission.form_data as any;

  // Incident Information section
  addEquipmentHeader(doc, 'Incident Information');

  if (data.incidentDate) {
    addLabeledNote(doc, 'Date of Incident:', formatDate(data.incidentDate));
  }
  if (data.incidentTime) {
    addLabeledNote(doc, 'Time of Incident:', formatTime(data.incidentTime));
  }
  if (data.location) {
    addLabeledNote(doc, 'Location:', data.location);
  }
  if (data.incidentType) {
    const typeDisplay = data.incidentType === 'Other' && data.otherIncidentType
      ? `Other — ${data.otherIncidentType}`
      : data.incidentType;
    addLabeledNote(doc, 'Incident Type:', typeDisplay);
  }

  addBrandDivider(doc);

  // People Involved section
  addEquipmentHeader(doc, 'People Involved');

  if (data.peopleInvolved) {
    addLabeledNote(doc, 'People Involved:', data.peopleInvolved);
  }
  if (data.witness) {
    addLabeledNote(doc, 'Witnesses:', data.witness);
  }

  addBrandDivider(doc);

  // Incident Details section
  addEquipmentHeader(doc, 'Incident Details');

  if (data.description) {
    addLabeledNote(doc, 'Description:', data.description);
  }
  if (data.cause) {
    addLabeledNote(doc, 'Cause:', data.cause);
  }
  if (data.injuries) {
    addLabeledNote(doc, 'Injuries Sustained:', data.injuries);
  }
  if (data.treatment) {
    addLabeledNote(doc, 'Treatment Provided:', data.treatment);
  }
  if (data.propertyDamage) {
    addLabeledNote(doc, 'Property/Equipment Damage:', data.propertyDamage);
  }

  addBrandDivider(doc);

  // Actions Taken section
  addEquipmentHeader(doc, 'Actions Taken');

  if (data.immediateActions) {
    addLabeledNote(doc, 'Immediate Actions:', data.immediateActions);
  }
  if (data.futurePreventionSteps) {
    addLabeledNote(doc, 'Future Prevention Steps:', data.futurePreventionSteps);
  }
  if (data.reportedTo) {
    addLabeledNote(doc, 'Reported To:', data.reportedTo);
  }
  if (data.reportedDate) {
    addLabeledNote(doc, 'Date Reported:', formatDate(data.reportedDate));
  }

  addBrandDivider(doc);

  // Other Notes
  if (data.otherNotes) {
    addEquipmentHeader(doc, 'Additional Notes');
    addLabeledNote(doc, 'Notes:', data.otherNotes);
    addBrandDivider(doc);
  }
}

function handlePhotoUploadReport(doc: jsPDF, submission: Submission) {
  addEquipmentHeader(doc, 'Photo Upload Summary');

  const data = submission.form_data as Record<string, unknown> | null;
  const uploadedBy = (data?.uploadedBy as string) || submission.technician_name || '—';
  const jobName = (data?.jobName as string) || '';

  addLabeledNote(doc, 'Uploaded by:', uploadedBy);
  if (jobName) {
    addLabeledNote(doc, 'Job Name:', jobName);
  }
  addLabeledNote(doc, 'Total Photos:', `${submission.photo_urls?.length || 0}`);
  addBrandDivider(doc);
}

async function getImageDimensions(base64Data: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      // Fallback to landscape default if we can't read dimensions
      resolve({ width: 4, height: 3 });
    };
    img.src = base64Data;
  });
}

async function addPhotosSection(doc: jsPDF, submission: Submission, forceNewPage: boolean = false) {
  if (!submission.photo_urls || submission.photo_urls.length === 0) {
    return;
  }

  // Start photos on a new page
  doc.addPage();
  currentY = MARGIN_TOP;

  // For photo-upload, skip the heading so photos fill the page
  if (!forceNewPage) {
    addHeading(doc, 'Photos');
  }

  const maxPhotoWidth = 160;
  // Calculate max height so 2 photos always fit on one page
  // Available height = page height - top margin - bottom margin
  // Each photo slot = label (5mm) + photo + gap (8mm), so 2 slots must fit
  const usableHeight = PAGE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM - 10; // 10mm buffer
  const perPhotoSlot = usableHeight / 2; // split page evenly for 2 photos
  const labelAndGap = 5 + 8; // label height + spacing after photo
  const maxPhotoHeight = perPhotoSlot - labelAndGap; // ~108mm on letter
  const photoCenterX = PAGE_WIDTH / 2;
  let photosOnPage = 0;

  for (let i = 0; i < submission.photo_urls.length; i++) {
    // 2 photos per page — start new page after every 2
    if (photosOnPage >= 2) {
      doc.addPage();
      currentY = MARGIN_TOP;
      photosOnPage = 0;
    }

    // Load photo as base64
    const photoData = await loadImageAsBase64(submission.photo_urls[i]);
    if (photoData) {
      // Get actual image dimensions to preserve aspect ratio
      const dims = await getImageDimensions(photoData);
      const aspectRatio = dims.width / dims.height;

      let photoWidth: number;
      let photoHeight: number;

      if (aspectRatio >= maxPhotoWidth / maxPhotoHeight) {
        // Wider image — constrain by width
        photoWidth = maxPhotoWidth;
        photoHeight = maxPhotoWidth / aspectRatio;
      } else {
        // Taller image — constrain by height
        photoHeight = maxPhotoHeight;
        photoWidth = maxPhotoHeight * aspectRatio;
      }

      const photoX = photoCenterX - photoWidth / 2;

      // Photo label
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Photo ${i + 1}`, photoCenterX, currentY, { align: 'center' });
      currentY += 5;

      try {
        doc.addImage(
          photoData,
          'JPEG',
          photoX,
          currentY,
          photoWidth,
          photoHeight
        );
        currentY += photoHeight + 8;
        photosOnPage++;
      } catch (error) {
        console.warn('Failed to add photo:', error);
        addText(doc, `[Photo ${i + 1} could not be loaded]`);
        photosOnPage++;
      }
    } else {
      addText(doc, `[Photo ${i + 1} could not be loaded]`);
      photosOnPage++;
    }
  }
}

function addAdminCommentsSection(doc: jsPDF, submission: Submission) {
  const data = submission.form_data as Record<string, unknown> | null;
  const adminComments = (data?.adminComments as string) || '';
  if (!adminComments.trim()) return;

  addSpacer(4);
  addEquipmentHeader(doc, 'Admin Comments');
  addLabeledNote(doc, 'Comments:', adminComments);
  addBrandDivider(doc);
}

async function addSignaturesSection(doc: jsPDF, submission: Submission) {
  if (!submission.signature_urls || submission.signature_urls.length === 0) {
    return;
  }

  const isTurnover = submission.report_type === 'material-turnover';
  const isTraining = submission.report_type === 'training';
  const sigHeading = isTurnover ? 'Recipient Signature' : isTraining ? 'Signature of Lead Attendee' : 'Signatures';

  checkPageBreak(doc, 40);
  addHeading(doc, sigHeading);

  for (let index = 0; index < submission.signature_urls.length; index++) {
    const signatureUrl = submission.signature_urls[index];
    checkPageBreak(doc, 35);

    // Load signature as base64
    const sigData = await loadImageAsBase64(signatureUrl);
    if (sigData) {
      try {
        const maxSigWidth = 80;
        const maxSigHeight = 40;
        const signatureCenterX = PAGE_WIDTH / 2;

        // Get actual dimensions and preserve aspect ratio
        const dims = await getImageDimensions(sigData);
        const aspectRatio = dims.width / dims.height;
        let signatureWidth: number;
        let signatureHeight: number;

        if (aspectRatio >= maxSigWidth / maxSigHeight) {
          signatureWidth = maxSigWidth;
          signatureHeight = maxSigWidth / aspectRatio;
        } else {
          signatureHeight = maxSigHeight;
          signatureWidth = maxSigHeight * aspectRatio;
        }

        const signatureX = signatureCenterX - signatureWidth / 2;

        doc.addImage(
          sigData,
          'PNG',
          signatureX,
          currentY,
          signatureWidth,
          signatureHeight
        );
        currentY += signatureHeight + 5;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(isTurnover ? 'Recipient Signature' : isTraining ? 'Lead Attendee' : `Signature ${index + 1}`, signatureCenterX, currentY, {
          align: 'center',
        });
        currentY += 8;
      } catch (error) {
        console.warn('Failed to add signature:', error);
        addText(doc, `[Signature ${index + 1} could not be loaded]`);
      }
    } else {
      addText(doc, `[Signature ${index + 1} could not be loaded]`);
    }
  }

  // Add turnover disclaimer/waiver below signature
  if (isTurnover) {
    checkPageBreak(doc, 25);
    addSpacer();
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    const disclaimer = 'By signing above, the recipient acknowledges receipt of the above-listed materials and assumes full possession and responsibility effective as of the date of this report. Degler Whiting, Inc. is hereby released from any further liability or obligation regarding said materials from the date of transfer forward. In the event that any items are lost, damaged, or otherwise unaccounted for after transfer, Degler Whiting, Inc. shall bear no responsibility.';
    const lines = doc.splitTextToSize(disclaimer, CONTENT_WIDTH);
    doc.text(lines, MARGIN_LEFT, currentY);
    currentY += lines.length * 4 + 5;
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
  }
}

function getReportTypeTitle(reportType: string): string {
  const titles: Record<string, string> = {
    maintenance: 'Preventative Maintenance and Inspection Report',
    repair: 'Repair Report',
    'material-delivery': 'Material Delivery Report',
    'material-turnover': 'Material Turnover Report',
    training: 'Training Report',
    'jobsite-progress': 'Jobsite Progress Report',
    'time-sheets': 'Time Sheets Report',
    accident: 'Accident Report',
    'photo-upload': 'Photo Upload Report',
  };
  return titles[reportType] || 'Field Report';
}

// Marketing section: "Schedule Your Next Service"
async function addServiceReminderSection(doc: jsPDF, submission: Submission) {
  const SECTION_HEIGHT = 75; // estimated height needed for the section

  // Check if we need a new page
  if (currentY + SECTION_HEIGHT > PAGE_HEIGHT - MARGIN_BOTTOM - 15) {
    doc.addPage();
    currentY = MARGIN_TOP;
  }

  // Calculate next service date (12 months from report date)
  const reportDate = new Date(submission.date);
  const nextServiceDate = new Date(reportDate);
  nextServiceDate.setFullYear(nextServiceDate.getFullYear() + 1);
  const nextServiceStr = nextServiceDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Add spacing before section
  currentY += 8;

  // Draw the brand-colored top border
  doc.setDrawColor(BRAND_BLUE.r, BRAND_BLUE.g, BRAND_BLUE.b);
  doc.setLineWidth(1.5);
  doc.line(MARGIN_LEFT, currentY, PAGE_WIDTH - MARGIN_RIGHT, currentY);
  currentY += 6;

  // QR code on the right side
  const qrData = await loadQrAsBase64();
  const qrSize = 32;
  const qrX = PAGE_WIDTH - MARGIN_RIGHT - qrSize;
  const qrStartY = currentY;

  if (qrData) {
    doc.addImage(qrData, 'PNG', qrX, qrStartY, qrSize, qrSize);
  }

  // Text area width (leave room for QR code)
  const textWidth = CONTENT_WIDTH - qrSize - 8;

  // "Schedule Your Next Service" heading
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(BRAND_BLUE.r, BRAND_BLUE.g, BRAND_BLUE.b);
  doc.text('Schedule Your Next Service', MARGIN_LEFT, currentY + 1);
  currentY += 7;

  // Next service date - calendar reminder
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(BRAND_RED.r, BRAND_RED.g, BRAND_RED.b);
  doc.text(`Mark Your Calendar: Next Recommended Service — ${nextServiceStr}`, MARGIN_LEFT, currentY);
  currentY += 7;

  // Value proposition text
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(60, 60, 60);

  const valueProp = 'Regular preventative maintenance extends equipment life, ensures code compliance, and keeps your facility safe for everyday use. Many facility insurance policies and manufacturer warranties require annual maintenance to remain valid — staying on schedule protects your investment and your coverage.';
  const wrappedValue = doc.splitTextToSize(valueProp, textWidth);
  doc.text(wrappedValue, MARGIN_LEFT, currentY);
  currentY += wrappedValue.length * 3.8 + 3;

  // CTA line
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(BRAND_BLUE.r, BRAND_BLUE.g, BRAND_BLUE.b);
  doc.text('Let us help you stay on schedule — contact us today to book your next service visit.', MARGIN_LEFT, currentY);
  currentY += 6;

  // Contact info
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  doc.text('610-644-3157  •  service@deglerwhiting.com  •  deglerwhiting.com', MARGIN_LEFT, currentY);
  currentY += 4;

  // Bottom border
  currentY = Math.max(currentY, qrStartY + qrSize + 2);
  doc.setDrawColor(BRAND_BLUE.r, BRAND_BLUE.g, BRAND_BLUE.b);
  doc.setLineWidth(1.5);
  doc.line(MARGIN_LEFT, currentY, PAGE_WIDTH - MARGIN_RIGHT, currentY);
  currentY += 4;

  // Reset
  doc.setTextColor(0, 0, 0);
  doc.setLineWidth(0.5);
}

// Cache for collage images
let collageImagesBase64: (string | null)[] | null = null;

const COLLAGE_IMAGE_URLS = [
  'https://djogryqqqwlpmsnqpktz.supabase.co/storage/v1/object/public/manuals/Degler-Whiting/assets/collage-glass-wall.jpg',
  'https://djogryqqqwlpmsnqpktz.supabase.co/storage/v1/object/public/manuals/Degler-Whiting/assets/collage-bleachers.jpg',
  'https://djogryqqqwlpmsnqpktz.supabase.co/storage/v1/object/public/manuals/Degler-Whiting/assets/collage-scoreboards.jpg',
  'https://djogryqqqwlpmsnqpktz.supabase.co/storage/v1/object/public/manuals/Degler-Whiting/assets/collage-wall-padding.jpg',
  'https://djogryqqqwlpmsnqpktz.supabase.co/storage/v1/object/public/manuals/Degler-Whiting/assets/collage-batting-cage.jpg',
  'https://djogryqqqwlpmsnqpktz.supabase.co/storage/v1/object/public/manuals/Degler-Whiting/assets/collage-partitions.jpg',
];

async function loadCollageImages(): Promise<(string | null)[]> {
  if (collageImagesBase64) return collageImagesBase64;
  const results = await Promise.all(
    COLLAGE_IMAGE_URLS.map(url => loadImageAsBase64(url, false))
  );
  collageImagesBase64 = results;
  return results;
}

// Marketing section for repair reports: PM upsell with equipment list
async function addRepairMarketingSection(doc: jsPDF) {
  const SECTION_HEIGHT = 110;

  // Check if we need a new page
  if (currentY + SECTION_HEIGHT > PAGE_HEIGHT - MARGIN_BOTTOM - 15) {
    doc.addPage();
    currentY = MARGIN_TOP;
  }

  // Add spacing before section
  currentY += 8;

  // Draw the brand-colored top border
  doc.setDrawColor(BRAND_BLUE.r, BRAND_BLUE.g, BRAND_BLUE.b);
  doc.setLineWidth(1.5);
  doc.line(MARGIN_LEFT, currentY, PAGE_WIDTH - MARGIN_RIGHT, currentY);
  currentY += 6;

  // QR code on the right side
  const qrData = await loadQrAsBase64();
  const qrSize = 32;
  const qrX = PAGE_WIDTH - MARGIN_RIGHT - qrSize;
  const qrStartY = currentY;

  if (qrData) {
    doc.addImage(qrData, 'PNG', qrX, qrStartY, qrSize, qrSize);
  }

  // Text area width (leave room for QR code)
  const textWidth = CONTENT_WIDTH - qrSize - 8;

  // Heading
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(BRAND_BLUE.r, BRAND_BLUE.g, BRAND_BLUE.b);
  doc.text('Protect Your Equipment Year-Round', MARGIN_LEFT, currentY + 1);
  currentY += 7;

  // Subheading
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(BRAND_RED.r, BRAND_RED.g, BRAND_RED.b);
  doc.text('Is Your Facility on an Annual Preventative Maintenance Program?', MARGIN_LEFT, currentY);
  currentY += 7;

  // Value proposition text
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(60, 60, 60);

  const valueProp = 'Reactive repairs cost more and lead to unexpected downtime. A scheduled preventative maintenance program catches issues early, extends equipment life, ensures code compliance, and keeps your facility safe. Many facility insurance policies and manufacturer warranties require annual maintenance to remain valid.';
  const wrappedValue = doc.splitTextToSize(valueProp, textWidth);
  doc.text(wrappedValue, MARGIN_LEFT, currentY);
  currentY += wrappedValue.length * 3.8 + 4;

  // Equipment list heading
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(BRAND_BLUE.r, BRAND_BLUE.g, BRAND_BLUE.b);
  doc.text('We offer annual PM programs for:', MARGIN_LEFT, currentY);
  currentY += 5;

  // Equipment list in two columns
  const pmEquipment = [
    'Backstops',
    'Bleachers',
    'Gym Divider Curtains',
    'Folding Partitions',
    'Wrestling Mat Hoists',
    'Batting Cages',
    'Outdoor Bleachers/Grandstands',
    'Scoreboard Equipment',
    'Stage Rigging',
    'Cafeteria Tables/Benches',
    'Climbing Ropes/Volleyball/Gymnastics',
  ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);

  const colMid = MARGIN_LEFT + (textWidth / 2);
  const leftItems = pmEquipment.slice(0, 6);
  const rightItems = pmEquipment.slice(6);
  const listStartY = currentY;

  leftItems.forEach((item, i) => {
    doc.text(`•  ${item}`, MARGIN_LEFT + 2, listStartY + (i * 3.8));
  });
  rightItems.forEach((item, i) => {
    doc.text(`•  ${item}`, colMid, listStartY + (i * 3.8));
  });

  currentY = listStartY + (Math.max(leftItems.length, rightItems.length) * 3.8) + 4;

  // CTA line
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(BRAND_BLUE.r, BRAND_BLUE.g, BRAND_BLUE.b);
  doc.text('Contact us today to set up your annual maintenance program.', MARGIN_LEFT, currentY);
  currentY += 6;

  // Contact info
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  doc.text('610-644-3157  •  service@deglerwhiting.com  •  deglerwhiting.com', MARGIN_LEFT, currentY);
  currentY += 4;

  // Bottom border
  currentY = Math.max(currentY, qrStartY + qrSize + 2);
  doc.setDrawColor(BRAND_BLUE.r, BRAND_BLUE.g, BRAND_BLUE.b);
  doc.setLineWidth(1.5);
  doc.line(MARGIN_LEFT, currentY, PAGE_WIDTH - MARGIN_RIGHT, currentY);
  currentY += 4;

  // Reset
  doc.setTextColor(0, 0, 0);
  doc.setLineWidth(0.5);
}

// Equipment promotion section: "Upgrade Your Facility" with product grid, QR code, and photo collage
async function addEquipmentPromoSection(doc: jsPDF) {
  const SECTION_HEIGHT = 95; // promo box + collage strip

  // Check if we need a new page
  if (currentY + SECTION_HEIGHT > PAGE_HEIGHT - MARGIN_BOTTOM - 15) {
    doc.addPage();
    currentY = MARGIN_TOP;
  }

  // Add spacing before section
  currentY += 10;

  // Background and accent bar - drawn first so content renders on top
  const bgStartY = currentY;
  // Pre-calculate section height: 5 padding + ~6 heading + 6 tagline + ~10 body + 14 grid + 5 CTA + 5 contact + 2 pad ≈ 53, plus QR(30)+2=32 min
  const bgH = 58;
  doc.setFillColor(245, 247, 250); // very light blue-gray
  doc.rect(MARGIN_LEFT, bgStartY, CONTENT_WIDTH, bgH, 'F');

  // Gold left accent bar (matches logo eagle/stars, contrasts the navy sidebar)
  doc.setFillColor(BRAND_GOLD.r, BRAND_GOLD.g, BRAND_GOLD.b);
  doc.rect(MARGIN_LEFT, bgStartY, 2.5, bgH, 'F');

  // Inset content slightly from left accent
  const promoInsetLeft = MARGIN_LEFT + 7;
  currentY += 5;

  // QR code on the right side
  const qrData = await loadQrAsBase64();
  const qrSize = 30;
  const qrX = PAGE_WIDTH - MARGIN_RIGHT - qrSize - 4;
  const qrStartY = currentY;

  if (qrData) {
    doc.addImage(qrData, 'PNG', qrX, qrStartY, qrSize, qrSize);
  }

  // Text area width (leave room for QR code + inset)
  const textWidth = (qrX - 6) - promoInsetLeft;

  // "Upgrade Your Facility" heading
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(BRAND_BLUE.r, BRAND_BLUE.g, BRAND_BLUE.b);
  doc.text('Upgrade Your Facility', promoInsetLeft, currentY + 1);
  currentY += 6;

  // Tagline
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(BRAND_RED.r, BRAND_RED.g, BRAND_RED.b);
  doc.text('New Equipment Sales, Installation & Service — We Service What We Sell', promoInsetLeft, currentY);
  currentY += 6;

  // Body text
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  const bodyText = 'From the court to the classroom, Degler Whiting delivers complete facility solutions backed by nearly 70 years of expertise. Whether you\'re planning a renovation or a brand-new build, we handle design, installation, and ongoing service.';
  const wrappedBody = doc.splitTextToSize(bodyText, textWidth);
  doc.text(wrappedBody, promoInsetLeft, currentY);
  currentY += wrappedBody.length * 3.5 + 3;

  // Product grid in 3 columns
  const products = [
    'Athletic Equipment', 'Bleachers & Seating', 'Scoreboards & Video',
    'Operable Partitions', 'Lockers', 'Wall Safety Padding',
    'Batting Cages', 'Auditorium Seating', 'Glass Wall Systems',
  ];

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(BRAND_BLUE.r, BRAND_BLUE.g, BRAND_BLUE.b);

  const col1X = promoInsetLeft + 2;
  const col2X = promoInsetLeft + (textWidth / 3);
  const col3X = promoInsetLeft + (textWidth * 2 / 3);
  const colXs = [col1X, col2X, col3X];
  const gridStartY = currentY;

  products.forEach((product, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = colXs[col];
    const y = gridStartY + (row * 4);
    // Red dot
    doc.setFillColor(BRAND_RED.r, BRAND_RED.g, BRAND_RED.b);
    doc.circle(x, y - 0.8, 0.8, 'F');
    // Product name
    doc.setTextColor(BRAND_BLUE.r, BRAND_BLUE.g, BRAND_BLUE.b);
    doc.text(product, x + 3, y);
  });

  currentY = gridStartY + (Math.ceil(products.length / 3) * 4) + 2;

  // CTA line
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(8.5);
  doc.setTextColor(BRAND_RED.r, BRAND_RED.g, BRAND_RED.b);
  doc.text('Ready to upgrade? Contact us for a free consultation and quote.', promoInsetLeft, currentY);
  currentY += 5;

  // Contact info (phone + website only)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text('610-644-3157  •  deglerwhiting.com', promoInsetLeft, currentY);
  currentY += 3;

  // Ensure we're below the QR code before ending the background area
  currentY = Math.max(currentY, qrStartY + qrSize + 2);

  // Photo collage strip
  const collageImages = await loadCollageImages();
  const validImages = collageImages.filter((img): img is string => img !== null);

  if (validImages.length > 0) {
    const stripH = 14; // height of each photo panel in mm
    const stripW = CONTENT_WIDTH;
    const panelW = stripW / validImages.length;

    validImages.forEach((imgData, i) => {
      try {
        doc.addImage(imgData, 'JPEG', MARGIN_LEFT + (i * panelW), currentY, panelW, stripH);
      } catch {
        // Silently skip if image fails to render
      }
    });

    currentY += stripH;
  }

  currentY += 4;

  // Reset
  doc.setTextColor(0, 0, 0);
  doc.setLineWidth(0.5);
}

export async function generatePdf(submission: Submission): Promise<void> {
  try {
    // Load logo
    const logoData = await loadLogoAsBase64();

    // Initialize PDF
    const doc = new jsPDF();
    currentY = MARGIN_TOP;

    // === HEADER: Logo on left, company info on right ===
    const headerStartY = currentY;

    if (logoData) {
      // Logo is ~square (960x966), keep aspect ratio
      const logoSize = 25; // 25mm x 25mm square
      doc.addImage(logoData, 'PNG', MARGIN_LEFT, currentY, logoSize, logoSize);
    }

    // Company info — right-aligned block
    const companyX = PAGE_WIDTH - MARGIN_RIGHT;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Degler Whiting, Inc.', companyX, currentY + 5, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('2025 Ridge Rd, Elverson, PA 19520', companyX, currentY + 11, { align: 'right' });
    doc.text('610-644-3157', companyX, currentY + 16, { align: 'right' });
    doc.text('service@deglerwhiting.com', companyX, currentY + 21, { align: 'right' });

    currentY = headerStartY + 28;

    // Divider line under header
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(MARGIN_LEFT, currentY, PAGE_WIDTH - MARGIN_RIGHT, currentY);
    doc.setLineWidth(0.2);
    currentY += 8;

    // Report title — centered, large
    const reportTitle = getReportTypeTitle(submission.report_type);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(reportTitle, PAGE_WIDTH / 2, currentY, { align: 'center' });
    currentY += 10;

    // Common fields in a clean 2-column grid
    doc.setDrawColor(200, 200, 200);
    doc.setFontSize(10);

    const col1X = MARGIN_LEFT;
    const col1ValX = col1X + 32;
    const col2X = MARGIN_LEFT + 85;
    const col2ValX = col2X + 32;

    const isTimeSheet = submission.report_type === 'time-sheets';
    const isPhotoUpload = submission.report_type === 'photo-upload';
    const isServiceReport = ['maintenance','repair','material-delivery','material-turnover','training','jobsite-progress'].includes(submission.report_type);

    // Row 1: Date (or Date of Service) + Job Name / Name / Uploaded by
    const dateLabel = isServiceReport ? 'Date of Service:' : 'Date:';
    doc.setFont('helvetica', 'bold');
    doc.text(dateLabel, col1X, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text(formatDate(submission.date), col1ValX, currentY);

    if (isTimeSheet) {
      doc.setFont('helvetica', 'bold');
      doc.text('Name:', col2X, currentY);
      doc.setFont('helvetica', 'normal');
      doc.text(submission.technician_name || '—', col2ValX, currentY);
    } else if (isPhotoUpload) {
      doc.setFont('helvetica', 'bold');
      doc.text('Uploaded by:', col2X, currentY);
      doc.setFont('helvetica', 'normal');
      doc.text(submission.technician_name || '—', col2ValX + 8, currentY);
    } else {
      doc.setFont('helvetica', 'bold');
      doc.text('Job Name:', col2X, currentY);
      doc.setFont('helvetica', 'normal');
      doc.text(submission.job_name || '—', col2ValX, currentY);
    }
    currentY += LINE_HEIGHT;

    // Row 2: Job Number + Technician (skip for time-sheets, show optional job name for photo-upload)
    if (isPhotoUpload) {
      const photoFormData = submission.form_data as Record<string, unknown> | null;
      const photoJobName = photoFormData?.jobName as string || '';
      if (photoJobName) {
        doc.setFont('helvetica', 'bold');
        doc.text('Job Name:', col1X, currentY);
        doc.setFont('helvetica', 'normal');
        doc.text(photoJobName, col1ValX, currentY);
        currentY += LINE_HEIGHT;
      }
      currentY += 3;
    } else if (!isTimeSheet) {
      doc.setFont('helvetica', 'bold');
      doc.text('Job Number:', col1X, currentY);
      doc.setFont('helvetica', 'normal');
      doc.text(submission.job_number || '—', col1ValX, currentY);

      doc.setFont('helvetica', 'bold');
      doc.text('Technician:', col2X, currentY);
      doc.setFont('helvetica', 'normal');
      doc.text(submission.technician_name || '—', col2ValX, currentY);
      currentY += LINE_HEIGHT + 3;
    } else {
      currentY += 3;
    }

    // Light divider before report content
    doc.setDrawColor(180, 180, 180);
    doc.line(MARGIN_LEFT, currentY, PAGE_WIDTH - MARGIN_RIGHT, currentY);
    currentY += 6;

    // Add report-specific content
    switch (submission.report_type) {
      case 'maintenance':
        handleMaintenanceReport(doc, submission);
        break;
      case 'repair':
        handleRepairReport(doc, submission);
        break;
      case 'material-delivery':
        handleMaterialDeliveryReport(doc, submission);
        break;
      case 'material-turnover':
        handleMaterialTurnoverReport(doc, submission);
        break;
      case 'training':
        handleTrainingReport(doc, submission);
        break;
      case 'jobsite-progress':
        handleJobsiteProgressReport(doc, submission);
        break;
      case 'time-sheets':
        handleTimeSheetsReport(doc, submission);
        break;
      case 'accident':
        handleAccidentReport(doc, submission);
        break;
      case 'photo-upload':
        handlePhotoUploadReport(doc, submission);
        break;
      default:
        break;
    }

    // Add admin comments (if any — only added by admin after submission)
    addAdminCommentsSection(doc, submission);

    // Add signatures section
    await addSignaturesSection(doc, submission);

    // Add photos section (at the end, can span multiple pages)
    // For photo-upload, always start photos on page 2
    await addPhotosSection(doc, submission, isPhotoUpload);

    // Add marketing sections (report-type specific)
    if (submission.report_type === 'maintenance') {
      await addServiceReminderSection(doc, submission);
    } else if (submission.report_type === 'repair') {
      await addRepairMarketingSection(doc);
    }

    // Add crest divider + equipment promotion section (both maintenance and repair)
    if (submission.report_type === 'maintenance' || submission.report_type === 'repair') {
      await addCrestDivider(doc);
      await addEquipmentPromoSection(doc);
    }

    // Add footer to every page
    const totalPages = doc.getNumberOfPages();
    const footerText = 'Degler Whiting, Inc.  •  2025 Ridge Rd, Elverson, PA 19520  •  610-644-3157';
    const footerY = PAGE_HEIGHT - 8;

    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(footerText, PAGE_WIDTH / 2, footerY, { align: 'center' });

      // Navy sidebar accent down the left edge (every page)
      doc.setFillColor(BRAND_BLUE.r, BRAND_BLUE.g, BRAND_BLUE.b);
      doc.rect(0, 0, 4, PAGE_HEIGHT, 'F');
    }
    // Reset text color
    doc.setTextColor(0, 0, 0);

    // Generate filename and download
    // Format: [Service Type] Report_[Job Name]_[Job Number].pdf
    const serviceTypeLabels: Record<string, string> = {
      maintenance: 'Preventative Maintenance',
      repair: 'Repair',
      'material-delivery': 'Material Delivery',
      'material-turnover': 'Material Turnover',
      training: 'Training',
      'jobsite-progress': 'Jobsite Progress',
      'time-sheets': 'Time Sheets',
      accident: 'Accident',
      'photo-upload': 'Photo Upload',
    };
    const serviceType = serviceTypeLabels[submission.report_type] || 'Field';
    let filename: string;
    if (submission.report_type === 'time-sheets') {
      const safeName = submission.technician_name.replace(/[^a-z0-9 ]/gi, '').trim();
      const [yr, mo, dy] = submission.date.split('-');
      const usDate = `${mo}-${dy}-${yr}`;
      filename = `Timesheet_${safeName}_${usDate}.pdf`;
    } else {
      const safeJobName = submission.job_name.replace(/[^a-z0-9 ]/gi, '').trim();
      const safeJobNumber = (submission.job_number || '').replace(/[^a-z0-9 ]/gi, '').trim();
      filename = `${serviceType} Report_${safeJobName}_${safeJobNumber}.pdf`;
    }

    doc.save(filename);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Returns { blob, filename } instead of auto-downloading — used for Web Share API on mobile
// This must mirror generatePdf() exactly (same header, same section order, same content)
export async function generatePdfBlob(submission: Submission): Promise<{ blob: Blob; filename: string }> {
  try {
    const logoData = await loadLogoAsBase64();
    const jsPDF = (await import('jspdf')).default;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });

    currentY = MARGIN_TOP;

    // === HEADER: Logo on left, company info on right (mirrors generatePdf) ===
    const headerStartY = currentY;

    if (logoData) {
      const logoSize = 25;
      doc.addImage(logoData, 'PNG', MARGIN_LEFT, currentY, logoSize, logoSize);
    }

    // Company info — right-aligned block
    const companyX = PAGE_WIDTH - MARGIN_RIGHT;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Degler Whiting, Inc.', companyX, currentY + 5, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('2025 Ridge Rd, Elverson, PA 19520', companyX, currentY + 11, { align: 'right' });
    doc.text('610-644-3157', companyX, currentY + 16, { align: 'right' });
    doc.text('service@deglerwhiting.com', companyX, currentY + 21, { align: 'right' });

    currentY = headerStartY + 28;

    // Divider line under header
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(MARGIN_LEFT, currentY, PAGE_WIDTH - MARGIN_RIGHT, currentY);
    doc.setLineWidth(0.2);
    currentY += 8;

    // Report title — centered, large (uses same getReportTypeTitle as generatePdf)
    const reportTitle = getReportTypeTitle(submission.report_type);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(reportTitle, PAGE_WIDTH / 2, currentY, { align: 'center' });
    currentY += 10;

    // Common fields in a clean 2-column grid
    doc.setDrawColor(200, 200, 200);
    doc.setFontSize(10);

    const col1X = MARGIN_LEFT;
    const col1ValX = col1X + 32;
    const col2X = MARGIN_LEFT + 85;
    const col2ValX = col2X + 32;

    const isTimeSheet = submission.report_type === 'time-sheets';
    const isPhotoUpload = submission.report_type === 'photo-upload';
    const isServiceReport = ['maintenance','repair','material-delivery','material-turnover','training','jobsite-progress'].includes(submission.report_type);

    // Row 1: Date (or Date of Service) + Job Name / Name / Uploaded by
    const dateLabel = isServiceReport ? 'Date of Service:' : 'Date:';
    doc.setFont('helvetica', 'bold');
    doc.text(dateLabel, col1X, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text(formatDate(submission.date), col1ValX, currentY);

    if (isTimeSheet) {
      doc.setFont('helvetica', 'bold');
      doc.text('Name:', col2X, currentY);
      doc.setFont('helvetica', 'normal');
      doc.text(submission.technician_name || '—', col2ValX, currentY);
    } else if (isPhotoUpload) {
      doc.setFont('helvetica', 'bold');
      doc.text('Uploaded by:', col2X, currentY);
      doc.setFont('helvetica', 'normal');
      doc.text(submission.technician_name || '—', col2ValX + 8, currentY);
    } else {
      doc.setFont('helvetica', 'bold');
      doc.text('Job Name:', col2X, currentY);
      doc.setFont('helvetica', 'normal');
      doc.text(submission.job_name || '—', col2ValX, currentY);
    }
    currentY += LINE_HEIGHT;

    // Row 2: Job Number + Technician (or optional job name for photo-upload, skip for time-sheets)
    if (isPhotoUpload) {
      const photoFormData = submission.form_data as Record<string, unknown> | null;
      const photoJobName = photoFormData?.jobName as string || '';
      if (photoJobName) {
        doc.setFont('helvetica', 'bold');
        doc.text('Job Name:', col1X, currentY);
        doc.setFont('helvetica', 'normal');
        doc.text(photoJobName, col1ValX, currentY);
        currentY += LINE_HEIGHT;
      }
      currentY += 3;
    } else if (!isTimeSheet) {
      doc.setFont('helvetica', 'bold');
      doc.text('Job Number:', col1X, currentY);
      doc.setFont('helvetica', 'normal');
      doc.text(submission.job_number || '—', col1ValX, currentY);

      doc.setFont('helvetica', 'bold');
      doc.text('Technician:', col2X, currentY);
      doc.setFont('helvetica', 'normal');
      doc.text(submission.technician_name || '—', col2ValX, currentY);
      currentY += LINE_HEIGHT + 3;
    } else {
      currentY += 3;
    }

    // Light divider before report content
    doc.setDrawColor(180, 180, 180);
    doc.line(MARGIN_LEFT, currentY, PAGE_WIDTH - MARGIN_RIGHT, currentY);
    currentY += 6;

    // Add report-specific content
    switch (submission.report_type) {
      case 'maintenance': handleMaintenanceReport(doc, submission); break;
      case 'repair': handleRepairReport(doc, submission); break;
      case 'material-delivery': handleMaterialDeliveryReport(doc, submission); break;
      case 'material-turnover': handleMaterialTurnoverReport(doc, submission); break;
      case 'training': handleTrainingReport(doc, submission); break;
      case 'jobsite-progress': handleJobsiteProgressReport(doc, submission); break;
      case 'time-sheets': handleTimeSheetsReport(doc, submission); break;
      case 'accident': handleAccidentReport(doc, submission); break;
      case 'photo-upload': handlePhotoUploadReport(doc, submission); break;
    }

    // Add admin comments (if any — only added by admin after submission)
    addAdminCommentsSection(doc, submission);

    // Add signatures section
    await addSignaturesSection(doc, submission);

    // Add photos section (at the end, can span multiple pages)
    // For photo-upload, always start photos on page 2
    await addPhotosSection(doc, submission, isPhotoUpload);

    // Add marketing sections (report-type specific)
    if (submission.report_type === 'maintenance') {
      await addServiceReminderSection(doc, submission);
    } else if (submission.report_type === 'repair') {
      await addRepairMarketingSection(doc);
    }

    // Add crest divider + equipment promotion section (both maintenance and repair)
    if (submission.report_type === 'maintenance' || submission.report_type === 'repair') {
      await addCrestDivider(doc);
      await addEquipmentPromoSection(doc);
    }

    // Add footer to every page
    const totalPages = doc.getNumberOfPages();
    const footerText = 'Degler Whiting, Inc.  •  2025 Ridge Rd, Elverson, PA 19520  •  610-644-3157';
    const footerY = PAGE_HEIGHT - 8;

    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(footerText, PAGE_WIDTH / 2, footerY, { align: 'center' });

      // Navy sidebar accent down the left edge (every page)
      doc.setFillColor(BRAND_BLUE.r, BRAND_BLUE.g, BRAND_BLUE.b);
      doc.rect(0, 0, 4, PAGE_HEIGHT, 'F');
    }
    doc.setTextColor(0, 0, 0);

    // Generate filename
    const serviceTypeLabels: Record<string, string> = {
      maintenance: 'Preventative Maintenance',
      repair: 'Repair',
      'material-delivery': 'Material Delivery',
      'material-turnover': 'Material Turnover',
      training: 'Training',
      'jobsite-progress': 'Jobsite Progress',
      'time-sheets': 'Time Sheets',
      accident: 'Accident',
      'photo-upload': 'Photo Upload',
    };
    const serviceType = serviceTypeLabels[submission.report_type] || 'Field';
    let filename: string;
    if (submission.report_type === 'time-sheets') {
      const safeName = submission.technician_name.replace(/[^a-z0-9 ]/gi, '').trim();
      const [yr, mo, dy] = submission.date.split('-');
      const usDate = `${mo}-${dy}-${yr}`;
      filename = `Timesheet_${safeName}_${usDate}.pdf`;
    } else {
      const safeJobName = submission.job_name.replace(/[^a-z0-9 ]/gi, '').trim();
      const safeJobNumber = (submission.job_number || '').replace(/[^a-z0-9 ]/gi, '').trim();
      filename = `${serviceType} Report_${safeJobName}_${safeJobNumber}.pdf`;
    }

    const blob = doc.output('blob');
    return { blob, filename };
  } catch (error) {
    console.error('Error generating PDF blob:', error);
    throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
