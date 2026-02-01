/**
 * Apex Scout Manager Database Migration Verification
 *
 * This script verifies that the v2.0 migration completed successfully.
 *
 * Usage: node migrations/verify-migration.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const logger = require('../logger');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'asm.db');

try {
    logger.info('='.repeat(60));
    logger.info('Verifying Apex Scout Manager v2.0 Database Migration');
    logger.info('='.repeat(60));

    const db = new Database(DB_PATH);
    db.pragma('foreign_keys = ON');

    const requiredTables = [
        'users',
        'sessions',
        'councils',
        'troops',
        'troop_members',
        'troop_goals',
        'audit_log',
        'data_deletion_requests',
        'notifications'
    ];

    const existingTables = [
        'profile',
        'sales',
        'donations',
        'events',
        'payment_methods'
    ];

    let allChecksPass = true;

    // Check that all required new tables exist
    logger.info('\n1. Checking new tables...');
    for (const table of requiredTables) {
        const exists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table);
        if (exists) {
            const count = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get().count;
            logger.info(`  ✓ ${table} exists (${count} records)`);
        } else {
            logger.error(`  ✗ ${table} MISSING`);
            allChecksPass = false;
        }
    }

    // Check that existing tables still exist
    logger.info('\n2. Checking existing tables...');
    for (const table of existingTables) {
        const exists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table);
        if (exists) {
            const count = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get().count;
            logger.info(`  ✓ ${table} exists (${count} records)`);
        } else {
            logger.warn(`  ⚠ ${table} not found (may not have existed pre-migration)`);
        }
    }

    // Check that userId columns were added
    logger.info('\n3. Checking userId columns...');
    const checkColumn = (tableName, columnName) => {
        try {
            const tableInfo = db.pragma(`table_info(${tableName})`);
            return tableInfo.some(col => col.name === columnName);
        } catch (error) {
            return false;
        }
    };

    const tablesNeedingUserId = ['profile', 'sales', 'donations', 'events'];
    for (const table of tablesNeedingUserId) {
        const exists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table);
        if (exists) {
            if (checkColumn(table, 'userId')) {
                logger.info(`  ✓ ${table}.userId exists`);
            } else {
                logger.error(`  ✗ ${table}.userId MISSING`);
                allChecksPass = false;
            }
        }
    }

    // Check that troopId column was added to events
    logger.info('\n4. Checking troopId column...');
    const eventsExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='events'`).get();
    if (eventsExists) {
        if (checkColumn('events', 'troopId')) {
            logger.info(`  ✓ events.troopId exists`);
        } else {
            logger.error(`  ✗ events.troopId MISSING`);
            allChecksPass = false;
        }
    }

    // Check for admin user
    logger.info('\n5. Checking for admin user...');
    const adminUser = db.prepare('SELECT * FROM users WHERE role = ? LIMIT 1').get('council_admin');
    if (adminUser) {
        logger.info(`  ✓ Admin user found: ${adminUser.email}`);
    } else {
        logger.warn('  ⚠ No admin user found');
    }

    // Check for default council and troop
    logger.info('\n6. Checking for default council and troop...');
    const council = db.prepare('SELECT * FROM councils WHERE id = 1').get();
    if (council) {
        logger.info(`  ✓ Default council found: ${council.name}`);
    } else {
        logger.warn('  ⚠ No default council found');
    }

    const troop = db.prepare('SELECT * FROM troops WHERE id = 1').get();
    if (troop) {
        logger.info(`  ✓ Default troop found: ${troop.troopNumber}`);
    } else {
        logger.warn('  ⚠ No default troop found');
    }

    // Check indexes
    logger.info('\n7. Checking indexes...');
    const indexes = db.prepare(`SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'`).all();
    logger.info(`  ✓ Found ${indexes.length} indexes`);

    // Check foreign keys are enabled
    logger.info('\n8. Checking foreign keys...');
    const foreignKeys = db.pragma('foreign_keys');
    if (foreignKeys[0].foreign_keys === 1) {
        logger.info('  ✓ Foreign keys are enabled');
    } else {
        logger.warn('  ⚠ Foreign keys are NOT enabled');
    }

    db.close();

    logger.info('\n' + '='.repeat(60));
    if (allChecksPass) {
        logger.info('✓ All verification checks passed!');
        logger.info('Database migration is SUCCESSFUL');
    } else {
        logger.error('✗ Some verification checks failed');
        logger.error('Database migration may be INCOMPLETE');
    }
    logger.info('='.repeat(60));

    process.exit(allChecksPass ? 0 : 1);

} catch (error) {
    logger.error('Verification failed:', error);
    process.exit(1);
}
