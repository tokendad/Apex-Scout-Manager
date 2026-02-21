#!/usr/bin/env node

/**
 * Seed Sample Badge Data
 *
 * Populates representative badges for each organization:
 * - Girl Scout badges (15-20 samples)
 * - Cub Scout adventures (10-15 samples)
 * - Scouts BSA merit badges (10-15 samples)
 *
 * Usage: node migrations/seed-sample-badges.js
 */

require('dotenv').config();
const db = require('../database/query-helpers');
const logger = require('../logger');

async function seedSampleBadges() {
    logger.info('Starting sample badge data population');

    try {
        // 1. Get organization IDs and catalogs
        const orgs = await db.getAll(`
            SELECT so.id, so."orgCode", bc.id as catalog_id
            FROM scout_organizations so
            LEFT JOIN badge_catalogs bc ON bc."organizationId" = so.id
            ORDER BY so."orgCode"
        `);

        const orgMap = {};
        orgs.forEach(org => {
            orgMap[org.orgCode] = { id: org.id, catalog_id: org.catalog_id };
        });

        if (!orgMap.gsusa || !orgMap.sa_cub || !orgMap.sa_bsa) {
            throw new Error('Not all organizations found. Run seed scripts first.');
        }

        // 2. Girl Scout Badges (GSUSA)
        const girlScoutBadges = [
            {
                code: 'gs_daisy_5_flowers',
                name: '5 Flowers, 4 Stories, 3 Cheers for Animals',
                type: 'petal',
                levels: ['daisy'],
                desc: 'Explore animals and nature with Daisy Girl Scouts',
                req: 'Complete 3+ activities related to animals and nature',
                order: 1
            },
            {
                code: 'gs_daisy_think_like_citizen',
                name: 'Think Like a Citizen Scientist',
                type: 'petal',
                levels: ['daisy'],
                desc: 'Observe and learn from nature around you',
                req: 'Participate in 3+ citizen science activities',
                order: 2
            },
            {
                code: 'gs_brownie_bugs',
                name: 'Bugs',
                type: 'journey',
                levels: ['brownie'],
                desc: 'Learn about insects and their importance',
                req: 'Complete bug-related activities and share learning',
                order: 3
            },
            {
                code: 'gs_brownie_hiker',
                name: 'Hiker',
                type: 'journey',
                levels: ['brownie'],
                desc: 'Explore outdoor hiking and trail skills',
                req: 'Complete 3+ hiking adventures',
                order: 4
            },
            {
                code: 'gs_brownie_artist',
                name: 'Artist',
                type: 'journey',
                levels: ['brownie'],
                desc: 'Express creativity through visual arts',
                req: 'Create and share artwork in various mediums',
                order: 5
            },
            {
                code: 'gs_junior_animal_habitats',
                name: 'Animal Habitats',
                type: 'badge',
                levels: ['junior'],
                desc: 'Understand ecosystems and animal environments',
                req: 'Study habitats and create an action plan',
                order: 6
            },
            {
                code: 'gs_junior_coding_basics',
                name: 'Coding Basics',
                type: 'badge',
                levels: ['junior'],
                desc: 'Introduction to computer programming',
                req: 'Complete coding challenges and projects',
                order: 7
            },
            {
                code: 'gs_junior_drawing',
                name: 'Drawing',
                type: 'badge',
                levels: ['junior'],
                desc: 'Develop drawing techniques and skills',
                req: 'Create drawings showcasing different techniques',
                order: 8
            },
            {
                code: 'gs_junior_first_aid',
                name: 'First Aid',
                type: 'badge',
                levels: ['junior'],
                desc: 'Learn emergency response and first aid basics',
                req: 'Complete first aid training and scenarios',
                order: 9
            },
            {
                code: 'gs_cadette_coding_for_good',
                name: 'Coding For Good',
                type: 'badge',
                levels: ['cadette'],
                desc: 'Use coding to solve real-world problems',
                req: 'Design and code a solution to help your community',
                order: 10
            },
            {
                code: 'gs_cadette_digital_arts',
                name: 'Digital Arts',
                type: 'badge',
                levels: ['cadette'],
                desc: 'Master digital tools for creative expression',
                req: 'Create digital art projects in multiple formats',
                order: 11
            },
            {
                code: 'gs_cadette_robotics',
                name: 'Robotics',
                type: 'badge',
                levels: ['cadette'],
                desc: 'Build and program robots',
                req: 'Complete robotics challenges and competitions',
                order: 12
            },
            {
                code: 'gs_senior_entrepreneurship',
                name: 'Entrepreneurship',
                type: 'badge',
                levels: ['senior', 'ambassador'],
                desc: 'Start and run your own business or social enterprise',
                req: 'Develop business plan and launch venture',
                order: 13
            },
            {
                code: 'gs_senior_cybersecurity',
                name: 'Cybersecurity',
                type: 'badge',
                levels: ['senior', 'ambassador'],
                desc: 'Protect digital information and privacy',
                req: 'Learn and apply cybersecurity best practices',
                order: 14
            },
            {
                code: 'gs_ambassador_public_speaking',
                name: 'Public Speaking',
                type: 'badge',
                levels: ['ambassador'],
                desc: 'Develop presentation and communication skills',
                req: 'Give presentations to groups and refine delivery',
                order: 15
            }
        ];

        // 3. Cub Scout Adventures (Cub Scouts)
        const cubScoutBadges = [
            {
                code: 'cs_lion_fun_on_run',
                name: 'Fun on the Run',
                type: 'adventure',
                levels: ['lion'],
                desc: 'Get moving and explore activities with friends',
                req: 'Complete physical activities and games',
                order: 1
            },
            {
                code: 'cs_lion_animal_kingdom',
                name: 'Animal Kingdom',
                type: 'adventure',
                levels: ['lion'],
                desc: 'Learn about animals and their habitats',
                req: 'Observe and learn about different animals',
                order: 2
            },
            {
                code: 'cs_tiger_curiosity',
                name: 'Curiosity, Intrigue, and Magical Mysteries',
                type: 'adventure',
                levels: ['tiger'],
                desc: 'Explore mysteries and learn through discovery',
                req: 'Complete mystery and exploration activities',
                order: 3
            },
            {
                code: 'cs_tiger_bites',
                name: 'Tiger Bites',
                type: 'adventure',
                levels: ['tiger'],
                desc: 'Build skills and have adventures',
                req: 'Complete a variety of skill-building activities',
                order: 4
            },
            {
                code: 'cs_wolf_call_wild',
                name: 'Call of the Wild',
                type: 'adventure',
                levels: ['wolf'],
                desc: 'Explore outdoor skills and wildlife',
                req: 'Learn camping and wildlife skills',
                order: 5
            },
            {
                code: 'cs_wolf_paws_path',
                name: 'Paws on the Path',
                type: 'adventure',
                levels: ['wolf'],
                desc: 'Follow trails and explore your community',
                req: 'Complete trail walks and community exploration',
                order: 6
            },
            {
                code: 'cs_bear_bear_claws',
                name: 'Bear Claws',
                type: 'adventure',
                levels: ['bear'],
                desc: 'Develop physical skills and coordination',
                req: 'Complete physical challenges and sports',
                order: 7
            },
            {
                code: 'cs_bear_furs_feathers',
                name: 'Fur, Feathers, and Ferns',
                type: 'adventure',
                levels: ['bear'],
                desc: 'Explore wildlife and ecosystems',
                req: 'Study wildlife and natural habitats',
                order: 8
            },
            {
                code: 'cs_webelos_stronger_faster',
                name: 'Stronger, Faster, Higher',
                type: 'adventure',
                levels: ['webelos'],
                desc: 'Build fitness and athletic skills',
                req: 'Complete fitness challenges and athletic activities',
                order: 9
            },
            {
                code: 'cs_webelos_aquanaut',
                name: 'Aquanaut',
                type: 'adventure',
                levels: ['webelos'],
                desc: 'Learn water sports and safety',
                req: 'Complete water-related activities and safety training',
                order: 10
            },
            {
                code: 'cs_arrow_outdoor_skills',
                name: 'Outdoor Skills',
                type: 'adventure',
                levels: ['arrow_of_light'],
                desc: 'Master outdoor camping and survival skills',
                req: 'Complete advanced outdoor activities',
                order: 11
            }
        ];

        // 4. Scouts BSA Merit Badges (Scouts BSA)
        const scoutsBSABadges = [
            {
                code: 'bsa_first_aid',
                name: 'First Aid',
                type: 'merit',
                levels: ['scout', 'tenderfoot', 'second_class', 'first_class', 'star_scout', 'life_scout', 'eagle_scout'],
                desc: 'Learn emergency response and first aid',
                req: 'Complete first aid training and certification',
                order: 1
            },
            {
                code: 'bsa_citizenship_community',
                name: 'Citizenship in the Community',
                type: 'merit',
                levels: ['scout', 'tenderfoot', 'second_class', 'first_class', 'star_scout', 'life_scout', 'eagle_scout'],
                desc: 'Understand roles and responsibilities in your community',
                req: 'Participate in community service projects',
                order: 2
            },
            {
                code: 'bsa_camping',
                name: 'Camping',
                type: 'merit',
                levels: ['scout', 'tenderfoot', 'second_class', 'first_class', 'star_scout', 'life_scout', 'eagle_scout'],
                desc: 'Master camping skills and outdoor living',
                req: 'Complete camping trips and outdoor activities',
                order: 3
            },
            {
                code: 'bsa_emergency_preparedness',
                name: 'Emergency Preparedness',
                type: 'merit',
                levels: ['scout', 'tenderfoot', 'second_class', 'first_class', 'star_scout', 'life_scout', 'eagle_scout'],
                desc: 'Prepare for and respond to emergencies',
                req: 'Create emergency plans and practice responses',
                order: 4
            },
            {
                code: 'bsa_environmental_science',
                name: 'Environmental Science',
                type: 'merit',
                levels: ['tenderfoot', 'second_class', 'first_class', 'star_scout', 'life_scout', 'eagle_scout'],
                desc: 'Understand environmental concepts and conservation',
                req: 'Complete environmental projects and studies',
                order: 5
            },
            {
                code: 'bsa_cooking',
                name: 'Cooking',
                type: 'merit',
                levels: ['scout', 'tenderfoot', 'second_class', 'first_class', 'star_scout', 'life_scout', 'eagle_scout'],
                desc: 'Develop cooking and meal preparation skills',
                req: 'Prepare and serve meals in various settings',
                order: 6
            },
            {
                code: 'bsa_hiking',
                name: 'Hiking',
                type: 'merit',
                levels: ['scout', 'tenderfoot', 'second_class', 'first_class', 'star_scout', 'life_scout', 'eagle_scout'],
                desc: 'Master hiking and trail navigation skills',
                req: 'Complete hiking trips and develop trail skills',
                order: 7
            },
            {
                code: 'bsa_programming',
                name: 'Programming',
                type: 'merit',
                levels: ['scout', 'tenderfoot', 'second_class', 'first_class', 'star_scout', 'life_scout', 'eagle_scout'],
                desc: 'Learn computer programming languages and concepts',
                req: 'Write and run programs in multiple languages',
                order: 8
            },
            {
                code: 'bsa_robotics',
                name: 'Robotics',
                type: 'merit',
                levels: ['scout', 'tenderfoot', 'second_class', 'first_class', 'star_scout', 'life_scout', 'eagle_scout'],
                desc: 'Design and build functioning robots',
                req: 'Build robots and compete in challenges',
                order: 9
            },
            {
                code: 'bsa_chess',
                name: 'Chess',
                type: 'merit',
                levels: ['scout', 'tenderfoot', 'second_class', 'first_class', 'star_scout', 'life_scout', 'eagle_scout'],
                desc: 'Master the game of chess and strategy',
                req: 'Learn chess rules and play matches',
                order: 10
            },
            {
                code: 'bsa_communications',
                name: 'Communications',
                type: 'merit',
                levels: ['scout', 'tenderfoot', 'second_class', 'first_class', 'star_scout', 'life_scout', 'eagle_scout'],
                desc: 'Develop oral and written communication skills',
                req: 'Practice various communication methods',
                order: 11
            },
            {
                code: 'bsa_public_speaking',
                name: 'Public Speaking',
                type: 'merit',
                levels: ['scout', 'tenderfoot', 'second_class', 'first_class', 'star_scout', 'life_scout', 'eagle_scout'],
                desc: 'Master presentation and speaking skills',
                req: 'Give presentations to groups',
                order: 12
            }
        ];

        // 5. Insert Girl Scout badges
        // TODO: Populate "imageUrl" with official badge images from GSUSA CDN once URLs are confirmed.
        // The GSUSA badge explorer at https://www.girlscouts.org/en/members/for-girl-scouts/badges-journeys-awards/badge-explorer.html
        // uses Angular with dynamic loading; badge images are served via CDN but URLs could not be
        // reliably determined via static scraping. Update imageUrl values here and change
        // ON CONFLICT ... DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl" to push the new URLs.
        let gsCount = 0;
        for (const badge of girlScoutBadges) {
            await db.run(`
                INSERT INTO badges (
                    "badgeCatalogId", "badgeCode", "badgeName", "badgeType",
                    description, requirements, "applicableLevels", "sortOrder", "isActive"
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT ("badgeCatalogId", "badgeCode") DO UPDATE SET
                    "badgeName"       = EXCLUDED."badgeName",
                    description       = EXCLUDED.description,
                    requirements      = EXCLUDED.requirements,
                    "applicableLevels"= EXCLUDED."applicableLevels",
                    "sortOrder"       = EXCLUDED."sortOrder"
            `, [
                orgMap.gsusa.catalog_id, badge.code, badge.name, badge.type,
                badge.desc, badge.req, JSON.stringify(badge.levels), badge.order, true
            ]);
            gsCount++;
        }
        logger.info('Girl Scout badges created', { count: gsCount });

        // 6. Insert Cub Scout adventures
        let csCount = 0;
        for (const badge of cubScoutBadges) {
            await db.run(`
                INSERT INTO badges (
                    "badgeCatalogId", "badgeCode", "badgeName", "badgeType",
                    description, requirements, "applicableLevels", "sortOrder", "isActive"
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT ("badgeCatalogId", "badgeCode") DO UPDATE SET
                    "badgeName"       = EXCLUDED."badgeName",
                    description       = EXCLUDED.description,
                    requirements      = EXCLUDED.requirements,
                    "applicableLevels"= EXCLUDED."applicableLevels",
                    "sortOrder"       = EXCLUDED."sortOrder"
            `, [
                orgMap.sa_cub.catalog_id, badge.code, badge.name, badge.type,
                badge.desc, badge.req, JSON.stringify(badge.levels), badge.order, true
            ]);
            csCount++;
        }
        logger.info('Cub Scout adventures created', { count: csCount });

        // 7. Insert Scouts BSA merit badges
        let bsaCount = 0;
        for (const badge of scoutsBSABadges) {
            await db.run(`
                INSERT INTO badges (
                    "badgeCatalogId", "badgeCode", "badgeName", "badgeType",
                    description, requirements, "applicableLevels", "sortOrder", "isActive"
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT ("badgeCatalogId", "badgeCode") DO UPDATE SET
                    "badgeName"       = EXCLUDED."badgeName",
                    description       = EXCLUDED.description,
                    requirements      = EXCLUDED.requirements,
                    "applicableLevels"= EXCLUDED."applicableLevels",
                    "sortOrder"       = EXCLUDED."sortOrder"
            `, [
                orgMap.sa_bsa.catalog_id, badge.code, badge.name, badge.type,
                badge.desc, badge.req, JSON.stringify(badge.levels), badge.order, true
            ]);
            bsaCount++;
        }
        logger.info('Scouts BSA merit badges created', { count: bsaCount });

        // 8. Summary
        const totalBadges = gsCount + csCount + bsaCount;
        logger.info(`✅ Sample badge population completed`, {
            girlScout: gsCount,
            cubScout: csCount,
            scoutsBSA: bsaCount,
            total: totalBadges
        });

    } catch (error) {
        logger.error('❌ Error seeding sample badges', { error: error.message, stack: error.stack });
        throw error;
    } finally {
        await db.close();
    }
}

// Run if called directly
if (require.main === module) {
    seedSampleBadges()
        .then(() => {
            console.log('✅ Sample badges seed completed');
            process.exit(0);
        })
        .catch(err => {
            console.error('❌ Seed failed:', err.message);
            process.exit(1);
        });
}

module.exports = { seedSampleBadges };
