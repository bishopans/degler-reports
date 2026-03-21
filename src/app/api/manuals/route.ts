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

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
