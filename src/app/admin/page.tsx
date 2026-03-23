'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';

const ADMIN_PASSWORD = 'dwadmin2026';

interface Submission {
  id: string;
  created_at: string;
  report_type: string;
  date: string;
  job_name: string;
  job_number: string;
  technician_name: string;
  status: string;
  photo_urls: string[];
  signature_urls: string[];
  notes: string | null;
  claimed_by: string | null;
  form_data?: Record<string, unknown>;
}

const CLAIM_LABELS: Record<string, string> = {
  'service-north': 'Svc North',
  'service-south': 'Svc South',
  'operations-north': 'Ops North',
  'operations-south': 'Ops South',
  'sales': 'Sales',
};

const REPORT_TYPE_LABELS: Record<string, string> = {
  'maintenance': 'Preventative Maintenance',
  'repair': 'Repair',
  'material-delivery': 'Material Delivery',
  'material-turnover': 'Material Turnover',
  'training': 'Training',
  'jobsite-progress': 'Job Site Progress',
  'accident': 'Accident/Incident',
  'photo-upload': 'Photo Upload',
};

export default function AdminDashboard() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Search and filter state
  const [search, setSearch] = useState('');
  const [reportTypeFilter, setReportTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  // Data state
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [isFetching, setIsFetching] = useState(false);

  // Digest subscribers state
  interface DigestSubscriber {
    id: string;
    email: string;
    active: boolean;
    created_at: string;
  }
  const [digestOpen, setDigestOpen] = useState(false);
  const [subscribers, setSubscribers] = useState<DigestSubscriber[]>([]);
  const [newSubEmail, setNewSubEmail] = useState('');
  const [subMessage, setSubMessage] = useState('');
  const [subError, setSubError] = useState('');
  const [subLoading, setSubLoading] = useState(false);
  const [removingEmail, setRemovingEmail] = useState('');

  const fetchSubscribers = useCallback(async () => {
    try {
      const response = await fetch('/api/digest/subscribers');
      if (response.ok) {
        const data = await response.json();
        setSubscribers(data.subscribers.filter((s: DigestSubscriber) => s.active));
      }
    } catch (error) {
      console.error('Subscriber fetch error:', error);
    }
  }, []);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubEmail) return;
    setSubLoading(true);
    setSubMessage('');
    setSubError('');
    try {
      const response = await fetch('/api/digest/subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newSubEmail }),
      });
      const data = await response.json();
      if (response.ok) {
        setSubMessage(data.reactivated ? 'Subscription reactivated!' : 'Subscribed successfully!');
        setNewSubEmail('');
        fetchSubscribers();
      } else {
        setSubError(data.error || 'Failed to subscribe');
      }
    } catch {
      setSubError('Failed to subscribe');
    } finally {
      setSubLoading(false);
    }
  };

  const handleRemoveSubscriber = async (email: string) => {
    setRemovingEmail(email);
    setSubMessage('');
    setSubError('');
    try {
      const response = await fetch('/api/digest/subscribers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (response.ok) {
        setSubMessage(`Confirmation email sent to ${email}`);
      } else {
        setSubError(data.error || 'Failed to send confirmation');
      }
    } catch {
      setSubError('Failed to send confirmation');
    } finally {
      setRemovingEmail('');
    }
  };

  // Service reminders state
  interface ServiceReminder {
    id: string;
    submission_id: string;
    job_name: string;
    job_number: string;
    technician_name: string;
    service_date: string;
    reminder_date: string;
    status: string;
    notes: string | null;
  }
  const [reminders, setReminders] = useState<ServiceReminder[]>([]);
  const [showAllReminders, setShowAllReminders] = useState(false);

  // Chatbot state
  const [chatbotEnabled, setChatbotEnabled] = useState(false);
  const [chatbotStats, setChatbotStats] = useState<{
    totalQueries: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    estimatedCostDollars: string;
  } | null>(null);
  const [chatbotToggling, setChatbotToggling] = useState(false);
  const [chatbotOpen, setChatbotOpen] = useState(false);


  useEffect(() => {
    const unlocked = sessionStorage.getItem('dw-admin-unlocked');
    if (unlocked === 'true') {
      setIsUnlocked(true);
    }
    setIsLoading(false);
  }, []);

  const fetchSubmissions = useCallback(async () => {
    setIsFetching(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (reportTypeFilter) params.set('report_type', reportTypeFilter);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      params.set('exclude_type', 'time-sheets');
      params.set('page', page.toString());

      const response = await fetch(`/api/admin/submissions?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setSubmissions(data.submissions);
        setTotalPages(data.totalPages);
        setTotal(data.total);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setIsFetching(false);
    }
  }, [search, reportTypeFilter, dateFrom, dateTo, page]);

  const fetchReminders = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/reminders');
      if (response.ok) {
        const data = await response.json();
        setReminders(data);
      }
    } catch (error) {
      console.error('Reminders fetch error:', error);
    }
  }, []);

  const updateReminderStatus = async (id: string, status: string) => {
    try {
      const response = await fetch('/api/admin/reminders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (response.ok) {
        fetchReminders();
      }
    } catch (error) {
      console.error('Reminder update error:', error);
    }
  };

  const fetchChatbotStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/chatbot');
      if (response.ok) {
        const data = await response.json();
        setChatbotEnabled(data.enabled);
        setChatbotStats(data.stats);
      }
    } catch (error) {
      console.error('Chatbot status fetch error:', error);
    }
  }, []);

  const toggleChatbot = async () => {
    setChatbotToggling(true);
    try {
      const response = await fetch('/api/admin/chatbot', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !chatbotEnabled }),
      });
      if (response.ok) {
        setChatbotEnabled(!chatbotEnabled);
        fetchChatbotStatus();
      }
    } catch (error) {
      console.error('Chatbot toggle error:', error);
    } finally {
      setChatbotToggling(false);
    }
  };

  useEffect(() => {
    if (isUnlocked) {
      fetchSubmissions();
      fetchReminders();
      fetchSubscribers();
      fetchChatbotStatus();
    }
  }, [isUnlocked, fetchSubmissions, fetchReminders, fetchSubscribers, fetchChatbotStatus]);

  const updateReportStatus = async (id: string, status: string) => {
    try {
      const response = await fetch(`/api/admin/submissions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (response.ok) {
        setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status } : s));
      }
    } catch (error) {
      console.error('Status update error:', error);
    }
  };

  const updateReportClaim = async (id: string, claimed_by: string | null) => {
    // If Sales is selected, prompt for email
    let salesEmail: string | undefined;
    if (claimed_by === 'sales') {
      const email = window.prompt('Enter the sales rep email for this report:');
      if (email === null) return; // cancelled
      salesEmail = email;
    }

    try {
      // Build the update payload
      const payload: Record<string, unknown> = { claimed_by };
      if (salesEmail !== undefined) {
        // Need to merge salesClaimEmail into form_data
        const sub = submissions.find(s => s.id === id);
        const existingFormData = sub?.form_data || {};
        payload.form_data = { ...existingFormData, salesClaimEmail: salesEmail };
      }

      const response = await fetch(`/api/admin/submissions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        const updated = await response.json();
        setSubmissions(prev => prev.map(s => s.id === id ? { ...s, claimed_by, form_data: updated.form_data } : s));
      }
    } catch (error) {
      console.error('Claim update error:', error);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsUnlocked(true);
      sessionStorage.setItem('dw-admin-unlocked', 'true');
      setPasswordError('');
    } else {
      setPasswordError('Incorrect admin password.');
      setPassword('');
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchSubmissions();
  };

  const clearFilters = () => {
    setSearch('');
    setReportTypeFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  // Admin password gate
  if (!isUnlocked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white">
        <div className="w-[300px] mb-8">
          <Image
            src="/images/logo.png"
            alt="Degler Whiting Logo"
            width={300}
            height={300}
            className="w-full"
            priority
          />
        </div>

        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-gray-500 mb-8">Enter admin password to continue</p>

        <form onSubmit={handlePasswordSubmit} style={{ width: '100%', maxWidth: '320px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: '100%', marginBottom: '1rem' }}>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setPasswordError(''); }}
              placeholder="Admin Password"
              autoFocus
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                fontSize: '1rem',
                border: passwordError ? '2px solid #ef4444' : '2px solid #e5e7eb',
                borderRadius: '0.5rem',
                outline: 'none',
                textAlign: 'center',
                boxSizing: 'border-box',
              }}
            />
          </div>
          {passwordError && (
            <p className="text-red-500 text-sm text-center mb-4">{passwordError}</p>
          )}
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              fontSize: '1rem',
              fontWeight: 600,
              color: 'white',
              backgroundColor: '#2563eb',
              borderRadius: '0.5rem',
              border: 'none',
              cursor: 'pointer',
              boxSizing: 'border-box',
            }}
          >
            Enter
          </button>
        </form>
      </div>
    );
  }

  // Main dashboard
  return (
    <div className="min-h-screen p-6 bg-gray-50">
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Image src="/images/logo.png" alt="Logo" width={50} height={50} />
          <div>
            <h1 className="text-2xl font-bold" style={{ fontSize: 'clamp(1.125rem, 4vw, 1.5rem)' }}>Admin Dashboard</h1>
            <p className="text-gray-500 text-sm">{total} total reports</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link
            href="/admin/timesheets"
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#00457C',
              color: 'white',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            Timesheets
          </Link>
          {/* Vulcan Chatbot Toggle */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => { setChatbotOpen(!chatbotOpen); }}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: chatbotOpen ? '#92400e' : (chatbotEnabled ? '#d97706' : '#6b7280'),
                color: 'white',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
              }}
            >
              🔥 Vulcan AI
              <span style={{
                backgroundColor: chatbotEnabled ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.2)',
                padding: '0.0625rem 0.5rem',
                borderRadius: '9999px',
                fontSize: '0.7rem',
                fontWeight: 600,
              }}>
                {chatbotEnabled ? 'ON' : 'OFF'}
              </span>
            </button>

            {/* Chatbot Admin Dropdown */}
            {chatbotOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '0.5rem',
                width: '320px',
                backgroundColor: 'white',
                borderRadius: '0.5rem',
                boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                border: '1px solid #e5e7eb',
                zIndex: 50,
                overflow: 'hidden',
              }}>
                {/* Header */}
                <div style={{
                  padding: '0.75rem 1rem',
                  borderBottom: '1px solid #e5e7eb',
                  background: 'linear-gradient(135deg, #1e3a5f, #2d5a8e)',
                  color: 'white',
                }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    🔥 Vulcan AI Assistant
                  </div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.8, marginTop: '0.125rem' }}>
                    Powered by Claude API (Haiku 3.5)
                  </div>
                </div>

                {/* Toggle */}
                <div style={{
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid #f3f4f6',
                }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Chat Assistant</div>
                    <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>Visible on Manual Library page</div>
                  </div>
                  <button
                    onClick={toggleChatbot}
                    disabled={chatbotToggling}
                    style={{
                      width: '48px',
                      height: '26px',
                      borderRadius: '13px',
                      border: 'none',
                      cursor: chatbotToggling ? 'not-allowed' : 'pointer',
                      backgroundColor: chatbotEnabled ? '#22c55e' : '#d1d5db',
                      position: 'relative',
                      transition: 'background-color 0.2s',
                      opacity: chatbotToggling ? 0.6 : 1,
                    }}
                  >
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: 'white',
                      position: 'absolute',
                      top: '3px',
                      left: chatbotEnabled ? '25px' : '3px',
                      transition: 'left 0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }} />
                  </button>
                </div>

                {/* Monthly Stats */}
                <div style={{ padding: '0.75rem 1rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    This Month
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div style={{
                      padding: '0.5rem',
                      backgroundColor: '#f9fafb',
                      borderRadius: '0.375rem',
                      textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e3a5f' }}>
                        {chatbotStats?.totalQueries ?? 0}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#9ca3af' }}>Queries</div>
                    </div>
                    <div style={{
                      padding: '0.5rem',
                      backgroundColor: '#f9fafb',
                      borderRadius: '0.375rem',
                      textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: chatbotStats && parseFloat(chatbotStats.estimatedCostDollars) > 10 ? '#dc2626' : '#059669' }}>
                        ${chatbotStats?.estimatedCostDollars ?? '0.00'}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#9ca3af' }}>Est. Cost</div>
                    </div>
                  </div>
                  {chatbotStats && chatbotStats.totalQueries > 0 && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: '#9ca3af', textAlign: 'center' }}>
                      {((chatbotStats.totalInputTokens + chatbotStats.totalOutputTokens) / 1000).toFixed(1)}K tokens used
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => { setDigestOpen(!digestOpen); setSubMessage(''); setSubError(''); }}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: digestOpen ? '#1e40af' : '#2563eb',
                color: 'white',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
              }}
            >
              📧 Weekly Digest
              {subscribers.length > 0 && (
                <span style={{
                  backgroundColor: 'rgba(255,255,255,0.25)',
                  padding: '0.0625rem 0.375rem',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                }}>
                  {subscribers.length}
                </span>
              )}
            </button>

            {/* Digest Dropdown Panel */}
            {digestOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '0.5rem',
                width: '340px',
                backgroundColor: 'white',
                borderRadius: '0.5rem',
                boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                border: '1px solid #e5e7eb',
                zIndex: 50,
                overflow: 'hidden',
              }}>
                {/* Header */}
                <div style={{
                  padding: '0.75rem 1rem',
                  borderBottom: '1px solid #e5e7eb',
                  backgroundColor: '#f9fafb',
                }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Weekly Digest Subscribers</div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.125rem' }}>
                    Sent every Monday at 5:00 AM EST
                  </div>
                </div>

                {/* Subscriber List */}
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {subscribers.length === 0 ? (
                    <div style={{ padding: '1rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.8125rem' }}>
                      No subscribers yet
                    </div>
                  ) : (
                    subscribers.map((sub) => (
                      <div
                        key={sub.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.5rem 1rem',
                          borderBottom: '1px solid #f3f4f6',
                        }}
                      >
                        <span style={{ fontSize: '0.8125rem', color: '#374151' }}>{sub.email}</span>
                        <button
                          onClick={() => handleRemoveSubscriber(sub.email)}
                          disabled={removingEmail === sub.email}
                          title="Remove subscriber"
                          style={{
                            fontSize: '1rem',
                            lineHeight: 1,
                            padding: '0.125rem 0.375rem',
                            borderRadius: '0.25rem',
                            border: '1px solid #fecaca',
                            backgroundColor: removingEmail === sub.email ? '#fef2f2' : 'white',
                            color: '#dc2626',
                            cursor: removingEmail === sub.email ? 'not-allowed' : 'pointer',
                            opacity: removingEmail === sub.email ? 0.5 : 1,
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Messages */}
                {subMessage && (
                  <div style={{ padding: '0.5rem 1rem', backgroundColor: '#f0fdf4', color: '#166534', fontSize: '0.75rem', fontWeight: 500 }}>
                    {subMessage}
                  </div>
                )}
                {subError && (
                  <div style={{ padding: '0.5rem 1rem', backgroundColor: '#fef2f2', color: '#dc2626', fontSize: '0.75rem', fontWeight: 500 }}>
                    {subError}
                  </div>
                )}

                {/* Subscribe Form */}
                <form onSubmit={handleSubscribe} style={{
                  padding: '0.75rem 1rem',
                  borderTop: '1px solid #e5e7eb',
                  backgroundColor: '#f9fafb',
                  display: 'flex',
                  gap: '0.5rem',
                }}>
                  <input
                    type="email"
                    value={newSubEmail}
                    onChange={(e) => { setNewSubEmail(e.target.value); setSubError(''); }}
                    placeholder="Enter email address"
                    required
                    style={{
                      flex: 1,
                      padding: '0.5rem 0.625rem',
                      fontSize: '0.8125rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={subLoading}
                    style={{
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      backgroundColor: '#2563eb',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: subLoading ? 'not-allowed' : 'pointer',
                      opacity: subLoading ? 0.7 : 1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {subLoading ? '...' : 'Subscribe'}
                  </button>
                </form>
              </div>
            )}
          </div>
          <Link href="/" className="text-blue-600 hover:text-blue-800" style={{ fontSize: '0.875rem' }}>
            ← Back to Forms
          </Link>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
        <form onSubmit={handleSearch}>
          <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label className="block text-sm mb-1">Search</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Job, technician..."
                className="w-full p-2 border rounded"
              />
            </div>

            <div style={{ flex: '0 0 180px' }}>
              <label className="block text-sm mb-1">Report Type</label>
              <select
                value={reportTypeFilter}
                onChange={(e) => { setReportTypeFilter(e.target.value); setPage(1); }}
                className="w-full p-2 border rounded"
              >
                <option value="">All Types</option>
                {Object.entries(REPORT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div style={{ flex: '0 0 155px' }}>
              <label className="block text-sm mb-1">From Date</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="w-full p-2 border rounded"
              />
            </div>

            <div style={{ flex: '0 0 155px' }}>
              <label className="block text-sm mb-1">To Date</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="w-full p-2 border rounded"
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="submit"
                style={{
                  padding: '0.5rem 1.25rem',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  borderRadius: '0.375rem',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 500,
                  height: '42px',
                }}
              >
                Search
              </button>

              <button
                type="button"
                onClick={clearFilters}
                style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  borderRadius: '0.375rem',
                  border: '1px solid #d1d5db',
                  cursor: 'pointer',
                  height: '42px',
                }}
              >
                Clear
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Service Reminders Section */}
      {(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const dueReminders = reminders
          .filter(r => r.status === 'pending' && new Date(r.reminder_date) <= today)
          .sort((a, b) => new Date(a.reminder_date).getTime() - new Date(b.reminder_date).getTime());

        const displayReminders = showAllReminders ? dueReminders : dueReminders.slice(0, 5);

        return (
          <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: dueReminders.length > 0 ? '0.75rem' : '0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>📅</span>
                <h2 className="font-bold" style={{ fontSize: '1rem' }}>Service Reminders</h2>
                {dueReminders.length > 0 && (
                  <span style={{
                    padding: '0.125rem 0.5rem',
                    borderRadius: '9999px',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    backgroundColor: '#fef2f2',
                    color: '#dc2626',
                    border: '1px solid #fecaca',
                  }}>
                    {dueReminders.length} due
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {dueReminders.length > 5 && (
                  <button
                    onClick={() => setShowAllReminders(!showAllReminders)}
                    style={{ fontSize: '0.8rem', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    {showAllReminders ? 'Show less' : `View all (${dueReminders.length})`}
                  </button>
                )}
                <Link
                  href="/admin/reminders"
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.25rem 0.625rem',
                    borderRadius: '0.25rem',
                    border: '1px solid #d1d5db',
                    backgroundColor: '#f9fafb',
                    color: '#374151',
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}
                >
                  View Log
                </Link>
              </div>
            </div>

            {dueReminders.length === 0 ? (
              <p className="text-sm text-gray-400" style={{ marginTop: '0.25rem' }}>No service reminders due at this time.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {displayReminders.map((reminder) => {
                  const reminderDate = new Date(reminder.reminder_date);
                  const daysOverdue = Math.ceil((today.getTime() - reminderDate.getTime()) / (1000 * 60 * 60 * 24));

                  const urgencyLabel = daysOverdue === 0
                    ? 'Due today'
                    : `${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue`;

                  return (
                    <div
                      key={reminder.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.625rem 0.75rem',
                        borderRadius: '0.5rem',
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '200px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className="font-medium text-sm">{reminder.job_name}</span>
                            {reminder.job_number && (
                              <span className="text-xs text-gray-400">#{reminder.job_number}</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500" style={{ marginTop: '2px' }}>
                            Last serviced: {new Date(reminder.service_date + 'T00:00:00').toLocaleDateString('en-US')}
                            {reminder.technician_name && ` by ${reminder.technician_name}`}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: '#dc2626',
                        }}>
                          {urgencyLabel}
                        </span>

                        <button
                          onClick={() => updateReminderStatus(reminder.id, 'contacted')}
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.25rem 0.625rem',
                            borderRadius: '0.25rem',
                            border: '1px solid #2563eb',
                            backgroundColor: '#2563eb',
                            color: 'white',
                            cursor: 'pointer',
                            fontWeight: 500,
                          }}
                        >
                          Contacted
                        </button>

                        <button
                          onClick={() => updateReminderStatus(reminder.id, 'dismissed')}
                          title="Dismiss reminder"
                          style={{
                            fontSize: '1rem',
                            lineHeight: 1,
                            padding: '0.125rem 0.375rem',
                            borderRadius: '0.25rem',
                            border: '1px solid #d1d5db',
                            backgroundColor: 'white',
                            color: '#6b7280',
                            cursor: 'pointer',
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Reports Table (desktop) / Cards (mobile) */}
      <div className="bg-white rounded-lg shadow-sm">
        {isFetching ? (
          <div className="p-8 text-center text-gray-500">Loading reports...</div>
        ) : submissions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No reports found. {search || reportTypeFilter || dateFrom || dateTo ? 'Try adjusting your filters.' : 'Reports will appear here as they are submitted.'}
          </div>
        ) : (
          <>
            {/* Desktop table - hidden on mobile */}
            <div className="admin-table-desktop" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '8%' }} />
                </colgroup>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600 }}>Date</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600 }}>Type</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600 }}>Job Name</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600 }}>Job #</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600 }}>Technician</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600 }}>Photos</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600 }}>Status</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600 }}>Claimed</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((sub) => (
                    <tr key={sub.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.875rem' }}>
                        {new Date(sub.date + 'T00:00:00').toLocaleDateString('en-US')}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.875rem' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '0.125rem 0.5rem',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          backgroundColor: '#dbeafe',
                          color: '#1e40af',
                        }}>
                          {REPORT_TYPE_LABELS[sub.report_type] || sub.report_type}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>{sub.job_name}</td>
                      <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.875rem' }}>{sub.job_number}</td>
                      <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.875rem' }}>{sub.technician_name}</td>
                      <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.875rem' }}>
                        {sub.photo_urls?.length || 0}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.875rem' }}>
                        <select
                          value={sub.status}
                          onChange={(e) => updateReportStatus(sub.id, e.target.value)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            border: 'none',
                            cursor: 'pointer',
                            backgroundColor: sub.status === 'reviewed' ? '#dcfce7' : sub.status === 'archived' ? '#f3f4f6' : '#fef9c3',
                            color: sub.status === 'reviewed' ? '#166534' : sub.status === 'archived' ? '#374151' : '#854d0e',
                          }}
                        >
                          <option value="submitted">submitted</option>
                          <option value="reviewed">reviewed</option>
                          <option value="archived">archived</option>
                        </select>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.875rem' }}>
                        <select
                          value={sub.claimed_by || ''}
                          onChange={(e) => updateReportClaim(sub.id, e.target.value || null)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '9999px',
                            fontSize: '0.7rem',
                            fontWeight: 500,
                            border: 'none',
                            cursor: 'pointer',
                            backgroundColor: sub.claimed_by ? '#dbeafe' : '#f3f4f6',
                            color: sub.claimed_by ? '#1e40af' : '#9ca3af',
                          }}
                        >
                          <option value="">—</option>
                          <option value="service-north">Svc North</option>
                          <option value="service-south">Svc South</option>
                          <option value="operations-north">Ops North</option>
                          <option value="operations-south">Ops South</option>
                          <option value="sales">Sales</option>
                        </select>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.875rem' }}>
                        <Link
                          href={`/admin/report/${sub.id}`}
                          style={{
                            color: '#2563eb',
                            textDecoration: 'none',
                            fontWeight: 500,
                          }}
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards - hidden on desktop */}
            <div className="admin-cards-mobile">
              {submissions.map((sub) => (
                <div key={sub.id} style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '0.25rem' }}>{sub.job_name}</div>
                      <div style={{ fontSize: '0.8125rem', color: '#6b7280' }}>{sub.job_number} &middot; {sub.technician_name}</div>
                    </div>
                    <Link
                      href={`/admin/report/${sub.id}`}
                      style={{
                        color: '#2563eb',
                        textDecoration: 'none',
                        fontWeight: 500,
                        fontSize: '0.875rem',
                        padding: '0.375rem 0.75rem',
                        border: '1px solid #2563eb',
                        borderRadius: '0.375rem',
                        flexShrink: 0,
                      }}
                    >
                      View
                    </Link>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', fontSize: '0.8125rem' }}>
                    <span style={{ color: '#6b7280' }}>
                      {new Date(sub.date + 'T00:00:00').toLocaleDateString('en-US')}
                    </span>
                    <span style={{
                      display: 'inline-block',
                      padding: '0.125rem 0.5rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      backgroundColor: '#dbeafe',
                      color: '#1e40af',
                    }}>
                      {REPORT_TYPE_LABELS[sub.report_type] || sub.report_type}
                    </span>
                    {(sub.photo_urls?.length || 0) > 0 && (
                      <span style={{ color: '#6b7280' }}>{sub.photo_urls.length} photos</span>
                    )}
                    <select
                      value={sub.status}
                      onChange={(e) => updateReportStatus(sub.id, e.target.value)}
                      style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: sub.status === 'reviewed' ? '#dcfce7' : sub.status === 'archived' ? '#f3f4f6' : '#fef9c3',
                        color: sub.status === 'reviewed' ? '#166534' : sub.status === 'archived' ? '#374151' : '#854d0e',
                      }}
                    >
                      <option value="submitted">submitted</option>
                      <option value="reviewed">reviewed</option>
                      <option value="archived">archived</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', padding: '1rem', borderTop: '1px solid #e5e7eb' }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{
                padding: '0.375rem 0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                backgroundColor: 'white',
                cursor: page === 1 ? 'not-allowed' : 'pointer',
                opacity: page === 1 ? 0.5 : 1,
              }}
            >
              Previous
            </button>
            <span className="text-sm">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{
                padding: '0.375rem 0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                backgroundColor: 'white',
                cursor: page === totalPages ? 'not-allowed' : 'pointer',
                opacity: page === totalPages ? 0.5 : 1,
              }}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
