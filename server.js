const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || '/data';
const DB_PATH = path.join(DATA_DIR, 'gsctracker.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize database
const db = new Database(DB_PATH);

// Create sales table if it doesn't exist
db.exec(`
    CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cookieType TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        customerName TEXT NOT NULL,
        date TEXT NOT NULL
    )
`);

// Rate limiting middleware
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});

// Middleware
app.use(cors());
app.use(express.json());
app.use('/api/', limiter); // Apply rate limiting to all API routes
app.use(express.static('public'));

// API Routes

// Get all sales
app.get('/api/sales', (req, res) => {
    try {
        const sales = db.prepare('SELECT * FROM sales ORDER BY id DESC').all();
        res.json(sales);
    } catch (error) {
        console.error('Error fetching sales:', error);
        res.status(500).json({ error: 'Failed to fetch sales' });
    }
});

// Add a new sale
app.post('/api/sales', (req, res) => {
    try {
        const { cookieType, quantity, customerName, date } = req.body;
        
        if (!cookieType || !quantity || quantity < 1) {
            return res.status(400).json({ error: 'Invalid sale data' });
        }
        
        // Validate and sanitize customerName
        const sanitizedCustomerName = (customerName && customerName.trim()) || 'Walk-in Customer';
        
        // Validate and use current date if not provided or invalid
        let saleDate = date;
        if (!saleDate || isNaN(new Date(saleDate).getTime())) {
            saleDate = new Date().toISOString();
        }
        
        const stmt = db.prepare('INSERT INTO sales (cookieType, quantity, customerName, date) VALUES (?, ?, ?, ?)');
        const result = stmt.run(cookieType, quantity, sanitizedCustomerName, saleDate);
        
        const newSale = db.prepare('SELECT * FROM sales WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(newSale);
    } catch (error) {
        console.error('Error adding sale:', error);
        res.status(500).json({ error: 'Failed to add sale' });
    }
});

// Delete a sale
app.delete('/api/sales/:id', (req, res) => {
    try {
        const { id } = req.params;
        const stmt = db.prepare('DELETE FROM sales WHERE id = ?');
        const result = stmt.run(id);
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Sale not found' });
        }
        
        res.json({ message: 'Sale deleted successfully' });
    } catch (error) {
        console.error('Error deleting sale:', error);
        res.status(500).json({ error: 'Failed to delete sale' });
    }
});

// Clear all sales
app.delete('/api/sales', (req, res) => {
    try {
        db.prepare('DELETE FROM sales').run();
        res.json({ message: 'All sales cleared successfully' });
    } catch (error) {
        console.error('Error clearing sales:', error);
        res.status(500).json({ error: 'Failed to clear sales' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', database: 'connected' });
});

// Graceful shutdown
let isShuttingDown = false;

function shutdown(signal) {
    if (isShuttingDown) {
        return;
    }
    isShuttingDown = true;
    
    console.log(`${signal} received, closing database...`);
    db.close();
    process.exitCode = 0;
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`GSCTracker server running on port ${PORT}`);
    console.log(`Database location: ${DB_PATH}`);
});
