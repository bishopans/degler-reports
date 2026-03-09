'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface ServiceReminder {
  id: string;
  created_at: string;
  submission_id: string;
  job_name: string;
  job_number: string;
  technician_name: string;
  service_date: string;
  reminder_date: string;
  status: string;
  notes: string | null;
  updated_at: string;
}

const STATUS_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  pending: { label: 'Pending', bg: '#fef3c7', text: '#92400e' },
  contacted: { label: 'Contacted', bg: '#dbeafe', text: '#1e40af' },
  scheduled: { label: 'Scheduled', bg: '#d1fae5', text: '#065f46' },
  completed: { label: 'Completed', bg: '#e5e7eb', text: '#374151' },
  dismissed: { label: 'Dismissed', bg: '#f3f4f6', text: '#6b7280' },
};

export default function ReminderLogPage() {
  const [reminders, setReminders] = useState<ServiceReminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    fetchReminders();
  }, []);

  const fetchReminders = async () => {
    try {
      const response = await fetch('/api/admin/reminders');
      if (response.ok) {
        const data = await response.json();
        // Only show acted-on reminders (contacted or dismissed), not pending
        setReminders(data.filter((r: ServiceReminder) => r.status === 'contacted' || r.status === 'dismissed'));
      }
    } catch (error) {
      console.error('Failed to fetch reminders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = filterStatus === 'all'
    ? reminders
    : reminders.filter(r => r.status === filterStatus);

  // Group by status for summary counts
  const counts = reminders.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Image src="/images/logo.png" alt="Logo" width={50} height={50} />
          <div>
            <h1 className="text-xl font-bold">Service Reminder Log</h1>
            <p className="text-gray-500 text-sm">{reminders.length} closed reminder{reminders.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <Link href="/admin" style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.875rem' }}>
          ← Back to Dashboard
        </Link>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {[
          { key: 'all', label: 'All', count: reminders.length, bg: '#f9fafb', text: '#374151', border: '#e5e7eb' },
          { key: 'contacted', label: 'Contacted', count: counts.contacted || 0, bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
          { key: 'dismissed', label: 'Dismissed', count: counts.dismissed || 0, bg: '#f3f4f6', text: '#6b7280', border: '#d1d5db' },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setFilterStatus(item.key)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: filterStatus === item.key ? `2px solid ${item.border}` : '1px solid #e5e7eb',
              backgroundColor: filterStatus === item.key ? item.bg : 'white',
              color: item.text,
              cursor: 'pointer',
              fontWeight: filterStatus === item.key ? 600 : 400,
              fontSize: '0.875rem',
            }}
          >
            {item.label} ({item.count})
          </button>
        ))}
      </div>

      {/* Reminders Table */}
      <div className="bg-white rounded-lg shadow-sm" style={{ overflowX: 'auto' }}>
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading reminders...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No closed reminders yet. Reminders will appear here once they are contacted or dismissed from the dashboard.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                <th style={{ padding: '0.75rem 0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600 }}>Job Name</th>
                <th style={{ padding: '0.75rem 0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600 }}>Job #</th>
                <th style={{ padding: '0.75rem 0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600 }}>Technician</th>
                <th style={{ padding: '0.75rem 0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600 }}>Service Date</th>
                <th style={{ padding: '0.75rem 0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600 }}>Reminder Date</th>
                <th style={{ padding: '0.75rem 0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '0.75rem 0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600 }}>Updated</th>
                <th style={{ padding: '0.75rem 0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600 }}>Report</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((reminder) => {
                const status = STATUS_LABELS[reminder.status] || STATUS_LABELS.pending;
                return (
                  <tr key={reminder.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '0.75rem 0.75rem', fontSize: '0.875rem', fontWeight: 500 }}>{reminder.job_name}</td>
                    <td style={{ padding: '0.75rem 0.75rem', fontSize: '0.875rem' }}>{reminder.job_number || '—'}</td>
                    <td style={{ padding: '0.75rem 0.75rem', fontSize: '0.875rem' }}>{reminder.technician_name || '—'}</td>
                    <td style={{ padding: '0.75rem 0.75rem', fontSize: '0.875rem' }}>{new Date(reminder.service_date + 'T00:00:00').toLocaleDateString('en-US')}</td>
                    <td style={{ padding: '0.75rem 0.75rem', fontSize: '0.875rem' }}>{new Date(reminder.reminder_date + 'T00:00:00').toLocaleDateString('en-US')}</td>
                    <td style={{ padding: '0.75rem 0.75rem', fontSize: '0.875rem' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '0.125rem 0.5rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        backgroundColor: status.bg,
                        color: status.text,
                      }}>
                        {status.label}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 0.75rem', fontSize: '0.75rem', color: '#6b7280' }}>
                      {new Date(reminder.updated_at).toLocaleDateString('en-US')}
                    </td>
                    <td style={{ padding: '0.75rem 0.75rem', fontSize: '0.875rem' }}>
                      <Link
                        href={`/admin/report/${reminder.submission_id}`}
                        style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.8rem' }}
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
