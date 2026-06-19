import React, { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const EXPENSE_COLORS = {
  Diesel: '#3b82f6', Fuel: '#3b82f6', Toll: '#f59e0b', Maintenance: '#ef4444',
  Repair: '#ef4444', Advance: '#8b5cf6', Driver: '#8b5cf6', Other: '#6b7280', Misc: '#6b7280',
};
const OVERHEAD_COLORS = {
  Admin: '#6366f1', Salary: '#f59e0b', Repair: '#ef4444', Fuel: '#3b82f6',
  Rent: '#8b5cf6', 'Bribe/Misc': '#ec4899', Other: '#6b7280',
};

function SortArrow({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <span style={{ opacity: 0.3, marginLeft: 4 }}>↕</span>;
  return <span style={{ marginLeft: 4, color: 'var(--accent)' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
}

export default function Dashboard({ data }) {
  const { trips = [], trucks = [], parties = [], documents = [], overheads = [] } = data;

  const [gstFilter, setGstFilter] = useState('all'); // 'all' | 'gst' | 'nogst'
  const [partySort, setPartySort] = useState({ col: 'pending', dir: 'desc' });

  const now = new Date();
  const monthStr = now.toISOString().slice(0, 7);
  const yearStr = now.getFullYear().toString();

  // ── Helper: calculate trip totals ──────────────────────────────────────────
  const tripTotal = (t) => {
    const freight = Number(t.freight || 0);
    const hasGst = t.gst && String(t.gst).trim() !== '' && String(t.gst).trim() !== '0';
    const gstAmt = hasGst ? freight * 0.18 : 0;
    return { freight, gstAmt, total: freight + gstAmt };
  };

  const tripExpenses = (t) => (t.expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0);

  // ── WIDGET 1: Real Profit ────────────────────────────────────────────────
  const mtdTrips = trips.filter(t => t.date?.startsWith(monthStr));
  const ytdTrips = trips.filter(t => t.date?.startsWith(yearStr));
  const mtdOverheads = overheads.filter(o => o.date?.startsWith(monthStr)).reduce((s, o) => s + Number(o.amount || 0), 0);
  const ytdOverheads = overheads.filter(o => o.date?.startsWith(yearStr)).reduce((s, o) => s + Number(o.amount || 0), 0);

  const calcProfit = (tripList, overheadAmt) => {
    let freight = 0, gst = 0, expenses = 0;
    tripList.forEach(t => {
      const tt = tripTotal(t);
      freight += tt.freight;
      gst += tt.gstAmt;
      expenses += tripExpenses(t);
    });
    return { freight, gst, expenses, overhead: overheadAmt, profit: freight + gst - expenses - overheadAmt };
  };

  const mtdProfit = calcProfit(mtdTrips, mtdOverheads);
  const ytdProfit = calcProfit(ytdTrips, ytdOverheads);

  // ── WIDGET 2: Cash Flow Stress ────────────────────────────────────────────
  const totalFreight = trips.reduce((s, t) => s + Number(t.freight || 0), 0);
  const totalGstCollected = trips.reduce((s, t) => {
    const hasGst = t.gst && String(t.gst).trim() !== '' && String(t.gst).trim() !== '0';
    return s + (hasGst ? Number(t.freight || 0) * 0.18 : 0);
  }, 0);
  const totalBilled = totalFreight + totalGstCollected;
  const totalPaid = trips.reduce((s, t) => s + Number(t.paid || 0), 0);
  const stuckInMarket = totalBilled - totalPaid;
  const collectedPct = totalBilled > 0 ? Math.min(100, (totalPaid / totalBilled) * 100) : 0;

  // ── WIDGET 3: Party-Wise Ledger ───────────────────────────────────────────
  const partyLedger = useMemo(() => {
    return parties.map(p => {
      const pt = trips.filter(t => t.partyId === p.id);
      const hasGst = p.gst && p.gst.trim() !== '';
      let billed = 0, received = 0, totalDelay = 0, delayCount = 0;
      pt.forEach(t => {
        const freight = Number(t.freight || 0);
        const gst = hasGst ? freight * 0.18 : 0;
        billed += freight + gst;
        received += Number(t.paid || 0);
        if (t.status !== 'paid' && t.date) {
          const days = Math.floor((now - new Date(t.date + 'T00:00:00')) / (1000 * 60 * 60 * 24));
          if (days > 0) { totalDelay += days; delayCount++; }
        }
      });
      return {
        id: p.id, name: p.name, trips: pt.length, billed, received,
        pending: billed - received,
        avgDelay: delayCount > 0 ? Math.round(totalDelay / delayCount) : 0,
      };
    });
  }, [parties, trips]);

  const sortedLedger = useMemo(() => {
    const { col, dir } = partySort;
    return [...partyLedger].sort((a, b) => {
      const v = a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0;
      return dir === 'asc' ? v : -v;
    });
  }, [partyLedger, partySort]);

  const toggleSort = (col) => {
    setPartySort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'desc' });
  };

  // ── WIDGET 4: Expense Pie Chart ───────────────────────────────────────────
  const pieData = useMemo(() => {
    const map = {};
    trips.forEach(t => {
      (t.expenses || []).forEach(e => {
        const cat = e.type || e.category || 'Other';
        map[cat] = (map[cat] || 0) + Number(e.amount || 0);
      });
    });
    overheads.forEach(o => {
      const cat = `OH: ${o.category}`;
      map[cat] = (map[cat] || 0) + Number(o.amount || 0);
    });
    return Object.entries(map).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  }, [trips, overheads]);

  const getPieColor = (name) => {
    if (name.startsWith('OH: ')) return OVERHEAD_COLORS[name.replace('OH: ', '')] || '#6b7280';
    return EXPENSE_COLORS[name] || '#' + Math.floor(Math.random() * 0x1000000).toString(16).padStart(6, '0');
  };

  // ── WIDGET 5: GST Split ───────────────────────────────────────────────────
  const gstTrips = trips.filter(t => t.gst && String(t.gst).trim() !== '' && String(t.gst).trim() !== '0');
  const noGstTrips = trips.filter(t => !t.gst || String(t.gst).trim() === '' || String(t.gst).trim() === '0');
  const gstFreight = gstTrips.reduce((s, t) => s + Number(t.freight || 0), 0);
  const noGstFreight = noGstTrips.reduce((s, t) => s + Number(t.freight || 0), 0);
  const totalGstLiability = gstFreight * 0.18;

  const displayedTrips = gstFilter === 'gst' ? gstTrips : gstFilter === 'nogst' ? noGstTrips : trips;

  // ── Alerts ────────────────────────────────────────────────────────────────
  const alerts = documents.filter(d => {
    if (!d.expiry) return false;
    const diff = Math.ceil((new Date(d.expiry) - now) / (1000 * 60 * 60 * 24));
    return diff <= 30;
  });

  const getTruckNumber = (id) => trucks.find(t => t.id === id)?.number || 'Unknown';

  return (
    <div className="page active" id="page-dashboard">
      <div className="page-header">
        <div>
          <div className="page-title">Owner's Dashboard</div>
          <div className="page-subtitle">{now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
      </div>

      <div className="page-content">

        {/* Doc Alerts */}
        {alerts.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            {alerts.map(d => {
              const diff = Math.ceil((new Date(d.expiry) - now) / (1000 * 60 * 60 * 24));
              const isExp = diff < 0;
              return (
                <div key={d.id} className="alert alert-warning" style={{ borderColor: isExp ? 'var(--red)' : 'var(--yellow)', background: isExp ? 'rgba(239,68,68,0.1)' : '' }}>
                  <div className="alert-icon">{isExp ? '🚨' : '⚠️'}</div>
                  <div>
                    <div className="alert-title" style={{ color: isExp ? 'var(--red)' : 'var(--yellow)' }}>{getTruckNumber(d.truckId)} — {d.type.toUpperCase()} {isExp ? 'EXPIRED!' : 'Expiring Soon'}</div>
                    <div className="alert-desc">{isExp ? `Expired on ${fmtDate(d.expiry)}` : `Expires in ${diff} days on ${fmtDate(d.expiry)}`}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── WIDGET 1: Real Profit ── */}
        <div className="section-card" style={{ marginBottom: 24 }}>
          <div className="section-header">
            <div className="section-title">💰 Real Profit</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>(Freight + GST) − Trip Expenses − Overheads</div>
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: '16px' }}>
            {[{ label: 'Month to Date', ...mtdProfit }, { label: 'Year to Date', ...ytdProfit }].map(({ label, freight, gst, expenses, overhead, profit }) => (
              <div key={label} style={{ flex: '1 1 280px', background: 'var(--bg-dark)', borderRadius: 10, padding: 16, border: `2px solid ${profit >= 0 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{label}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: profit >= 0 ? 'var(--green)' : 'var(--red)', marginBottom: 12 }}>{fmt(profit)}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Freight Revenue</span><span style={{ color: 'var(--green)', fontWeight: 600 }}>{fmt(freight)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>+ GST Collected</span><span style={{ color: 'var(--green)', fontWeight: 600 }}>{fmt(gst)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>− Trip Expenses</span><span style={{ color: 'var(--red)', fontWeight: 600 }}>{fmt(expenses)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>− Overheads</span><span style={{ color: 'var(--red)', fontWeight: 600 }}>{fmt(overhead)}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── WIDGET 2: Cash Flow Stress ── */}
        <div className="section-card" style={{ marginBottom: 24 }}>
          <div className="section-header"><div className="section-title">🏦 Cash Flow</div></div>
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Total Billed</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)' }}>{fmt(totalBilled)}</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Collected</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--green)' }}>{fmt(totalPaid)}</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Stuck in Market</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: stuckInMarket > 0 ? 'var(--red)' : 'var(--green)' }}>{fmt(stuckInMarket)}</div>
              </div>
            </div>
            {/* Progress bar */}
            <div style={{ height: 10, background: 'var(--bg-dark)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${collectedPct}%`, background: 'linear-gradient(90deg, var(--green), #16a34a)', borderRadius: 999, transition: 'width 0.6s ease' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
              <span>{collectedPct.toFixed(1)}% collected</span>
              <span>{(100 - collectedPct).toFixed(1)}% pending</span>
            </div>
          </div>
        </div>

        {/* ── WIDGET 3: Party-Wise Ledger ── */}
        <div className="section-card" style={{ marginBottom: 24 }}>
          <div className="section-header"><div className="section-title">📋 Party-Wise Ledger</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Click columns to sort</div></div>
          <div style={{ overflowX: 'auto' }}>
            <table className="doc-table">
              <thead>
                <tr>
                  {[['name', 'Party'], ['trips', 'Trips'], ['billed', 'Billed'], ['received', 'Received'], ['pending', 'Pending'], ['avgDelay', 'Avg Delay']].map(([col, label]) => (
                    <th key={col} style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort(col)}>
                      {label}<SortArrow col={col} sortCol={partySort.col} sortDir={partySort.dir} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedLedger.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>No party data yet</td></tr>
                )}
                {sortedLedger.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>{p.name}</td>
                    <td style={{ textAlign: 'center' }}>{p.trips}</td>
                    <td>{fmt(p.billed)}</td>
                    <td style={{ color: 'var(--green)' }}>{fmt(p.received)}</td>
                    <td style={{ color: p.pending > 0 ? 'var(--red)' : 'var(--green)', fontWeight: p.pending > 0 ? 700 : 400 }}>{fmt(p.pending)}</td>
                    <td style={{ color: p.avgDelay > 30 ? 'var(--red)' : 'var(--text-muted)' }}>{p.avgDelay > 0 ? `${p.avgDelay}d` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 24 }}>
          {/* ── WIDGET 4: Expense Pie ── */}
          <div className="section-card" style={{ flex: '1 1 320px' }}>
            <div className="section-header"><div className="section-title">🥧 Expense Breakdown</div></div>
            {pieData.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No expense data yet</div>
            ) : (
              <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}
                      fontSize={10}>
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={getPieColor(entry.name)} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(v)} />
                    <Legend formatter={(v) => v} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* ── WIDGET 5: GST Split ── */}
          <div className="section-card" style={{ flex: '1 1 280px' }}>
            <div className="section-header"><div className="section-title">🧾 GST Split Report</div></div>
            <div style={{ padding: '0 16px 16px' }}>
              {/* Toggle */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 16, background: 'var(--bg-dark)', borderRadius: 8, padding: 4 }}>
                {[['all', 'All'], ['gst', 'With GST'], ['nogst', 'Without GST']].map(([val, label]) => (
                  <button key={val} onClick={() => setGstFilter(val)}
                    style={{ flex: 1, padding: '6px 4px', fontSize: 12, fontWeight: 700, borderRadius: 6, border: 'none', cursor: 'pointer',
                      background: gstFilter === val ? 'var(--accent)' : 'transparent',
                      color: gstFilter === val ? '#fff' : 'var(--text-muted)', transition: 'all 0.2s' }}>
                    {label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ background: 'var(--bg-dark)', borderRadius: 8, padding: 12, borderLeft: '3px solid var(--green)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>GST Registered Trips ({gstTrips.length})</div>
                  <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{fmt(gstFreight)} freight</div>
                  <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 2 }}>+ {fmt(totalGstLiability)} GST @ 18%</div>
                </div>
                <div style={{ background: 'var(--bg-dark)', borderRadius: 8, padding: 12, borderLeft: '3px solid var(--text-muted)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Non-GST Trips ({noGstTrips.length})</div>
                  <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{fmt(noGstFreight)} freight</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>No GST applicable</div>
                </div>
                <div style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, marginBottom: 4 }}>Total GST Liability</div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text-main)' }}>{fmt(totalGstLiability)}</div>
                </div>
              </div>

              {/* Filtered list */}
              {gstFilter !== 'all' && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                    {gstFilter === 'gst' ? 'GST Trips' : 'Non-GST Trips'} ({displayedTrips.length})
                  </div>
                  <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {displayedTrips.slice(0, 20).map(t => (
                      <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{fmtDate(t.date)} · {t.from} → {t.to}</span>
                        <span style={{ fontWeight: 700 }}>{fmt(t.freight)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
