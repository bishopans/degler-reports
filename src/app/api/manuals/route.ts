import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const category = searchParams.get('category') || '';
  const manufacturer = searchParams.get('manufacturer') || '';
  const manualType = searchParams.get('type') || '';

  let query = supabase
    .from('product_manuals')
    .select('*')
    .order('product_model', { ascending: true });

  if (category) {
    query = query.eq('equipment_category', category);
  }
  if (manufacturer) {
    query = query.eq('manufacturer', manufacturer);
  }
  if (manualType) {
    query = query.eq('manual_type', manualType);
  }
  if (search) {
    query = query.or(
      `product_model.ilike.%${search}%,product_name.ilike.%${search}%,filename.ilike.%${search}%`
    );
  }

  // Supabase default limit is 1000 rows — fetch all manuals (currently ~2000)
  // by paginating through results
  const allData: Record<string, unknown>[] = [];
  const PAGE_SIZE = 1000;
  let from = 0;
  let keepGoing = true;

  while (keepGoing) {
    const { data: page, error: pageError } = await query.range(from, from + PAGE_SIZE - 1);
    if (pageError) {
      return NextResponse.json({ error: pageError.message }, { status: 500 });
    }
    if (page && page.length > 0) {
      allData.push(...page);
      from += PAGE_SIZE;
      if (page.length < PAGE_SIZE) keepGoing = false;
    } else {
      keepGoing = false;
    }
  }

  return NextResponse.json(allData);
}
