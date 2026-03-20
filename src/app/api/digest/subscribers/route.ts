import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import nodemailer from 'nodemailer';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://deglerwhitingreports.com';

// GET — list all subscribers
export async function GET() {
  const { data, error } = await supabase
    .from('digest_subscribers')
    .select('id, email, active, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ subscribers: data });
}

// POST — add a new subscriber
export async function POST(request: NextRequest) {
  const { email } = await request.json();

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Check if already exists
  const { data: existing } = await supabase
    .from('digest_subscribers')
    .select('id, active')
    .eq('email', normalizedEmail)
    .single();

  if (existing) {
    if (!existing.active) {
      // Reactivate
      await supabase
        .from('digest_subscribers')
        .update({ active: true })
        .eq('id', existing.id);
      return NextResponse.json({ message: 'Subscription reactivated', reactivated: true });
    }
    return NextResponse.json({ error: 'Email is already subscribed' }, { status: 409 });
  }

  const { error } = await supabase
    .from('digest_subscribers')
    .insert({ email: normalizedEmail });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Subscribed successfully' });
}

// DELETE — remove a subscriber (sends confirmation email)
export async function DELETE(request: NextRequest) {
  const { email } = await request.json();

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Look up the subscriber and their unsubscribe token
  const { data: subscriber, error: lookupError } = await supabase
    .from('digest_subscribers')
    .select('id, unsubscribe_token')
    .eq('email', normalizedEmail)
    .eq('active', true)
    .single();

  if (lookupError || !subscriber) {
    return NextResponse.json({ error: 'Subscriber not found' }, { status: 404 });
  }

  // Send confirmation email
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: { ciphers: 'SSLv3' },
    });

    const unsubscribeUrl = `${APP_URL}/unsubscribe?token=${subscriber.unsubscribe_token}`;

    await transporter.sendMail({
      from: process.env.EMAIL_USER || 'reports@deglerwhiting.com',
      to: normalizedEmail,
      subject: 'Confirm Unsubscribe — DW Reports Weekly Digest',
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 500px; margin: 40px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: #00457c; padding: 20px 24px; text-align: center;">
      <h1 style="margin: 0; color: white; font-size: 18px;">DW Reports Weekly Digest</h1>
    </div>
    <div style="padding: 32px 24px; text-align: center;">
      <p style="font-size: 16px; color: #374151; margin: 0 0 8px;">Confirm Unsubscribe</p>
      <p style="font-size: 14px; color: #6b7280; margin: 0 0 24px;">Click the button below to unsubscribe <strong>${normalizedEmail}</strong> from the weekly digest.</p>
      <a href="${unsubscribeUrl}" style="display: inline-block; padding: 12px 32px; background: #dc2626; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
        Confirm Unsubscribe
      </a>
      <p style="font-size: 12px; color: #9ca3af; margin: 24px 0 0;">If you didn't request this, you can safely ignore this email.</p>
    </div>
  </div>
</body>
</html>`,
    });
  } catch (emailError) {
    console.error('Failed to send unsubscribe confirmation:', emailError);
    return NextResponse.json({ error: 'Failed to send confirmation email' }, { status: 500 });
  }

  return NextResponse.json({ message: 'Confirmation email sent' });
}
