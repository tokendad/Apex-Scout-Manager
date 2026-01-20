const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const XLSX = require('xlsx');
const logger = require('./logger');
const DigitalCookieScraper = require('./services/digitalCookieScraper');

// Configure multer for file uploads (memory storage)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            file.originalname.endsWith('.xlsx')) {
            cb(null, true);
        } else {
            cb(new Error('Only .xlsx files are allowed'), false);
        }
    }
});

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

        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            eventName TEXT NOT NULL,
            eventDate TEXT NOT NULL,
            description TEXT,
            initialBoxes INTEGER DEFAULT 0,
            initialCases INTEGER DEFAULT 0,
            remainingBoxes INTEGER DEFAULT 0,
            remainingCases INTEGER DEFAULT 0,
            donationsReceived REAL DEFAULT 0
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
    
    // Migration: Add paymentQrCodeUrl column to profile table if it doesn't exist
    const profileTableInfo = db.prepare("PRAGMA table_info(profile)").all();
    const hasPaymentQrCodeUrl = profileTableInfo.some(col => col.name === 'paymentQrCodeUrl');
    if (!hasPaymentQrCodeUrl) {
        db.exec(`ALTER TABLE profile ADD COLUMN paymentQrCodeUrl TEXT`);
        logger.info('Migration: Added paymentQrCodeUrl column to profile table');
    }
    
    // Migration: Add new individual sales columns if they don't exist
    const columnsToAdd = [
        { name: 'customerAddress', type: 'TEXT', default: null },
        { name: 'customerPhone', type: 'TEXT', default: null },
        { name: 'unitType', type: 'TEXT', default: "'box'" },
        { name: 'amountCollected', type: 'REAL', default: '0' },
        { name: 'amountDue', type: 'REAL', default: '0' },
        { name: 'paymentMethod', type: 'TEXT', default: null },
        { name: 'orderNumber', type: 'TEXT', default: null },
        { name: 'orderType', type: 'TEXT', default: null },
        { name: 'orderStatus', type: 'TEXT', default: null },
        { name: 'customerEmail', type: 'TEXT', default: null }
    ];
    
    for (const column of columnsToAdd) {
        const hasColumn = tableInfo.some(col => col.name === column.name);
        if (!hasColumn) {
            const defaultClause = column.default ? ` DEFAULT ${column.default}` : '';
            db.exec(`ALTER TABLE sales ADD COLUMN ${column.name} ${column.type}${defaultClause}`);
            logger.info(`Migration: Added ${column.name} column to sales table`);
        }
    }

    // Migration: Add Digital Cookie sync columns to profile table
    const digitalCookieProfileColumns = [
        { name: 'digitalCookieEmail', type: 'TEXT', default: null },
        { name: 'digitalCookiePassword', type: 'TEXT', default: null },
        { name: 'digitalCookieStoreUrl', type: 'TEXT', default: null },
        { name: 'lastSyncTime', type: 'TEXT', default: null }
    ];

    const currentProfileInfo = db.prepare("PRAGMA table_info(profile)").all();
    for (const column of digitalCookieProfileColumns) {
        const hasColumn = currentProfileInfo.some(col => col.name === column.name);
        if (!hasColumn) {
            const defaultClause = column.default ? ` DEFAULT ${column.default}` : '';
            db.exec(`ALTER TABLE profile ADD COLUMN ${column.name} ${column.type}${defaultClause}`);
            logger.info(`Migration: Added ${column.name} column to profile table`);
        }
    }

    // Migration: Add columns to donations table for Digital Cookie sync
    const donationsTableInfo = db.prepare("PRAGMA table_info(donations)").all();
    const donationsColumnsToAdd = [
        { name: 'orderNumber', type: 'TEXT', default: null },
        { name: 'source', type: 'TEXT', default: "'manual'" },
        { name: 'boxCount', type: 'INTEGER', default: '0' }
    ];

    for (const column of donationsColumnsToAdd) {
        const hasColumn = donationsTableInfo.some(col => col.name === column.name);
        if (!hasColumn) {
            const defaultClause = column.default ? ` DEFAULT ${column.default}` : '';
            db.exec(`ALTER TABLE donations ADD COLUMN ${column.name} ${column.type}${defaultClause}`);
            logger.info(`Migration: Added ${column.name} column to donations table`);
        }
    }

    // Create import_history table for tracking synced orders
    db.exec(`
        CREATE TABLE IF NOT EXISTS import_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            orderNumber TEXT UNIQUE NOT NULL,
            importDate TEXT NOT NULL,
            source TEXT DEFAULT 'scrape'
        )
    `);

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
        
        // New order grouping fields
        const sanitizedOrderNumber = (req.body.orderNumber && String(req.body.orderNumber)) || null;
        const sanitizedOrderType = (req.body.orderType && String(req.body.orderType)) || null;
        const sanitizedOrderStatus = (req.body.orderStatus && String(req.body.orderStatus)) || 'Pending';

        const stmt = db.prepare(`
            INSERT INTO sales (
                cookieType, quantity, customerName, date, saleType,
                customerAddress, customerPhone, unitType, 
                amountCollected, amountDue, paymentMethod,
                orderNumber, orderType, orderStatus
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
            cookieType, quantity, sanitizedCustomerName, saleDate, validSaleType,
            sanitizedCustomerAddress, sanitizedCustomerPhone, validUnitType,
            validAmountCollected, validAmountDue, validPaymentMethod,
            sanitizedOrderNumber, sanitizedOrderType, sanitizedOrderStatus
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

// Update a sale
app.put('/api/sales/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { orderStatus, amountCollected, amountDue } = req.body;

        // Dynamic update query construction
        const updates = [];
        const values = [];

        if (orderStatus !== undefined) {
            updates.push('orderStatus = ?');
            values.push(orderStatus);
        }

        if (amountCollected !== undefined) {
            updates.push('amountCollected = ?');
            values.push(amountCollected);
        }

        if (amountDue !== undefined) {
            updates.push('amountDue = ?');
            values.push(amountDue);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        values.push(id);

        const stmt = db.prepare(`UPDATE sales SET ${updates.join(', ')} WHERE id = ?`);
        const result = stmt.run(...values);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Sale not found' });
        }

        const updatedSale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
        logger.info('Sale updated successfully', { saleId: id, updates });
        res.json(updatedSale);
    } catch (error) {
        logger.error('Error updating sale', { error: error.message, stack: error.stack, saleId: req.params.id });
        res.status(500).json({ error: 'Failed to update sale' });
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
        const {
            photoData, qrCodeUrl, paymentQrCodeUrl, goalBoxes, goalAmount,
            digitalCookieEmail, digitalCookiePassword, digitalCookieStoreUrl
        } = req.body;

        // Validate goalBoxes and goalAmount
        const validGoalBoxes = (typeof goalBoxes === 'number' && goalBoxes >= 0) ? goalBoxes : 0;
        const validGoalAmount = (typeof goalAmount === 'number' && goalAmount >= 0) ? goalAmount : 0;

        const stmt = db.prepare(`
            UPDATE profile
            SET photoData = COALESCE(?, photoData),
                qrCodeUrl = COALESCE(?, qrCodeUrl),
                paymentQrCodeUrl = COALESCE(?, paymentQrCodeUrl),
                goalBoxes = ?,
                goalAmount = ?,
                digitalCookieEmail = COALESCE(?, digitalCookieEmail),
                digitalCookiePassword = COALESCE(?, digitalCookiePassword),
                digitalCookieStoreUrl = COALESCE(?, digitalCookieStoreUrl)
            WHERE id = 1
        `);
        stmt.run(
            photoData, qrCodeUrl, paymentQrCodeUrl, validGoalBoxes, validGoalAmount,
            digitalCookieEmail, digitalCookiePassword, digitalCookieStoreUrl
        );

        const updatedProfile = db.prepare('SELECT * FROM profile WHERE id = 1').get();
        logger.info('Profile updated successfully', {
            updates: {
                hasPhoto: !!photoData,
                hasStoreQr: !!qrCodeUrl,
                hasPaymentQr: !!paymentQrCodeUrl,
                goalBoxes: validGoalBoxes,
                hasDigitalCookieCredentials: !!(digitalCookieEmail || digitalCookiePassword)
            }
        });
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

// Get all events
app.get('/api/events', (req, res) => {
    try {
        const events = db.prepare('SELECT * FROM events ORDER BY eventDate DESC').all();
        res.json(events);
    } catch (error) {
        logger.error('Error fetching events', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

// Add a new event
app.post('/api/events', (req, res) => {
    try {
        const { 
            eventName, 
            eventDate, 
            description,
            initialBoxes,
            initialCases,
            remainingBoxes,
            remainingCases,
            donationsReceived
        } = req.body;
        
        if (!eventName || !eventDate) {
            logger.warn('Invalid event data received', { eventName, eventDate });
            return res.status(400).json({ error: 'Event name and date are required' });
        }
        
        // Validate and sanitize eventName
        const sanitizedEventName = eventName.trim();
        if (!sanitizedEventName) {
            logger.warn('Empty event name received');
            return res.status(400).json({ error: 'Event name cannot be empty' });
        }
        
        // Validate and use current date if not provided or invalid
        let validEventDate = eventDate;
        if (!validEventDate || isNaN(new Date(validEventDate).getTime())) {
            validEventDate = new Date().toISOString();
        }
        
        // Validate numeric fields
        const validInitialBoxes = (typeof initialBoxes === 'number' && initialBoxes >= 0) ? initialBoxes : 0;
        const validInitialCases = (typeof initialCases === 'number' && initialCases >= 0) ? initialCases : 0;
        const validRemainingBoxes = (typeof remainingBoxes === 'number' && remainingBoxes >= 0) ? remainingBoxes : 0;
        const validRemainingCases = (typeof remainingCases === 'number' && remainingCases >= 0) ? remainingCases : 0;
        const validDonationsReceived = (typeof donationsReceived === 'number' && donationsReceived >= 0) ? donationsReceived : 0;
        const sanitizedDescription = (description && description.trim()) || null;
        
        const stmt = db.prepare(`
            INSERT INTO events (
                eventName, eventDate, description,
                initialBoxes, initialCases, remainingBoxes, remainingCases,
                donationsReceived
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
            sanitizedEventName, validEventDate, sanitizedDescription,
            validInitialBoxes, validInitialCases, validRemainingBoxes, validRemainingCases,
            validDonationsReceived
        );
        
        const newEvent = db.prepare('SELECT * FROM events WHERE id = ?').get(result.lastInsertRowid);
        logger.info('Event added successfully', { eventId: newEvent.id, eventName: sanitizedEventName });
        res.status(201).json(newEvent);
    } catch (error) {
        logger.error('Error adding event', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to add event' });
    }
});

