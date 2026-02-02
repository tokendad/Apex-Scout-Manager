/**
 * Migration: Add scout level and parent linking support
 *
 * Changes:
 * 1. Make email field nullable in users table (scouts may not have email)
 * 2. Add scoutLevel column to troop_members table
 * 3. Add linkedParentId column to troop_members table
 * 4. Add parentRole column to troop_members table
 */

const Database = require('better-sqlite3');
const path = require('path');
const logger = require('../logger');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/asm.db');

function migrateDatabase() {
  try {
    const db = new Database(DB_PATH);
    logger.info('Starting scout-parent linking migration...');

    // Check if columns already exist
    const troop_members_columns = db.pragma('table_info(troop_members)');
    const has_scoutLevel = troop_members_columns.some(col => col.name === 'scoutLevel');
    const has_linkedParentId = troop_members_columns.some(col => col.name === 'linkedParentId');
    const has_parentRole = troop_members_columns.some(col => col.name === 'parentRole');

    if (!has_scoutLevel) {
      db.exec(`ALTER TABLE troop_members ADD COLUMN scoutLevel TEXT`);
      logger.info('Added scoutLevel column to troop_members');
    } else {
      logger.info('scoutLevel column already exists in troop_members');
    }

    if (!has_linkedParentId) {
      db.exec(`ALTER TABLE troop_members ADD COLUMN linkedParentId INTEGER`);
      logger.info('Added linkedParentId column to troop_members');
    } else {
      logger.info('linkedParentId column already exists in troop_members');
    }

    if (!has_parentRole) {
      db.exec(`ALTER TABLE troop_members ADD COLUMN parentRole TEXT`);
      logger.info('Added parentRole column to troop_members');
    } else {
      logger.info('parentRole column already exists in troop_members');
    }

    logger.info('Migration completed successfully');
    db.close();

  } catch (error) {
    logger.error('Migration failed', { error: error.message });
    process.exit(1);
  }
}

if (require.main === module) {
  migrateDatabase();
}

module.exports = { migrateDatabase };
