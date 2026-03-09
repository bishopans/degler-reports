'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';

const ADMIN_PASSWORD = 'dwadmin2026';

interface TimeEntry {
  entryNumber: number;
  date: string;
  jobNameNumber: string;
  scopeOfWork: string;
  isForeman: boolean;
  regularHours: number;
  overtimeHours: number;
  doubleHours: number;
  miles: number;
  expenses: number;
  expenseDescription: string;
}

interface FormDataPayload {
  name: string;
  rank: string;
  entries: TimeEntry[];
  totals?: {
    regularHours: { foreman: number; regular: number };
    overtimeHours: { foreman: number; regular: number };
    doubleHours: { foreman: number; regular: number };
    miles: number;
    expenses: number;
  };
}

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
  form_data: FormDataPayload | null;
}

export default function TimesheetsAdmin() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Search and filter state
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  // Data state
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [isFetching, setIsFetching] = useState(false);

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
      params.set('report_type', 'time-sheets');
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      params.set('page', page.toString());

      const response = await fetch(`/api/admin/submissions?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setSubmissions(data.submissions);
        setTotalPages(data.totalPages);
        setTotal(data.total);
      }
    } catch (error) {
      console.error('Failed to fetch timesheets:', error);
    } finally {
      setIsFetching(false);
    }
  }, [search, dateFrom, dateTo, page]);

  useEffect(() => {
    if (isUnlocked) {
      fetchSubmissions();
    }
  }, [isUnlocked, fetchSubmissions]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem('dw-admin-unlocked', 'true');
      setIsUnlocked(true);
      setPasswordError('');
    } else {
      setPasswordError('Incorrect password');
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/admin/submissions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (response.ok) {
        fetchSubmissions();
      }
    } catch (error) {
      console.error('Status update error:', error);
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!isUnlocked) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '1rem' }}>
        <div className="w-[80px] mb-6">
          <Image
            src="/images/logo.png"
            alt="Degler Whiting Logo"
            width={80}
            height={80}
            className="w-full"
            priority
          />
        </div>

        <h1 className="text-3xl font-bold mb-2">Timesheets</h1>
        <p className="text-gray-500 mb-8">Enter admin password to continue</p>

        <form onSubmit={handlePasswordSubmit} style={{ width: '100%', maxWidth: '320px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: '100%', marginBottom: '1rem' }}>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Admin Password"
              className="w-full p-3 border rounded text-center"
              autoFocus
            />
          </div>
          {passwordError && (
            <p className="text-red-500 text-sm mb-4">{passwordError}</p>
          )}
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 px-4 rounded hover:bg-blue-700 transition-colors"
          >
            Unlock
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Image src="/images/logo.png" alt="Logo" width={60} height={60} />
          <div>
            <h1 className="text-2xl font-bold">Timesheets</h1>
            <p className="text-gray-500 text-sm">{total} total time sheets</p>
          </div>
        </div>
        <Link href="/admin" className="text-blue-600 hover:text-blue-800">
          ← Back to Dashboard
        </Link>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {/* Search */}
        <div style={{ flex: '1', minWidth: '200px' }}>
          <label className="block text-xs text-gray-500 mb-1">Search</label>
          <input
            type="text"
            placeholder="Search by name..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full p-2 border rounded text-sm"
          />
        </div>

        {/* Date From */}
        <div style={{ minWidth: '150px' }}>
          <label className="block text-xs text-gray-500 mb-1">From Date</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); setPage(1); }}
            className="w-full p-2 border rounded text-sm"
          />
        </div>

        {/* Date To */}
        <div style={{ minWidth: '150px' }}>
          <label className="block text-xs text-gray-500 mb-1">To Date</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => { setDateTo(e.target.value); setPage(1); }}
            className="w-full p-2 border rounded text-sm"
          />
        </div>

        {/* Clear Filters */}
        {(search || dateFrom || dateTo) && (
          <button
            onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setPage(1); }}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
            style={{ paddingBottom: '0.5rem' }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Loading */}
      {isFetching && (
        <div style={{ textAlign: 'center', padding: '1rem', color: '#6b7280' }}>
          Loading...
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: 'auto', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <colgroup>
            <col style={{ width: '10%' }} />
            <col style={{ width: '22%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '10%' }} />
          </colgroup>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Date</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Name</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Rank</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Entries</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Receipts</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Status</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {submissions.length === 0 && !isFetching ? (
              <tr>
                <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
                  No time sheets found
                </td>
              </tr>
            ) : (
              submissions.map((sub) => {
                const fd = sub.form_data;
                const rank = fd?.rank || '—';
                const entryCount = fd?.entries?.length || 0;

                return (
                <tr key={sub.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '0.75rem' }}>
                    {sub.date ? new Date(sub.date + 'T00:00:00').toLocaleDateString('en-US') : '—'}
                  </td>
                  <td style={{ padding: '0.75rem', fontWeight: 500 }}>
                    {fd?.name || sub.job_name || sub.technician_name || '—'}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    {rank}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    {entryCount}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    {sub.photo_urls?.length || 0}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <select
                      value={sub.status}
                      onChange={e => handleStatusChange(sub.id, e.target.value)}
                      style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        border: '1px solid #e5e7eb',
                        backgroundColor: sub.status === 'reviewed' ? '#dcfce7' : sub.status === 'archived' ? '#f3f4f6' : '#fef9c3',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="submitted">Submitted</option>
                      <option value="reviewed">Reviewed</option>
                      <option value="archived">Archived</option>
                    </select>
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <Link
                      href={`/admin/report/${sub.id}`}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1.5rem' }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-gray-50"
          >
            ← Prev
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-gray-50"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
