import React, { useState } from 'react';
import { api } from '../api';

export default function Drivers({ data, refreshData }) {
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', phone: '', license: '', joining: '', salary: '', balance: '', address: '' });
  const [loading, setLoading] = useState(false);

  const openAddModal = () => {
    setFormData({ name: '', phone: '', license: '', joining: '', salary: '', balance: '', address: '' });
    setEditingId(null);
    setShowModal(true);
  };

  const openEditModal = (driver) => {
    setFormData(driver);
    setEditingId(driver.id);
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
        await api.updateDriver(editingId, formData);
      } else {
        await api.addDriver(formData);
      }
      refreshData();
      closeModal();
    } catch (err) {
      alert("Error saving driver");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this driver?")) {
      try {
        await api.deleteDriver(id);
        refreshData();
      } catch (err) {
        alert("Error deleting driver");
      }
    }
  };

  return (
    <div className="page active" id="page-drivers">
      <div className="page-header">
        <div>
          <div className="page-title">Drivers</div>
          <div className="page-subtitle">{data.drivers?.length || 0} active drivers</div>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>+ Add Driver</button>
      </div>
      
      <div className="page-content">
        <div className="doc-table-wrap section-card">
          <table className="doc-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>License</th>
                <th>Joining Date</th>
                <th>Salary</th>
                <th>Balance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.drivers?.map(driver => (
                <tr key={driver.id}>
                  <td style={{fontWeight: 600, color: 'var(--text-main)'}}>{driver.name}</td>
                  <td>{driver.phone || '-'}</td>
                  <td>{driver.license || '-'}</td>
                  <td>{driver.joining ? new Date(driver.joining).toLocaleDateString('en-IN') : '-'}</td>
                  <td>{driver.salary ? `₹${driver.salary}` : '-'}</td>
                  <td style={{color: driver.balance < 0 ? 'var(--red)' : driver.balance > 0 ? 'var(--green)' : 'inherit'}}>{driver.balance ? `₹${driver.balance}` : '₹0'}</td>
                  <td>
                    <div style={{display: 'flex', gap: '8px'}}>
                      <button className="btn btn-sm btn-ghost" onClick={() => openEditModal(driver)}>Edit</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(driver.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {(!data.drivers || data.drivers.length === 0) && (
                <tr>
                  <td colSpan="7" style={{textAlign: 'center', color: 'var(--text-muted)'}}>No drivers found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay active">
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{editingId ? 'Edit Driver' : 'Add Driver'}</div>
              <button className="modal-close" onClick={closeModal}>&times;</button>
            </div>
            <form onSubmit={handleSave} className="modal-body">
              <div className="form-grid">
                <div className="form-group full-width">
                  <label className="form-label">Name</label>
                  <input required name="name" value={formData.name} onChange={handleChange} className="form-input" placeholder="e.g. Ramesh Singh" />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input name="phone" value={formData.phone} onChange={handleChange} className="form-input" placeholder="e.g. 9876543210" />
                </div>
                <div className="form-group">
                  <label className="form-label">License Number</label>
                  <input name="license" value={formData.license} onChange={handleChange} className="form-input" placeholder="e.g. MH12 1234567" />
                </div>
                <div className="form-group">
                  <label className="form-label">Joining Date</label>
                  <input type="date" name="joining" value={formData.joining} onChange={handleChange} className="form-input" />
                </div>
                <div className="form-group">
                  <label className="form-label">Monthly Salary (₹)</label>
                  <input type="number" name="salary" value={formData.salary} onChange={handleChange} className="form-input" placeholder="e.g. 15000" />
                </div>
                <div className="form-group">
                  <label className="form-label">Opening Balance (₹)</label>
                  <input type="number" name="balance" value={formData.balance} onChange={handleChange} className="form-input" placeholder="e.g. 0" />
                </div>
                <div className="form-group full-width">
                  <label className="form-label">Address</label>
                  <input name="address" value={formData.address} onChange={handleChange} className="form-input" placeholder="Full address" />
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Driver'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
