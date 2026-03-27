'use client';
import { useState, useEffect, useCallback } from 'react';
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
  const [tab, setTab] = useState<'upcoming' | 'history'>('upcoming');
  const [allReminders, setAllReminders] = useState<ServiceReminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchReminders = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/reminders');
      if (response.ok) {
        const data = await response.json();
        setAllReminders(data);
      }
    } catch (error) {
      console.error('Failed to fetch reminders:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  // Split reminders into upcoming (pending) and history (contacted/dismissed/scheduled/completed)
  const upcomingReminders = allReminders.filter(r => r.status === 'pending');
  const historyReminders = allReminders.filter(r => r.status !== 'pending');

  // For history tab filtering
  const filteredHistory = filterStatus === 'all'
    ? historyReminders
    : historyReminders.filter(r => r.status === filterStatus);

  const historyCounts = historyReminders.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Sort upcoming: past-due first, then by date ascending
  const today = new Date().toISOString().split('T')[0];
  const sortedUpcoming = [...upcomingReminders].sort((a, b) => {
    const aOverdue = a.reminder_date <= today;
    const bOverdue = b.reminder_date <= today;
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    return a.reminder_date.localeCompare(b.reminder_date);
  });

  const handleEditDate = (reminder: ServiceReminder) => {
    setEditingId(reminder.id);
    setEditDate(reminder.reminder_date);
  };

  const handleSaveDate = async (id: string) => {
    setSavingId(id);
    try {
      const response = await fetch('/api/admin/reminders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, reminder_date: editDate }),
      });
      if (response.ok) {
        setEditingId(null);
        await fetchReminders();
      } else {
        alert('Failed to update reminder date');
      }
    } catch {
      alert('Failed to update reminder date');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this reminder? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      const response = await fetch(`/api/admin/reminders?id=${id}`, { method: 'DELETE' });
      if (response.ok) {
        await fetchReminders();
      } else {
        alert('Failed to delete reminder');
      }
    } catch {
      alert('Failed to delete reminder');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US');
  };

  const getDaysLabel = (reminderDate: string) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const rd = new Date(reminderDate + 'T00:00:00');
    const diff = Math.ceil((rd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, color: '#dc2626' };
    if (diff === 0) return { label: 'Today', color: '#d97706' };
    if (diff === 1) return { label: 'Tomorrow', color: '#d97706' };
    return { label: `In ${diff} days`, color: '#059669' };
  };

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Image src="/images/logo.png" alt="Logo" width={50} height={50} />
          <div>
            <h1 className="text-xl font-bold" style={{ color: '#171717' }}>Service Reminder Log</h1>
            <p className="text-sm" style={{ color: '#374151' }}>
              {upcomingReminders.length} upcoming · {historyReminders.length} closed
            </p>
          </div>
        </div>
        <Link href="/admin" style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.875rem' }}>
          ← Back to Dashboard
        </Link>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '1.5rem', borderBottom: '2px solid #e5e7eb' }}>
        <button
          onClick={() => setTab('upcoming')}
          style={{
            padding: '0.75rem 1.25rem',
            fontSize: '0.875rem',
            fontWeight: tab === 'upcoming' ? 600 : 400,
            color: tab === 'upcoming' ? '#2563eb' : '#6b7280',
            borderBottom: tab === 'upcoming' ? '2px solid #2563eb' : '2px solid transparent',
            background: 'none',
            border: 'none',
            borderBottomWidth: '2px',
            borderBottomStyle: 'solid',
            borderBottomColor: tab === 'upcoming' ? '#2563eb' : 'transparent',
            cursor: 'pointer',
            marginBottom: '-2px',
          }}
        >
          Upcoming ({upcomingReminders.length})
        </button>
        <button
          onClick={() => setTab('history')}
          style={{
            padding: '0.75rem 1.25rem',
            fontSize: '0.875rem',
            fontWeight: tab === 'history' ? 600 : 400,
            color: tab === 'history' ? '#2563eb' : '#6b7280',
            background: 'none',
            border: 'none',
            borderBottomWidth: '2px',
            borderBottomStyle: 'solid',
            borderBottomColor: tab === 'history' ? '#2563eb' : 'transparent',
            cursor: 'pointer',
            marginBottom: '-2px',
          }}
        >
          History ({historyReminders.length})
        </button>
      </div>

      {/* UPCOMING TAB */}
      {tab === 'upcoming' && (
        <div>
          {isLoading ? (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center" style={{ color: '#374151' }}>Loading reminders...</div>
          ) : sortedUpcoming.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center" style={{ color: '#374151' }}>
              No upcoming reminders. They are created automatically when maintenance reports are submitted.
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="bg-white rounded-lg shadow-sm hidden md:block" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#171717' }}>Job Name</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#171717' }}>Job #</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#171717' }}>Technician</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#171717' }}>Service Date</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#171717' }}>Reminder Date</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#171717' }}>Shows In</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#171717' }}>Report</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: 600, color: '#171717' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedUpcoming.map((reminder) => {
                      const days = getDaysLabel(reminder.reminder_date);
                      return (
                        <tr key={reminder.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '0.75rem', fontSize: '0.875rem', fontWeight: 500, color: '#171717' }}>{reminder.job_name}</td>
                          <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#171717' }}>{reminder.job_number || '—'}</td>
                          <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#171717' }}>{reminder.technician_name || '—'}</td>
                          <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#171717' }}>{formatDate(reminder.service_date)}</td>
                          <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#171717' }}>
                            {editingId === reminder.id ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                <input
                                  type="date"
                                  value={editDate}
                                  onChange={(e) => setEditDate(e.target.value)}
                                  style={{
                                    padding: '0.25rem 0.375rem',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '0.25rem',
                                    fontSize: '0.8rem',
                                    color: '#171717',
                                  }}
                                />
                                <button
                                  onClick={() => handleSaveDate(reminder.id)}
                                  disabled={savingId === reminder.id}
                                  style={{
                                    padding: '0.25rem 0.5rem',
                                    fontSize: '0.75rem',
                                    backgroundColor: '#2563eb',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '0.25rem',
                                    cursor: 'pointer',
                                  }}
                                >
                                  {savingId === reminder.id ? '...' : 'Save'}
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  style={{
                                    padding: '0.25rem 0.5rem',
                                    fontSize: '0.75rem',
                                    backgroundColor: '#f3f4f6',
                                    color: '#374151',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '0.25rem',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              formatDate(reminder.reminder_date)
                            )}
                          </td>
                          <td style={{ padding: '0.75rem', fontSize: '0.8rem', fontWeight: 500, color: days.color }}>
                            {days.label}
                          </td>
                          <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                            <Link href={`/admin/report/${reminder.submission_id}`} style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.8rem' }}>
                              View →
                            </Link>
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.375rem' }}>
                              {editingId !== reminder.id && (
                                <button
                                  onClick={() => handleEditDate(reminder)}
                                  style={{
                                    padding: '0.25rem 0.5rem',
                                    fontSize: '0.75rem',
                                    backgroundColor: '#f0f9ff',
                                    color: '#2563eb',
                                    border: '1px solid #bfdbfe',
                                    borderRadius: '0.25rem',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Edit Date
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(reminder.id)}
                                disabled={deletingId === reminder.id}
                                style={{
                                  padding: '0.25rem 0.5rem',
                                  fontSize: '0.75rem',
                                  backgroundColor: '#fef2f2',
                                  color: '#dc2626',
                                  border: '1px solid #fecaca',
                                  borderRadius: '0.25rem',
                                  cursor: 'pointer',
                                }}
                              >
                                {deletingId === reminder.id ? '...' : 'Delete'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {sortedUpcoming.map((reminder) => {
                  const days = getDaysLabel(reminder.reminder_date);
                  return (
                    <div key={reminder.id} className="bg-white rounded-lg shadow-sm" style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#171717' }}>{reminder.job_name}</div>
                          {reminder.job_number && <div style={{ fontSize: '0.8rem', color: '#374151' }}>Job #{reminder.job_number}</div>}
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: days.color, whiteSpace: 'nowrap' }}>{days.label}</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.375rem', fontSize: '0.8rem', color: '#374151', marginBottom: '0.75rem' }}>
                        <div><strong>Technician:</strong> {reminder.technician_name || '—'}</div>
                        <div><strong>Service Date:</strong> {formatDate(reminder.service_date)}</div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <strong>Reminder Date:</strong>{' '}
                          {editingId === reminder.id ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', marginTop: '0.25rem' }}>
                              <input
                                type="date"
                                value={editDate}
                                onChange={(e) => setEditDate(e.target.value)}
                                style={{
                                  padding: '0.25rem 0.375rem',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '0.25rem',
                                  fontSize: '0.8rem',
                                  color: '#171717',
                                }}
                              />
                              <button
                                onClick={() => handleSaveDate(reminder.id)}
                                disabled={savingId === reminder.id}
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '0.25rem', cursor: 'pointer' }}
                              >
                                {savingId === reminder.id ? '...' : 'Save'}
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '0.25rem', cursor: 'pointer' }}
                              >
                                Cancel
                              </button>
                            </span>
                          ) : (
                            formatDate(reminder.reminder_date)
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <Link href={`/admin/report/${reminder.submission_id}`} style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.8rem' }}>
                          View Report →
                        </Link>
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.375rem' }}>
                          {editingId !== reminder.id && (
                            <button
                              onClick={() => handleEditDate(reminder)}
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', backgroundColor: '#f0f9ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '0.25rem', cursor: 'pointer' }}
                            >
                              Edit Date
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(reminder.id)}
                            disabled={deletingId === reminder.id}
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '0.25rem', cursor: 'pointer' }}
                          >
                            {deletingId === reminder.id ? '...' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* HISTORY TAB */}
      {tab === 'history' && (
        <div>
          {/* Filter Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            {[
              { key: 'all', label: 'All', count: historyReminders.length, bg: '#f9fafb', text: '#374151', border: '#e5e7eb' },
              { key: 'contacted', label: 'Contacted', count: historyCounts.contacted || 0, bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
              { key: 'scheduled', label: 'Scheduled', count: historyCounts.scheduled || 0, bg: '#d1fae5', text: '#065f46', border: '#6ee7b7' },
              { key: 'completed', label: 'Completed', count: historyCounts.completed || 0, bg: '#e5e7eb', text: '#374151', border: '#9ca3af' },
              { key: 'dismissed', label: 'Dismissed', count: historyCounts.dismissed || 0, bg: '#f3f4f6', text: '#6b7280', border: '#d1d5db' },
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

          {/* History Table */}
          <div className="bg-white rounded-lg shadow-sm" style={{ overflowX: 'auto' }}>
            {isLoading ? (
              <div className="p-8 text-center" style={{ color: '#374151' }}>Loading reminders...</div>
            ) : filteredHistory.length === 0 ? (
              <div className="p-8 text-center" style={{ color: '#374151' }}>No closed reminders yet. Reminders will appear here once they are contacted or dismissed from the dashboard.</div>
            ) : (
              <>
                {/* Desktop Table */}
                <table className="hidden md:table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#171717' }}>Job Name</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#171717' }}>Job #</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#171717' }}>Technician</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#171717' }}>Service Date</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#171717' }}>Reminder Date</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#171717' }}>Status</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#171717' }}>Updated</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#171717' }}>Report</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map((reminder) => {
                      const status = STATUS_LABELS[reminder.status] || STATUS_LABELS.pending;
                      return (
                        <tr key={reminder.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '0.75rem', fontSize: '0.875rem', fontWeight: 500, color: '#171717' }}>{reminder.job_name}</td>
                          <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#171717' }}>{reminder.job_number || '—'}</td>
                          <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#171717' }}>{reminder.technician_name || '—'}</td>
                          <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#171717' }}>{formatDate(reminder.service_date)}</td>
                          <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#171717' }}>{formatDate(reminder.reminder_date)}</td>
                          <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
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
                          <td style={{ padding: '0.75rem', fontSize: '0.75rem', color: '#6b7280' }}>
                            {new Date(reminder.updated_at).toLocaleDateString('en-US')}
                          </td>
                          <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                            <Link href={`/admin/report/${reminder.submission_id}`} style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.8rem' }}>
                              View →
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Mobile Cards for History */}
                <div className="md:hidden" style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                  {filteredHistory.map((reminder) => {
                    const status = STATUS_LABELS[reminder.status] || STATUS_LABELS.pending;
                    return (
                      <div key={reminder.id} style={{ padding: '0.75rem', borderBottom: '1px solid #f3f4f6' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.375rem' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#171717' }}>{reminder.job_name}</div>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.125rem 0.5rem',
                            borderRadius: '9999px',
                            fontSize: '0.7rem',
                            fontWeight: 500,
                            backgroundColor: status.bg,
                            color: status.text,
                          }}>
                            {status.label}
                          </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem', fontSize: '0.8rem', color: '#374151', marginBottom: '0.375rem' }}>
                          {reminder.job_number && <div>Job #{reminder.job_number}</div>}
                          <div>{reminder.technician_name || '—'}</div>
                          <div>Service: {formatDate(reminder.service_date)}</div>
                          <div>Reminder: {formatDate(reminder.reminder_date)}</div>
                        </div>
                        <Link href={`/admin/report/${reminder.submission_id}`} style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.8rem' }}>
                          View Report →
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
