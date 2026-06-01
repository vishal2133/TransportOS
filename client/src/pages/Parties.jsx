import React, { useState, useMemo } from 'react';
import { api } from '../api';

const toISO = (d) => d.toISOString().split('T')[0];
const todayISO = () => toISO(new Date());

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function Parties({ data, refreshData }) {
  // ── Modal State ──
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', contact: '', phone: '', type: 'Client', terms: '', gst: '', address: '', notes: '' });
  const [loading, setLoading] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);

  // ── Ledger / Detail Panel State ──
  const [activeParty, setActiveParty] = useState(null);
  const [settleDate, setSettleDate] = useState(todayISO());
  const [settling, setSettling] = useState(false);

  // ── Derived Data ──
  const gstParties = (data.parties || []).filter(p => p.gst && p.gst.trim() !== '');
  const nonGstParties = (data.parties || []).filter(p => !p.gst || p.gst.trim() === '');

  // Ledger Calculations for active party
  const partyTrips = useMemo(() => {
    if (!activeParty) return [];
    return (data.trips || []).filter(t => t.partyId === activeParty.id).sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [data.trips, activeParty]);

  const ledgerStats = useMemo(() => {
    if (!activeParty) return { pending: 0, month: 0, quarter: 0, year: 0 };
    let pending = 0, month = 0, quarter = 0, year = 0;
    
    const now = new Date();
    const startOfMonth = toISO(new Date(now.getFullYear(), now.getMonth(), 1));
    const startOfQuarter = toISO(new Date(now.getFullYear(), now.getMonth() - 2, 1));
    const startOfYear = toISO(new Date(now.getFullYear(), 0, 1));
    
    const hasGst = activeParty.gst && activeParty.gst.trim() !== '';

    partyTrips.forEach(t => {
      const freight = Number(t.freight) || 0;
      const gstAmt = hasGst ? freight * 0.18 : 0;
      const exp = (t.expenses || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const total = freight + gstAmt + exp;

      if (t.status === 'paid') {
        if (t.date >= startOfMonth) month += total;
        if (t.date >= startOfQuarter) quarter += total;
        if (t.date >= startOfYear) year += total;
      } else {
        pending += total;
      }
    });

    return { pending, month, quarter, year };
  }, [partyTrips, activeParty]);

  // ── Handlers ──
  const openAddModal = () => {
    setFormData({ name: '', contact: '', phone: '', type: 'Client', terms: '', gst: '', address: '', notes: '' });
    setEditingId(null);
    setShowModal(true);
  };

  const openEditModal = (e, party) => {
    if (e) e.stopPropagation();
    setFormData(party);
    setEditingId(party.id);
    setShowModal(true);
  };

  const closeModal = () => setShowModal(false);
  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        await api.updateParty(editingId, formData);
        if (activeParty && activeParty.id === editingId) setActiveParty({ ...activeParty, ...formData });
      } else {
        const cleanStr = formData.name.trim().toLowerCase();
        const exists = data.parties?.find(p => (p.name || '').trim().toLowerCase() === cleanStr);
        if (exists) {
          alert(`A party named "${exists.name}" already exists!`);
          setLoading(false);
          return;
        }
        await api.addParty(formData);
      }
      refreshData();
      closeModal();
    } catch (err) { alert("Error saving party"); } 
    finally { setLoading(false); }
  };

  const handleDelete = async (e, id) => {
    if (e) e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this party?")) {
      try {
        await api.deleteParty(id);
        if (activeParty?.id === id) setActiveParty(null);
        refreshData();
      } catch (err) { alert("Error deleting party"); }
    }
  };

  const handleSettleAccount = async () => {
    const tripsToSettle = partyTrips.filter(t => t.status !== 'paid' && t.date <= settleDate);
    if (tripsToSettle.length === 0) {
      alert(`No unpaid trips found on or before ${fmtDate(settleDate)}.`);
      return;
    }
    if (!window.confirm(`Mark ${tripsToSettle.length} trip(s) up to ${fmtDate(settleDate)} as PAID?`)) return;
    
    setSettling(true);
    try {
      await Promise.all(tripsToSettle.map(t => api.updateTrip(t.id, { ...t, status: 'paid' })));
      refreshData();
      alert(`Successfully settled ${tripsToSettle.length} trips.`);
    } catch (e) {
      alert('Error settling account.');
    } finally {
      setSettling(false);
    }
  };

  // ── Render Helpers ──
  const renderPartyCard = (party) => (
    <div key={party.id} className="data-card" onClick={() => setActiveParty(party)} style={{ position: 'relative' }}>
      <div className="dc-header" style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="dc-title">{party.name}</div>
          <div className="dc-badge">{party.type || 'Client'}</div>
        </div>
        <button className="btn btn-sm btn-ghost" style={{ padding: '2px 8px', fontSize: '18px', fontWeight: 'bold' }} 
          onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === party.id ? null : party.id); }}>⋮</button>
        {openMenuId === party.id && (
          <div style={{ position: 'absolute', top: '100%', right: '0', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 10, padding: '4px', display: 'flex', flexDirection: 'column', minWidth: '100px' }}>
            <button className="btn btn-sm btn-ghost" style={{ textAlign: 'left', width: '100%' }} onClick={(e) => { setOpenMenuId(null); openEditModal(e, party); }}>Edit</button>
            <button className="btn btn-sm btn-ghost" style={{ textAlign: 'left', width: '100%', color: 'var(--red)' }} onClick={(e) => { setOpenMenuId(null); handleDelete(e, party.id); }}>Delete</button>
          </div>
        )}
      </div>
      <div className="dc-row">
        <div className="dc-label">Contact Person</div>
        <div className="dc-val">{party.contact || '-'}</div>
      </div>
      <div className="dc-row">
        <div className="dc-label">Phone</div>
        <div className="dc-val">{party.phone || '-'}</div>
      </div>
      {party.gst && (
        <div className="dc-row">
          <div className="dc-label">GST</div>
          <div className="dc-val" style={{ fontWeight: 600, color: 'var(--accent)' }}>{party.gst}</div>
        </div>
      )}
      
      {/* Click overlay indicator */}
      <div style={{ position: 'absolute', bottom: '16px', right: '16px', color: 'var(--accent)', fontSize: '12px', fontWeight: 600, opacity: 0.8 }}>
        View Ledger →
      </div>
    </div>
  );

  return (
    <div className="page active" id="page-parties">
      <div className="page-header">
        <div>
          <div className="page-title">Parties & Ledger</div>
          <div className="page-subtitle">{data.parties?.length || 0} registered parties</div>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>+ Add Party</button>
      </div>
      
      <div className="page-content">
        {/* GST Registered Companies */}
        {gstParties.length > 0 && (
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: '20px', padding: '4px 14px', fontWeight: 700, fontSize: '13px', color: 'var(--accent)' }}>
                🏢 GST Registered Companies
              </div>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{gstParties.length} complient</div>
            </div>
            <div className="truck-grid">
              {gstParties.map(renderPartyCard)}
            </div>
          </div>
        )}

        {/* Unregistered Companies */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ background: 'rgba(100,116,139,0.1)', border: '1px solid rgba(100,116,139,0.2)', borderRadius: '20px', padding: '4px 14px', fontWeight: 700, fontSize: '13px', color: 'var(--text-muted)' }}>
              👤 Unregistered Companies
            </div>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{nonGstParties.length} profiles</div>
          </div>
          <div className="truck-grid">
            {nonGstParties.map(renderPartyCard)}
          </div>
          {nonGstParties.length === 0 && gstParties.length === 0 && (
            <div style={{padding:'40px',textAlign:'center',color:'var(--text-muted)'}}>No parties found</div>
          )}
        </div>
      </div>

      {/* ── Ledger / Detail Panel ── */}
      <div className={`detail-overlay ${activeParty ? 'active' : ''}`} onClick={(e) => { if (e.target.className.includes('detail-overlay')) setActiveParty(null); }}>
        {activeParty && (
          <div className="detail-panel" style={{ maxWidth: '700px' }}>
            <div className="detail-header" style={{ alignItems: 'center' }}>
              <div>
                <div className="detail-title">{activeParty.name}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  {activeParty.type} {activeParty.gst ? `· GST: ${activeParty.gst}` : ''}
                </div>
              </div>
              <div className="detail-actions">
                <button className="btn btn-sm btn-ghost" onClick={(e) => openEditModal(e, activeParty)}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={(e) => handleDelete(e, activeParty.id)}>Delete</button>
                <button className="modal-close" onClick={() => setActiveParty(null)} style={{ marginLeft: '12px' }}>&times;</button>
              </div>
            </div>

            <div className="detail-body" style={{ padding: '24px', background: 'var(--bg-dark)' }}>
              
              {/* Financial Dashboard */}
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {/* Pending Card */}
                <div className="stat-card" style={{ flex: '1 1 200px', borderLeft: '4px solid var(--red)' }}>
                  <div className="stat-label">Amount Pending</div>
                  <div className="stat-val" style={{ color: 'var(--red)' }}>₹{ledgerStats.pending.toLocaleString('en-IN')}</div>
                  <div className="stat-sub">from all unpaid trips</div>
                </div>
                {/* Settled Card */}
                <div className="stat-card" style={{ flex: '1 1 300px', borderLeft: '4px solid var(--green)' }}>
                  <div className="stat-label">Amount Paid (Settled)</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div className="stat-val" style={{ color: 'var(--green)' }}>₹{ledgerStats.year.toLocaleString('en-IN')} <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>YTD</span></div>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>This Month</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>₹{ledgerStats.month.toLocaleString('en-IN')}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Last 3 Months</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>₹{ledgerStats.quarter.toLocaleString('en-IN')}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Settlement Tool */}
              <div className="section-card" style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', background: 'var(--bg-panel)' }}>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '14px' }}>Clear Ledger & Mark Paid</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Settle all pending trips up to a specific date</div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input type="date" className="form-input" value={settleDate} onChange={e => setSettleDate(e.target.value)} style={{ padding: '8px 12px' }} />
                  <button className="btn btn-primary" onClick={handleSettleAccount} disabled={settling}>
                    {settling ? 'Updating...' : 'Mark Paid'}
                  </button>
                </div>
              </div>

              {/* Trip History List */}
              <div>
                <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '12px' }}>Trip History</div>
                <div className="section-card" style={{ padding: 0, overflow: 'hidden' }}>
                  {partyTrips.length === 0 ? (
                    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No trips found for this party.</div>
                  ) : (
                    partyTrips.map((trip, i) => {
                      const hasGst = activeParty.gst && activeParty.gst.trim() !== '';
                      const freightVal = Number(trip.freight) || 0;
                      const gstVal = hasGst ? freightVal * 0.18 : 0;
                      const expVal = (trip.expenses || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
                      const totalVal = freightVal + gstVal + expVal;

                      return (
                        <div key={trip.id} className="list-item" style={{ borderBottom: i < partyTrips.length - 1 ? '1px solid var(--border)' : 'none', padding: '12px 16px' }}>
                          <div className="li-left">
                            <div style={{ width: '48px', textAlign: 'center' }}>
                              <div style={{ fontSize: '14px', fontWeight: 700 }}>{fmtDate(trip.date).split(' ')[0]}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{fmtDate(trip.date).split(' ')[1]}</div>
                            </div>
                            <div style={{ width: '1px', height: '32px', background: 'var(--border)', margin: '0 8px' }} />
                            <div>
                              <div className="li-title">{trip.from} → {trip.to}</div>
                              <div className="li-sub">
                                {data.trucks?.find(t => t.id === trip.truckId)?.number || 'No Truck'}
                                {hasGst && freightVal > 0 && <span style={{ marginLeft: '8px', color: 'var(--accent)', fontWeight: 600 }}>+ GST</span>}
                              </div>
                            </div>
                          </div>
                          <div className="li-right">
                            <div className="li-val" style={{ fontSize: '15px' }}>₹{totalVal.toLocaleString('en-IN')}</div>
                            <div className={`badge ${trip.status}`} style={{ fontSize: '10px', padding: '2px 6px' }}>{trip.status}</div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="modal-overlay active" style={{ zIndex: 1000 }}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{editingId ? 'Edit Party' : 'Add Party'}</div>
              <button className="modal-close" onClick={closeModal}>&times;</button>
            </div>
            <form onSubmit={handleSave} className="modal-body">
              <div className="form-grid">
                <div className="form-group full-width">
                  <label className="form-label">Company / Party Name</label>
                  <input required name="name" value={formData.name} onChange={handleChange} className="form-input" placeholder="e.g. ABC Logistics" />
                </div>
                <div className="form-group">
                  <label className="form-label">Contact Person</label>
                  <input name="contact" value={formData.contact} onChange={handleChange} className="form-input" placeholder="e.g. John Doe" />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input name="phone" value={formData.phone} onChange={handleChange} className="form-input" placeholder="e.g. 9876543210" />
                </div>
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select name="type" value={formData.type} onChange={handleChange} className="form-input">
                    <option value="Client">Client (Customer)</option>
                    <option value="Broker">Broker / Transporter</option>
                    <option value="Vendor">Vendor (Fuel, Parts)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">GST Number</label>
                  <input name="gst" value={formData.gst} onChange={handleChange} className="form-input" placeholder="e.g. 27ABCDE1234F1Z5" />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>If provided, 18% GST applies to their trips</span>
                </div>
                <div className="form-group full-width">
                  <label className="form-label">Address</label>
                  <input name="address" value={formData.address} onChange={handleChange} className="form-input" placeholder="Full address" />
                </div>
                <div className="form-group full-width">
                  <label className="form-label">Payment Terms</label>
                  <input name="terms" value={formData.terms} onChange={handleChange} className="form-input" placeholder="e.g. 30 Days Credit" />
                </div>
                <div className="form-group full-width">
                  <label className="form-label">Notes</label>
                  <input name="notes" value={formData.notes} onChange={handleChange} className="form-input" placeholder="Any additional notes" />
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Party'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
