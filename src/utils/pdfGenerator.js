'use client';
import jsPDF from 'jspdf';

/**
 * Generates a PDF with automated layout
 * @param {Object} formData - The form data
 * @param {string} title - The report title
 * @returns {Promise<string>} - The filename of the PDF
 */
export const generatePDF = async (formData, title) => {
  // Create PDF
  const doc = new jsPDF();
  
  // Generate filename
  const fileName = `${formData.jobNumber || 'report'}-${formData.jobName || 'document'}.pdf`;

  // Set consistent margins and spacing
  const margin = 20;
  const width = doc.internal.pageSize.width - (margin * 2);
  let y = margin;
  
  // Function to add a section with automatic positioning
  const addSection = (title, content, options = {}) => {
    const { fontSize = 12, fontStyle = 'normal', spacing = 5, boxed = false } = options;
    
    // Check if we need a new page
    if (y > 250) {
      doc.addPage();
      y = margin;
    }
    
    // Add title if provided
    if (title) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(fontSize);
      doc.text(title, margin, y);
      y += spacing;
    }
    
    // Add content
    doc.setFont('helvetica', fontStyle);
    if (typeof content === 'string') {
      // For simple text content
      if (boxed) {
        const lines = doc.splitTextToSize(content, width - 10);
        const boxHeight = lines.length * (fontSize * 0.3528) + 10; // Approximate height
        
        doc.setDrawColor(220, 220, 220);
        doc.setFillColor(248, 248, 248);
        doc.roundedRect(margin, y - 5, width, boxHeight, 2, 2, 'FD');
        
        doc.text(lines, margin + 5, y + 5);
        y += boxHeight + spacing;
      } else {
        const lines = doc.splitTextToSize(content, width);
        doc.text(lines, margin, y);
        y += lines.length * (fontSize * 0.3528) + spacing;
      }
    } else if (typeof content === 'function') {
      // For custom rendering functions
      y = content(doc, margin, y, width, spacing);
    }
    
    return y;
  };
  
  // Add logo and header info
  try {
    doc.addImage('/images/logo.png', 'PNG', (doc.internal.pageSize.width - 40) / 2, y, 40, 40);
    y += 45;
  } catch (error) {
    console.error('Error adding logo:', error);
  }
  
  // Company Info
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  
  // Center text helper
  const centerText = (text, yPos) => {
    doc.text(text, doc.internal.pageSize.width / 2, yPos, { align: 'center' });
    return yPos + 7;
  };
  
  y = centerText('Website: www.deglerwhiting.com', y);
  y = centerText('Address: 2025 Ridge Road, Elverson, PA 19520', y);
  y = centerText('Phone: 610-644-3157', y);
  
  // Report Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  y = centerText(`${title} Report`, y + 5);
  
  // Divider
  doc.setLineWidth(0.5);
  doc.line(margin, y + 5, doc.internal.pageSize.width - margin, y + 5);
  y += 15;
  
  // Create a form field rendering function
  const renderFormFields = (fields) => {
    return (doc, margin, y, width, spacing) => {
      const startY = y;
      const labelWidth = 45;
      const fieldWidth = (width - labelWidth) / 2 - 5;
      
      // Process fields in rows of 2
      for (let i = 0; i < fields.length; i += 2) {
        const field1 = fields[i];
        const field2 = i + 1 < fields.length ? fields[i + 1] : null;
        
        // Row height
        const rowHeight = 20;
        
        // Field 1
        doc.setFont('helvetica', 'bold');
        doc.text(`${field1.label}:`, margin, y + 5);
        
        // Field 1 box
        doc.setDrawColor(200, 200, 200);
        
        if (field1.darkBg) {
          doc.setFillColor(70, 70, 70);
          doc.roundedRect(margin + labelWidth, y - 2, fieldWidth, rowHeight, 2, 2, 'FD');
          doc.setTextColor(255, 255, 255);
        } else {
          doc.setFillColor(248, 248, 248);
          doc.roundedRect(margin + labelWidth, y - 2, fieldWidth, rowHeight, 2, 2, 'FD');
          doc.setTextColor(0, 0, 0);
        }
        
        doc.setFont('helvetica', 'normal');
        doc.text(field1.value || '', margin + labelWidth + 5, y + 5);
        doc.setTextColor(0, 0, 0);
        
        // Field 2 if exists
        if (field2) {
          const field2X = margin + labelWidth + fieldWidth + 10;
          
          doc.setFont('helvetica', 'bold');
          doc.text(`${field2.label}:`, field2X, y + 5);
          
          // Field 2 box
          if (field2.darkBg) {
            doc.setFillColor(70, 70, 70);
            doc.roundedRect(field2X + labelWidth, y - 2, fieldWidth, rowHeight, 2, 2, 'FD');
            doc.setTextColor(255, 255, 255);
          } else {
            doc.setFillColor(248, 248, 248);
            doc.roundedRect(field2X + labelWidth, y - 2, fieldWidth, rowHeight, 2, 2, 'FD');
            doc.setTextColor(0, 0, 0);
          }
          
          doc.setFont('helvetica', 'normal');
          doc.text(field2.value || '', field2X + labelWidth + 5, y + 5);
          doc.setTextColor(0, 0, 0);
        }
        
        y += rowHeight + spacing;
      }
      
      return y;
    };
  };
  
  // Render basic info fields
  const basicInfoFields = [
    { label: 'Date', value: formData.date, darkBg: false },
    { label: 'Job Name', value: formData.jobName, darkBg: true },
    { label: 'Job Number', value: formData.jobNumber, darkBg: true },
    { label: formData.installerName ? 'Installer' : 'Technician', value: formData.installerName || formData.technicianName, darkBg: true }
  ];
  
  y = addSection(null, renderFormFields(basicInfoFields));
  y += 10;
  
  // Turnover Items
  y = addSection('Turnover Items:', formData.turnoverItems, { boxed: true, spacing: 10 });
  
  // Recipient Information
  y = addSection('Recipient Information:', null, { spacing: 10 });
  
  // Recipient fields
  const recipientFields = [
    { label: 'Name', value: formData.recipientName, darkBg: true },
    { label: 'Type', value: formData.recipientType, darkBg: true }
  ];
  
  y = addSection(null, renderFormFields(recipientFields));
  y += 5;
  
  // Legal disclaimer
  const legalText = "Signer assumes responsibility and ownership of listed equipment from this day forth and Degler Whiting will no longer be liable or obligated to provide listed equipment.";
  y = addSection(null, legalText, { fontSize: 10, fontStyle: 'italic', boxed: true, spacing: 15 });
  
  // Signature
  const renderSignature = (doc, margin, y, width, spacing) => {
    const signatureHeight = 60;
    
    // Create signature box
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(248, 248, 248);
    doc.roundedRect(margin, y, width, signatureHeight, 2, 2, 'FD');
    
    // Add signature if exists
    if (formData.signature) {
      try {
        doc.addImage(formData.signature, 'PNG', margin + 20, y + 10, width - 40, 40);
      } catch (error) {
        console.error('Error adding signature:', error);
      }
    }
    
    return y + signatureHeight + spacing;
  };
  
  y = addSection(null, renderSignature);
  
  // Photos
  if (formData.photos && formData.photos.length > 0) {
    await addPhotos(doc, formData.photos);
  }
  
  // Save PDF
  doc.save(fileName);
  return fileName;
};

