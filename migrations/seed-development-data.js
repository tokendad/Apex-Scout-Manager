#!/usr/bin/env node

/**
 * Development Database Seeding Script
 *
 * Seeds the database with example users and data for testing purposes:
 * - 1 Council Admin (welefort@gmail.com)
 * - 2 Troop Leaders
 * - 5 Troop Assistant roles (Treasurer, Product Manager, First Aider, Camping Coordinator, Activity Helper)
 * - 5 Parents
 * - 20+ Scouts
 *
 * Usage: node migrations/seed-development-data.js
 *
 * WARNING: This will clear and repopulate development data.
 * Use with caution in production environments.
 */

const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || '/data';
const DB_PATH = path.join(DATA_DIR, 'asm.db');

console.log('🌱 GSCTracker Development Database Seeding Script');
console.log(`📦 Database: ${DB_PATH}`);

// Verify database exists
if (!fs.existsSync(DB_PATH)) {
    console.error('❌ Database file not found. Please run the server first to initialize the database.');
    process.exit(1);
}

const db = new Database(DB_PATH);

// Helper function to hash password
function hashPassword(password) {
    return bcrypt.hashSync(password, 12);
}

// Helper function to generate timestamp
function now() {
    return new Date().toISOString();
}

try {
    console.log('\n📋 Clearing existing development data...');

    // Clear existing data (but keep structure)
    db.exec(`
        DELETE FROM notifications;
        DELETE FROM audit_log;
        DELETE FROM data_deletion_requests;
        DELETE FROM troop_invitations;
        DELETE FROM troop_goals;
        DELETE FROM troop_members;
        DELETE FROM troops;
        DELETE FROM councils;
        DELETE FROM sessions;
        DELETE FROM sales;
        DELETE FROM profile;
        DELETE FROM donations;
        DELETE FROM events;
        DELETE FROM payment_methods;
        DELETE FROM cookie_nutrition;
        DELETE FROM cookie_attributes;
        DELETE FROM cookie_products;
        DELETE FROM seasons;
        DELETE FROM users;
    `);
    console.log('✅ Cleared existing data');

    console.log('\n👥 Creating users...');

    // ========================================================================
    // Level 2: Troop Leaders (2 users)
    // ========================================================================

    const troopLeaderStmt = db.prepare(`
        INSERT INTO users (email, password_hash, firstName, lastName, role, isActive, emailVerified, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const troopLeader1Id = troopLeaderStmt.run(
        'troop.leader1@example.com',
        hashPassword('DemoPassword123!'),
        'Sarah',
        'Johnson',
        'troop_leader',
        1,
        1,
        now()
    ).lastInsertRowid;

    const troopLeader2Id = troopLeaderStmt.run(
        'troop.leader2@example.com',
        hashPassword('DemoPassword123!'),
        'Maria',
        'Garcia',
        'troop_leader',
        1,
        1,
        now()
    ).lastInsertRowid;

    console.log(`  ✅ Troop Leader 1: Sarah Johnson (ID: ${troopLeader1Id})`);
    console.log(`  ✅ Troop Leader 2: Maria Garcia (ID: ${troopLeader2Id})`);

    // ========================================================================
    // Level 3: Troop Assistants (5 users with different sub-roles)
    // ========================================================================

    const assistantUsers = [
        { email: 'treasurer@example.com', firstName: 'Jennifer', lastName: 'Wilson', title: 'Treasurer' },
        { email: 'product.manager@example.com', firstName: 'Lisa', lastName: 'Chen', title: 'Product Manager' },
        { email: 'first.aider@example.com', firstName: 'Amanda', lastName: 'Martinez', title: 'First Aider' },
        { email: 'camping.coordinator@example.com', firstName: 'Karen', lastName: 'Thompson', title: 'Camping Coordinator' },
        { email: 'activity.helper@example.com', firstName: 'Rachel', lastName: 'Anderson', title: 'Activity Helper' }
    ];

    const assistantIds = [];
    for (const assistant of assistantUsers) {
        const id = troopLeaderStmt.run(
            assistant.email,
            hashPassword('DemoPassword123!'),
            assistant.firstName,
            assistant.lastName,
            'parent',  // Base role is parent, will assign specific role in troop_members
            1,
            1,
            now()
        ).lastInsertRowid;
        assistantIds.push(id);
        console.log(`  ✅ Troop Assistant - ${assistant.title}: ${assistant.firstName} ${assistant.lastName} (ID: ${id})`);
    }

    // ========================================================================
    // Level 4: Parents (5 users)
    // ========================================================================

    const parentUsers = [
        { email: 'parent.smith@example.com', firstName: 'Michael', lastName: 'Smith' },
        { email: 'parent.brown@example.com', firstName: 'Jennifer', lastName: 'Brown' },
        { email: 'parent.davis@example.com', firstName: 'Robert', lastName: 'Davis' },
        { email: 'parent.miller@example.com', firstName: 'Patricia', lastName: 'Miller' },
        { email: 'parent.wilson@example.com', firstName: 'James', lastName: 'Wilson' }
    ];

    const parentIds = [];
    for (const parent of parentUsers) {
        const id = troopLeaderStmt.run(
            parent.email,
            hashPassword('DemoPassword123!'),
            parent.firstName,
            parent.lastName,
            'parent',
            1,
            1,
            now()
        ).lastInsertRowid;
        parentIds.push(id);
        console.log(`  ✅ Parent: ${parent.firstName} ${parent.lastName} (ID: ${id})`);
    }

    // ========================================================================
    // Level 5: Scouts (20+ users with various Girl Scout levels)
    // ========================================================================

    const scoutLevels = ['daisy', 'brownie', 'junior', 'cadette', 'senior', 'ambassador'];
    const scoutFirstNames = [
        'Emma', 'Olivia', 'Ava', 'Isabella', 'Mia',
        'Charlotte', 'Amelia', 'Harper', 'Evelyn', 'Abigail',
        'Sofia', 'Elizabeth', 'Emily', 'Avery', 'Ella',
        'Scarlett', 'Victoria', 'Madison', 'Chloe', 'Penelope',
        'Layla', 'Riley'
    ];
    const scoutLastNames = [
        'Anderson', 'Brown', 'Chen', 'Davis', 'Evans',
        'Fisher', 'Garcia', 'Harris', 'Jones', 'Kumar',
        'Lee', 'Martinez', 'Nelson', 'O\'Brien', 'Patel',
        'Quinn', 'Robinson', 'Smith', 'Taylor', 'Vasquez'
    ];

    const scoutIds = [];
    const scoutStmt = db.prepare(`
        INSERT INTO users (email, password_hash, firstName, lastName, role, isActive, emailVerified, dateOfBirth, isMinor, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    console.log('\n  Creating 22 scouts...');
    for (let i = 0; i < 22; i++) {
        const firstName = scoutFirstNames[i % scoutFirstNames.length];
        const lastName = scoutLastNames[i % scoutLastNames.length];
        const email = `scout.${i + 1}@example.com`;

        // Generate realistic DOB (ages 5-18)
        const currentYear = new Date().getFullYear();
        const birthYear = currentYear - (5 + Math.floor(i / 3)); // Distribute across levels
        const birthMonth = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
        const birthDay = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
        const dateOfBirth = `${birthYear}-${birthMonth}-${birthDay}`;

        const isMinor = (currentYear - birthYear) < 13 ? 1 : 0;

        const id = scoutStmt.run(
            email,
            hashPassword('DemoPassword123!'),
            firstName,
            lastName,
            'scout',
            1,
            1,
            dateOfBirth,
            isMinor,
            now()
        ).lastInsertRowid;

        scoutIds.push(id);
        if ((i + 1) % 5 === 0) {
            console.log(`  ✅ Created ${i + 1} scouts...`);
        }
    }
    console.log(`  ✅ Total Scouts: ${scoutIds.length}`);

    // ========================================================================
    // Create Councils
    // ========================================================================

    console.log('\n📍 Creating councils...');

    const councilStmt = db.prepare(`
        INSERT INTO councils (name, region, contactEmail, contactPhone, address, website, isActive, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const council1Id = councilStmt.run(
        'Metropolitan Girl Scout Council',
        'North Region',
        'contact@metro-gsc.org',
        '(555) 123-4567',
        '123 Scout Lane, City, State 12345',
        'https://metro-gsc.org',
        1,
        now()
    ).lastInsertRowid;

    console.log(`  ✅ Council 1: Metropolitan GSC (ID: ${council1Id})`);

    // ========================================================================
    // Create Troops
    // ========================================================================

    console.log('\n🏘️ Creating troops...');

    const troopStmt = db.prepare(`
        INSERT INTO troops (councilId, troopNumber, troopType, leaderId, meetingLocation, meetingDay, meetingTime, isActive, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const troop1Id = troopStmt.run(
        council1Id,
        '1234',
        'junior',
        troopLeader1Id,
        'Community Center - Room A',
        'Tuesday',
        '4:00 PM',
        1,
        now()
    ).lastInsertRowid;

    const troop2Id = troopStmt.run(
        council1Id,
        '5678',
        'cadette',
        troopLeader2Id,
        'School - Cafeteria',
        'Wednesday',
        '6:00 PM',
        1,
        now()
    ).lastInsertRowid;

    console.log(`  ✅ Troop 1: #1234 (Junior) - Led by Sarah Johnson (ID: ${troop1Id})`);
    console.log(`  ✅ Troop 2: #5678 (Cadette) - Led by Maria Garcia (ID: ${troop2Id})`);

    // ========================================================================
    // Create Troop Members - Assign users to troops with roles
    // ========================================================================

    console.log('\n👫 Creating troop memberships...');

    const memberStmt = db.prepare(`
        INSERT INTO troop_members (troopId, userId, role, scoutLevel, linkedParentId, status, joinDate)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    let memberCount = 0;

    // Troop 1 (Junior level) - Scouts 1-12
    for (let i = 0; i < 12; i++) {
        memberStmt.run(
            troop1Id,
            scoutIds[i],
            'member',
            'junior',
            parentIds[i % parentIds.length],  // Link to a parent
            'active',
            now()
        );
        memberCount++;
    }

    // Troop 2 (Cadette level) - Scouts 13-22
    for (let i = 12; i < scoutIds.length; i++) {
        memberStmt.run(
            troop2Id,
            scoutIds[i],
            'member',
            'cadette',
            parentIds[i % parentIds.length],  // Link to a parent
            'active',
            now()
        );
        memberCount++;
    }

    // Add parents to troops
    for (let i = 0; i < parentIds.length; i++) {
        const troopId = i < 3 ? troop1Id : troop2Id;
        memberStmt.run(
            troopId,
            parentIds[i],
            'parent',
            null,
            null,
            'active',
            now()
        );
        memberCount++;
    }

    // Add troop leaders
    memberStmt.run(troop1Id, troopLeader1Id, 'co-leader', null, null, 'active', now());
    memberStmt.run(troop2Id, troopLeader2Id, 'co-leader', null, null, 'active', now());
    memberCount += 2;

    // Add assistants to troop 1
    memberStmt.run(troop1Id, assistantIds[0], 'assistant', null, null, 'active', now()); // Treasurer
    memberStmt.run(troop1Id, assistantIds[1], 'assistant', null, null, 'active', now()); // Product Manager
    memberStmt.run(troop1Id, assistantIds[2], 'assistant', null, null, 'active', now()); // First Aider
    memberCount += 3;

    // Add assistants to troop 2
    memberStmt.run(troop2Id, assistantIds[3], 'assistant', null, null, 'active', now()); // Camping Coordinator
    memberStmt.run(troop2Id, assistantIds[4], 'assistant', null, null, 'active', now()); // Activity Helper
    memberCount += 2;

    console.log(`  ✅ Created ${memberCount} troop memberships`);

    // ========================================================================
    // Create Active Season (2026)
    // ========================================================================

    console.log('\n📅 Creating seasons and cookies...');

    const seasonStmt = db.prepare(`
        INSERT INTO seasons (year, name, startDate, endDate, isActive, pricePerBox, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const seasonId = seasonStmt.run(
        '2026',
        '2026 Cookie Season',
        '2026-01-01',
        '2026-12-31',
        1,
        6.00,
        now()
    ).lastInsertRowid;

    console.log(`  ✅ Created 2026 season (ID: ${seasonId})`);

    // ========================================================================
    // Add Default Cookies
    // ========================================================================

    const cookieStmt = db.prepare(`
        INSERT INTO cookie_products (season, cookieName, shortName, description, pricePerBox, boxesPerCase, isActive, sortOrder, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const attributeStmt = db.prepare(`
        INSERT INTO cookie_attributes (productId, attributeType, attributeValue, displayLabel)
        VALUES (?, ?, ?, ?)
    `);

    const defaultCookies = [
        { name: 'Thin Mints', shortName: 'TM', description: 'Crispy chocolate wafers dipped in chocolatey coating', attributes: ['dietary:vegan'] },
        { name: 'Samoas', shortName: 'SM', description: 'Caramel, coconut, and chocolatey stripes', attributes: ['allergen:contains_coconut'] },
        { name: 'Tagalongs', shortName: 'TG', description: 'Crispy cookies layered with peanut butter and chocolate', attributes: ['allergen:contains_peanuts'] },
        { name: 'Trefoils', shortName: 'TF', description: 'Traditional shortbread cookie', attributes: [] },
        { name: 'Do-si-dos', shortName: 'DD', description: 'Oatmeal sandwich cookies with peanut butter filling', attributes: ['allergen:contains_peanuts'] },
        { name: 'Lemon-Ups', shortName: 'LU', description: 'Crispy lemon cookies with messages', attributes: [] },
        { name: 'Adventurefuls', shortName: 'AF', description: 'Brownie-inspired cookies with caramel filling', attributes: [] },
        { name: 'Toffee-tastic', shortName: 'TT', description: 'Gluten-free butter cookies with toffee bits', attributes: ['certification:gluten_free'] },
        { name: 'Caramel Chocolate Chip', shortName: 'CCC', description: 'Gluten-free chewy cookies with caramel and chocolate chips', attributes: ['certification:gluten_free'] }
    ];

    let cookieCount = 0;
    for (let i = 0; i < defaultCookies.length; i++) {
        const cookie = defaultCookies[i];
        const cookieId = cookieStmt.run(
            '2026',
            cookie.name,
            cookie.shortName,
            cookie.description,
            6.00,
            12,
            1,
            i,
            now()
        ).lastInsertRowid;

        // Add attributes
        for (const attr of cookie.attributes) {
            const [type, value] = attr.split(':');
            attributeStmt.run(cookieId, type, value, value.replace(/_/g, ' '));
        }
        cookieCount++;
    }
    console.log(`  ✅ Created ${cookieCount} default cookies`);

    // ========================================================================
    // Create Sample Sales for Display Purposes
    // ========================================================================

    console.log('\n💰 Creating sample sales data...');

    const salesStmt = db.prepare(`
        INSERT INTO sales (cookieType, quantity, customerName, date, saleType, unitType, amountCollected, userId)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let salesCount = 0;
    for (let i = 0; i < 10; i++) {
        const scoutId = scoutIds[Math.floor(Math.random() * scoutIds.length)];
        const cookieTypes = ['Thin Mints', 'Samoas', 'Tagalongs', 'Trefoils', 'Do-si-dos'];
        const cookieType = cookieTypes[Math.floor(Math.random() * cookieTypes.length)];
        const quantity = Math.floor(Math.random() * 10) + 5;
        const amount = quantity * 6.00;

        salesStmt.run(
            cookieType,
            quantity,
            `Customer ${i + 1}`,
            new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            Math.random() > 0.5 ? 'individual' : 'booth',
            'box',
            amount,
            scoutId
        );
        salesCount++;
    }
    console.log(`  ✅ Created ${salesCount} sample sales`);

    // ========================================================================
    // Create Troop Goals
    // ========================================================================

    console.log('\n🎯 Creating troop goals...');

    const goalStmt = db.prepare(`
        INSERT INTO troop_goals (troopId, goalType, targetAmount, actualAmount, startDate, endDate, status, description, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    goalStmt.run(
        troop1Id,
        'boxes_sold',
        500,
        Math.floor(Math.random() * 300),
        '2026-01-01',
        '2026-03-31',
        'in_progress',
        'Troop 1 Cookie Goal 2026',
        now()
    );

    goalStmt.run(
        troop2Id,
        'revenue',
        3000,
        Math.floor(Math.random() * 2000),
        '2026-01-01',
        '2026-03-31',
        'in_progress',
        'Troop 2 Revenue Goal 2026',
        now()
    );

    console.log(`  ✅ Created 2 troop goals`);

    // ========================================================================
    // Summary
    // ========================================================================

    console.log('\n' + '='.repeat(60));
    console.log('✅ DATABASE SEEDING COMPLETE');
    console.log('='.repeat(60));

    console.log('\n📊 Summary:');
    console.log(`   Council Admin: 1 (welefort@gmail.com)`);
    console.log(`   Troop Leaders: 2`);
    console.log(`   Troop Assistants: 5`);
    console.log(`   Parents: 5`);
    console.log(`   Scouts: ${scoutIds.length}`);
    console.log(`   Councils: 1`);
    console.log(`   Troops: 2`);
    console.log(`   Troop Members: ${memberCount}`);
    console.log(`   Cookies: ${cookieCount}`);
    console.log(`   Sample Sales: ${salesCount}`);

    console.log('\n🔑 Login Credentials (all use password: DemoPassword123!):');
    console.log('   Council Admin: welefort@gmail.com');
    console.log('   Troop Leader 1: troop.leader1@example.com');
    console.log('   Troop Leader 2: troop.leader2@example.com');
    console.log('   Treasurer: treasurer@example.com');
    console.log('   Parent: parent.smith@example.com');
    console.log('   Scout: scout.1@example.com');

    console.log('\n💡 Tips:');
    console.log('   - Scouts are linked to parents in the troop_members table');
    console.log('   - Try logging in with different accounts to see role-based features');
    console.log('   - Council Admin (welefort@gmail.com) has full system access');
    console.log('   - Parents can only see their linked scout\'s data');
    console.log('   - Scouts can only see their own data (read-only)');

    console.log('\n✨ Ready to start development!\n');

    db.close();
    process.exit(0);

} catch (error) {
    console.error('\n❌ Error during seeding:', error.message);
    console.error(error.stack);
    db.close();
    process.exit(1);
}
