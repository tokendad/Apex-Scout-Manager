const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || '/data';
const DB_PATH = path.join(DATA_DIR, 'gsctracker.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    logger.info('Created data directory', { path: DATA_DIR });
}

// Initialize database
let db;
try {
    db = new Database(DB_PATH);
    logger.info('Database initialized successfully', { path: DB_PATH });
} catch (error) {
    logger.error('Failed to initialize database', { error: error.message, stack: error.stack, path: DB_PATH });
    process.exit(1);
}

// Create tables if they don't exist
try {
    db.exec(`
        CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cookieType TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            customerName TEXT NOT NULL,
            date TEXT NOT NULL,
            saleType TEXT DEFAULT 'individual',
            customerAddress TEXT,
            customerPhone TEXT,
            unitType TEXT DEFAULT 'box',
            amountCollected REAL DEFAULT 0,
            amountDue REAL DEFAULT 0,
            paymentMethod TEXT
        );

        CREATE TABLE IF NOT EXISTS profile (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            photoData TEXT,
            qrCodeUrl TEXT,
            goalBoxes INTEGER DEFAULT 0,
            goalAmount REAL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS donations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            amount REAL NOT NULL,
            donorName TEXT NOT NULL,
            date TEXT NOT NULL
        );

        INSERT OR IGNORE INTO profile (id, goalBoxes, goalAmount) VALUES (1, 0, 0);
    `);
    
    // Migration: Add saleType column to existing sales table if it doesn't exist
    const tableInfo = db.prepare("PRAGMA table_info(sales)").all();
    const hasSaleType = tableInfo.some(col => col.name === 'saleType');
    if (!hasSaleType) {
        db.exec(`ALTER TABLE sales ADD COLUMN saleType TEXT DEFAULT 'individual'`);
        logger.info('Migration: Added saleType column to sales table');
    }
    
    // Migration: Add new individual sales columns if they don't exist
    const columnsToAdd = [
        { name: 'customerAddress', type: 'TEXT', default: null },
        { name: 'customerPhone', type: 'TEXT', default: null },
        { name: 'unitType', type: 'TEXT', default: "'box'" },
        { name: 'amountCollected', type: 'REAL', default: '0' },
        { name: 'amountDue', type: 'REAL', default: '0' },
        { name: 'paymentMethod', type: 'TEXT', default: null }
    ];
    
    for (const column of columnsToAdd) {
        const hasColumn = tableInfo.some(col => col.name === column.name);
        if (!hasColumn) {
            const defaultClause = column.default ? ` DEFAULT ${column.default}` : '';
            db.exec(`ALTER TABLE sales ADD COLUMN ${column.name} ${column.type}${defaultClause}`);
            logger.info(`Migration: Added ${column.name} column to sales table`);
        }
    }
    
    logger.info('Database tables initialized');
} catch (error) {
    logger.error('Failed to create database tables', { error: error.message, stack: error.stack });
    process.exit(1);
}

// Rate limiting middleware
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});

// Request logging middleware
app.use((req, res, next) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        // Use explicit conditionals for log level to prevent injection
        const logLevel = res.statusCode >= 500 ? 'error' : (res.statusCode >= 400 ? 'warn' : 'info');
        logger[logLevel]('HTTP Request', {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip
        });
    });
    
    next();
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
        logger.error('Error fetching sales', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to fetch sales' });
    }
});

