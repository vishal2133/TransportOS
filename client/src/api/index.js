const API_BASE = 'http://localhost:5000/api';

export const api = {
  // Trucks
  getTrucks: () => fetch(`${API_BASE}/trucks`).then(res => res.json()),
  addTruck: (data) => fetch(`${API_BASE}/trucks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(res => res.json()),
  updateTruck: (id, data) => fetch(`${API_BASE}/trucks/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(res => res.json()),
  deleteTruck: (id) => fetch(`${API_BASE}/trucks/${id}`, { method: 'DELETE' }).then(res => res.json()),

  // Drivers
  getDrivers: () => fetch(`${API_BASE}/drivers`).then(res => res.json()),
  addDriver: (data) => fetch(`${API_BASE}/drivers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(res => res.json()),
  updateDriver: (id, data) => fetch(`${API_BASE}/drivers/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(res => res.json()),
  deleteDriver: (id) => fetch(`${API_BASE}/drivers/${id}`, { method: 'DELETE' }).then(res => res.json()),

  // Parties
  getParties: () => fetch(`${API_BASE}/parties`).then(res => res.json()),
  addParty: (data) => fetch(`${API_BASE}/parties`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(res => res.json()),
  updateParty: (id, data) => fetch(`${API_BASE}/parties/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(res => res.json()),
  deleteParty: (id) => fetch(`${API_BASE}/parties/${id}`, { method: 'DELETE' }).then(res => res.json()),

  // Trips
  getTrips: () => fetch(`${API_BASE}/trips`).then(res => res.json()),
  addTrip: (data) => fetch(`${API_BASE}/trips`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(res => res.json()),
  updateTrip: (id, data) => fetch(`${API_BASE}/trips/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(res => res.json()),
  deleteTrip: (id) => fetch(`${API_BASE}/trips/${id}`, { method: 'DELETE' }).then(res => res.json()),

  // Documents
  getDocuments: () => fetch(`${API_BASE}/documents`).then(res => res.json()),
  addDocument: (data) => fetch(`${API_BASE}/documents`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(res => res.json()),
  updateDocument: (id, data) => fetch(`${API_BASE}/documents/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(res => res.json()),
  deleteDocument: (id) => fetch(`${API_BASE}/documents/${id}`, { method: 'DELETE' }).then(res => res.json()),

  // Overheads
  getOverheads: () => fetch(`${API_BASE}/overheads`).then(res => res.json()),
  addOverhead: (data) => fetch(`${API_BASE}/overheads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(res => res.json()),
  updateOverhead: (id, data) => fetch(`${API_BASE}/overheads/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(res => res.json()),
  deleteOverhead: (id) => fetch(`${API_BASE}/overheads/${id}`, { method: 'DELETE' }).then(res => res.json()),
};

