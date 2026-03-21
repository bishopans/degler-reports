'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';

const SUPABASE_STORAGE_URL = 'https://djogryqqqwlpmsnqpktz.supabase.co/storage/v1/object/public/manuals';

interface Manual {
  id: string;
  manufacturer: string;
  equipment_category: string;
  product_model: string;
  product_name: string | null;
  manual_type: string;
  filename: string;
  storage_path: string;
  file_size_bytes: number | null;
  sport: string | null;
  source_url: string | null;
}

interface CategoryInfo {
  name: string;
  icon: string;
  description: string;
  count: number;
}

const CATEGORY_META: Record<string, { icon: string; description: string }> = {
  Scoreboards: { icon: '📊', description: 'LED scoreboards, controllers, and display systems' },
  Bleachers: { icon: '🏟️', description: 'Telescopic bleachers, fixed seating, and grandstands' },
  'Athletic Equipment': { icon: '🏀', description: 'Basketball goals, volleyball systems, and gym equipment' },
  'Folding Partitions': { icon: '🚪', description: 'Operable walls, gym dividers, and partition systems' },
  Other: { icon: '🔧', description: 'Miscellaneous equipment and accessories' },
};

const MANUAL_TYPE_LABELS: Record<string, string> = {
  spec_sheet: 'Spec Sheet',
  install_drawing: 'Install Drawing',
  faceview_drawing: 'Faceview Drawing',
  user_manual: 'User Manual',
  installation_guide: 'Installation Guide',
  color_chart: 'Color Chart',
  other: 'Other',
  'Spec Sheet': 'Spec Sheet',
  'Installation Guide': 'Installation Guide',
  'Manual': 'Manual',
  'Quick Guide': 'Quick Guide',
  'Other': 'Other',
};

const MANUAL_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  spec_sheet: { bg: '#dbeafe', text: '#1e40af' },
  install_drawing: { bg: '#dcfce7', text: '#166534' },
  faceview_drawing: { bg: '#fef3c7', text: '#92400e' },
  user_manual: { bg: '#ede9fe', text: '#5b21b6' },
  installation_guide: { bg: '#fce7f3', text: '#9d174d' },
  color_chart: { bg: '#ffedd5', text: '#9a3412' },
  other: { bg: '#f3f4f6', text: '#374151' },
  'Spec Sheet': { bg: '#dbeafe', text: '#1e40af' },
  'Installation Guide': { bg: '#fce7f3', text: '#9d174d' },
  'Manual': { bg: '#ede9fe', text: '#5b21b6' },
  'Quick Guide': { bg: '#fef3c7', text: '#92400e' },
  'Other': { bg: '#f3f4f6', text: '#374151' },
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

type View = 'categories' | 'manufacturers' | 'products';

