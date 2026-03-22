import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// GET: Fetch chatbot status + usage stats for current month
export async function GET() {
  try {
    // Get enabled status
    const { data: setting } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'chatbot_enabled')
      .single();

    // Get current month stats
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: logs, error } = await supabase
      .from('chat_logs')
      .select('input_tokens, output_tokens, estimated_cost_cents')
      .gte('created_at', startOfMonth.toISOString());

    let totalQueries = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCostCents = 0;

    if (logs && !error) {
      totalQueries = logs.length;
      logs.forEach((log) => {
        totalInputTokens += log.input_tokens || 0;
        totalOutputTokens += log.output_tokens || 0;
        totalCostCents += parseFloat(log.estimated_cost_cents) || 0;
      });
    }

    return NextResponse.json({
      enabled: setting?.value === 'true',
      stats: {
        totalQueries,
        totalInputTokens,
        totalOutputTokens,
        totalCostCents: Math.round(totalCostCents * 100) / 100,
        estimatedCostDollars: (totalCostCents / 100).toFixed(2),
      },
    });
  } catch (error) {
    console.error('Chatbot admin GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch chatbot status' }, { status: 500 });
  }
}

// PATCH: Toggle chatbot on/off
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { enabled } = body;

    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 });
    }

    const { error } = await supabase
      .from('site_settings')
      .upsert(
        { key: 'chatbot_enabled', value: enabled ? 'true' : 'false', updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );

    if (error) {
      console.error('Toggle error:', error);
      return NextResponse.json({ error: 'Failed to update chatbot setting' }, { status: 500 });
    }

    return NextResponse.json({ enabled, message: `Vulcan assistant ${enabled ? 'enabled' : 'disabled'}` });
  } catch (error) {
    console.error('Chatbot admin PATCH error:', error);
    return NextResponse.json({ error: 'Failed to toggle chatbot' }, { status: 500 });
  }
}