/**
 * Add photos to the PDF
 */
const addPhotos = async (doc, photos) => {
  if (!photos || photos.length === 0) return;
  
  // New page for photos
  doc.addPage();
  
  // Add title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Photos', doc.internal.pageSize.width / 2, 20, { align: 'center' });
  doc.setLineWidth(0.5);
  doc.line(20, 25, doc.internal.pageSize.width - 20, 25);
  
  // Reset font
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  
  // Load photos
  const photoPromises = photos.map((photo) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve({ dataUrl: e.target.result, name: photo.name || '' });
      };
      reader.readAsDataURL(photo);
    });
  });
  
  const photoData = await Promise.all(photoPromises);
  
  // Auto-layout photos, 2 per page
  const margin = 20;
  const width = doc.internal.pageSize.width - (margin * 2);
  let y = 40;
  const photosPerPage = 2;
  
  for (let i = 0; i < photoData.length; i++) {
    // New page if needed
    if (i > 0 && i % photosPerPage === 0) {
      doc.addPage();
      y = 40;
    }
    
    // Photo label
    doc.setFont('helvetica', 'bold');
    doc.text(`Photo ${i + 1}: ${photoData[i].name}`, margin, y);
    y += 10;
    
    try {
      // Photo box
      const photoHeight = 110;
      doc.setDrawColor(200, 200, 200);
      doc.setFillColor(250, 250, 250);
      doc.roundedRect(margin, y, width, photoHeight, 3, 3, 'FD');
      
      // Add image
      doc.addImage(
        photoData[i].dataUrl,
        'JPEG',
        margin + 5,
        y + 5,
        width - 10,
        photoHeight - 10,
        undefined,
        'MEDIUM'
      );
      y += photoHeight + 20;
    } catch (error) {
      console.error(`Error adding photo ${i + 1}:`, error);
      doc.text(`Error adding photo ${i + 1}`, margin, y + 20);
      y += 40;
    }
  }
};

/**
 * Download button component
 */
export const PDFDownloadButton = ({ formData, title }) => {
  const handleDownload = async () => {
    try {
      const filename = await generatePDF(formData, title);
      console.log(`PDF downloaded as: ${filename}`);
    } catch (error) {
      console.error('Error generating PDF for download:', error);
      alert('Error generating PDF. Please try again.');
    }
  };

  return (
    <div className="flex justify-center mt-4">
      <button
        type="button"
        onClick={handleDownload}
        className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors"
      >
        Download PDF
      </button>
    </div>
  );
};