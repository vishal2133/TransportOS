import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { LayoutDashboard, Map, Truck, Users, Building2, FileText, Receipt, Shield, Settings } from 'lucide-react';
import { api } from './api';

// Pages
import Dashboard from './pages/Dashboard';
import Trips from './pages/Trips';
import Trucks from './pages/Trucks';
import Drivers from './pages/Drivers';
import Parties from './pages/Parties';
import Documents from './pages/Documents';
import Insurance from './pages/Insurance';
import Overheads from './pages/Overheads';

// ── Company Settings (localStorage) ──────────────────────────────────────────
const DEFAULT_COMPANY_PROFILES = {
  gst: { name: 'Vijay Roadlines', phone: '', address: '', gstin: '', bankName: '', bankBranch: '', bankAccount: '', bankIfsc: '' },
  nonGst: { name: 'Vijay Transport Services', phone: '', address: '', gstin: '', bankName: '', bankBranch: '', bankAccount: '', bankIfsc: '' }
};
const loadCompanyProfiles = () => {
  try {
    const data = JSON.parse(localStorage.getItem('tos_company_profiles'));
    if (data && data.gst && data.nonGst) return data;
    // migrate old profile if exists
    const old = JSON.parse(localStorage.getItem('tos_company'));
    if (old && old.name) {
      return { gst: old, nonGst: { ...old, name: old.name + ' (Non-GST)', gstin: '' } };
    }
    return DEFAULT_COMPANY_PROFILES;
  }
  catch { return DEFAULT_COMPANY_PROFILES; }
};
const saveCompanyProfiles = (c) => localStorage.setItem('tos_company_profiles', JSON.stringify(c));

