import React, { useState, useMemo } from 'react';
import { api } from '../api';

const CATEGORIES = ['Admin', 'Salary', 'Repair', 'Fuel', 'Rent', 'Bribe/Misc', 'Other'];
const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const todayISO = () => new Date().toISOString().split('T')[0];

const CATEGORY_COLORS = {
  Admin: '#6366f1', Salary: '#f59e0b', Repair: '#ef4444',
  Fuel: '#3b82f6', Rent: '#8b5cf6', 'Bribe/Misc': '#ec4899', Other: '#6b7280',
};

export default function Overheads({ data, refreshData }) {
  const overheads = data.overheads || [];

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ date: todayISO(), category: 'Admin', amount: '', notes: '' });
  const [loading, setLoading] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));

  const now = new Date();
  const currentMonthStr = now.toISOString().slice(0, 7);
  const currentYearStr = now.getFullYear().toString();

  const mtd = useMemo(() => overheads.filter(o => o.date?.startsWith(currentMonthStr)).reduce((s, o) => s + Number(o.amount || 0), 0), [overheads, currentMonthStr]);
  const ytd = useMemo(() => overheads.filter(o => o.date?.startsWith(currentYearStr)).reduce((s, o) => s + Number(o.amount || 0), 0), [overheads, currentYearStr]);

  const filtered = useMemo(() => overheads.filter(o => !filterMonth || o.date?.startsWith(filterMonth)), [overheads, filterMonth]);

  // Category totals for the filtered period
  const catTotals = useMemo(() => {
    const map = {};
    filtered.forEach(o => { map[o.category] = (map[o.category] || 0) + Number(o.amount || 0); });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const periodTotal = filtered.reduce((s, o) => s + Number(o.amount || 0), 0);

  const openAdd = () => { setFormData({ date: todayISO(), category: 'Admin', amount: '', notes: '' }); setEditingId(null); setShowModal(true); };
  const openEdit = (o) => { setFormData(o); setEditingId(o.id); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setOpenMenuId(null); };
  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        await api.updateOverhead(editingId, formData);
      } else {
        await api.addOverhead(formData);
      }
      refreshData();
      closeModal();
    } catch { alert('Error saving expense'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this expense entry?')) {
      try { await api.deleteOverhead(id); refreshData(); }
      catch { alert('Error deleting'); }
    }
    setOpenMenuId(null);
  };

  return (
    <div className="page active" id="page-overheads">
      <div className="page-header">
        <div>
          <div className="page-title">Overheads &amp; Extras</div>
          <div className="page-subtitle">Private expense tracker — never shown in party PDFs</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Expense</button>
      </div>

      <div className="page-content">
        {/* Summary cards */}
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-label">This Month</div>
            <div className="stat-val" style={{ color: 'var(--red)' }}>{fmt(mtd)}</div>
            <div className="stat-sub">{now.toLocaleString('default', { month: 'long' })} overhead costs</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Year to Date</div>
            <div className="stat-val" style={{ color: 'var(--yellow)' }}>{fmt(ytd)}</div>
            <div className="stat-sub">{currentYearStr} total overheads</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Entries</div>
            <div className="stat-val">{overheads.length}</div>
            <div className="stat-sub">All time records</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {/* Category breakdown for period */}
          {catTotals.length > 0 && (
            <div className="section-card" style={{ minWidth: 220, flex: '0 0 220px' }}>
              <div className="section-header"><div className="section-title">By Category</div></div>
              <div style={{ padding: '8px 0' }}>
                {catTotals.map(([cat, amt]) => (
                  <div key={cat} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: CATEGORY_COLORS[cat] || '#6b7280', flexShrink: 0, display: 'inline-block' }} />
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{cat}</span>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-main)' }}>{fmt(amt)}</span>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid var(--border)', margin: '8px 16px', paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>Total</span>
                  <span style={{ fontWeight: 700, color: 'var(--red)' }}>{fmt(periodTotal)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Main table */}
          <div className="section-card" style={{ flex: 1, minWidth: 0 }}>
            <div className="section-header" style={{ flexWrap: 'wrap', gap: 8 }}>
              <div className="section-title">Expense Log</div>
              <input type="month" className="form-input" style={{ width: 160, padding: '6px 10px' }}
                value={filterMonth} onChange={e => setFilterMonth(e.target.value)} />
            </div>
            <div className="doc-table-wrap" style={{ overflowX: 'auto' }}>
              <table className="doc-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Amount</th>
                    <th>Notes</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>No expenses for this period</td></tr>
                  )}
                  {filtered.map(o => (
                    <tr key={o.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(o.date)}</td>
                      <td>
                        <span style={{ background: CATEGORY_COLORS[o.category] + '22', color: CATEGORY_COLORS[o.category] || 'var(--text-main)', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                          {o.category}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--red)' }}>{fmt(o.amount)}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{o.notes || '—'}</td>
                      <td style={{ position: 'relative' }}>
                        <button className="btn btn-sm btn-ghost" style={{ padding: '2px 8px', fontSize: 18, fontWeight: 'bold' }}
                          onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === o.id ? null : o.id); }}>⋮</button>
                        {openMenuId === o.id && (
                          <div style={{ position: 'absolute', top: '100%', right: 0, background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 10, padding: 4, display: 'flex', flexDirection: 'column', minWidth: 100 }}>
                            <button className="btn btn-sm btn-ghost" style={{ textAlign: 'left', width: '100%' }}
                              onClick={() => { setOpenMenuId(null); openEdit(o); }}>Edit</button>
                            <button className="btn btn-sm btn-ghost" style={{ textAlign: 'left', width: '100%', color: 'var(--red)' }}
                              onClick={() => handleDelete(o.id)}>Delete</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="modal-overlay active">
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{editingId ? 'Edit Expense' : 'Add Overhead Expense'}</div>
              <button className="modal-close" onClick={closeModal}>&times;</button>
            </div>
            <form onSubmit={handleSave} className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input required type="date" name="date" value={formData.date} onChange={handleChange} className="form-input" />
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select name="category" value={formData.category} onChange={handleChange} className="form-input">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group full-width">
                  <label className="form-label">Amount (₹)</label>
                  <input required type="number" name="amount" value={formData.amount} onChange={handleChange} className="form-input" placeholder="e.g. 5000" min="0" />
                </div>
                <div className="form-group full-width">
                  <label className="form-label">Notes</label>
                  <input name="notes" value={formData.notes} onChange={handleChange} className="form-input" placeholder="e.g. Driver salary for June" />
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Saving…' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
