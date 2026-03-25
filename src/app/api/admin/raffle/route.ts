import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Report types that count for the raffle
const ELIGIBLE_REPORT_TYPES = [
  'maintenance',
  'repair',
  'material-delivery',
  'material-turnover',
  'training',
  'jobsite-progress',
];

// GET: Fetch raffle entries + past winners
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from'); // ISO date string e.g. 2025-01-01
    const to = searchParams.get('to');     // ISO date string e.g. 2025-03-31

    // Get submission counts grouped by technician name (only eligible report types)
    let query = supabase
      .from('submissions')
      .select('technician_name, report_type')
      .in('report_type', ELIGIBLE_REPORT_TYPES)
      .not('technician_name', 'is', null)
      .neq('technician_name', '');

    // Apply date filters if provided
    if (from) {
      query = query.gte('created_at', `${from}T00:00:00.000Z`);
    }
    if (to) {
      query = query.lte('created_at', `${to}T23:59:59.999Z`);
    }

    const { data: submissions, error: subError } = await query;

    if (subError) {
      return NextResponse.json({ error: subError.message }, { status: 500 });
    }

    // Tally entries per technician
    const tallies: Record<string, number> = {};
    for (const sub of submissions || []) {
      const name = sub.technician_name?.trim();
      if (name) {
        tallies[name] = (tallies[name] || 0) + 1;
      }
    }

    // Sort by entry count descending
    const entries = Object.entries(tallies)
      .map(([name, count]) => ({ name, entries: count }))
      .sort((a, b) => b.entries - a.entries);

    // Get past winners
    const { data: winners, error: winError } = await supabase
      .from('raffle_winners')
      .select('*')
      .order('drawn_at', { ascending: false });

    if (winError) {
      return NextResponse.json({ error: winError.message }, { status: 500 });
    }

    return NextResponse.json({ entries, winners: winners || [] });
  } catch (error) {
    console.error('Raffle GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch raffle data' }, { status: 500 });
  }
}

// POST: Record a winner
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { winner_name, entries_at_win, quarter } = body;

    if (!winner_name || !quarter) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('raffle_winners')
      .insert({
        winner_name,
        entries_at_win: entries_at_win || 0,
        quarter,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Raffle POST error:', error);
    return NextResponse.json({ error: 'Failed to record winner' }, { status: 500 });
  }
}

// DELETE: Delete a specific winner record
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing winner id' }, { status: 400 });
    }

    const { error } = await supabase
      .from('raffle_winners')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Raffle DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete winner' }, { status: 500 });
  }
}
