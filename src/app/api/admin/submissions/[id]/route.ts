import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Fetch error:', error);
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Allow updating form_data
    if (body.form_data !== undefined) {
      updateData.form_data = body.form_data;
    }

    // Allow updating common fields
    if (body.job_name !== undefined) updateData.job_name = body.job_name;
    if (body.job_number !== undefined) updateData.job_number = body.job_number;
    if (body.technician_name !== undefined) updateData.technician_name = body.technician_name;
    if (body.date !== undefined) updateData.date = body.date;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.notes !== undefined) updateData.notes = body.notes;

    // Allow updating photo_urls (for add/delete photos)
    if (body.photo_urls !== undefined) updateData.photo_urls = body.photo_urls;

    // Track who edited
    updateData.edited_by = body.edited_by || 'admin';
    updateData.edited_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('submissions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Update error:', error);
      return NextResponse.json({ error: 'Failed to update submission' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // First fetch the submission to get photo/signature URLs for storage cleanup
    const { data: submission } = await supabase
      .from('submissions')
      .select('photo_urls, signature_urls')
      .eq('id', id)
      .single();

    // Delete photos from storage if they exist
    if (submission && submission.photo_urls?.length > 0) {
      const photoPaths = submission.photo_urls.map((url: string) => {
        const parts = url.split('/photos/');
        return parts.length > 1 ? parts[1] : null;
      }).filter(Boolean);

      if (photoPaths.length > 0) {
        await supabase.storage.from('photos').remove(photoPaths);
      }
    }

    // Delete signatures from storage if they exist
    if (submission && submission.signature_urls?.length > 0) {
      const sigPaths = submission.signature_urls.map((url: string) => {
        const parts = url.split('/signatures/');
        return parts.length > 1 ? parts[1] : null;
      }).filter(Boolean);

      if (sigPaths.length > 0) {
        await supabase.storage.from('signatures').remove(sigPaths);
      }
    }

    // Delete the submission record
    const { error } = await supabase
      .from('submissions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Delete error:', error);
      return NextResponse.json({ error: 'Failed to delete submission' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
