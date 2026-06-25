const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'transportos.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        
        // Initialize tables
        db.serialize(() => {
            // Trucks
            db.run(`CREATE TABLE IF NOT EXISTS trucks (
                id TEXT PRIMARY KEY,
                number TEXT NOT NULL,
                model TEXT,
                year INTEGER,
                owner TEXT,
                type TEXT
            )`);

            // Drivers
            db.run(`CREATE TABLE IF NOT EXISTS drivers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                phone TEXT,
                license TEXT,
                joining TEXT,
                salary REAL,
                balance REAL DEFAULT 0,
                address TEXT
            )`);

            // Parties
            db.run(`CREATE TABLE IF NOT EXISTS parties (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                contact TEXT,
                phone TEXT,
                type TEXT,
                terms TEXT,
                gst TEXT,
                address TEXT,
                notes TEXT
            )`);

            // Trips
            db.run(`CREATE TABLE IF NOT EXISTS trips (
                id TEXT PRIMARY KEY,
                date TEXT,
                truckId TEXT,
                driverId TEXT,
                partyId TEXT,
                "from" TEXT,
                "to" TEXT,
                freight REAL,
                gst TEXT,
                paid REAL DEFAULT 0,
                status TEXT,
                notes TEXT,
                expenses TEXT
            )`);

            // Documents
            db.run(`CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                truckId TEXT,
                type TEXT,
                expiry TEXT,
                number TEXT
            )`);

            // Driver Advances
            db.run(`CREATE TABLE IF NOT EXISTS driver_advances (
                id TEXT PRIMARY KEY,
                driverId TEXT,
                date TEXT,
                type TEXT,
                amount REAL,
                reason TEXT
            )`);

            // Overheads & Extras
            db.run(`CREATE TABLE IF NOT EXISTS overheads (
                id TEXT PRIMARY KEY,
                date TEXT NOT NULL,
                category TEXT NOT NULL,
                amount REAL NOT NULL,
                notes TEXT
            )`);

            // Insurance
            db.run(`CREATE TABLE IF NOT EXISTS insurance (
                id TEXT PRIMARY KEY,
                truckId TEXT NOT NULL,
                insurer TEXT,
                policyNumber TEXT,
                startDate TEXT,
                expiryDate TEXT NOT NULL,
                premium REAL DEFAULT 0,
                notes TEXT,
                policyFile TEXT
            )`);

            // Bill Sequences
            db.run(`CREATE TABLE IF NOT EXISTS bill_sequences (
                companyType TEXT,
                financialYear TEXT,
                lastNumber INTEGER DEFAULT 0,
                PRIMARY KEY (companyType, financialYear)
            )`);
        });
    }
});

module.exports = db;
