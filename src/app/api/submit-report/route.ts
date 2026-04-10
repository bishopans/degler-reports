import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { ReportType } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Extract common fields
    const reportType = formData.get('report_type') as ReportType;
    const date = formData.get('date') as string;
    const jobName = formData.get('job_name') as string;
    const jobNumber = formData.get('job_number') as string;
    const technicianName = formData.get('technician_name') as string;
    const formDataJson = formData.get('form_data') as string;

    // Validate required fields
    if (!reportType || !date || !jobName || !jobNumber || !technicianName) {
      return NextResponse.json(
        { error: 'Missing required fields: report_type, date, job_name, job_number, technician_name' },
        { status: 400 }
      );
    }

    // Parse form-specific data
    let parsedFormData = {};
    if (formDataJson) {
      try {
        parsedFormData = JSON.parse(formDataJson);
      } catch {
        return NextResponse.json({ error: 'Invalid form_data JSON' }, { status: 400 });
      }
    }

    // Use upload_id from client if provided (photos already uploaded), otherwise generate new
    const submissionId = (formData.get('upload_id') as string) || crypto.randomUUID();

    // Photos: accept pre-uploaded URLs (new way) or fall back to file uploads (legacy)
    let photoUrls: string[] = [];
    const photoUrlsJson = formData.get('photo_urls') as string;
    if (photoUrlsJson) {
      try {
        photoUrls = JSON.parse(photoUrlsJson);
      } catch {
        // ignore parse errors
      }
    }

    // Legacy: also handle file uploads for backwards compatibility
    const photoFiles = formData.getAll('photos') as File[];
    for (let i = 0; i < photoFiles.length; i++) {
      const file = photoFiles[i];
      if (file && file.size > 0) {
        const fileExt = file.name.split('.').pop() || 'jpg';
        const filePath = `${submissionId}/photo-${i + 1}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('report-photos')
          .upload(filePath, file, {
            contentType: file.type,
            upsert: true,
          });

        if (uploadError) {
          console.error(`Photo upload error (${i + 1}):`, uploadError);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('report-photos')
          .getPublicUrl(filePath);

        photoUrls.push(urlData.publicUrl);
      }
    }

    // Upload signatures to Supabase Storage
    const signatureUrls: string[] = [];
    const signatureFiles = formData.getAll('signatures') as File[];
    for (let i = 0; i < signatureFiles.length; i++) {
      const file = signatureFiles[i];
      if (file && file.size > 0) {
        const filePath = `${submissionId}/signature-${i + 1}.png`;

        const { error: uploadError } = await supabase.storage
          .from('report-signatures')
          .upload(filePath, file, {
            contentType: 'image/png',
            upsert: true,
          });

        if (uploadError) {
          console.error(`Signature upload error (${i + 1}):`, uploadError);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('report-signatures')
          .getPublicUrl(filePath);

        signatureUrls.push(urlData.publicUrl);
      }
    }

    // Also handle base64 signatures (from signature canvas)
    const signatureBase64Entries = formData.getAll('signature_base64') as string[];
    for (let i = 0; i < signatureBase64Entries.length; i++) {
      const base64 = signatureBase64Entries[i];
      if (base64 && base64.startsWith('data:image')) {
        // Convert base64 to a buffer
        const base64Data = base64.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        const filePath = `${submissionId}/signature-canvas-${i + 1}.png`;

        const { error: uploadError } = await supabase.storage
          .from('report-signatures')
          .upload(filePath, buffer, {
            contentType: 'image/png',
            upsert: true,
          });

        if (uploadError) {
          console.error(`Signature base64 upload error (${i + 1}):`, uploadError);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('report-signatures')
          .getPublicUrl(filePath);

        signatureUrls.push(urlData.publicUrl);
      }
    }

    // Upsert the submission record (handles retries gracefully)
    const { data, error: insertError } = await supabase
      .from('submissions')
      .upsert({
        id: submissionId,
        report_type: reportType,
        date: date,
        job_name: jobName,
        job_number: jobNumber,
        technician_name: technicianName,
        form_data: parsedFormData,
        photo_urls: photoUrls,
        signature_urls: signatureUrls,
        status: 'new',
      }, { onConflict: 'id' })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to save submission' },
        { status: 500 }
      );
    }

    // Auto-create service reminder for maintenance reports (1 year out)
    if (reportType === 'maintenance') {
      const serviceDate = new Date(date);
      const reminderDate = new Date(serviceDate);
      reminderDate.setFullYear(reminderDate.getFullYear() + 1);

      await supabase.from('service_reminders').insert({
        submission_id: submissionId,
        job_name: jobName,
        job_number: jobNumber,
        technician_name: technicianName,
        service_date: date,
        reminder_date: reminderDate.toISOString().split('T')[0],
        status: 'pending',
      });
    }

    return NextResponse.json({
      success: true,
      submission_id: data.id,
      photo_count: photoUrls.length,
      signature_count: signatureUrls.length,
    });

  } catch (error) {
    console.error('Submission error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
