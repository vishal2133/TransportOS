import React, { useState, useMemo, useRef } from 'react';
import { api } from '../api';
import { Shield, FileText, UploadCloud, Download, Share2, MoreVertical, Search, AlertCircle, ArrowRight } from 'lucide-react';

const toISO = (d) => d.toISOString().split('T')[0];

export default function Insurance({ data, refreshData }) {
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    truckId: '',
    insurer: '',
    policyNumber: '',
    startDate: '',
    expiryDate: '',
    premium: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);
  const [activeTruckId, setActiveTruckId] = useState(null);
  const fileInputRef = useRef(null);
  const [uploadingId, setUploadingId] = useState(null);

  const insurances = data.insurance || [];
  const trucks = data.trucks || [];

  // Derived calculations
  const today = new Date();
  today.setHours(0,0,0,0);

  // Status computation
  const getStatus = (expiryDate) => {
    const exp = new Date(expiryDate);
    const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { label: 'Expired', color: 'red', days: diffDays };
    if (diffDays <= 15) return { label: `Expires in ${diffDays}d`, color: 'orange', days: diffDays };
    if (diffDays <= 60) return { label: `Expires in ${diffDays}d`, color: 'yellow', days: diffDays };
    return { label: 'Valid', color: 'green', days: diffDays };
  };

  // Process data for tables
  const latestPolicies = useMemo(() => {
    const map = new Map();
    insurances.forEach(ins => {
      const existing = map.get(ins.truckId);
      if (!existing || new Date(ins.expiryDate) > new Date(existing.expiryDate)) {
        map.set(ins.truckId, ins);
      }
    });
    return Array.from(map.values());
  }, [insurances]);

  const filteredPolicies = useMemo(() => {
    return latestPolicies.filter(p => {
      const truck = trucks.find(t => t.id === p.truckId)?.number || '';
      const s = search.toLowerCase();
      return truck.toLowerCase().includes(s) || 
             (p.insurer || '').toLowerCase().includes(s) || 
             (p.policyNumber || '').toLowerCase().includes(s);
    }).sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
  }, [latestPolicies, trucks, search]);

  // Expiry Timeline data
  const timelineMonths = useMemo(() => {
    const months = [];
    const d = new Date(today);
    d.setDate(1);
    for (let i = 0; i < 12; i++) {
      months.push({
        label: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
        year: d.getFullYear(),
        month: d.getMonth()
      });
      d.setMonth(d.getMonth() + 1);
    }
    return months;
  }, [today]);

  const summaryStats = useMemo(() => {
    let expired = 0, in15Days = 0, thisMonth = 0;
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    latestPolicies.forEach(p => {
      const stat = getStatus(p.expiryDate);
      if (stat.color === 'red') expired++;
      if (stat.color === 'orange') in15Days++;
      const expDate = new Date(p.expiryDate);
      if (expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear) {
        thisMonth++;
      }
    });
    return { total: latestPolicies.length, expired, in15Days, thisMonth };
  }, [latestPolicies]);

  // Financials
  const financials = useMemo(() => {
    let total = 0;
    let highest = { amount: 0, truck: '' };
    let lowest = { amount: Infinity, truck: '' };
    let count = 0;

    latestPolicies.forEach(p => {
      const prem = Number(p.premium) || 0;
      total += prem;
      if (prem > 0) count++;
      const tNum = trucks.find(t => t.id === p.truckId)?.number || '';
      if (prem > highest.amount) highest = { amount: prem, truck: tNum };
      if (prem > 0 && prem < lowest.amount) lowest = { amount: prem, truck: tNum };
    });

    if (lowest.amount === Infinity) lowest = { amount: 0, truck: 'N/A' };

    return {
      total,
      avg: count ? Math.round(total / count) : 0,
      highest,
      lowest
    };
  }, [latestPolicies, insurances, trucks]);

  const openAddModal = () => {
    setFormData({ truckId: '', insurer: '', policyNumber: '', startDate: '', expiryDate: '', premium: '', notes: '' });
    setEditingId(null);
    setShowModal(true);
  };

  const openEditModal = (ins, e) => {
    if (e) e.stopPropagation();
    setFormData({
      truckId: ins.truckId || '',
      insurer: ins.insurer || '',
      policyNumber: ins.policyNumber || '',
      startDate: ins.startDate || '',
      expiryDate: ins.expiryDate || '',
      premium: ins.premium || '',
      notes: ins.notes || ''
    });
    setEditingId(ins.id);
    setShowModal(true);
  };

  const handleRenew = (truckId) => {
    const truckPolicies = insurances.filter(i => i.truckId === truckId).sort((a, b) => new Date(b.expiryDate) - new Date(a.expiryDate));
    if (truckPolicies.length > 0) {
      const last = truckPolicies[0];
      setFormData({
        truckId,
        insurer: last.insurer || '',
        policyNumber: last.policyNumber || '',
        startDate: last.expiryDate || '', 
        expiryDate: '', 
        premium: last.premium || '',
        notes: ''
      });
      setEditingId(null);
      setShowModal(true);
    } else {
      setFormData({ truckId, insurer: '', policyNumber: '', startDate: '', expiryDate: '', premium: '', notes: '' });
      setShowModal(true);
    }
  };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        await api.updateInsurance(editingId, formData);
      } else {
        await api.addInsurance(formData);
      }
      refreshData();
      setShowModal(false);
    } catch (err) {
      alert("Error saving insurance record");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, e) => {
    if (e) e.stopPropagation();
    if (window.confirm("Delete this insurance record?")) {
      try {
        await api.deleteInsurance(id);
        refreshData();
        if (activeTruckId === insurances.find(i => i.id === id)?.truckId) setActiveTruckId(null);
      } catch (err) {
        alert("Error deleting");
      }
    }
  };

  // Upload Logic
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file || !uploadingId) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("File is too large. Please upload a file smaller than 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target.result;
      try {
        setLoading(true);
        await api.uploadInsuranceFile(uploadingId, base64);
        refreshData();
        alert("File uploaded successfully");
      } catch (err) {
        alert("Upload failed");
      } finally {
        setLoading(false);
        setUploadingId(null);
        e.target.value = null; // reset
      }
    };
    reader.readAsDataURL(file);
  };

  const triggerUpload = (id, e) => {
    if (e) e.stopPropagation();
    setUploadingId(id);
    fileInputRef.current?.click();
  };

  const downloadFile = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      const res = await api.getInsuranceFile(id);
      if (res.file) {
        const link = document.createElement('a');
        link.href = res.file;
        link.download = `Policy_${id}.pdf`; 
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        alert("No file found.");
      }
    } catch (err) {
      alert("Error downloading file");
    }
  };

  const shareFile = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      const res = await api.getInsuranceFile(id);
      if (res.file) {
        const newTab = window.open();
        newTab.document.write(`<iframe src="${res.file}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
      }
    } catch (err) {
      alert("Error sharing file");
    }
  };

  return (
    <div className="page active" id="page-insurance" style={{ display: 'flex', gap: '20px' }}>
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".pdf,image/*" onChange={handleFileChange} />

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Header */}
        <div className="page-header" style={{ marginBottom: 0 }}>
          <div>
            <div className="page-title">Fleet Insurance</div>
            <div className="page-subtitle">Track, renew, and manage policies</div>
          </div>
          <button className="btn btn-primary" onClick={openAddModal}>+ Add Policy</button>
        </div>

        {/* M2: Expiry Timeline Widget */}
        <div className="section-card" style={{ padding: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: 'var(--bg-panel)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Total Tracked</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{summaryStats.total}</div>
            </div>
            <div style={{ background: '#fef2f2', padding: '16px', borderRadius: '8px', border: '1px solid #fee2e2' }}>
              <div style={{ fontSize: '13px', color: '#991b1b' }}>Expired</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#b91c1c' }}>{summaryStats.expired}</div>
            </div>
            <div style={{ background: '#fff7ed', padding: '16px', borderRadius: '8px', border: '1px solid #ffedd5' }}>
              <div style={{ fontSize: '13px', color: '#9a3412' }}>Expiring &le; 15 Days</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#c2410c' }}>{summaryStats.in15Days}</div>
            </div>
            <div style={{ background: 'var(--bg-panel)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Expiring This Month</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{summaryStats.thisMonth}</div>
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: '14px', marginBottom: '16px', color: 'var(--text-main)' }}>12-Month Expiry Timeline</h3>
            <div style={{ display: 'flex', alignItems: 'center', position: 'relative', height: '40px' }}>
              <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '4px', background: 'var(--border)', borderRadius: '2px', transform: 'translateY(-50%)' }}></div>
              
              {timelineMonths.map((m, i) => {
                const monthPolicies = latestPolicies.filter(p => {
                  const d = new Date(p.expiryDate);
                  return d.getMonth() === m.month && d.getFullYear() === m.year;
                });

                return (
                  <div key={i} style={{ flex: 1, position: 'relative', display: 'flex', justifyContent: 'center' }}>
                    <div style={{ position: 'absolute', top: '-20px', fontSize: '11px', color: 'var(--text-muted)' }}>{m.label}</div>
                    
                    <div style={{ display: 'flex', gap: '2px', position: 'absolute', top: '50%', transform: 'translateY(-50%)' }}>
                      {monthPolicies.map((p, idx) => {
                        const stat = getStatus(p.expiryDate);
                        const bg = stat.color === 'red' ? '#ef4444' : stat.color === 'orange' ? '#f97316' : stat.color === 'yellow' ? '#eab308' : '#22c55e';
                        return (
                          <div key={idx} title={`${trucks.find(t=>t.id===p.truckId)?.number} - ${stat.label}`} style={{ width: '12px', height: '12px', borderRadius: '50%', background: bg, border: '2px solid var(--bg-card)', cursor: 'pointer', zIndex: 2 }} onClick={() => setActiveTruckId(p.truckId)}></div>
                        );
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* M1: Master Table */}
        <div className="section-card">
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input type="text" className="form-input" placeholder="Search by vehicle, insurer, or policy no..." style={{ paddingLeft: '36px' }} value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="doc-table-wrap">
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Vehicle</th>
                  <th>Insurer</th>
                  <th>Policy No</th>
                  <th>Expiry Date</th>
                  <th style={{ textAlign: 'right' }}>Premium (Rs.)</th>
                  <th>Docs</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredPolicies.map(p => {
                  const stat = getStatus(p.expiryDate);
                  const truck = trucks.find(t => t.id === p.truckId);
                  const isActiveRow = activeTruckId === p.truckId;
                  
                  return (
                    <tr key={p.id} onClick={() => setActiveTruckId(p.truckId)} style={{ cursor: 'pointer', background: isActiveRow ? 'var(--bg-panel)' : '' }}>
                      <td>
                        <div className="doc-status">
                          <span className={`dot ${stat.color}`}></span>
                          <span style={{ color: `var(--${stat.color})`, fontWeight: 600 }}>{stat.label}</span>
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{truck?.number || 'Unknown'}</td>
                      <td>{p.insurer || '-'}</td>
                      <td>{p.policyNumber || '-'}</td>
                      <td>{new Date(p.expiryDate).toLocaleDateString('en-IN')}</td>
                      <td style={{ textAlign: 'right' }}>{p.premium ? Number(p.premium).toLocaleString('en-IN') : '-'}</td>
                      <td>
                        {p.hasFile ? (
                          <div style={{ display: 'flex', gap: '8px', color: 'var(--accent)' }}>
                            <button className="btn btn-sm btn-ghost" onClick={(e) => downloadFile(p.id, e)} title="Download"><Download size={14} /></button>
                            <button className="btn btn-sm btn-ghost" onClick={(e) => shareFile(p.id, e)} title="Open to Share"><Share2 size={14} /></button>
                          </div>
                        ) : (
                          <button className="btn btn-sm btn-ghost" style={{ color: 'var(--text-muted)' }} onClick={(e) => triggerUpload(p.id, e)} title="Upload Document">
                            <UploadCloud size={16} />
                          </button>
                        )}
                      </td>
                      <td style={{ position: 'relative' }}>
                        <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === p.id ? null : p.id); }}>
                          <MoreVertical size={16} />
                        </button>
                        {openMenuId === p.id && (
                          <div style={{ position: 'absolute', top: '100%', right: '0', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 10, display: 'flex', flexDirection: 'column', minWidth: '120px' }}>
                            <button className="btn btn-sm btn-ghost" style={{ textAlign: 'left', width: '100%' }} onClick={(e) => { setOpenMenuId(null); openEditModal(p, e); }}>Edit</button>
                            <button className="btn btn-sm btn-ghost" style={{ textAlign: 'left', width: '100%' }} onClick={(e) => { setOpenMenuId(null); triggerUpload(p.id, e); }}>Upload Doc</button>
                            <button className="btn btn-sm btn-ghost" style={{ textAlign: 'left', width: '100%', color: 'var(--red)' }} onClick={(e) => { setOpenMenuId(null); handleDelete(p.id, e); }}>Delete</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* M5: Financial Summary */}
        <div style={{ display: 'flex', gap: '16px', marginTop: 'auto' }}>
          <div className="section-card" style={{ flex: 1, padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Total Premium (Active)</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold' }}>Rs. {financials.total.toLocaleString('en-IN')}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Average / Truck</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold' }}>Rs. {financials.avg.toLocaleString('en-IN')}</div>
            </div>
          </div>
          <div className="section-card" style={{ flex: 1, padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Highest Premium</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--red)' }}>{financials.highest.truck}</div>
              <div style={{ fontSize: '14px' }}>Rs. {financials.highest.amount.toLocaleString('en-IN')}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Lowest Premium</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--green)' }}>{financials.lowest.truck}</div>
              <div style={{ fontSize: '14px' }}>Rs. {financials.lowest.amount.toLocaleString('en-IN')}</div>
            </div>
          </div>
        </div>

      </div>

      {/* M3: Premium History & Negotiation Panel */}
      {activeTruckId && (
        <div className="section-card" style={{ width: '360px', display: 'flex', flexDirection: 'column', height: '100%' }}>
          {(() => {
            const activeTruck = trucks.find(t => t.id === activeTruckId);
            const history = insurances.filter(i => i.truckId === activeTruckId).sort((a, b) => new Date(b.expiryDate) - new Date(a.expiryDate));
            const latest = history[0];
            const prev = history[1];
            
            let hike = 0;
            if (latest && prev && latest.premium && prev.premium) {
              hike = Number(latest.premium) - Number(prev.premium);
            }

            return (
              <>
                <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h2 style={{ fontSize: '20px', margin: 0 }}>{activeTruck?.number}</h2>
                      <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{activeTruck?.model}</div>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => handleRenew(activeTruckId)}>Renew</button>
                  </div>
                </div>

                <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
                  <h3 style={{ fontSize: '14px', marginBottom: '12px' }}>Policy History</h3>
                  <div style={{ border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden', marginBottom: '20px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead style={{ background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)' }}>
                        <tr>
                          <th style={{ padding: '8px', textAlign: 'left' }}>Year</th>
                          <th style={{ padding: '8px', textAlign: 'left' }}>Insurer</th>
                          <th style={{ padding: '8px', textAlign: 'right' }}>Premium</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((h, i) => (
                          <tr key={h.id} style={{ borderBottom: i < history.length - 1 ? '1px solid var(--border)' : 'none' }}>
                            <td style={{ padding: '8px' }}>{new Date(h.expiryDate).getFullYear()}</td>
                            <td style={{ padding: '8px' }}>{h.insurer || '-'}</td>
                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>{h.premium ? `₹${Number(h.premium).toLocaleString('en-IN')}` : '-'}</td>
                          </tr>
                        ))}
                        {history.length === 0 && <tr><td colSpan="3" style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>No history found</td></tr>}
                      </tbody>
                    </table>
                  </div>

                  {history.length > 0 && (
                    <div style={{ background: 'var(--bg-panel)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--accent)', fontWeight: 600 }}>
                        <AlertCircle size={16} /> Negotiation Ammo
                      </div>
                      <p style={{ fontSize: '13px', color: 'var(--text-main)', margin: 0, lineHeight: 1.5 }}>
                        {hike > 0 ? (
                          <>Premium hiked by <strong>₹{hike.toLocaleString('en-IN')}</strong> this year. Ask agent for a No-Claim Bonus discount if no claims were filed.</>
                        ) : hike < 0 ? (
                          <>Premium reduced by <strong>₹{Math.abs(hike).toLocaleString('en-IN')}</strong> this year. Good job!</>
                        ) : (
                          <>Last premium paid was <strong>₹{latest.premium ? Number(latest.premium).toLocaleString('en-IN') : '0'}</strong>. Use this as a baseline for next renewal.</>
                        )}
                      </p>
                    </div>
                  )}

                  <h3 style={{ fontSize: '14px', marginBottom: '12px' }}>Notes & Claim History</h3>
                  <textarea 
                    className="form-input" 
                    rows={4} 
                    placeholder="E.g. Claim filed for bumper damage - March 2025"
                    value={latest?.notes || ''}
                    onChange={(e) => {
                      if (!latest) return;
                      // Update instantly locally, then save
                      api.updateInsurance(latest.id, { ...latest, notes: e.target.value }).then(refreshData);
                    }}
                    style={{ resize: 'vertical' }}
                  ></textarea>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="modal-overlay active" style={{ zIndex: 1000 }}>
          <div className="modal" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <div className="modal-title">{editingId ? 'Edit Policy' : 'Add Policy'}</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSave} className="modal-body">
              <div className="form-grid">
                <div className="form-group full-width">
                  <label className="form-label">Vehicle</label>
                  <select required name="truckId" value={formData.truckId} onChange={(e) => {
                    handleChange(e);
                    // auto fill from last if selected
                    if (!editingId && e.target.value) handleRenew(e.target.value);
                  }} className="form-input">
                    <option value="">Select Truck</option>
                    {trucks.filter(t => t.owner?.toLowerCase() === 'self').map(t => <option key={t.id} value={t.id}>{t.number}</option>)}
                  </select>
                </div>
                <div className="form-group full-width">
                  <label className="form-label">Insurer Company</label>
                  <input required name="insurer" value={formData.insurer} onChange={handleChange} className="form-input" placeholder="e.g. New India Assurance" />
                </div>
                <div className="form-group full-width">
                  <label className="form-label">Policy Number</label>
                  <input name="policyNumber" value={formData.policyNumber} onChange={handleChange} className="form-input" placeholder="e.g. 1234567890" />
                </div>
                <div className="form-group">
                  <label className="form-label">Start Date</label>
                  <input type="date" name="startDate" value={formData.startDate} onChange={handleChange} className="form-input" />
                </div>
                <div className="form-group">
                  <label className="form-label">Expiry Date *</label>
                  <input required type="date" name="expiryDate" value={formData.expiryDate} onChange={handleChange} className="form-input" />
                </div>
                <div className="form-group full-width">
                  <label className="form-label">Premium Amount (₹)</label>
                  <input type="number" name="premium" value={formData.premium} onChange={handleChange} className="form-input" placeholder="e.g. 25000" />
                </div>
                <div className="form-group full-width">
                  <label className="form-label">Notes (Optional)</label>
                  <input name="notes" value={formData.notes} onChange={handleChange} className="form-input" placeholder="Any details..." />
                </div>
              </div>
              <div className="form-actions" style={{ marginTop: '24px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Policy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
