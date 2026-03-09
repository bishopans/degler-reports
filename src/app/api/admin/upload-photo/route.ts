import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const submissionId = formData.get('submission_id') as string;
    const photo = formData.get('photo') as File;

    if (!submissionId || !photo) {
      return NextResponse.json({ error: 'Missing submission_id or photo' }, { status: 400 });
    }

    // Generate unique filename
    const fileExt = photo.name.split('.').pop() || 'jpg';
    const timestamp = Date.now();
    const filePath = `${submissionId}/photo-admin-${timestamp}.${fileExt}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('report-photos')
      .upload(filePath, photo, {
        contentType: photo.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Photo upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload photo' }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('report-photos')
      .getPublicUrl(filePath);

    // Add the new URL to the submission's photo_urls array
    const { data: submission } = await supabase
      .from('submissions')
      .select('photo_urls')
      .eq('id', submissionId)
      .single();

    const currentPhotos: string[] = submission?.photo_urls || [];
    const updatedPhotos = [...currentPhotos, urlData.publicUrl];

    const { data: updated, error: updateError } = await supabase
      .from('submissions')
      .update({
        photo_urls: updatedPhotos,
        updated_at: new Date().toISOString(),
        edited_by: 'admin',
        edited_at: new Date().toISOString(),
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json({ error: 'Failed to update submission' }, { status: 500 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
