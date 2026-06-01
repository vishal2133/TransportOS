import React from 'react';

const formatCurrency = (amt) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amt || 0);
const formatDate = (dateStr) => {
  if(!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function Dashboard({ data }) {
  const { trips, trucks, parties, documents } = data;

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthlyRevenue = trips.filter(t => {
    if (!t.date) return false;
    const d = new Date(t.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).reduce((sum, t) => sum + Number(t.freight || 0), 0);

  let totalOutstanding = 0;
  parties.forEach(p => {
    const partyTrips = trips.filter(t => t.partyId === p.id);
    const totalFreight = partyTrips.reduce((sum, t) => sum + Number(t.freight || 0), 0);
    const totalPaid = partyTrips.reduce((sum, t) => sum + Number(t.paid || 0), 0);
    totalOutstanding += (totalFreight - totalPaid);
  });

  const today = new Date();
  const alerts = documents.filter(d => {
    if(!d.expiry) return false;
    const exp = new Date(d.expiry);
    const diff = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
    return diff <= 30;
  });

  const recentTrips = [...trips].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

  const partyOut = parties.map(p => {
    const pt = trips.filter(t => t.partyId === p.id);
    const f = pt.reduce((s, t) => s + Number(t.freight||0), 0);
    const pa = pt.reduce((s, t) => s + Number(t.paid||0), 0);
    return { name: p.name, out: f - pa, id: p.id };
  }).filter(p => p.out > 0).sort((a, b) => b.out - a.out).slice(0, 5);

  const getPartyName = (id) => parties.find(p => p.id === id)?.name || 'Unknown';
  const getTruckNumber = (id) => trucks.find(t => t.id === id)?.number || 'Unknown';

  return (
    <div className="page active" id="page-dashboard">
      <div className="page-header">
        <div>
          <div className="page-title">Good day 👋</div>
          <div className="page-subtitle">{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
      </div>
      <div className="page-content">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Monthly Revenue</div>
            <div className="stat-val" style={{color:'var(--green)'}}>{formatCurrency(monthlyRevenue)}</div>
            <div className="stat-sub">{new Date().toLocaleString('default', { month: 'long' })} {currentYear}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Outstanding</div>
            <div className="stat-val" style={{color:'var(--yellow)'}}>{formatCurrency(totalOutstanding)}</div>
            <div className="stat-sub">From {parties.length} parties</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Document Alerts</div>
            <div className="stat-val" style={{color: alerts.length > 0 ? 'var(--red)' : 'var(--green)'}}>{alerts.length}</div>
            <div className="stat-sub">{alerts.length > 0 ? 'Action required' : 'All good'}</div>
          </div>
        </div>

        <div>
          {alerts.map(d => {
            const truck = getTruckNumber(d.truckId);
            const exp = new Date(d.expiry);
            const diff = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
            const isExpired = diff < 0;
            return (
              <div key={d.id} className="alert alert-warning" style={{borderColor: isExpired ? 'var(--red)' : 'var(--yellow)', background: isExpired ? 'rgba(239,68,68,0.1)' : ''}}>
                <div className="alert-icon">{isExpired ? '🚨' : '⚠️'}</div>
                <div>
                  <div className="alert-title" style={{color: isExpired ? 'var(--red)' : 'var(--yellow)'}}>{truck} - {d.type.toUpperCase()} {isExpired ? 'Expired!' : 'Expiring Soon'}</div>
                  <div className="alert-desc">{isExpired ? `Expired on ${formatDate(d.expiry)}` : `Expires in ${diff} days on ${formatDate(d.expiry)}`}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="section-card">
          <div className="section-header">
            <div className="section-title">Recent Trips</div>
            <div className="section-action">View all →</div>
          </div>
          <div className="trip-list">
            {recentTrips.length > 0 ? recentTrips.map(t => (
              <div key={t.id} className="list-item">
                <div className="li-left">
                  <div className="li-icon">🛣️</div>
                  <div>
                    <div className="li-title">{t.from} to {t.to}</div>
                    <div className="li-sub">{formatDate(t.date)} • {getPartyName(t.partyId)} • {getTruckNumber(t.truckId)}</div>
                  </div>
                </div>
                <div className="li-right">
                  <div className="li-val">{formatCurrency(t.freight)}</div>
                  <div className={`badge ${t.status}`}>{t.status}</div>
                </div>
              </div>
            )) : <div style={{padding:'20px',textAlign:'center',color:'var(--text-muted)'}}>No trips found</div>}
          </div>
        </div>

        <div className="section-card">
          <div className="section-header">
            <div className="section-title">Top Outstanding Payments</div>
            <div className="section-action">View all →</div>
          </div>
          <div>
            {partyOut.length > 0 ? partyOut.map(p => (
              <div key={p.id} className="list-item">
                <div className="li-left">
                  <div className="li-icon">🏢</div>
                  <div className="li-title">{p.name}</div>
                </div>
                <div className="li-right">
                  <div className="li-val red">{formatCurrency(p.out)}</div>
                </div>
              </div>
            )) : <div style={{padding:'20px',textAlign:'center',color:'var(--text-muted)'}}>No outstanding payments</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
