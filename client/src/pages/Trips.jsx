import React, { useState, useMemo, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { api } from '../api';
import AutocompleteInput from '../components/AutocompleteInput';
import FilterableSelect from '../components/FilterableSelect';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const toISO   = (d) => d.toISOString().split('T')[0];
const todayISO     = () => toISO(new Date());
const yesterdayISO = () => toISO(new Date(Date.now() - 86400000));

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const fmtDateLong = (d) => {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
};

const makeRow = (date) => ({
  _id: Date.now() + Math.random(),
  date:          date || todayISO(),
  truckId:       '',
  partyId:       '',
  from:          '',
  to:            '',
  freight:       '',
  otherExpenses: '',
});

// ─── WhatsApp Message Parser ─────────────────────────────────────────────────
const EXPENSE_KEYWORDS = {
  toll:     ['toll', 'टोल'],
  fuel:     ['fuel', 'diesel', 'disel', 'dsl', 'डीज़ल', 'डीजल', 'petrol', 'tel', 'तेल'],
  police:   ['police', 'rto', 'पुलिस', 'nakabandi', 'challan', 'चालान'],
  repair:   ['repair', 'repairing', 'puncture', 'pankchar', 'पंक्चर', 'मरम्मत', 'garage', 'tyre', 'tire', 'tayr'],
  loading:  ['loading', 'unloading', 'labour', 'labor', 'hamali', 'हमाली', 'loding'],
  food:     ['food', 'khana', 'chai', 'खाना', 'चाय', 'hotel'],
  other:    ['kharcha', 'karch', 'खर्चा', 'expense', 'paisa'],
};

const EXPENSE_ICONS = { toll: '🛣️', fuel: '⛽', police: '🚔', repair: '🔧', loading: '📦', food: '🍽️', other: '💰' };

function parseWhatsApp(text, knownTrucks = []) {
  if (!text || !text.trim()) return [];
  const lines = text.split('\n').filter(l => l.trim());
  const results = [];

  for (const rawLine of lines) {
    // Strip WhatsApp timestamp prefix if present
    let line = rawLine;
    const tsMatch = line.match(/^\[?\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4},?\s*\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?\]?\s*-?\s*(?:[^:]+:\s*)?(.+)$/);
    if (tsMatch) line = tsMatch[1];
    const lower = line.toLowerCase().trim();
    if (!lower || lower.length < 3) continue;

    // Detect expense type
    let expenseType = '';
    let expenseKey = 'other';
    for (const [type, keywords] of Object.entries(EXPENSE_KEYWORDS)) {
      if (keywords.some(kw => lower.includes(kw))) {
        expenseType = type.charAt(0).toUpperCase() + type.slice(1);
        expenseKey = type;
        break;
      }
    }

    // Extract truck number (last 4 digits or full format)
    let truckMatch = '';
    let truckMatchedString = '';

    // First try: look for 4-digit numbers that match a known truck's last 4 digits
    const fourDigitMatches = line.match(/(?<!\d)(\d{4})(?!\d)/g);
    if (fourDigitMatches) {
      for (const fourDigits of fourDigitMatches) {
        const found = knownTrucks.find(t => {
          const tClean = (t.number || '').replace(/[\s\-]/g, '').toUpperCase();
          return tClean.endsWith(fourDigits);
        });
        if (found) {
          truckMatch = found.id;
          truckMatchedString = fourDigits;
          break; // Stop at first valid match
        }
      }
    }

    // Second try: if no 4-digit match, try the full truck pattern (e.g. GJ05BX1234)
    if (!truckMatch) {
      const truckRegex = /\b([A-Z]{2})\s*(\d{1,2})\s*([A-Z]{0,3})\s*(\d{4})\b/gi;
      const truckMatches = line.match(truckRegex);
      if (truckMatches) {
        const raw = truckMatches[0].replace(/\s+/g, '').toUpperCase();
        const found = knownTrucks.find(t => {
          const tClean = (t.number || '').replace(/[\s\-]/g, '').toUpperCase();
          return tClean === raw || tClean.includes(raw) || raw.includes(tClean);
        });
        truckMatch = found ? found.id : truckMatches[0].toUpperCase();
        truckMatchedString = truckMatches[0];
      }
    }

    // Extract amounts (₹450, Rs 450, 450/-, or standalone 3+ digit numbers)
    const amounts = [];
    const amtRegex = /(?:₹|rs\.?\s*|rupees?\s*|rupaiye?\s*)(\d[\d,]*)|(\d[\d,]*)\s*(?:₹|rs|rupaiye?|rupees?|\/-)|(?<!\d)(\d{3,6})(?!\d)/gi;
    let m;
    while ((m = amtRegex.exec(lower)) !== null) {
      const rawValStr = m[1] || m[2] || m[3] || '0';
      const valStr = rawValStr.replace(/,/g, '');
      const val = parseFloat(valStr);
      // Ensure we don't accidentally treat the matched truck number as the amount
      if (val >= 10 && val < 10000000 && valStr !== truckMatchedString) {
        amounts.push(val);
      }
    }

    if (amounts.length > 0 || expenseType) {
      results.push({
        _id: Date.now() + Math.random(),
        type: expenseType || 'Other',
        typeKey: expenseKey,
        amount: amounts[0] || 0,
        truck: truckMatch,
        raw: line.trim(),
      });
    }
  }
  return results;
}

// ─── File Import Helpers ─────────────────────────────────────────────────────
const COLUMN_MAP = {
  'date': 'date', 'dt': 'date', 'tarikh': 'date', 'तारीख': 'date',
  'truck': 'truckId', 'truck number': 'truckId', 'truck no': 'truckId', 'truck no.': 'truckId',
  'vehicle': 'truckId', 'vehicle no': 'truckId', 'vehicle number': 'truckId', 'gaadi': 'truckId', 'gadi': 'truckId',
  'party': 'partyId', 'client': 'partyId', "client's name": 'partyId', 'client name': 'partyId',
  'party name': 'partyId', 'company': 'partyId', 'clients name': 'partyId',
  'from': 'from', 'origin': 'from', 'loading point': 'from', 'source': 'from',
  'to': 'to', 'destination': 'to', 'dest': 'to', 'unloading point': 'to', 'delivery': 'to',
  'freight': 'freight', 'freight amount': 'freight', 'bhada': 'freight', 'amount': 'freight', 'rate': 'freight', 'भाड़ा': 'freight',
  'expenses': 'otherExpenses', 'other expenses': 'otherExpenses', 'kharcha': 'otherExpenses', 'other exp': 'otherExpenses', 'exp': 'otherExpenses',
};

