'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';

interface Announcement {
  id: string;
  title: string;
  body: string;
  image_url: string | null;
  start_at: string;
  end_at: string;
  created_at: string;
  updated_at: string;
}

function getStatus(a: Announcement): 'active' | 'scheduled' | 'expired' {
  const now = new Date();
  const start = new Date(a.start_at);
  const end = new Date(a.end_at);
  if (now >= start && now < end) return 'active';
  if (now < start) return 'scheduled';
  return 'expired';
}

function statusBadge(status: 'active' | 'scheduled' | 'expired') {
  const colors = {
    active: { bg: '#dcfce7', text: '#166534', border: '#86efac' },
    scheduled: { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
    expired: { bg: '#f3f4f6', text: '#6b7280', border: '#d1d5db' },
  };
  const c = colors[status];
  return (
    <span style={{
      display: 'inline-block',
      padding: '0.15rem 0.5rem',
      borderRadius: '9999px',
      fontSize: '0.75rem',
      fontWeight: 600,
      backgroundColor: c.bg,
      color: c.text,
      border: `1px solid ${c.border}`,
      textTransform: 'capitalize',
    }}>
      {status}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [uploading, setUploading] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAnnouncements = async () => {
    try {
      const res = await fetch('/api/admin/announcements');
      const data = await res.json();
      if (data.announcements) setAnnouncements(data.announcements);
    } catch (err) {
      console.error('Failed to load announcements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAnnouncements(); }, []);

  const resetForm = () => {
    setTitle('');
    setImageUrl('');
    setStartAt('');
    setEndAt('');
    setEditingId(null);
    if (editorRef.current) editorRef.current.innerHTML = '';
  };

  const openCreateForm = () => {
    resetForm();
    const now = new Date();
    const week = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    setStartAt(toLocalInput(now.toISOString()));
    setEndAt(toLocalInput(week.toISOString()));
    setShowForm(true);
    setEditingId(null);
  };

  const openEditForm = (a: Announcement) => {
    setTitle(a.title);
    setImageUrl(a.image_url || '');
    setStartAt(toLocalInput(a.start_at));
    setEndAt(toLocalInput(a.end_at));
    setEditingId(a.id);
    setShowForm(true);
    setTimeout(() => {
      if (editorRef.current) editorRef.current.innerHTML = a.body;
    }, 50);
  };

  const handleSave = async () => {
    const body = editorRef.current?.innerHTML || '';
    if (!title.trim() || !body.trim() || !startAt || !endAt) {
      alert('Please fill in all required fields (title, body, start and end date).');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        id: editingId || undefined,
        title: title.trim(),
        body,
        image_url: imageUrl.trim() || null,
        start_at: new Date(startAt).toISOString(),
        end_at: new Date(endAt).toISOString(),
      };
      const res = await fetch('/api/admin/announcements', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to save');
      setShowForm(false);
      resetForm();
      fetchAnnouncements();
    } catch (err) {
      console.error('Save error:', err);
      alert('Failed to save announcement.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this announcement? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/admin/announcements?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      fetchAnnouncements();
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete announcement.');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'announcements');
      const res = await fetch('/api/admin/announcements/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) { setImageUrl(data.url); }
      else { alert('Upload failed.'); }
    } catch (err) {
      console.error('Upload error:', err);
      alert('Failed to upload image.');
    } finally {
      setUploading(false);
    }
  };

  const execCommand = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <Link href="/admin" style={{ fontSize: '0.875rem', color: '#6b7280', textDecoration: 'none' }}>&larr; Back to Dashboard</Link>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.25rem 0 0 0' }}>Announcements</h1>
          </div>
          <button onClick={openCreateForm} style={{ padding: '0.6rem 1.25rem', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: 6, fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' }}>+ New Announcement</button>
        </div>

        {showForm && (
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: '1.5rem', marginBottom: '2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>{editingId ? 'Edit Announcement' : 'New Announcement'}</h2>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.25rem' }}>Title *</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Announcement title" style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.95rem', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.25rem' }}>Message *</label>
              <div style={{ display: 'flex', gap: '0.25rem', padding: '0.375rem', border: '1px solid #d1d5db', borderBottom: 'none', borderRadius: '6px 6px 0 0', background: '#f9fafb', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => execCommand('bold')} style={toolbarBtn} title="Bold"><b>B</b></button>
                <button type="button" onClick={() => execCommand('italic')} style={toolbarBtn} title="Italic"><i>I</i></button>
                <button type="button" onClick={() => execCommand('underline')} style={toolbarBtn} title="Underline"><u>U</u></button>
                <span style={{ width: 1, background: '#d1d5db', margin: '0 0.25rem' }} />
                <button type="button" onClick={() => execCommand('insertUnorderedList')} style={toolbarBtn} title="Bullet list">• List</button>
                <button type="button" onClick={() => { const url = prompt('Enter URL:'); if (url) execCommand('createLink', url); }} style={toolbarBtn} title="Insert link">🔗 Link</button>
              </div>
              <div ref={editorRef} contentEditable style={{ minHeight: 120, padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0 0 6px 6px', fontSize: '0.95rem', lineHeight: 1.6, outline: 'none' }} onFocus={(e) => { e.currentTarget.style.borderColor = '#2563eb'; }} onBlur={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; }} />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.25rem' }}>Image (optional)</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ padding: '0.4rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 6, background: 'white', fontSize: '0.85rem', cursor: uploading ? 'wait' : 'pointer' }}>{uploading ? 'Uploading...' : 'Upload Image'}</button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                {imageUrl && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <img src={imageUrl} alt="Preview" style={{ height: 40, borderRadius: 4, border: '1px solid #e5e7eb' }} />
                    <button type="button" onClick={() => setImageUrl('')} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.85rem' }}>Remove</button>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.25rem' }}>Start Date & Time *</label>
                <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.9rem', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.25rem' }}>End Date & Time *</label>
                <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.9rem', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={handleSave} disabled={saving} style={{ padding: '0.5rem 1.25rem', backgroundColor: saving ? '#93c5fd' : '#2563eb', color: 'white', border: 'none', borderRadius: 6, fontSize: '0.9rem', fontWeight: 600, cursor: saving ? 'wait' : 'pointer' }}>{saving ? 'Saving...' : editingId ? 'Update' : 'Publish'}</button>
              <button onClick={() => { setShowForm(false); resetForm(); }} style={{ padding: '0.5rem 1.25rem', backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.9rem', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}

        {loading ? (
          <p style={{ textAlign: 'center', color: '#6b7280' }}>Loading...</p>
        ) : announcements.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: 8, border: '1px solid #e5e7eb', color: '#6b7280' }}>
            <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>No announcements yet</p>
            <p style={{ fontSize: '0.9rem' }}>Click &ldquo;+ New Announcement&rdquo; to create your first post.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {announcements.map((a) => {
              const status = getStatus(a);
              return (
                <div key={a.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem 1.25rem', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '1rem' }}>{a.title}</span>
                        {statusBadge(status)}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#4b5563', lineHeight: 1.5, marginBottom: '0.5rem' }} dangerouslySetInnerHTML={{ __html: a.body.length > 150 ? a.body.substring(0, 150) + '...' : a.body }} />
                      <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{formatDate(a.start_at)} &mdash; {formatDate(a.end_at)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                      <button onClick={() => openEditForm(a)} style={{ padding: '0.35rem 0.75rem', backgroundColor: 'white', color: '#2563eb', border: '1px solid #2563eb', borderRadius: 5, fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer' }}>Edit</button>
                      <button onClick={() => handleDelete(a.id)} style={{ padding: '0.35rem 0.75rem', backgroundColor: 'white', color: '#dc2626', border: '1px solid #dc2626', borderRadius: 5, fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer' }}>Delete</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const toolbarBtn: React.CSSProperties = {
  padding: '0.25rem 0.5rem',
  border: '1px solid #d1d5db',
  borderRadius: 4,
  background: 'white',
  cursor: 'pointer',
  fontSize: '0.85rem',
  minWidth: 32,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
