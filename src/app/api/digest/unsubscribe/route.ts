import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET — confirm unsubscribe via token (called from email link)
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 });
  }

  const { data: subscriber, error: lookupError } = await supabase
    .from('digest_subscribers')
    .select('id, email, active')
    .eq('unsubscribe_token', token)
    .single();

  if (lookupError || !subscriber) {
    return NextResponse.json({ error: 'Invalid or expired unsubscribe link' }, { status: 404 });
  }

  if (!subscriber.active) {
    return NextResponse.json({ message: 'Already unsubscribed', email: subscriber.email });
  }

  const { error: updateError } = await supabase
    .from('digest_subscribers')
    .update({ active: false })
    .eq('id', subscriber.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Successfully unsubscribed', email: subscriber.email });
}