// Update an event
app.put('/api/events/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { 
            eventName, 
            eventDate, 
            description,
            initialBoxes,
            initialCases,
            remainingBoxes,
            remainingCases,
            donationsReceived
        } = req.body;
        
        if (!eventName || !eventDate) {
            logger.warn('Invalid event data received', { eventName, eventDate });
            return res.status(400).json({ error: 'Event name and date are required' });
        }
        
        // Validate and sanitize eventName
        const sanitizedEventName = eventName.trim();
        if (!sanitizedEventName) {
            logger.warn('Empty event name received');
            return res.status(400).json({ error: 'Event name cannot be empty' });
        }
        
        // Validate and use current date if not provided or invalid
        let validEventDate = eventDate;
        if (!validEventDate || isNaN(new Date(validEventDate).getTime())) {
            validEventDate = new Date().toISOString();
        }
        
        // Validate numeric fields
        const validInitialBoxes = (typeof initialBoxes === 'number' && initialBoxes >= 0) ? initialBoxes : 0;
        const validInitialCases = (typeof initialCases === 'number' && initialCases >= 0) ? initialCases : 0;
        const validRemainingBoxes = (typeof remainingBoxes === 'number' && remainingBoxes >= 0) ? remainingBoxes : 0;
        const validRemainingCases = (typeof remainingCases === 'number' && remainingCases >= 0) ? remainingCases : 0;
        const validDonationsReceived = (typeof donationsReceived === 'number' && donationsReceived >= 0) ? donationsReceived : 0;
        const sanitizedDescription = (description && description.trim()) || null;
        
        const stmt = db.prepare(`
            UPDATE events 
            SET eventName = ?,
                eventDate = ?,
                description = ?,
                initialBoxes = ?,
                initialCases = ?,
                remainingBoxes = ?,
                remainingCases = ?,
                donationsReceived = ?
            WHERE id = ?
        `);
        const result = stmt.run(
            sanitizedEventName, validEventDate, sanitizedDescription,
            validInitialBoxes, validInitialCases, validRemainingBoxes, validRemainingCases,
            validDonationsReceived, id
        );
        
        if (result.changes === 0) {
            logger.warn('Attempted to update non-existent event', { eventId: id });
            return res.status(404).json({ error: 'Event not found' });
        }
        
        const updatedEvent = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
        logger.info('Event updated successfully', { eventId: id });
        res.json(updatedEvent);
    } catch (error) {
        logger.error('Error updating event', { error: error.message, stack: error.stack, eventId: req.params.id });
        res.status(500).json({ error: 'Failed to update event' });
    }
});

