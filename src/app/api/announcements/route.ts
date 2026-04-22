import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/announcements — fetch currently active announcements (public)
export async function GET() {
  try {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('announcements')
      .select('id, title, body, image_url, start_at, end_at')
      .lte('start_at', now)
      .gt('end_at', now)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Announcements query error:', error);
      return NextResponse.json({ error: 'Failed to fetch announcements' }, { status: 500 });
    }

    return NextResponse.json({ announcements: data || [] });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
