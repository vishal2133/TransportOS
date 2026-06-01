// --- MOCK DATA ---
let trucks = [
  { id: 't1', number: 'GJ-05-AA-1234', model: 'Tata 407', year: 2019, owner: 'Ramesh Patel', type: 'Mini Truck' },
  { id: 't2', number: 'GJ-05-AB-5678', model: 'Ashok Leyland Ecomet', year: 2021, owner: 'Ramesh Patel', type: 'LCV' },
  { id: 't3', number: 'GJ-05-CD-9012', model: 'Tata Signa', year: 2020, owner: 'Suresh Patel', type: 'HCV' }
];

let drivers = [
  { id: 'd1', name: 'Raju Sharma', phone: '9876543210', license: 'GJ0120190012345', joining: '2021-05-10', salary: 18000, balance: -2000 },
  { id: 'd2', name: 'Mohan Singh', phone: '9876543211', license: 'GJ0220180054321', joining: '2022-01-15', salary: 20000, balance: 5000 },
  { id: 'd3', name: 'Ali Bhai', phone: '9876543212', license: 'GJ0520200098765', joining: '2023-03-01', salary: 15000, balance: 0 }
];

let parties = [
  { id: 'p1', name: 'Patel Cement Works', contact: 'Mahesh Bhai', phone: '9988776655', type: 'cheque', terms: '15days', gst: '27AABCU9603R1ZX', address: 'Surat' },
  { id: 'p2', name: 'Shreeji Traders', contact: 'Kiran Desai', phone: '9988776644', type: 'cash', terms: 'immediate', gst: '', address: 'Ahmedabad' },
  { id: 'p3', name: 'Vibrant Logistics', contact: 'Amit Shah', phone: '9988776633', type: 'neft', terms: '30days', gst: '24AAACV1234A1Z5', address: 'Mumbai' }
];

let trips = [
  { id: 'tr1', date: '2024-05-20', truckId: 't1', driverId: 'd1', partyId: 'p1', from: 'Surat', to: 'Ahmedabad', freight: 12000, gst: 'yes', paid: 0, status: 'delivered', expenses: [{type: 'Fuel', amount: 3000}, {type: 'Toll', amount: 500}], notes: '' },
  { id: 'tr2', date: '2024-05-22', truckId: 't2', driverId: 'd2', partyId: 'p2', from: 'Ahmedabad', to: 'Rajkot', freight: 8000, gst: 'no', paid: 8000, status: 'paid', expenses: [{type: 'Fuel', amount: 2000}], notes: 'Cash discount given' },
  { id: 'tr3', date: '2024-05-25', truckId: 't3', driverId: 'd3', partyId: 'p3', from: 'Surat', to: 'Mumbai', freight: 25000, gst: 'yes', paid: 10000, status: 'in-transit', expenses: [{type: 'Fuel', amount: 8000}, {type: 'Toll', amount: 1200}, {type: 'Police', amount: 500}], notes: 'Partial advance received' }
];

let documents = [
  { id: 'doc1', truckId: 't1', type: 'rc', expiry: '2025-10-15', number: '' },
  { id: 'doc2', truckId: 't1', type: 'insurance', expiry: '2024-06-05', number: '' }, // Expiring soon
  { id: 'doc3', truckId: 't1', type: 'fitness', expiry: '2023-12-01', number: '' }, // Expired
  { id: 'doc4', truckId: 't2', type: 'rc', expiry: '2026-01-20', number: '' },
  { id: 'doc5', truckId: 't2', type: 'insurance', expiry: '2025-05-10', number: '' }
];

let driverAdvances = [
  { id: 'adv1', driverId: 'd1', date: '2024-05-01', type: 'salary', amount: 18000, reason: 'April Salary' },
  { id: 'adv2', driverId: 'd1', date: '2024-05-15', type: 'advance', amount: 2000, reason: 'Personal need' }
];

// --- APP STATE & INIT ---
let currentPage = 'dashboard';
let expenseRowCounter = 0;

function init() {
  document.getElementById('dashboard-date').textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  
  // Populate dropdowns
  populateDropdowns();
  
  // Render pages
  renderDashboard();
  renderTrips();
  renderTrucks();
  renderDrivers();
  renderParties();
  renderDocuments();
}

function navigate(page) {
  // Update active state in nav
  document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(el => el.classList.remove('active'));
  let navItem = document.getElementById(`nav-${page}`);
  let bnavItem = document.getElementById(`bnav-${page}`);
  if(navItem) navItem.classList.add('active');
  if(bnavItem) bnavItem.classList.add('active');
  
  // Update page title in mobile top bar
  const titles = { dashboard: 'Dashboard', trips: 'Trips', trucks: 'Trucks', drivers: 'Drivers', parties: 'Parties', documents: 'Documents' };
  document.getElementById('top-bar-title').textContent = titles[page];

  // Show page
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  currentPage = page;
  
  // Re-render
  if(page === 'dashboard') renderDashboard();
  if(page === 'documents') renderDocuments();
}