// Delete an event
app.delete('/api/events/:id', (req, res) => {
    try {
        const { id } = req.params;
        const stmt = db.prepare('DELETE FROM events WHERE id = ?');
        const result = stmt.run(id);
        
        if (result.changes === 0) {
            logger.warn('Attempted to delete non-existent event', { eventId: id });
            return res.status(404).json({ error: 'Event not found' });
        }
        
        logger.info('Event deleted successfully', { eventId: id });
        res.json({ message: 'Event deleted successfully' });
    } catch (error) {
        logger.error('Error deleting event', { error: error.message, stack: error.stack, eventId: req.params.id });
        res.status(500).json({ error: 'Failed to delete event' });
    }
});

// Import sales from XLSX file
app.post('/api/import', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            logger.warn('No file uploaded for import');
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet);

        if (data.length === 0) {
            logger.warn('Empty XLSX file uploaded');
            return res.status(400).json({ error: 'No data found in file' });
        }

        // Cookie type mapping from XLSX columns to our cookie names (Official Girl Scout cookies)
        const cookieColumns = [
            { xlsx: 'Thin Mints', db: 'Thin Mints' },
            { xlsx: 'Samoas', db: 'Samoas' },
            { xlsx: 'Caramel deLites', db: 'Samoas' },
            { xlsx: 'Tagalongs', db: 'Tagalongs' },
            { xlsx: 'Peanut Butter Patties', db: 'Tagalongs' },
            { xlsx: 'Trefoils', db: 'Trefoils' },
            { xlsx: 'Shortbread', db: 'Trefoils' },
            { xlsx: 'Do-si-dos', db: 'Do-si-dos' },
            { xlsx: 'Peanut Butter Sandwich', db: 'Do-si-dos' },
            { xlsx: 'Lemon-Ups', db: 'Lemon-Ups' },
            { xlsx: 'Adventurefuls', db: 'Adventurefuls' },
            { xlsx: 'Exploremores', db: 'Exploremores' },
            { xlsx: 'Toffee-tastic', db: 'Toffee-tastic' }
        ];

        const insertStmt = db.prepare(`
            INSERT INTO sales (
                cookieType, quantity, customerName, customerAddress, customerPhone,
                date, saleType, unitType, orderNumber, orderType, orderStatus, customerEmail
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let importedCount = 0;
        let skippedCount = 0;

        // Use a transaction for better performance
        const importTransaction = db.transaction((rows) => {
            for (const row of rows) {
                // Get order details
                const orderNumber = String(row['Order Number'] || '');
                const orderDate = row['Order Date'];
                const orderType = row['Order Type'] || '';
                const orderStatus = row['Order Status'] || '';
                const customerName = row['Deliver To'] || '';
                const customerAddress = row['Delivery Address'] || '';
                const customerPhone = row['Customer Phone'] || '';
                const customerEmail = row['Customer Email'] || '';

                // Convert Excel date serial to ISO string
                let dateStr = new Date().toISOString();
                if (orderDate) {
                    if (typeof orderDate === 'number') {
                        // Excel date serial number
                        const excelEpoch = new Date(1899, 11, 30);
                        const jsDate = new Date(excelEpoch.getTime() + orderDate * 24 * 60 * 60 * 1000);
                        dateStr = jsDate.toISOString();
                    } else if (typeof orderDate === 'string') {
                        const parsedDate = new Date(orderDate);
                        if (!isNaN(parsedDate.getTime())) {
                            dateStr = parsedDate.toISOString();
                        }
                    }
                }

                // Determine sale type based on order type
                let saleType = 'individual';
                if (orderType.toLowerCase().includes('donation')) {
                    saleType = 'donation';
                }

                // Check for donated cookies column
                const donatedCookies = parseInt(row['Donated Cookies'] || row['Donated Cookies (DO NOT DELIVER)'] || 0);
                if (donatedCookies > 0) {
                    // Add donated cookies as a special entry
                    insertStmt.run(
                        'Donated Cookies',
                        donatedCookies,
                        customerName,
                        customerAddress,
                        customerPhone,
                        dateStr,
                        'donation',
                        'box',
                        orderNumber,
                        orderType,
                        orderStatus,
                        customerEmail
                    );
                    importedCount++;
                }

                // Process each cookie type
                for (const cookie of cookieColumns) {
                    const quantity = parseInt(row[cookie.xlsx] || 0);
                    if (quantity > 0) {
                        insertStmt.run(
                            cookie.db,
                            quantity,
                            customerName,
                            customerAddress,
                            customerPhone,
                            dateStr,
                            saleType,
                            'box',
                            orderNumber,
                            orderType,
                            orderStatus,
                            customerEmail
                        );
                        importedCount++;
                    }
                }
            }
        });

        importTransaction(data);

        logger.info('XLSX import completed', {
            filename: req.file.originalname,
            totalRows: data.length,
            importedSales: importedCount
        });

        res.json({
            message: 'Import successful',
            ordersProcessed: data.length,
            salesImported: importedCount
        });
    } catch (error) {
        logger.error('Error importing XLSX', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to import file: ' + error.message });
    }
});

// Digital Cookie Scrape - Test connection
app.post('/api/scrape/test', async (req, res) => {
    const scraper = new DigitalCookieScraper();
    try {
        // Get credentials from profile
        const profile = db.prepare('SELECT digitalCookieEmail, digitalCookiePassword FROM profile WHERE id = 1').get();

        if (!profile || !profile.digitalCookieEmail || !profile.digitalCookiePassword) {
            return res.status(400).json({ error: 'Digital Cookie credentials not configured' });
        }

        await scraper.init();
        const loginSuccess = await scraper.login(profile.digitalCookieEmail, profile.digitalCookiePassword);

        if (loginSuccess) {
            logger.info('Digital Cookie test connection successful');
            res.json({ success: true, message: 'Connection successful' });
        } else {
            logger.warn('Digital Cookie test connection failed - invalid credentials');
            res.status(401).json({ success: false, error: 'Login failed - check your credentials' });
        }
    } catch (error) {
        logger.error('Digital Cookie test connection error', { error: error.message });
        res.status(500).json({ success: false, error: 'Connection test failed: ' + error.message });
    } finally {
        await scraper.close();
    }
});

// Digital Cookie Scrape - Get sync status
app.get('/api/scrape/status', (req, res) => {
    try {
        const profile = db.prepare('SELECT lastSyncTime, digitalCookieEmail, digitalCookieStoreUrl FROM profile WHERE id = 1').get();
        const importHistory = db.prepare('SELECT COUNT(*) as count FROM import_history WHERE source = ?').get('scrape');

        res.json({
            lastSyncTime: profile?.lastSyncTime || null,
            hasCredentials: !!(profile?.digitalCookieEmail),
            hasStoreUrl: !!(profile?.digitalCookieStoreUrl),
            totalImported: importHistory?.count || 0
        });
    } catch (error) {
        logger.error('Error fetching scrape status', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch status' });
    }
});

// Digital Cookie Scrape - Trigger sync
app.post('/api/scrape', async (req, res) => {
    const scraper = new DigitalCookieScraper();
    try {
        // Get credentials and store URL from profile
        const profile = db.prepare('SELECT digitalCookieEmail, digitalCookiePassword, digitalCookieStoreUrl FROM profile WHERE id = 1').get();

        if (!profile || !profile.digitalCookieEmail || !profile.digitalCookiePassword) {
            return res.status(400).json({ error: 'Digital Cookie credentials not configured' });
        }

        if (!profile.digitalCookieStoreUrl) {
            return res.status(400).json({ error: 'Digital Cookie store URL not configured' });
        }

        logger.info('Starting Digital Cookie sync');

        await scraper.init();

        // Login
        const loginSuccess = await scraper.login(profile.digitalCookieEmail, profile.digitalCookiePassword);
        if (!loginSuccess) {
            return res.status(401).json({ error: 'Login failed - check your credentials' });
        }

        // Scrape orders
        const orders = await scraper.scrapeOrders(profile.digitalCookieStoreUrl);

        // Process orders
        let salesImported = 0;
        let donationsImported = 0;
        let skippedDuplicates = 0;

        const PRICE_PER_BOX = 6;

        const insertSale = db.prepare(`
            INSERT INTO sales (
                cookieType, quantity, customerName, customerAddress, customerPhone,
                customerEmail, date, saleType, unitType, orderNumber, orderType,
                orderStatus, amountCollected, amountDue, paymentMethod
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const insertDonation = db.prepare(`
            INSERT INTO donations (amount, donorName, date, orderNumber, source, boxCount)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        const insertHistory = db.prepare(`
            INSERT OR IGNORE INTO import_history (orderNumber, importDate, source)
            VALUES (?, ?, ?)
        `);

        const checkHistory = db.prepare('SELECT id FROM import_history WHERE orderNumber = ?');

        const processTransaction = db.transaction(() => {
            for (const order of orders) {
                // Skip if already imported
                if (order.orderNumber) {
                    const existing = checkHistory.get(order.orderNumber);
                    if (existing) {
                        skippedDuplicates++;
                        continue;
                    }
                }

                const orderDate = order.orderDate || new Date().toISOString();
                const totalBoxes = order.totalBoxes || 1;
                const totalAmount = totalBoxes * PRICE_PER_BOX;

                if (order.isDonation) {
                    // Insert as donation
                    insertDonation.run(
                        totalAmount,
                        order.customerName || 'Digital Cookie Donor',
                        orderDate,
                        order.orderNumber,
                        'digital_cookie',
                        totalBoxes
                    );
                    donationsImported++;
                } else {
                    // Insert as sale
                    // For website orders, payment is already collected
                    const amountCollected = order.isWebsiteOrder ? totalAmount : 0;
                    const amountDue = order.isWebsiteOrder ? 0 : totalAmount;
                    const paymentMethod = order.isWebsiteOrder ? 'online' : null;

                    // Insert a generic cookie entry for the order
                    insertSale.run(
                        'Assorted',         // cookieType - we may not have detailed breakdown
                        totalBoxes,         // quantity
                        order.customerName || 'Digital Cookie Customer',
                        order.customerAddress || null,
                        order.customerPhone || null,
                        order.customerEmail || null,
                        orderDate,
                        'individual',       // saleType
                        'box',              // unitType
                        order.orderNumber,
                        order.isWebsiteOrder ? 'Website' : 'Digital Cookie',
                        order.orderStatus || 'Pending',
                        amountCollected,
                        amountDue,
                        paymentMethod
                    );
                    salesImported++;
                }

                // Record in import history
                if (order.orderNumber) {
                    insertHistory.run(order.orderNumber, new Date().toISOString(), 'scrape');
                }
            }
        });

        processTransaction();

        // Update lastSyncTime
        db.prepare('UPDATE profile SET lastSyncTime = ? WHERE id = 1').run(new Date().toISOString());

        logger.info('Digital Cookie sync completed', {
            ordersProcessed: orders.length,
            salesImported,
            donationsImported,
            skippedDuplicates
        });

        res.json({
            success: true,
            ordersProcessed: orders.length,
            salesImported,
            donationsImported,
            skippedDuplicates
        });
    } catch (error) {
        logger.error('Digital Cookie sync failed', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Sync failed: ' + error.message });
    } finally {
        await scraper.close();
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
