import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET: Fetch all reminders (optionally filtered)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const upcoming = searchParams.get('upcoming'); // number of days ahead

    let query = supabase
      .from('service_reminders')
      .select('*')
      .order('reminder_date', { ascending: true });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (upcoming) {
      const days = parseInt(upcoming);
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);
      query = query.lte('reminder_date', futureDate.toISOString().split('T')[0]);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Reminders fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: Update a reminder's status or notes
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, notes } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing reminder id' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (body.reminder_date) updateData.reminder_date = body.reminder_date;

    const { data, error } = await supabase
      .from('service_reminders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Reminder update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Remove a reminder
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing reminder id' }, { status: 400 });
    }

    const { error } = await supabase
      .from('service_reminders')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reminder delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