// Add a new sale
app.post('/api/sales', (req, res) => {
    try {
        const { 
            cookieType, 
            quantity, 
            customerName, 
            date, 
            saleType,
            customerAddress,
            customerPhone,
            unitType,
            amountCollected,
            amountDue,
            paymentMethod
        } = req.body;
        
        if (!cookieType || !quantity || quantity < 1) {
            logger.warn('Invalid sale data received', { cookieType, quantity });
            return res.status(400).json({ error: 'Invalid sale data' });
        }
        
        // Validate and sanitize customerName
        const sanitizedCustomerName = (customerName && customerName.trim()) || 'Walk-in Customer';
        
        // Validate saleType (individual or event)
        const validSaleType = (saleType === 'event') ? 'event' : 'individual';
        
        // Validate and use current date if not provided or invalid
        let saleDate = date;
        if (!saleDate || isNaN(new Date(saleDate).getTime())) {
            saleDate = new Date().toISOString();
        }
        
        // Validate and sanitize new fields
        const sanitizedCustomerAddress = (customerAddress && customerAddress.trim()) || null;
        const sanitizedCustomerPhone = (customerPhone && customerPhone.trim()) || null;
        const validUnitType = (unitType === 'case') ? 'case' : 'box';
        const validAmountCollected = (typeof amountCollected === 'number' && amountCollected >= 0) ? amountCollected : 0;
        const validAmountDue = (typeof amountDue === 'number' && amountDue >= 0) ? amountDue : 0;
        const validPaymentMethod = paymentMethod || null;
        
        const stmt = db.prepare(`
            INSERT INTO sales (
                cookieType, quantity, customerName, date, saleType,
                customerAddress, customerPhone, unitType, 
                amountCollected, amountDue, paymentMethod
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
            cookieType, quantity, sanitizedCustomerName, saleDate, validSaleType,
            sanitizedCustomerAddress, sanitizedCustomerPhone, validUnitType,
            validAmountCollected, validAmountDue, validPaymentMethod
        );
        
        const newSale = db.prepare('SELECT * FROM sales WHERE id = ?').get(result.lastInsertRowid);
        logger.info('Sale added successfully', { saleId: newSale.id, cookieType, quantity, saleType: validSaleType });
        res.status(201).json(newSale);
    } catch (error) {
        // Log error without sensitive request body data
        logger.error('Error adding sale', { error: error.message, stack: error.stack });
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
            logger.warn('Attempted to delete non-existent sale', { saleId: id });
            return res.status(404).json({ error: 'Sale not found' });
        }
        
        logger.info('Sale deleted successfully', { saleId: id });
        res.json({ message: 'Sale deleted successfully' });
    } catch (error) {
        logger.error('Error deleting sale', { error: error.message, stack: error.stack, saleId: req.params.id });
        res.status(500).json({ error: 'Failed to delete sale' });
    }
});

// Clear all sales
app.delete('/api/sales', (req, res) => {
    try {
        const result = db.prepare('DELETE FROM sales').run();
        logger.warn('All sales cleared', { deletedCount: result.changes });
        res.json({ message: 'All sales cleared successfully' });
    } catch (error) {
        logger.error('Error clearing sales', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to clear sales' });
    }
});

// Get profile
app.get('/api/profile', (req, res) => {
    try {
        const profile = db.prepare('SELECT * FROM profile WHERE id = 1').get();
        res.json(profile || { id: 1, photoData: null, qrCodeUrl: null, goalBoxes: 0, goalAmount: 0 });
    } catch (error) {
        logger.error('Error fetching profile', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// Update profile
app.put('/api/profile', (req, res) => {
    try {
        const { photoData, qrCodeUrl, goalBoxes, goalAmount } = req.body;
        
        // Validate goalBoxes and goalAmount
        const validGoalBoxes = (typeof goalBoxes === 'number' && goalBoxes >= 0) ? goalBoxes : 0;
        const validGoalAmount = (typeof goalAmount === 'number' && goalAmount >= 0) ? goalAmount : 0;
        
        const stmt = db.prepare(`
            UPDATE profile 
            SET photoData = COALESCE(?, photoData),
                qrCodeUrl = COALESCE(?, qrCodeUrl),
                goalBoxes = ?,
                goalAmount = ?
            WHERE id = 1
        `);
        stmt.run(photoData, qrCodeUrl, validGoalBoxes, validGoalAmount);
        
        const updatedProfile = db.prepare('SELECT * FROM profile WHERE id = 1').get();
        logger.info('Profile updated successfully');
        res.json(updatedProfile);
    } catch (error) {
        logger.error('Error updating profile', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Get all donations
app.get('/api/donations', (req, res) => {
    try {
        const donations = db.prepare('SELECT * FROM donations ORDER BY id DESC').all();
        res.json(donations);
    } catch (error) {
        logger.error('Error fetching donations', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to fetch donations' });
    }
});

// Add a new donation
app.post('/api/donations', (req, res) => {
    try {
        const { amount, donorName, date } = req.body;
        
        if (!amount || amount <= 0) {
            logger.warn('Invalid donation data received', { amount });
            return res.status(400).json({ error: 'Invalid donation data' });
        }
        
        // Validate and sanitize donorName
        const sanitizedDonorName = (donorName && donorName.trim()) || 'Anonymous';
        
        // Validate and use current date if not provided or invalid
        let donationDate = date;
        if (!donationDate || isNaN(new Date(donationDate).getTime())) {
            donationDate = new Date().toISOString();
        }
        
        const stmt = db.prepare('INSERT INTO donations (amount, donorName, date) VALUES (?, ?, ?)');
        const result = stmt.run(amount, sanitizedDonorName, donationDate);
        
        const newDonation = db.prepare('SELECT * FROM donations WHERE id = ?').get(result.lastInsertRowid);
        logger.info('Donation added successfully', { donationId: newDonation.id, amount });
        res.status(201).json(newDonation);
    } catch (error) {
        logger.error('Error adding donation', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to add donation' });
    }
});

// Delete a donation
app.delete('/api/donations/:id', (req, res) => {
    try {
        const { id } = req.params;
        const stmt = db.prepare('DELETE FROM donations WHERE id = ?');
        const result = stmt.run(id);
        
        if (result.changes === 0) {
            logger.warn('Attempted to delete non-existent donation', { donationId: id });
            return res.status(404).json({ error: 'Donation not found' });
        }
        
        logger.info('Donation deleted successfully', { donationId: id });
        res.json({ message: 'Donation deleted successfully' });
    } catch (error) {
        logger.error('Error deleting donation', { error: error.message, stack: error.stack, donationId: req.params.id });
        res.status(500).json({ error: 'Failed to delete donation' });
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
    
    logger.info(`${signal} received, closing database...`);
    db.close();
    logger.info('Database closed successfully');
    process.exitCode = 0;
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

app.listen(PORT, '0.0.0.0', () => {
    logger.info(`GSCTracker server running on port ${PORT}`);
    logger.info(`Database location: ${DB_PATH}`);
});
