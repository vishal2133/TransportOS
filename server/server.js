const express = require('express');
const cors = require('cors');
const db = require('./db');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Helper function to generate IDs if not provided
const generateId = () => Math.random().toString(36).substr(2, 9);

// --- TRUCKS ---
app.get('/api/trucks', (req, res) => {
    db.all(`SELECT * FROM trucks`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/trucks', (req, res) => {
    const { number, model, year, owner, type } = req.body;
    const id = req.body.id || generateId();
    db.run(`INSERT INTO trucks (id, number, model, year, owner, type) VALUES (?, ?, ?, ?, ?, ?)`,
        [id, number, model, year, owner, type],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id, number, model, year, owner, type });
        });
});

app.put('/api/trucks/:id', (req, res) => {
    const { number, model, year, owner, type } = req.body;
    db.run(`UPDATE trucks SET number=?, model=?, year=?, owner=?, type=? WHERE id=?`,
        [number, model, year, owner, type, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: req.params.id, number, model, year, owner, type });
        });
});

app.delete('/api/trucks/:id', (req, res) => {
    db.run(`DELETE FROM trucks WHERE id=?`, req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes > 0 });
    });
});

// --- DRIVERS ---
app.get('/api/drivers', (req, res) => {
    db.all(`SELECT * FROM drivers`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/drivers', (req, res) => {
    const { name, phone, license, joining, salary, balance, address } = req.body;
    const id = req.body.id || generateId();
    db.run(`INSERT INTO drivers (id, name, phone, license, joining, salary, balance, address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, name, phone, license, joining, salary, balance || 0, address],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id, name, phone, license, joining, salary, balance, address });
        });
});

app.put('/api/drivers/:id', (req, res) => {
    const { name, phone, license, joining, salary, balance, address } = req.body;
    db.run(`UPDATE drivers SET name=?, phone=?, license=?, joining=?, salary=?, balance=?, address=? WHERE id=?`,
        [name, phone, license, joining, salary, balance, address, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: req.params.id, name, phone, license, joining, salary, balance, address });
        });
});

app.delete('/api/drivers/:id', (req, res) => {
    db.run(`DELETE FROM drivers WHERE id=?`, req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes > 0 });
    });
});

// --- PARTIES ---
app.get('/api/parties', (req, res) => {
    db.all(`SELECT * FROM parties`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/parties', (req, res) => {
    const { name, contact, phone, type, terms, gst, address, notes } = req.body;
    const id = req.body.id || generateId();
    db.run(`INSERT INTO parties (id, name, contact, phone, type, terms, gst, address, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, name, contact, phone, type, terms, gst, address, notes],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id, name, contact, phone, type, terms, gst, address, notes });
        });
});

app.put('/api/parties/:id', (req, res) => {
    const { name, contact, phone, type, terms, gst, address, notes } = req.body;
    db.run(`UPDATE parties SET name=?, contact=?, phone=?, type=?, terms=?, gst=?, address=?, notes=? WHERE id=?`,
        [name, contact, phone, type, terms, gst, address, notes, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: req.params.id, name, contact, phone, type, terms, gst, address, notes });
        });
});

app.delete('/api/parties/:id', (req, res) => {
    db.run(`DELETE FROM parties WHERE id=?`, req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes > 0 });
    });
});

// --- TRIPS ---
app.get('/api/trips', (req, res) => {
    db.all(`SELECT * FROM trips`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        // Parse expenses JSON string back to array
        const trips = rows.map(t => ({
            ...t,
            expenses: t.expenses ? JSON.parse(t.expenses) : []
        }));
        res.json(trips);
    });
});

