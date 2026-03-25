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

// Points system: reports submitted same day as service = 5 pts,
// each day late reduces by 1, minimum 1 point per report
const MAX_POINTS = 5;
const MIN_POINTS = 1;

function calculatePoints(serviceDate: string, submittedAt: string): number {
  const service = new Date(serviceDate + 'T00:00:00.000Z');
  const submitted = new Date(submittedAt);
  // Compare calendar dates in UTC
  const serviceDay = Date.UTC(service.getUTCFullYear(), service.getUTCMonth(), service.getUTCDate());
  const submittedDay = Date.UTC(submitted.getUTCFullYear(), submitted.getUTCMonth(), submitted.getUTCDate());
  const daysLate = Math.max(0, Math.floor((submittedDay - serviceDay) / (1000 * 60 * 60 * 24)));
  return Math.max(MIN_POINTS, MAX_POINTS - daysLate);
}

// GET: Fetch raffle entries + past winners
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from'); // ISO date string e.g. 2025-01-01
    const to = searchParams.get('to');     // ISO date string e.g. 2025-03-31

    // Get submissions with service date and created_at for points calculation
    let query = supabase
      .from('submissions')
      .select('technician_name, report_type, date, created_at')
      .in('report_type', ELIGIBLE_REPORT_TYPES)
      .not('technician_name', 'is', null)
      .neq('technician_name', '');

    // Apply date filters based on service date
    if (from) {
      query = query.gte('date', from);
    }
    if (to) {
      query = query.lte('date', to);
    }

    const { data: submissions, error: subError } = await query;

    if (subError) {
      return NextResponse.json({ error: subError.message }, { status: 500 });
    }

    // Tally points per technician and track report counts
    const pointTallies: Record<string, number> = {};
    const reportCounts: Record<string, number> = {};
    for (const sub of submissions || []) {
      const name = sub.technician_name?.trim();
      if (name && sub.date && sub.created_at) {
        const pts = calculatePoints(sub.date, sub.created_at);
        pointTallies[name] = (pointTallies[name] || 0) + pts;
        reportCounts[name] = (reportCounts[name] || 0) + 1;
      }
    }

    // Sort by points descending
    const entries = Object.entries(pointTallies)
      .map(([name, points]) => ({ name, entries: points, reports: reportCounts[name] || 0 }))
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
