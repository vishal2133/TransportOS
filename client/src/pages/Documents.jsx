import React, { useState } from 'react';
import { api } from '../api';

export default function Documents({ data, refreshData }) {
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ truckId: '', type: 'Fitness', expiry: '', number: '' });
  const [loading, setLoading] = useState(false);

  const openAddModal = () => {
    setFormData({ truckId: '', type: 'Fitness', expiry: '', number: '' });
    setEditingId(null);
    setShowModal(true);
  };

  const openEditModal = (doc) => {
    setFormData(doc);
    setEditingId(doc.id);
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
        await api.updateDocument(editingId, formData);
      } else {
        await api.addDocument(formData);
      }
      refreshData();
      closeModal();
    } catch (err) {
      alert("Error saving document");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this document?")) {
      try {
        await api.deleteDocument(id);
        refreshData();
      } catch (err) {
        alert("Error deleting document");
      }
    }
  };

  const getTruckNumber = (id) => data.trucks?.find(t => t.id === id)?.number || 'Unknown Truck';

  const today = new Date();

  return (
    <div className="page active" id="page-documents">
      <div className="page-header">
        <div>
          <div className="page-title">Documents</div>
          <div className="page-subtitle">{data.documents?.length || 0} tracked documents</div>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>+ Add Document</button>
      </div>
      
      <div className="page-content">
        <div className="doc-table-wrap section-card">
          <table className="doc-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Truck</th>
                <th>Document Type</th>
                <th>Doc Number</th>
                <th>Expiry Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.documents?.map(doc => {
                const exp = new Date(doc.expiry);
                const diff = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
                const isExpired = diff < 0;
                const isWarning = diff >= 0 && diff <= 30;
                const statusClass = isExpired ? 'red' : isWarning ? 'yellow' : 'green';
                const statusText = isExpired ? 'Expired' : isWarning ? `Expiring in ${diff}d` : 'Valid';

                return (
                  <tr key={doc.id}>
                    <td>
                      <div className="doc-status">
                        <span className={`dot ${statusClass}`}></span>
                        <span style={{color: isExpired ? 'var(--red)' : isWarning ? 'var(--yellow)' : 'var(--green)'}}>{statusText}</span>
                      </div>
                    </td>
                    <td style={{fontWeight: 600, color: 'var(--text-main)'}}>{getTruckNumber(doc.truckId)}</td>
                    <td>{doc.type}</td>
                    <td>{doc.number || '-'}</td>
                    <td>{doc.expiry ? exp.toLocaleDateString('en-IN') : '-'}</td>
                    <td>
                      <div style={{display: 'flex', gap: '8px'}}>
                        <button className="btn btn-sm btn-ghost" onClick={() => openEditModal(doc)}>Edit</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(doc.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {(!data.documents || data.documents.length === 0) && (
                <tr>
                  <td colSpan="6" style={{textAlign: 'center', color: 'var(--text-muted)'}}>No documents found</td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="doc-legend">
            <div><span className="dot green"></span> Valid</div>
            <div><span className="dot yellow"></span> Expires soon (&le; 30 days)</div>
            <div><span className="dot red"></span> Expired</div>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay active">
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{editingId ? 'Edit Document' : 'Add Document'}</div>
              <button className="modal-close" onClick={closeModal}>&times;</button>
            </div>
            <form onSubmit={handleSave} className="modal-body">
              <div className="form-grid">
                <div className="form-group full-width">
                  <label className="form-label">Truck</label>
                  <select required name="truckId" value={formData.truckId} onChange={handleChange} className="form-input">
                    <option value="">Select Truck</option>
                    {data.trucks?.filter(t => t.owner && t.owner.toLowerCase() === 'self').map(t => <option key={t.id} value={t.id}>{t.number}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Document Type</label>
                  <select name="type" value={formData.type} onChange={handleChange} className="form-input">
                    <option value="Fitness">Fitness Certificate</option>
                    <option value="Insurance">Insurance</option>
                    <option value="PUC">PUC (Pollution)</option>
                    <option value="Permit">National Permit</option>
                    <option value="Tax">Road Tax</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Expiry Date</label>
                  <input required type="date" name="expiry" value={formData.expiry} onChange={handleChange} className="form-input" />
                </div>
                <div className="form-group full-width">
                  <label className="form-label">Document Number</label>
                  <input name="number" value={formData.number} onChange={handleChange} className="form-input" placeholder="e.g. MH-FIT-12345" />
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