// --- HELPERS ---
const formatCurrency = (amt) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amt || 0);
const formatDate = (dateStr) => {
  if(!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const getPartyName = (id) => parties.find(p => p.id === id)?.name || 'Unknown';
const getTruckNumber = (id) => trucks.find(t => t.id === id)?.number || 'Unknown';
const getDriverName = (id) => drivers.find(d => d.id === id)?.name || 'Unknown';
const generateId = () => Math.random().toString(36).substr(2, 9);

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// --- RENDER DASHBOARD ---
function renderDashboard() {
  const inTransit = trips.filter(t => t.status === 'in-transit' || t.status === 'loading').length;
  
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
    return diff <= 30; // expired or expiring in 30 days
  });

  // Stats
  document.getElementById('dashboard-stats').innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Trucks on Trip</div>
      <div class="stat-val">${inTransit} <span style="font-size:16px;color:var(--text-muted);font-weight:normal">/ ${trucks.length}</span></div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Total Outstanding</div>
      <div class="stat-val" style="color:var(--yellow)">${formatCurrency(totalOutstanding)}</div>
      <div class="stat-sub">From ${parties.length} parties</div>
    </div>
    <div class="stat-card" style="cursor:pointer" onclick="navigate('documents')">
      <div class="stat-label">Document Alerts</div>
      <div class="stat-val" style="color:${alerts.length > 0 ? 'var(--red)' : 'var(--green)'}">${alerts.length}</div>
      <div class="stat-sub">${alerts.length > 0 ? 'Action required' : 'All good'}</div>
    </div>
  `;

  // Alerts Box
  const alertsHtml = alerts.map(d => {
    const truck = getTruckNumber(d.truckId);
    const exp = new Date(d.expiry);
    const diff = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
    const isExpired = diff < 0;
    return `
      <div class="alert alert-warning" style="border-color:${isExpired ? 'var(--red)' : 'var(--yellow)'}; background:${isExpired ? 'rgba(239,68,68,0.1)' : ''}">
        <div class="alert-icon">${isExpired ? '🚨' : '⚠️'}</div>
        <div>
          <div class="alert-title" style="color:${isExpired ? 'var(--red)' : 'var(--yellow)'}">${truck} - ${d.type.toUpperCase()} ${isExpired ? 'Expired!' : 'Expiring Soon'}</div>
          <div class="alert-desc">${isExpired ? `Expired on ${formatDate(d.expiry)}` : `Expires in ${diff} days on ${formatDate(d.expiry)}`}</div>
        </div>
      </div>
    `;
  }).join('');
  document.getElementById('dashboard-alerts').innerHTML = alertsHtml;

  // Recent Trips
  const recentTrips = [...trips].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  const tripsHtml = recentTrips.map(t => `
    <div class="list-item" onclick="viewTripDetail('${t.id}')">
      <div class="li-left">
        <div class="li-icon">🛣️</div>
        <div>
          <div class="li-title">${t.from} to ${t.to}</div>
          <div class="li-sub">${formatDate(t.date)} • ${getPartyName(t.partyId)} • ${getTruckNumber(t.truckId)}</div>
        </div>
      </div>
      <div class="li-right">
        <div class="li-val">${formatCurrency(t.freight)}</div>
        <div class="badge ${t.status}">${t.status}</div>
      </div>
    </div>
  `).join('');
  document.getElementById('recent-trips-list').innerHTML = tripsHtml || '<div style="padding:20px;text-align:center;color:var(--text-muted)">No trips found</div>';

  // Outstanding
  const partyOut = parties.map(p => {
    const pt = trips.filter(t => t.partyId === p.id);
    const f = pt.reduce((s, t) => s + Number(t.freight||0), 0);
    const pa = pt.reduce((s, t) => s + Number(t.paid||0), 0);
    return { name: p.name, out: f - pa, id: p.id };
  }).filter(p => p.out > 0).sort((a, b) => b.out - a.out).slice(0, 5);
  
  const outHtml = partyOut.map(p => `
    <div class="list-item" onclick="viewPartyDetail('${p.id}')">
      <div class="li-left">
        <div class="li-icon">🏢</div>
        <div class="li-title">${p.name}</div>
      </div>
      <div class="li-right">
        <div class="li-val red">${formatCurrency(p.out)}</div>
      </div>
    </div>
  `).join('');
  document.getElementById('dashboard-outstanding').innerHTML = outHtml || '<div style="padding:20px;text-align:center;color:var(--text-muted)">No outstanding payments</div>';
}

// --- RENDER TRIPS ---
function renderTrips() {
  const search = document.getElementById('trip-search').value.toLowerCase();
  const statusFilter = document.getElementById('trip-filter-status').value;
  const truckFilter = document.getElementById('trip-filter-truck').value;
  
  let filtered = trips.filter(t => {
    const partyMatch = getPartyName(t.partyId).toLowerCase().includes(search);
    const routeMatch = (t.from + t.to).toLowerCase().includes(search);
    const sMatch = statusFilter ? t.status === statusFilter : true;
    const tMatch = truckFilter ? t.truckId === truckFilter : true;
    return (partyMatch || routeMatch) && sMatch && tMatch;
  });

  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  document.getElementById('trips-count').textContent = `${filtered.length} total trips`;

  const html = filtered.map(t => {
    const totalExp = t.expenses.reduce((s, e) => s + Number(e.amount), 0);
    const profit = t.freight - totalExp;
    return `
    <div class="list-item" onclick="viewTripDetail('${t.id}')">
      <div class="li-left">
        <div class="li-icon">🗺️</div>
        <div>
          <div class="li-title">${getPartyName(t.partyId)}</div>
          <div class="li-sub">${formatDate(t.date)} • ${t.from} → ${t.to} • ${getTruckNumber(t.truckId)}</div>
        </div>
      </div>
      <div class="li-right">
        <div class="li-val">${formatCurrency(t.freight)}</div>
        <div class="badge ${t.status}" style="margin-top:4px">${t.status}</div>
      </div>
    </div>
  `}).join('');
  
  document.getElementById('trips-list').innerHTML = html || '<div style="padding:40px;text-align:center;color:var(--text-muted)">No trips found</div>';
}

// --- RENDER TRUCKS ---
function renderTrucks() {
  document.getElementById('trucks-count').textContent = `${trucks.length} trucks in fleet`;
  const html = trucks.map(t => {
    const tTrips = trips.filter(tr => tr.truckId === t.id);
    const revenue = tTrips.reduce((s, tr) => s + Number(tr.freight), 0);
    
    return `
    <div class="data-card" onclick="viewTruckDetail('${t.id}')">
      <div class="dc-header">
        <div class="dc-title">${t.number}</div>
        <div class="dc-badge">${t.type}</div>
      </div>
      <div class="dc-row"><span class="dc-label">Model</span><span class="dc-val">${t.model} (${t.year})</span></div>
      <div class="dc-row"><span class="dc-label">Owner</span><span class="dc-val">${t.owner}</span></div>
      <div class="dc-row" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
        <span class="dc-label">Trips done</span><span class="dc-val">${tTrips.length}</span>
      </div>
      <div class="dc-row"><span class="dc-label">Revenue generated</span><span class="dc-val green">${formatCurrency(revenue)}</span></div>
    </div>
  `}).join('');
  document.getElementById('trucks-grid').innerHTML = html;
}

// --- RENDER DRIVERS ---
function renderDrivers() {
  document.getElementById('drivers-count').textContent = `${drivers.length} registered drivers`;
  const html = drivers.map(d => {
    const dTrips = trips.filter(tr => tr.driverId === d.id);
    return `
    <div class="list-item" onclick="viewDriverDetail('${d.id}')">
      <div class="li-left">
        <div class="li-icon">👨‍✈️</div>
        <div>
          <div class="li-title">${d.name}</div>
          <div class="li-sub">📞 ${d.phone} • Trips: ${dTrips.length}</div>
        </div>
      </div>
      <div class="li-right">
        <div style="font-size:12px;color:var(--text-muted)">Balance</div>
        <div class="li-val ${d.balance < 0 ? 'red' : 'green'}">${formatCurrency(Math.abs(d.balance))} ${d.balance < 0 ? '(Adv)' : ''}</div>
      </div>
    </div>
  `}).join('');
  document.getElementById('drivers-list').innerHTML = html;
}

// --- RENDER PARTIES ---
function renderParties() {
  const search = document.getElementById('party-search').value.toLowerCase();
  let filtered = parties.filter(p => p.name.toLowerCase().includes(search));
  
  document.getElementById('parties-count').textContent = `${filtered.length} parties`;
  const html = filtered.map(p => {
    const pTrips = trips.filter(tr => tr.partyId === p.id);
    const f = pTrips.reduce((s, t) => s + Number(t.freight||0), 0);
    const pa = pTrips.reduce((s, t) => s + Number(t.paid||0), 0);
    const out = f - pa;

    return `
    <div class="list-item" onclick="viewPartyDetail('${p.id}')">
      <div class="li-left">
        <div class="li-icon">🏢</div>
        <div>
          <div class="li-title">${p.name}</div>
          <div class="li-sub">${p.contact} • ${p.address} • Terms: ${p.terms}</div>
        </div>
      </div>
      <div class="li-right">
        <div style="font-size:12px;color:var(--text-muted)">Outstanding</div>
        <div class="li-val ${out > 0 ? 'red' : 'green'}">${formatCurrency(out)}</div>
      </div>
    </div>
  `}).join('');
  document.getElementById('parties-list').innerHTML = html;
}

// --- RENDER DOCUMENTS ---
function renderDocuments() {
  const today = new Date();
  
  const getStatus = (truckId, type) => {
    const doc = documents.find(d => d.truckId === truckId && d.type === type);
    if(!doc || !doc.expiry) return `<div class="doc-status"><span class="dot gray"></span> Missing</div>`;
    
    const exp = new Date(doc.expiry);
    const diff = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
    
    let color = 'green';
    if(diff < 0) color = 'red';
    else if(diff <= 30) color = 'yellow';
    
    return `<div class="doc-status"><span class="dot ${color}"></span> ${diff < 0 ? 'Expired' : diff + ' days'}</div>
            <span class="doc-date">${formatDate(doc.expiry)}</span>`;
  };

  const html = trucks.map(t => `
    <tr>
      <td style="font-weight:600;color:white">${t.number}</td>
      <td>${getStatus(t.id, 'rc')}</td>
      <td>${getStatus(t.id, 'insurance')}</td>
      <td>${getStatus(t.id, 'fitness')}</td>
      <td>${getStatus(t.id, 'puc')}</td>
      <td>${getStatus(t.id, 'permit')}</td>
    </tr>
  `).join('');
  document.getElementById('doc-table-body').innerHTML = html;
}

// --- POPULATE DROPDOWNS ---
function populateDropdowns() {
  const truckOpts = trucks.map(t => `<option value="${t.id}">${t.number} - ${t.type}</option>`).join('');
  const driverOpts = drivers.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
  const partyOpts = parties.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  
  document.getElementById('trip-truck').innerHTML = '<option value="">Select Truck</option>' + truckOpts;
  document.getElementById('trip-filter-truck').innerHTML = '<option value="">All Trucks</option>' + truckOpts;
  document.getElementById('doc-truck').innerHTML = '<option value="">Select Truck</option>' + truckOpts;
  
  document.getElementById('trip-driver').innerHTML = '<option value="">Select Driver</option>' + driverOpts;
  document.getElementById('trip-party').innerHTML = '<option value="">Select Party</option>' + partyOpts;
}

// --- MODAL HANDLING ---
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function openAddTrip(id = null) {
  document.getElementById('trip-modal-title').textContent = id ? 'Edit Trip' : 'Add Trip';
  document.getElementById('trip-edit-id').value = id || '';
  document.getElementById('expense-rows').innerHTML = '';
  expenseRowCounter = 0;
  
  if(id) {
    const t = trips.find(x => x.id === id);
    document.getElementById('trip-date').value = t.date;
    document.getElementById('trip-status').value = t.status;
    document.getElementById('trip-truck').value = t.truckId;
    document.getElementById('trip-driver').value = t.driverId;
    document.getElementById('trip-party').value = t.partyId;
    document.getElementById('trip-freight').value = t.freight;
    document.getElementById('trip-from').value = t.from;
    document.getElementById('trip-to').value = t.to;
    document.getElementById('trip-gst').value = t.gst;
    document.getElementById('trip-paid').value = t.paid;
    document.getElementById('trip-notes').value = t.notes;
    t.expenses.forEach(e => addExpenseRow(e.type, e.amount));
  } else {
    document.getElementById('trip-date').valueAsDate = new Date();
    ['trip-status','trip-truck','trip-driver','trip-party','trip-freight','trip-from','trip-to','trip-paid','trip-notes'].forEach(el => document.getElementById(el).value = '');
    document.getElementById('trip-gst').value = 'no';
    document.getElementById('trip-status').value = 'loading';
  }
  openModal('modal-add-trip');
}

function saveTrip() {
  const exps = [];
  for(let i=0; i<expenseRowCounter; i++) {
    const typeEl = document.getElementById(`exp-type-${i}`);
    const amtEl = document.getElementById(`exp-amt-${i}`);
    if(typeEl && amtEl && amtEl.value) {
      exps.push({ type: typeEl.value, amount: Number(amtEl.value) });
    }
  }

  const obj = {
    date: document.getElementById('trip-date').value,
    status: document.getElementById('trip-status').value,
    truckId: document.getElementById('trip-truck').value,
    driverId: document.getElementById('trip-driver').value,
    partyId: document.getElementById('trip-party').value,
    freight: Number(document.getElementById('trip-freight').value),
    from: document.getElementById('trip-from').value,
    to: document.getElementById('trip-to').value,
    gst: document.getElementById('trip-gst').value,
    paid: Number(document.getElementById('trip-paid').value),
    notes: document.getElementById('trip-notes').value,
    expenses: exps
  };
  
  if(!obj.date || !obj.truckId || !obj.partyId || !obj.freight) return alert('Please fill required fields');

  const id = document.getElementById('trip-edit-id').value;
  if(id) {
    const idx = trips.findIndex(x => x.id === id);
    trips[idx] = { ...trips[idx], ...obj };
    showToast('Trip updated successfully');
  } else {
    trips.push({ id: generateId(), ...obj });
    showToast('Trip added successfully');
  }
  
  closeModal('modal-add-trip');
  closeDetail();
  if(currentPage==='trips') renderTrips();
  if(currentPage==='dashboard') renderDashboard();
}

function addExpenseRow(type = 'Fuel', amount = '') {
  const id = expenseRowCounter++;
  const div = document.createElement('div');
  div.className = 'expense-row';
  div.id = `expense-row-${id}`;
  div.innerHTML = `
    <select class="form-input" id="exp-type-${id}">
      <option value="Fuel">Fuel</option>
      <option value="Toll">Toll Tax</option>
      <option value="Driver Allowance">Driver Allowance</option>
      <option value="Maintenance">Maintenance</option>
      <option value="Police/RTO">Police/RTO</option>
      <option value="Loading/Unloading">Loading/Unloading</option>
      <option value="Other">Other</option>
    </select>
    <input type="number" class="form-input" id="exp-amt-${id}" placeholder="Amount (₹)" value="${amount}">
    <button class="btn-remove" onclick="document.getElementById('expense-row-${id}').remove()">✕</button>
  `;
  document.getElementById('expense-rows').appendChild(div);
  if(type) document.getElementById(`exp-type-${id}`).value = type;
}

function openAddTruck(id=null) {
  document.getElementById('truck-modal-title').textContent = id ? 'Edit Truck' : 'Add Truck';
  document.getElementById('truck-edit-id').value = id || '';
  if(id) {
    const t = trucks.find(x => x.id === id);
    document.getElementById('truck-number').value = t.number;
    document.getElementById('truck-model').value = t.model;
    document.getElementById('truck-year').value = t.year;
    document.getElementById('truck-owner').value = t.owner;
    document.getElementById('truck-type').value = t.type;
  } else {
    ['truck-number','truck-model','truck-year','truck-owner'].forEach(el => document.getElementById(el).value = '');
    document.getElementById('truck-type').value = 'Mini Truck';
  }
  openModal('modal-add-truck');
}

function saveTruck() {
  const obj = {
    number: document.getElementById('truck-number').value.toUpperCase(),
    model: document.getElementById('truck-model').value,
    year: document.getElementById('truck-year').value,
    owner: document.getElementById('truck-owner').value,
    type: document.getElementById('truck-type').value
  };
  if(!obj.number) return alert('Enter truck number');

  const id = document.getElementById('truck-edit-id').value;
  if(id) {
    const idx = trucks.findIndex(x => x.id === id);
    trucks[idx] = { ...trucks[idx], ...obj };
    showToast('Truck updated');
  } else {
    trucks.push({ id: generateId(), ...obj });
    showToast('Truck added');
  }
  
  populateDropdowns();
  closeModal('modal-add-truck');
  closeDetail();
  renderTrucks();
}

function openAddDriver(id=null) {
  document.getElementById('driver-modal-title').textContent = id ? 'Edit Driver' : 'Add Driver';
  document.getElementById('driver-edit-id').value = id || '';
  if(id) {
    const d = drivers.find(x => x.id === id);
    document.getElementById('driver-name').value = d.name;
    document.getElementById('driver-phone').value = d.phone;
    document.getElementById('driver-license').value = d.license;
    document.getElementById('driver-joining').value = d.joining;
    document.getElementById('driver-salary').value = d.salary;
    document.getElementById('driver-address').value = d.address || '';
  } else {
    ['driver-name','driver-phone','driver-license','driver-salary','driver-address'].forEach(el => document.getElementById(el).value = '');
    document.getElementById('driver-joining').valueAsDate = new Date();
  }
  openModal('modal-add-driver');
}

function saveDriver() {
  const obj = {
    name: document.getElementById('driver-name').value,
    phone: document.getElementById('driver-phone').value,
    license: document.getElementById('driver-license').value,
    joining: document.getElementById('driver-joining').value,
    salary: Number(document.getElementById('driver-salary').value),
    address: document.getElementById('driver-address').value,
    balance: 0 // Default balance for new
  };
  if(!obj.name) return alert('Enter driver name');

  const id = document.getElementById('driver-edit-id').value;
  if(id) {
    const idx = drivers.findIndex(x => x.id === id);
    obj.balance = drivers[idx].balance; // Preserve balance
    drivers[idx] = { ...drivers[idx], ...obj };
    showToast('Driver updated');
  } else {
    drivers.push({ id: generateId(), ...obj });
    showToast('Driver added');
  }
  
  populateDropdowns();
  closeModal('modal-add-driver');
  closeDetail();
  renderDrivers();
}

function openAddParty(id=null) {
  document.getElementById('party-modal-title').textContent = id ? 'Edit Party' : 'Add Party';
  document.getElementById('party-edit-id').value = id || '';
  if(id) {
    const p = parties.find(x => x.id === id);
    document.getElementById('party-name').value = p.name;
    document.getElementById('party-contact').value = p.contact;
    document.getElementById('party-phone').value = p.phone;
    document.getElementById('party-payment-type').value = p.type;
    document.getElementById('party-payment-terms').value = p.terms;
    document.getElementById('party-gst').value = p.gst;
    document.getElementById('party-address').value = p.address;
    document.getElementById('party-notes').value = p.notes || '';
  } else {
    ['party-name','party-contact','party-phone','party-gst','party-address','party-notes'].forEach(el => document.getElementById(el).value = '');
    document.getElementById('party-payment-type').value = 'cash';
    document.getElementById('party-payment-terms').value = 'immediate';
  }
  openModal('modal-add-party');
}

function saveParty() {
  const obj = {
    name: document.getElementById('party-name').value,
    contact: document.getElementById('party-contact').value,
    phone: document.getElementById('party-phone').value,
    type: document.getElementById('party-payment-type').value,
    terms: document.getElementById('party-payment-terms').value,
    gst: document.getElementById('party-gst').value,
    address: document.getElementById('party-address').value,
    notes: document.getElementById('party-notes').value
  };
  if(!obj.name) return alert('Enter party name');

  const id = document.getElementById('party-edit-id').value;
  if(id) {
    const idx = parties.findIndex(x => x.id === id);
    parties[idx] = { ...parties[idx], ...obj };
    showToast('Party updated');
  } else {
    parties.push({ id: generateId(), ...obj });
    showToast('Party added');
  }
  
  populateDropdowns();
  closeModal('modal-add-party');
  closeDetail();
  renderParties();
}

function openAddDocument() {
  ['doc-truck','doc-expiry','doc-number'].forEach(el => document.getElementById(el).value = '');
  document.getElementById('doc-type').value = 'rc';
  openModal('modal-add-document');
}

function saveDocument() {
  const obj = {
    truckId: document.getElementById('doc-truck').value,
    type: document.getElementById('doc-type').value,
    expiry: document.getElementById('doc-expiry').value,
    number: document.getElementById('doc-number').value
  };
  if(!obj.truckId || !obj.expiry) return alert('Select truck and expiry date');

  // Check if exists
  const existIdx = documents.findIndex(d => d.truckId === obj.truckId && d.type === obj.type);
  if(existIdx >= 0) {
    documents[existIdx] = { ...documents[existIdx], ...obj };
  } else {
    documents.push({ id: generateId(), ...obj });
  }
  
  showToast('Document updated');
  closeModal('modal-add-document');
  renderDocuments();
  if(currentPage==='dashboard') renderDashboard();
}

function openAddAdvance(driverId) {
  document.getElementById('advance-driver-id').value = driverId;
  document.getElementById('advance-date').valueAsDate = new Date();
  document.getElementById('advance-type').value = 'advance';
  document.getElementById('advance-amount').value = '';
  document.getElementById('advance-reason').value = '';
  openModal('modal-add-advance');
}

function saveAdvance() {
  const did = document.getElementById('advance-driver-id').value;
  const obj = {
    driverId: did,
    date: document.getElementById('advance-date').value,
    type: document.getElementById('advance-type').value,
    amount: Number(document.getElementById('advance-amount').value),
    reason: document.getElementById('advance-reason').value
  };
  if(!obj.amount || !obj.date) return alert('Enter amount and date');
  
  driverAdvances.push({ id: generateId(), ...obj });
  
  // Update driver balance
  const driver = drivers.find(d => d.id === did);
  if(obj.type === 'advance') driver.balance -= obj.amount; // Advance given (negative balance means they owe us)
  if(obj.type === 'repayment') driver.balance += obj.amount;
  // Salary paid doesn't affect running balance of advances unless we want full double-entry
  
  showToast('Transaction saved');
  closeModal('modal-add-advance');
  viewDriverDetail(did);
  if(currentPage==='drivers') renderDrivers();
}

// --- DETAIL PANELS ---
let activeDetailId = null;
let activeDetailType = null;

function openDetail() { document.getElementById('detail-overlay').classList.add('active'); }
function closeDetail() { document.getElementById('detail-overlay').classList.remove('active'); activeDetailId = null; }
function closeDetailOnBg(e) { if(e.target.id === 'detail-overlay') closeDetail(); }

function handleDetailEdit() {
  if(activeDetailType === 'trip') openAddTrip(activeDetailId);
  if(activeDetailType === 'truck') openAddTruck(activeDetailId);
  if(activeDetailType === 'driver') openAddDriver(activeDetailId);
  if(activeDetailType === 'party') openAddParty(activeDetailId);
}

function handleDetailDelete() {
  if(!confirm('Are you sure you want to delete this?')) return;
  if(activeDetailType === 'trip') { trips = trips.filter(x => x.id !== activeDetailId); renderTrips(); }
  if(activeDetailType === 'truck') { trucks = trucks.filter(x => x.id !== activeDetailId); renderTrucks(); }
  if(activeDetailType === 'driver') { drivers = drivers.filter(x => x.id !== activeDetailId); renderDrivers(); }
  if(activeDetailType === 'party') { parties = parties.filter(x => x.id !== activeDetailId); renderParties(); }
  closeDetail();
  showToast('Deleted successfully');
}

function setupDetailHeader(title, type, id) {
  document.getElementById('detail-title').textContent = title;
  activeDetailId = id;
  activeDetailType = type;
  document.getElementById('detail-edit-btn').style.display = 'inline-flex';
  document.getElementById('detail-delete-btn').style.display = 'inline-flex';
  openDetail();
}

function viewTripDetail(id) {
  const t = trips.find(x => x.id === id);
  if(!t) return;
  setupDetailHeader(`${t.from} to ${t.to}`, 'trip', id);
  
  const totalExp = t.expenses.reduce((s, e) => s + Number(e.amount), 0);
  const profit = t.freight - totalExp;
  const expHtml = t.expenses.map(e => `<div class="dt-row"><span class="dt-label">${e.type}</span><span class="dt-val red">- ${formatCurrency(e.amount)}</span></div>`).join('');
  
  document.getElementById('detail-body').innerHTML = `
    <div style="display:flex;gap:12px;margin-bottom:8px">
      <div class="badge ${t.status}">${t.status.toUpperCase()}</div>
      <div class="badge ${t.gst==='yes'?'in-transit':'billed'}">${t.gst==='yes'?'WITH GST':'NO GST'}</div>
    </div>
    
    <div class="dt-section">
      <div class="dt-section-title">Trip Info</div>
      <div class="dt-row"><span class="dt-label">Date</span><span class="dt-val">${formatDate(t.date)}</span></div>
      <div class="dt-row"><span class="dt-label">Party</span><span class="dt-val" style="color:var(--accent);cursor:pointer" onclick="viewPartyDetail('${t.partyId}')">${getPartyName(t.partyId)}</span></div>
      <div class="dt-row"><span class="dt-label">Truck</span><span class="dt-val" style="color:var(--accent);cursor:pointer" onclick="viewTruckDetail('${t.truckId}')">${getTruckNumber(t.truckId)}</span></div>
      <div class="dt-row"><span class="dt-label">Driver</span><span class="dt-val" style="color:var(--accent);cursor:pointer" onclick="viewDriverDetail('${t.driverId}')">${getDriverName(t.driverId)}</span></div>
    </div>

    <div class="dt-section">
      <div class="dt-section-title">Financials</div>
      <div class="dt-row"><span class="dt-label">Freight Amount</span><span class="dt-val dt-amount green">${formatCurrency(t.freight)}</span></div>
      ${expHtml}
      <div class="dt-row" style="background:rgba(255,255,255,0.02)"><span class="dt-label" style="font-weight:600;color:white">Net Profit</span><span class="dt-val dt-amount green" style="font-size:18px">${formatCurrency(profit)}</span></div>
    </div>

    <div class="dt-section">
      <div class="dt-section-title">Payment Status</div>
      <div class="dt-row"><span class="dt-label">Total Billed</span><span class="dt-val">${formatCurrency(t.freight)}</span></div>
      <div class="dt-row"><span class="dt-label">Amount Received</span><span class="dt-val green">${formatCurrency(t.paid)}</span></div>
      <div class="dt-row"><span class="dt-label">Pending</span><span class="dt-val red" style="font-weight:700">${formatCurrency(t.freight - t.paid)}</span></div>
    </div>
    
    ${t.notes ? `<div style="padding:16px;background:var(--bg-hover);border-radius:8px;font-size:13px"><div style="color:var(--text-muted);margin-bottom:4px">Notes</div>${t.notes}</div>` : ''}
  `;
}

function viewPartyDetail(id) {
  const p = parties.find(x => x.id === id);
  if(!p) return;
  setupDetailHeader(p.name, 'party', id);
  
  const pTrips = trips.filter(t => t.partyId === id).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const f = pTrips.reduce((s, t) => s + Number(t.freight||0), 0);
  const pa = pTrips.reduce((s, t) => s + Number(t.paid||0), 0);
  const out = f - pa;

  const tripHtml = pTrips.map(t => `
    <div class="dt-row" style="cursor:pointer" onclick="viewTripDetail('${t.id}')">
      <div>
        <div style="font-weight:500;color:white">${formatDate(t.date)}</div>
        <div style="font-size:12px;color:var(--text-muted)">${t.from} → ${t.to}</div>
      </div>
      <div style="text-align:right">
        <div class="green">${formatCurrency(t.freight)}</div>
        <div style="font-size:12px;color:${t.freight-t.paid>0?'var(--red)':'var(--text-muted)'}">${t.freight-t.paid>0 ? `Pending: ${formatCurrency(t.freight-t.paid)}` : 'Paid'}</div>
      </div>
    </div>
  `).join('') || '<div style="padding:16px;text-align:center;color:var(--text-muted)">No trips found</div>';

  document.getElementById('detail-body').innerHTML = `
    <div style="background:rgba(239, 68, 68, 0.1); border:1px solid rgba(239, 68, 68, 0.2); padding:20px; border-radius:12px; text-align:center">
      <div style="color:var(--text-muted); font-size:13px; text-transform:uppercase; margin-bottom:4px">Total Outstanding</div>
      <div style="font-size:32px; font-weight:800; color:var(--red)">${formatCurrency(out)}</div>
    </div>

    <div class="dt-section">
      <div class="dt-section-title">Party Profile</div>
      <div class="dt-row"><span class="dt-label">Contact</span><span class="dt-val">${p.contact} • ${p.phone}</span></div>
      <div class="dt-row"><span class="dt-label">GST</span><span class="dt-val">${p.gst || 'Unregistered'}</span></div>
      <div class="dt-row"><span class="dt-label">Terms</span><span class="dt-val" style="text-transform:capitalize">${p.type} • ${p.terms}</span></div>
    </div>

    <div class="dt-section">
      <div class="dt-section-title">Recent Trips</div>
      ${tripHtml}
    </div>
  `;
}

function viewTruckDetail(id) {
  const t = trucks.find(x => x.id === id);
  if(!t) return;
  setupDetailHeader(t.number, 'truck', id);
  
  const tTrips = trips.filter(tr => tr.truckId === id).sort((a,b)=>new Date(b.date)-new Date(a.date));
  let revenue = 0, exp = 0;
  tTrips.forEach(tr => {
    revenue += Number(tr.freight);
    exp += tr.expenses.reduce((s,e) => s + Number(e.amount), 0);
  });

  const tripHtml = tTrips.map(tr => `
    <div class="dt-row" style="cursor:pointer" onclick="viewTripDetail('${tr.id}')">
      <div>
        <div style="font-weight:500;color:white">${formatDate(tr.date)}</div>
        <div style="font-size:12px;color:var(--text-muted)">${tr.from} → ${tr.to}</div>
      </div>
      <div style="text-align:right">
        <div class="green">${formatCurrency(tr.freight)}</div>
        <div class="badge ${tr.status}" style="font-size:10px">${tr.status}</div>
      </div>
    </div>
  `).join('') || '<div style="padding:16px;text-align:center;color:var(--text-muted)">No trips found</div>';

  document.getElementById('detail-body').innerHTML = `
    <div style="display:flex;gap:12px;">
      <div style="flex:1; background:var(--bg-hover); padding:16px; border-radius:12px; text-align:center">
        <div style="color:var(--text-muted); font-size:12px; margin-bottom:4px">Revenue</div>
        <div style="font-size:20px; font-weight:700; color:var(--green)">${formatCurrency(revenue)}</div>
      </div>
      <div style="flex:1; background:var(--bg-hover); padding:16px; border-radius:12px; text-align:center">
        <div style="color:var(--text-muted); font-size:12px; margin-bottom:4px">Expenses</div>
        <div style="font-size:20px; font-weight:700; color:var(--red)">${formatCurrency(exp)}</div>
      </div>
    </div>

    <div class="dt-section">
      <div class="dt-section-title">Truck Info</div>
      <div class="dt-row"><span class="dt-label">Model</span><span class="dt-val">${t.model} (${t.year})</span></div>
      <div class="dt-row"><span class="dt-label">Type</span><span class="dt-val">${t.type}</span></div>
      <div class="dt-row"><span class="dt-label">Owner</span><span class="dt-val">${t.owner}</span></div>
    </div>

    <div class="dt-section">
      <div class="dt-section-title">Trip History</div>
      ${tripHtml}
    </div>
  `;
}

function viewDriverDetail(id) {
  const d = drivers.find(x => x.id === id);
  if(!d) return;
  setupDetailHeader(d.name, 'driver', id);
  
  const dTrips = trips.filter(tr => tr.driverId === id).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const dAdv = driverAdvances.filter(a => a.driverId === id).sort((a,b)=>new Date(b.date)-new Date(a.date));
  
  const tripHtml = dTrips.slice(0,5).map(tr => `
    <div class="dt-row" style="cursor:pointer" onclick="viewTripDetail('${tr.id}')">
      <div>
        <div style="font-weight:500;color:white">${formatDate(tr.date)}</div>
        <div style="font-size:12px;color:var(--text-muted)">${tr.from} → ${tr.to} (${getTruckNumber(tr.truckId)})</div>
      </div>
    </div>
  `).join('') || '<div style="padding:16px;text-align:center;color:var(--text-muted)">No trips found</div>';

  const advHtml = dAdv.map(a => `
    <div class="dt-row">
      <div>
        <div style="font-weight:500;color:white">${formatDate(a.date)}</div>
        <div style="font-size:12px;color:var(--text-muted)">${a.reason}</div>
      </div>
      <div style="text-align:right">
        <div class="${a.type==='advance'?'red':'green'}">${a.type==='advance'?'-':'+'} ${formatCurrency(a.amount)}</div>
        <div style="font-size:10px;text-transform:uppercase;color:var(--text-muted)">${a.type}</div>
      </div>
    </div>
  `).join('') || '<div style="padding:16px;text-align:center;color:var(--text-muted)">No transactions</div>';

  document.getElementById('detail-body').innerHTML = `
    <div style="background:var(--bg-hover); padding:20px; border-radius:12px; text-align:center; position:relative">
      <div style="color:var(--text-muted); font-size:13px; text-transform:uppercase; margin-bottom:4px">Current Balance</div>
      <div style="font-size:32px; font-weight:800; color:${d.balance < 0 ? 'var(--red)' : 'var(--green)'}">${formatCurrency(Math.abs(d.balance))}</div>
      <div style="font-size:12px; color:var(--text-muted)">${d.balance < 0 ? 'Driver owes company (Advance)' : 'Company owes driver'}</div>
      <button class="btn btn-primary btn-sm" style="margin-top:16px" onclick="openAddAdvance('${d.id}')">+ Record Transaction</button>
    </div>

    <div class="dt-section">
      <div class="dt-section-title">Driver Info</div>
      <div class="dt-row"><span class="dt-label">Phone</span><span class="dt-val">📞 ${d.phone}</span></div>
      <div class="dt-row"><span class="dt-label">License</span><span class="dt-val">${d.license}</span></div>
      <div class="dt-row"><span class="dt-label">Salary</span><span class="dt-val">${formatCurrency(d.salary)}/mo</span></div>
    </div>

    <div class="dt-section">
      <div class="dt-section-title">Advance & Salary Ledger</div>
      ${advHtml}
    </div>

    <div class="dt-section">
      <div class="dt-section-title">Recent Trips</div>
      ${tripHtml}
    </div>
  `;
}

// Start app
window.onload = init;
