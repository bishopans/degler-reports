import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const photo = formData.get('photo') as File;
    const uploadId = formData.get('upload_id') as string;
    const index = formData.get('index') as string;

    if (!photo || !uploadId) {
      return NextResponse.json({ error: 'Missing photo or upload_id' }, { status: 400 });
    }

    const fileExt = photo.name.split('.').pop() || 'jpg';
    const filePath = `${uploadId}/photo-${index || Date.now()}.${fileExt}`;

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

    const { data: urlData } = supabase.storage
      .from('report-photos')
      .getPublicUrl(filePath);

    return NextResponse.json({ url: urlData.publicUrl });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
