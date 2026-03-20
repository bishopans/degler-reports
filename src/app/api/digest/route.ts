import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import nodemailer from 'nodemailer';

// App URL for admin links
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://deglerwhitingreports.com';

// Report type display names
const reportTypeLabels: Record<string, string> = {
  maintenance: 'Preventative Maintenance',
  repair: 'Repair',
  'material-delivery': 'Material Delivery',
  'material-turnover': 'Material Turnover',
  training: 'Training',
  'jobsite-progress': 'Job Site Progress',
  'time-sheets': 'Time Sheets',
  accident: 'Accident/Incident',
  'photo-upload': 'Photo Upload',
};

interface Submission {
  id: string;
  created_at: string;
  report_type: string;
  date: string;
  job_name: string;
  job_number: string;
  technician_name: string;
  form_data: Record<string, unknown> | null;
  photo_urls: string[] | null;
  status: string;
}

interface Reminder {
  id: string;
  job_name: string;
  job_number: string | null;
  technician_name: string | null;
  service_date: string;
  status: string;
  notes: string | null;
}

interface Subscriber {
  id: string;
  email: string;
  unsubscribe_token: string;
}

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 0. Get active subscribers
    const { data: subscriberData, error: subListError } = await supabase
      .from('digest_subscribers')
      .select('id, email, unsubscribe_token')
      .eq('active', true);

    if (subListError) throw subListError;
    const subscribers = (subscriberData || []) as Subscriber[];

    if (subscribers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active subscribers — skipping digest',
        recipients: [],
      });
    }

    // Calculate date range: last 7 days (Monday to Monday)
    const now = new Date();
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Upcoming reminders: next 14 days
    const twoWeeksOut = new Date(now);
    twoWeeksOut.setDate(twoWeeksOut.getDate() + 14);
    const todayStr = now.toISOString().split('T')[0];
    const twoWeeksStr = twoWeeksOut.toISOString().split('T')[0];

    // 1. Fetch new submissions from the past week
    const { data: submissions, error: subError } = await supabase
      .from('submissions')
      .select('id, created_at, report_type, date, job_name, job_number, technician_name, form_data, photo_urls, status')
      .gte('created_at', oneWeekAgo.toISOString())
      .order('created_at', { ascending: false });

    if (subError) throw subError;

    // 2a. Fetch upcoming service reminders (next 14 days, not completed/dismissed)
    const { data: reminders, error: remError } = await supabase
      .from('service_reminders')
      .select('id, job_name, job_number, technician_name, service_date, status, notes')
      .gte('service_date', todayStr)
      .lte('service_date', twoWeeksStr)
      .not('status', 'in', '("completed","dismissed")')
      .order('service_date', { ascending: true });

    if (remError) throw remError;

    // 2b. Fetch NEW service reminders created in the past week
    const { data: newReminders, error: newRemError } = await supabase
      .from('service_reminders')
      .select('id, job_name, job_number, technician_name, service_date, status, notes')
      .gte('created_at', oneWeekAgo.toISOString())
      .order('created_at', { ascending: false });

    if (newRemError) throw newRemError;

    const typedSubmissions = (submissions || []) as Submission[];
    const typedReminders = (reminders || []) as Reminder[];
    const typedNewReminders = (newReminders || []) as Reminder[];

    // 3. Find equipment flagged as "not safe for use"
    const unsafeEquipment: { submission: Submission; equipment: string }[] = [];
    for (const sub of typedSubmissions) {
      if ((sub.report_type === 'repair' || sub.report_type === 'maintenance') && sub.form_data) {
        const equipSafe = sub.form_data.equipmentSafe as Record<string, string> | undefined;
        if (equipSafe) {
          for (const [equip, safe] of Object.entries(equipSafe)) {
            if (safe.toLowerCase() === 'no') {
              unsafeEquipment.push({ submission: sub, equipment: equip });
            }
          }
        }
      }
    }

    // 4. Count submissions by type
    const countsByType: Record<string, number> = {};
    for (const sub of typedSubmissions) {
      countsByType[sub.report_type] = (countsByType[sub.report_type] || 0) + 1;
    }

    // 5. Create transporter
    const transporter = nodemailer.createTransport({
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        ciphers: 'SSLv3',
      },
    });

    const weekLabel = `${oneWeekAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    // 6. Send personalized email to each subscriber (with their own unsubscribe link)
    const sentTo: string[] = [];
    const errors: string[] = [];

    for (const subscriber of subscribers) {
      try {
        const emailHtml = buildDigestEmail({
          submissions: typedSubmissions,
          countsByType,
          unsafeEquipment,
          reminders: typedReminders,
          newReminders: typedNewReminders,
          weekStart: oneWeekAgo,
          weekEnd: now,
          unsubscribeToken: subscriber.unsubscribe_token,
        });

        await transporter.sendMail({
          from: process.env.EMAIL_USER || 'reports@deglerwhiting.com',
          to: subscriber.email,
          subject: `DW Reports Weekly Digest — ${weekLabel}`,
          html: emailHtml,
        });

        sentTo.push(subscriber.email);
      } catch (err) {
        console.error(`Failed to send to ${subscriber.email}:`, err);
        errors.push(subscriber.email);
      }
    }

    return NextResponse.json({
      success: true,
      recipients: sentTo,
      failed: errors,
      summary: {
        totalSubmissions: typedSubmissions.length,
        countsByType,
        unsafeEquipmentCount: unsafeEquipment.length,
        upcomingReminders: typedReminders.length,
        newRemindersThisWeek: typedNewReminders.length,
      },
    });
  } catch (error) {
    console.error('Digest error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// ─── Email Template ──────────────────────────────────────────────────────────

function buildDigestEmail({
  submissions,
  countsByType,
  unsafeEquipment,
  reminders,
  newReminders,
  weekStart,
  weekEnd,
  unsubscribeToken,
}: {
  submissions: Submission[];
  countsByType: Record<string, number>;
  unsafeEquipment: { submission: Submission; equipment: string }[];
  reminders: Reminder[];
  newReminders: Reminder[];
  weekStart: Date;
  weekEnd: Date;
  unsubscribeToken: string;
}): string {
  const brandBlue = '#00457c';
  const brandRed = '#ab0534';
  const weekLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  const unsubscribeUrl = `${APP_URL}/unsubscribe?token=${unsubscribeToken}`;

  const formatDate = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Summary row for each report type
  const typeRows = Object.entries(countsByType)
    .sort(([, a], [, b]) => b - a)
    .map(
      ([type, count]) => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${reportTypeLabels[type] || type}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: 600;">${count}</td>
      </tr>`
    )
    .join('');

  // Unsafe equipment rows
  const unsafeRows = unsafeEquipment
    .map(
      ({ submission, equipment }) => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; color: ${brandRed}; font-weight: 600;">${equipment}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${submission.job_name}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${submission.technician_name}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${formatDate(submission.date)}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">
          <a href="${APP_URL}/admin/report/${submission.id}" style="color: ${brandBlue}; text-decoration: underline;">View</a>
        </td>
      </tr>`
    )
    .join('');

  // Reminder rows (upcoming)
  const reminderRows = reminders
    .map(
      (r) => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${r.job_name}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${r.job_number || '—'}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${formatDate(r.service_date)}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">
          <span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 500;
            background: ${r.status === 'scheduled' ? '#dcfce7' : r.status === 'contacted' ? '#dbeafe' : '#fef9c3'};
            color: ${r.status === 'scheduled' ? '#166534' : r.status === 'contacted' ? '#1e40af' : '#854d0e'};">
            ${r.status}
          </span>
        </td>
      </tr>`
    )
    .join('');

  // New service reminders created this week
  const newReminderRows = newReminders
    .map(
      (r) => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${r.job_name}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${r.job_number || '—'}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${r.technician_name || '—'}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${formatDate(r.service_date)}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">
          <span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 500;
            background: ${r.status === 'scheduled' ? '#dcfce7' : r.status === 'contacted' ? '#dbeafe' : r.status === 'completed' ? '#e5e7eb' : '#fef9c3'};
            color: ${r.status === 'scheduled' ? '#166534' : r.status === 'contacted' ? '#1e40af' : r.status === 'completed' ? '#374151' : '#854d0e'};">
            ${r.status}
          </span>
        </td>
      </tr>`
    )
    .join('');

  // All submissions — mirror admin dashboard row format
  const submissionRows = submissions
    .map(
      (sub) => {
        const photoCount = sub.photo_urls?.length || 0;
        return `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${formatDate(sub.date)}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">
          <span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; background: #dbeafe; color: #1e40af;">
            ${reportTypeLabels[sub.report_type] || sub.report_type}
          </span>
        </td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; font-weight: 500;">${sub.job_name}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${sub.job_number}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${sub.technician_name}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; text-align: center;">${photoCount}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">
          <a href="${APP_URL}/admin/report/${sub.id}" style="color: ${brandBlue}; text-decoration: underline;">View</a>
        </td>
      </tr>`;
      }
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 700px; margin: 0 auto; background: white;">

    <!-- Header -->
    <div style="background: ${brandBlue}; padding: 24px 32px; text-align: center;">
      <h1 style="margin: 0; color: white; font-size: 22px; font-weight: 700;">DW Reports Weekly Digest</h1>
      <p style="margin: 8px 0 0; color: #93c5fd; font-size: 14px;">${weekLabel}</p>
    </div>

    <!-- Quick Stats -->
    <div style="padding: 24px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="33%" style="text-align: center; padding: 16px 8px; background: #eff6ff; border-radius: 8px 0 0 8px;">
          <div style="font-size: 28px; font-weight: 700; color: ${brandBlue};">${submissions.length}</div>
          <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">New Reports</div>
        </td>
        <td width="33%" style="text-align: center; padding: 16px 8px; background: ${unsafeEquipment.length > 0 ? '#fef2f2' : '#eff6ff'};">
          <div style="font-size: 28px; font-weight: 700; color: ${unsafeEquipment.length > 0 ? brandRed : brandBlue};">${unsafeEquipment.length}</div>
          <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Unsafe Equipment</div>
        </td>
        <td width="33%" style="text-align: center; padding: 16px 8px; background: #eff6ff; border-radius: 0 8px 8px 0;">
          <div style="font-size: 28px; font-weight: 700; color: ${brandBlue};">${reminders.length}</div>
          <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Upcoming Reminders</div>
        </td>
      </tr></table>
    </div>

    <!-- Reports by Type -->
    ${
      Object.keys(countsByType).length > 0
        ? `
    <div style="padding: 0 32px 24px;">
      <h2 style="font-size: 16px; color: ${brandBlue}; margin: 0 0 12px; padding-bottom: 8px; border-bottom: 2px solid ${brandBlue};">Reports by Type</h2>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 14px;">
        <thead>
          <tr style="background: #f9fafb;">
            <th style="padding: 8px 12px; text-align: left; font-weight: 600; color: #374151;">Report Type</th>
            <th style="padding: 8px 12px; text-align: center; font-weight: 600; color: #374151;">Count</th>
          </tr>
        </thead>
        <tbody>${typeRows}</tbody>
        <tfoot>
          <tr style="background: #f0f9ff;">
            <td style="padding: 8px 12px; font-weight: 700;">Total</td>
            <td style="padding: 8px 12px; text-align: center; font-weight: 700;">${submissions.length}</td>
          </tr>
        </tfoot>
      </table>
    </div>`
        : ''
    }

    <!-- Unsafe Equipment Alert -->
    ${
      unsafeEquipment.length > 0
        ? `
    <div style="padding: 0 32px 24px;">
      <h2 style="font-size: 16px; color: ${brandRed}; margin: 0 0 12px; padding-bottom: 8px; border-bottom: 2px solid ${brandRed};">Equipment Flagged Unsafe</h2>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 14px;">
        <thead>
          <tr style="background: #fef2f2;">
            <th style="padding: 8px 12px; text-align: left; font-weight: 600;">Equipment</th>
            <th style="padding: 8px 12px; text-align: left; font-weight: 600;">Job</th>
            <th style="padding: 8px 12px; text-align: left; font-weight: 600;">Tech</th>
            <th style="padding: 8px 12px; text-align: left; font-weight: 600;">Date</th>
            <th style="padding: 8px 12px; text-align: left; font-weight: 600;"></th>
          </tr>
        </thead>
        <tbody>${unsafeRows}</tbody>
      </table>
    </div>`
        : ''
    }

    <!-- New Service Reminders This Week -->
    ${
      newReminders.length > 0
        ? `
    <div style="padding: 0 32px 24px;">
      <h2 style="font-size: 16px; color: ${brandBlue}; margin: 0 0 12px; padding-bottom: 8px; border-bottom: 2px solid ${brandBlue};">New Service Reminders This Week</h2>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 14px;">
        <thead>
          <tr style="background: #f9fafb;">
            <th style="padding: 8px 12px; text-align: left; font-weight: 600;">Job</th>
            <th style="padding: 8px 12px; text-align: left; font-weight: 600;">Job #</th>
            <th style="padding: 8px 12px; text-align: left; font-weight: 600;">Technician</th>
            <th style="padding: 8px 12px; text-align: left; font-weight: 600;">Service Date</th>
            <th style="padding: 8px 12px; text-align: left; font-weight: 600;">Status</th>
          </tr>
        </thead>
        <tbody>${newReminderRows}</tbody>
      </table>
    </div>`
        : ''
    }

    <!-- Upcoming Service Reminders -->
    ${
      reminders.length > 0
        ? `
    <div style="padding: 0 32px 24px;">
      <h2 style="font-size: 16px; color: ${brandBlue}; margin: 0 0 12px; padding-bottom: 8px; border-bottom: 2px solid ${brandBlue};">Upcoming Service Reminders (Next 14 Days)</h2>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 14px;">
        <thead>
          <tr style="background: #f9fafb;">
            <th style="padding: 8px 12px; text-align: left; font-weight: 600;">Job</th>
            <th style="padding: 8px 12px; text-align: left; font-weight: 600;">Job #</th>
            <th style="padding: 8px 12px; text-align: left; font-weight: 600;">Service Date</th>
            <th style="padding: 8px 12px; text-align: left; font-weight: 600;">Status</th>
          </tr>
        </thead>
        <tbody>${reminderRows}</tbody>
      </table>
    </div>`
        : ''
    }

    <!-- All Submissions (Admin Dashboard Style) -->
    ${
      submissions.length > 0
        ? `
    <div style="padding: 0 32px 24px;">
      <h2 style="font-size: 16px; color: ${brandBlue}; margin: 0 0 12px; padding-bottom: 8px; border-bottom: 2px solid ${brandBlue};">All Submissions This Week</h2>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 14px;">
        <thead>
          <tr style="background: #f9fafb;">
            <th style="padding: 8px 12px; text-align: left; font-weight: 600;">Date</th>
            <th style="padding: 8px 12px; text-align: left; font-weight: 600;">Type</th>
            <th style="padding: 8px 12px; text-align: left; font-weight: 600;">Job Name</th>
            <th style="padding: 8px 12px; text-align: left; font-weight: 600;">Job #</th>
            <th style="padding: 8px 12px; text-align: left; font-weight: 600;">Technician</th>
            <th style="padding: 8px 12px; text-align: center; font-weight: 600;">Photos</th>
            <th style="padding: 8px 12px; text-align: left; font-weight: 600;"></th>
          </tr>
        </thead>
        <tbody>${submissionRows}</tbody>
      </table>
    </div>`
        : `
    <div style="padding: 0 32px 24px;">
      <p style="color: #6b7280; font-size: 14px;">No new reports submitted this week.</p>
    </div>`
    }

    <!-- CTA -->
    <div style="padding: 0 32px 32px; text-align: center;">
      <a href="${APP_URL}/admin" style="display: inline-block; padding: 12px 32px; background: ${brandBlue}; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
        Open Admin Panel
      </a>
    </div>

    <!-- Footer -->
    <div style="background: #f9fafb; padding: 16px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">
        Degler Whiting &bull; 610-644-3157 &bull; service@deglerwhiting.com
      </p>
      <p style="margin: 8px 0 0; font-size: 11px;">
        <a href="${unsubscribeUrl}" style="color: #9ca3af; text-decoration: underline;">Unsubscribe from weekly digest</a>
      </p>
    </div>

  </div>
</body>
</html>`;
}
