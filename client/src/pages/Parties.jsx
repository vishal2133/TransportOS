import React, { useState, useMemo } from 'react';
import { api } from '../api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const toISO = (d) => d.toISOString().split('T')[0];
const todayISO = () => toISO(new Date());

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function Parties({ data, refreshData, companyProfiles }) {
  // ── Modal State ──
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', contact: '', phone: '', type: 'Client', terms: '', gst: '', address: '', notes: '' });
  const [loading, setLoading] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);

  // ── PDF Generator State ──
  const [pdfParty, setPdfParty] = useState(null);
  const [pdfFrom, setPdfFrom] = useState('');
  const [pdfTo, setPdfTo] = useState('');

  // ── Ledger / Detail Panel State ──
  const [activeParty, setActiveParty] = useState(null);
  const [settleDate, setSettleDate] = useState(todayISO());
  const [settling, setSettling] = useState(false);

  // ── Party Billing State ──
  const [partyBilling, setPartyBilling] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tos_party_billing') || '{}'); }
    catch { return {}; }
  });

  // Auto-assign billing types for new parties
  React.useEffect(() => {
    if (!data.parties || data.parties.length === 0) return;
    let changed = false;
    const newBilling = { ...partyBilling };
    data.parties.forEach(p => {
      if (!newBilling[p.id]) {
        newBilling[p.id] = (p.gst && p.gst.trim() !== '') ? 'gst' : 'nonGst';
        changed = true;
      }
    });
    if (changed) {
      setPartyBilling(newBilling);
      localStorage.setItem('tos_party_billing', JSON.stringify(newBilling));
    }
  }, [data.parties]);

  const updatePartyBilling = (partyId, type) => {
    const newBilling = { ...partyBilling, [partyId]: type };
    setPartyBilling(newBilling);
    localStorage.setItem('tos_party_billing', JSON.stringify(newBilling));
  };

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

  // ── PDF Generation ──
  const handleGeneratePDF = () => {
    if (!pdfFrom || !pdfTo) { alert('Please select both From and To dates.'); return; }
    const trips = (data.trips || []).filter(t => t.partyId === pdfParty.id && t.date >= pdfFrom && t.date <= pdfTo)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    if (trips.length === 0) { alert('No trips found in this date range for this party.'); return; }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const billingType = partyBilling[pdfParty.id] || ((pdfParty.gst && pdfParty.gst.trim() !== '') ? 'gst' : 'nonGst');
    const cp = companyProfiles || { gst: {}, nonGst: {} };
    const co = billingType === 'gst' ? cp.gst : cp.nonGst;
    const coName = co.name || 'Transport Company';

    // ── Header ──
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(30, 30, 30);
    doc.text(coName, pageW / 2, 18, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    if (co.address) doc.text(co.address, pageW / 2, 24, { align: 'center' });
    const contactLine = [co.phone ? `Ph: ${co.phone}` : '', co.gstin ? `GSTIN: ${co.gstin}` : ''].filter(Boolean).join('   |   ');
    if (contactLine) doc.text(contactLine, pageW / 2, 29, { align: 'center' });

    // ── Divider ──
    doc.setDrawColor(139, 92, 246);
    doc.setLineWidth(0.8);
    doc.line(14, 33, pageW - 14, 33);

    // ── Title ──
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(30, 30, 30);
    doc.text('FREIGHT STATEMENT', pageW / 2, 40, { align: 'center' });

    // ── Party & Date info ──
    const fromDate = new Date(pdfFrom + 'T00:00:00');
    const toDate = new Date(pdfTo + 'T00:00:00');
    const fmtD = (d) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text(`To: ${pdfParty.name}`, 14, 48);
    if (pdfParty.gst) doc.text(`GST: ${pdfParty.gst}`, 14, 53);
    doc.text(`Period: ${fmtD(fromDate)} — ${fmtD(toDate)}`, pageW - 14, 48, { align: 'right' });
    doc.text(`Generated: ${fmtD(new Date())}`, pageW - 14, 53, { align: 'right' });

    // ── Table ──
    const showGst = billingType === 'gst';
    const rows = trips.map((t, i) => {
      const freight = Number(t.freight || 0);
      const gstRate = showGst ? 18 : 0;
      const gstAmt = freight * (gstRate / 100);
      const total = freight + gstAmt;
      const truckNum = (data.trucks || []).find(tr => tr.id === t.truckId)?.number || 'N/A';
      if (showGst) {
        return [
          i + 1,
          t.date ? new Date(t.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—',
          `${t.from || '?'} → ${t.to || '?'}`,
          truckNum,
          `₹${freight.toLocaleString('en-IN')}`,
          `${gstRate}%`,
          `₹${gstAmt.toLocaleString('en-IN')}`,
          `₹${total.toLocaleString('en-IN')}`,
        ];
      } else {
        return [
          i + 1,
          t.date ? new Date(t.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—',
          `${t.from || '?'} → ${t.to || '?'}`,
          truckNum,
          `₹${freight.toLocaleString('en-IN')}`,
          `₹${total.toLocaleString('en-IN')}`,
        ];
      }
    });

    let totalFreight = 0, totalGst = 0, grandTotal = 0;
    trips.forEach(t => {
      const freight = Number(t.freight || 0);
      const gstRate = showGst ? 18 : 0;
      totalFreight += freight;
      totalGst += freight * (gstRate / 100);
    });
    grandTotal = totalFreight + totalGst;

    const headRow = showGst 
      ? [['#', 'Date', 'Route', 'Truck', 'Freight (₹)', 'GST %', 'GST Amt', 'Total (₹)']]
      : [['#', 'Date', 'Route', 'Truck', 'Freight (₹)', 'Total (₹)']];
      
    const colStyles = showGst
      ? {
        0: { cellWidth: 8 }, 1: { cellWidth: 18 }, 2: { cellWidth: 45 },
        3: { cellWidth: 20 }, 4: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 12, halign: 'center' }, 6: { cellWidth: 22, halign: 'right' }, 7: { cellWidth: 24, halign: 'right' },
      }
      : {
        0: { cellWidth: 10 }, 1: { cellWidth: 22 }, 2: { cellWidth: 55 },
        3: { cellWidth: 30 }, 4: { cellWidth: 28, halign: 'right' },
        5: { cellWidth: 28, halign: 'right' }
      };

    autoTable(doc, {
      startY: 58,
      head: headRow,
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [139, 92, 246], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: [40, 40, 40] },
      alternateRowStyles: { fillColor: [248, 246, 255] },
      columnStyles: colStyles,
      margin: { left: 14, right: 14 },
    });

    const finalY = doc.lastAutoTable.finalY + 6;

    // ── Footer Totals ──
    doc.setFillColor(248, 246, 255);
    doc.roundedRect(pageW - 80, finalY, 66, showGst ? 28 : 20, 2, 2, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(80, 80, 80);
    
    if (showGst) {
      doc.text('Total Freight:', pageW - 78, finalY + 7);
      doc.text(`₹${totalFreight.toLocaleString('en-IN')}`, pageW - 16, finalY + 7, { align: 'right' });
      doc.text('Total GST:', pageW - 78, finalY + 13);
      doc.text(`₹${totalGst.toLocaleString('en-IN')}`, pageW - 16, finalY + 13, { align: 'right' });
      doc.setDrawColor(139, 92, 246); doc.setLineWidth(0.3);
      doc.line(pageW - 78, finalY + 15, pageW - 16, finalY + 15);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(30, 30, 30);
      doc.text('Grand Total:', pageW - 78, finalY + 22);
      doc.setTextColor(139, 92, 246);
      doc.text(`₹${grandTotal.toLocaleString('en-IN')}`, pageW - 16, finalY + 22, { align: 'right' });
    } else {
      doc.text('Total Freight:', pageW - 78, finalY + 7);
      doc.text(`₹${totalFreight.toLocaleString('en-IN')}`, pageW - 16, finalY + 7, { align: 'right' });
      doc.setDrawColor(139, 92, 246); doc.setLineWidth(0.3);
      doc.line(pageW - 78, finalY + 9, pageW - 16, finalY + 9);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(30, 30, 30);
      doc.text('Grand Total:', pageW - 78, finalY + 15);
      doc.setTextColor(139, 92, 246);
      doc.text(`₹${grandTotal.toLocaleString('en-IN')}`, pageW - 16, finalY + 15, { align: 'right' });
    }

    // ── Terms ──
    const terms = pdfParty.terms || '15 days';
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(120, 120, 120);
    doc.text(`Payment Terms: Please make payment within ${terms}.`, 14, finalY + 35);
    doc.text('This is a computer generated statement.', 14, finalY + 40);

    // ── Save ──
    const monthName = MONTH_NAMES[fromDate.getMonth()];
    const year = fromDate.getFullYear();
    const safeName = coName.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_');
    doc.save(`${safeName}_${monthName}${year}.pdf`);
    setPdfParty(null);
  };

  const BillAsDropdown = ({ partyId, currentType, onChange }) => (
    <div style={{ display: 'inline-flex', alignItems: 'center', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden', fontSize: '11px', padding: '2px 4px' }} onClick={e => e.stopPropagation()}>
      <span style={{ color: 'var(--text-muted)', padding: '0 4px', fontWeight: 600 }}>Bill As:</span>
      <select value={currentType || 'nonGst'} onChange={(e) => onChange(partyId, e.target.value)} style={{ background: 'transparent', border: 'none', fontSize: '11px', fontWeight: 700, color: currentType === 'gst' ? 'var(--accent)' : 'var(--text-main)', cursor: 'pointer', outline: 'none' }}>
        <option value="gst">{companyProfiles?.gst?.name || 'Vijay Roadlines'} (GST)</option>
        <option value="nonGst">{companyProfiles?.nonGst?.name || 'Vijay Transport'} (Non-GST)</option>
      </select>
    </div>
  );

  const renderPartyCard = (party) => (
    <div key={party.id} className="data-card" onClick={() => setActiveParty(party)} style={{ position: 'relative' }}>
      <div className="dc-header" style={{ position: 'relative', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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

      <div style={{ marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
        <BillAsDropdown partyId={party.id} currentType={partyBilling[party.id]} onChange={updatePartyBilling} />
      </div>
      
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '4px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    {activeParty.type} {activeParty.gst ? `· GST: ${activeParty.gst}` : ''}
                  </div>
                  <BillAsDropdown partyId={activeParty.id} currentType={partyBilling[activeParty.id]} onChange={updatePartyBilling} />
                </div>
              </div>
              <div className="detail-actions">
                <button className="btn btn-sm btn-ghost" onClick={(e) => openEditModal(e, activeParty)}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={(e) => handleDelete(e, activeParty.id)}>Delete</button>
                <button className="btn btn-sm" style={{ background: '#16a34a', color: '#fff', fontWeight: 700 }}
                  onClick={() => { setPdfParty(activeParty); setPdfFrom(''); setPdfTo(''); }}>📄 Generate Statement</button>
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

      {/* PDF Date Range Modal */}
      {pdfParty && (
        <div className="modal-overlay active" style={{ zIndex: 1100 }}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <div className="modal-title">📄 Generate Statement</div>
              <button className="modal-close" onClick={() => setPdfParty(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
                Generate a PDF freight statement for <strong>{pdfParty.name}</strong>.
                Only freight &amp; GST will be shown — no diesel or toll costs.
              </p>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">From Date</label>
                  <input type="date" className="form-input" value={pdfFrom} onChange={e => setPdfFrom(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">To Date</label>
                  <input type="date" className="form-input" value={pdfTo} onChange={e => setPdfTo(e.target.value)} />
                </div>
              </div>
              <div className="form-actions">
                <button className="btn btn-ghost" onClick={() => setPdfParty(null)}>Cancel</button>
                <button className="btn btn-primary" style={{ background: '#16a34a' }} onClick={handleGeneratePDF}>
                  ⬇ Download PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
