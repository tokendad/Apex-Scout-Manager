# Database Migration Plan: v1.x to v2.0

## Overview
This document outlines the database schema changes required to transform GSCTracker from a single-user application to a multi-user, multi-tenant system.

## Migration Strategy
- **Approach:** Additive migration (add new tables, then migrate data, then add foreign keys)
- **Database:** Continue with SQLite for v2.0 (PostgreSQL migration can be Phase 7)
- **Backwards Compatibility:** Maintain ability to run migration script multiple times safely
- **Rollback:** Keep backup of original database before migration

## New Tables

### 1. users
Primary user authentication and profile table.

```sql
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
);
```

### 2. sessions
User session management for authentication.

```sql
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    sessionToken TEXT UNIQUE NOT NULL,
    expiresAt TEXT NOT NULL,
    ipAddress TEXT,
    userAgent TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(sessionToken);
CREATE INDEX IF NOT EXISTS idx_sessions_userId ON sessions(userId);
```

### 3. councils
Girl Scout council organizations.

```sql
CREATE TABLE IF NOT EXISTS councils (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    region TEXT,
    contactEmail TEXT,
    contactPhone TEXT,
    address TEXT,
    website TEXT,
    settings TEXT, -- JSON blob for council-specific settings
    isActive INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### 4. troops
Girl Scout troops within councils.

```sql
CREATE TABLE IF NOT EXISTS troops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    councilId INTEGER,
    troopNumber TEXT NOT NULL,
    troopType TEXT NOT NULL,
    leaderId INTEGER,
    meetingLocation TEXT,
    meetingDay TEXT,
    meetingTime TEXT,
    settings TEXT, -- JSON blob for troop-specific settings
    isActive INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (councilId) REFERENCES councils(id) ON DELETE SET NULL,
    FOREIGN KEY (leaderId) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT troopType_check CHECK (troopType IN ('daisy', 'brownie', 'junior', 'cadette', 'senior', 'ambassador', 'multi-level'))
);

CREATE INDEX IF NOT EXISTS idx_troops_councilId ON troops(councilId);
CREATE INDEX IF NOT EXISTS idx_troops_leaderId ON troops(leaderId);
```

### 5. troop_members
Association table for scouts in troops.

```sql
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
);

CREATE INDEX IF NOT EXISTS idx_troop_members_troopId ON troop_members(troopId);
CREATE INDEX IF NOT EXISTS idx_troop_members_userId ON troop_members(userId);
```

### 6. troop_goals
Troop-level sales and participation goals.

```sql
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
);

CREATE INDEX IF NOT EXISTS idx_troop_goals_troopId ON troop_goals(troopId);
```

### 7. audit_log
Security and compliance audit trail.

```sql
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    action TEXT NOT NULL,
    resourceType TEXT NOT NULL,
    resourceId INTEGER,
    ipAddress TEXT,
    userAgent TEXT,
    details TEXT, -- JSON blob with additional details
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_log_userId ON audit_log(userId);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_log_resourceType ON audit_log(resourceType, resourceId);
```

### 8. data_deletion_requests
COPPA compliance: track data deletion requests.

```sql
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
);

CREATE INDEX IF NOT EXISTS idx_data_deletion_userId ON data_deletion_requests(userId);
```

### 9. payment_methods
Multi-payment support (already exists, but documenting for completeness).

```sql
-- Already exists in v1.x
CREATE TABLE IF NOT EXISTS payment_methods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    isEnabled INTEGER DEFAULT 1
);
```

### 10. notifications
User notification system.

```sql
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
);

