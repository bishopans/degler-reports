import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const reportType = searchParams.get('report_type') || '';
    const dateFrom = searchParams.get('date_from') || '';
    const dateTo = searchParams.get('date_to') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const showDeleted = searchParams.get('deleted') === 'true';

    let query = supabase
      .from('submissions')
      .select('id, created_at, report_type, date, job_name, job_number, technician_name, status, photo_urls, signature_urls, notes, form_data, claimed_by, deleted_at', { count: 'exact' });

    // Filter by deleted status
    if (showDeleted) {
      query = query.not('deleted_at', 'is', null);
    } else {
      query = query.is('deleted_at', null);
    }

    // Filter by report type
    if (reportType) {
      query = query.eq('report_type', reportType);
    }

    // Exclude a report type (used to hide time-sheets from main dashboard)
    const excludeType = searchParams.get('exclude_type') || '';
    if (excludeType) {
      query = query.neq('report_type', excludeType);
    }

    // Filter by date range
    if (dateFrom) {
      query = query.gte('date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('date', dateTo);
    }

    // Search across multiple fields
    if (search) {
      query = query.or(
        `job_name.ilike.%${search}%,job_number.ilike.%${search}%,technician_name.ilike.%${search}%`
      );
    }

    // Order and paginate
    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch submissions' }, { status: 500 });
    }

    return NextResponse.json({
      submissions: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
