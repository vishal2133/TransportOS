import React, { useState } from 'react';
import { api } from '../api';

export default function Trucks({ data, refreshData }) {
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ number: '', model: '', year: '', owner: 'Self', type: '' });
  const [loading, setLoading] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState('mine');

  // Details Modal
  const [selectedTruckId, setSelectedTruckId] = useState(null);
  const [viewMode, setViewMode] = useState('monthly');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [openMenuId, setOpenMenuId] = useState(null);

  const isMine = (owner) => owner && owner.toLowerCase() === 'self';
  const displayedTrucks = data.trucks?.filter(t => activeTab === 'mine' ? isMine(t.owner) : !isMine(t.owner));

  const openAddModal = () => {
    setFormData({ number: '', model: '', year: '', owner: activeTab === 'mine' ? 'Self' : 'Other', type: '' });
    setEditingId(null);
    setShowModal(true);
  };

  const openEditModal = (e, truck) => {
    e.stopPropagation();
    setFormData(truck);
    setEditingId(truck.id);
    setShowModal(true);
  };

  const closeModal = () => setShowModal(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        await api.updateTruck(editingId, formData);
      } else {
        await api.addTruck(formData);
      }
      refreshData();
      closeModal();
    } catch (err) {
      alert("Error saving truck");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this truck?")) {
      try {
        await api.deleteTruck(id);
        if (selectedTruckId === id) setSelectedTruckId(null);
        refreshData();
      } catch (err) {
        alert("Error deleting truck");
      }
    }
  };

  // Analytics Calculations
  const selectedTruck = data.trucks?.find(t => t.id === selectedTruckId);
  const tripsForPeriod = (data.trips || []).filter(t => {
    if (t.truckId !== selectedTruckId) return false;
    if (!t.date) return false;
    if (viewMode === 'monthly') return t.date.startsWith(selectedDate.slice(0, 7));
    return t.date === selectedDate;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  const totalFreight = tripsForPeriod.reduce((sum, t) => sum + (Number(t.freight) || 0), 0);
  const totalExpenses = tripsForPeriod.reduce((sum, t) => sum + (t.expenses || []).reduce((s, e) => s + (Number(e.amount) || 0), 0), 0);
  const netProfit = totalFreight - totalExpenses;

  const getPartyName = (id) => data.parties?.find(p => p.id === id)?.name || 'Unknown';

  return (
    <div className="page active" id="page-trucks">
      <div className="page-header" style={{ flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div className="page-title">Trucks</div>
          <div className="page-subtitle">{data.trucks?.length || 0} trucks in total</div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-primary" onClick={openAddModal}>+ Add Truck</button>
        </div>
      </div>

      <div className="page-content">
        
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
          <button 
            className={`btn ${activeTab === 'mine' ? 'btn-primary' : 'btn-ghost'}`} 
            onClick={() => setActiveTab('mine')}>
            My Trucks ({data.trucks?.filter(t => isMine(t.owner)).length || 0})
          </button>
          <button 
            className={`btn ${activeTab === 'other' ? 'btn-primary' : 'btn-ghost'}`} 
            onClick={() => setActiveTab('other')}>
            Other Trucks ({data.trucks?.filter(t => !isMine(t.owner)).length || 0})
          </button>
        </div>

        <div className="truck-grid">
          {displayedTrucks?.map(truck => (
            <div key={truck.id} className="data-card" style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }} 
                 onClick={() => setSelectedTruckId(truck.id)}
                 onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                 onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
              <div className="dc-header" style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="dc-title">{truck.number}</div>
                  <div className="dc-badge">{truck.type || 'N/A'}</div>
                </div>
                <button className="btn btn-sm btn-ghost" style={{ padding: '2px 8px', fontSize: '18px', fontWeight: 'bold' }} 
                  onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === truck.id ? null : truck.id); }}>⋮</button>
                {openMenuId === truck.id && (
                  <div style={{ position: 'absolute', top: '100%', right: '0', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 10, padding: '4px', display: 'flex', flexDirection: 'column', minWidth: '100px' }}>
                    <button className="btn btn-sm btn-ghost" style={{ textAlign: 'left', width: '100%' }} onClick={(e) => { setOpenMenuId(null); openEditModal(e, truck); }}>Edit</button>
                    <button className="btn btn-sm btn-ghost" style={{ textAlign: 'left', width: '100%', color: 'var(--red)' }} onClick={(e) => { setOpenMenuId(null); handleDelete(e, truck.id); }}>Delete</button>
                  </div>
                )}
              </div>
              <div className="dc-row">
                <div className="dc-label">Model</div>
                <div className="dc-val">{truck.model || '-'} ({truck.year || '-'})</div>
              </div>
              <div className="dc-row">
                <div className="dc-label">Owner</div>
                <div className="dc-val">{truck.owner || '-'}</div>
              </div>
            </div>
          ))}
          {displayedTrucks?.length === 0 && (
            <div style={{padding:'40px',textAlign:'center',color:'var(--text-muted)',gridColumn:'1/-1'}}>No trucks found in this category</div>
          )}
        </div>
      </div>

      {/* Edit/Add Modal */}
      {showModal && (
        <div className="modal-overlay active" style={{ zIndex: 1000 }}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{editingId ? 'Edit Truck' : 'Add Truck'}</div>
              <button className="modal-close" onClick={closeModal}>&times;</button>
            </div>
            <form onSubmit={handleSave} className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Truck Number</label>
                  <input required name="number" value={formData.number} onChange={handleChange} className="form-input" placeholder="e.g. MH12AB1234" />
                </div>
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <input name="type" value={formData.type} onChange={handleChange} className="form-input" placeholder="e.g. Open Body, Container" />
                </div>
                <div className="form-group">
                  <label className="form-label">Model</label>
                  <input name="model" value={formData.model} onChange={handleChange} className="form-input" placeholder="e.g. Tata Prima" />
                </div>
                <div className="form-group">
                  <label className="form-label">Year</label>
                  <input type="number" name="year" value={formData.year} onChange={handleChange} className="form-input" placeholder="e.g. 2021" />
                </div>
                <div className="form-group full-width">
                  <label className="form-label">Owner</label>
                  <select name="owner" value={formData.owner} onChange={handleChange} className="form-input">
                    <option value="Self">Self (My Truck)</option>
                    <option value="Other">Other / Market</option>
                  </select>
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Truck'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Truck Details Analytics Modal */}
      {selectedTruckId && selectedTruck && (
        <div className="modal-overlay active" style={{ zIndex: 900 }}>
          <div className="modal" style={{ maxWidth: '800px', width: '90%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              <div>
                <div className="modal-title">{selectedTruck.number}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{selectedTruck.owner === 'Self' ? 'My Truck' : 'Other Truck'} • {selectedTruck.type || 'Unknown Type'}</div>
              </div>
              <button className="modal-close" onClick={() => setSelectedTruckId(null)}>&times;</button>
            </div>
            
            <div className="modal-body" style={{ overflowY: 'auto', padding: '20px' }}>
              
              {/* Filters */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', background: 'var(--bg-panel)', padding: '12px', borderRadius: '8px' }}>
                <select className="form-input" style={{ width: '120px' }} value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
                  <option value="monthly">Monthly</option>
                  <option value="daily">Daily</option>
                </select>
                
                {viewMode === 'monthly' ? (
                  <input type="month" className="form-input" style={{ width: '160px' }} 
                         value={selectedDate.slice(0, 7)} onChange={(e) => setSelectedDate(e.target.value + '-01')} />
                ) : (
                  <input type="date" className="form-input" style={{ width: '160px' }} 
                         value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
                )}
              </div>

              {/* Analytics Cards */}
              <div className="stats-grid" style={{ marginBottom: '24px' }}>
                <div className="stat-card" style={{ background: 'var(--bg-panel)' }}>
                  <div className="stat-label">Total Freight</div>
                  <div className="stat-val" style={{ color: 'var(--green)' }}>₹{totalFreight.toLocaleString('en-IN')}</div>
                  <div className="stat-sub">{tripsForPeriod.length} trips</div>
                </div>
                <div className="stat-card" style={{ background: 'var(--bg-panel)' }}>
                  <div className="stat-label">Total Expenses</div>
                  <div className="stat-val" style={{ color: 'var(--red)' }}>₹{totalExpenses.toLocaleString('en-IN')}</div>
                  <div className="stat-sub">Fuel, Tolls, etc.</div>
                </div>
                <div className="stat-card" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(139,92,246,0.02))', border: '1px solid rgba(139,92,246,0.2)' }}>
                  <div className="stat-label" style={{ color: 'var(--accent)' }}>Net Profit</div>
                  <div className="stat-val" style={{ color: netProfit >= 0 ? 'var(--text-main)' : 'var(--red)' }}>₹{netProfit.toLocaleString('en-IN')}</div>
                </div>
              </div>

              {/* Trip List */}
              <div className="section-card" style={{ padding: 0 }}>
                <div className="section-header" style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
                  <div className="section-title">Trips for this period</div>
                </div>
                <div>
                  {tripsForPeriod.length > 0 ? tripsForPeriod.map((t, i) => {
                    const expVal = (t.expenses || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
                    return (
                      <div key={t.id} className="list-item" style={{ borderBottom: i < tripsForPeriod.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <div className="li-left">
                          <div className="li-icon">🛣️</div>
                          <div>
                            <div className="li-title">{t.from || '?'} → {t.to || '?'}</div>
                            <div className="li-sub">
                              {new Date(t.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} • {getPartyName(t.partyId)}
                            </div>
                          </div>
                        </div>
                        <div className="li-right" style={{ textAlign: 'right' }}>
                          <div className="li-val">₹{Number(t.freight || 0).toLocaleString('en-IN')}</div>
                          {expVal > 0 && <div style={{ fontSize: '12px', color: 'var(--red)' }}>-₹{expVal.toLocaleString('en-IN')} exp</div>}
                          <div className={`badge ${t.status}`}>{t.status}</div>
                        </div>
                      </div>
                    );
                  }) : (
                    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No trips found for this {viewMode === 'monthly' ? 'month' : 'day'}.
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}