CREATE INDEX IF NOT EXISTS idx_notifications_userId ON notifications(userId);
CREATE INDEX IF NOT EXISTS idx_notifications_isRead ON notifications(userId, isRead);
```

## Modifications to Existing Tables

### profile table
Add userId to link profiles to users. Keep existing structure for backward compatibility during migration.

```sql
ALTER TABLE profile ADD COLUMN userId INTEGER REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_profile_userId ON profile(userId);
```

### sales table
Add userId to track which user created the sale.

```sql
ALTER TABLE sales ADD COLUMN userId INTEGER REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_sales_userId ON sales(userId);
```

### donations table
Add userId to track which user recorded the donation.

```sql
ALTER TABLE donations ADD COLUMN userId INTEGER REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_donations_userId ON donations(userId);
```

### events table
Add userId for event creator and troopId for troop-level events.

```sql
ALTER TABLE events ADD COLUMN userId INTEGER REFERENCES users(id);
ALTER TABLE events ADD COLUMN troopId INTEGER REFERENCES troops(id);
CREATE INDEX IF NOT EXISTS idx_events_userId ON events(userId);
CREATE INDEX IF NOT EXISTS idx_events_troopId ON events(troopId);
```

## Migration Steps

### Step 1: Backup
```sql
-- Performed by migration script before any changes
-- Creates backup: gsctracker.db.backup.TIMESTAMP
```

### Step 2: Create New Tables
```sql
-- Execute all CREATE TABLE statements above
-- Run with IF NOT EXISTS to make script idempotent
```

### Step 3: Alter Existing Tables
```sql
-- Add userId columns to existing tables
-- Use ALTER TABLE ADD COLUMN (safe operation)
```

### Step 4: Migrate Existing Data
```sql
-- Create default admin user from existing profile
INSERT INTO users (
    email,
    firstName,
    lastName,
    role,
    isActive,
    emailVerified,
    createdAt
) VALUES (
    (SELECT COALESCE(email, 'admin@gsctracker.local') FROM profile WHERE id = 1),
    (SELECT COALESCE(scoutName, 'Admin') FROM profile WHERE id = 1),
    'User',
    'council_admin',
    1,
    1,
    datetime('now')
);

-- Link existing profile to admin user
UPDATE profile SET userId = 1 WHERE id = 1;

-- Link all existing sales to admin user
UPDATE sales SET userId = 1 WHERE userId IS NULL;

-- Link all existing donations to admin user
UPDATE donations SET userId = 1 WHERE userId IS NULL;

-- Link all existing events to admin user
UPDATE events SET userId = 1 WHERE userId IS NULL;
```

### Step 5: Create Default Council and Troop
```sql
-- Create default council
INSERT INTO councils (name, region, isActive)
VALUES ('Default Council', 'Local', 1);

-- Create default troop
INSERT INTO troops (
    councilId,
    troopNumber,
    troopType,
    leaderId,
    isActive
) VALUES (
    1,
    (SELECT COALESCE(troopNumber, '0000') FROM profile WHERE id = 1),
    'multi-level',
    1,
    1
);

-- Add admin user to default troop
INSERT INTO troop_members (troopId, userId, role, status)
VALUES (1, 1, 'member', 'active');
```

### Step 6: Verify Data Integrity
```sql
-- Check that all records have userId
SELECT 'Sales without userId: ' || COUNT(*) FROM sales WHERE userId IS NULL;
SELECT 'Donations without userId: ' || COUNT(*) FROM donations WHERE userId IS NULL;
SELECT 'Events without userId: ' || COUNT(*) FROM events WHERE userId IS NULL;
SELECT 'Profiles without userId: ' || COUNT(*) FROM profile WHERE userId IS NULL;
```

## Rollback Plan

If migration fails:
1. Stop application
2. Restore from backup: `cp gsctracker.db.backup.TIMESTAMP gsctracker.db`
3. Restart application with v1.x code

## Testing Strategy

1. **Pre-migration Test:**
   - Export all data to JSON
   - Count records in each table
   - Verify data integrity

2. **Post-migration Test:**
   - Verify new tables exist
   - Verify record counts match
   - Verify foreign key relationships
   - Test authentication system
   - Test data access with new userId filters

3. **Integration Test:**
   - Test existing features still work
   - Test new multi-user features
   - Test role-based access control

## Migration Script Usage

```bash
# Run migration
node migrations/migrate-to-v2.js

# Verify migration
node migrations/verify-migration.js

# Rollback if needed
node migrations/rollback.js
```

## Schema Diagram

```
users (authentication & profile)
  ├─> sessions (user sessions)
  ├─> troop_members (membership)
  ├─> audit_log (activity tracking)
  ├─> notifications (user notifications)
  └─> data_deletion_requests (COPPA compliance)

councils (organization)
  └─> troops (within councils)
      ├─> troop_members (scouts in troop)
      └─> troop_goals (troop targets)

profile (scout profile)
  └─> userId -> users

sales (cookie sales)
  └─> userId -> users

donations (donations)
  └─> userId -> users

events (booth sales events)
  ├─> userId -> users
  └─> troopId -> troops

payment_methods (payment options)
  -- Global, not user-specific
```

## Notes

- SQLite limitations: No DROP COLUMN or MODIFY COLUMN support
- Foreign keys must be enabled: `PRAGMA foreign_keys = ON;`
- Use transactions for all migration steps
- Test thoroughly on copy of production database first
- Migration script should be idempotent (can run multiple times safely)

---

**Document Version:** 1.0
**Last Updated:** 2026-01-23
