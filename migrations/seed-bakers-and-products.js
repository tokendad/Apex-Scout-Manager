#!/usr/bin/env node

/**
 * Seed Bakers and Cookie Product Lineups
 *
 * Creates both licensed Girl Scout cookie bakers and their product lineups:
 * - Little Brownie Bakers (LBB) - Ferrero Group
 * - ABC Bakers - Interbake Foods
 *
 * Products are linked to the GSUSA organization and the 2026 season.
 * Products may change annually - this script can be re-run with updated data.
 *
 * Usage: node migrations/seed-bakers-and-products.js
 */

require('dotenv').config();
const db = require('../database/query-helpers');
const logger = require('../logger');

async function seedBakersAndProducts() {
    logger.info('Starting baker and cookie product seeding');

    try {
        // 1. Create/update bakers
        const bakers = [
            {
                bakerName: 'Little Brownie Bakers',
                bakerCode: 'lbb',
                website: 'https://www.littlebrowniebakers.com/'
            },
            {
                bakerName: 'ABC Bakers',
                bakerCode: 'abc',
                website: 'https://www.abcbakers.com/'
            }
        ];

        const bakerIds = {};
        for (const baker of bakers) {
            const existing = await db.getOne(
                'SELECT id FROM bakers WHERE "bakerCode" = $1',
                [baker.bakerCode]
            );
            if (existing) {
                bakerIds[baker.bakerCode] = existing.id;
                logger.info(`Baker ${baker.bakerCode} already exists`, { id: existing.id });
            } else {
                const result = await db.getOne(`
                    INSERT INTO bakers ("bakerName", "bakerCode", website)
                    VALUES ($1, $2, $3)
                    RETURNING id
                `, [baker.bakerName, baker.bakerCode, baker.website]);
                bakerIds[baker.bakerCode] = result.id;
                logger.info(`Created baker: ${baker.bakerName}`, { id: result.id });
            }
        }

        // 2. Find GSUSA organization
        const gsusa = await db.getOne(
            'SELECT id FROM scout_organizations WHERE "orgCode" = $1',
            ['gsusa']
        );
        if (!gsusa) {
            throw new Error('GSUSA organization not found. Run seed-gsusa-organization.js first.');
        }

        // 3. Ensure 2026 season exists
        let season = await db.getOne(
            'SELECT * FROM seasons WHERE year = $1',
            ['2026']
        );
        if (!season) {
            season = await db.getOne(`
                INSERT INTO seasons (year, name, "startDate", "endDate", "isActive", "pricePerBox")
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            `, ['2026', '2025-2026 Cookie Season', '2026-01-01', '2026-03-31', true, 6.00]);
            logger.info('Created 2026 season');
        }

        // 4. Define Little Brownie Bakers products (2025-26 season)
        // Source: Goal Getter Order Card and Cookie Manager Manual
        const lbbProducts = [
            {
                cookieName: 'Adventurefuls',
                shortName: 'AF',
                description: 'Indulgent brownie-inspired cookies with caramel flavored creme and a hint of sea salt. Approximately 15 cookies per 6.3 oz. pkg.',
                sortOrder: 0,
                attributes: [{ type: 'ingredient', value: 'real_cocoa', label: 'Real Cocoa' }]
            },
            {
                cookieName: 'Lemon-Ups',
                shortName: 'LU',
                description: 'Crispy lemon flavored cookies with inspiring messages to lift your spirits. Approximately 12 cookies per 6.2 oz. pkg.',
                sortOrder: 1,
                attributes: []
            },
            {
                cookieName: 'Trefoils',
                shortName: 'TF',
                description: 'Iconic shortbread cookies inspired by the original Girl Scout recipe. Approximately 38 cookies per 9 oz. pkg.',
                sortOrder: 2,
                attributes: []
            },
            {
                cookieName: 'Do-si-dos',
                shortName: 'DD',
                description: 'Oatmeal sandwich cookies with peanut butter filling. Approximately 20 cookies per 8 oz. pkg. Made with natural flavors.',
                sortOrder: 3,
                attributes: [
                    { type: 'allergen', value: 'contains_peanuts', label: 'Contains Peanuts' },
                    { type: 'ingredient', value: 'natural_flavors', label: 'Made with Natural Flavors' }
                ]
            },
            {
                cookieName: 'Samoas',
                shortName: 'SM',
                description: 'Crisp cookies with caramel, coconut and dark chocolaty stripes. Approximately 15 cookies per 7.5 oz. pkg.',
                sortOrder: 4,
                attributes: [
                    { type: 'allergen', value: 'contains_coconut', label: 'Contains Coconut' },
                    { type: 'ingredient', value: 'real_cocoa', label: 'Real Cocoa' }
                ]
            },
            {
                cookieName: 'Tagalongs',
                shortName: 'TG',
                description: 'Crispy cookies layered with peanut butter and covered with a chocolaty coating. Approximately 15 cookies per 6.5 oz. pkg.',
                sortOrder: 5,
                attributes: [
                    { type: 'allergen', value: 'contains_peanuts', label: 'Contains Peanuts' },
                    { type: 'ingredient', value: 'real_cocoa', label: 'Real Cocoa' }
                ]
            },
            {
                cookieName: 'Thin Mints',
                shortName: 'TM',
                description: 'Crisp, chocolaty cookies made with natural oil of peppermint. Approximately 30 cookies per 9 oz. pkg. Made with vegan ingredients.',
                sortOrder: 6,
                attributes: [{ type: 'dietary', value: 'vegan', label: 'Made with Vegan Ingredients' }]
            },
            {
                cookieName: 'Exploremores',
                shortName: 'EX',
                description: 'Sandwich cookies with chocolate, marshmallow and almond flavored creme. Approximately 18 cookies per 7.9 oz. pkg.',
                sortOrder: 7,
                attributes: []
            },
            {
                cookieName: 'Toffee-tastic',
                shortName: 'TT',
                description: 'Rich, buttery toffee cookies with sweet, crunchy toffee bits. Approximately 14 cookies per 6.7 oz. pkg. Gluten-free. No artificial flavors.',
                sortOrder: 8,
                attributes: [
                    { type: 'certification', value: 'gluten_free', label: 'Gluten-Free' },
                    { type: 'dietary', value: 'no_artificial_flavors', label: 'No Artificial Flavors' }
                ]
            }
        ];

        // 5. Define ABC Bakers products (2025-26 season)
        const abcProducts = [
            {
                cookieName: 'Toast-Yay!',
                shortName: 'TY',
                description: 'French toast-inspired cookies dipped in icing. A sweet treat inspired by a breakfast favorite.',
                sortOrder: 0,
                attributes: []
            },
            {
                cookieName: 'Lemonades',
                shortName: 'LE',
                description: 'Savory, crispy cookies topped with a tangy lemon-flavored icing.',
                sortOrder: 1,
                attributes: []
            },
            {
                cookieName: 'Shortbread',
                shortName: 'SB',
                description: 'Traditional shortbread cookies baked in a trefoil shape. A simple, classic cookie.',
                sortOrder: 2,
                attributes: []
            },
            {
                cookieName: 'Peanut Butter Sandwich',
                shortName: 'PBS',
                description: 'Crispy oatmeal cookies with creamy peanut butter filling.',
                sortOrder: 3,
                attributes: [{ type: 'allergen', value: 'contains_peanuts', label: 'Contains Peanuts' }]
            },
            {
                cookieName: 'Caramel deLites',
                shortName: 'CD',
                description: 'Cookies topped with caramel, toasted coconut, and chocolaty stripes.',
                sortOrder: 4,
                attributes: [{ type: 'allergen', value: 'contains_coconut', label: 'Contains Coconut' }]
            },
            {
                cookieName: 'Peanut Butter Patties',
                shortName: 'PBP',
                description: 'Crispy cookies coated in chocolaty covering with peanut butter filling.',
                sortOrder: 5,
                attributes: [{ type: 'allergen', value: 'contains_peanuts', label: 'Contains Peanuts' }]
            },
            {
                cookieName: 'Thin Mints',
                shortName: 'TM',
                description: 'Crisp, chocolate cookies dipped in a mint chocolaty coating. Made with natural oil of peppermint.',
                sortOrder: 6,
                attributes: [{ type: 'dietary', value: 'vegan', label: 'Made with Vegan Ingredients' }]
            },
            {
                cookieName: "Girl Scout S'mores",
                shortName: 'GSM',
                description: 'Graham sandwich cookies with chocolaty and marshmallowy flavored filling.',
                sortOrder: 7,
                attributes: []
            },
            {
                cookieName: 'Toffee-tastic',
                shortName: 'TT',
                description: 'Rich, buttery cookies with sweet, crunchy toffee bits. Gluten-free.',
                sortOrder: 8,
                attributes: [{ type: 'certification', value: 'gluten_free', label: 'Gluten-Free' }]
            },
            {
                cookieName: 'Raspberry Rally',
                shortName: 'RR',
                description: 'Thin, crispy cookies infused with raspberry flavor, dipped in chocolaty coating. Online exclusive.',
                sortOrder: 9,
                attributes: []
            }
        ];

        // 6. Insert products for each baker
        let totalCreated = 0;

        // Relax the attributeType CHECK constraint to allow 'ingredient' type
        await db.query(`
            ALTER TABLE cookie_attributes DROP CONSTRAINT IF EXISTS attributetype_check
        `).catch(() => {});
        await db.query(`
            ALTER TABLE cookie_attributes ADD CONSTRAINT attributetype_check
            CHECK ("attributeType" IN ('dietary', 'allergen', 'certification', 'ingredient'))
        `).catch(() => {});

        const insertProducts = async (products, bakerCode) => {
            const bakerId = bakerIds[bakerCode];
            for (const product of products) {
                // Check if product already exists for this baker+season
                // Note: UNIQUE constraint is on (season, cookieName) so we also check bakerId
                const existing = await db.getOne(`
                    SELECT id FROM cookie_products
                    WHERE season = $1 AND "cookieName" = $2 AND ("bakerId" = $3 OR "bakerId" IS NULL)
                `, ['2026', product.cookieName, bakerId]);

                if (existing) {
                    logger.info(`  Product already exists: ${product.cookieName} (${bakerCode})`);
                    continue;
                }

                // Insert product
                const result = await db.getOne(`
                    INSERT INTO cookie_products (
                        season, "cookieName", "shortName", description,
                        "pricePerBox", "boxesPerCase", "isActive", "sortOrder",
                        "bakerId", "organizationId"
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    RETURNING id
                `, [
                    '2026', product.cookieName, product.shortName, product.description,
                    6.00, 12, true, product.sortOrder,
                    bakerId, gsusa.id
                ]);

                // Insert attributes
                for (const attr of product.attributes) {
                    await db.query(`
                        INSERT INTO cookie_attributes ("productId", "attributeType", "attributeValue", "displayLabel")
                        VALUES ($1, $2, $3, $4)
                    `, [result.id, attr.type, attr.value, attr.label]);
                }

                totalCreated++;
                logger.info(`  Created: ${product.cookieName} (${product.shortName}) [${bakerCode}]`);
            }
        };

        logger.info('Seeding Little Brownie Bakers products...');
        await insertProducts(lbbProducts, 'lbb');

        logger.info('Seeding ABC Bakers products...');
        await insertProducts(abcProducts, 'abc');

        // 7. Update existing products (from earlier seed) to link to LBB baker + GSUSA org
        const unlinkedCount = await db.query(`
            UPDATE cookie_products
            SET "bakerId" = $1, "organizationId" = $2
            WHERE "bakerId" IS NULL AND "organizationId" IS NULL AND season = '2026'
        `, [bakerIds.lbb, gsusa.id]);
        if (unlinkedCount && unlinkedCount.rowCount > 0) {
            logger.info(`Linked ${unlinkedCount.rowCount} existing products to LBB/GSUSA`);
        }

        logger.info(`Baker seeding complete. ${totalCreated} new products created.`);
        logger.info(`  LBB: ${lbbProducts.length} products`);
        logger.info(`  ABC: ${abcProducts.length} products`);

    } catch (error) {
        logger.error('Baker seeding failed', { error: error.message, stack: error.stack });
        process.exit(1);
    }

    process.exit(0);
}

seedBakersAndProducts();
