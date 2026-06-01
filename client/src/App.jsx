import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { LayoutDashboard, Map, Truck, Users, Building2, FileText } from 'lucide-react';
import { api } from './api';

// Pages
import Dashboard from './pages/Dashboard';
import Trips from './pages/Trips';
import Trucks from './pages/Trucks';
import Drivers from './pages/Drivers';
import Parties from './pages/Parties';
import Documents from './pages/Documents';

function App() {
  const [data, setData] = useState({
    trucks: [],
    drivers: [],
    parties: [],
    trips: [],
    documents: [],
  });

  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [trucks, drivers, parties, trips, documents] = await Promise.all([
        api.getTrucks(),
        api.getDrivers(),
        api.getParties(),
        api.getTrips(),
        api.getDocuments()
      ]);
      setData({ trucks, drivers, parties, trips, documents });
    } catch (err) {
      console.error("Failed to fetch data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const refreshData = () => {
    fetchData();
  };

  return (
    <BrowserRouter>
      <div className="app">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="logo-text">🚛 TransportOS</div>
            <div className="logo-sub">Fleet Manager</div>
          </div>
          <nav className="sidebar-nav">
            <NavLink to="/" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}><span className="nav-icon"><LayoutDashboard size={18} /></span> Dashboard</NavLink>
            <NavLink to="/trips" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}><span className="nav-icon"><Map size={18} /></span> Trips</NavLink>
            <NavLink to="/trucks" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}><span className="nav-icon"><Truck size={18} /></span> Trucks</NavLink>
            <NavLink to="/drivers" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}><span className="nav-icon"><Users size={18} /></span> Drivers</NavLink>
            <NavLink to="/parties" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}><span className="nav-icon"><Building2 size={18} /></span> Parties</NavLink>
            <NavLink to="/documents" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}><span className="nav-icon"><FileText size={18} /></span> Documents</NavLink>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="main">
          {loading ? (
             <div style={{padding: '40px', textAlign: 'center', color: 'var(--text-main)'}}>Loading...</div>
          ) : (
            <Routes>
              <Route path="/" element={<Dashboard data={data} refreshData={refreshData} />} />
              <Route path="/trips" element={<Trips data={data} refreshData={refreshData} />} />
              <Route path="/trucks" element={<Trucks data={data} refreshData={refreshData} />} />
              <Route path="/drivers" element={<Drivers data={data} refreshData={refreshData} />} />
              <Route path="/parties" element={<Parties data={data} refreshData={refreshData} />} />
              <Route path="/documents" element={<Documents data={data} refreshData={refreshData} />} />
            </Routes>
          )}
        </main>

        {/* Bottom Nav (Mobile) */}
        <nav className="bottom-nav">
          <div className="bottom-nav-items">
            <NavLink to="/" className={({isActive}) => `bottom-nav-item ${isActive ? 'active' : ''}`}><span className="icon"><LayoutDashboard size={18} /></span><span>Home</span></NavLink>
            <NavLink to="/trips" className={({isActive}) => `bottom-nav-item ${isActive ? 'active' : ''}`}><span className="icon"><Map size={18} /></span><span>Trips</span></NavLink>
            <NavLink to="/trucks" className={({isActive}) => `bottom-nav-item ${isActive ? 'active' : ''}`}><span className="icon"><Truck size={18} /></span><span>Trucks</span></NavLink>
            <NavLink to="/drivers" className={({isActive}) => `bottom-nav-item ${isActive ? 'active' : ''}`}><span className="icon"><Users size={18} /></span><span>Drivers</span></NavLink>
            <NavLink to="/parties" className={({isActive}) => `bottom-nav-item ${isActive ? 'active' : ''}`}><span className="icon"><Building2 size={18} /></span><span>Parties</span></NavLink>
            <NavLink to="/documents" className={({isActive}) => `bottom-nav-item ${isActive ? 'active' : ''}`}><span className="icon"><FileText size={18} /></span><span>Docs</span></NavLink>
          </div>
        </nav>
      </div>
    </BrowserRouter>
  );
}

export default App;
