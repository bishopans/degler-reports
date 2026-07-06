import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const submissionId = formData.get('submission_id') as string;
    const indexRaw = formData.get('index') as string;
    const photo = formData.get('photo') as File;

    if (!submissionId || !photo || indexRaw === null) {
      return NextResponse.json({ error: 'Missing submission_id, index, or photo' }, { status: 400 });
    }

    const index = parseInt(indexRaw, 10);
    if (Number.isNaN(index) || index < 0) {
      return NextResponse.json({ error: 'Invalid index' }, { status: 400 });
    }

    // Load the current submission so we can swap the URL in place
    const { data: submission, error: fetchError } = await supabase
      .from('submissions')
      .select('photo_urls, form_data')
      .eq('id', submissionId)
      .single();

    if (fetchError || !submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    const currentPhotos: string[] = submission.photo_urls || [];
    if (index >= currentPhotos.length) {
      return NextResponse.json({ error: 'Index out of range' }, { status: 400 });
    }
    const oldUrl = currentPhotos[index];

    // Upload the rotated image under a fresh filename (avoids CDN caching a replaced file)
    const timestamp = Date.now();
    const filePath = `${submissionId}/photo-rotated-${timestamp}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('report-photos')
      .upload(filePath, photo, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      console.error('Rotate upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload rotated photo' }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from('report-photos')
      .getPublicUrl(filePath);
    const newUrl = urlData.publicUrl;

    // Replace the URL at this index
    const updatedPhotos = [...currentPhotos];
    updatedPhotos[index] = newUrl;

    // Captions are keyed by URL, so remap the old key to the new one
    const formDataObj = (submission.form_data || {}) as Record<string, unknown>;
    const captions: Record<string, string> = {
      ...((formDataObj.photo_captions as Record<string, string> | undefined) || {}),
    };
    if (captions[oldUrl] !== undefined) {
      captions[newUrl] = captions[oldUrl];
      delete captions[oldUrl];
    }
    const updatedFormData = { ...formDataObj, photo_captions: captions };

    const { data: updated, error: updateError } = await supabase
      .from('submissions')
      .update({
        photo_urls: updatedPhotos,
        form_data: updatedFormData,
        updated_at: new Date().toISOString(),
        edited_by: 'admin',
        edited_at: new Date().toISOString(),
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (updateError) {
      console.error('Rotate update error:', updateError);
      return NextResponse.json({ error: 'Failed to update submission' }, { status: 500 });
    }

    // Best-effort cleanup of the original file so storage doesn't accumulate orphans
    try {
      const parts = oldUrl.split('/report-photos/');
      if (parts.length > 1) {
        const oldPath = decodeURIComponent(parts[1]);
        await supabase.storage.from('report-photos').remove([oldPath]);
      }
    } catch (cleanupError) {
      console.warn('Old photo cleanup failed (non-fatal):', cleanupError);
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
