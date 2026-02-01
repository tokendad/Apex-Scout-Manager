/**
 * Apex Scout Manager Database Migration: v1.x to v2.0
 *
 * This script migrates the database schema to support multi-user functionality.
 * It creates new tables and adds foreign key relationships to existing data.
 *
 * Usage: node migrations/migrate-to-v2.js
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const logger = require('../logger');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'asm.db');
const BACKUP_PATH = `${DB_PATH}.backup.${Date.now()}`;

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

let db;

try {
    logger.info('='.repeat(60));
    logger.info('Starting Apex Scout Manager v2.0 Database Migration');
    logger.info('='.repeat(60));

    // Step 1: Backup existing database
    logger.info(`Step 1: Creating backup at ${BACKUP_PATH}`);
    if (fs.existsSync(DB_PATH)) {
        fs.copyFileSync(DB_PATH, BACKUP_PATH);
        logger.info('✓ Backup created successfully');
    } else {
        logger.warn('No existing database found, creating new database');
    }

    // Step 2: Open database connection
    logger.info('Step 2: Opening database connection');
    db = new Database(DB_PATH);
    db.pragma('foreign_keys = ON');
    logger.info('✓ Database connection established');

    // Step 3: Create new tables
    logger.info('Step 3: Creating new tables');

    // Begin transaction
    db.exec('BEGIN TRANSACTION');

    // Create users table
    logger.info('  Creating users table...');
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
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
    logger.info('  ✓ users table created');

    // Create sessions table
    logger.info('  Creating sessions table...');
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
    logger.info('  ✓ sessions table created');

    // Create councils table
    logger.info('  Creating councils table...');
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
    logger.info('  ✓ councils table created');

    // Create troops table
    logger.info('  Creating troops table...');
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
    logger.info('  ✓ troops table created');

    // Create troop_members table
    logger.info('  Creating troop_members table...');
    db.exec(`
        CREATE TABLE IF NOT EXISTS troop_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            troopId INTEGER NOT NULL,
            userId INTEGER NOT NULL,
            role TEXT NOT NULL DEFAULT 'member',
            joinDate TEXT DEFAULT CURRENT_TIMESTAMP,
            leaveDate TEXT,
            status TEXT DEFAULT 'active',
            FOREIGN KEY (troopId) REFERENCES troops(id) ON DELETE CASCADE,
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
            CONSTRAINT role_check CHECK (role IN ('member', 'co-leader', 'assistant')),
            CONSTRAINT status_check CHECK (status IN ('active', 'inactive', 'transferred')),
            UNIQUE(troopId, userId)
        )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_troop_members_troopId ON troop_members(troopId)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_troop_members_userId ON troop_members(userId)');
    logger.info('  ✓ troop_members table created');

    // Create troop_goals table
    logger.info('  Creating troop_goals table...');
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
    logger.info('  ✓ troop_goals table created');

    // Create audit_log table
    logger.info('  Creating audit_log table...');
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
    logger.info('  ✓ audit_log table created');

    // Create data_deletion_requests table
    logger.info('  Creating data_deletion_requests table...');
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
    logger.info('  ✓ data_deletion_requests table created');

    // Create notifications table
    logger.info('  Creating notifications table...');
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
    logger.info('  ✓ notifications table created');

    // Step 4: Modify existing tables
    logger.info('Step 4: Modifying existing tables');

    // Check if userId column already exists in tables
    const checkColumn = (tableName, columnName) => {
        const tableInfo = db.pragma(`table_info(${tableName})`);
        return tableInfo.some(col => col.name === columnName);
    };

    // Add userId to profile table
    if (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='profile'").get()) {
        if (!checkColumn('profile', 'userId')) {
            logger.info('  Adding userId to profile table...');
            db.exec('ALTER TABLE profile ADD COLUMN userId INTEGER REFERENCES users(id)');
            db.exec('CREATE INDEX IF NOT EXISTS idx_profile_userId ON profile(userId)');
            logger.info('  ✓ userId added to profile table');
        } else {
            logger.info('  ✓ userId already exists in profile table');
        }
    }

    // Add userId to sales table
    if (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sales'").get()) {
        if (!checkColumn('sales', 'userId')) {
            logger.info('  Adding userId to sales table...');
            db.exec('ALTER TABLE sales ADD COLUMN userId INTEGER REFERENCES users(id)');
            db.exec('CREATE INDEX IF NOT EXISTS idx_sales_userId ON sales(userId)');
            logger.info('  ✓ userId added to sales table');
        } else {
            logger.info('  ✓ userId already exists in sales table');
        }
    }

    // Add userId to donations table
    if (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='donations'").get()) {
        if (!checkColumn('donations', 'userId')) {
            logger.info('  Adding userId to donations table...');
            db.exec('ALTER TABLE donations ADD COLUMN userId INTEGER REFERENCES users(id)');
            db.exec('CREATE INDEX IF NOT EXISTS idx_donations_userId ON donations(userId)');
            logger.info('  ✓ userId added to donations table');
        } else {
            logger.info('  ✓ userId already exists in donations table');
        }
    }

    // Add userId and troopId to events table
    if (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='events'").get()) {
        if (!checkColumn('events', 'userId')) {
            logger.info('  Adding userId to events table...');
            db.exec('ALTER TABLE events ADD COLUMN userId INTEGER REFERENCES users(id)');
            db.exec('CREATE INDEX IF NOT EXISTS idx_events_userId ON events(userId)');
            logger.info('  ✓ userId added to events table');
        } else {
            logger.info('  ✓ userId already exists in events table');
        }

        if (!checkColumn('events', 'troopId')) {
            logger.info('  Adding troopId to events table...');
            db.exec('ALTER TABLE events ADD COLUMN troopId INTEGER REFERENCES troops(id)');
            db.exec('CREATE INDEX IF NOT EXISTS idx_events_troopId ON events(troopId)');
            logger.info('  ✓ troopId added to events table');
        } else {
            logger.info('  ✓ troopId already exists in events table');
        }
    }

    // Step 5: Migrate existing data
    logger.info('Step 5: Migrating existing data');

    // Check if users table has any data
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;

    if (userCount === 0) {
        logger.info('  No users found, creating default admin user...');

        // Get existing profile data if it exists
        let email = 'admin@asm.local';
        let firstName = 'Admin';
        let troopNumber = '0000';

        const profileExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='profile'").get();
        if (profileExists) {
            const profile = db.prepare('SELECT * FROM profile WHERE id = 1').get();
            if (profile) {
                email = profile.email || email;
                firstName = profile.scoutName || firstName;
                troopNumber = profile.troopNumber || troopNumber;
            }
        }

        // Create default admin user
        const insertUser = db.prepare(`
            INSERT INTO users (email, firstName, lastName, role, isActive, emailVerified, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `);
        insertUser.run(email, firstName, 'User', 'council_admin', 1, 1);
        logger.info(`  ✓ Created admin user: ${email}`);

        // Link existing profile to admin user
        if (profileExists) {
            const profileHasUserId = checkColumn('profile', 'userId');
            if (profileHasUserId) {
                db.prepare('UPDATE profile SET userId = 1 WHERE id = 1').run();
                logger.info('  ✓ Linked existing profile to admin user');
            }
        }

        // Create default council
        logger.info('  Creating default council...');
        const insertCouncil = db.prepare(`
            INSERT INTO councils (name, region, isActive)
            VALUES (?, ?, ?)
        `);
        insertCouncil.run('Default Council', 'Local', 1);
        logger.info('  ✓ Default council created');

        // Create default troop
        logger.info('  Creating default troop...');
        const insertTroop = db.prepare(`
            INSERT INTO troops (councilId, troopNumber, troopType, leaderId, isActive)
            VALUES (?, ?, ?, ?, ?)
        `);
        insertTroop.run(1, troopNumber, 'multi-level', 1, 1);
        logger.info(`  ✓ Default troop ${troopNumber} created`);

        // Add admin user to default troop
        logger.info('  Adding admin user to default troop...');
        const insertMember = db.prepare(`
            INSERT INTO troop_members (troopId, userId, role, status)
            VALUES (?, ?, ?, ?)
        `);
        insertMember.run(1, 1, 'member', 'active');
        logger.info('  ✓ Admin user added to default troop');

        // Link all existing data to admin user
        const tablesWithUserId = ['sales', 'donations', 'events'];
        for (const table of tablesWithUserId) {
            const tableExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`).get();
            if (tableExists && checkColumn(table, 'userId')) {
                const updated = db.prepare(`UPDATE ${table} SET userId = 1 WHERE userId IS NULL`).run();
                if (updated.changes > 0) {
                    logger.info(`  ✓ Linked ${updated.changes} ${table} records to admin user`);
                }
            }
        }
    } else {
        logger.info(`  ✓ Found ${userCount} existing user(s), skipping data migration`);
    }

    // Step 6: Verify data integrity
    logger.info('Step 6: Verifying data integrity');

    const verifyTable = (tableName) => {
        const tableExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`).get();
        if (tableExists && checkColumn(tableName, 'userId')) {
            const orphans = db.prepare(`SELECT COUNT(*) as count FROM ${tableName} WHERE userId IS NULL`).get().count;
            if (orphans > 0) {
                logger.warn(`  ⚠ Found ${orphans} ${tableName} records without userId`);
                return false;
            } else {
                logger.info(`  ✓ All ${tableName} records have userId`);
                return true;
            }
        }
        return true;
    };

    const salesOk = verifyTable('sales');
    const donationsOk = verifyTable('donations');
    const eventsOk = verifyTable('events');

    if (salesOk && donationsOk && eventsOk) {
        logger.info('  ✓ Data integrity verification passed');
    } else {
        logger.warn('  ⚠ Some data integrity issues found (non-critical)');
    }

    // Commit transaction
    db.exec('COMMIT');
    logger.info('✓ Transaction committed');

    logger.info('='.repeat(60));
    logger.info('Migration completed successfully!');
    logger.info(`Backup saved at: ${BACKUP_PATH}`);
    logger.info('='.repeat(60));

} catch (error) {
    logger.error('Migration failed:', error);

    // Rollback transaction if database is open
    if (db) {
        try {
            db.exec('ROLLBACK');
            logger.info('Transaction rolled back');
        } catch (rollbackError) {
            logger.error('Rollback failed:', rollbackError);
        }
    }

    logger.error('='.repeat(60));
    logger.error('Migration FAILED');
    logger.error(`Backup available at: ${BACKUP_PATH}`);
    logger.error('To restore: cp ${BACKUP_PATH} ${DB_PATH}');
    logger.error('='.repeat(60));

    process.exit(1);
} finally {
    // Close database connection
    if (db) {
        db.close();
        logger.info('Database connection closed');
    }
}
