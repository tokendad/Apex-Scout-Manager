const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const ExcelJS = require('exceljs');
const logger = require('./logger');


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
app.set('trust proxy', 1); // Trust first proxy
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

        CREATE TABLE IF NOT EXISTS payment_methods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            isEnabled INTEGER DEFAULT 1
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

    // Migration: Add on-hand inventory columns to profile table
    const inventoryColumns = [
        'inventoryThinMints',
        'inventorySamoas',
        'inventoryTagalongs',
        'inventoryTrefoils',
        'inventoryDosiDos',
        'inventoryLemonUps',
        'inventoryAdventurefuls',
        'inventoryExploremores',
        'inventoryToffeetastic'
    ];
    
    for (const column of inventoryColumns) {
        const hasColumn = profileTableInfo.some(col => col.name === column);
        if (!hasColumn) {
            db.exec(`ALTER TABLE profile ADD COLUMN ${column} INTEGER DEFAULT 0`);
            logger.info(`Migration: Added ${column} column to profile table`);
        }
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

    // Migration: Add variety breakdown columns to events table
    const eventsTableInfo = db.prepare("PRAGMA table_info(events)").all();
    const varietyColumns = [
        'initialThinMints', 'initialSamoas', 'initialTagalongs', 'initialTrefoils',
        'initialDosiDos', 'initialLemonUps', 'initialAdventurefuls', 'initialExploremores', 'initialToffeetastic',
        'remainingThinMints', 'remainingSamoas', 'remainingTagalongs', 'remainingTrefoils',
        'remainingDosiDos', 'remainingLemonUps', 'remainingAdventurefuls', 'remainingExploremores', 'remainingToffeetastic'
    ];
    
    for (const column of varietyColumns) {
        const hasColumn = eventsTableInfo.some(col => col.name === column);
        if (!hasColumn) {
            db.exec(`ALTER TABLE events ADD COLUMN ${column} INTEGER DEFAULT 0`);
            logger.info(`Migration: Added ${column} column to events table`);
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
        res.json(profile || { 
            id: 1, 
            photoData: null, 
            qrCodeUrl: null, 
            goalBoxes: 0, 
            goalAmount: 0,
            inventoryThinMints: 0,
            inventorySamoas: 0,
            inventoryTagalongs: 0,
            inventoryTrefoils: 0,
            inventoryDosiDos: 0,
            inventoryLemonUps: 0,
            inventoryAdventurefuls: 0,
            inventoryExploremores: 0,
            inventoryToffeetastic: 0
        });
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
            inventoryThinMints, inventorySamoas, inventoryTagalongs, 
            inventoryTrefoils, inventoryDosiDos, inventoryLemonUps,
            inventoryAdventurefuls, inventoryExploremores, inventoryToffeetastic
        } = req.body;

        // Helper function to validate numeric values
        const validateNumber = (value) => (typeof value === 'number' && value >= 0) ? value : 0;

        // Validate goalBoxes and goalAmount
        const validGoalBoxes = validateNumber(goalBoxes);
        const validGoalAmount = validateNumber(goalAmount);

        // Validate inventory values
        const inventoryFields = [
            inventoryThinMints, inventorySamoas, inventoryTagalongs,
            inventoryTrefoils, inventoryDosiDos, inventoryLemonUps,
            inventoryAdventurefuls, inventoryExploremores, inventoryToffeetastic
        ];
        const validatedInventory = inventoryFields.map(validateNumber);

        const stmt = db.prepare(`
            UPDATE profile
            SET photoData = COALESCE(?, photoData),
                qrCodeUrl = COALESCE(?, qrCodeUrl),
                paymentQrCodeUrl = COALESCE(?, paymentQrCodeUrl),
                goalBoxes = ?,
                goalAmount = ?,
                inventoryThinMints = ?,
                inventorySamoas = ?,
                inventoryTagalongs = ?,
                inventoryTrefoils = ?,
                inventoryDosiDos = ?,
                inventoryLemonUps = ?,
                inventoryAdventurefuls = ?,
                inventoryExploremores = ?,
                inventoryToffeetastic = ?
            WHERE id = 1
        `);
        stmt.run(
            photoData, qrCodeUrl, paymentQrCodeUrl, validGoalBoxes, validGoalAmount,
            ...validatedInventory
        );

        const updatedProfile = db.prepare('SELECT * FROM profile WHERE id = 1').get();
        logger.info('Profile updated successfully', {
            updates: {
                hasPhoto: !!photoData,
                hasStoreQr: !!qrCodeUrl,
                hasPaymentQr: !!paymentQrCodeUrl,
                goalBoxes: validGoalBoxes
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
            donationsReceived,
            // Variety data
            initialThinMints, initialSamoas, initialTagalongs, initialTrefoils,
            initialDosiDos, initialLemonUps, initialAdventurefuls, initialExploremores, initialToffeetastic,
            remainingThinMints, remainingSamoas, remainingTagalongs, remainingTrefoils,
            remainingDosiDos, remainingLemonUps, remainingAdventurefuls, remainingExploremores, remainingToffeetastic
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
        
        // Validate variety numeric fields
        const validInitialThinMints = (typeof initialThinMints === 'number' && initialThinMints >= 0) ? initialThinMints : 0;
        const validInitialSamoas = (typeof initialSamoas === 'number' && initialSamoas >= 0) ? initialSamoas : 0;
        const validInitialTagalongs = (typeof initialTagalongs === 'number' && initialTagalongs >= 0) ? initialTagalongs : 0;
        const validInitialTrefoils = (typeof initialTrefoils === 'number' && initialTrefoils >= 0) ? initialTrefoils : 0;
        const validInitialDosiDos = (typeof initialDosiDos === 'number' && initialDosiDos >= 0) ? initialDosiDos : 0;
        const validInitialLemonUps = (typeof initialLemonUps === 'number' && initialLemonUps >= 0) ? initialLemonUps : 0;
        const validInitialAdventurefuls = (typeof initialAdventurefuls === 'number' && initialAdventurefuls >= 0) ? initialAdventurefuls : 0;
        const validInitialExploremores = (typeof initialExploremores === 'number' && initialExploremores >= 0) ? initialExploremores : 0;
        const validInitialToffeetastic = (typeof initialToffeetastic === 'number' && initialToffeetastic >= 0) ? initialToffeetastic : 0;
        
        const validRemainingThinMints = (typeof remainingThinMints === 'number' && remainingThinMints >= 0) ? remainingThinMints : 0;
        const validRemainingSamoas = (typeof remainingSamoas === 'number' && remainingSamoas >= 0) ? remainingSamoas : 0;
        const validRemainingTagalongs = (typeof remainingTagalongs === 'number' && remainingTagalongs >= 0) ? remainingTagalongs : 0;
        const validRemainingTrefoils = (typeof remainingTrefoils === 'number' && remainingTrefoils >= 0) ? remainingTrefoils : 0;
        const validRemainingDosiDos = (typeof remainingDosiDos === 'number' && remainingDosiDos >= 0) ? remainingDosiDos : 0;
        const validRemainingLemonUps = (typeof remainingLemonUps === 'number' && remainingLemonUps >= 0) ? remainingLemonUps : 0;
        const validRemainingAdventurefuls = (typeof remainingAdventurefuls === 'number' && remainingAdventurefuls >= 0) ? remainingAdventurefuls : 0;
        const validRemainingExploremores = (typeof remainingExploremores === 'number' && remainingExploremores >= 0) ? remainingExploremores : 0;
        const validRemainingToffeetastic = (typeof remainingToffeetastic === 'number' && remainingToffeetastic >= 0) ? remainingToffeetastic : 0;
        
        const stmt = db.prepare(`
            INSERT INTO events (
                eventName, eventDate, description,
                initialBoxes, initialCases, remainingBoxes, remainingCases,
                donationsReceived,
                initialThinMints, initialSamoas, initialTagalongs, initialTrefoils,
                initialDosiDos, initialLemonUps, initialAdventurefuls, initialExploremores, initialToffeetastic,
                remainingThinMints, remainingSamoas, remainingTagalongs, remainingTrefoils,
                remainingDosiDos, remainingLemonUps, remainingAdventurefuls, remainingExploremores, remainingToffeetastic
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
            sanitizedEventName, validEventDate, sanitizedDescription,
            validInitialBoxes, validInitialCases, validRemainingBoxes, validRemainingCases,
            validDonationsReceived,
            validInitialThinMints, validInitialSamoas, validInitialTagalongs, validInitialTrefoils,
            validInitialDosiDos, validInitialLemonUps, validInitialAdventurefuls, validInitialExploremores, validInitialToffeetastic,
            validRemainingThinMints, validRemainingSamoas, validRemainingTagalongs, validRemainingTrefoils,
            validRemainingDosiDos, validRemainingLemonUps, validRemainingAdventurefuls, validRemainingExploremores, validRemainingToffeetastic
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
            donationsReceived,
            // Variety data
            initialThinMints, initialSamoas, initialTagalongs, initialTrefoils,
            initialDosiDos, initialLemonUps, initialAdventurefuls, initialExploremores, initialToffeetastic,
            remainingThinMints, remainingSamoas, remainingTagalongs, remainingTrefoils,
            remainingDosiDos, remainingLemonUps, remainingAdventurefuls, remainingExploremores, remainingToffeetastic
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
        
        // Validate variety numeric fields
        const validInitialThinMints = (typeof initialThinMints === 'number' && initialThinMints >= 0) ? initialThinMints : 0;
        const validInitialSamoas = (typeof initialSamoas === 'number' && initialSamoas >= 0) ? initialSamoas : 0;
        const validInitialTagalongs = (typeof initialTagalongs === 'number' && initialTagalongs >= 0) ? initialTagalongs : 0;
        const validInitialTrefoils = (typeof initialTrefoils === 'number' && initialTrefoils >= 0) ? initialTrefoils : 0;
        const validInitialDosiDos = (typeof initialDosiDos === 'number' && initialDosiDos >= 0) ? initialDosiDos : 0;
        const validInitialLemonUps = (typeof initialLemonUps === 'number' && initialLemonUps >= 0) ? initialLemonUps : 0;
        const validInitialAdventurefuls = (typeof initialAdventurefuls === 'number' && initialAdventurefuls >= 0) ? initialAdventurefuls : 0;
        const validInitialExploremores = (typeof initialExploremores === 'number' && initialExploremores >= 0) ? initialExploremores : 0;
        const validInitialToffeetastic = (typeof initialToffeetastic === 'number' && initialToffeetastic >= 0) ? initialToffeetastic : 0;
        
        const validRemainingThinMints = (typeof remainingThinMints === 'number' && remainingThinMints >= 0) ? remainingThinMints : 0;
        const validRemainingSamoas = (typeof remainingSamoas === 'number' && remainingSamoas >= 0) ? remainingSamoas : 0;
        const validRemainingTagalongs = (typeof remainingTagalongs === 'number' && remainingTagalongs >= 0) ? remainingTagalongs : 0;
        const validRemainingTrefoils = (typeof remainingTrefoils === 'number' && remainingTrefoils >= 0) ? remainingTrefoils : 0;
        const validRemainingDosiDos = (typeof remainingDosiDos === 'number' && remainingDosiDos >= 0) ? remainingDosiDos : 0;
        const validRemainingLemonUps = (typeof remainingLemonUps === 'number' && remainingLemonUps >= 0) ? remainingLemonUps : 0;
        const validRemainingAdventurefuls = (typeof remainingAdventurefuls === 'number' && remainingAdventurefuls >= 0) ? remainingAdventurefuls : 0;
        const validRemainingExploremores = (typeof remainingExploremores === 'number' && remainingExploremores >= 0) ? remainingExploremores : 0;
        const validRemainingToffeetastic = (typeof remainingToffeetastic === 'number' && remainingToffeetastic >= 0) ? remainingToffeetastic : 0;
        
        const stmt = db.prepare(`
            UPDATE events 
            SET eventName = ?,
                eventDate = ?,
                description = ?,
                initialBoxes = ?,
                initialCases = ?,
                remainingBoxes = ?,
                remainingCases = ?,
                donationsReceived = ?,
                initialThinMints = ?, initialSamoas = ?, initialTagalongs = ?, initialTrefoils = ?,
                initialDosiDos = ?, initialLemonUps = ?, initialAdventurefuls = ?, initialExploremores = ?, initialToffeetastic = ?,
                remainingThinMints = ?, remainingSamoas = ?, remainingTagalongs = ?, remainingTrefoils = ?,
                remainingDosiDos = ?, remainingLemonUps = ?, remainingAdventurefuls = ?, remainingExploremores = ?, remainingToffeetastic = ?
            WHERE id = ?
        `);
        const result = stmt.run(
            sanitizedEventName, validEventDate, sanitizedDescription,
            validInitialBoxes, validInitialCases, validRemainingBoxes, validRemainingCases,
            validDonationsReceived,
            validInitialThinMints, validInitialSamoas, validInitialTagalongs, validInitialTrefoils,
            validInitialDosiDos, validInitialLemonUps, validInitialAdventurefuls, validInitialExploremores, validInitialToffeetastic,
            validRemainingThinMints, validRemainingSamoas, validRemainingTagalongs, validRemainingTrefoils,
            validRemainingDosiDos, validRemainingLemonUps, validRemainingAdventurefuls, validRemainingExploremores, validRemainingToffeetastic,
            id
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
app.post('/api/import', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            logger.warn('No file uploaded for import');
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Use ExcelJS to read the workbook
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);

        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
            logger.warn('Empty XLSX file uploaded');
            return res.status(400).json({ error: 'No data found in file' });
        }

        // Convert worksheet to array of objects
        const data = [];
        const headers = [];

        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) {
                // First row is headers
                row.eachCell((cell, colNumber) => {
                    headers[colNumber] = cell.value?.toString() || '';
                });
            } else {
                // Data rows
                const rowData = {};
                row.eachCell((cell, colNumber) => {
                    const header = headers[colNumber];
                    if (header) {
                        // Handle different cell value types
                        let value = cell.value;
                        if (value && typeof value === 'object') {
                            // Handle rich text, dates, etc.
                            if (value.richText) {
                                value = value.richText.map(rt => rt.text).join('');
                            } else if (value instanceof Date) {
                                value = value;
                            } else if (value.result !== undefined) {
                                value = value.result;
                            }
                        }
                        rowData[header] = value;
                    }
                });
                if (Object.keys(rowData).length > 0) {
                    data.push(rowData);
                }
            }
        });

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

                // Convert date to ISO string
                let dateStr = new Date().toISOString();
                if (orderDate) {
                    if (orderDate instanceof Date) {
                        dateStr = orderDate.toISOString();
                    } else if (typeof orderDate === 'number') {
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

// Get payment methods
app.get('/api/payment-methods', (req, res) => {
    try {
        const methods = db.prepare('SELECT * FROM payment_methods ORDER BY id ASC').all();
        res.json(methods);
    } catch (error) {
        logger.error('Error fetching payment methods', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to fetch payment methods' });
    }
});

// Add payment method
app.post('/api/payment-methods', (req, res) => {
    try {
        const { name, url } = req.body;
        
        if (!name || !url) {
            return res.status(400).json({ error: 'Name and URL are required' });
        }
        
        const stmt = db.prepare('INSERT INTO payment_methods (name, url) VALUES (?, ?)');
        const result = stmt.run(name.trim(), url.trim());
        
        const newMethod = db.prepare('SELECT * FROM payment_methods WHERE id = ?').get(result.lastInsertRowid);
        logger.info('Payment method added', { id: newMethod.id, name });
        res.status(201).json(newMethod);
    } catch (error) {
        logger.error('Error adding payment method', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to add payment method' });
    }
});

// Delete payment method
app.delete('/api/payment-methods/:id', (req, res) => {
    try {
        const { id } = req.params;
        const result = db.prepare('DELETE FROM payment_methods WHERE id = ?').run(id);
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Payment method not found' });
        }
        
        logger.info('Payment method deleted', { id });
        res.json({ success: true });
    } catch (error) {
        logger.error('Error deleting payment method', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to delete payment method' });
    }
});



// Delete all sales
app.delete('/api/sales', (req, res) => {
    try {
        const result = db.prepare('DELETE FROM sales').run();
        logger.info('All sales deleted', { deletedCount: result.changes });
        res.json({ success: true, deletedCount: result.changes });
    } catch (error) {
        logger.error('Failed to delete sales', { error: error.message });
        res.status(500).json({ error: 'Failed to delete sales' });
    }
});

// Delete all donations
app.delete('/api/donations', (req, res) => {
    try {
        const result = db.prepare('DELETE FROM donations').run();
        logger.info('All donations deleted', { deletedCount: result.changes });
        res.json({ success: true, deletedCount: result.changes });
    } catch (error) {
        logger.error('Failed to delete donations', { error: error.message });
        res.status(500).json({ error: 'Failed to delete donations' });
    }
});

// Delete all data (sales and donations)
app.delete('/api/data', (req, res) => {
    try {
        const deleteTransaction = db.transaction(() => {
            const salesResult = db.prepare('DELETE FROM sales').run();
            const donationsResult = db.prepare('DELETE FROM donations').run();
            return { salesDeleted: salesResult.changes, donationsDeleted: donationsResult.changes };
        });

        const results = deleteTransaction();
        logger.info('All data cleared', results);
        res.json({ success: true, ...results });
    } catch (error) {
        logger.error('Failed to clear data', { error: error.message });
        res.status(500).json({ error: 'Failed to clear data' });
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
