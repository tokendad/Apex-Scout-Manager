const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const ExcelJS = require('exceljs');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const passport = require('passport');
const cookieParser = require('cookie-parser');
const logger = require('./logger');
const auth = require('./auth');
const { configurePassport } = require('./passport-config');


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
const DB_PATH = path.join(DATA_DIR, 'asm.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    logger.info('Created data directory', { path: DATA_DIR });
}

// Backup database before initialization/migration to prevent data loss
if (fs.existsSync(DB_PATH)) {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = `${DB_PATH}.backup.${timestamp}`;
        fs.copyFileSync(DB_PATH, backupPath);
        logger.info('Created startup database backup', { path: backupPath });

        // Keep only last 5 backups to save space
        const files = fs.readdirSync(DATA_DIR);
        const backups = files.filter(f => f.startsWith('asm.db.backup.')).sort();
        
        while (backups.length > 5) {
            const fileToDelete = backups.shift();
            fs.unlinkSync(path.join(DATA_DIR, fileToDelete));
            logger.info('Removed old backup', { file: fileToDelete });
        }
    } catch (error) {
        logger.error('Failed to create database backup', { error: error.message });
    }
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
    // ========================================================================
    // v2.0 Multi-User Tables
    // ========================================================================

    // Users table
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE,
            password_hash TEXT,
            firstName TEXT NOT NULL,
            lastName TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'scout',
            isActive INTEGER DEFAULT 1,
            emailVerified INTEGER DEFAULT 0,
            dateOfBirth TEXT,
            isMinor INTEGER DEFAULT 0,
            parentEmail TEXT,
            parentConsentDate TEXT,
            parentConsentIP TEXT,
            googleId TEXT UNIQUE,
            photoUrl TEXT,
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
            lastLogin TEXT,
            CONSTRAINT role_check CHECK (role IN ('scout', 'troop_leader', 'council_admin', 'parent'))
        )
    `);

    // Sessions table
    db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER NOT NULL,
            sessionToken TEXT UNIQUE NOT NULL,
            expiresAt TEXT NOT NULL,
            ipAddress TEXT,
            userAgent TEXT,
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
        )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(sessionToken)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_userId ON sessions(userId)');

    // Councils table
    db.exec(`
        CREATE TABLE IF NOT EXISTS councils (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            region TEXT,
            contactEmail TEXT,
            contactPhone TEXT,
            address TEXT,
            website TEXT,
            settings TEXT,
            isActive INTEGER DEFAULT 1,
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
            updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Troops table
    db.exec(`
        CREATE TABLE IF NOT EXISTS troops (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            councilId INTEGER,
            troopNumber TEXT NOT NULL,
            troopType TEXT NOT NULL,
            leaderId INTEGER,
            meetingLocation TEXT,
            meetingDay TEXT,
            meetingTime TEXT,
            settings TEXT,
            isActive INTEGER DEFAULT 1,
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
            updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (councilId) REFERENCES councils(id) ON DELETE SET NULL,
            FOREIGN KEY (leaderId) REFERENCES users(id) ON DELETE SET NULL,
            CONSTRAINT troopType_check CHECK (troopType IN ('daisy', 'brownie', 'junior', 'cadette', 'senior', 'ambassador', 'multi-level'))
        )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_troops_councilId ON troops(councilId)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_troops_leaderId ON troops(leaderId)');

    // Troop members table
    db.exec(`
        CREATE TABLE IF NOT EXISTS troop_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            troopId INTEGER NOT NULL,
            userId INTEGER NOT NULL,
            role TEXT NOT NULL DEFAULT 'member',
            scoutLevel TEXT,
            linkedParentId INTEGER,
            parentRole TEXT,
            joinDate TEXT DEFAULT CURRENT_TIMESTAMP,
            leaveDate TEXT,
            status TEXT DEFAULT 'active',
            FOREIGN KEY (troopId) REFERENCES troops(id) ON DELETE CASCADE,
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (linkedParentId) REFERENCES users(id) ON DELETE SET NULL,
            CONSTRAINT role_check CHECK (role IN ('member', 'co-leader', 'assistant', 'parent')),
            CONSTRAINT status_check CHECK (status IN ('active', 'inactive', 'transferred')),
            UNIQUE(troopId, userId)
        )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_troop_members_troopId ON troop_members(troopId)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_troop_members_userId ON troop_members(userId)');

    // Troop goals table
    db.exec(`
        CREATE TABLE IF NOT EXISTS troop_goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            troopId INTEGER NOT NULL,
            goalType TEXT NOT NULL,
            targetAmount REAL NOT NULL,
            actualAmount REAL DEFAULT 0,
            startDate TEXT NOT NULL,
            endDate TEXT NOT NULL,
            status TEXT DEFAULT 'in_progress',
            description TEXT,
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
            updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (troopId) REFERENCES troops(id) ON DELETE CASCADE,
            CONSTRAINT goalType_check CHECK (goalType IN ('boxes_sold', 'revenue', 'participation', 'events', 'donations')),
            CONSTRAINT status_check CHECK (status IN ('in_progress', 'completed', 'cancelled'))
        )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_troop_goals_troopId ON troop_goals(troopId)');

    // Audit log table
    db.exec(`
        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER,
            action TEXT NOT NULL,
            resourceType TEXT NOT NULL,
            resourceId INTEGER,
            ipAddress TEXT,
            userAgent TEXT,
            details TEXT,
            timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
        )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_audit_log_userId ON audit_log(userId)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_audit_log_resourceType ON audit_log(resourceType, resourceId)');

    // Data deletion requests table (COPPA compliance)
    db.exec(`
        CREATE TABLE IF NOT EXISTS data_deletion_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER NOT NULL,
            requestedBy INTEGER NOT NULL,
            reason TEXT,
            requestDate TEXT DEFAULT CURRENT_TIMESTAMP,
            completionDate TEXT,
            status TEXT DEFAULT 'pending',
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (requestedBy) REFERENCES users(id) ON DELETE CASCADE,
            CONSTRAINT status_check CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled'))
        )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_data_deletion_userId ON data_deletion_requests(userId)');

    // Notifications table
    db.exec(`
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER NOT NULL,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            isRead INTEGER DEFAULT 0,
            actionUrl TEXT,
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
            readAt TEXT,
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
            CONSTRAINT type_check CHECK (type IN ('info', 'success', 'warning', 'error', 'achievement'))
        )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_notifications_userId ON notifications(userId)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_notifications_isRead ON notifications(userId, isRead)');

    // ========================================================================
    // Phase 3: Cookie Catalog Tables
    // ========================================================================

    // Seasons table
    db.exec(`
        CREATE TABLE IF NOT EXISTS seasons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            year TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            startDate TEXT NOT NULL,
            endDate TEXT NOT NULL,
            isActive INTEGER DEFAULT 0,
            pricePerBox REAL DEFAULT 6.00,
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
            updatedAt TEXT
        )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_seasons_active ON seasons(isActive)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_seasons_year ON seasons(year)');

    // Cookie products table
    db.exec(`
        CREATE TABLE IF NOT EXISTS cookie_products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            season TEXT NOT NULL,
            cookieName TEXT NOT NULL,
            shortName TEXT,
            description TEXT,
            pricePerBox REAL NOT NULL DEFAULT 6.00,
            boxesPerCase INTEGER DEFAULT 12,
            isActive INTEGER DEFAULT 1,
            sortOrder INTEGER DEFAULT 0,
            imageUrl TEXT,
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
            updatedAt TEXT,
            UNIQUE(season, cookieName)
        )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_cookie_products_season ON cookie_products(season)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_cookie_products_active ON cookie_products(season, isActive)');

    // Cookie attributes table (dietary, allergen, certification info)
    db.exec(`
        CREATE TABLE IF NOT EXISTS cookie_attributes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            productId INTEGER NOT NULL,
            attributeType TEXT NOT NULL,
            attributeValue TEXT NOT NULL,
            displayLabel TEXT,
            FOREIGN KEY (productId) REFERENCES cookie_products(id) ON DELETE CASCADE,
            CONSTRAINT attributeType_check CHECK (attributeType IN ('dietary', 'allergen', 'certification'))
        )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_cookie_attributes_product ON cookie_attributes(productId)');

    // Cookie nutrition table
    db.exec(`
        CREATE TABLE IF NOT EXISTS cookie_nutrition (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            productId INTEGER NOT NULL UNIQUE,
            servingSize TEXT,
            servingsPerBox INTEGER,
            calories INTEGER,
            totalFat REAL,
            saturatedFat REAL,
            transFat REAL,
            cholesterol REAL,
            sodium REAL,
            totalCarbs REAL,
            dietaryFiber REAL,
            sugars REAL,
            protein REAL,
            ingredients TEXT,
            FOREIGN KEY (productId) REFERENCES cookie_products(id) ON DELETE CASCADE
        )
    `);

    // ========================================================================
    // Phase 3: Troop Invitations Table
    // ========================================================================

    db.exec(`
        CREATE TABLE IF NOT EXISTS troop_invitations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            troopId INTEGER NOT NULL,
            invitedEmail TEXT NOT NULL,
            invitedUserId INTEGER,
            invitedRole TEXT NOT NULL DEFAULT 'member',
            invitedBy INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            status TEXT DEFAULT 'pending',
            expiresAt TEXT NOT NULL,
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
            respondedAt TEXT,
            FOREIGN KEY (troopId) REFERENCES troops(id) ON DELETE CASCADE,
            FOREIGN KEY (invitedUserId) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY (invitedBy) REFERENCES users(id) ON DELETE CASCADE,
            CONSTRAINT status_check CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
            CONSTRAINT role_check CHECK (invitedRole IN ('member', 'scout', 'parent', 'co-leader', 'assistant', 'cookie_leader'))
        )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_troop_invitations_token ON troop_invitations(token)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_troop_invitations_email ON troop_invitations(invitedEmail)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_troop_invitations_user ON troop_invitations(invitedUserId)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_troop_invitations_troop ON troop_invitations(troopId)');

    // ========================================================================
    // Core Data Tables (with userId support for v2.0)
    // ========================================================================

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
            paymentMethod TEXT,
            userId INTEGER REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS profile (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER UNIQUE REFERENCES users(id),
            scoutName TEXT,
            email TEXT,
            photoData TEXT,
            qrCodeUrl TEXT,
            goalBoxes INTEGER DEFAULT 0,
            goalAmount REAL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS donations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            amount REAL NOT NULL,
            donorName TEXT NOT NULL,
            date TEXT NOT NULL,
            userId INTEGER REFERENCES users(id)
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
            donationsReceived REAL DEFAULT 0,
            userId INTEGER REFERENCES users(id),
            troopId INTEGER REFERENCES troops(id)
        );

        CREATE TABLE IF NOT EXISTS payment_methods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            isEnabled INTEGER DEFAULT 1,
            userId INTEGER REFERENCES users(id)
        );
    `);

    // Create indexes for userId columns
    db.exec('CREATE INDEX IF NOT EXISTS idx_sales_userId ON sales(userId)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_profile_userId ON profile(userId)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_donations_userId ON donations(userId)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_events_userId ON events(userId)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_events_troopId ON events(troopId)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_payment_methods_userId ON payment_methods(userId)');
    
    // ========================================================================
    // Migrations for existing tables
    // ========================================================================

    // Helper function to check if column exists
    const columnExists = (tableName, columnName) => {
        const info = db.prepare(`PRAGMA table_info(${tableName})`).all();
        return info.some(col => col.name === columnName);
    };

    // Migration: Add saleType column to existing sales table if it doesn't exist
    const tableInfo = db.prepare("PRAGMA table_info(sales)").all();
    const hasSaleType = tableInfo.some(col => col.name === 'saleType');
    if (!hasSaleType) {
        db.exec(`ALTER TABLE sales ADD COLUMN saleType TEXT DEFAULT 'individual'`);
        logger.info('Migration: Added saleType column to sales table');
    }

    // Migration: Add userId to sales if it doesn't exist
    if (!columnExists('sales', 'userId')) {
        db.exec(`ALTER TABLE sales ADD COLUMN userId INTEGER REFERENCES users(id)`);
        logger.info('Migration: Added userId column to sales table');
    }

    // Migration: Add paymentQrCodeUrl column to profile table if it doesn't exist
    const profileTableInfo = db.prepare("PRAGMA table_info(profile)").all();
    const hasPaymentQrCodeUrl = profileTableInfo.some(col => col.name === 'paymentQrCodeUrl');
    if (!hasPaymentQrCodeUrl) {
        db.exec(`ALTER TABLE profile ADD COLUMN paymentQrCodeUrl TEXT`);
        logger.info('Migration: Added paymentQrCodeUrl column to profile table');
    }

    // Migration: Add userId to profile if it doesn't exist
    if (!columnExists('profile', 'userId')) {
        db.exec(`ALTER TABLE profile ADD COLUMN userId INTEGER REFERENCES users(id)`);
        logger.info('Migration: Added userId column to profile table');
    }

    // Migration: Add scoutName and email to profile if they don't exist
    if (!columnExists('profile', 'scoutName')) {
        db.exec(`ALTER TABLE profile ADD COLUMN scoutName TEXT`);
        logger.info('Migration: Added scoutName column to profile table');
    }
    if (!columnExists('profile', 'email')) {
        db.exec(`ALTER TABLE profile ADD COLUMN email TEXT`);
        logger.info('Migration: Added email column to profile table');
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

    // Migration: Add userId to donations if it doesn't exist
    if (!columnExists('donations', 'userId')) {
        db.exec(`ALTER TABLE donations ADD COLUMN userId INTEGER REFERENCES users(id)`);
        logger.info('Migration: Added userId column to donations table');
    }

    // Migration: Add userId and troopId to events if they don't exist
    if (!columnExists('events', 'userId')) {
        db.exec(`ALTER TABLE events ADD COLUMN userId INTEGER REFERENCES users(id)`);
        logger.info('Migration: Added userId column to events table');
    }
    if (!columnExists('events', 'troopId')) {
        db.exec(`ALTER TABLE events ADD COLUMN troopId INTEGER REFERENCES troops(id)`);
        logger.info('Migration: Added troopId column to events table');
    }

    // Migration: Add userId to payment_methods if it doesn't exist
    if (!columnExists('payment_methods', 'userId')) {
        db.exec(`ALTER TABLE payment_methods ADD COLUMN userId INTEGER REFERENCES users(id)`);
        logger.info('Migration: Added userId column to payment_methods table');
    }

    // ========================================================================
    // Phase 3 Migrations: New columns for existing tables
    // ========================================================================

    // Migration: Add new columns to troops table
    if (!columnExists('troops', 'troopName')) {
        db.exec(`ALTER TABLE troops ADD COLUMN troopName TEXT`);
        logger.info('Migration: Added troopName column to troops table');
    }
    if (!columnExists('troops', 'cookieLeaderId')) {
        db.exec(`ALTER TABLE troops ADD COLUMN cookieLeaderId INTEGER REFERENCES users(id)`);
        logger.info('Migration: Added cookieLeaderId column to troops table');
    }
    if (!columnExists('troops', 'season')) {
        db.exec(`ALTER TABLE troops ADD COLUMN season TEXT`);
        logger.info('Migration: Added season column to troops table');
    }
    if (!columnExists('troops', 'timezone')) {
        db.exec(`ALTER TABLE troops ADD COLUMN timezone TEXT DEFAULT 'America/New_York'`);
        logger.info('Migration: Added timezone column to troops table');
    }

    // Migration: Add new columns to troop_members table
    if (!columnExists('troop_members', 'linkedScoutId')) {
        db.exec(`ALTER TABLE troop_members ADD COLUMN linkedScoutId INTEGER REFERENCES users(id)`);
        logger.info('Migration: Added linkedScoutId column to troop_members table');
    }
    if (!columnExists('troop_members', 'notes')) {
        db.exec(`ALTER TABLE troop_members ADD COLUMN notes TEXT`);
        logger.info('Migration: Added notes column to troop_members table');
    }

    // Migration: Add createdBy column to troop_goals table
    if (!columnExists('troop_goals', 'createdBy')) {
        db.exec(`ALTER TABLE troop_goals ADD COLUMN createdBy INTEGER REFERENCES users(id)`);
        logger.info('Migration: Added createdBy column to troop_goals table');
    }

    // Migration: Add season column to sales table
    if (!columnExists('sales', 'season')) {
        db.exec(`ALTER TABLE sales ADD COLUMN season TEXT`);
        logger.info('Migration: Added season column to sales table');
    }

    // Create additional indexes for Phase 3
    db.exec('CREATE INDEX IF NOT EXISTS idx_troops_season ON troops(season)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_troops_cookieLeaderId ON troops(cookieLeaderId)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_sales_season ON sales(season)');

    // ========================================================================
    // Phase 3: Seed default 2026 cookie catalog
    // ========================================================================

    // Check if 2026 season exists, if not create it with default cookies
    const existingSeason = db.prepare('SELECT id FROM seasons WHERE year = ?').get('2026');
    if (!existingSeason) {
        logger.info('Seeding default 2026 cookie catalog...');

        // Create 2026 season
        db.prepare(`
            INSERT INTO seasons (year, name, startDate, endDate, isActive, pricePerBox)
            VALUES ('2026', '2026 Cookie Season', '2026-01-01', '2026-04-30', 1, 6.00)
        `).run();

        // Default cookies for 2026 season
        const defaultCookies = [
            { cookieName: 'Thin Mints', shortName: 'TM', description: 'Crisp chocolate cookies dipped in chocolatey coating', sortOrder: 1 },
            { cookieName: 'Samoas', shortName: 'SM', description: 'Caramel, coconut, and chocolatey stripes on vanilla cookies', sortOrder: 2 },
            { cookieName: 'Tagalongs', shortName: 'TG', description: 'Crispy cookies layered with peanut butter and covered in chocolate', sortOrder: 3 },
            { cookieName: 'Trefoils', shortName: 'TF', description: 'Traditional shortbread cookie in the iconic trefoil shape', sortOrder: 4 },
            { cookieName: 'Do-si-dos', shortName: 'DD', description: 'Oatmeal sandwich cookies with peanut butter filling', sortOrder: 5 },
            { cookieName: 'Lemon-Ups', shortName: 'LU', description: 'Crispy lemon cookies baked with inspiring messages', sortOrder: 6 },
            { cookieName: 'Adventurefuls', shortName: 'AF', description: 'Brownie-inspired cookies with caramel-flavored creme filling', sortOrder: 7 },
            { cookieName: 'Toffee-tastic', shortName: 'TT', description: 'Gluten-free butter cookies with toffee bits', sortOrder: 8 },
            { cookieName: 'Caramel Chocolate Chip', shortName: 'CCC', description: 'Gluten-free chewy cookies with caramel, semi-sweet chocolate chips, and sea salt', sortOrder: 9 }
        ];

        const insertCookie = db.prepare(`
            INSERT INTO cookie_products (season, cookieName, shortName, description, pricePerBox, sortOrder, isActive)
            VALUES ('2026', ?, ?, ?, 6.00, ?, 1)
        `);

        const insertAttribute = db.prepare(`
            INSERT INTO cookie_attributes (productId, attributeType, attributeValue, displayLabel)
            VALUES (?, ?, ?, ?)
        `);

        // Default attributes
        const defaultAttributes = [
            { cookieName: 'Thin Mints', type: 'dietary', value: 'vegan', label: 'Vegan' },
            { cookieName: 'Tagalongs', type: 'allergen', value: 'contains_peanuts', label: 'Contains Peanuts' },
            { cookieName: 'Do-si-dos', type: 'allergen', value: 'contains_peanuts', label: 'Contains Peanuts' },
            { cookieName: 'Samoas', type: 'allergen', value: 'contains_coconut', label: 'Contains Coconut' },
            { cookieName: 'Toffee-tastic', type: 'certification', value: 'gluten_free', label: 'Gluten Free' },
            { cookieName: 'Caramel Chocolate Chip', type: 'certification', value: 'gluten_free', label: 'Gluten Free' }
        ];

        // Insert cookies and track their IDs
        const cookieIds = {};
        for (const cookie of defaultCookies) {
            const result = insertCookie.run(cookie.cookieName, cookie.shortName, cookie.description, cookie.sortOrder);
            cookieIds[cookie.cookieName] = result.lastInsertRowid;
        }

        // Insert attributes
        for (const attr of defaultAttributes) {
            const productId = cookieIds[attr.cookieName];
            if (productId) {
                insertAttribute.run(productId, attr.type, attr.value, attr.label);
            }
        }

        logger.info('Seeded 2026 cookie catalog with 9 cookies and attributes');
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
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Session configuration
app.use(session({
    store: new SQLiteStore({
        db: 'sessions.db',
        dir: DATA_DIR
    }),
    secret: process.env.SESSION_SECRET || 'asm-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Require HTTPS in production
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: 'lax'
    }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());
const passportStrategies = configurePassport(db);

// Clean up expired sessions daily
setInterval(() => {
    auth.cleanupExpiredSessions(db);
}, 24 * 60 * 60 * 1000);

app.use('/api/', limiter); // Apply rate limiting to all API routes

// Serve login and register pages without authentication
app.get('/login.html', (req, res, next) => {
    // If already authenticated, redirect to main page
    if (req.session && req.session.userId) {
        return res.redirect('/');
    }
    next();
});

app.get('/register.html', (req, res, next) => {
    // If already authenticated, redirect to main page
    if (req.session && req.session.userId) {
        return res.redirect('/');
    }
    next();
});

// Protect the main page - redirect to login if not authenticated
app.get('/', (req, res, next) => {
    if (!req.session || !req.session.userId) {
        return res.redirect('/login.html');
    }
    next();
});

app.get('/index.html', (req, res, next) => {
    if (!req.session || !req.session.userId) {
        return res.redirect('/login.html');
    }
    next();
});

app.use(express.static('public'));

// ============================================================================
// Authentication Routes
// ============================================================================

// Register new user
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, firstName, lastName, dateOfBirth, parentEmail } = req.body;

        // Validate required fields
        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Validate email format
        if (!auth.isValidEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // Validate password strength
        const passwordValidation = auth.validatePassword(password);
        if (!passwordValidation.valid) {
            return res.status(400).json({ error: passwordValidation.message });
        }

        // Check if user already exists
        const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existingUser) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        // Check if minor (COPPA compliance)
        let isMinorUser = false;
        if (dateOfBirth) {
            isMinorUser = auth.isMinor(dateOfBirth);

            // If minor and no parent email, require it
            if (isMinorUser && !parentEmail) {
                return res.status(400).json({
                    error: 'Parent email required for users under 13'
                });
            }
        }

        // Hash password
        const passwordHash = await auth.hashPassword(password);

        // Create user
        const insertUser = db.prepare(`
            INSERT INTO users (
                email, password_hash, firstName, lastName,
                dateOfBirth, isMinor, parentEmail, role,
                isActive, emailVerified, createdAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `);

        const result = insertUser.run(
            email,
            passwordHash,
            firstName,
            lastName,
            dateOfBirth || null,
            isMinorUser ? 1 : 0,
            parentEmail || null,
            'scout', // Default role
            isMinorUser ? 0 : 1, // Require activation for minors
            0 // Email not verified
        );

        const userId = result.lastInsertRowid;

        // Create default profile
        db.prepare(`
            INSERT INTO profile (userId, scoutName, email)
            VALUES (?, ?, ?)
        `).run(userId, `${firstName} ${lastName}`.trim(), email);

        // Log audit event
        auth.logAuditEvent(db, userId, 'user_registered', req, { email });

        // Send notification if minor (parent consent required)
        if (isMinorUser) {
            auth.createNotification(
                db,
                userId,
                'info',
                'Account Pending',
                'Your account requires parental consent before activation. A consent email has been sent to your parent/guardian.'
            );
        }

        logger.info('New user registered', { userId, email, isMinor: isMinorUser });

        res.status(201).json({
            message: isMinorUser
                ? 'Registration successful. Parental consent required.'
                : 'Registration successful. Please log in.',
            userId,
            requiresConsent: isMinorUser
        });

    } catch (error) {
        logger.error('Registration error', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login with email/password
app.post('/api/auth/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) {
            logger.error('Login error', { error: err.message });
            return res.status(500).json({ error: 'Login failed' });
        }

        if (!user) {
            return res.status(401).json({ error: info.message || 'Invalid credentials' });
        }

        req.logIn(user, (err) => {
            if (err) {
                logger.error('Session creation error', { error: err.message });
                return res.status(500).json({ error: 'Failed to create session' });
            }

            // Store user info in session
            req.session.userId = user.id;
            req.session.userEmail = user.email;
            
            // Hardcoded superuser privilege for welefort@gmail.com
            if (user.email === 'welefort@gmail.com') {
                req.session.userRole = 'council_admin';
            } else {
                req.session.userRole = user.role;
            }

            // Log audit event
            auth.logAuditEvent(db, user.id, 'user_login', req, { method: 'local' });

            logger.info('User logged in', { userId: user.id, email: user.email });

            res.json({
                message: 'Login successful',
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role,
                    photoUrl: user.photoUrl
                }
            });
        });
    })(req, res, next);
});

// Google OAuth initiation
if (passportStrategies.google) {
    app.get('/auth/google',
        passport.authenticate('google', {
            scope: ['profile', 'email']
        })
    );

    // Google OAuth callback
    app.get('/auth/google/callback',
        passport.authenticate('google', { failureRedirect: '/login.html' }),
        (req, res) => {
            // Store user info in session
            req.session.userId = req.user.id;
            req.session.userEmail = req.user.email;
            
            // Hardcoded superuser privilege for welefort@gmail.com
            if (req.user.email === 'welefort@gmail.com') {
                req.session.userRole = 'council_admin';
            } else {
                req.session.userRole = req.user.role;
            }

            // Log audit event
            auth.logAuditEvent(db, req.user.id, 'user_login', req, { method: 'google' });

            logger.info('User logged in via Google', { userId: req.user.id, email: req.user.email });

            res.redirect('/');
        }
    );
}

// Logout
app.post('/api/auth/logout', auth.isAuthenticated, (req, res) => {
    const userId = req.session.userId;

    // Log audit event
    auth.logAuditEvent(db, userId, 'user_logout', req);

    req.logout((err) => {
        if (err) {
            logger.error('Logout error', { error: err.message });
            return res.status(500).json({ error: 'Logout failed' });
        }

        req.session.destroy((err) => {
            if (err) {
                logger.error('Session destruction error', { error: err.message });
            }

            res.clearCookie('connect.sid');
            res.json({ message: 'Logout successful' });
        });
    });
});

// Get current user
app.get('/api/auth/me', auth.isAuthenticated, (req, res) => {
    try {
        const user = db.prepare(`
            SELECT id, email, firstName, lastName, role, photoUrl,
                   isActive, emailVerified, dateOfBirth, isMinor, createdAt, lastLogin
            FROM users
            WHERE id = ?
        `).get(req.session.userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Hardcoded superuser privilege for welefort@gmail.com
        if (user.email === 'welefort@gmail.com') {
            user.role = 'council_admin';
        }

        res.json(user);
    } catch (error) {
        logger.error('Error fetching current user', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

// Get notifications for current user
app.get('/api/notifications', auth.isAuthenticated, (req, res) => {
    try {
        const notifications = db.prepare(`
            SELECT * FROM notifications
            WHERE userId = ?
            ORDER BY createdAt DESC
            LIMIT 50
        `).all(req.session.userId);

        res.json(notifications);
    } catch (error) {
        logger.error('Error fetching notifications', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// Mark notification as read
app.put('/api/notifications/:id/read', auth.isAuthenticated, (req, res) => {
    try {
        const { id } = req.params;

        const result = db.prepare(`
            UPDATE notifications
            SET isRead = 1, readAt = datetime('now')
            WHERE id = ? AND userId = ?
        `).run(id, req.session.userId);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        res.json({ success: true });
    } catch (error) {
        logger.error('Error marking notification as read', { error: error.message });
        res.status(500).json({ error: 'Failed to update notification' });
    }
});

// ============================================================================
// API Routes (Protected - require authentication)
// ============================================================================

// Get all sales (filtered by userId)
app.get('/api/sales', auth.isAuthenticated, (req, res) => {
    try {
        const sales = db.prepare('SELECT * FROM sales WHERE userId = ? ORDER BY id DESC').all(req.session.userId);
        res.json(sales);
    } catch (error) {
        logger.error('Error fetching sales', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to fetch sales' });
    }
});

// Add a new sale
app.post('/api/sales', auth.isAuthenticated, (req, res) => {
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
                orderNumber, orderType, orderStatus, userId
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
            cookieType, quantity, sanitizedCustomerName, saleDate, validSaleType,
            sanitizedCustomerAddress, sanitizedCustomerPhone, validUnitType,
            validAmountCollected, validAmountDue, validPaymentMethod,
            sanitizedOrderNumber, sanitizedOrderType, sanitizedOrderStatus,
            req.session.userId
        );

        const newSale = db.prepare('SELECT * FROM sales WHERE id = ?').get(result.lastInsertRowid);
        logger.info('Sale added successfully', { saleId: newSale.id, cookieType, quantity, saleType: validSaleType, userId: req.session.userId });
        res.status(201).json(newSale);
    } catch (error) {
        // Log error without sensitive request body data
        logger.error('Error adding sale', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to add sale' });
    }
});

// Update a sale (only owner can update)
app.put('/api/sales/:id', auth.isAuthenticated, (req, res) => {
    try {
        const { id } = req.params;
        const { orderStatus, amountCollected, amountDue } = req.body;

        // Check ownership
        const existingSale = db.prepare('SELECT userId FROM sales WHERE id = ?').get(id);
        if (!existingSale) {
            return res.status(404).json({ error: 'Sale not found' });
        }
        if (existingSale.userId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

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

        const updatedSale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
        logger.info('Sale updated successfully', { saleId: id, updates, userId: req.session.userId });
        res.json(updatedSale);
    } catch (error) {
        logger.error('Error updating sale', { error: error.message, stack: error.stack, saleId: req.params.id });
        res.status(500).json({ error: 'Failed to update sale' });
    }
});

// Delete a sale (only owner can delete)
app.delete('/api/sales/:id', auth.isAuthenticated, (req, res) => {
    try {
        const { id } = req.params;

        // Check ownership
        const existingSale = db.prepare('SELECT userId FROM sales WHERE id = ?').get(id);
        if (!existingSale) {
            logger.warn('Attempted to delete non-existent sale', { saleId: id });
            return res.status(404).json({ error: 'Sale not found' });
        }
        if (existingSale.userId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const stmt = db.prepare('DELETE FROM sales WHERE id = ?');
        stmt.run(id);

        logger.info('Sale deleted successfully', { saleId: id, userId: req.session.userId });
        res.json({ message: 'Sale deleted successfully' });
    } catch (error) {
        logger.error('Error deleting sale', { error: error.message, stack: error.stack, saleId: req.params.id });
        res.status(500).json({ error: 'Failed to delete sale' });
    }
});

// Get profile (for current user)
app.get('/api/profile', auth.isAuthenticated, (req, res) => {
    try {
        let profile = db.prepare('SELECT * FROM profile WHERE userId = ?').get(req.session.userId);

        // If no profile exists for this user, create one
        if (!profile) {
            const user = db.prepare('SELECT firstName, lastName, email FROM users WHERE id = ?').get(req.session.userId);
            const scoutName = user ? `${user.firstName} ${user.lastName}`.trim() : '';
            const email = user ? user.email : '';

            db.prepare(`
                INSERT INTO profile (userId, scoutName, email, goalBoxes, goalAmount)
                VALUES (?, ?, ?, 0, 0)
            `).run(req.session.userId, scoutName, email);

            profile = db.prepare('SELECT * FROM profile WHERE userId = ?').get(req.session.userId);
        }

        res.json(profile || {
            userId: req.session.userId,
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

// Update profile (for current user)
app.put('/api/profile', auth.isAuthenticated, (req, res) => {
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

        // Check if profile exists for this user
        const existingProfile = db.prepare('SELECT id FROM profile WHERE userId = ?').get(req.session.userId);

        if (existingProfile) {
            // Update existing profile
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
                WHERE userId = ?
            `);
            stmt.run(
                photoData, qrCodeUrl, paymentQrCodeUrl, validGoalBoxes, validGoalAmount,
                ...validatedInventory,
                req.session.userId
            );
        } else {
            // Create new profile
            const user = db.prepare('SELECT firstName, lastName, email FROM users WHERE id = ?').get(req.session.userId);
            const scoutName = user ? `${user.firstName} ${user.lastName}`.trim() : '';
            const email = user ? user.email : '';

            const stmt = db.prepare(`
                INSERT INTO profile (
                    userId, scoutName, email, photoData, qrCodeUrl, paymentQrCodeUrl,
                    goalBoxes, goalAmount,
                    inventoryThinMints, inventorySamoas, inventoryTagalongs,
                    inventoryTrefoils, inventoryDosiDos, inventoryLemonUps,
                    inventoryAdventurefuls, inventoryExploremores, inventoryToffeetastic
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            stmt.run(
                req.session.userId, scoutName, email,
                photoData, qrCodeUrl, paymentQrCodeUrl, validGoalBoxes, validGoalAmount,
                ...validatedInventory
            );
        }

        const updatedProfile = db.prepare('SELECT * FROM profile WHERE userId = ?').get(req.session.userId);
        logger.info('Profile updated successfully', {
            userId: req.session.userId,
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

// Get all donations (filtered by userId)
app.get('/api/donations', auth.isAuthenticated, (req, res) => {
    try {
        const donations = db.prepare('SELECT * FROM donations WHERE userId = ? ORDER BY id DESC').all(req.session.userId);
        res.json(donations);
    } catch (error) {
        logger.error('Error fetching donations', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to fetch donations' });
    }
});

// Add a new donation
app.post('/api/donations', auth.isAuthenticated, (req, res) => {
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

        const stmt = db.prepare('INSERT INTO donations (amount, donorName, date, userId) VALUES (?, ?, ?, ?)');
        const result = stmt.run(amount, sanitizedDonorName, donationDate, req.session.userId);

        const newDonation = db.prepare('SELECT * FROM donations WHERE id = ?').get(result.lastInsertRowid);
        logger.info('Donation added successfully', { donationId: newDonation.id, amount, userId: req.session.userId });
        res.status(201).json(newDonation);
    } catch (error) {
        logger.error('Error adding donation', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to add donation' });
    }
});

// Delete a donation (only owner can delete)
app.delete('/api/donations/:id', auth.isAuthenticated, (req, res) => {
    try {
        const { id } = req.params;

        // Check ownership
        const existingDonation = db.prepare('SELECT userId FROM donations WHERE id = ?').get(id);
        if (!existingDonation) {
            logger.warn('Attempted to delete non-existent donation', { donationId: id });
            return res.status(404).json({ error: 'Donation not found' });
        }
        if (existingDonation.userId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const stmt = db.prepare('DELETE FROM donations WHERE id = ?');
        stmt.run(id);

        logger.info('Donation deleted successfully', { donationId: id, userId: req.session.userId });
        res.json({ message: 'Donation deleted successfully' });
    } catch (error) {
        logger.error('Error deleting donation', { error: error.message, stack: error.stack, donationId: req.params.id });
        res.status(500).json({ error: 'Failed to delete donation' });
    }
});

// Get all events (filtered by userId)
app.get('/api/events', auth.isAuthenticated, (req, res) => {
    try {
        const events = db.prepare('SELECT * FROM events WHERE userId = ? ORDER BY eventDate DESC').all(req.session.userId);
        res.json(events);
    } catch (error) {
        logger.error('Error fetching events', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

// Add a new event
app.post('/api/events', auth.isAuthenticated, (req, res) => {
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
                donationsReceived, userId
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
            sanitizedEventName, validEventDate, sanitizedDescription,
            validInitialBoxes, validInitialCases, validRemainingBoxes, validRemainingCases,
            validDonationsReceived, req.session.userId
        );

        const newEvent = db.prepare('SELECT * FROM events WHERE id = ?').get(result.lastInsertRowid);
        logger.info('Event added successfully', { eventId: newEvent.id, eventName: sanitizedEventName, userId: req.session.userId });
        res.status(201).json(newEvent);
    } catch (error) {
        logger.error('Error adding event', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to add event' });
    }
});

// Update an event (only owner can update)
app.put('/api/events/:id', auth.isAuthenticated, (req, res) => {
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

        // Check ownership
        const existingEvent = db.prepare('SELECT userId FROM events WHERE id = ?').get(id);
        if (!existingEvent) {
            logger.warn('Attempted to update non-existent event', { eventId: id });
            return res.status(404).json({ error: 'Event not found' });
        }
        if (existingEvent.userId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

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
        stmt.run(
            sanitizedEventName, validEventDate, sanitizedDescription,
            validInitialBoxes, validInitialCases, validRemainingBoxes, validRemainingCases,
            validDonationsReceived, id
        );

        const updatedEvent = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
        logger.info('Event updated successfully', { eventId: id, userId: req.session.userId });
        res.json(updatedEvent);
    } catch (error) {
        logger.error('Error updating event', { error: error.message, stack: error.stack, eventId: req.params.id });
        res.status(500).json({ error: 'Failed to update event' });
    }
});

// Delete an event (only owner can delete)
app.delete('/api/events/:id', auth.isAuthenticated, (req, res) => {
    try {
        const { id } = req.params;

        // Check ownership
        const existingEvent = db.prepare('SELECT userId FROM events WHERE id = ?').get(id);
        if (!existingEvent) {
            logger.warn('Attempted to delete non-existent event', { eventId: id });
            return res.status(404).json({ error: 'Event not found' });
        }
        if (existingEvent.userId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const stmt = db.prepare('DELETE FROM events WHERE id = ?');
        stmt.run(id);

        logger.info('Event deleted successfully', { eventId: id, userId: req.session.userId });
        res.json({ message: 'Event deleted successfully' });
    } catch (error) {
        logger.error('Error deleting event', { error: error.message, stack: error.stack, eventId: req.params.id });
        res.status(500).json({ error: 'Failed to delete event' });
    }
});

// Import sales from XLSX file
app.post('/api/import', auth.isAuthenticated, upload.single('file'), async (req, res) => {
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

        // Cookie type mapping from XLSX columns to our cookie names
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

        const userId = req.session.userId;

        const insertStmt = db.prepare(`
            INSERT INTO sales (
                cookieType, quantity, customerName, customerAddress, customerPhone,
                date, saleType, unitType, orderNumber, orderType, orderStatus, customerEmail, userId
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                        customerEmail,
                        userId
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
                            customerEmail,
                            userId
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
            importedSales: importedCount,
            userId
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

// Get payment methods (filtered by userId)
app.get('/api/payment-methods', auth.isAuthenticated, (req, res) => {
    try {
        const methods = db.prepare('SELECT * FROM payment_methods WHERE userId = ? ORDER BY id ASC').all(req.session.userId);
        res.json(methods);
    } catch (error) {
        logger.error('Error fetching payment methods', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to fetch payment methods' });
    }
});

// Add payment method
app.post('/api/payment-methods', auth.isAuthenticated, (req, res) => {
    try {
        const { name, url } = req.body;

        if (!name || !url) {
            return res.status(400).json({ error: 'Name and URL are required' });
        }

        const stmt = db.prepare('INSERT INTO payment_methods (name, url, userId) VALUES (?, ?, ?)');
        const result = stmt.run(name.trim(), url.trim(), req.session.userId);

        const newMethod = db.prepare('SELECT * FROM payment_methods WHERE id = ?').get(result.lastInsertRowid);
        logger.info('Payment method added', { id: newMethod.id, name, userId: req.session.userId });
        res.status(201).json(newMethod);
    } catch (error) {
        logger.error('Error adding payment method', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to add payment method' });
    }
});

// Delete payment method (only owner can delete)
app.delete('/api/payment-methods/:id', auth.isAuthenticated, (req, res) => {
    try {
        const { id } = req.params;

        // Check ownership
        const existingMethod = db.prepare('SELECT userId FROM payment_methods WHERE id = ?').get(id);
        if (!existingMethod) {
            return res.status(404).json({ error: 'Payment method not found' });
        }
        if (existingMethod.userId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const result = db.prepare('DELETE FROM payment_methods WHERE id = ?').run(id);

        logger.info('Payment method deleted', { id, userId: req.session.userId });
        res.json({ success: true });
    } catch (error) {
        logger.error('Error deleting payment method', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to delete payment method' });
    }
});



// Delete all sales (only current user's sales)
app.delete('/api/sales', auth.isAuthenticated, (req, res) => {
    try {
        const result = db.prepare('DELETE FROM sales WHERE userId = ?').run(req.session.userId);
        logger.info('All user sales deleted', { deletedCount: result.changes, userId: req.session.userId });
        res.json({ success: true, deletedCount: result.changes });
    } catch (error) {
        logger.error('Failed to delete sales', { error: error.message });
        res.status(500).json({ error: 'Failed to delete sales' });
    }
});

// Delete all donations (only current user's donations)
app.delete('/api/donations', auth.isAuthenticated, (req, res) => {
    try {
        const result = db.prepare('DELETE FROM donations WHERE userId = ?').run(req.session.userId);
        logger.info('All user donations deleted', { deletedCount: result.changes, userId: req.session.userId });
        res.json({ success: true, deletedCount: result.changes });
    } catch (error) {
        logger.error('Failed to delete donations', { error: error.message });
        res.status(500).json({ error: 'Failed to delete donations' });
    }
});

// Delete all data (only current user's sales and donations)
app.delete('/api/data', auth.isAuthenticated, (req, res) => {
    try {
        const deleteTransaction = db.transaction(() => {
            const salesResult = db.prepare('DELETE FROM sales WHERE userId = ?').run(req.session.userId);
            const donationsResult = db.prepare('DELETE FROM donations WHERE userId = ?').run(req.session.userId);
            return { salesDeleted: salesResult.changes, donationsDeleted: donationsResult.changes };
        });

        const results = deleteTransaction();
        logger.info('All user data cleared', { ...results, userId: req.session.userId });
        res.json({ success: true, ...results });
    } catch (error) {
        logger.error('Failed to clear data', { error: error.message });
        res.status(500).json({ error: 'Failed to clear data' });
    }
});



// ============================================================================
// Troop Management Routes (Phase 2)
// ============================================================================

// Get all troops for current user (as leader) or all troops (as council_admin)
app.get('/api/troop/my-troops', auth.isAuthenticated, (req, res) => {
    try {
        let troops;
        if (req.session.userRole === 'council_admin') {
            // Council admin sees all troops
            troops = db.prepare(`
                SELECT t.*, u.firstName || ' ' || u.lastName as leaderName,
                       (SELECT COUNT(*) FROM troop_members WHERE troopId = t.id AND status = 'active') as memberCount
                FROM troops t
                LEFT JOIN users u ON t.leaderId = u.id
                WHERE t.isActive = 1
                ORDER BY t.troopNumber
            `).all();
        } else {
            // Troop leader sees only their troops
            troops = db.prepare(`
                SELECT t.*, u.firstName || ' ' || u.lastName as leaderName,
                       (SELECT COUNT(*) FROM troop_members WHERE troopId = t.id AND status = 'active') as memberCount
                FROM troops t
                LEFT JOIN users u ON t.leaderId = u.id
                WHERE t.leaderId = ? AND t.isActive = 1
                ORDER BY t.troopNumber
            `).all(req.session.userId);
        }
        res.json(troops);
    } catch (error) {
        logger.error('Error fetching troops', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch troops' });
    }
});

// Get members of a specific troop with sales summaries
app.get('/api/troop/:troopId/members', auth.isAuthenticated, (req, res) => {
    try {
        const { troopId } = req.params;

        // Verify user has access to this troop
        const troop = db.prepare('SELECT * FROM troops WHERE id = ?').get(troopId);
        if (!troop) {
            return res.status(404).json({ error: 'Troop not found' });
        }
        if (troop.leaderId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Get members with their sales summaries
        const members = db.prepare(`
            SELECT
                u.id, u.email, u.firstName, u.lastName, u.photoUrl,
                tm.role as troopRole, tm.joinDate, tm.status,
                COALESCE(SUM(s.quantity), 0) as totalBoxes,
                COALESCE(SUM(s.amountCollected), 0) as totalCollected,
                MAX(s.date) as lastSaleDate
            FROM troop_members tm
            JOIN users u ON tm.userId = u.id
            LEFT JOIN sales s ON s.userId = u.id
            WHERE tm.troopId = ? AND tm.status = 'active'
            GROUP BY u.id
            ORDER BY u.lastName, u.firstName
        `).all(troopId);

        res.json(members);
    } catch (error) {
        logger.error('Error fetching troop members', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch troop members' });
    }
});

// Get aggregated sales data for a troop
app.get('/api/troop/:troopId/sales', auth.isAuthenticated, (req, res) => {
    try {
        const { troopId } = req.params;

        // Verify user has access to this troop
        const troop = db.prepare('SELECT * FROM troops WHERE id = ?').get(troopId);
        if (!troop) {
            return res.status(404).json({ error: 'Troop not found' });
        }
        if (troop.leaderId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Get sales by cookie type
        const salesByCookie = db.prepare(`
            SELECT
                s.cookieType,
                SUM(s.quantity) as totalQuantity,
                SUM(s.amountCollected) as totalCollected
            FROM sales s
            JOIN troop_members tm ON s.userId = tm.userId
            WHERE tm.troopId = ? AND tm.status = 'active'
            GROUP BY s.cookieType
            ORDER BY totalQuantity DESC
        `).all(troopId);

        // Get totals
        const totals = db.prepare(`
            SELECT
                COALESCE(SUM(s.quantity), 0) as totalBoxes,
                COALESCE(SUM(s.amountCollected), 0) as totalCollected,
                COALESCE(SUM(s.amountDue), 0) as totalDue
            FROM sales s
            JOIN troop_members tm ON s.userId = tm.userId
            WHERE tm.troopId = ? AND tm.status = 'active'
        `).get(troopId);

        res.json({
            salesByCookie,
            totals
        });
    } catch (error) {
        logger.error('Error fetching troop sales', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch troop sales' });
    }
});

// Get troop goals
app.get('/api/troop/:troopId/goals', auth.isAuthenticated, (req, res) => {
    try {
        const { troopId } = req.params;

        // Verify user has access to this troop
        const troop = db.prepare('SELECT * FROM troops WHERE id = ?').get(troopId);
        if (!troop) {
            return res.status(404).json({ error: 'Troop not found' });
        }
        if (troop.leaderId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const goals = db.prepare(`
            SELECT * FROM troop_goals
            WHERE troopId = ?
            ORDER BY status, endDate
        `).all(troopId);

        res.json(goals);
    } catch (error) {
        logger.error('Error fetching troop goals', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch troop goals' });
    }
});

// Create a new troop
app.post('/api/troop', auth.isAuthenticated, auth.hasRole('troop_leader', 'council_admin'), (req, res) => {
    try {
        const { troopNumber, troopType, meetingLocation, meetingDay, meetingTime } = req.body;

        if (!troopNumber || !troopType) {
            return res.status(400).json({ error: 'Troop number and type are required' });
        }

        const validTypes = ['daisy', 'brownie', 'junior', 'cadette', 'senior', 'ambassador', 'multi-level'];
        if (!validTypes.includes(troopType)) {
            return res.status(400).json({ error: 'Invalid troop type' });
        }

        const stmt = db.prepare(`
            INSERT INTO troops (troopNumber, troopType, leaderId, meetingLocation, meetingDay, meetingTime, isActive, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
        `);
        const result = stmt.run(
            troopNumber.trim(),
            troopType,
            req.session.userId,
            meetingLocation?.trim() || null,
            meetingDay?.trim() || null,
            meetingTime?.trim() || null
        );

        const newTroop = db.prepare('SELECT * FROM troops WHERE id = ?').get(result.lastInsertRowid);
        logger.info('Troop created', { troopId: newTroop.id, troopNumber, userId: req.session.userId });
        res.status(201).json(newTroop);
    } catch (error) {
        logger.error('Error creating troop', { error: error.message });
        res.status(500).json({ error: 'Failed to create troop' });
    }
});

// Update a troop
app.put('/api/troop/:troopId', auth.isAuthenticated, (req, res) => {
    try {
        const { troopId } = req.params;
        const { troopNumber, troopType, meetingLocation, meetingDay, meetingTime, leaderId } = req.body;

        // Verify user has access
        const troop = db.prepare('SELECT * FROM troops WHERE id = ?').get(troopId);
        if (!troop) {
            return res.status(404).json({ error: 'Troop not found' });
        }
        if (troop.leaderId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const stmt = db.prepare(`
            UPDATE troops SET
                troopNumber = COALESCE(?, troopNumber),
                troopType = COALESCE(?, troopType),
                meetingLocation = ?,
                meetingDay = ?,
                meetingTime = ?,
                leaderId = COALESCE(?, leaderId),
                updatedAt = datetime('now')
            WHERE id = ?
        `);
        stmt.run(
            troopNumber?.trim() || null,
            troopType || null,
            meetingLocation?.trim() || null,
            meetingDay?.trim() || null,
            meetingTime?.trim() || null,
            leaderId || null,
            troopId
        );

        const updatedTroop = db.prepare('SELECT * FROM troops WHERE id = ?').get(troopId);
        logger.info('Troop updated', { troopId, userId: req.session.userId });
        res.json(updatedTroop);
    } catch (error) {
        logger.error('Error updating troop', { error: error.message });
        res.status(500).json({ error: 'Failed to update troop' });
    }
});

// Add member to troop
app.post('/api/troop/:troopId/members', auth.isAuthenticated, (req, res) => {
    try {
        const { troopId } = req.params;
        const { email, role } = req.body;

        // Verify user has access
        const troop = db.prepare('SELECT * FROM troops WHERE id = ?').get(troopId);
        if (!troop) {
            return res.status(404).json({ error: 'Troop not found' });
        }
        if (troop.leaderId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Find user by email
        const user = db.prepare('SELECT id, firstName, lastName, email FROM users WHERE email = ?').get(email);
        if (!user) {
            return res.status(404).json({ error: 'User not found with that email' });
        }

        // Check if already a member
        const existingMember = db.prepare('SELECT * FROM troop_members WHERE troopId = ? AND userId = ?').get(troopId, user.id);
        if (existingMember) {
            if (existingMember.status === 'active') {
                return res.status(409).json({ error: 'User is already a member of this troop' });
            }
            // Reactivate if previously inactive
            db.prepare('UPDATE troop_members SET status = ?, role = ?, joinDate = datetime(\'now\') WHERE id = ?')
                .run('active', role || 'member', existingMember.id);
        } else {
            // Add new member
            const validRoles = ['member', 'co-leader', 'assistant'];
            const memberRole = validRoles.includes(role) ? role : 'member';

            db.prepare(`
                INSERT INTO troop_members (troopId, userId, role, joinDate, status)
                VALUES (?, ?, ?, datetime('now'), 'active')
            `).run(troopId, user.id, memberRole);
        }

        logger.info('Member added to troop', { troopId, userId: user.id, addedBy: req.session.userId });
        res.status(201).json({ success: true, member: user });
    } catch (error) {
        logger.error('Error adding troop member', { error: error.message });
        res.status(500).json({ error: 'Failed to add member' });
    }
});

// Add new scout with parent information to troop
app.post('/api/troop/:troopId/members/scout', auth.isAuthenticated, (req, res) => {
    try {
        const { troopId } = req.params;
        const {
            scoutFirstName,
            scoutLastName,
            scoutLevel,
            scoutDateOfBirth,
            parentFirstName,
            parentLastName,
            parentEmail,
            parentPhone,
            parentRole,
            secondaryParentFirstName,
            secondaryParentLastName,
            secondaryParentEmail,
            secondaryParentPhone,
            secondaryParentRole
        } = req.body;

        // Validate required fields
        if (!scoutFirstName || !scoutLastName) {
            return res.status(400).json({ error: 'Scout first and last name are required' });
        }
        if (!parentFirstName || !parentLastName) {
            return res.status(400).json({ error: 'Parent first and last name are required' });
        }
        if (!parentRole) {
            return res.status(400).json({ error: 'Parent role is required' });
        }

        // Verify user has access to manage this troop
        const troop = db.prepare('SELECT * FROM troops WHERE id = ?').get(troopId);
        if (!troop) {
            return res.status(404).json({ error: 'Troop not found' });
        }
        if (troop.leaderId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Use transaction for multi-step operation
        const transaction = db.transaction(() => {
            let parentUserId = null;
            let secondaryParentUserId = null;

            // Create or find primary parent account
            if (parentEmail) {
                // Check if parent already exists by email
                const existingParent = db.prepare('SELECT id FROM users WHERE email = ?').get(parentEmail);
                if (existingParent) {
                    parentUserId = existingParent.id;
                } else {
                    // Create new parent account
                    const insertParent = db.prepare(`
                        INSERT INTO users (firstName, lastName, email, role, isActive, createdAt)
                        VALUES (?, ?, ?, 'parent', 1, datetime('now'))
                    `);
                    const parentResult = insertParent.run(parentFirstName, parentLastName, parentEmail);
                    parentUserId = parentResult.lastInsertRowid;
                }
            } else {
                // Create parent account without email (can't login until email added)
                const insertParent = db.prepare(`
                    INSERT INTO users (firstName, lastName, email, role, isActive, createdAt)
                    VALUES (?, ?, NULL, 'parent', 1, datetime('now'))
                `);
                const parentResult = insertParent.run(parentFirstName, parentLastName);
                parentUserId = parentResult.lastInsertRowid;
            }

            // Create secondary parent if provided
            if (secondaryParentFirstName && secondaryParentLastName) {
                if (secondaryParentEmail) {
                    // Check if secondary parent already exists by email
                    const existingSecondary = db.prepare('SELECT id FROM users WHERE email = ?').get(secondaryParentEmail);
                    if (existingSecondary) {
                        secondaryParentUserId = existingSecondary.id;
                    } else {
                        // Create new secondary parent account
                        const insertSecondary = db.prepare(`
                            INSERT INTO users (firstName, lastName, email, role, isActive, createdAt)
                            VALUES (?, ?, ?, 'parent', 1, datetime('now'))
                        `);
                        const secondaryResult = insertSecondary.run(secondaryParentFirstName, secondaryParentLastName, secondaryParentEmail);
                        secondaryParentUserId = secondaryResult.lastInsertRowid;
                    }
                } else {
                    // Create secondary parent account without email
                    const insertSecondary = db.prepare(`
                        INSERT INTO users (firstName, lastName, email, role, isActive, createdAt)
                        VALUES (?, ?, NULL, 'parent', 1, datetime('now'))
                    `);
                    const secondaryResult = insertSecondary.run(secondaryParentFirstName, secondaryParentLastName);
                    secondaryParentUserId = secondaryResult.lastInsertRowid;
                }
            }

            // Create scout account (no email required)
            const insertScout = db.prepare(`
                INSERT INTO users (firstName, lastName, email, role, dateOfBirth, isActive, createdAt)
                VALUES (?, ?, NULL, 'scout', ?, 1, datetime('now'))
            `);
            const scoutResult = insertScout.run(scoutFirstName, scoutLastName, scoutDateOfBirth || null);
            const scoutUserId = scoutResult.lastInsertRowid;

            // Add scout to troop
            const insertScoutMember = db.prepare(`
                INSERT INTO troop_members (troopId, userId, role, scoutLevel, linkedParentId, parentRole, joinDate, status)
                VALUES (?, ?, 'member', ?, ?, ?, datetime('now'), 'active')
            `);
            insertScoutMember.run(troopId, scoutUserId, scoutLevel || null, parentUserId, parentRole);

            // Add primary parent to troop
            const insertParentMember = db.prepare(`
                INSERT INTO troop_members (troopId, userId, role, linkedParentId, parentRole, joinDate, status)
                VALUES (?, ?, 'parent', ?, ?, datetime('now'), 'active')
            `);
            insertParentMember.run(troopId, parentUserId, scoutUserId, parentRole);

            // Add secondary parent to troop if provided
            if (secondaryParentUserId) {
                insertParentMember.run(troopId, secondaryParentUserId, scoutUserId, secondaryParentRole || 'parent');
            }

            logger.info('Scout and parent(s) added to troop', {
                troopId,
                scoutId: scoutUserId,
                parentId: parentUserId,
                secondaryParentId: secondaryParentUserId,
                addedBy: req.session.userId
            });

            return {
                success: true,
                scout: {
                    id: scoutUserId,
                    firstName: scoutFirstName,
                    lastName: scoutLastName,
                    level: scoutLevel
                },
                parent: {
                    id: parentUserId,
                    firstName: parentFirstName,
                    lastName: parentLastName,
                    role: parentRole,
                    email: parentEmail
                },
                secondaryParent: secondaryParentUserId ? {
                    id: secondaryParentUserId,
                    firstName: secondaryParentFirstName,
                    lastName: secondaryParentLastName,
                    role: secondaryParentRole
                } : null
            };
        });

        const result = transaction();
        res.status(201).json(result);

    } catch (error) {
        logger.error('Error adding scout to troop', { error: error.message });
        res.status(500).json({ error: 'Failed to add scout' });
    }
});

// Remove member from troop
app.delete('/api/troop/:troopId/members/:userId', auth.isAuthenticated, (req, res) => {
    try {
        const { troopId, userId } = req.params;

        // Verify user has access
        const troop = db.prepare('SELECT * FROM troops WHERE id = ?').get(troopId);
        if (!troop) {
            return res.status(404).json({ error: 'Troop not found' });
        }
        if (troop.leaderId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Set member as inactive (soft delete)
        const result = db.prepare(`
            UPDATE troop_members SET status = 'inactive', leaveDate = datetime('now')
            WHERE troopId = ? AND userId = ?
        `).run(troopId, userId);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Member not found in this troop' });
        }

        logger.info('Member removed from troop', { troopId, userId, removedBy: req.session.userId });
        res.json({ success: true });
    } catch (error) {
        logger.error('Error removing troop member', { error: error.message });
        res.status(500).json({ error: 'Failed to remove member' });
    }
});

// Create troop goal
app.post('/api/troop/:troopId/goals', auth.isAuthenticated, (req, res) => {
    try {
        const { troopId } = req.params;
        const { goalType, targetAmount, startDate, endDate, description } = req.body;

        // Verify user has access
        const troop = db.prepare('SELECT * FROM troops WHERE id = ?').get(troopId);
        if (!troop) {
            return res.status(404).json({ error: 'Troop not found' });
        }
        if (troop.leaderId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const validGoalTypes = ['boxes_sold', 'revenue', 'participation', 'events', 'donations'];
        if (!validGoalTypes.includes(goalType)) {
            return res.status(400).json({ error: 'Invalid goal type' });
        }

        const stmt = db.prepare(`
            INSERT INTO troop_goals (troopId, goalType, targetAmount, startDate, endDate, description, status, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, 'in_progress', datetime('now'), datetime('now'))
        `);
        const result = stmt.run(troopId, goalType, targetAmount, startDate, endDate, description || null);

        const newGoal = db.prepare('SELECT * FROM troop_goals WHERE id = ?').get(result.lastInsertRowid);
        logger.info('Troop goal created', { goalId: newGoal.id, troopId, goalType });
        res.status(201).json(newGoal);
    } catch (error) {
        logger.error('Error creating troop goal', { error: error.message });
        res.status(500).json({ error: 'Failed to create goal' });
    }
});

// Get all users (for adding members) - council_admin or troop_leader
app.get('/api/users/search', auth.isAuthenticated, auth.hasRole('troop_leader', 'council_admin'), (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 2) {
            return res.json([]);
        }

        const users = db.prepare(`
            SELECT id, email, firstName, lastName, role
            FROM users
            WHERE (email LIKE ? OR firstName LIKE ? OR lastName LIKE ?)
            AND isActive = 1
            LIMIT 10
        `).all(`%${q}%`, `%${q}%`, `%${q}%`);

        res.json(users);
    } catch (error) {
        logger.error('Error searching users', { error: error.message });
        res.status(500).json({ error: 'Failed to search users' });
    }
});

// ============================================================================
// Phase 3: Cookie Catalog and Season Management Routes
// ============================================================================

// Get active season
app.get('/api/seasons/active', auth.isAuthenticated, (req, res) => {
    try {
        const season = db.prepare('SELECT * FROM seasons WHERE isActive = 1').get();
        res.json(season || null);
    } catch (error) {
        logger.error('Error fetching active season', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch active season' });
    }
});

// Get all seasons
app.get('/api/seasons', auth.isAuthenticated, (req, res) => {
    try {
        const seasons = db.prepare(`
            SELECT s.*,
                   (SELECT COUNT(*) FROM cookie_products WHERE season = s.year) as cookieCount
            FROM seasons s
            ORDER BY s.year DESC
        `).all();
        res.json(seasons);
    } catch (error) {
        logger.error('Error fetching seasons', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch seasons' });
    }
});

// Create new season
app.post('/api/seasons', auth.isAuthenticated, auth.hasRole('council_admin'), (req, res) => {
    try {
        const { year, name, startDate, endDate, pricePerBox, copyFromYear } = req.body;

        if (!year || !name || !startDate || !endDate) {
            return res.status(400).json({ error: 'Year, name, start date, and end date are required' });
        }

        // Check if season already exists
        const existing = db.prepare('SELECT id FROM seasons WHERE year = ?').get(year);
        if (existing) {
            return res.status(409).json({ error: 'Season already exists' });
        }

        // Create season
        const result = db.prepare(`
            INSERT INTO seasons (year, name, startDate, endDate, pricePerBox, isActive, createdAt)
            VALUES (?, ?, ?, ?, ?, 0, datetime('now'))
        `).run(year, name, startDate, endDate, pricePerBox || 6.00);

        // Copy cookies from another season if specified
        if (copyFromYear) {
            const cookiesToCopy = db.prepare(`
                SELECT cookieName, shortName, description, pricePerBox, boxesPerCase, sortOrder, imageUrl
                FROM cookie_products WHERE season = ?
            `).all(copyFromYear);

            const insertCookie = db.prepare(`
                INSERT INTO cookie_products (season, cookieName, shortName, description, pricePerBox, boxesPerCase, sortOrder, imageUrl, isActive)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
            `);

            for (const cookie of cookiesToCopy) {
                insertCookie.run(year, cookie.cookieName, cookie.shortName, cookie.description,
                    cookie.pricePerBox, cookie.boxesPerCase, cookie.sortOrder, cookie.imageUrl);
            }

            logger.info('Copied cookies from previous season', { fromYear: copyFromYear, toYear: year, count: cookiesToCopy.length });
        }

        const newSeason = db.prepare('SELECT * FROM seasons WHERE id = ?').get(result.lastInsertRowid);
        logger.info('Season created', { year, name });
        res.status(201).json(newSeason);
    } catch (error) {
        logger.error('Error creating season', { error: error.message });
        res.status(500).json({ error: 'Failed to create season' });
    }
});

// Activate a season
app.put('/api/seasons/:year/activate', auth.isAuthenticated, auth.hasRole('council_admin'), (req, res) => {
    try {
        const { year } = req.params;

        // Deactivate all seasons
        db.prepare('UPDATE seasons SET isActive = 0').run();

        // Activate specified season
        const result = db.prepare('UPDATE seasons SET isActive = 1, updatedAt = datetime(\'now\') WHERE year = ?').run(year);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Season not found' });
        }

        logger.info('Season activated', { year });
        res.json({ success: true, year });
    } catch (error) {
        logger.error('Error activating season', { error: error.message });
        res.status(500).json({ error: 'Failed to activate season' });
    }
});

// Get all cookies for a season (or active season if not specified)
app.get('/api/cookies', auth.isAuthenticated, (req, res) => {
    try {
        const { season, includeInactive } = req.query;

        // Get season to query
        let targetSeason = season;
        if (!targetSeason) {
            const active = db.prepare('SELECT year FROM seasons WHERE isActive = 1').get();
            targetSeason = active?.year || '2026';
        }

        // Build query
        let query = `
            SELECT cp.*,
                   json_group_array(
                       json_object('id', ca.id, 'type', ca.attributeType, 'value', ca.attributeValue, 'label', ca.displayLabel)
                   ) as attributesJson
            FROM cookie_products cp
            LEFT JOIN cookie_attributes ca ON cp.id = ca.productId
            WHERE cp.season = ?
        `;

        if (!includeInactive) {
            query += ' AND cp.isActive = 1';
        }

        query += ' GROUP BY cp.id ORDER BY cp.sortOrder, cp.cookieName';

        const cookies = db.prepare(query).all(targetSeason);

        // Parse attributes JSON
        const result = cookies.map(cookie => {
            let attributes = [];
            try {
                const parsed = JSON.parse(cookie.attributesJson);
                attributes = parsed.filter(a => a.id !== null);
            } catch (e) {
                attributes = [];
            }
            delete cookie.attributesJson;
            return { ...cookie, attributes };
        });

        res.json(result);
    } catch (error) {
        logger.error('Error fetching cookies', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch cookies' });
    }
});

// Get single cookie with nutrition info
app.get('/api/cookies/:id', auth.isAuthenticated, (req, res) => {
    try {
        const { id } = req.params;

        const cookie = db.prepare('SELECT * FROM cookie_products WHERE id = ?').get(id);
        if (!cookie) {
            return res.status(404).json({ error: 'Cookie not found' });
        }

        const attributes = db.prepare('SELECT * FROM cookie_attributes WHERE productId = ?').all(id);
        const nutrition = db.prepare('SELECT * FROM cookie_nutrition WHERE productId = ?').get(id);

        res.json({ ...cookie, attributes, nutrition });
    } catch (error) {
        logger.error('Error fetching cookie', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch cookie' });
    }
});

// Add new cookie
app.post('/api/cookies', auth.isAuthenticated, auth.hasRole('troop_leader', 'council_admin'), (req, res) => {
    try {
        const { season, cookieName, shortName, description, pricePerBox, boxesPerCase, sortOrder, imageUrl, attributes, nutrition } = req.body;

        if (!season || !cookieName) {
            return res.status(400).json({ error: 'Season and cookie name are required' });
        }

        // Insert cookie
        const result = db.prepare(`
            INSERT INTO cookie_products (season, cookieName, shortName, description, pricePerBox, boxesPerCase, sortOrder, imageUrl, isActive, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
        `).run(season, cookieName, shortName || null, description || null, pricePerBox || 6.00, boxesPerCase || 12, sortOrder || 0, imageUrl || null);

        const productId = result.lastInsertRowid;

        // Insert attributes if provided
        if (attributes && Array.isArray(attributes)) {
            const insertAttr = db.prepare(`
                INSERT INTO cookie_attributes (productId, attributeType, attributeValue, displayLabel)
                VALUES (?, ?, ?, ?)
            `);
            for (const attr of attributes) {
                insertAttr.run(productId, attr.type, attr.value, attr.label || null);
            }
        }

        // Insert nutrition if provided
        if (nutrition) {
            db.prepare(`
                INSERT INTO cookie_nutrition (productId, servingSize, servingsPerBox, calories, totalFat, saturatedFat, transFat, cholesterol, sodium, totalCarbs, dietaryFiber, sugars, protein, ingredients)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(productId, nutrition.servingSize, nutrition.servingsPerBox, nutrition.calories, nutrition.totalFat, nutrition.saturatedFat, nutrition.transFat, nutrition.cholesterol, nutrition.sodium, nutrition.totalCarbs, nutrition.dietaryFiber, nutrition.sugars, nutrition.protein, nutrition.ingredients);
        }

        const newCookie = db.prepare('SELECT * FROM cookie_products WHERE id = ?').get(productId);
        logger.info('Cookie created', { productId, cookieName, season });
        res.status(201).json(newCookie);
    } catch (error) {
        logger.error('Error creating cookie', { error: error.message });
        res.status(500).json({ error: 'Failed to create cookie' });
    }
});

// Update cookie
app.put('/api/cookies/:id', auth.isAuthenticated, auth.hasRole('troop_leader', 'council_admin'), (req, res) => {
    try {
        const { id } = req.params;
        const { cookieName, shortName, description, pricePerBox, boxesPerCase, sortOrder, imageUrl, isActive, attributes, nutrition } = req.body;

        const existing = db.prepare('SELECT id FROM cookie_products WHERE id = ?').get(id);
        if (!existing) {
            return res.status(404).json({ error: 'Cookie not found' });
        }

        // Update cookie
        db.prepare(`
            UPDATE cookie_products SET
                cookieName = COALESCE(?, cookieName),
                shortName = COALESCE(?, shortName),
                description = COALESCE(?, description),
                pricePerBox = COALESCE(?, pricePerBox),
                boxesPerCase = COALESCE(?, boxesPerCase),
                sortOrder = COALESCE(?, sortOrder),
                imageUrl = COALESCE(?, imageUrl),
                isActive = COALESCE(?, isActive),
                updatedAt = datetime('now')
            WHERE id = ?
        `).run(cookieName, shortName, description, pricePerBox, boxesPerCase, sortOrder, imageUrl, isActive, id);

        // Update attributes if provided (replace all)
        if (attributes && Array.isArray(attributes)) {
            db.prepare('DELETE FROM cookie_attributes WHERE productId = ?').run(id);
            const insertAttr = db.prepare(`
                INSERT INTO cookie_attributes (productId, attributeType, attributeValue, displayLabel)
                VALUES (?, ?, ?, ?)
            `);
            for (const attr of attributes) {
                insertAttr.run(id, attr.type, attr.value, attr.label || null);
            }
        }

        // Update nutrition if provided
        if (nutrition) {
            db.prepare('DELETE FROM cookie_nutrition WHERE productId = ?').run(id);
            db.prepare(`
                INSERT INTO cookie_nutrition (productId, servingSize, servingsPerBox, calories, totalFat, saturatedFat, transFat, cholesterol, sodium, totalCarbs, dietaryFiber, sugars, protein, ingredients)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(id, nutrition.servingSize, nutrition.servingsPerBox, nutrition.calories, nutrition.totalFat, nutrition.saturatedFat, nutrition.transFat, nutrition.cholesterol, nutrition.sodium, nutrition.totalCarbs, nutrition.dietaryFiber, nutrition.sugars, nutrition.protein, nutrition.ingredients);
        }

        const updatedCookie = db.prepare('SELECT * FROM cookie_products WHERE id = ?').get(id);
        logger.info('Cookie updated', { id });
        res.json(updatedCookie);
    } catch (error) {
        logger.error('Error updating cookie', { error: error.message });
        res.status(500).json({ error: 'Failed to update cookie' });
    }
});

// Deactivate cookie (soft delete)
app.delete('/api/cookies/:id', auth.isAuthenticated, auth.hasRole('troop_leader', 'council_admin'), (req, res) => {
    try {
        const { id } = req.params;

        const result = db.prepare('UPDATE cookie_products SET isActive = 0, updatedAt = datetime(\'now\') WHERE id = ?').run(id);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Cookie not found' });
        }

        logger.info('Cookie deactivated', { id });
        res.json({ success: true });
    } catch (error) {
        logger.error('Error deactivating cookie', { error: error.message });
        res.status(500).json({ error: 'Failed to deactivate cookie' });
    }
});

// ============================================================================
// Phase 3: Enhanced Troop Goal Routes
// ============================================================================

// Update troop goal
app.put('/api/troop/:troopId/goals/:goalId', auth.isAuthenticated, (req, res) => {
    try {
        const { troopId, goalId } = req.params;
        const { targetAmount, startDate, endDate, status, description } = req.body;

        // Verify user has access
        const troop = db.prepare('SELECT * FROM troops WHERE id = ?').get(troopId);
        if (!troop) {
            return res.status(404).json({ error: 'Troop not found' });
        }
        if (troop.leaderId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Check goal exists
        const goal = db.prepare('SELECT * FROM troop_goals WHERE id = ? AND troopId = ?').get(goalId, troopId);
        if (!goal) {
            return res.status(404).json({ error: 'Goal not found' });
        }

        db.prepare(`
            UPDATE troop_goals SET
                targetAmount = COALESCE(?, targetAmount),
                startDate = COALESCE(?, startDate),
                endDate = COALESCE(?, endDate),
                status = COALESCE(?, status),
                description = COALESCE(?, description),
                updatedAt = datetime('now')
            WHERE id = ?
        `).run(targetAmount, startDate, endDate, status, description, goalId);

        const updatedGoal = db.prepare('SELECT * FROM troop_goals WHERE id = ?').get(goalId);
        logger.info('Troop goal updated', { goalId, troopId });
        res.json(updatedGoal);
    } catch (error) {
        logger.error('Error updating troop goal', { error: error.message });
        res.status(500).json({ error: 'Failed to update goal' });
    }
});

// Delete troop goal
app.delete('/api/troop/:troopId/goals/:goalId', auth.isAuthenticated, (req, res) => {
    try {
        const { troopId, goalId } = req.params;

        // Verify user has access
        const troop = db.prepare('SELECT * FROM troops WHERE id = ?').get(troopId);
        if (!troop) {
            return res.status(404).json({ error: 'Troop not found' });
        }
        if (troop.leaderId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const result = db.prepare('DELETE FROM troop_goals WHERE id = ? AND troopId = ?').run(goalId, troopId);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Goal not found' });
        }

        logger.info('Troop goal deleted', { goalId, troopId });
        res.json({ success: true });
    } catch (error) {
        logger.error('Error deleting troop goal', { error: error.message });
        res.status(500).json({ error: 'Failed to delete goal' });
    }
});

// Get troop goal progress
app.get('/api/troop/:troopId/goals/progress', auth.isAuthenticated, (req, res) => {
    try {
        const { troopId } = req.params;

        // Verify user has access
        const troop = db.prepare('SELECT * FROM troops WHERE id = ?').get(troopId);
        if (!troop) {
            return res.status(404).json({ error: 'Troop not found' });
        }
        if (troop.leaderId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const goals = db.prepare('SELECT * FROM troop_goals WHERE troopId = ?').all(troopId);

        // Calculate actual amounts for each goal
        const goalsWithProgress = goals.map(goal => {
            let actualAmount = 0;

            switch (goal.goalType) {
                case 'boxes_sold':
                case 'total_boxes':
                    const boxesResult = db.prepare(`
                        SELECT COALESCE(SUM(CASE WHEN s.unitType = 'case' THEN s.quantity * 12 ELSE s.quantity END), 0) as total
                        FROM sales s
                        JOIN troop_members tm ON s.userId = tm.userId
                        WHERE tm.troopId = ? AND tm.status = 'active'
                        AND s.date BETWEEN ? AND ?
                    `).get(troopId, goal.startDate, goal.endDate);
                    actualAmount = boxesResult?.total || 0;
                    break;

                case 'revenue':
                case 'total_revenue':
                    const revenueResult = db.prepare(`
                        SELECT COALESCE(SUM(s.amountCollected), 0) as total
                        FROM sales s
                        JOIN troop_members tm ON s.userId = tm.userId
                        WHERE tm.troopId = ? AND tm.status = 'active'
                        AND s.date BETWEEN ? AND ?
                    `).get(troopId, goal.startDate, goal.endDate);
                    actualAmount = revenueResult?.total || 0;
                    break;

                case 'participation':
                    const totalMembers = db.prepare(`
                        SELECT COUNT(*) as count FROM troop_members WHERE troopId = ? AND status = 'active'
                    `).get(troopId);
                    const activeMembers = db.prepare(`
                        SELECT COUNT(DISTINCT tm.userId) as count
                        FROM troop_members tm
                        JOIN sales s ON s.userId = tm.userId
                        WHERE tm.troopId = ? AND tm.status = 'active'
                        AND s.date BETWEEN ? AND ?
                    `).get(troopId, goal.startDate, goal.endDate);
                    actualAmount = totalMembers?.count > 0
                        ? Math.round((activeMembers?.count || 0) / totalMembers.count * 100)
                        : 0;
                    break;

                case 'events':
                case 'event_count':
                    const eventsResult = db.prepare(`
                        SELECT COUNT(*) as count FROM events
                        WHERE troopId = ? AND eventDate BETWEEN ? AND ?
                    `).get(troopId, goal.startDate, goal.endDate);
                    actualAmount = eventsResult?.count || 0;
                    break;

                case 'donations':
                    const donationsResult = db.prepare(`
                        SELECT COALESCE(SUM(d.amount), 0) as total
                        FROM donations d
                        JOIN troop_members tm ON d.userId = tm.userId
                        WHERE tm.troopId = ? AND tm.status = 'active'
                        AND d.date BETWEEN ? AND ?
                    `).get(troopId, goal.startDate, goal.endDate);
                    actualAmount = donationsResult?.total || 0;
                    break;
            }

            const progress = goal.targetAmount > 0 ? Math.min((actualAmount / goal.targetAmount) * 100, 100) : 0;

            return {
                ...goal,
                actualAmount,
                progress: Math.round(progress * 10) / 10
            };
        });

        res.json(goalsWithProgress);
    } catch (error) {
        logger.error('Error fetching goal progress', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch goal progress' });
    }
});

// ============================================================================
// Phase 3: Leaderboard Route
// ============================================================================

app.get('/api/troop/:troopId/leaderboard', auth.isAuthenticated, (req, res) => {
    try {
        const { troopId } = req.params;
        const { limit = 10, metric = 'boxes' } = req.query;

        // Verify user has access
        const troop = db.prepare('SELECT * FROM troops WHERE id = ?').get(troopId);
        if (!troop) {
            return res.status(404).json({ error: 'Troop not found' });
        }
        if (troop.leaderId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const orderBy = metric === 'revenue' ? 'totalRevenue' : 'totalBoxes';

        const leaderboard = db.prepare(`
            SELECT
                u.id, u.firstName, u.lastName, u.photoUrl,
                COALESCE(SUM(CASE WHEN s.unitType = 'case' THEN s.quantity * 12 ELSE s.quantity END), 0) as totalBoxes,
                COALESCE(SUM(s.amountCollected), 0) as totalRevenue
            FROM troop_members tm
            JOIN users u ON tm.userId = u.id
            LEFT JOIN sales s ON s.userId = u.id
            WHERE tm.troopId = ? AND tm.status = 'active'
            GROUP BY u.id
            ORDER BY ${orderBy} DESC
            LIMIT ?
        `).all(troopId, parseInt(limit));

        // Add rank
        const rankedLeaderboard = leaderboard.map((member, index) => ({
            ...member,
            rank: index + 1
        }));

        res.json(rankedLeaderboard);
    } catch (error) {
        logger.error('Error fetching leaderboard', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

// ============================================================================
// Phase 3: Member Role Update Route
// ============================================================================

app.put('/api/troop/:troopId/members/:userId', auth.isAuthenticated, (req, res) => {
    try {
        const { troopId, userId } = req.params;
        const { role, linkedScoutId, notes } = req.body;

        // Verify user has access
        const troop = db.prepare('SELECT * FROM troops WHERE id = ?').get(troopId);
        if (!troop) {
            return res.status(404).json({ error: 'Troop not found' });
        }
        if (troop.leaderId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Check member exists
        const member = db.prepare('SELECT * FROM troop_members WHERE troopId = ? AND userId = ?').get(troopId, userId);
        if (!member) {
            return res.status(404).json({ error: 'Member not found' });
        }

        // Validate role if provided
        const validRoles = ['member', 'scout', 'parent', 'co-leader', 'assistant', 'cookie_leader'];
        if (role && !validRoles.includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        db.prepare(`
            UPDATE troop_members SET
                role = COALESCE(?, role),
                linkedScoutId = COALESCE(?, linkedScoutId),
                notes = COALESCE(?, notes)
            WHERE troopId = ? AND userId = ?
        `).run(role, linkedScoutId, notes, troopId, userId);

        const updatedMember = db.prepare(`
            SELECT tm.*, u.firstName, u.lastName, u.email
            FROM troop_members tm
            JOIN users u ON tm.userId = u.id
            WHERE tm.troopId = ? AND tm.userId = ?
        `).get(troopId, userId);

        logger.info('Troop member updated', { troopId, userId });
        res.json(updatedMember);
    } catch (error) {
        logger.error('Error updating troop member', { error: error.message });
        res.status(500).json({ error: 'Failed to update member' });
    }
});

// ============================================================================
// Phase 3: Invitation System Routes
// ============================================================================

// Send invitation
app.post('/api/troop/:troopId/invite', auth.isAuthenticated, (req, res) => {
    try {
        const { troopId } = req.params;
        const { email, role } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Verify user has access
        const troop = db.prepare('SELECT * FROM troops WHERE id = ?').get(troopId);
        if (!troop) {
            return res.status(404).json({ error: 'Troop not found' });
        }
        if (troop.leaderId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Check if user exists
        const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);

        // Check for existing pending invitation
        const existingInvite = db.prepare(`
            SELECT id FROM troop_invitations
            WHERE troopId = ? AND invitedEmail = ? AND status = 'pending'
        `).get(troopId, email);

        if (existingInvite) {
            return res.status(409).json({ error: 'Pending invitation already exists for this email' });
        }

        // Generate unique token
        const token = require('crypto').randomBytes(32).toString('hex');

        // Set expiry (7 days)
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        // Validate role
        const validRoles = ['member', 'scout', 'parent', 'co-leader', 'assistant', 'cookie_leader'];
        const inviteRole = validRoles.includes(role) ? role : 'member';

        // Create invitation
        const result = db.prepare(`
            INSERT INTO troop_invitations (troopId, invitedEmail, invitedUserId, invitedRole, invitedBy, token, expiresAt)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(troopId, email.toLowerCase(), user?.id || null, inviteRole, req.session.userId, token, expiresAt);

        // Create notification for user if they exist
        if (user) {
            auth.createNotification(
                db,
                user.id,
                'info',
                'Troop Invitation',
                `You've been invited to join Troop ${troop.troopNumber} as a ${inviteRole}.`,
                `/invitations`
            );
        }

        logger.info('Invitation sent', { troopId, email, invitedBy: req.session.userId });
        res.status(201).json({
            success: true,
            message: user ? 'Invitation sent to existing user' : 'Invitation sent (user will receive it after registration)',
            invitationId: result.lastInsertRowid
        });
    } catch (error) {
        logger.error('Error sending invitation', { error: error.message });
        res.status(500).json({ error: 'Failed to send invitation' });
    }
});

// Get user's pending invitations
app.get('/api/invitations', auth.isAuthenticated, (req, res) => {
    try {
        const user = db.prepare('SELECT email FROM users WHERE id = ?').get(req.session.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const invitations = db.prepare(`
            SELECT ti.*, t.troopNumber, t.troopType, t.troopName,
                   u.firstName as inviterFirstName, u.lastName as inviterLastName
            FROM troop_invitations ti
            JOIN troops t ON ti.troopId = t.id
            JOIN users u ON ti.invitedBy = u.id
            WHERE (ti.invitedUserId = ? OR LOWER(ti.invitedEmail) = LOWER(?))
            AND ti.status = 'pending'
            AND ti.expiresAt > datetime('now')
            ORDER BY ti.createdAt DESC
        `).all(req.session.userId, user.email);

        res.json(invitations);
    } catch (error) {
        logger.error('Error fetching invitations', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch invitations' });
    }
});

// Accept invitation
app.post('/api/invitations/:id/accept', auth.isAuthenticated, (req, res) => {
    try {
        const { id } = req.params;

        const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(req.session.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get invitation
        const invitation = db.prepare(`
            SELECT * FROM troop_invitations WHERE id = ?
        `).get(id);

        if (!invitation) {
            return res.status(404).json({ error: 'Invitation not found' });
        }

        // Verify invitation belongs to user
        if (invitation.invitedUserId !== user.id && invitation.invitedEmail.toLowerCase() !== user.email.toLowerCase()) {
            return res.status(403).json({ error: 'This invitation is not for you' });
        }

        // Check if expired
        if (new Date(invitation.expiresAt) < new Date()) {
            db.prepare('UPDATE troop_invitations SET status = \'expired\' WHERE id = ?').run(id);
            return res.status(410).json({ error: 'Invitation has expired' });
        }

        // Check if already a member
        const existingMember = db.prepare(`
            SELECT id FROM troop_members WHERE troopId = ? AND userId = ? AND status = 'active'
        `).get(invitation.troopId, user.id);

        if (existingMember) {
            return res.status(409).json({ error: 'You are already a member of this troop' });
        }

        // Add to troop
        db.prepare(`
            INSERT INTO troop_members (troopId, userId, role, status, joinDate)
            VALUES (?, ?, ?, 'active', datetime('now'))
            ON CONFLICT(troopId, userId) DO UPDATE SET status = 'active', role = ?, joinDate = datetime('now')
        `).run(invitation.troopId, user.id, invitation.invitedRole, invitation.invitedRole);

        // Update invitation status
        db.prepare(`
            UPDATE troop_invitations SET status = 'accepted', respondedAt = datetime('now')
            WHERE id = ?
        `).run(id);

        // Notify troop leader
        const troop = db.prepare('SELECT * FROM troops WHERE id = ?').get(invitation.troopId);
        if (troop?.leaderId) {
            auth.createNotification(
                db,
                troop.leaderId,
                'success',
                'Invitation Accepted',
                `${user.email} has joined Troop ${troop.troopNumber}.`
            );
        }

        logger.info('Invitation accepted', { invitationId: id, userId: user.id, troopId: invitation.troopId });
        res.json({ success: true, message: 'You have joined the troop!' });
    } catch (error) {
        logger.error('Error accepting invitation', { error: error.message });
        res.status(500).json({ error: 'Failed to accept invitation' });
    }
});

// Decline invitation
app.post('/api/invitations/:id/decline', auth.isAuthenticated, (req, res) => {
    try {
        const { id } = req.params;

        const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(req.session.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get invitation
        const invitation = db.prepare('SELECT * FROM troop_invitations WHERE id = ?').get(id);

        if (!invitation) {
            return res.status(404).json({ error: 'Invitation not found' });
        }

        // Verify invitation belongs to user
        if (invitation.invitedUserId !== user.id && invitation.invitedEmail.toLowerCase() !== user.email.toLowerCase()) {
            return res.status(403).json({ error: 'This invitation is not for you' });
        }

        // Update invitation status
        db.prepare(`
            UPDATE troop_invitations SET status = 'declined', respondedAt = datetime('now')
            WHERE id = ?
        `).run(id);

        logger.info('Invitation declined', { invitationId: id, userId: user.id });
        res.json({ success: true });
    } catch (error) {
        logger.error('Error declining invitation', { error: error.message });
        res.status(500).json({ error: 'Failed to decline invitation' });
    }
});

// ============================================================================
// Phase 3: Roster Bulk Import Route
// ============================================================================

app.post('/api/troop/:troopId/roster/import', auth.isAuthenticated, upload.single('file'), async (req, res) => {
    try {
        const { troopId } = req.params;

        // Verify user has access
        const troop = db.prepare('SELECT * FROM troops WHERE id = ?').get(troopId);
        if (!troop) {
            return res.status(404).json({ error: 'Troop not found' });
        }
        if (troop.leaderId !== req.session.userId && req.session.userRole !== 'council_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Parse CSV
        const csvContent = req.file.buffer.toString('utf-8');
        const lines = csvContent.split('\n').filter(line => line.trim());

        if (lines.length < 2) {
            return res.status(400).json({ error: 'CSV file must have at least a header and one data row' });
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

        // Validate required headers
        const requiredHeaders = ['firstname', 'lastname', 'email'];
        for (const required of requiredHeaders) {
            if (!headers.includes(required)) {
                return res.status(400).json({ error: `Missing required column: ${required}` });
            }
        }

        const results = { created: 0, skipped: 0, errors: [] };

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const row = {};
            headers.forEach((header, idx) => {
                row[header] = values[idx] || '';
            });

            try {
                // Check if user already exists
                let user = db.prepare('SELECT id FROM users WHERE email = ?').get(row.email);

                if (!user) {
                    // Create user
                    const isMinorValue = row.dateofbirth ? auth.isMinor(row.dateofbirth) : 0;
                    const tempPassword = require('crypto').randomBytes(16).toString('hex');
                    const passwordHash = await auth.hashPassword(tempPassword);

                    const result = db.prepare(`
                        INSERT INTO users (email, password_hash, firstName, lastName, dateOfBirth, isMinor, parentEmail, role, isActive, emailVerified)
                        VALUES (?, ?, ?, ?, ?, ?, ?, 'scout', 1, 0)
                    `).run(
                        row.email,
                        passwordHash,
                        row.firstname,
                        row.lastname,
                        row.dateofbirth || null,
                        isMinorValue ? 1 : 0,
                        row.parentemail || null
                    );

                    user = { id: result.lastInsertRowid };

                    // Create profile
                    db.prepare(`
                        INSERT INTO profile (userId, scoutName, email)
                        VALUES (?, ?, ?)
                    `).run(user.id, `${row.firstname} ${row.lastname}`.trim(), row.email);
                }

                // Check if already member
                const existingMember = db.prepare(`
                    SELECT id FROM troop_members WHERE troopId = ? AND userId = ?
                `).get(troopId, user.id);

                if (existingMember) {
                    results.skipped++;
                } else {
                    // Add to troop
                    db.prepare(`
                        INSERT INTO troop_members (troopId, userId, role, status, joinDate)
                        VALUES (?, ?, 'member', 'active', datetime('now'))
                    `).run(troopId, user.id);

                    results.created++;
                }

                // Handle parent linking if parent email provided
                if (row.parentemail && row.parentfirstname && row.parentlastname) {
                    let parent = db.prepare('SELECT id FROM users WHERE email = ?').get(row.parentemail);

                    if (!parent) {
                        const tempPassword = require('crypto').randomBytes(16).toString('hex');
                        const passwordHash = await auth.hashPassword(tempPassword);

                        const parentResult = db.prepare(`
                            INSERT INTO users (email, password_hash, firstName, lastName, role, isActive, emailVerified)
                            VALUES (?, ?, ?, ?, 'parent', 1, 0)
                        `).run(row.parentemail, passwordHash, row.parentfirstname, row.parentlastname);

                        parent = { id: parentResult.lastInsertRowid };
                    }

                    // Add parent to troop with linkedScoutId
                    const existingParentMember = db.prepare(`
                        SELECT id FROM troop_members WHERE troopId = ? AND userId = ?
                    `).get(troopId, parent.id);

                    if (!existingParentMember) {
                        db.prepare(`
                            INSERT INTO troop_members (troopId, userId, role, linkedScoutId, status, joinDate)
                            VALUES (?, ?, 'parent', ?, 'active', datetime('now'))
                        `).run(troopId, parent.id, user.id);
                    }
                }

            } catch (rowError) {
                results.errors.push({ row: i + 1, error: rowError.message });
            }
        }

        logger.info('Roster import completed', { troopId, ...results });
        res.json(results);
    } catch (error) {
        logger.error('Error importing roster', { error: error.message });
        res.status(500).json({ error: 'Failed to import roster' });
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
    logger.info(`Apex Scout Manager server running on port ${PORT}`);
    logger.info(`Database location: ${DB_PATH}`);
});