function CompanySetupModal({ companyProfiles, onSave, onClose }) {
  const [form, setForm] = useState(companyProfiles);
  const [activeTab, setActiveTab] = useState('gst'); // 'gst' or 'nonGst'

  const handle = (e) => {
    setForm({
      ...form,
      [activeTab]: { ...form[activeTab], [e.target.name]: e.target.value }
    });
  };

  const handleSignatureUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setForm({
          ...form,
          [activeTab]: { ...form[activeTab], signature: event.target.result }
        });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="modal-overlay active" style={{ zIndex: 2000 }}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div className="modal-title">⚙️ Company Setup</div>
          {onClose && <button className="modal-close" onClick={onClose}>&times;</button>}
        </div>
        <div className="modal-body">
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
            Set up your two billing profiles. The app will use the correct one automatically when generating PDFs.
          </p>
          
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border)' }}>
            <button type="button" 
              style={{ flex: 1, padding: '8px', background: 'transparent', border: 'none', borderBottom: activeTab === 'gst' ? '2px solid var(--accent)' : '2px solid transparent', color: activeTab === 'gst' ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
              onClick={() => setActiveTab('gst')}>
              GST Profile
            </button>
            <button type="button" 
              style={{ flex: 1, padding: '8px', background: 'transparent', border: 'none', borderBottom: activeTab === 'nonGst' ? '2px solid var(--accent)' : '2px solid transparent', color: activeTab === 'nonGst' ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
              onClick={() => setActiveTab('nonGst')}>
              Non-GST Profile
            </button>
          </div>

          <div className="form-grid">
            <div className="form-group full-width">
              <label className="form-label">Company / Firm Name *</label>
              <input required name="name" value={form[activeTab].name} onChange={handle} className="form-input" placeholder="e.g. Vijay Roadlines" />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input name="phone" value={form[activeTab].phone} onChange={handle} className="form-input" placeholder="9876543210" />
            </div>
            <div className="form-group">
              <label className="form-label">GSTIN</label>
              <input name="gstin" value={form[activeTab].gstin} onChange={handle} className="form-input" placeholder={activeTab === 'gst' ? "27ABCDE1234F1Z5" : "N/A"} disabled={activeTab === 'nonGst'} />
            </div>
            <div className="form-group full-width">
              <label className="form-label">Address</label>
              <input name="address" value={form[activeTab].address} onChange={handle} className="form-input" placeholder="A/201, VK Tower, OPP JP Nagar..." />
            </div>
            <div className="form-group full-width" style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
              <label className="form-label" style={{ color: 'var(--accent)', fontWeight: 700 }}>Bank Details (for PDF Footer)</label>
            </div>
            <div className="form-group">
              <label className="form-label">Bank Name</label>
              <input name="bankName" value={form[activeTab].bankName || ''} onChange={handle} className="form-input" placeholder="e.g. ICICI BANK" />
            </div>
            <div className="form-group">
              <label className="form-label">Bank Branch</label>
              <input name="bankBranch" value={form[activeTab].bankBranch || ''} onChange={handle} className="form-input" placeholder="e.g. VASAI (E), SATIVALI" />
            </div>
            <div className="form-group">
              <label className="form-label">Account Number</label>
              <input name="bankAccount" value={form[activeTab].bankAccount || ''} onChange={handle} className="form-input" placeholder="e.g. 768605000885" />
            </div>
            <div className="form-group">
              <label className="form-label">IFSC Code</label>
              <input name="bankIfsc" value={form[activeTab].bankIfsc || ''} onChange={handle} className="form-input" placeholder="e.g. ICIC0007686" />
            </div>
            <div className="form-group full-width" style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
              <label className="form-label" style={{ color: 'var(--accent)', fontWeight: 700 }}>Signature Stamp (for PDF)</label>
              <input type="file" accept="image/*" onChange={handleSignatureUpload} className="form-input" />
              {form[activeTab].signature && (
                <div style={{ marginTop: '8px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <img src={form[activeTab].signature} alt="Signature" style={{ maxHeight: '60px', border: '1px solid var(--border)', borderRadius: '4px' }} />
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => setForm({ ...form, [activeTab]: { ...form[activeTab], signature: null } })} style={{ color: 'var(--red)' }}>Remove</button>
                </div>
              )}
            </div>
          </div>
          <div className="form-actions" style={{ marginTop: '24px' }}>
            <button className="btn btn-primary" style={{ width: '100%' }}
              onClick={() => { 
                if (!form.gst.name.trim() || !form.nonGst.name.trim()) { alert('Both company names are required'); return; } 
                onSave(form); 
              }}>
              Save Profiles
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [data, setData] = useState({
    trucks: [], drivers: [], parties: [], trips: [], documents: [], overheads: [], insurance: [],
  });
  const [loading, setLoading] = useState(true);
  const [companyProfiles, setCompanyProfiles] = useState(loadCompanyProfiles);
  const [showCompanySetup, setShowCompanySetup] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [trucks, drivers, parties, trips, documents, overheads, insurance] = await Promise.all([
        api.getTrucks(),
        api.getDrivers(),
        api.getParties(),
        api.getTrips(),
        api.getDocuments(),
        api.getOverheads(),
        api.getInsurance(),
      ]);
      setData({ trucks, drivers, parties, trips, documents, overheads, insurance });
    } catch (err) {
      console.error('Failed to fetch data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Show setup if gst company name not set
  useEffect(() => {
    if (!loading && !companyProfiles.gst.name) setShowCompanySetup(true);
  }, [loading, companyProfiles.gst.name]);

  const refreshData = () => fetchData();

  const handleCompanySave = (c) => {
    saveCompanyProfiles(c);
    setCompanyProfiles(c);
    setShowCompanySetup(false);
  };

  return (
    <BrowserRouter>
      <div className="app">
        {/* Company Setup Modal */}
        {showCompanySetup && <CompanySetupModal companyProfiles={companyProfiles} onSave={handleCompanySave} onClose={companyProfiles.gst.name ? () => setShowCompanySetup(false) : undefined} />}

        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="logo-text">🚛 TransportOS</div>
            <div className="logo-sub">{companyProfiles.gst.name || 'Fleet Manager'}</div>
          </div>
          <nav className="sidebar-nav">
            <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span className="nav-icon"><LayoutDashboard size={18} /></span> Dashboard
            </NavLink>
            <NavLink to="/trips" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span className="nav-icon"><Map size={18} /></span> Trips
            </NavLink>
            <NavLink to="/trucks" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span className="nav-icon"><Truck size={18} /></span> Trucks
            </NavLink>
            <NavLink to="/drivers" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span className="nav-icon"><Users size={18} /></span> Drivers
            </NavLink>
            <NavLink to="/parties" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span className="nav-icon"><Building2 size={18} /></span> Parties
            </NavLink>
            <NavLink to="/documents" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span className="nav-icon"><FileText size={18} /></span> Documents
            </NavLink>
            <NavLink to="/insurance" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span className="nav-icon"><Shield size={18} /></span> Insurance
            </NavLink>
            <NavLink to="/overheads" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span className="nav-icon"><Receipt size={18} /></span> Overheads
            </NavLink>
          </nav>
          <div style={{ marginTop: 'auto', padding: '16px' }}>
            <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', gap: 8, fontSize: 13 }}
              onClick={() => setShowCompanySetup(true)}>
              <Settings size={15} /> Company Settings
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="main">
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-main)' }}>Loading…</div>
          ) : (
            <Routes>
              <Route path="/" element={<Dashboard data={data} refreshData={refreshData} />} />
              <Route path="/trips" element={<Trips data={data} refreshData={refreshData} />} />
              <Route path="/trucks" element={<Trucks data={data} refreshData={refreshData} />} />
              <Route path="/drivers" element={<Drivers data={data} refreshData={refreshData} />} />
              <Route path="/parties" element={<Parties data={data} refreshData={refreshData} companyProfiles={companyProfiles} />} />
              <Route path="/documents" element={<Documents data={data} refreshData={refreshData} />} />
              <Route path="/insurance" element={<Insurance data={data} refreshData={refreshData} />} />
              <Route path="/overheads" element={<Overheads data={data} refreshData={refreshData} />} />
            </Routes>
          )}
        </main>

        {/* Bottom Nav (Mobile) */}
        <nav className="bottom-nav">
          <div className="bottom-nav-items">
            <NavLink to="/" end className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}><span className="icon"><LayoutDashboard size={18} /></span><span>Home</span></NavLink>
            <NavLink to="/trips" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}><span className="icon"><Map size={18} /></span><span>Trips</span></NavLink>
            <NavLink to="/trucks" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}><span className="icon"><Truck size={18} /></span><span>Trucks</span></NavLink>
            <NavLink to="/parties" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}><span className="icon"><Building2 size={18} /></span><span>Parties</span></NavLink>
            <NavLink to="/overheads" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}><span className="icon"><Receipt size={18} /></span><span>Costs</span></NavLink>
          </div>
        </nav>
      </div>
    </BrowserRouter>
  );
}

export default App;