app.post('/api/trips', (req, res) => {
    const { date, truckId, driverId, partyId, from, to, freight, gst, paid, status, notes, expenses } = req.body;
    const id = req.body.id || generateId();
    const expensesStr = JSON.stringify(expenses || []);
    
    db.run(`INSERT INTO trips (id, date, truckId, driverId, partyId, "from", "to", freight, gst, paid, status, notes, expenses) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, date, truckId, driverId, partyId, from, to, freight, gst, paid || 0, status, notes, expensesStr],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id, date, truckId, driverId, partyId, from, to, freight, gst, paid, status, notes, expenses });
        });
});

app.put('/api/trips/:id', (req, res) => {
    const { date, truckId, driverId, partyId, from, to, freight, gst, paid, status, notes, expenses } = req.body;
    const expensesStr = JSON.stringify(expenses || []);

    db.run(`UPDATE trips SET date=?, truckId=?, driverId=?, partyId=?, "from"=?, "to"=?, freight=?, gst=?, paid=?, status=?, notes=?, expenses=? WHERE id=?`,
        [date, truckId, driverId, partyId, from, to, freight, gst, paid, status, notes, expensesStr, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: req.params.id, date, truckId, driverId, partyId, from, to, freight, gst, paid, status, notes, expenses });
        });
});

app.delete('/api/trips/:id', (req, res) => {
    db.run(`DELETE FROM trips WHERE id=?`, req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes > 0 });
    });
});

// --- DOCUMENTS ---
app.get('/api/documents', (req, res) => {
    db.all(`SELECT * FROM documents`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/documents', (req, res) => {
    const { truckId, type, expiry, number } = req.body;
    const id = req.body.id || generateId();
    db.run(`INSERT INTO documents (id, truckId, type, expiry, number) VALUES (?, ?, ?, ?, ?)`,
        [id, truckId, type, expiry, number],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id, truckId, type, expiry, number });
        });
});

app.put('/api/documents/:id', (req, res) => {
    const { truckId, type, expiry, number } = req.body;
    db.run(`UPDATE documents SET truckId=?, type=?, expiry=?, number=? WHERE id=?`,
        [truckId, type, expiry, number, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: req.params.id, truckId, type, expiry, number });
        });
});

app.delete('/api/documents/:id', (req, res) => {
    db.run(`DELETE FROM documents WHERE id=?`, req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes > 0 });
    });
});

// --- DRIVER ADVANCES ---
app.get('/api/advances', (req, res) => {
    db.all(`SELECT * FROM driver_advances`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/advances', (req, res) => {
    const { driverId, date, type, amount, reason } = req.body;
    const id = req.body.id || generateId();
    db.run(`INSERT INTO driver_advances (id, driverId, date, type, amount, reason) VALUES (?, ?, ?, ?, ?, ?)`,
        [id, driverId, date, type, amount, reason],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id, driverId, date, type, amount, reason });
        });
});

app.delete('/api/advances/:id', (req, res) => {
    db.run(`DELETE FROM driver_advances WHERE id=?`, req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes > 0 });
    });
});

// --- OVERHEADS ---
app.get('/api/overheads', (req, res) => {
    db.all(`SELECT * FROM overheads ORDER BY date DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/overheads', (req, res) => {
    const { date, category, amount, notes } = req.body;
    const id = req.body.id || generateId();
    db.run(`INSERT INTO overheads (id, date, category, amount, notes) VALUES (?, ?, ?, ?, ?)`,
        [id, date, category, amount, notes],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id, date, category, amount, notes });
        });
});

app.put('/api/overheads/:id', (req, res) => {
    const { date, category, amount, notes } = req.body;
    db.run(`UPDATE overheads SET date=?, category=?, amount=?, notes=? WHERE id=?`,
        [date, category, amount, notes, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: req.params.id, date, category, amount, notes });
        });
});

app.delete('/api/overheads/:id', (req, res) => {
    db.run(`DELETE FROM overheads WHERE id=?`, req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes > 0 });
    });
});


// --- INSURANCE ---
app.get('/api/insurance', (req, res) => {
    db.all(`SELECT id, truckId, insurer, policyNumber, startDate, expiryDate, premium, notes, CASE WHEN policyFile IS NOT NULL THEN 1 ELSE 0 END as hasFile FROM insurance ORDER BY expiryDate ASC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/insurance', (req, res) => {
    const { truckId, insurer, policyNumber, startDate, expiryDate, premium, notes } = req.body;
    const id = req.body.id || generateId();
    db.run(`INSERT INTO insurance (id, truckId, insurer, policyNumber, startDate, expiryDate, premium, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, truckId, insurer, policyNumber, startDate, expiryDate, premium || 0, notes],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id, truckId, insurer, policyNumber, startDate, expiryDate, premium, notes, hasFile: 0 });
        });
});

app.put('/api/insurance/:id', (req, res) => {
    const { truckId, insurer, policyNumber, startDate, expiryDate, premium, notes } = req.body;
    db.run(`UPDATE insurance SET truckId=?, insurer=?, policyNumber=?, startDate=?, expiryDate=?, premium=?, notes=? WHERE id=?`,
        [truckId, insurer, policyNumber, startDate, expiryDate, premium || 0, notes, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: req.params.id, truckId, insurer, policyNumber, startDate, expiryDate, premium, notes });
        });
});

app.delete('/api/insurance/:id', (req, res) => {
    db.run(`DELETE FROM insurance WHERE id=?`, req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes > 0 });
    });
});

// File upload / fetch endpoints for Insurance
app.get('/api/insurance/:id/file', (req, res) => {
    db.get(`SELECT policyFile FROM insurance WHERE id=?`, [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row || !row.policyFile) return res.status(404).json({ error: 'File not found' });
        res.json({ file: row.policyFile });
    });
});

app.put('/api/insurance/:id/file', (req, res) => {
    const { file } = req.body; // Expecting Base64 string
    db.run(`UPDATE insurance SET policyFile=? WHERE id=?`,
        [file, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, hasFile: 1 });
        });
});


app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
