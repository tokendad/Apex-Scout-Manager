# Development Seed Data

This document describes the example users and data created for development and testing purposes.

## Overview

The `migrations/seed-development-data.js` script populates the database with realistic example data:
- **1 Council Admin** (superuser for testing all features)
- **2 Troop Leaders** (managing different troops)
- **5 Troop Assistants** (with different specialized roles)
- **5 Parents** (linked to scouts in troops)
- **22 Scouts** (distributed across troops with various Girl Scout levels)
- **2 Troops** (with members, goals, and relations)
- **9 Cookie Products** (2026 season)
- **10 Sample Sales** (for display purposes)

## Running the Seed Script

### First Time Setup
```bash
# Start the server (this initializes the database)
npm start

# In another terminal, run the seed script
node migrations/seed-development-data.js
```

### Resetting Data
Simply run the seed script again - it will clear all existing data and repopulate it:
```bash
node migrations/seed-development-data.js
```

## User Accounts

All test accounts use the password: **`DemoPassword123!`**

### Hierarchy Levels

#### Level 1: Council Admin (Global Scope)
**Superuser with full system access**

| Email | Name | Role | Scope |
|-------|------|------|-------|
| `welefort@gmail.com` | Council Admin | council_admin | Global |

**Note:** This is the only superuser account. Use for testing all system features.

#### Level 2: Troop Leaders (Troop Admin Scope)
**Full Read/Write access within their assigned troop(s)**

| Email | Name | Troop | Responsibilities |
|-------|------|-------|-----------------|
| `troop.leader1@example.com` | Sarah Johnson | #1234 (Junior) | Manage all scouts, events, financials |
| `troop.leader2@example.com` | Maria Garcia | #5678 (Cadette) | Manage all scouts, events, financials |

**Can:**
- Edit overall troop information
- Assign Troop Assistant roles
- View all scouts' full profiles
- Manage troop members

#### Level 3: Troop Assistants (Limited Troop Scope)
**Specialized roles with specific module access**

| Email | Name | Specialized Role | Module Access | Troop |
|-------|------|------------------|----------------|-------|
| `treasurer@example.com` | Jennifer Wilson | Treasurer | Finances (full), Medical (read-only) | #1234 |
| `product.manager@example.com` | Lisa Chen | Product Manager | Sales/Inventory (full) | #1234 |
| `first.aider@example.com` | Amanda Martinez | First Aider | Medical/Emergency (read-only) | #1234 |
| `camping.coordinator@example.com` | Karen Thompson | Camping Coordinator | Events/Trips (full) | #5678 |
| `activity.helper@example.com` | Rachel Anderson | Activity Helper | Calendar/Roster (read-only), Attendance | #5678 |

**Rules:**
- Cannot delete troop or change high-level settings
- Cannot see modules outside their role
- Role is scoped per troop
- Dashboard highlights their primary module

#### Level 4: Parents (Family Scope)
**View and manage linked scout's data only**

| Email | Name | Linked Scouts |
|-------|------|---------------|
| `parent.smith@example.com` | Michael Smith | Multiple scouts in Troop #1234 |
| `parent.brown@example.com` | Jennifer Brown | Multiple scouts in Troop #1234 |
| `parent.davis@example.com` | Robert Davis | Multiple scouts in Troop #5678 |
| `parent.miller@example.com` | Patricia Miller | Multiple scouts in Troop #5678 |
| `parent.wilson@example.com` | James Wilson | Multiple scouts in Troop #5678 |

**Can:**
- View own children's progress and events
- Edit own contact information
- Edit children's medical information (with audit log)
- View financial balance
- Cannot see other families' data

#### Level 5: Scouts (Self Scope)
**Read-only access to own profile**

