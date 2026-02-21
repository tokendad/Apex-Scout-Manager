#!/usr/bin/env node

/**
 * seed-gsusa-badges-full.js
 *
 * Seeds all official GSUSA badges from the badge explorer JSON API.
 * Source: https://www.girlscouts.org/en/members/for-girl-scouts/badges-journeys-awards/badge-explorer/jcr:content/root/container/badge_explorer.model.json
 *
 * Usage: node migrations/seed-gsusa-badges-full.js
 *
 * Data notes:
 *  - 363 badges across 6 levels (Daisy, Brownie, Junior, Cadette, Senior, Ambassador)
 *  - All badges have a title, image, and rank (verified before seeding)
 *  - badgeCode uses the GSUSA uniqueId (globally unique UUID from their system)
 *  - idTitle is NOT globally unique (same badge name exists across multiple levels)
 *  - "Senior  (Grades 9-10)" has two spaces — handled by trim() in rank mapping
 */

require('dotenv').config();
const fs = require('fs');
const https = require('https');
const db = require('../database/query-helpers');
const logger = require('../logger');

const GS_API_URL = 'https://www.girlscouts.org/en/members/for-girl-scouts/badges-journeys-awards/badge-explorer/jcr:content/root/container/badge_explorer.model.json';
const LOCAL_FALLBACK = '/tmp/gs-badges.json';
const BATCH_SIZE = 50;

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

function fetchFromApi() {
    return new Promise((resolve, reject) => {
        const req = https.get(GS_API_URL, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ASM-seed/1.0)' } }, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode} from API`));
                res.resume();
                return;
            }
            let raw = '';
            res.on('data', chunk => { raw += chunk; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(raw));
                } catch (e) {
                    reject(new Error('Failed to parse API JSON: ' + e.message));
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(30000, () => {
            req.destroy(new Error('API request timed out after 30s'));
        });
    });
}

async function getBadgeData() {
    // Try API first; fall back to local file if API fails or file exists
    if (fs.existsSync(LOCAL_FALLBACK)) {
        logger.info('Using local fallback file', { path: LOCAL_FALLBACK });
        const raw = fs.readFileSync(LOCAL_FALLBACK, 'utf8');
        return JSON.parse(raw);
    }
    logger.info('Fetching badge data from official GSUSA API...');
    return await fetchFromApi();
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

/**
 * Map GSUSA rank string to our level code array.
 * Handles extra whitespace (e.g. "Senior  (Grades 9-10)").
 */
function mapRankToLevels(rank) {
    if (!rank) return null;
    const normalized = rank.trim().toLowerCase();
    if (normalized.startsWith('daisy'))      return ['daisy'];
    if (normalized.startsWith('brownie'))    return ['brownie'];
    if (normalized.startsWith('junior'))     return ['junior'];
    if (normalized.startsWith('cadette'))    return ['cadette'];
    if (normalized.startsWith('senior'))     return ['senior'];
    if (normalized.startsWith('ambassador')) return ['ambassador'];
    return null; // unknown rank
}

/**
 * Determine badge type from filter, otherTags, and title.
 * Priority: petal > journey > award > badge (default)
 */
function determineBadgeType(badge) {
    const filter = (badge.filter || '').toLowerCase();
    const tags   = (badge.otherTags || []).map(t => t.toLowerCase()).join(' ');
    const title  = (badge.title || '').toLowerCase();
    const image  = (badge.image || '').toLowerCase();

    // Petals are Daisy-level leaf/petal shaped badges
    if (filter.includes('petal') || image.includes('petal') || title.includes('petal')) {
        return 'petal';
    }

    // Journey badges
    if (filter.includes('journey') || tags.includes('journey')) {
        return 'journey';
    }

    // Award badges (highest awards, leadership awards, Gold/Silver/Bronze)
    if (
        tags.includes('award') ||
        title.includes('gold award') ||
        title.includes('silver award') ||
        title.includes('bronze award') ||
        tags.includes('highest awards') ||
        tags.includes('leadership awards')
    ) {
        return 'award';
    }

    return 'badge';
}

/**
 * Build a badgeCode from uniqueId (globally unique per GSUSA).
 * Prefixed with "gs_" for namespace clarity.
 */
function buildBadgeCode(badge) {
    return 'gs_' + badge.uniqueId;
}

/**
 * Strip HTML tags from description text.
 */
function stripHtml(html) {
    if (!html) return null;
    return html
        .replace(/<[^>]+>/g, ' ')   // replace tags with space
        .replace(/&nbsp;/g, ' ')     // decode common entities
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s{2,}/g, ' ')     // collapse multiple spaces
        .trim() || null;
}