function normalizeHeader(h) {
  if (!h) return null;
  const clean = String(h).trim().toLowerCase().replace(/[^a-z0-9\u0900-\u097F\s'.]/g, '');
  return COLUMN_MAP[clean] || null;
}

function parseDateVal(val) {
  if (!val) return '';
  if (typeof val === 'number') {
    // Excel serial date
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) return toISO(d);
  }
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD/MM/YYYY or DD-MM-YYYY
  const parts = s.split(/[\/\-\.]/);
  if (parts.length === 3) {
    let [a, b, c] = parts.map(Number);
    if (c < 100) c += 2000;
    if (a <= 31 && b <= 12 && c >= 1900) {
      const dt = new Date(c, b - 1, a);
      if (!isNaN(dt.getTime())) return toISO(dt);
    }
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return toISO(d);
  return '';
}

function fileToRows(rawRows, headers, trucks, parties) {
  const mapping = {};
  headers.forEach((h, i) => {
    const field = normalizeHeader(h);
    if (field && !(field in mapping)) mapping[field] = i;
  });

  const rows = [];
  for (const raw of rawRows) {
    const r = makeRow(todayISO());
    let hasData = false;
    for (const [field, colIdx] of Object.entries(mapping)) {
      let val = raw[colIdx] ?? raw[headers[colIdx]] ?? '';
      val = String(val).trim();
      if (!val) continue;
      hasData = true;
      if (field === 'date') {
        r.date = parseDateVal(val) || r.date;
      } else if (field === 'truckId') {
        const found = trucks.find(t => {
          const tc = (t.number || '').replace(/[\s\-]/g, '').toUpperCase();
          const vc = val.replace(/[\s\-]/g, '').toUpperCase();
          return tc === vc || tc.includes(vc) || vc.includes(tc);
        });
        r.truckId = found ? found.id : val;
      } else if (field === 'partyId') {
        const vc = val.trim().toLowerCase();
        const found = parties.find(p => {
          const pc = (p.name || '').trim().toLowerCase();
          return pc === vc || pc.includes(vc) || vc.includes(pc);
        });
        r.partyId = found ? found.id : val;
      } else if (field === 'freight' || field === 'otherExpenses') {
        r[field] = parseFloat(val.replace(/[₹,\s]/g, '')) || '';
      } else {
        r[field] = val;
      }
    }
    if (hasData) rows.push(r);
  }
  return rows;
}

// ─── SmartDatePicker ─────────────────────────────────────────────────────────
function SmartDatePicker({ value, onChange }) {
  const today = todayISO();
  const yesterday = yesterdayISO();
  const base = { padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: '0.15s' };
  const active = { ...base, background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)' };
  const ghost  = { ...base, background: 'var(--bg-panel)', color: 'var(--text-muted)' };
  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
      <button type="button" style={value === today     ? active : ghost} onClick={() => onChange(today)}    >Today</button>
      <button type="button" style={value === yesterday ? active : ghost} onClick={() => onChange(yesterday)}>Yesterday</button>
      <input type="date" className="form-input" style={{ padding: '6px 10px', fontSize: '13px', width: 'auto' }}
        value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

// ─── BulkRow ─────────────────────────────────────────────────────────────────
function BulkRow({ row, idx, trucks, parties, locationSugs, onChange, onCopy, onRemove, onEnterLast, canRemove, showDate }) {
  const freight = Number(row.freight)       || 0;
  const exp     = Number(row.otherExpenses) || 0;
  const party   = parties?.find(p => p.id === row.partyId);
  const hasGst  = party && party.gst && party.gst.trim() !== '';
  const gstAmt  = hasGst ? freight * 0.18 : 0;
  const total   = freight + gstAmt + exp;
  const td  = { padding: '3px 4px' };
  const inp = { padding: '7px 8px', fontSize: '13px', borderRadius: '6px' };
  const isComplete = row.truckId && row.partyId && row.from && row.to && row.freight;

  return (
    <tr style={{ borderBottom: '1px solid var(--border)', background: isComplete ? 'transparent' : 'rgba(245,158,11,0.02)' }}>

      <td style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', width: '28px' }}>{idx + 1}</td>

      {showDate && (
        <td style={{ ...td, width: '148px' }}>
          <input type="date" className="form-input" style={{ ...inp, width: '100%' }}
            value={row.date} onChange={e => onChange(idx, 'date', e.target.value)} />
        </td>
      )}

      <td style={{ ...td, width: '170px' }}>
        <FilterableSelect
          value={row.truckId}
          onChange={v => onChange(idx, 'truckId', v)}
          options={(trucks || []).map(t => ({ value: t.id, label: t.number }))}
          placeholder="Truck…"
          style={inp}
          allowCustom={true}
        />
      </td>

      <td style={{ ...td, minWidth: '130px' }}>
        <AutocompleteInput value={row.from} onChange={v => onChange(idx, 'from', v)}
          suggestions={locationSugs} placeholder="From" className="form-input"
          inputStyle={inp} style={{ width: '100%' }} />
      </td>

      <td style={{ ...td, minWidth: '130px' }}>
        <AutocompleteInput value={row.to} onChange={v => onChange(idx, 'to', v)}
          suggestions={locationSugs} placeholder="To" className="form-input"
          inputStyle={inp} style={{ width: '100%' }} />
      </td>

      <td style={{ ...td, width: '180px' }}>
        <FilterableSelect
          value={row.partyId}
          onChange={v => onChange(idx, 'partyId', v)}
          options={(parties || []).map(p => ({ value: p.id, label: p.name }))}
          placeholder="Client…"
          style={inp}
          allowCustom={true}
        />
      </td>

      <td style={{ ...td, width: '100px' }}>
        <input type="number" className="form-input" style={{ ...inp, width: '100%' }}
          value={row.freight} placeholder="0"
          onChange={e => onChange(idx, 'freight', e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onEnterLast(idx); } }} />
      </td>

      <td style={{ ...td, width: '100px' }}>
        <input type="number" className="form-input" style={{ ...inp, width: '100%' }}
          value={row.otherExpenses} placeholder="0"
          onChange={e => onChange(idx, 'otherExpenses', e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onEnterLast(idx); } }} />
      </td>

      <td style={{ width: '90px', fontWeight: 700, fontSize: '13px', color: total > 0 ? 'var(--text-main)' : 'var(--text-muted)', whiteSpace: 'nowrap', paddingLeft: '8px' }}>
        {total > 0 ? `₹${total.toLocaleString('en-IN')}` : '—'}
        {hasGst && freight > 0 && <div style={{fontSize: '10px', color: 'var(--accent)', fontWeight: 500, marginTop: '2px'}}>+18% GST</div>}
      </td>

      <td style={{ textAlign: 'center', padding: '3px', width: '72px' }}>
        <div style={{ display: 'flex', gap: '2px', justifyContent: 'center' }}>
          <button type="button" title="Copy row" onClick={() => onCopy(idx)}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 6px', cursor: 'pointer', fontSize: '12px' }}>📋</button>
          {canRemove && (
            <button type="button" title="Remove" onClick={() => onRemove(idx)}
              style={{ background: 'none', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '4px 6px', cursor: 'pointer', fontSize: '12px', color: 'var(--red)' }}>✕</button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Trips({ data, refreshData }) {

  // 'list' | 'daily' | 'monthly'
  const [mode, setMode] = useState('list');
  const [selectedTrips, setSelectedTrips] = useState(new Set());
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);

  // ── Single-trip modal ──
  const [showModal, setShowModal]   = useState(false);
  const [editingId, setEditingId]   = useState(null);
  const [formData, setFormData]     = useState({
    date: '', truckId: '', driverId: '', partyId: '',
    from: '', to: '', freight: '', gst: '', paid: '',
    status: 'loading', notes: '', expenses: [],
  });
  const [modalLoading, setModalLoading] = useState(false);
  const [toastMsg, setToastMsg]         = useState('');

  // ── Bulk entry ──
  const [stickyDate, setStickyDate] = useState(todayISO());
  const [bulkRows, setBulkRows]     = useState([makeRow(todayISO())]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkSaved, setBulkSaved]   = useState(0);
  const [bulkStatus, setBulkStatus] = useState('delivered');

  // ── Import & WhatsApp ──
  const [showImportTools, setShowImportTools] = useState(false);
  const [importSource, setImportSource]       = useState('');  // 'csv' | 'xlsx' | 'whatsapp' | ''
  const [importCount, setImportCount]         = useState(0);
  const [waText, setWaText]           = useState('');
  const [waParsed, setWaParsed]       = useState([]);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const fileInputRef = useRef(null);

  // ── Location autocomplete (frequency-ranked) ──
  const locationSugs = useMemo(() => {
    const freq = {};
    (data.trips || []).forEach(t => {
      if (t.from) freq[t.from] = (freq[t.from] || 0) + 1;
      if (t.to)   freq[t.to]   = (freq[t.to]   || 0) + 1;
    });
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([v]) => v);
  }, [data.trips]);

  const getPartyName   = (id) => data.parties?.find(p => p.id === id)?.name   || id || '';
  const getTruckNumber = (id) => data.trucks ?.find(t => t.id === id)?.number || id || '';

  // Check if a trip is "incomplete" (missing key fields)
  const isTripIncomplete = (trip) => {
    return !trip.truckId || !trip.partyId || !trip.from || !trip.to || !trip.freight;
  };
  const getMissingFields = (trip) => {
    const missing = [];
    if (!trip.truckId) missing.push('Truck');
    if (!trip.partyId) missing.push('Client');
    if (!trip.from)    missing.push('From');
    if (!trip.to)      missing.push('To');
    if (!trip.freight)  missing.push('Freight');
    return missing;
  };

  // ── Single-trip handlers ──
  const openAdd = () => {
    setFormData({ date: todayISO(), truckId: '', driverId: '', partyId: '', from: '', to: '', freight: '', gst: '', paid: '', status: 'loading', notes: '', expenses: [] });
    setEditingId(null);
    setShowModal(true);
  };
  const openEdit = (trip) => { setFormData({ ...trip }); setEditingId(trip.id); setShowModal(true); };
  const openDuplicate = (trip) => {
    setFormData({ ...trip, id: undefined, date: todayISO(), status: 'loading' });
    setEditingId(null);
    setShowModal(true);
  };
  const closeModal = () => setShowModal(false);

  const fChange = (e) => setFormData(f => ({ ...f, [e.target.name]: e.target.value }));
  const addExp  = () => setFormData(f => ({ ...f, expenses: [...f.expenses, { type: 'Fuel', amount: '', notes: '' }] }));
  const rmExp   = (i) => { const e = [...formData.expenses]; e.splice(i, 1); setFormData(f => ({ ...f, expenses: e })); };
  const upExp   = (i, k, v) => { const e = [...formData.expenses]; e[i] = { ...e[i], [k]: v }; setFormData(f => ({ ...f, expenses: e })); };

  const resolvePartyId = async (idOrName) => {
    if (!idOrName) return '';
    // 1. Exact match on ID
    if (data.parties?.find(p => p.id === idOrName)) return idOrName;
    
    // 2. Case-insensitive match on Name
    const cleanStr = idOrName.trim().toLowerCase();
    const existing = data.parties?.find(p => (p.name || '').trim().toLowerCase() === cleanStr);
    if (existing) return existing.id;

    // 3. Create new party
    try {
      const res = await api.addParty({ name: idOrName.trim(), type: 'Client', contact: '', phone: '', terms: '', gst: '', address: '', notes: '' });
      return res.id;
    } catch (e) {
      return idOrName;
    }
  };

  const resolveTruckId = async (idOrNumber) => {
    if (!idOrNumber) return '';
    // 1. Exact match on ID
    if (data.trucks?.find(t => t.id === idOrNumber)) return idOrNumber;
    
    // 2. Case-insensitive match on Number
    const cleanStr = idOrNumber.trim().replace(/[\s\-]/g, '').toLowerCase();
    const existing = data.trucks?.find(t => (t.number || '').replace(/[\s\-]/g, '').toLowerCase() === cleanStr);
    if (existing) return existing.id;

    // 3. Create new truck
    try {
      const res = await api.addTruck({ number: idOrNumber.trim(), owner: 'Other', type: '', model: '', year: '' });
      return res.id;
    } catch (e) {
      return idOrNumber;
    }
  };

  const handleSave = async (e, addAnother = false) => {
    if (e) e.preventDefault();
    setModalLoading(true);
    try {
      const finalPartyId = await resolvePartyId(formData.partyId);
      const tripData = { ...formData, partyId: finalPartyId };
      editingId ? await api.updateTrip(editingId, tripData) : await api.addTrip(tripData);
      refreshData();
      setToastMsg(editingId ? '✓ Trip updated!' : '✓ Trip saved!');
      setTimeout(() => setToastMsg(''), 2500);
      if (addAnother && !editingId) {
        setFormData(f => ({ ...f, truckId: '', driverId: '', partyId: '', from: '', to: '', freight: '', gst: '', paid: '', status: 'loading', notes: '', expenses: [] }));
      } else {
        closeModal();
      }
    } catch { alert('Error saving trip'); }
    finally { setModalLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this trip?')) return;
    try { await api.deleteTrip(id); refreshData(); } catch { alert('Error deleting trip'); }
  };

  const handleDeleteSelected = async () => {
    if (!window.confirm(`Delete ${selectedTrips.size} selected trips?`)) return;
    try {
      await Promise.all(Array.from(selectedTrips).map(id => api.deleteTrip(id)));
      setSelectedTrips(new Set());
      refreshData();
    } catch {
      alert('Error deleting some trips');
    }
  };

  const handleStatusChangeSelected = async (newStatus) => {
    if (!window.confirm(`Change status of ${selectedTrips.size} trips to "${newStatus}"?`)) return;
    try {
      await Promise.all(Array.from(selectedTrips).map(id => api.updateTrip(id, { status: newStatus })));
      setSelectedTrips(new Set());
      refreshData();
    } catch {
      alert('Error updating some trips');
    }
  };

  const handleSelectAll = () => {
    if (selectedTrips.size === data.trips?.length && data.trips?.length > 0) {
      setSelectedTrips(new Set());
    } else {
      setSelectedTrips(new Set((data.trips || []).map(t => t.id)));
    }
  };

  // ── Bulk handlers ──
  const updateRow = (idx, field, value) => {
    setBulkRows(rows => {
      const next = [...rows];
      next[idx] = { ...next[idx], [field]: value };
      if (field === 'date') setStickyDate(value);
      return next;
    });
  };

  const addRow      = ()    => setBulkRows(rows => [...rows, makeRow(stickyDate)]);
  const copyRow     = (idx) => setBulkRows(rows => { const n = [...rows]; n.splice(idx + 1, 0, { ...rows[idx], _id: Date.now() }); return n; });
  const removeRow   = (idx) => setBulkRows(rows => rows.filter((_, i) => i !== idx));
  const onEnterLast = (idx) => { if (idx === bulkRows.length - 1) addRow(); };

  const changeStickyDate = (d) => {
    setStickyDate(d);
    // Only auto-apply to blank rows
    setBulkRows(rows => rows.map(r =>
      !r.truckId && !r.from && !r.to && !r.freight ? { ...r, date: d } : r
    ));
  };

  // Allow partial trips – any row with at least SOME data is saveable
  const savableBulkRows = bulkRows.filter(r =>
    r.truckId || r.partyId || r.from || r.to || r.freight || r.otherExpenses
  );

  const handleBulkSave = async () => {
    if (!savableBulkRows.length) { alert('Fill in at least one row with some data.'); return; }
    setBulkLoading(true);
    try {
      const resolvedRows = [];
      const partyCache = new Map(); // Cache to prevent duplicating new parties
      const truckCache = new Map(); // Cache to prevent duplicating new trucks

      for (const row of savableBulkRows) {
        let pId = row.partyId;
        if (pId) {
          const cleanStr = pId.trim().toLowerCase();
          if (partyCache.has(cleanStr)) {
            pId = partyCache.get(cleanStr);
          } else {
            pId = await resolvePartyId(row.partyId);
            partyCache.set(cleanStr, pId);
          }
        }
        
        let tId = row.truckId;
        if (tId) {
          const cleanStr = tId.trim().replace(/[\s\-]/g, '').toLowerCase();
          if (truckCache.has(cleanStr)) {
            tId = truckCache.get(cleanStr);
          } else {
            tId = await resolveTruckId(row.truckId);
            truckCache.set(cleanStr, tId);
          }
        }

        resolvedRows.push({ ...row, partyId: pId, truckId: tId });
      }

      await Promise.all(resolvedRows.map(row => api.addTrip({
        date: row.date, truckId: row.truckId, driverId: '', partyId: row.partyId,
        from: row.from, to: row.to, freight: Number(row.freight) || 0,
        gst: '', paid: 0, status: bulkStatus, notes: '',
        expenses: row.otherExpenses ? [{ type: 'Other', amount: Number(row.otherExpenses), notes: '' }] : [],
      })));
      setBulkSaved(savableBulkRows.length);
      refreshData();
      setBulkRows([makeRow(stickyDate)]);
      setImportSource('');
      setImportCount(0);
      setTimeout(() => setBulkSaved(0), 4000);
    } catch { alert('Error saving trips.'); }
    finally { setBulkLoading(false); }
  };

  // ── File Import Handler ──
  const handleFileImport = useCallback((file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'csv') {
      Papa.parse(file, {
        skipEmptyLines: true,
        complete: (result) => {
          if (!result.data || result.data.length < 2) { alert('CSV file appears empty or has no data rows.'); return; }
          const headers = result.data[0];
          const dataRows = result.data.slice(1);
          const rows = fileToRows(dataRows, headers, data.trucks || [], data.parties || []);
          if (rows.length === 0) { alert('Could not map any columns. Check your CSV headers.'); return; }
          setBulkRows(rows);
          setImportSource('csv');
          setImportCount(rows.length);
          setMode('monthly');
        },
        error: () => alert('Error reading CSV file.'),
      });
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
          if (!jsonData || jsonData.length < 2) { alert('Excel file appears empty or has no data rows.'); return; }
          const headers = jsonData[0].map(String);
          const dataRows = jsonData.slice(1);
          const rows = fileToRows(dataRows, headers, data.trucks || [], data.parties || []);
          if (rows.length === 0) { alert('Could not map any columns. Check your Excel column headers.'); return; }
          setBulkRows(rows);
          setImportSource('xlsx');
          setImportCount(rows.length);
          setMode('monthly');
        } catch { alert('Error reading Excel file. Make sure it is a valid .xlsx file.'); }
      };
      reader.readAsArrayBuffer(file);
    } else {
      alert('Unsupported file format. Please use .csv or .xlsx files.');
    }
  }, [data.trucks, data.parties]);

  const handleFileDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFileImport(file);
  }, [handleFileImport]);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) handleFileImport(file);
    e.target.value = '';
  }, [handleFileImport]);

  // ── WhatsApp Parse & Add ──
  const handleWaParse = useCallback(() => {
    const results = parseWhatsApp(waText, data.trucks || []);
    setWaParsed(results);
  }, [waText, data.trucks]);

  const handleWaAddToTable = useCallback((item) => {
    const row = makeRow(stickyDate);
    row.truckId = item.truck || '';
    row.otherExpenses = item.amount || '';
    setBulkRows(prev => [...prev.filter(r => r.truckId || r.from || r.to || r.freight || r.otherExpenses || r.partyId), row]);
    setWaParsed(prev => prev.filter(p => p._id !== item._id));
  }, [stickyDate]);

  const handleWaAddAll = useCallback(() => {
    const newRows = waParsed.map(item => {
      const row = makeRow(stickyDate);
      row.truckId = item.truck || '';
      row.otherExpenses = item.amount || '';
      return row;
    });
    setBulkRows(prev => {
      const existing = prev.filter(r => r.truckId || r.from || r.to || r.freight || r.otherExpenses || r.partyId);
      return [...existing, ...newRows];
    });
    setWaParsed([]);
    setImportSource('whatsapp');
    setImportCount(newRows.length);
  }, [waParsed, stickyDate]);

  // ── Trip list grouped by date (newest first) ──
  const groupedTrips = useMemo(() => {
    const sorted = [...(data.trips || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
    const out = {};
    sorted.forEach(t => { const d = t.date || 'Unknown'; if (!out[d]) out[d] = []; out[d].push(t); });
    return out;
  }, [data.trips]);

  // ── Date-grouped bulk rows (for monthly mode) ──
  const bulkByDate = useMemo(() => {
    const out = {};
    bulkRows.forEach((row, idx) => {
      const d = row.date || stickyDate;
      if (!out[d]) out[d] = [];
      out[d].push({ ...row, _idx: idx });
    });
    return out;
  }, [bulkRows, stickyDate]);

  // ─────────────────────────────────────────────────────────────────────────
  // BULK MODE (daily or monthly)
  // ─────────────────────────────────────────────────────────────────────────
  if (mode === 'daily' || mode === 'monthly') {
    const isMonthly = mode === 'monthly';
    const thStyle = { fontWeight: 600, fontSize: '12px', letterSpacing: '0.3px', padding: '12px 8px', color: 'var(--text-muted)' };

    return (
      <div className="page active" id="page-trips-bulk">

        {/* ── Header ── */}
        <div className="page-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div className="page-title">
              {isMonthly ? '📅 Monthly Register' : '📝 Daily Entry'}
            </div>
            <div className="page-subtitle">
              {isMonthly ? 'Bulk entry for multiple dates — group by date automatically' : 'Fast entry for today\'s trips'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Mode toggle pill */}
            <div style={{ display: 'flex', background: 'var(--bg-hover)', borderRadius: '8px', padding: '3px', gap: '2px', border: '1px solid var(--border)' }}>
              <button className={`btn btn-sm ${mode === 'daily'   ? 'btn-primary' : 'btn-ghost'}`} style={{ borderRadius: '6px' }} onClick={() => setMode('daily')}>Daily</button>
              <button className={`btn btn-sm ${mode === 'monthly' ? 'btn-primary' : 'btn-ghost'}`} style={{ borderRadius: '6px' }} onClick={() => setMode('monthly')}>Monthly</button>
            </div>
            {bulkSaved > 0 && (
              <span style={{ color: 'var(--green)', fontWeight: 700, fontSize: '14px' }}>
                ✓ {bulkSaved} trips saved!
              </span>
            )}
            <button className="btn btn-ghost" onClick={() => setMode('list')}>← Back to List</button>
            <select className="form-input" style={{ width: '130px', padding: '6px 10px', fontSize: '13px' }}
              value={bulkStatus} onChange={e => setBulkStatus(e.target.value)} title="Status for all these trips">
              <option value="loading">Loading</option>
              <option value="in-transit">In Transit</option>
              <option value="delivered">Delivered</option>
              <option value="billed">Billed</option>
              <option value="paid">Paid</option>
            </select>
            <button className="btn btn-primary" onClick={handleBulkSave} disabled={bulkLoading}>
              {bulkLoading ? 'Saving…' : `Save ${savableBulkRows.length > 0 ? `${savableBulkRows.length} ` : ''}Trips`}
            </button>
          </div>
        </div>

        <div style={{ padding: '20px 32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* ── Import Tools Bar ── */}
          <div className="section-card" style={{ padding: '14px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>📥 Import Data</span>

              {/* CSV Button */}
              <button className="btn btn-sm btn-ghost" style={{ border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
                📄 Upload CSV
                <input type="file" accept=".csv" onChange={handleFileChange}
                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
              </button>

              {/* XLSX Button */}
              <button className="btn btn-sm btn-ghost" style={{ border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
                📊 Upload Excel
                <input type="file" accept=".xlsx,.xls" onChange={handleFileChange}
                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
              </button>

              {/* WhatsApp toggle */}
              <button className={`btn btn-sm ${showWhatsApp ? 'btn-primary' : 'btn-ghost'}`}
                style={{ border: showWhatsApp ? 'none' : '1px solid rgba(37,211,102,0.4)', color: showWhatsApp ? '#fff' : '#25d366',
                         background: showWhatsApp ? '#25d366' : 'transparent' }}
                onClick={() => setShowWhatsApp(!showWhatsApp)}>
                💬 WhatsApp Paste
              </button>

              {/* Drag & Drop hint */}
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                or drag & drop a file below
              </span>
            </div>
          </div>

          {/* ── Import Preview Banner ── */}
          {importSource && importCount > 0 && (
            <div className="import-preview-banner">
              <div className="ipb-icon">{importSource === 'csv' ? '📄' : importSource === 'xlsx' ? '📊' : '💬'}</div>
              <div className="ipb-text">
                <div className="ipb-title">
                  {importCount} rows imported from {importSource === 'csv' ? 'CSV' : importSource === 'xlsx' ? 'Excel' : 'WhatsApp'}
                </div>
                <div className="ipb-sub">Review the data below, edit any fields, then click Save to commit</div>
              </div>
              <button className="btn btn-sm btn-ghost" onClick={() => { setImportSource(''); setImportCount(0); setBulkRows([makeRow(stickyDate)]); }}>
                ✕ Clear Import
              </button>
            </div>
          )}

          {/* ── WhatsApp Smart Paste Panel ── */}
          {showWhatsApp && (
            <div className="wa-panel">
              <div className="wa-panel-header">
                <span className="wa-icon">💬</span>
                <span className="wa-title">WhatsApp Smart Paste</span>
                <span className="wa-sub">Paste driver messages — we'll extract expenses automatically</span>
              </div>
              <textarea
                className="wa-textarea"
                placeholder={"Paste WhatsApp messages here…\ne.g. \"bhai toll diya 450 GJ05 mein\"\ne.g. \"diesel bhara 4200 rupay MH04 AB 1234\""}
                value={waText}
                onChange={e => setWaText(e.target.value)}
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px', alignItems: 'center' }}>
                <button className="btn btn-sm" style={{ background: '#25d366', color: '#fff', border: 'none' }}
                  onClick={handleWaParse} disabled={!waText.trim()}>
                  🔍 Parse Messages
                </button>
                {waParsed.length > 0 && (
                  <button className="btn btn-sm btn-ghost" style={{ border: '1px solid #25d366', color: '#25d366' }}
                    onClick={handleWaAddAll}>
                    ✓ Add All {waParsed.length} to Table
                  </button>
                )}
                {waParsed.length > 0 && (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    {waParsed.length} expense{waParsed.length !== 1 ? 's' : ''} found
                  </span>
                )}
              </div>

              {/* Parsed Results Cards */}
              {waParsed.length > 0 && (
                <div className="wa-parsed-results">
                  {waParsed.map((item) => (
                    <div className="wa-card" key={item._id}>
                      <span className="wa-card-type">
                        {EXPENSE_ICONS[item.typeKey] || '💰'} {item.type}
                      </span>
                      {item.amount > 0 && (
                        <span className="wa-card-amount">₹{item.amount.toLocaleString('en-IN')}</span>
                      )}
                      {item.truck && (
                        <span className="wa-card-truck">{getTruckNumber(item.truck) || item.truck}</span>
                      )}
                      <span className="wa-card-raw">"{item.raw}"</span>
                      <div className="wa-card-actions">
                        <button className="btn btn-sm" style={{ background: '#25d366', color: '#fff', border: 'none', padding: '4px 10px', fontSize: '12px' }}
                          onClick={() => handleWaAddToTable(item)}>
                          + Add
                        </button>
                        <button className="btn btn-sm btn-ghost" style={{ padding: '4px 8px', fontSize: '12px' }}
                          onClick={() => setWaParsed(prev => prev.filter(p => p._id !== item._id))}>
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Sticky Date Control ── */}
          <div className="section-card" style={{ padding: '14px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent)' }}>📌 Active Date</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>— new rows inherit this date</span>
              </div>
              <SmartDatePicker value={stickyDate} onChange={changeStickyDate} />
              <button className="btn btn-sm btn-ghost" style={{ marginLeft: 'auto', border: '1px dashed var(--border)' }}
                onClick={addRow}>
                + New Row for {fmtDate(stickyDate)}
              </button>
            </div>
          </div>

          {/* ── Table ── */}
          <div className="section-card" style={{ padding: 0, overflow: 'hidden' }}
            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
            onDragLeave={e => e.currentTarget.classList.remove('drag-over')}
            onDrop={e => { e.currentTarget.classList.remove('drag-over'); handleFileDrop(e); }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="doc-table" style={{ minWidth: isMonthly ? '1100px' : '950px', borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr style={{ background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)' }}>
                    <th style={{ ...thStyle, width: '28px', textAlign: 'center' }}>#</th>
                    {isMonthly && <th style={{ ...thStyle, width: '148px' }}>Date</th>}
                    <th style={{ ...thStyle, width: '170px' }}>Truck</th>
                    <th style={thStyle}>From</th>
                    <th style={thStyle}>To</th>
                    <th style={{ ...thStyle, width: '180px' }}>Client</th>
                    <th style={{ ...thStyle, width: '100px' }}>Freight (₹)</th>
                    <th style={{ ...thStyle, width: '100px' }}>Other Exp (₹)</th>
                    <th style={{ ...thStyle, width: '90px' }}>Total (₹)</th>
                    <th style={{ ...thStyle, width: '72px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {isMonthly
                    ? /* Monthly: render date-group headers between groups */
                      Object.entries(bulkByDate).map(([date, dateRows]) => (
                        <React.Fragment key={date}>
                          {/* Date group separator */}
                          <tr>
                            <td colSpan={11} style={{
                              padding: '10px 16px',
                              background: 'linear-gradient(90deg, rgba(139,92,246,0.07) 0%, transparent 80%)',
                              borderTop: '2px solid rgba(139,92,246,0.25)',
                              borderBottom: '1px solid var(--border)',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '13px' }}>
                                  ── {fmtDateLong(date)}
                                </span>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                  {dateRows.length} {dateRows.length === 1 ? 'trip' : 'trips'} · ₹{dateRows.reduce((s, r) => s + (Number(r.freight) || 0), 0).toLocaleString('en-IN')} freight
                                </span>
                                <button type="button" className="btn btn-sm btn-ghost"
                                  style={{ marginLeft: 'auto', fontSize: '11px', padding: '3px 8px', border: '1px dashed var(--border)' }}
                                  onClick={() => setBulkRows(rows => [...rows, makeRow(date)])}>
                                  + Add for {fmtDate(date)}
                                </button>
                              </div>
                            </td>
                          </tr>
                          {dateRows.map(row => (
                            <BulkRow key={row._id} row={row} idx={row._idx}
                              trucks={data.trucks} parties={data.parties}
                              locationSugs={locationSugs}
                              onChange={updateRow} onCopy={copyRow} onRemove={removeRow}
                              onEnterLast={onEnterLast} canRemove={bulkRows.length > 1}
                              showDate={true} />
                          ))}
                        </React.Fragment>
                      ))
                    : /* Daily: plain rows, no date column */
                      bulkRows.map((row, idx) => (
                        <BulkRow key={row._id} row={row} idx={idx}
                          trucks={data.trucks} parties={data.parties}
                          locationSugs={locationSugs}
                          onChange={updateRow} onCopy={copyRow} onRemove={removeRow}
                          onEnterLast={onEnterLast} canRemove={bulkRows.length > 1}
                          showDate={false} />
                      ))
                  }
                </tbody>
              </table>
            </div>

            {/* Footer totals + Add Row */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button type="button" className="btn btn-ghost"
                onClick={addRow}
                style={{ border: '1px dashed var(--border)', flex: 1, color: 'var(--text-muted)' }}>
                + Add Row
              </button>
              {savableBulkRows.length > 0 && (
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  <strong style={{ color: 'var(--text-main)' }}>{savableBulkRows.length}</strong> savable rows ·{' '}
                  <strong style={{ color: 'var(--accent)' }}>
                    ₹{savableBulkRows.reduce((s, r) => s + (Number(r.freight) || 0) + (Number(r.otherExpenses) || 0), 0).toLocaleString('en-IN')}
                  </strong> total
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LIST VIEW
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="page active" id="page-trips">

      {/* Header */}
      <div className="page-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div className="page-title">Trips</div>
          <div className="page-subtitle">{data.trips?.length || 0} total trips</div>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {/* Import buttons directly on list view too */}
          <button className="btn btn-ghost" style={{ border: '1px solid var(--border)', position: 'relative', overflow: 'hidden', fontSize: '13px' }}>
            📄 Import CSV
            <input type="file" accept=".csv" onChange={handleFileChange}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
          </button>
          <button className="btn btn-ghost" style={{ border: '1px solid var(--border)', position: 'relative', overflow: 'hidden', fontSize: '13px' }}>
            📊 Import Excel
            <input type="file" accept=".xlsx,.xls" onChange={handleFileChange}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
          </button>

          <button className="btn btn-ghost" style={{ border: '1px solid var(--border)' }}
            onClick={() => { setStickyDate(todayISO()); setBulkRows([makeRow(todayISO())]); setMode('daily'); }}>
            📝 Daily Entry
          </button>
          <button className="btn btn-ghost" style={{ border: '1px solid var(--accent)', color: 'var(--accent)' }}
            onClick={() => { setStickyDate(todayISO()); setBulkRows([makeRow(todayISO())]); setMode('monthly'); }}>
            📅 Monthly Register
          </button>
          <button className="btn btn-ghost" style={{ border: '1px solid var(--border)' }}
            onClick={() => { setIsMultiSelect(!isMultiSelect); if(isMultiSelect) setSelectedTrips(new Set()); }}>
            {isMultiSelect ? 'Cancel Multi-select' : '☑ Multi-select'}
          </button>
          {isMultiSelect && data.trips && data.trips.length > 0 && (
            <button className="btn btn-ghost" style={{ border: '1px solid var(--border)' }} onClick={handleSelectAll}>
              {selectedTrips.size === data.trips.length ? 'Deselect All' : 'Select All'}
            </button>
          )}
          {isMultiSelect && selectedTrips.size > 0 && (
            <>
              <select className="form-input" style={{ width: '140px', padding: '6px 10px', fontSize: '13px', background: 'var(--bg-panel)' }}
                onChange={(e) => {
                  if(e.target.value) handleStatusChangeSelected(e.target.value);
                  e.target.value = "";
                }}>
                <option value="">Change Status...</option>
                <option value="loading">Loading</option>
                <option value="in-transit">In Transit</option>
                <option value="delivered">Delivered</option>
                <option value="billed">Billed</option>
                <option value="paid">Paid</option>
              </select>
              <button className="btn btn-primary" style={{ background: 'var(--red)', borderColor: 'var(--red)' }} onClick={handleDeleteSelected}>
                ✕ Delete ({selectedTrips.size})
              </button>
            </>
          )}
          <button className="btn btn-primary" onClick={openAdd}>+ Single Trip</button>
        </div>
      </div>

      <div className="page-content">
        {Object.keys(groupedTrips).length === 0 ? (
          <div className="section-card" style={{ textAlign: 'center', padding: '56px 32px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛣️</div>
            <div style={{ fontWeight: 700, fontSize: '18px', marginBottom: '8px', color: 'var(--text-main)' }}>No trips yet</div>
            <div style={{ fontSize: '14px', marginBottom: '20px' }}>Use Daily Entry or Monthly Register to add trips quickly</div>

            {/* Drop zone for first-time import */}
            <div className="drop-zone" style={{ maxWidth: '500px', margin: '0 auto' }}
              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
              onDragLeave={e => e.currentTarget.classList.remove('drag-over')}
              onDrop={e => { e.currentTarget.classList.remove('drag-over'); handleFileDrop(e); }}>
              <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileChange} />
              <div className="drop-zone-icon">📥</div>
              <div className="drop-zone-text">Drop a CSV or Excel file here to import</div>
              <div className="drop-zone-sub">Or click to browse — columns like Date, Truck, From, To, Freight will be auto-mapped</div>
            </div>
          </div>
        ) : (
          Object.entries(groupedTrips).map(([date, trips]) => {
            const dayFreight = trips.reduce((s, t) => s + Number(t.freight || 0), 0);
            return (
              <div key={date} style={{ marginBottom: '24px' }}>
                {/* Date header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(139,92,246,0.05))',
                    border: '1px solid rgba(139,92,246,0.25)',
                    borderRadius: '20px', padding: '4px 14px',
                    fontWeight: 700, fontSize: '13px', color: 'var(--accent)',
                  }}>
                    {fmtDateLong(date)}
                  </div>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
                    {trips.length} trip{trips.length > 1 ? 's' : ''} · ₹{dayFreight.toLocaleString('en-IN')}
                  </div>
                </div>

                {/* Trips for this date */}
                <div className="section-card" style={{ padding: 0, overflow: 'hidden' }}>
                  {trips.map((trip, i) => {
                    const incomplete = isTripIncomplete(trip);
                    const missing = incomplete ? getMissingFields(trip) : [];
                    const party = data.parties?.find(p => p.id === trip.partyId);
                    const hasGst = party && party.gst && party.gst.trim() !== '';
                    const freightVal = Number(trip.freight) || 0;
                    const gstVal = hasGst ? freightVal * 0.18 : 0;
                    const expVal = (trip.expenses || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
                    const totalVal = freightVal + gstVal + expVal;

                    return (
                      <div key={trip.id} className={`list-item ${incomplete ? 'trip-incomplete' : ''}`}
                        style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', borderBottom: i < trips.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        {isMultiSelect && (
                          <input type="checkbox"
                            checked={selectedTrips.has(trip.id)}
                            onChange={(e) => {
                              const newSet = new Set(selectedTrips);
                              if (e.target.checked) newSet.add(trip.id);
                              else newSet.delete(trip.id);
                              setSelectedTrips(newSet);
                            }}
                            style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--accent)' }}
                          />
                        )}
                        <div className="li-left" style={{ flex: '1 1 260px' }}>
                          <div className="li-icon" style={{ background: incomplete ? 'rgba(245,158,11,0.1)' : 'rgba(139,92,246,0.08)', color: incomplete ? 'var(--yellow)' : 'var(--accent)' }}>
                            {incomplete ? '⚠️' : '🛣️'}
                          </div>
                          <div>
                            <div className="li-title">
                              {trip.from && trip.to ? `${trip.from} → ${trip.to}` : trip.from || trip.to || 'Route not set'}
                            </div>
                            <div className="li-sub">
                              {getPartyName(trip.partyId) || 'No client'} · {getTruckNumber(trip.truckId) || 'No truck'}
                            </div>
                            {incomplete && (
                              <div className="incomplete-badge" style={{ marginTop: '4px' }}>
                                Missing: {missing.join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="li-right" style={{ minWidth: '120px' }}>
                          <div className="li-val" style={{ fontSize: '15px' }}>
                            {totalVal > 0 ? `₹${totalVal.toLocaleString('en-IN')}` : '₹ —'}
                          </div>
                          {hasGst && freightVal > 0 && <div style={{fontSize: '11px', color: 'var(--accent)', fontWeight: 700, marginBottom: '4px'}}>+18% GST</div>}
                          <div className={`badge ${trip.status}`}>{trip.status}</div>
                        </div>
                        <div style={{ position: 'relative' }}>
                          <button className="btn btn-sm btn-ghost" style={{ padding: '2px 8px', fontSize: 18, fontWeight: 'bold' }}
                            onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === trip.id ? null : trip.id); }}>⋮</button>
                          {openMenuId === trip.id && (
                            <div style={{ position: 'absolute', top: '100%', right: 0, background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 10, padding: 4, display: 'flex', flexDirection: 'column', minWidth: 100 }}>
                              {incomplete && (
                                <button className="btn btn-sm btn-ghost" style={{ textAlign: 'left', width: '100%', color: 'var(--yellow)' }} onClick={() => { setOpenMenuId(null); openEdit(trip); }}>Fill Details</button>
                              )}
                              <button className="btn btn-sm btn-ghost" style={{ textAlign: 'left', width: '100%' }} onClick={() => { setOpenMenuId(null); openDuplicate(trip); }}>Copy</button>
                              <button className="btn btn-sm btn-ghost" style={{ textAlign: 'left', width: '100%' }} onClick={() => { setOpenMenuId(null); openEdit(trip); }}>Edit</button>
                              <button className="btn btn-sm btn-ghost" style={{ textAlign: 'left', width: '100%', color: 'var(--red)' }} onClick={() => { setOpenMenuId(null); handleDelete(trip.id); }}>Delete</button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Single Trip Modal */}
      {showModal && (
        <div className="modal-overlay active">
          <div className="modal" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <div className="modal-title">{editingId ? 'Edit Trip' : 'Add Single Trip'}</div>
              <button className="modal-close" onClick={closeModal}>&times;</button>
            </div>
            <form onSubmit={handleSave} className="modal-body">
              <div className="form-grid">

                {/* Date with shortcuts */}
                <div className="form-group full-width">
                  <label className="form-label">Date</label>
                  <SmartDatePicker value={formData.date} onChange={d => setFormData(f => ({ ...f, date: d }))} />
                </div>

                <div className="form-group">
                  <label className="form-label">Truck</label>
                  <FilterableSelect
                    value={formData.truckId}
                    onChange={v => setFormData(f => ({ ...f, truckId: v }))}
                    options={(data.trucks || []).map(t => ({ value: t.id, label: t.number }))}
                    placeholder="Select Truck"
                    allowCustom={true}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Driver</label>
                  <select name="driverId" value={formData.driverId} onChange={fChange} className="form-input">
                    <option value="">Select Driver</option>
                    {data.drivers?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="form-group full-width">
                  <label className="form-label">Client / Party</label>
                  <FilterableSelect
                    value={formData.partyId}
                    onChange={v => setFormData(f => ({ ...f, partyId: v }))}
                    options={(data.parties || []).map(p => ({ value: p.id, label: p.name }))}
                    placeholder="Select Party"
                    allowCustom={true}
                  />
                </div>

                {/* Autocomplete From/To */}
                <div className="form-group">
                  <label className="form-label">From</label>
                  <AutocompleteInput value={formData.from} onChange={v => setFormData(f => ({ ...f, from: v }))}
                    suggestions={locationSugs} placeholder="Origin city" className="form-input" />
                </div>
                <div className="form-group">
                  <label className="form-label">To</label>
                  <AutocompleteInput value={formData.to} onChange={v => setFormData(f => ({ ...f, to: v }))}
                    suggestions={locationSugs} placeholder="Destination city" className="form-input" />
                </div>

                <div className="form-group">
                  <label className="form-label">Freight (₹)</label>
                  <input type="number" name="freight" value={formData.freight} onChange={fChange} className="form-input" placeholder="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select name="status" value={formData.status} onChange={fChange} className="form-input">
                    <option value="loading">Loading</option>
                    <option value="in-transit">In Transit</option>
                    <option value="delivered">Delivered</option>
                    <option value="billed">Billed</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Advance Paid (₹)</label>
                  <input type="number" name="paid" value={formData.paid} onChange={fChange} className="form-input" placeholder="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">GST</label>
                  <input type="text" name="gst" value={formData.gst} onChange={fChange} className="form-input" placeholder="e.g. 18%" />
                </div>

                <div className="form-group full-width">
                  <div className="divider" />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ fontWeight: 600 }}>Expenses</div>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={addExp}>+ Add</button>
                  </div>
                  {formData.expenses.map((exp, i) => (
                    <div key={i} className="expense-row">
                      <select value={exp.type} onChange={e => upExp(i, 'type', e.target.value)} className="form-input" style={{ padding: '8px' }}>
                        <option>Fuel</option><option>Toll</option><option>Police</option><option>Repair</option><option>Other</option>
                      </select>
                      <input type="number" value={exp.amount} onChange={e => upExp(i, 'amount', e.target.value)} className="form-input" placeholder="₹" style={{ padding: '8px' }} />
                      <input type="text" value={exp.notes} onChange={e => upExp(i, 'notes', e.target.value)} className="form-input" placeholder="Notes" style={{ padding: '8px' }} />
                      <button type="button" className="btn-remove" onClick={() => rmExp(i)}>&times;</button>
                    </div>
                  ))}
                  {formData.expenses.length === 0 && <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No expenses</div>}
                  <div className="divider" />
                </div>

                <div className="form-group full-width">
                  <label className="form-label">Notes</label>
                  <input name="notes" value={formData.notes} onChange={fChange} className="form-input" placeholder="Any notes…" />
                </div>
              </div>

              <div className="form-actions">
                {toastMsg && <span style={{ marginRight: 'auto', color: 'var(--green)', fontWeight: 700 }}>{toastMsg}</span>}
                <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancel</button>
                {!editingId && (
                  <button type="button" className="btn btn-ghost" style={{ border: '1px solid var(--border)' }}
                    onClick={e => handleSave(e, true)} disabled={modalLoading}>
                    {modalLoading ? '…' : 'Save & Add Another'}
                  </button>
                )}
                <button type="submit" className="btn btn-primary" disabled={modalLoading}>
                  {modalLoading ? 'Saving…' : editingId ? 'Update Trip' : 'Save Trip'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