| Sample Accounts | Name | Level | Troop |
|-----------------|------|-------|-------|
| `scout.1@example.com` through `scout.22@example.com` | Various names | Junior (Troop #1234) or Cadette (Troop #5678) | Assigned |

**Can:**
- View own profile
- Track own sales
- Monitor badge progress
- View calendar and events
- Cannot edit any information

## Test Scenarios

### Scenario 1: Testing Council Admin
```
Account: welefort@gmail.com
Password: DemoPassword123!
Expected: Access to all troops, all users, all reports, system settings
```

### Scenario 2: Testing Troop Leader
```
Account: troop.leader1@example.com
Password: DemoPassword123!
Expected: See Troop #1234, manage scouts, assign assistant roles, edit troop settings
```

### Scenario 3: Testing Treasurer Role
```
Account: treasurer@example.com
Password: DemoPassword123!
Expected: See Finance tab prominently, full access to ledger/bank accounts, no access to settings
```

### Scenario 4: Testing Parent Access
```
Account: parent.smith@example.com
Password: DemoPassword123!
Expected: See only their linked scouts' data, "My Family" view, cannot see other families
```

### Scenario 5: Testing Scout Read-Only
```
Account: scout.1@example.com
Password: DemoPassword123!
Expected: Read-only personal dashboard, cannot edit anything, see personal sales/progress
```

## Database Structure

### Users (45 total)
- 1 Council Admin
- 2 Troop Leaders
- 5 Troop Assistants (with parent role + assignment in troop_members)
- 5 Parents
- 22 Scouts

### Troops (2 total)

#### Troop #1234 (Junior Level)
- **Leader:** Sarah Johnson
- **Members:** 12 scouts + 3 parents + 3 assistants
- **Meeting:** Tuesday, 4:00 PM at Community Center - Room A
- **Level:** Junior (grades 4-5)
- **Goal:** 500 boxes sold

#### Troop #5678 (Cadette Level)
- **Leader:** Maria Garcia
- **Members:** 10 scouts + 2 parents + 2 assistants
- **Meeting:** Wednesday, 6:00 PM at School - Cafeteria
- **Level:** Cadette (grades 6-8)
- **Goal:** $3000 revenue

### Girl Scout Levels in Data
- **Daisy:** Grades K-1 (Ages 5-7)
- **Brownie:** Grades 2-3 (Ages 7-9)
- **Junior:** Grades 4-5 (Ages 9-11) - *Troop #1234*
- **Cadette:** Grades 6-8 (Ages 11-14) - *Troop #5678*
- **Senior:** Grades 9-10 (Ages 14-16)
- **Ambassador:** Grades 11-12 (Ages 16-18)

### Cookie Products (9 total for 2026 Season)
1. Thin Mints (vegan)
2. Samoas (contains coconut)
3. Tagalongs (contains peanuts)
4. Trefoils (standard)
5. Do-si-dos (contains peanuts)
6. Lemon-Ups (standard)
7. Adventurefuls (standard)
8. Toffee-tastic (gluten-free)
9. Caramel Chocolate Chip (gluten-free)

All priced at **$6.00 per box** (1 box = 1 case unit with 12 boxes)

### Sample Sales Data
- 10 sample sales records across different scouts
- Various cookie types and quantities
- Both individual and booth sale types
- Dates within the past 30 days

## Testing Tips

### 1. Permission Testing
Use different accounts to verify role-based access:
- Council Admin should see everything
- Troop Leaders should see their troop only
- Assistants should see only their assigned module
- Parents should see only linked scouts
- Scouts should see read-only personal data

### 2. UI/UX Testing
Test dashboard customization:
- Treasurer sees Finances tab highlighted
- Product Manager sees Sales/Inventory highlighted
- Activity Helper sees simplified Calendar/Roster
- Parent sees "My Family" view
- Scout sees read-only personal dashboard

### 3. Member Linking
- Check parent-scout relationships in `troop_members.linkedParentId`
- Verify parents can only view their linked children
- Test scout level selector (junior vs cadette)

### 4. Scout Level Selection
- Check `troop_members.scoutLevel` for appropriate levels
- Verify UI shows correct level in roster
- Test updating level when scout "bridges" to next level

### 5. Permission Matrix Testing
Verify against Hierarchy Definitions Section 4:
- Troop Settings: Only leaders can edit
- Roster: Leaders edit, others view
- Finances: Only treasurer (and leader) can edit
- Medical: Only first aider views, parents edit own
- Events: Only camping coordinator edits
- Sales: Product manager and scouts edit own

## Modifying Seed Data

To customize the seed data, edit `migrations/seed-development-data.js`:

```javascript
// Add more scouts
const scoutFirstNames = [
    // Add more names here
];

// Modify scout distribution
for (let i = 0; i < 30; i++) {  // Change 22 to 30
    // ...
}

// Add more troops
const troop3Id = troopStmt.run(
    council1Id,
    '9999',
    'brownie',
    troopLeader3Id,
    // ...
);
```

Then run the seed script again:
```bash
node migrations/seed-development-data.js
```

## Cleanup

To remove test data without resetting the entire database:
```sql
DELETE FROM users WHERE role != 'council_admin';
DELETE FROM troops WHERE leaderId IS NOT NULL;
DELETE FROM troop_members WHERE troopId IS NOT NULL;
```

Or completely reset by running the seed script again (it clears data automatically).

## Related Documentation

- **Hierarchy Definitions:** `/docs/v2 Implementation/Hierarchy Definitions.md`
- **Phase 1 Foundation:** `/docs/v2 Implementation/PHASE_1_FOUNDATION.md`
- **Phase 3 Troop Management:** `/docs/v2 Implementation/PHASE_3_TROOP_MANAGEMENT.md`
- **CLAUDE.md:** `/docs/CLAUDE.md` - Development environment setup

## Notes

- All passwords are intentionally simple for development (`DemoPassword123!`)
- Email addresses are fictional and not monitored
- Data is designed to be realistic but safe for development
- The council admin (welefort@gmail.com) is intentionally the only superuser per requirements
- Parent-scout relationships are randomly distributed but logically consistent
- Scouts are automatically marked as minors if their calculated age < 13

---

**Last Updated:** 2026-02-01
**Database Version:** v2.0-beta