/**
 * Build a full imageUrl by prepending the GSUSA base URL.
 */
function buildImageUrl(imagePath) {
    if (!imagePath) return null;
    if (imagePath.startsWith('http')) return imagePath;
    return 'https://www.girlscouts.org' + imagePath;
}

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------

async function seedGsuaBadgesFull() {
    logger.info('Starting full GSUSA badge seed');

    const jsonData = await getBadgeData();
    const badges = jsonData.badges;

    if (!Array.isArray(badges)) {
        throw new Error('Expected badges array in JSON; got: ' + typeof badges);
    }
    logger.info('Badge data loaded', { count: badges.length });

    // 1. Look up GSUSA organization
    const org = await db.getOne(
        `SELECT id FROM scout_organizations WHERE "orgCode" = 'gsusa'`
    );
    if (!org) throw new Error('GSUSA organization not found. Run seed-gsusa-organization.js first.');
    const orgId = org.id;
    logger.info('GSUSA org found', { orgId });

    // 2. Look up or create the badge catalog
    // Use the existing catalog (catalogYear '2025-26') if present, otherwise create '2025'
    let catalog = await db.getOne(
        `SELECT id FROM badge_catalogs WHERE "organizationId" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
        [orgId]
    );

    if (!catalog) {
        logger.info('No GSUSA catalog found — creating one');
        catalog = await db.getOne(
            `INSERT INTO badge_catalogs ("organizationId", "catalogName", "catalogYear", description, "isActive")
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [orgId, 'GSUSA Badge Explorer 2025', '2025', 'Official Girl Scout badge catalog from the GSUSA Badge Explorer', true]
        );
    }
    const catalogId = catalog.id;
    logger.info('Using badge catalog', { catalogId });

    // 3. Process and insert badges in batches
    let processed = 0;
    let inserted  = 0;
    let updated   = 0;
    let skipped   = 0;
    const skippedBadges = [];

    // Split into batches of BATCH_SIZE
    for (let batchStart = 0; batchStart < badges.length; batchStart += BATCH_SIZE) {
        const batch = badges.slice(batchStart, batchStart + BATCH_SIZE);

        for (const badge of batch) {
            processed++;

            const levels = mapRankToLevels(badge.rank);
            if (!levels) {
                skipped++;
                skippedBadges.push({ title: badge.title, rank: badge.rank });
                logger.warn('Skipping badge with unknown rank', { title: badge.title, rank: badge.rank });
                continue;
            }

            const badgeCode  = buildBadgeCode(badge);
            const badgeName  = (badge.title || '').trim();
            const badgeType  = determineBadgeType(badge);
            const imageUrl   = buildImageUrl(badge.image);
            const description = stripHtml(badge.description);
            const detailsUrl = badge.link || null;
            const sortOrder  = batchStart + batch.indexOf(badge); // global index

            try {
                const result = await db.query(
                    `INSERT INTO badges (
                        "badgeCatalogId", "badgeCode", "badgeName", "badgeType",
                        description, "applicableLevels", "imageUrl", "detailsUrl",
                        "sortOrder", "isActive"
                    ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10)
                    ON CONFLICT ("badgeCatalogId", "badgeCode") DO UPDATE SET
                        "badgeName"        = EXCLUDED."badgeName",
                        "badgeType"        = EXCLUDED."badgeType",
                        description        = EXCLUDED.description,
                        "applicableLevels" = EXCLUDED."applicableLevels",
                        "imageUrl"         = EXCLUDED."imageUrl",
                        "detailsUrl"       = EXCLUDED."detailsUrl",
                        "sortOrder"        = EXCLUDED."sortOrder"
                    `,
                    [
                        catalogId,
                        badgeCode,
                        badgeName,
                        badgeType,
                        description,
                        JSON.stringify(levels),
                        imageUrl,
                        detailsUrl,
                        sortOrder,
                        true
                    ]
                );

                // rowCount=1 means insert, but PostgreSQL ON CONFLICT UPDATE also returns 1
                // Use xmax OID trick is complex; track via a separate check instead
                if (result.rowCount === 1) {
                    // We can't easily distinguish insert vs update without xmax, so just count both
                    inserted++;
                }
            } catch (err) {
                logger.error('Failed to insert badge', {
                    badgeCode,
                    badgeName,
                    error: err.message
                });
                throw err;
            }
        }

        const progress = Math.min(batchStart + BATCH_SIZE, badges.length);
        logger.info(`Batch complete: ${progress}/${badges.length} processed`);
    }

    // 4. Summary statistics from DB
    const dbStats = await db.getAll(
        `SELECT b."applicableLevels", COUNT(*) as count
         FROM badges b
         WHERE b."badgeCatalogId" = $1
         GROUP BY b."applicableLevels"
         ORDER BY b."applicableLevels"`,
        [catalogId]
    );

    const totalInDb = await db.getOne(
        `SELECT COUNT(*) as total FROM badges WHERE "badgeCatalogId" = $1`,
        [catalogId]
    );

    logger.info('Full GSUSA badge seed completed', {
        totalProcessed: processed,
        upserted: inserted,
        skipped,
        totalInCatalog: parseInt(totalInDb.total)
    });

    console.log('\n========================================');
    console.log('  GSUSA Badge Seed - Complete');
    console.log('========================================');
    console.log(`  Total badges in JSON:    ${badges.length}`);
    console.log(`  Processed:               ${processed}`);
    console.log(`  Upserted (insert+update):${inserted}`);
    console.log(`  Skipped (unknown rank):  ${skipped}`);
    console.log(`  Total now in catalog:    ${parseInt(totalInDb.total)}`);
    console.log('\n  Breakdown by level:');
    dbStats.forEach(row => {
        // PostgreSQL returns JSONB columns as already-parsed JS objects/arrays
        const levelsRaw = row.applicablelevels || row.applicableLevels;
        let levelArr;
        if (Array.isArray(levelsRaw)) {
            levelArr = levelsRaw;
        } else if (typeof levelsRaw === 'string') {
            try { levelArr = JSON.parse(levelsRaw); } catch (_) { levelArr = []; }
        } else {
            levelArr = [];
        }
        const level = (levelArr[0] || '?');
        console.log(`    ${level.padEnd(12)} : ${row.count}`);
    });

    if (skippedBadges.length > 0) {
        console.log('\n  Skipped badges:');
        skippedBadges.forEach(b => console.log(`    - "${b.title}" (rank: ${b.rank})`));
    }
    console.log('========================================\n');

    return { processed, inserted, skipped };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

if (require.main === module) {
    seedGsuaBadgesFull()
        .then(() => {
            process.exit(0);
        })
        .catch(err => {
            console.error('Seed failed:', err.message);
            logger.error('Seed script fatal error', { error: err.message, stack: err.stack });
            process.exit(1);
        })
        .finally(() => {
            db.close().catch(() => {});
        });
}

module.exports = { seedGsuaBadgesFull };
