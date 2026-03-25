'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface RaffleEntry {
  name: string;
  entries: number;
}

interface RaffleWinner {
  id: string;
  winner_name: string;
  entries_at_win: number;
  quarter: string;
  drawn_at: string;
}

export default function RafflePage() {
  const router = useRouter();
  const [entries, setEntries] = useState<RaffleEntry[]>([]);
  const [winners, setWinners] = useState<RaffleWinner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinningName, setSpinningName] = useState<string | null>(null);
  const [selectedWinner, setSelectedWinner] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [quarter, setQuarter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const spinIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Generate current quarter label and default date range
  useEffect(() => {
    const now = new Date();
    const q = Math.ceil((now.getMonth() + 1) / 3);
    setQuarter(`Q${q} ${now.getFullYear()}`);

    // Default date range to current quarter
    const quarterStartMonth = (q - 1) * 3; // 0-indexed
    const qStart = new Date(now.getFullYear(), quarterStartMonth, 1);
    const qEnd = new Date(now.getFullYear(), quarterStartMonth + 3, 0); // last day of quarter
    setDateFrom(qStart.toISOString().split('T')[0]);
    setDateTo(qEnd.toISOString().split('T')[0]);
  }, []);

  const fetchRaffleData = useCallback(async (from?: string, to?: string) => {
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const qs = params.toString();
      const response = await fetch(`/api/admin/raffle${qs ? `?${qs}` : ''}`);
      if (response.ok) {
        const data = await response.json();
        setEntries(data.entries || []);
        setWinners(data.winners || []);
      }
    } catch (error) {
      console.error('Failed to fetch raffle data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const unlocked = sessionStorage.getItem('dw-admin-unlocked');
    if (unlocked !== 'true') {
      router.push('/admin');
      return;
    }
    // Initial fetch happens once dates are set via the other useEffect
  }, [router]);

  // Re-fetch entries whenever date range changes
  useEffect(() => {
    if (!dateFrom || !dateTo) return;
    fetchRaffleData(dateFrom, dateTo);
  }, [dateFrom, dateTo, fetchRaffleData]);

  // Build the weighted pool: each name appears once per entry
  const buildPool = useCallback(() => {
    const pool: string[] = [];
    entries.forEach(({ name, entries: count }) => {
      for (let i = 0; i < count; i++) {
        pool.push(name);
      }
    });
    return pool;
  }, [entries]);

  const totalEntries = entries.reduce((sum, e) => sum + e.entries, 0);

  const handleSpin = () => {
    if (entries.length === 0) return;
    setIsSpinning(true);
    setSelectedWinner(null);
    setShowConfetti(false);

    const pool = buildPool();
    let tick = 0;
    const totalTicks = 40 + Math.floor(Math.random() * 20); // 40-60 cycles
    // Pick the final winner now (weighted by entries)
    const finalWinner = pool[Math.floor(Math.random() * pool.length)];

    // Cycle through names with decreasing speed
    spinIntervalRef.current = setInterval(() => {
      tick++;
      // Pick a random name to display during spinning
      const displayName = tick >= totalTicks
        ? finalWinner
        : pool[Math.floor(Math.random() * pool.length)];
      setSpinningName(displayName);

      // Slow down as we approach the end
      if (tick >= totalTicks) {
        if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
        setIsSpinning(false);
        setSelectedWinner(finalWinner);
        setSpinningName(null);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 4000);
      }
    }, tick < totalTicks * 0.5 ? 60 : tick < totalTicks * 0.75 ? 120 : 200);
  };

  const handleRecordWinner = async () => {
    if (!selectedWinner) return;
    const winnerEntry = entries.find(e => e.name === selectedWinner);

    try {
      const response = await fetch('/api/admin/raffle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          winner_name: selectedWinner,
          entries_at_win: winnerEntry?.entries || 0,
          quarter,
        }),
      });

      if (response.ok) {
        setSelectedWinner(null);
        fetchRaffleData(dateFrom, dateTo);
      }
    } catch (error) {
      console.error('Failed to record winner:', error);
    }
  };

  const handleDeleteWinner = async (id: string) => {
    if (!window.confirm('Remove this winner from the log?')) return;
    try {
      await fetch(`/api/admin/raffle?id=${id}`, { method: 'DELETE' });
      fetchRaffleData(dateFrom, dateTo);
    } catch (error) {
      console.error('Failed to delete winner:', error);
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
        <p style={{ color: '#6b7280' }}>Loading raffle data...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', padding: '1.5rem' }}>
      {/* Confetti overlay */}
      {showConfetti && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          pointerEvents: 'none', zIndex: 50, overflow: 'hidden',
        }}>
          {Array.from({ length: 60 }).map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: '-10px',
                left: `${Math.random() * 100}%`,
                width: `${6 + Math.random() * 8}px`,
                height: `${6 + Math.random() * 8}px`,
                backgroundColor: ['#00457c', '#a8123e', '#C8A415', '#16a34a', '#7c3aed', '#f59e0b'][i % 6],
                borderRadius: Math.random() > 0.5 ? '50%' : '0',
                animation: `confetti-fall ${2 + Math.random() * 2}s ease-in forwards`,
                animationDelay: `${Math.random() * 0.5}s`,
                transform: `rotate(${Math.random() * 360}deg)`,
              }}
            />
          ))}
          <style>{`
            @keyframes confetti-fall {
              0% { transform: translateY(0) rotate(0deg); opacity: 1; }
              100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
            }
          `}</style>
        </div>
      )}

      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#00457c' }}>
              Quarterly Report Raffle
            </h1>
            <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Every service report submitted = 1 raffle entry
            </p>
          </div>
          <Link
            href="/admin"
            style={{
              padding: '0.5rem 1rem', backgroundColor: '#00457c', color: 'white',
              borderRadius: '0.5rem', textDecoration: 'none', fontSize: '0.875rem',
            }}
          >
            Back to Admin
          </Link>
        </div>

        {/* Quarter selector + Date range filter */}
        <div style={{
          marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem',
          flexWrap: 'wrap', backgroundColor: 'white', padding: '0.75rem 1rem',
          borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>Drawing for:</label>
            <input
              type="text"
              value={quarter}
              onChange={(e) => setQuarter(e.target.value)}
              style={{
                padding: '0.375rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.375rem',
                fontSize: '0.875rem', width: '120px',
              }}
            />
          </div>
          <div style={{ width: '1px', height: '24px', backgroundColor: '#d1d5db' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>From:</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{
                padding: '0.375rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem',
                fontSize: '0.875rem',
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>To:</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{
                padding: '0.375rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem',
                fontSize: '0.875rem',
              }}
            />
          </div>
        </div>

        {/* Spinner Section */}
        <div style={{
          backgroundColor: 'white', borderRadius: '1rem', padding: '2rem',
          marginBottom: '1.5rem', textAlign: 'center',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
          border: '2px solid #00457c',
        }}>
          {/* Display area */}
          <div style={{
            minHeight: '120px', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem',
          }}>
            {selectedWinner ? (
              <>
                <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>THE WINNER IS</p>
                <p style={{
                  fontSize: '2.5rem', fontWeight: 800, color: '#C8A415',
                  textShadow: '1px 1px 2px rgba(0,0,0,0.1)',
                  animation: 'winner-pop 0.5s ease-out',
                }}>
                  {selectedWinner}
                </p>
                <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  {entries.find(e => e.name === selectedWinner)?.entries || 0} entries
                </p>
                <style>{`
                  @keyframes winner-pop {
                    0% { transform: scale(0.5); opacity: 0; }
                    50% { transform: scale(1.1); }
                    100% { transform: scale(1); opacity: 1; }
                  }
                `}</style>
              </>
            ) : isSpinning ? (
              <>
                <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Selecting...
                </p>
                <p style={{
                  fontSize: '2.25rem', fontWeight: 700, color: '#00457c',
                  transition: 'all 0.05s',
                }}>
                  {spinningName || '...'}
                </p>
              </>
            ) : (
              <p style={{ fontSize: '1.25rem', color: '#9ca3af' }}>
                Press the button to draw a winner!
              </p>
            )}
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={handleSpin}
              disabled={isSpinning || entries.length === 0}
              style={{
                padding: '0.75rem 2rem',
                backgroundColor: isSpinning ? '#9ca3af' : '#a8123e',
                color: 'white', border: 'none', borderRadius: '0.75rem',
                fontSize: '1.1rem', fontWeight: 700, cursor: isSpinning ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(168, 18, 62, 0.3)',
                transition: 'all 0.2s',
              }}
            >
              {isSpinning ? 'Drawing...' : selectedWinner ? 'Spin Again' : 'Draw Winner'}
            </button>

            {selectedWinner && (
              <button
                onClick={handleRecordWinner}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#16a34a', color: 'white', border: 'none',
                  borderRadius: '0.75rem', fontSize: '1rem', fontWeight: 600,
                  cursor: 'pointer', boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)',
                }}
              >
                Record Winner
              </button>
            )}
          </div>
        </div>

        {/* Two-column layout: Entries + Winners */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {/* Entry Tallies */}
          <div style={{
            backgroundColor: 'white', borderRadius: '0.75rem', padding: '1.25rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#00457c', marginBottom: '0.75rem', borderBottom: '2px solid #00457c', paddingBottom: '0.5rem' }}>
              Raffle Entries ({totalEntries} total)
            </h2>
            <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.75rem' }}>
              Excludes: Photo Uploads, Time Sheets, Accident Reports
            </p>
            {entries.length === 0 ? (
              <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>No eligible submissions yet.</p>
            ) : (
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {entries.map((entry, i) => (
                  <div
                    key={entry.name}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '0.5rem 0.75rem', borderRadius: '0.375rem',
                      backgroundColor: i % 2 === 0 ? '#f9fafb' : 'white',
                      borderLeft: selectedWinner === entry.name ? '3px solid #C8A415' : '3px solid transparent',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{
                        width: '1.5rem', height: '1.5rem', borderRadius: '50%',
                        backgroundColor: '#00457c', color: 'white', fontSize: '0.7rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, flexShrink: 0,
                      }}>
                        {i + 1}
                      </span>
                      <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#111827' }}>{entry.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{
                        backgroundColor: '#eff6ff', color: '#1e40af', padding: '0.125rem 0.5rem',
                        borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600,
                      }}>
                        {entry.entries} {entry.entries === 1 ? 'entry' : 'entries'}
                      </div>
                      <div style={{
                        width: `${Math.min(entry.entries / (entries[0]?.entries || 1) * 60, 60)}px`,
                        height: '6px', backgroundColor: '#00457c', borderRadius: '3px', opacity: 0.5,
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Winner History */}
          <div style={{
            backgroundColor: 'white', borderRadius: '0.75rem', padding: '1.25rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#C8A415', marginBottom: '0.75rem', borderBottom: '2px solid #C8A415', paddingBottom: '0.5rem' }}>
              Winner History
            </h2>
            {winners.length === 0 ? (
              <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>No winners drawn yet.</p>
            ) : (
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {winners.map((winner) => (
                  <div
                    key={winner.id}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '0.625rem 0.75rem', borderBottom: '1px solid #f3f4f6',
                    }}
                  >
                    <div>
                      <p style={{ fontWeight: 600, fontSize: '0.9rem', color: '#111827' }}>{winner.winner_name}</p>
                      <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                        {winner.quarter} &middot; {winner.entries_at_win} entries &middot; {new Date(winner.drawn_at).toLocaleDateString('en-US')}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteWinner(winner.id)}
                      style={{
                        background: 'none', border: 'none', color: '#d1d5db',
                        cursor: 'pointer', fontSize: '1rem', padding: '0.25rem',
                      }}
                      title="Remove winner"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