export default function ManualsPage() {
  const [allManuals, setAllManuals] = useState<Manual[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedManufacturer, setSelectedManufacturer] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [view, setView] = useState<View>('categories');
  const [expandedModels, setExpandedModels] = useState<Set<string>>(new Set());

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch all manuals once on mount
  useEffect(() => {
    async function fetchManuals() {
      try {
        const res = await fetch('/api/manuals');
        if (!res.ok) throw new Error('Failed to load manuals');
        const data = await res.json();
        setAllManuals(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load manuals');
      } finally {
        setLoading(false);
      }
    }
    fetchManuals();
  }, []);

  // Normalize text for flexible matching: strip dashes, underscores, spaces
  // so "MP80" matches "MP-80", "MP 80", "MP_80", etc.
  const normalize = (text: string) => text.toLowerCase().replace(/[-_\s.]/g, '');

  // Filter manuals client-side
  const filteredManuals = allManuals.filter((m) => {
    if (selectedCategory && m.equipment_category !== selectedCategory) return false;
    if (selectedManufacturer && m.manufacturer !== selectedManufacturer) return false;
    if (selectedType && m.manual_type !== selectedType) return false;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      const qNorm = normalize(debouncedSearch);
      const searchable = `${m.product_model} ${m.product_name || ''} ${m.filename} ${m.manufacturer}`.toLowerCase();
      const searchableNorm = normalize(searchable);
      // Match on either exact substring or normalized substring
      if (!searchable.includes(q) && !searchableNorm.includes(qNorm)) return false;
    }
    return true;
  });

  // Derive categories with counts
  const categories: CategoryInfo[] = (() => {
    const counts: Record<string, number> = {};
    allManuals.forEach((m) => {
      counts[m.equipment_category] = (counts[m.equipment_category] || 0) + 1;
    });
    const order = ['Scoreboards', 'Athletic Equipment', 'Bleachers', 'Folding Partitions', 'Other'];
    const cats: CategoryInfo[] = [];
    // Known categories first
    for (const name of order) {
      const meta = CATEGORY_META[name] || { icon: '📄', description: '' };
      cats.push({ name, icon: meta.icon, description: meta.description, count: counts[name] || 0 });
      delete counts[name];
    }
    // Any unexpected categories
    for (const [name, count] of Object.entries(counts)) {
      cats.push({ name, icon: '📄', description: '', count });
    }
    return cats;
  })();

  // Derive manufacturers within selected category
  const manufacturers = (() => {
    const source = selectedCategory
      ? allManuals.filter((m) => m.equipment_category === selectedCategory)
      : allManuals;
    const counts: Record<string, number> = {};
    source.forEach((m) => {
      counts[m.manufacturer] = (counts[m.manufacturer] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, count }));
  })();

  // Derive manual types for the active filter state
  const manualTypes = (() => {
    const counts: Record<string, number> = {};
    filteredManuals.forEach((m) => {
      counts[m.manual_type] = (counts[m.manual_type] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([type, count]) => ({ type, label: MANUAL_TYPE_LABELS[type] || type, count }));
  })();

  // Group filtered manuals by product model
  const groupedByModel = (() => {
    const groups: Record<string, { model: string; name: string | null; manuals: Manual[] }> = {};
    filteredManuals.forEach((m) => {
      if (!groups[m.product_model]) {
        groups[m.product_model] = { model: m.product_model, name: m.product_name, manuals: [] };
      }
      groups[m.product_model].manuals.push(m);
    });
    return Object.values(groups).sort((a, b) => a.model.localeCompare(b.model));
  })();

  const toggleModel = useCallback((model: string) => {
    setExpandedModels((prev) => {
      const next = new Set(prev);
      if (next.has(model)) next.delete(model);
      else next.add(model);
      return next;
    });
  }, []);

  const handleCategoryClick = (catName: string) => {
    setSelectedCategory(catName);
    setSelectedManufacturer('');
    setSelectedType('');
    setView('manufacturers');
    setExpandedModels(new Set());
  };

  const handleManufacturerClick = (mfr: string) => {
    setSelectedManufacturer(mfr);
    setSelectedType('');
    setView('products');
    setExpandedModels(new Set());
  };

  const handleBack = () => {
    if (view === 'products') {
      setSelectedManufacturer('');
      setSelectedType('');
      setView('manufacturers');
      setExpandedModels(new Set());
    } else if (view === 'manufacturers') {
      setSelectedCategory('');
      setSelectedManufacturer('');
      setSelectedType('');
      setView('categories');
      setExpandedModels(new Set());
    }
  };

  const handleSearchClear = () => {
    setSearch('');
    setDebouncedSearch('');
  };

  // If searching, go straight to products view
  const isSearching = debouncedSearch.length > 0;
  const effectiveView = isSearching ? 'products' : view;

  const totalManuals = allManuals.length;

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <div style={{
        background: '#00457c',
        padding: '1.5rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center' }}>
            <Image src="/images/logo.png" alt="DW Logo" width={50} height={50} style={{ borderRadius: 4, background: 'white', padding: 2 }} />
          </Link>
          <div>
            <h1 style={{ margin: 0, color: 'white', fontSize: '1.35rem', fontWeight: 700 }}>
              Product Manual Library
            </h1>
            <p style={{ margin: 0, color: '#93c5fd', fontSize: '0.8rem' }}>
              Degler Whiting {totalManuals > 0 ? `· ${totalManuals} documents` : ''}
            </p>
          </div>
        </div>
        <Link
          href="/"
          style={{
            color: 'white',
            textDecoration: 'none',
            fontSize: '0.9rem',
            padding: '0.5rem 1rem',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: 6,
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; }}
          onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          ← Back to Home
        </Link>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '1.5rem 1.5rem 3rem' }}>
        {/* Search bar */}
        <div style={{ marginBottom: '1.25rem', position: 'relative' }}>
          <input
            type="text"
            placeholder="Search by model, product name, or filename..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '0.85rem 2.5rem 0.85rem 2.75rem',
              border: '2px solid #e5e7eb',
              borderRadius: 8,
              fontSize: '1rem',
              background: 'white',
              boxSizing: 'border-box',
              outline: 'none',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#00457c'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; }}
          />
          <span style={{
            position: 'absolute',
            left: '0.85rem',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '1.1rem',
            color: '#9ca3af',
            pointerEvents: 'none',
          }}>🔍</span>
          {search && (
            <button
              onClick={handleSearchClear}
              style={{
                position: 'absolute',
                right: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                fontSize: '1.2rem',
                color: '#9ca3af',
                cursor: 'pointer',
                padding: '0.25rem',
              }}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Breadcrumb navigation */}
        {(effectiveView !== 'categories' && !isSearching) && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            marginBottom: '1.25rem',
            fontSize: '0.85rem',
            color: '#6b7280',
            flexWrap: 'wrap',
          }}>
            <button
              onClick={() => { setSelectedCategory(''); setSelectedManufacturer(''); setSelectedType(''); setView('categories'); setExpandedModels(new Set()); }}
              style={{ background: 'none', border: 'none', color: '#00457c', cursor: 'pointer', padding: 0, fontSize: '0.85rem', textDecoration: 'underline' }}
            >
              All Categories
            </button>
            {selectedCategory && (
              <>
                <span style={{ color: '#9ca3af' }}>/</span>
                {view === 'manufacturers' ? (
                  <span style={{ fontWeight: 600, color: '#111' }}>{selectedCategory}</span>
                ) : (
                  <button
                    onClick={handleBack}
                    style={{ background: 'none', border: 'none', color: '#00457c', cursor: 'pointer', padding: 0, fontSize: '0.85rem', textDecoration: 'underline' }}
                  >
                    {selectedCategory}
                  </button>
                )}
              </>
            )}
            {selectedManufacturer && (
              <>
                <span style={{ color: '#9ca3af' }}>/</span>
                <span style={{ fontWeight: 600, color: '#111' }}>{selectedManufacturer}</span>
              </>
            )}
          </div>
        )}

        {/* Search results label */}
        {isSearching && (
          <div style={{ marginBottom: '1rem', fontSize: '0.9rem', color: '#6b7280' }}>
            Showing {filteredManuals.length} result{filteredManuals.length !== 1 ? 's' : ''} for &quot;{debouncedSearch}&quot;
          </div>
        )}

        {/* Loading / Error */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⏳</div>
            Loading manual library...
          </div>
        )}
        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 8,
            padding: '1rem',
            color: '#dc2626',
            fontSize: '0.9rem',
          }}>
            {error}
          </div>
        )}

        {/* CATEGORIES VIEW */}
        {!loading && !error && effectiveView === 'categories' && (
          <>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#00457c', marginBottom: '1rem', marginTop: 0 }}>
              Browse by Equipment Category
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '1rem',
            }} className="manuals-grid">
              {categories.map((cat) => (
                <div
                  key={cat.name}
                  onClick={() => cat.count > 0 && handleCategoryClick(cat.name)}
                  style={{
                    border: '2px solid #e5e7eb',
                    borderRadius: 10,
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    background: 'white',
                    opacity: cat.count === 0 ? 0.55 : 1,
                    cursor: cat.count === 0 ? 'default' : 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (cat.count > 0) {
                      e.currentTarget.style.borderColor = '#00457c';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,69,124,0.12)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <span style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{cat.icon}</span>
                  <span style={{ fontSize: '1rem', fontWeight: 600, color: '#111', marginBottom: '0.25rem' }}>{cat.name}</span>
                  <span style={{ fontSize: '0.8rem', color: '#6b7280', lineHeight: 1.4 }}>{cat.description}</span>
                  <span style={{
                    marginTop: '0.75rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '0.2rem 0.6rem',
                    borderRadius: 12,
                    background: cat.count > 0 ? '#dcfce7' : '#f3f4f6',
                    color: cat.count > 0 ? '#166534' : '#9ca3af',
                  }}>
                    {cat.count > 0 ? `${cat.count} document${cat.count !== 1 ? 's' : ''}` : 'Coming soon'}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* MANUFACTURERS VIEW */}
        {!loading && !error && effectiveView === 'manufacturers' && !isSearching && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <button
                onClick={handleBack}
                style={{
                  background: 'none',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  color: '#374151',
                }}
              >
                ← Back
              </button>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#00457c', margin: 0 }}>
                {selectedCategory} — Select Manufacturer
              </h2>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '1rem',
            }} className="manuals-grid">
              {manufacturers.map((mfr) => (
                <div
                  key={mfr.name}
                  onClick={() => handleManufacturerClick(mfr.name)}
                  style={{
                    border: '2px solid #e5e7eb',
                    borderRadius: 10,
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    background: 'white',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#00457c';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,69,124,0.12)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <span style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🏭</span>
                  <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#111' }}>{mfr.name}</span>
                  <span style={{
                    marginTop: '0.5rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '0.2rem 0.6rem',
                    borderRadius: 12,
                    background: '#dbeafe',
                    color: '#1e40af',
                  }}>
                    {mfr.count} document{mfr.count !== 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* PRODUCTS VIEW */}
        {!loading && !error && effectiveView === 'products' && (
          <>
            {!isSearching && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <button
                  onClick={handleBack}
                  style={{
                    background: 'none',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    color: '#374151',
                  }}
                >
                  ← Back
                </button>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#00457c', margin: 0 }}>
                  {selectedManufacturer} {selectedCategory}
                </h2>
              </div>
            )}

            {/* Type filter chips */}
            {manualTypes.length > 1 && (
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
                marginBottom: '1.25rem',
              }}>
                <button
                  onClick={() => setSelectedType('')}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: 20,
                    border: selectedType === '' ? '2px solid #00457c' : '1px solid #d1d5db',
                    background: selectedType === '' ? '#00457c' : 'white',
                    color: selectedType === '' ? 'white' : '#374151',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  All Types ({filteredManuals.length})
                </button>
                {manualTypes.map((mt) => {
                  const colors = MANUAL_TYPE_COLORS[mt.type] || MANUAL_TYPE_COLORS.other;
                  const isActive = selectedType === mt.type;
                  return (
                    <button
                      key={mt.type}
                      onClick={() => setSelectedType(isActive ? '' : mt.type)}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: 20,
                        border: isActive ? `2px solid ${colors.text}` : '1px solid #d1d5db',
                        background: isActive ? colors.bg : 'white',
                        color: isActive ? colors.text : '#374151',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {mt.label} ({mt.count})
                    </button>
                  );
                })}
              </div>
            )}

            {/* Product model list */}
            {groupedByModel.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af', fontSize: '0.95rem' }}>
                No manuals found matching your criteria.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {groupedByModel.map((group) => {
                  const isExpanded = expandedModels.has(group.model);
                  return (
                    <div
                      key={group.model}
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: 8,
                        background: 'white',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Model header */}
                      <div
                        onClick={() => toggleModel(group.model)}
                        style={{
                          padding: '0.85rem 1rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          userSelect: 'none',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#f9fafb'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                          <span style={{
                            fontSize: '0.7rem',
                            color: '#9ca3af',
                            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                            transition: 'transform 0.15s',
                            flexShrink: 0,
                          }}>
                            ▶
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: '#111', fontSize: '0.95rem' }}>
                              {group.model}
                            </div>
                            {group.name && group.name !== group.model && (
                              <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.1rem' }}>
                                {group.name}
                              </div>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                          {/* Mini type badges */}
                          {group.manuals.map((m) => {
                            const colors = MANUAL_TYPE_COLORS[m.manual_type] || MANUAL_TYPE_COLORS.other;
                            return (
                              <span key={m.id} style={{
                                display: 'inline-block',
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: colors.text,
                                opacity: 0.6,
                              }} title={MANUAL_TYPE_LABELS[m.manual_type] || m.manual_type} />
                            );
                          })}
                          <span style={{ fontSize: '0.75rem', color: '#9ca3af', marginLeft: '0.25rem' }}>
                            {group.manuals.length} file{group.manuals.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>

                      {/* Expanded document list */}
                      {isExpanded && (
                        <div style={{
                          borderTop: '1px solid #f3f4f6',
                          padding: '0.5rem 0',
                        }}>
                          {group.manuals
                            .sort((a, b) => a.manual_type.localeCompare(b.manual_type))
                            .map((m) => {
                              const colors = MANUAL_TYPE_COLORS[m.manual_type] || MANUAL_TYPE_COLORS.other;
                              const pdfUrl = `${SUPABASE_STORAGE_URL}/${m.storage_path}`;
                              return (
                                <a
                                  key={m.id}
                                  href={pdfUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    padding: '0.6rem 1rem 0.6rem 2.5rem',
                                    textDecoration: 'none',
                                    color: '#111',
                                    transition: 'background 0.1s',
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f7ff'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                >
                                  <span style={{ fontSize: '1rem', flexShrink: 0, color: '#dc2626' }}>📄</span>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                      fontSize: '0.85rem',
                                      fontWeight: 500,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}>
                                      {m.filename}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                                      <span style={{
                                        fontSize: '0.7rem',
                                        fontWeight: 600,
                                        padding: '0.1rem 0.45rem',
                                        borderRadius: 4,
                                        background: colors.bg,
                                        color: colors.text,
                                      }}>
                                        {MANUAL_TYPE_LABELS[m.manual_type] || m.manual_type}
                                      </span>
                                      {m.file_size_bytes && (
                                        <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                                          {formatFileSize(m.file_size_bytes)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <span style={{
                                    fontSize: '0.8rem',
                                    color: '#00457c',
                                    fontWeight: 600,
                                    flexShrink: 0,
                                  }}>
                                    Open ↗
                                  </span>
                                </a>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
