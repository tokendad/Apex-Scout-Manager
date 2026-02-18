#!/usr/bin/env node

/**
 * Seed Test Users and Accounts
 *
 * Creates test accounts for all roles and organizations:
 * - SuperUser/Council Admin (welefort@gmail.com - existing account upgraded)
 * - Girl Scouts: Scout, Parent, Troop Leader
 * - Cub Scouts: Scout, Parent, Troop Leader
 * - Scouts BSA: Scout, Parent, Troop Leader
 *
 * Password for all new accounts: TestPass123!
 *
 * Usage: node migrations/seed-test-users.js
 */

require('dotenv').config();
const db = require('../database/query-helpers');
const logger = require('../logger');
const bcrypt = require('bcryptjs');

async function seedTestUsers() {
    logger.info('Starting test user account seeding');

    try {
        // 2. Get all organizations
        const orgs = await db.getAll(`
            SELECT id, "orgCode", "orgName" FROM scout_organizations ORDER BY "orgCode"
        `);

        if (orgs.length === 0) {
            throw new Error('No organizations found. Run seed-gsusa-organization.js, seed-cub-scouts.js, and seed-scouts-bsa.js first.');
        }

        logger.info(`Found ${orgs.length} organizations`, {
            orgs: orgs.map(o => o.orgCode).join(', ')
        });

        const defaultPassword = 'TestPass123!';
        const hashedPassword = await bcrypt.hash(defaultPassword, 12);

        let totalCreated = 0;

        // 3. Create test accounts for each organization
        for (const org of orgs) {
            logger.info(`Creating test accounts for ${org.orgCode}...`);

            // Get first troop or create one
            let troop = await db.getOne(`
                SELECT id FROM troops WHERE "organizationId" = $1 LIMIT 1
            `, [org.id]);

            if (!troop) {
                logger.info(`Creating test troop for ${org.orgCode}...`);
                troop = await db.getOne(`
                    INSERT INTO troops (
                        "troopName", "troopNumber", "troopType", "isActive"
                    ) VALUES ($1, $2, $3, $4)
                    RETURNING id
                `, [
                    `${org.orgName} Test Troop`,
                    Math.floor(Math.random() * 10000).toString(),
                    'multi-level', // Valid for all organization types
                    true
                ]);
                logger.info(`Created test troop for ${org.orgCode}`, { troopId: troop.id });
            }

            // 3a. Create Scout user
            const scoutEmail = `scout.${org.orgCode}@test.local`;
            let scoutUser = await db.getOne(`
                SELECT id FROM users WHERE email = $1
            `, [scoutEmail]);

            if (!scoutUser) {
                scoutUser = await db.getOne(`
                    INSERT INTO users (
                        email, "password_hash", "firstName", "lastName", role, "isActive"
                    ) VALUES ($1, $2, $3, $4, $5, $6)
                    RETURNING id
                `, [
                    scoutEmail,
                    hashedPassword,
                    `Scout${org.orgCode.toUpperCase()}`,
                    `Test${org.orgCode}`,
                    'scout',
                    true
                ]);
            }

            // Link scout to troop and create scout profile
            const scoutProfile = await db.getOne(`
                SELECT id FROM scout_profiles WHERE "userId" = $1
            `, [scoutUser.id]);

            if (!scoutProfile) {
                // Get first level for this organization
                const level = await db.getOne(`
                    SELECT sl.id
                    FROM scout_levels sl
                    JOIN level_systems ls ON ls.id = sl."levelSystemId"
                    WHERE ls."organizationId" = $1
                    ORDER BY sl."sortOrder"
                    LIMIT 1
                `, [org.id]);

                await db.run(`
                    INSERT INTO scout_profiles (
                        "userId", "organizationId", "troopId", "currentLevelId", status
                    ) VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT ("userId") DO NOTHING
                `, [
                    scoutUser.id,
                    org.id,
                    troop.id,
                    level ? level.id : null,
                    'active'
                ]);
            }

            // Add scout to troop members (use 'member' role)
            try {
                await db.run(`
                    INSERT INTO troop_members (
                        "troopId", "userId", role, status, "joinDate"
                    ) VALUES ($1, $2, $3, $4, CURRENT_DATE)
                `, [troop.id, scoutUser.id, 'member', 'active']);
            } catch (err) {
                if (err.code !== '23505') { // Ignore duplicate key errors
                    throw err;
                }
            }

            logger.info(`✅ Created scout account: ${scoutEmail}`);
            totalCreated++;

            // 3b. Create Parent user
            const parentEmail = `parent.${org.orgCode}@test.local`;
            let parentUser = await db.getOne(`
                SELECT id FROM users WHERE email = $1
            `, [parentEmail]);

            if (!parentUser) {
                parentUser = await db.getOne(`
                    INSERT INTO users (
                        email, "password_hash", "firstName", "lastName", role, "isActive"
                    ) VALUES ($1, $2, $3, $4, $5, $6)
                    RETURNING id
                `, [
                    parentEmail,
                    hashedPassword,
                    `Parent${org.orgCode.toUpperCase()}`,
                    `Test${org.orgCode}`,
                    'parent',
                    true
                ]);
            }

            logger.info(`✅ Created parent account: ${parentEmail}`);
            totalCreated++;

            // 3c. Create Troop Leader user
            const leaderEmail = `leader.${org.orgCode}@test.local`;
            let leaderUser = await db.getOne(`
                SELECT id FROM users WHERE email = $1
            `, [leaderEmail]);

            if (!leaderUser) {
                leaderUser = await db.getOne(`
                    INSERT INTO users (
                        email, "password_hash", "firstName", "lastName", role, "isActive"
                    ) VALUES ($1, $2, $3, $4, $5, $6)
                    RETURNING id
                `, [
                    leaderEmail,
                    hashedPassword,
                    `Leader${org.orgCode.toUpperCase()}`,
                    `Test${org.orgCode}`,
                    'troop_leader',
                    true
                ]);
            }

            // Add leader to troop members
            try {
                await db.run(`
                    INSERT INTO troop_members (
                        "troopId", "userId", role, status, "joinDate"
                    ) VALUES ($1, $2, $3, $4, CURRENT_DATE)
                `, [troop.id, leaderUser.id, 'troop_leader', 'active']);
            } catch (err) {
                if (err.code !== '23505') { // Ignore duplicate key errors
                    throw err;
                }
            }

            logger.info(`✅ Created troop leader account: ${leaderEmail}`);
            totalCreated++;
        }

        // 4. Summary
        logger.info(`✅ Test user account seeding completed`, {
            total: totalCreated,
            defaultPassword: defaultPassword,
            note: 'All new accounts use password: TestPass123!'
        });

        // 5. Display credentials
        logger.info('');
        logger.info('═'.repeat(60));
        logger.info('TEST ACCOUNT CREDENTIALS');
        logger.info('═'.repeat(60));
        logger.info('');
        logger.info('SUPERUSER/COUNCIL ADMIN:');
        logger.info('  Email: welefort@gmail.com');
        logger.info('  Password: Admin123!');
        logger.info('  Role: council_admin (access to all data)');
        logger.info('');

        for (const org of orgs) {
            logger.info(`${org.orgName.toUpperCase()}:`);
            logger.info(`  Scout:`);
            logger.info(`    Email: scout.${org.orgCode}@test.local`);
            logger.info(`    Password: ${defaultPassword}`);
            logger.info(`  Parent:`);
            logger.info(`    Email: parent.${org.orgCode}@test.local`);
            logger.info(`    Password: ${defaultPassword}`);
            logger.info(`  Troop Leader:`);
            logger.info(`    Email: leader.${org.orgCode}@test.local`);
            logger.info(`    Password: ${defaultPassword}`);
            logger.info('');
        }
        logger.info('═'.repeat(60));

    } catch (error) {
        logger.error('❌ Error seeding test users', { error: error.message, stack: error.stack });
        throw error;
    } finally {
        await db.close();
    }
}

// Run if called directly
if (require.main === module) {
    seedTestUsers()
        .then(() => {
            console.log('✅ Test users seed completed');
            process.exit(0);
        })
        .catch(err => {
            console.error('❌ Seed failed:', err.message);
            process.exit(1);
        });
}

module.exports = { seedTestUsers };
