require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const { exec } = require('child_process');
const multer = require('multer');
const ExcelJS = require('exceljs');
const session = require('express-session');
const Redis = require('redis');
const RedisStore = require('connect-redis').default;
const passport = require('passport');
const cookieParser = require('cookie-parser');
const logger = require('./logger');
const auth = require('./auth');
const { configurePassport } = require('./passport-config');
const db = require('./database/query-helpers');
const pool = require('./database/pg-pool');

// ============================================================================
// Privilege System Constants (imported from shared module)
// ============================================================================
const { PRIVILEGE_DEFINITIONS, VALID_PRIVILEGE_CODES, VALID_SCOPES, ROLE_PRIVILEGE_DEFAULTS, buildEffectivePrivileges } = require('./privileges');

// Configure multer for file uploads (memory storage)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            file.originalname.endsWith('.xlsx')) {
            cb(null, true);
        } else {
            cb(new Error('Only .xlsx files are allowed'), false);
        }
    }
});

const app = express();
app.set('trust proxy', 1); // Trust first proxy
const PORT = process.env.PORT || 3000;

// Test PostgreSQL connection on startup
(async () => {
    const connected = await db.testConnection();
    if (!connected) {
        logger.error('PostgreSQL connection failed - exiting');
        process.exit(1);
    }
    logger.info('PostgreSQL connection established successfully');

    // Safe schema migrations - add columns if they don't exist
    try {
        // Add position column to troop_members
        await db.query(`
            ALTER TABLE troop_members ADD COLUMN IF NOT EXISTS position VARCHAR(50)
        `).catch(() => {});

        // Add additionalRoles column (JSON array of role strings)
        await db.query(`
            ALTER TABLE troop_members ADD COLUMN IF NOT EXISTS "additionalRoles" JSONB DEFAULT '[]'
        `).catch(() => {});

        // Relax the role CHECK constraint to include new positions
        await db.query(`
            ALTER TABLE troop_members DROP CONSTRAINT IF EXISTS role_check
        `).catch(() => {});
        await db.query(`
            ALTER TABLE troop_members ADD CONSTRAINT role_check
            CHECK (role IN ('member', 'co-leader', 'assistant', 'parent', 'troop_leader', 'volunteer'))
        `).catch(() => {});

        // Allow users.email to be nullable for members added by name only
        await db.query(`
            ALTER TABLE users ALTER COLUMN email DROP NOT NULL
        `).catch(() => {});

        // Drop the original unique constraint on email, replace with partial unique index
        await db.query(`
            ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key
        `).catch(() => {});
        await db.query(`
            DROP INDEX IF EXISTS idx_users_email
        `).catch(() => {});
        await db.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL
        `).catch(() => {});

        // Add Calendar fields to events table
        await db.query(`
            ALTER TABLE events ADD COLUMN IF NOT EXISTS "eventType" VARCHAR(50) DEFAULT 'event'
        `).catch(() => {});
        await db.query(`
            ALTER TABLE events ADD COLUMN IF NOT EXISTS "startTime" VARCHAR(10)
        `).catch(() => {});
        await db.query(`
            ALTER TABLE events ADD COLUMN IF NOT EXISTS "endTime" VARCHAR(10)
        `).catch(() => {});
        await db.query(`
            ALTER TABLE events ADD COLUMN IF NOT EXISTS "location" TEXT
        `).catch(() => {});
        await db.query(`
            ALTER TABLE events ADD COLUMN IF NOT EXISTS "targetGroup" VARCHAR(50) DEFAULT 'Troop'
        `).catch(() => {});
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_events_troopId_date ON events("troopId", "eventDate")
        `).catch(() => {});

        // Create privilege_overrides table for per-user-per-troop privilege overrides
        await db.query(`
            CREATE TABLE IF NOT EXISTS privilege_overrides (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                "troopId" UUID NOT NULL REFERENCES troops(id) ON DELETE CASCADE,
                "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                "privilegeCode" VARCHAR(50) NOT NULL,
                scope VARCHAR(10) NOT NULL,
                "grantedBy" UUID NOT NULL REFERENCES users(id),
                "grantedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT scope_check CHECK (scope IN ('T', 'D', 'H', 'S', 'none')),
                CONSTRAINT unique_override UNIQUE ("troopId", "userId", "privilegeCode")
            )
        `).catch(() => {});
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_priv_overrides_troop_user
            ON privilege_overrides("troopId", "userId")
        `).catch(() => {});

        // Add den column for den/patrol scope filtering
        await db.query(`
            ALTER TABLE troop_members ADD COLUMN IF NOT EXISTS den VARCHAR(50)
        `).catch(() => {});
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_troop_members_den ON troop_members("troopId", den)
        `).catch(() => {});

        // ---- Cookie Sales Foundation (Phase A) ----

        // Create bakers table
        await db.query(`
            CREATE TABLE IF NOT EXISTS bakers (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                "bakerName" VARCHAR(100) NOT NULL,
                "bakerCode" VARCHAR(20) NOT NULL UNIQUE,
                website VARCHAR(255),
                "isActive" BOOLEAN DEFAULT true,
                "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `).catch(() => {});

        // Add bakerId and organizationId to cookie_products
        await db.query(`
            ALTER TABLE cookie_products ADD COLUMN IF NOT EXISTS "bakerId" UUID REFERENCES bakers(id)
        `).catch(() => {});
        await db.query(`
            ALTER TABLE cookie_products ADD COLUMN IF NOT EXISTS "organizationId" UUID REFERENCES scout_organizations(id)
        `).catch(() => {});
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_cookie_products_baker ON cookie_products("bakerId")
        `).catch(() => {});
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_cookie_products_org ON cookie_products("organizationId")
        `).catch(() => {});

        // Expand saleType to support all sales paths
        await db.query(`
            ALTER TABLE sales ALTER COLUMN "saleType" TYPE VARCHAR(50)
        `).catch(() => {});

        // Create scout_inventory table (from migration 003)
        await db.query(`
            CREATE TABLE IF NOT EXISTS scout_inventory (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                "productId" UUID NOT NULL REFERENCES cookie_products(id) ON DELETE CASCADE,
                quantity INTEGER DEFAULT 0,
                "lastUpdated" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE("userId", "productId")
            )
        `).catch(() => {});
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_scout_inventory_user ON scout_inventory("userId")
        `).catch(() => {});
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_scout_inventory_product ON scout_inventory("productId")
        `).catch(() => {});

        // Add productId to sales table (from migration 003)
        await db.query(`
            ALTER TABLE sales ADD COLUMN IF NOT EXISTS "productId" UUID REFERENCES cookie_products(id) ON DELETE SET NULL
        `).catch(() => {});
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_sales_product ON sales("productId")
        `).catch(() => {});

        // Expand role_check constraint to include cookie_manager (SUCM) role
        await db.query(`
            ALTER TABLE troop_members DROP CONSTRAINT IF EXISTS role_check
        `).catch(() => {});
        await db.query(`
            ALTER TABLE troop_members ADD CONSTRAINT role_check
            CHECK (role IN ('member', 'co-leader', 'assistant', 'parent', 'troop_leader', 'volunteer', 'cookie_leader', 'cookie_manager'))
        `).catch(() => {});

        // Update UNIQUE constraint on cookie_products to include bakerId
        // (both bakers have "Thin Mints" and "Toffee-tastic")
        await db.query(`
            ALTER TABLE cookie_products DROP CONSTRAINT IF EXISTS "cookie_products_season_cookieName_key"
        `).catch(() => {});
        await db.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_cookie_products_season_name_baker
            ON cookie_products(season, "cookieName", COALESCE("bakerId", '00000000-0000-0000-0000-000000000000'::uuid))
        `).catch(() => {});

        // Seed bakers (idempotent)
        const bakerCount = await db.getOne('SELECT COUNT(*) as count FROM bakers');
        if (bakerCount && parseInt(bakerCount.count) === 0) {
            await db.query(`
                INSERT INTO bakers ("bakerName", "bakerCode", website) VALUES
                ('Little Brownie Bakers', 'lbb', 'https://www.littlebrowniebakers.com/'),
                ('ABC Bakers', 'abc', 'https://www.abcbakers.com/')
            `);
            logger.info('Seeded bakers: Little Brownie Bakers, ABC Bakers');
        }

        // Relax attributeType CHECK to include 'ingredient'
        await db.query(`
            ALTER TABLE cookie_attributes DROP CONSTRAINT IF EXISTS attributetype_check
        `).catch(() => {});
        await db.query(`
            ALTER TABLE cookie_attributes ADD CONSTRAINT attributetype_check
            CHECK ("attributeType" IN ('dietary', 'allergen', 'certification', 'ingredient'))
        `).catch(() => {});

        // ---- Phase C: Booth Sales System ----

        // Booth events table
        await db.query(`
            CREATE TABLE IF NOT EXISTS booth_events (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                "troopId" UUID NOT NULL REFERENCES troops(id) ON DELETE CASCADE,
                "eventType" VARCHAR(20) NOT NULL DEFAULT 'troop',
                "scoutId" UUID REFERENCES users(id),
                "eventName" VARCHAR(255) NOT NULL,
                location VARCHAR(255),
                "locationAddress" TEXT,
                "locationNotes" TEXT,
                "startDateTime" TIMESTAMPTZ NOT NULL,
                "endDateTime" TIMESTAMPTZ NOT NULL,
                "startingBank" NUMERIC(10,2) DEFAULT 0,
                status VARCHAR(20) DEFAULT 'planning',
                "weatherNotes" TEXT,
                "actualStartTime" TIMESTAMPTZ,
                "actualEndTime" TIMESTAMPTZ,
                notes TEXT,
                "createdBy" UUID REFERENCES users(id),
                "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT booth_event_type_check CHECK ("eventType" IN ('troop', 'family', 'council')),
                CONSTRAINT booth_status_check CHECK (status IN ('planning', 'scheduled', 'in_progress', 'reconciling', 'completed', 'cancelled'))
            )
        `).catch(() => {});
        await db.query(`CREATE INDEX IF NOT EXISTS idx_booth_events_troop ON booth_events("troopId")`).catch(() => {});
        await db.query(`CREATE INDEX IF NOT EXISTS idx_booth_events_status ON booth_events(status)`).catch(() => {});

        // Booth shifts table
        await db.query(`
            CREATE TABLE IF NOT EXISTS booth_shifts (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                "boothEventId" UUID NOT NULL REFERENCES booth_events(id) ON DELETE CASCADE,
                "scoutId" UUID NOT NULL REFERENCES users(id),
                "parentId" UUID REFERENCES users(id),
                "startTime" TIMESTAMPTZ NOT NULL,
                "endTime" TIMESTAMPTZ NOT NULL,
                role VARCHAR(20) DEFAULT 'seller',
                status VARCHAR(20) DEFAULT 'scheduled',
                "checkinTime" TIMESTAMPTZ,
                "checkoutTime" TIMESTAMPTZ,
                "boxesCredited" INTEGER DEFAULT 0,
                notes TEXT,
                CONSTRAINT shift_role_check CHECK (role IN ('seller', 'cashier', 'setup', 'cleanup')),
                CONSTRAINT shift_status_check CHECK (status IN ('scheduled', 'confirmed', 'completed', 'no_show'))
            )
        `).catch(() => {});
        await db.query(`CREATE INDEX IF NOT EXISTS idx_booth_shifts_event ON booth_shifts("boothEventId")`).catch(() => {});
        await db.query(`CREATE INDEX IF NOT EXISTS idx_booth_shifts_scout ON booth_shifts("scoutId")`).catch(() => {});

        // Booth inventory table
        await db.query(`
            CREATE TABLE IF NOT EXISTS booth_inventory (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                "boothEventId" UUID NOT NULL REFERENCES booth_events(id) ON DELETE CASCADE,
                "productId" UUID NOT NULL REFERENCES cookie_products(id),
                "startingQty" INTEGER DEFAULT 0,
                "endingQty" INTEGER,
                "soldQty" INTEGER,
                "damagedQty" INTEGER DEFAULT 0,
                notes TEXT,
                UNIQUE("boothEventId", "productId")
            )
        `).catch(() => {});
        await db.query(`CREATE INDEX IF NOT EXISTS idx_booth_inventory_event ON booth_inventory("boothEventId")`).catch(() => {});

        // Booth payments table
        await db.query(`
            CREATE TABLE IF NOT EXISTS booth_payments (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                "boothEventId" UUID NOT NULL REFERENCES booth_events(id) ON DELETE CASCADE,
                "paymentType" VARCHAR(30) NOT NULL,
                amount NUMERIC(10,2) NOT NULL,
                "referenceNumber" VARCHAR(100),
                notes TEXT,
                "recordedBy" UUID REFERENCES users(id),
                "recordedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT payment_type_check CHECK ("paymentType" IN ('cash', 'check', 'digital_cookie', 'venmo', 'paypal', 'square', 'zelle', 'other'))
            )
        `).catch(() => {});
        await db.query(`CREATE INDEX IF NOT EXISTS idx_booth_payments_event ON booth_payments("boothEventId")`).catch(() => {});

        // ---- Phase D: Proceeds & Season Management ----

        // Troop season config (proceeds tracking)
        await db.query(`
            CREATE TABLE IF NOT EXISTS troop_season_config (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                "troopId" UUID NOT NULL REFERENCES troops(id) ON DELETE CASCADE,
                season VARCHAR(10) NOT NULL,
                "baseProceedsRate" NUMERIC(5,3) DEFAULT 0.750,
                "initialOrderBonus" BOOLEAN DEFAULT false,
                "fallProductBonus" BOOLEAN DEFAULT false,
                "optOutBonus" BOOLEAN DEFAULT false,
                "effectiveProceedsRate" NUMERIC(5,3) DEFAULT 0.750,
                "initialOrderDate" DATE,
                "initialOrderQty" INTEGER,
                notes TEXT,
                "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                UNIQUE("troopId", season)
            )
        `).catch(() => {});

        // Season milestones table
        await db.query(`
            CREATE TABLE IF NOT EXISTS season_milestones (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                "troopId" UUID NOT NULL REFERENCES troops(id) ON DELETE CASCADE,
                season VARCHAR(10) NOT NULL,
                "milestoneName" VARCHAR(100) NOT NULL,
                "milestoneDate" DATE,
                description TEXT,
                "sortOrder" INTEGER DEFAULT 0,
                "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        `).catch(() => {});
        await db.query(`CREATE INDEX IF NOT EXISTS idx_season_milestones_troop ON season_milestones("troopId", season)`).catch(() => {});

        // Create admins table for system administrator management (Phase 1)
        await db.query(`
            CREATE TABLE IF NOT EXISTS admins (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "userId" UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                role VARCHAR(50) DEFAULT 'admin' NOT NULL CHECK (role IN ('admin', 'super_admin')),
                "grantedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                "grantedBy" UUID REFERENCES users(id) ON DELETE SET NULL,
                "revokedAt" TIMESTAMP WITH TIME ZONE,
                "revokedBy" UUID REFERENCES users(id) ON DELETE SET NULL
            )
        `).catch(() => {});
        await db.query(`
            CREATE INDEX IF NOT EXISTS "idx_admins_user_id" ON admins("userId")
        `).catch(() => {});
        await db.query(`
            CREATE INDEX IF NOT EXISTS "idx_admins_active" ON admins("userId") WHERE ("revokedAt" IS NULL)
        `).catch(() => {});

        // Update users.role CHECK constraint to include 'admin' and 'member' roles for admin system
        await db.query(`
            ALTER TABLE users DROP CONSTRAINT IF EXISTS role_check
        `).catch(() => {});
        await db.query(`
            ALTER TABLE users ADD CONSTRAINT role_check
            CHECK (role IN ('scout', 'member', 'parent', 'volunteer', 'assistant',
                           'co-leader', 'cookie_leader', 'troop_leader',
                           'cookie_manager', 'admin'))
        `).catch(() => {});

        logger.info('Schema migration checks completed');
    } catch (err) {
        logger.warn('Schema migration checks had issues (non-fatal)', { error: err.message });
    }
})();

// Note: PostgreSQL schema is managed via migration files in /migrations/
// Run migrations using: psql -U asm_user -d apex_scout_manager -f migrations/001_enable_uuid_extension.sql
//                       psql -U asm_user -d apex_scout_manager -f migrations/002_create_schema.sql

// Rate limiting middleware
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});

// Request logging middleware
app.use((req, res, next) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        // Use explicit conditionals for log level to prevent injection
        const logLevel = res.statusCode >= 500 ? 'error' : (res.statusCode >= 400 ? 'warn' : 'info');
        logger[logLevel]('HTTP Request', {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip
        });
    });
    
    next();
});

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Create Redis client
const redisClient = Redis.createClient({
    socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379
    },
    password: process.env.REDIS_PASSWORD || undefined,
    database: parseInt(process.env.REDIS_DB) || 0
});

redisClient.on('error', (err) => logger.error('Redis client error', { error: err.message }));
redisClient.on('connect', () => logger.info('Redis client connected'));

// Connect to Redis
redisClient.connect().catch(err => {
    logger.error('Redis connection failed', { error: err.message });
    process.exit(1);
});

// Session configuration with Redis
app.use(session({
    store: new RedisStore({ client: redisClient }),
    secret: process.env.SESSION_SECRET || 'asm-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Require HTTPS in production
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: 'lax'
    }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());
const passportStrategies = configurePassport(db);

// Note: Redis handles session TTL automatically, no manual cleanup needed

app.use('/api/', limiter); // Apply rate limiting to all API routes

// Serve login and register pages without authentication
app.get('/login.html', (req, res, next) => {
    // If already authenticated, redirect to main page
    if (req.session && req.session.userId) {
        return res.redirect('/');
    }
    next();
});

app.get('/register.html', (req, res, next) => {
    // If already authenticated, redirect to main page
    if (req.session && req.session.userId) {
        return res.redirect('/');
    }
    next();
});

// Maintenance Mode Middleware
app.use(async (req, res, next) => {
    // Skip for static assets, login, and admin API
    if (req.path.match(/\.(css|js|png|jpg|ico)$/) || 
        req.path === '/login.html' || 
        req.path === '/api/login' ||
        req.path.startsWith('/api/system/') ||
        (req.session && req.session.userId && await auth.isAdmin(db, req.session.userId))) {
        return next();
    }

    try {
        const maintenanceSetting = await db.getOne('SELECT value FROM system_settings WHERE key = $1', ['site_maintenance_mode']);
        if (maintenanceSetting && (maintenanceSetting.value === 'true' || maintenanceSetting.value === true)) {
            // If API request, return JSON
            if (req.path.startsWith('/api/')) {
                return res.status(503).json({ error: 'System is currently in maintenance mode' });
            }
            // Otherwise show maintenance page (or simple text for now)
            return res.status(503).send('<h1>System Under Maintenance</h1><p>We are currently performing system maintenance. Please try again later.</p>');
        }
        next();
    } catch (error) {
        // Fallback on error
        next();
    }
});

// Bootstrap check middleware - redirect to setup wizard if needed
app.use(async (req, res, next) => {
    // Only check for authenticated users trying to access protected pages
    if (!req.session || !req.session.userId) {
        return next();
    }

    // Skip check for specific routes
    if (req.path === '/logout' ||
        req.path === '/login.html' ||
        req.path === '/register.html' ||
        req.path === '/setup-wizard' ||
        req.path === '/setup-wizard.html' ||
        req.path.startsWith('/api/')) {
        return next();
    }

    try {
        // Check if any admins exist
        const adminCount = await db.getOne(
            'SELECT COUNT(*)::int as count FROM admins WHERE "revokedAt" IS NULL'
        );

        // If no admins, redirect to setup wizard (except already on setup page)
        if (Number(adminCount.count) === 0 && !req.path.startsWith('/setup')) {
            return res.redirect('/setup-wizard');
        }

        next();
    } catch (error) {
        logger.error('Bootstrap check error:', error);
        next(); // Continue on error, don't block
    }
});

// Protect the main page - redirect to login if not authenticated
app.get('/', (req, res, next) => {
    if (!req.session || !req.session.userId) {
        return res.redirect('/login.html');
    }
    next();
});

app.get('/index.html', (req, res, next) => {
    if (!req.session || !req.session.userId) {
        return res.redirect('/login.html');
    }
    next();
});

// Setup wizard route - first-time admin account creation (no admin auth required if bootstrap needed)
app.get('/setup-wizard.html', async (req, res, next) => {
    try {
        // Check if bootstrap is needed
        const adminCount = await db.getOne(
            'SELECT COUNT(*)::int as count FROM admins WHERE "revokedAt" IS NULL'
        );

        if (Number(adminCount.count) > 0) {
            // Bootstrap already complete, redirect to login
            return res.redirect('/login.html');
        }

        // Check if user is authenticated
        if (!req.session || !req.session.userId) {
            return res.redirect('/login.html');
        }

        // Bootstrap needed and user is authenticated, serve setup wizard
        next();
    } catch (error) {
        logger.error('Setup wizard route error:', error);
        res.status(500).send('Error checking bootstrap status');
    }
});

app.get('/setup-wizard', async (req, res) => {
    try {
        // Check if bootstrap is needed
        const adminCount = await db.getOne(
            'SELECT COUNT(*)::int as count FROM admins WHERE "revokedAt" IS NULL'
        );

        if (Number(adminCount.count) > 0) {
            // Bootstrap already complete
            return res.redirect('/admin');
        }

        // Check if user is authenticated
        if (!req.session || !req.session.userId) {
            return res.redirect('/login.html');
        }

        // Redirect to setup-wizard.html
        res.redirect('/setup-wizard.html');
    } catch (error) {
        logger.error('Setup wizard redirect error:', error);
        res.status(500).send('Error checking bootstrap status');
    }
});

// Admin panel route - requires admin access
app.get('/admin.html', auth.isAuthenticated, auth.requireAdmin, (req, res, next) => {
    // Access already verified by middleware, continue to serve static file
    next();
});

app.get('/admin', auth.isAuthenticated, auth.requireAdmin, (req, res) => {
    // Redirect to admin.html
    res.redirect('/admin.html');
});

app.use(express.static('public'));

// ============================================================================
// Authentication Routes
// ============================================================================

// Register new user
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, firstName, lastName, dateOfBirth, parentEmail } = req.body;

        // Validate required fields
        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Validate email format
        if (!auth.isValidEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // Validate password strength
        const passwordValidation = auth.validatePassword(password);
        if (!passwordValidation.valid) {
            return res.status(400).json({ error: passwordValidation.message });
        }

        // Check if user already exists
        const existingUser = await db.getOne('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        // Check if minor (COPPA compliance)
        let isMinorUser = false;
        if (dateOfBirth) {
            isMinorUser = auth.isMinor(dateOfBirth);

            // If minor and no parent email, require it
            if (isMinorUser && !parentEmail) {
                return res.status(400).json({
                    error: 'Parent email required for users under 13'
                });
            }
        }

        // Hash password
        const passwordHash = await auth.hashPassword(password);

        // Create user (PostgreSQL returns inserted row)
        const newUser = await db.getOne(`
            INSERT INTO users (
                email, password_hash, "firstName", "lastName",
                "dateOfBirth", "isMinor", "parentEmail", role,
                "isActive", "emailVerified"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id
        `, [
            email,
            passwordHash,
            firstName,
            lastName,
            dateOfBirth || null,
            isMinorUser,
            parentEmail || null,
            'scout', // Default role
            !isMinorUser, // Require activation for minors
            false // Email not verified
        ]);

        const userId = newUser.id;

        // Create default profile
        await db.run(`
            INSERT INTO profile ("userId", "scoutName", email)
            VALUES ($1, $2, $3)
        `, [userId, `${firstName} ${lastName}`.trim(), email]);

        // Log audit event
        await auth.logAuditEvent(db, userId, 'user_registered', req, { email });

        // Send notification if minor (parent consent required)
        if (isMinorUser) {
            await auth.createNotification(
                db,
                userId,
                'info',
                'Account Pending',
                'Your account requires parental consent before activation. A consent email has been sent to your parent/guardian.'
            );
        }

        logger.info('New user registered', { userId, email, isMinor: isMinorUser });

        res.status(201).json({
            message: isMinorUser
                ? 'Registration successful. Parental consent required.'
                : 'Registration successful. Please log in.',
            userId,
            requiresConsent: isMinorUser
        });

    } catch (error) {
        logger.error('Registration error', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login with email/password
app.post('/api/auth/login', (req, res, next) => {
    passport.authenticate('local', async (err, user, info) => {
        if (err) {
            logger.error('Login error', { error: err.message });
            return res.status(500).json({ error: 'Login failed' });
        }

        if (!user) {
            return res.status(401).json({ error: info.message || 'Invalid credentials' });
        }

        req.logIn(user, async (err) => {
            if (err) {
                logger.error('Session creation error', { error: err.message });
                return res.status(500).json({ error: 'Failed to create session' });
            }

            // Store user info in session
            req.session.userId = user.id;
            req.session.userEmail = user.email;
            req.session.userRole = user.role;

            // Update last login timestamp
            await auth.logAuditEvent(db, user.id, 'user_login', req, { method: 'local' });

            logger.info('User logged in', { userId: user.id, email: user.email });

            res.json({
                message: 'Login successful',
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role,
                    photoUrl: user.photoUrl
                }
            });
        });
    })(req, res, next);
});

// Google OAuth initiation
if (passportStrategies.google) {
    app.get('/auth/google',
        passport.authenticate('google', {
            scope: ['profile', 'email']
        })
    );

    // Google OAuth callback
    app.get('/auth/google/callback',
        passport.authenticate('google', { failureRedirect: '/login.html' }),
        (req, res) => {
            // Store user info in session
            req.session.userId = req.user.id;
            req.session.userEmail = req.user.email;
            req.session.userRole = req.user.role;

            res.redirect('/');
        }
    );
}

// Logout
app.post('/api/auth/logout', auth.isAuthenticated, (req, res) => {
    const userId = req.session.userId;

    // Log audit event
    auth.logAuditEvent(db, userId, 'user_logout', req);

    req.logout((err) => {
        if (err) {
            logger.error('Logout error', { error: err.message });
            return res.status(500).json({ error: 'Logout failed' });
        }

        req.session.destroy((err) => {
            if (err) {
                logger.error('Session destruction error', { error: err.message });
            }

            res.clearCookie('connect.sid');
            res.json({ message: 'Logout successful' });
        });
    });
});

// Get current user
app.get('/api/auth/me', auth.isAuthenticated, async (req, res) => {
    try {
        const user = await db.getOne(`
            SELECT id, email, "firstName", "lastName", role, "photoUrl",
                   "isActive", "emailVerified", "dateOfBirth", "isMinor", "createdAt", "lastLogin"
            FROM users
            WHERE id = $1
        `, [req.session.userId]);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get troop info
        const membership = await db.getOne(`
            SELECT "troopId" FROM troop_members
            WHERE "userId" = $1 AND status = 'active'
            LIMIT 1
        `, [req.session.userId]);

        if (membership) {
            user.troopId = membership.troopId;
        }

        res.json(user);
    } catch (error) {
        logger.error('Error fetching current user', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

// Get notifications for current user
app.get('/api/notifications', auth.isAuthenticated, async (req, res) => {
    try {
        const notifications = await db.getAll(`
            SELECT * FROM notifications
            WHERE "userId" = $1
            ORDER BY "createdAt" DESC
            LIMIT 50
        `, [req.session.userId]);

        res.json(notifications);
    } catch (error) {
        logger.error('Error fetching notifications', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// Mark notification as read
app.put('/api/notifications/:id/read', auth.isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.run(`
            UPDATE notifications
            SET "isRead" = true, "readAt" = NOW()
            WHERE id = $1 AND "userId" = $2
        `, [id, req.session.userId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        res.json({ success: true });
    } catch (error) {
        logger.error('Error marking notification as read', { error: error.message });
        res.status(500).json({ error: 'Failed to update notification' });
    }
});

// ============================================================================
// API Routes (Protected - require authentication)
// ============================================================================

// Get all sales (filtered by userId)
app.get('/api/sales', auth.isAuthenticated, auth.requirePrivilegeAnyTroop('view_sales'), async (req, res) => {
    try {
        const { saleType } = req.query;
        let query = `
            SELECT s.*, cp."cookieName" as "productName", cp."shortName" as "productShortName",
                   cp."pricePerBox" as "productPrice"
            FROM sales s
            LEFT JOIN cookie_products cp ON s."productId" = cp.id
            WHERE s."userId" = $1
        `;
        const params = [req.session.userId];
        if (saleType) {
            query += ' AND s."saleType" = $2';
            params.push(saleType);
        }
        query += ' ORDER BY s.id DESC';
        const sales = await db.getAll(query, params);
        res.json(sales);
    } catch (error) {
        logger.error('Error fetching sales', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to fetch sales' });
    }
});

// Add a new sale
app.post('/api/sales', auth.isAuthenticated, auth.requirePrivilegeAnyTroop('record_sales'), async (req, res) => {
    try {
        const {
            cookieType,
            productId,
            quantity,
            customerName,
            date,
            saleType,
            customerAddress,
            customerPhone,
            unitType,
            amountCollected,
            amountDue,
            paymentMethod
        } = req.body;

        // Require either cookieType or productId
        if ((!cookieType && !productId) || !quantity || quantity < 1) {
            logger.warn('Invalid sale data received', { cookieType, productId, quantity });
            return res.status(400).json({ error: 'Invalid sale data. Provide cookieType or productId and quantity >= 1.' });
        }

        // If productId provided, resolve cookieType from it
        let resolvedCookieType = cookieType;
        let resolvedProductId = productId || null;
        if (productId && !cookieType) {
            const product = await db.getOne('SELECT "cookieName" FROM cookie_products WHERE id = $1', [productId]);
            if (!product) return res.status(400).json({ error: 'Invalid productId' });
            resolvedCookieType = product.cookieName;
        }

        // Validate and sanitize customerName
        const sanitizedCustomerName = (customerName && customerName.trim()) || 'Walk-in Customer';

        // Validate saleType
        const VALID_SALE_TYPES = [
            'individual', 'event',  // legacy values
            'individual_inperson', 'individual_digital_delivered',
            'individual_digital_shipped', 'individual_donation',
            'booth_troop', 'booth_family', 'booth_council'
        ];
        const validSaleType = VALID_SALE_TYPES.includes(saleType) ? saleType : 'individual';

        // Validate and use current date if not provided or invalid
        let saleDate = date;
        if (!saleDate || isNaN(new Date(saleDate).getTime())) {
            saleDate = new Date().toISOString();
        }

        // Validate and sanitize new fields
        const sanitizedCustomerAddress = (customerAddress && customerAddress.trim()) || null;
        const sanitizedCustomerPhone = (customerPhone && customerPhone.trim()) || null;
        const validUnitType = (unitType === 'case') ? 'case' : 'box';
        const validAmountCollected = (typeof amountCollected === 'number' && amountCollected >= 0) ? amountCollected : 0;
        const validAmountDue = (typeof amountDue === 'number' && amountDue >= 0) ? amountDue : 0;
        const validPaymentMethod = paymentMethod || null;

        // New order grouping fields
        const sanitizedOrderNumber = (req.body.orderNumber && String(req.body.orderNumber)) || null;
        const sanitizedOrderType = (req.body.orderType && String(req.body.orderType)) || null;
        const sanitizedOrderStatus = (req.body.orderStatus && String(req.body.orderStatus)) || 'Pending';

        const newSale = await db.getOne(`
            INSERT INTO sales (
                "cookieType", "productId", quantity, "customerName", date, "saleType",
                "customerAddress", "customerPhone", "unitType",
                "amountCollected", "amountDue", "paymentMethod",
                "orderNumber", "orderType", "orderStatus", "userId"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            RETURNING *
        `, [
            resolvedCookieType, resolvedProductId, quantity, sanitizedCustomerName, saleDate, validSaleType,
            sanitizedCustomerAddress, sanitizedCustomerPhone, validUnitType,
            validAmountCollected, validAmountDue, validPaymentMethod,
            sanitizedOrderNumber, sanitizedOrderType, sanitizedOrderStatus,
            req.session.userId
        ]);

        logger.info('Sale added successfully', { saleId: newSale.id, cookieType, quantity, saleType: validSaleType, userId: req.session.userId });
        res.status(201).json(newSale);
    } catch (error) {
        // Log error without sensitive request body data
        logger.error('Error adding sale', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to add sale' });
    }
});

// Update a sale (only owner can update)
app.put('/api/sales/:id', auth.isAuthenticated, auth.requirePrivilegeAnyTroop('record_sales'), async (req, res) => {
    try {
        const { id } = req.params;
        const { orderStatus, amountCollected, amountDue } = req.body;

        // Check ownership
        const existingSale = await db.getOne('SELECT "userId" FROM sales WHERE id = $1', [id]);
        if (!existingSale) {
            return res.status(404).json({ error: 'Sale not found' });
        }
        if (existingSale.userId !== req.session.userId && req.session.userRole !== 'admin') {
            return res.status(403).json({ error: 'Not authorized to edit this sale' });
        }

        // Dynamic update query construction
        const updates = [];
        const values = [];
        let paramCount = 1;

        if (orderStatus !== undefined) {
            updates.push(`"orderStatus" = $${paramCount++}`);
            values.push(orderStatus);
        }

        if (amountCollected !== undefined) {
            updates.push(`"amountCollected" = $${paramCount++}`);
            values.push(amountCollected);
        }

        if (amountDue !== undefined) {
            updates.push(`"amountDue" = $${paramCount++}`);
            values.push(amountDue);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        values.push(id);

        await db.run(`UPDATE sales SET ${updates.join(', ')} WHERE id = $${paramCount}`, values);

        const updatedSale = await db.getOne('SELECT * FROM sales WHERE id = $1', [id]);
        logger.info('Sale updated successfully', { saleId: id, updates, userId: req.session.userId });
        res.json(updatedSale);
    } catch (error) {
        logger.error('Error updating sale', { error: error.message, stack: error.stack, saleId: req.params.id });
        res.status(500).json({ error: 'Failed to update sale' });
    }
});

// Delete a sale (only owner can delete)
app.delete('/api/sales/:id', auth.isAuthenticated, auth.requirePrivilegeAnyTroop('record_sales'), async (req, res) => {
    try {
        const { id } = req.params;

        // Check ownership
        const existingSale = await db.getOne('SELECT "userId" FROM sales WHERE id = $1', [id]);
        if (!existingSale) {
            logger.warn('Attempted to delete non-existent sale', { saleId: id });
            return res.status(404).json({ error: 'Sale not found' });
        }
        if (existingSale.userId !== req.session.userId && req.session.userRole !== 'admin') {
            return res.status(403).json({ error: 'Not authorized to edit this sale' });
        }

        await db.run('DELETE FROM sales WHERE id = $1', [id]);

        logger.info('Sale deleted successfully', { saleId: id, userId: req.session.userId });
        res.json({ message: 'Sale deleted successfully' });
    } catch (error) {
        logger.error('Error deleting sale', { error: error.message, stack: error.stack, saleId: req.params.id });
        res.status(500).json({ error: 'Failed to delete sale' });
    }
});

// Get profile (for current user)
app.get('/api/profile', auth.isAuthenticated, async (req, res) => {
    try {
        let profile = await db.getOne('SELECT * FROM profile WHERE "userId" = $1', [req.session.userId]);

        // If no profile exists for this user, create one
        if (!profile) {
            const user = await db.getOne('SELECT "firstName", "lastName", email FROM users WHERE id = $1', [req.session.userId]);
            const scoutName = user ? `${user.firstName} ${user.lastName}`.trim() : '';
            const email = user ? user.email : '';

            profile = await db.getOne(`
                INSERT INTO profile ("userId", "scoutName", email, "goalBoxes", "goalAmount")
                VALUES ($1, $2, $3, 0, 0)
                RETURNING *
            `, [req.session.userId, scoutName, email]);
        }

        // Also fetch normalized inventory from scout_inventory
        const normalizedInventory = await db.getAll(`
            SELECT si."productId", si.quantity, cp."cookieName", cp."shortName",
                   cp."pricePerBox", cp."sortOrder"
            FROM scout_inventory si
            JOIN cookie_products cp ON si."productId" = cp.id
            WHERE si."userId" = $1 AND cp."isActive" = true
            ORDER BY cp."sortOrder"
        `, [req.session.userId]);

        const result = profile || {
            userId: req.session.userId,
            photoData: null,
            qrCodeUrl: null,
            goalBoxes: 0,
            goalAmount: 0,
            inventoryThinMints: 0,
            inventorySamoas: 0,
            inventoryTagalongs: 0,
            inventoryTrefoils: 0,
            inventoryDosiDos: 0,
            inventoryLemonUps: 0,
            inventoryAdventurefuls: 0,
            inventoryExploremores: 0,
            inventoryToffeetastic: 0
        };
        result.inventory = normalizedInventory;
        res.json(result);
    } catch (error) {
        logger.error('Error fetching profile', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// Update profile (for current user)
app.put('/api/profile', auth.isAuthenticated, async (req, res) => {
    try {
        const {
            photoData, qrCodeUrl, paymentQrCodeUrl, goalBoxes, goalAmount,
            inventoryThinMints, inventorySamoas, inventoryTagalongs,
            inventoryTrefoils, inventoryDosiDos, inventoryLemonUps,
            inventoryAdventurefuls, inventoryExploremores, inventoryToffeetastic
        } = req.body;

        // Helper function to validate numeric values
        const validateNumber = (value) => (typeof value === 'number' && value >= 0) ? value : 0;

        // Validate goalBoxes and goalAmount
        const validGoalBoxes = validateNumber(goalBoxes);
        const validGoalAmount = validateNumber(goalAmount);

        // Validate inventory values
        const inventoryFields = [
            inventoryThinMints, inventorySamoas, inventoryTagalongs,
            inventoryTrefoils, inventoryDosiDos, inventoryLemonUps,
            inventoryAdventurefuls, inventoryExploremores, inventoryToffeetastic
        ];
        const validatedInventory = inventoryFields.map(validateNumber);

        // Check if profile exists for this user
        const existingProfile = await db.getOne('SELECT id FROM profile WHERE "userId" = $1', [req.session.userId]);

        if (existingProfile) {
            // Update existing profile
            await db.run(`
                UPDATE profile
                SET "photoData" = COALESCE($1, "photoData"),
                    "qrCodeUrl" = COALESCE($2, "qrCodeUrl"),
                    "paymentQrCodeUrl" = COALESCE($3, "paymentQrCodeUrl"),
                    "goalBoxes" = $4,
                    "goalAmount" = $5,
                    "inventoryThinMints" = $6,
                    "inventorySamoas" = $7,
                    "inventoryTagalongs" = $8,
                    "inventoryTrefoils" = $9,
                    "inventoryDosiDos" = $10,
                    "inventoryLemonUps" = $11,
                    "inventoryAdventurefuls" = $12,
                    "inventoryExploremores" = $13,
                    "inventoryToffeetastic" = $14
                WHERE "userId" = $15
            `, [
                photoData, qrCodeUrl, paymentQrCodeUrl, validGoalBoxes, validGoalAmount,
                ...validatedInventory,
                req.session.userId
            ]);
        } else {
            // Create new profile
            const user = await db.getOne('SELECT "firstName", "lastName", email FROM users WHERE id = $1', [req.session.userId]);
            const scoutName = user ? `${user.firstName} ${user.lastName}`.trim() : '';
            const email = user ? user.email : '';

            await db.run(`
                INSERT INTO profile (
                    "userId", "scoutName", email, "photoData", "qrCodeUrl", "paymentQrCodeUrl",
                    "goalBoxes", "goalAmount",
                    "inventoryThinMints", "inventorySamoas", "inventoryTagalongs",
                    "inventoryTrefoils", "inventoryDosiDos", "inventoryLemonUps",
                    "inventoryAdventurefuls", "inventoryExploremores", "inventoryToffeetastic"
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            `, [
                req.session.userId, scoutName, email,
                photoData, qrCodeUrl, paymentQrCodeUrl, validGoalBoxes, validGoalAmount,
                ...validatedInventory
            ]);
        }

        const updatedProfile = await db.getOne('SELECT * FROM profile WHERE "userId" = $1', [req.session.userId]);
        logger.info('Profile updated successfully', {
            userId: req.session.userId,
            updates: {
                hasPhoto: !!photoData,
                hasStoreQr: !!qrCodeUrl,
                hasPaymentQr: !!paymentQrCodeUrl,
                goalBoxes: validGoalBoxes
            }
        });
        res.json(updatedProfile);
    } catch (error) {
        logger.error('Error updating profile', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// ============================================================================
// Normalized Inventory Endpoints (scout_inventory table)
// ============================================================================

// Get current user's inventory (product-based)
app.get('/api/inventory', auth.isAuthenticated, async (req, res) => {
    try {
        const inventory = await db.getAll(`
            SELECT si.id, si."productId", si.quantity, si."lastUpdated",
                   cp."cookieName", cp."shortName", cp."pricePerBox", cp."boxesPerCase",
                   cp."imageUrl", cp."sortOrder",
                   b."bakerName", b."bakerCode"
            FROM scout_inventory si
            JOIN cookie_products cp ON si."productId" = cp.id
            LEFT JOIN bakers b ON cp."bakerId" = b.id
            WHERE si."userId" = $1 AND cp."isActive" = true
            ORDER BY cp."sortOrder", cp."cookieName"
        `, [req.session.userId]);
        res.json(inventory);
    } catch (error) {
        logger.error('Error fetching inventory', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch inventory' });
    }
});

// Update inventory for a specific product (upsert)
app.put('/api/inventory/:productId', auth.isAuthenticated, async (req, res) => {
    try {
        const { productId } = req.params;
        const { quantity } = req.body;

        if (typeof quantity !== 'number' || quantity < 0) {
            return res.status(400).json({ error: 'Quantity must be a non-negative number' });
        }

        // Verify product exists
        const product = await db.getOne('SELECT id FROM cookie_products WHERE id = $1', [productId]);
        if (!product) return res.status(404).json({ error: 'Product not found' });

        // Upsert inventory
        const result = await db.getOne(`
            INSERT INTO scout_inventory ("userId", "productId", quantity, "lastUpdated")
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT ("userId", "productId")
            DO UPDATE SET quantity = $3, "lastUpdated" = NOW()
            RETURNING *
        `, [req.session.userId, productId, quantity]);

        res.json(result);
    } catch (error) {
        logger.error('Error updating inventory', { error: error.message });
        res.status(500).json({ error: 'Failed to update inventory' });
    }
});

// Bulk update inventory (replace all)
app.put('/api/inventory', auth.isAuthenticated, async (req, res) => {
    try {
        const { items } = req.body;
        if (!Array.isArray(items)) {
            return res.status(400).json({ error: 'Items must be an array of { productId, quantity }' });
        }

        for (const item of items) {
            if (!item.productId || typeof item.quantity !== 'number' || item.quantity < 0) continue;
            await db.query(`
                INSERT INTO scout_inventory ("userId", "productId", quantity, "lastUpdated")
                VALUES ($1, $2, $3, NOW())
                ON CONFLICT ("userId", "productId")
                DO UPDATE SET quantity = $3, "lastUpdated" = NOW()
            `, [req.session.userId, item.productId, item.quantity]);
        }

        // Return updated inventory
        const inventory = await db.getAll(`
            SELECT si.*, cp."cookieName", cp."shortName", cp."pricePerBox"
            FROM scout_inventory si
            JOIN cookie_products cp ON si."productId" = cp.id
            WHERE si."userId" = $1 AND cp."isActive" = true
            ORDER BY cp."sortOrder"
        `, [req.session.userId]);

        res.json(inventory);
    } catch (error) {
        logger.error('Error bulk updating inventory', { error: error.message });
        res.status(500).json({ error: 'Failed to update inventory' });
    }
});

// Get all donations (filtered by userId)
app.get('/api/donations', auth.isAuthenticated, auth.requirePrivilegeAnyTroop('view_donations'), async (req, res) => {
    try {
        const donations = await db.getAll('SELECT * FROM donations WHERE "userId" = $1 ORDER BY id DESC', [req.session.userId]);
        res.json(donations);
    } catch (error) {
        logger.error('Error fetching donations', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to fetch donations' });
    }
});

// Add a new donation
app.post('/api/donations', auth.isAuthenticated, auth.requirePrivilegeAnyTroop('record_donations'), async (req, res) => {
    try {
        const { amount, donorName, date } = req.body;

        if (!amount || amount <= 0) {
            logger.warn('Invalid donation data received', { amount });
            return res.status(400).json({ error: 'Invalid donation data' });
        }

        // Validate and sanitize donorName
        const sanitizedDonorName = (donorName && donorName.trim()) || 'Anonymous';

        // Validate and use current date if not provided or invalid
        let donationDate = date;
        if (!donationDate || isNaN(new Date(donationDate).getTime())) {
            donationDate = new Date().toISOString();
        }

        const newDonation = await db.getOne('INSERT INTO donations (amount, "donorName", date, "userId") VALUES ($1, $2, $3, $4) RETURNING *',
            [amount, sanitizedDonorName, donationDate, req.session.userId]);

        logger.info('Donation added successfully', { donationId: newDonation.id, amount, userId: req.session.userId });
        res.status(201).json(newDonation);
    } catch (error) {
        logger.error('Error adding donation', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to add donation' });
    }
});

// Delete a donation (only owner can delete)
app.delete('/api/donations/:id', auth.isAuthenticated, auth.requirePrivilegeAnyTroop('delete_donations'), async (req, res) => {
    try {
        const { id } = req.params;

        // Check ownership
        const existingDonation = await db.getOne('SELECT "userId" FROM donations WHERE id = $1', [id]);
        if (!existingDonation) {
            logger.warn('Attempted to delete non-existent donation', { donationId: id });
            return res.status(404).json({ error: 'Donation not found' });
        }
        // Check if user is deleting their own donation or is admin
        if (existingDonation.userId !== req.session.userId && req.session.userRole !== 'admin') {
            return res.status(403).json({ error: 'Not authorized to delete this donation' });
        }

        await db.run('DELETE FROM donations WHERE id = $1', [id]);

        logger.info('Donation deleted successfully', { donationId: id, userId: req.session.userId });
        res.json({ message: 'Donation deleted successfully' });
    } catch (error) {
        logger.error('Error deleting donation', { error: error.message, stack: error.stack, donationId: req.params.id });
        res.status(500).json({ error: 'Failed to delete donation' });
    }
});

// Get all events (filtered by userId)
app.get('/api/events', auth.isAuthenticated, async (req, res) => {
    try {
        const events = await db.getAll('SELECT * FROM events WHERE "userId" = $1 ORDER BY "eventDate" DESC', [req.session.userId]);
        res.json(events);
    } catch (error) {
        logger.error('Error fetching events', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

// Add a new event
app.post('/api/events', auth.isAuthenticated, async (req, res) => {
    try {
        const {
            eventName,
            eventDate,
            description,
            initialBoxes,
            initialCases,
            remainingBoxes,
            remainingCases,
            donationsReceived,
            troopId,
            eventType,
            startTime,
            endTime,
            location,
            targetGroup
        } = req.body;

        if (!eventName || !eventDate) {
            logger.warn('Invalid event data received', { eventName, eventDate });
            return res.status(400).json({ error: 'Event name and date are required' });
        }

        // Validate and sanitize eventName
        const sanitizedEventName = eventName.trim();
        if (!sanitizedEventName) {
            logger.warn('Empty event name received');
            return res.status(400).json({ error: 'Event name cannot be empty' });
        }

        // Validate and use current date if not provided or invalid
        let validEventDate = eventDate;
        if (!validEventDate || isNaN(new Date(validEventDate).getTime())) {
            validEventDate = new Date().toISOString();
        }

        // Validate numeric fields
        const validInitialBoxes = (typeof initialBoxes === 'number' && initialBoxes >= 0) ? initialBoxes : 0;
        const validInitialCases = (typeof initialCases === 'number' && initialCases >= 0) ? initialCases : 0;
        const validRemainingBoxes = (typeof remainingBoxes === 'number' && remainingBoxes >= 0) ? remainingBoxes : 0;
        const validRemainingCases = (typeof remainingCases === 'number' && remainingCases >= 0) ? remainingCases : 0;
        const validDonationsReceived = (typeof donationsReceived === 'number' && donationsReceived >= 0) ? donationsReceived : 0;
        const sanitizedDescription = (description && description.trim()) || null;

        // Verify troop membership if troopId is provided
        if (troopId) {
            const membership = await db.getOne(
                'SELECT * FROM troop_members WHERE "troopId" = $1 AND "userId" = $2 AND status = \'active\'',
                [troopId, req.session.userId]
            );
            if (!membership && req.session.userRole !== 'admin') {
                return res.status(403).json({ error: 'You are not an active member of this troop' });
            }
        }

        const newEvent = await db.getOne(`
            INSERT INTO events (
                "eventName", "eventDate", description,
                "initialBoxes", "initialCases", "remainingBoxes", "remainingCases",
                "donationsReceived", "userId", "troopId",
                "eventType", "startTime", "endTime", "location", "targetGroup"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING *
        `, [
            sanitizedEventName, validEventDate, sanitizedDescription,
            validInitialBoxes, validInitialCases, validRemainingBoxes, validRemainingCases,
            validDonationsReceived, req.session.userId, troopId || null,
            eventType || 'event', startTime || null, endTime || null, location || null, targetGroup || 'Troop'
        ]);

        logger.info('Event added successfully', { eventId: newEvent.id, eventName: sanitizedEventName, userId: req.session.userId, troopId });
        res.status(201).json(newEvent);
    } catch (error) {
        logger.error('Error adding event', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to add event' });
    }
});

// Update an event (only owner can update)
app.put('/api/events/:id', auth.isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            eventName,
            eventDate,
            description,
            initialBoxes,
            initialCases,
            remainingBoxes,
            remainingCases,
            donationsReceived,
            eventType,
            startTime,
            endTime,
            location,
            targetGroup
        } = req.body;

        // Check ownership
        const existingEvent = await db.getOne('SELECT "userId" FROM events WHERE id = $1', [id]);
        if (!existingEvent) {
            logger.warn('Attempted to update non-existent event', { eventId: id });
            return res.status(404).json({ error: 'Event not found' });
        }
        if (existingEvent.userId !== req.session.userId && req.session.userRole !== 'admin') {
            return res.status(403).json({ error: 'Not authorized to edit this event' });
        }

        if (!eventName || !eventDate) {
            logger.warn('Invalid event data received', { eventName, eventDate });
            return res.status(400).json({ error: 'Event name and date are required' });
        }

        // Validate and sanitize eventName
        const sanitizedEventName = eventName.trim();
        if (!sanitizedEventName) {
            logger.warn('Empty event name received');
            return res.status(400).json({ error: 'Event name cannot be empty' });
        }

        // Validate and use current date if not provided or invalid
        let validEventDate = eventDate;
        if (!validEventDate || isNaN(new Date(validEventDate).getTime())) {
            validEventDate = new Date().toISOString();
        }

        // Validate numeric fields
        const validInitialBoxes = (typeof initialBoxes === 'number' && initialBoxes >= 0) ? initialBoxes : 0;
        const validInitialCases = (typeof initialCases === 'number' && initialCases >= 0) ? initialCases : 0;
        const validRemainingBoxes = (typeof remainingBoxes === 'number' && remainingBoxes >= 0) ? remainingBoxes : 0;
        const validRemainingCases = (typeof remainingCases === 'number' && remainingCases >= 0) ? remainingCases : 0;
        const validDonationsReceived = (typeof donationsReceived === 'number' && donationsReceived >= 0) ? donationsReceived : 0;
        const sanitizedDescription = (description && description.trim()) || null;

        await db.run(`
            UPDATE events
            SET "eventName" = $1,
                "eventDate" = $2,
                description = $3,
                "initialBoxes" = $4,
                "initialCases" = $5,
                "remainingBoxes" = $6,
                "remainingCases" = $7,
                "donationsReceived" = $8,
                "eventType" = COALESCE($10, "eventType"),
                "startTime" = COALESCE($11, "startTime"),
                "endTime" = COALESCE($12, "endTime"),
                "location" = COALESCE($13, "location"),
                "targetGroup" = COALESCE($14, "targetGroup")
            WHERE id = $9
        `, [
            sanitizedEventName, validEventDate, sanitizedDescription,
            validInitialBoxes, validInitialCases, validRemainingBoxes, validRemainingCases,
            validDonationsReceived, id,
            eventType, startTime, endTime, location, targetGroup
        ]);

        const updatedEvent = await db.getOne('SELECT * FROM events WHERE id = $1', [id]);
        logger.info('Event updated successfully', { eventId: id, userId: req.session.userId });
        res.json(updatedEvent);
    } catch (error) {
        logger.error('Error updating event', { error: error.message, stack: error.stack, eventId: req.params.id });
        res.status(500).json({ error: 'Failed to update event' });
    }
});

// Delete an event (only owner can delete)
app.delete('/api/events/:id', auth.isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;

        // Check ownership
        const existingEvent = await db.getOne('SELECT "userId" FROM events WHERE id = $1', [id]);
        if (!existingEvent) {
            logger.warn('Attempted to delete non-existent event', { eventId: id });
            return res.status(404).json({ error: 'Event not found' });
        }
        if (existingEvent.userId !== req.session.userId && req.session.userRole !== 'admin') {
            return res.status(403).json({ error: 'Not authorized to edit this event' });
        }

        await db.run('DELETE FROM events WHERE id = $1', [id]);

        logger.info('Event deleted successfully', { eventId: id, userId: req.session.userId });
        res.json({ message: 'Event deleted successfully' });
    } catch (error) {
        logger.error('Error deleting event', { error: error.message, stack: error.stack, eventId: req.params.id });
        res.status(500).json({ error: 'Failed to delete event' });
    }
});

// Import sales from XLSX file
app.post('/api/import', auth.isAuthenticated, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            logger.warn('No file uploaded for import');
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Use ExcelJS to read the workbook
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);

        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
            logger.warn('Empty XLSX file uploaded');
            return res.status(400).json({ error: 'No data found in file' });
        }

        // Convert worksheet to array of objects
        const data = [];
        const headers = [];

        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) {
                // First row is headers
                row.eachCell((cell, colNumber) => {
                    headers[colNumber] = cell.value?.toString() || '';
                });
            } else {
                // Data rows
                const rowData = {};
                row.eachCell((cell, colNumber) => {
                    const header = headers[colNumber];
                    if (header) {
                        // Handle different cell value types
                        let value = cell.value;
                        if (value && typeof value === 'object') {
                            // Handle rich text, dates, etc.
                            if (value.richText) {
                                value = value.richText.map(rt => rt.text).join('');
                            } else if (value instanceof Date) {
                                value = value;
                            } else if (value.result !== undefined) {
                                value = value.result;
                            }
                        }
                        rowData[header] = value;
                    }
                });
                if (Object.keys(rowData).length > 0) {
                    data.push(rowData);
                }
            }
        });

        if (data.length === 0) {
            logger.warn('Empty XLSX file uploaded');
            return res.status(400).json({ error: 'No data found in file' });
        }

        // Cookie type mapping from XLSX columns to our cookie names
        const cookieColumns = [
            { xlsx: 'Thin Mints', db: 'Thin Mints' },
            { xlsx: 'Samoas', db: 'Samoas' },
            { xlsx: 'Caramel deLites', db: 'Samoas' },
            { xlsx: 'Tagalongs', db: 'Tagalongs' },
            { xlsx: 'Peanut Butter Patties', db: 'Tagalongs' },
            { xlsx: 'Trefoils', db: 'Trefoils' },
            { xlsx: 'Shortbread', db: 'Trefoils' },
            { xlsx: 'Do-si-dos', db: 'Do-si-dos' },
            { xlsx: 'Peanut Butter Sandwich', db: 'Do-si-dos' },
            { xlsx: 'Lemon-Ups', db: 'Lemon-Ups' },
            { xlsx: 'Adventurefuls', db: 'Adventurefuls' },
            { xlsx: 'Exploremores', db: 'Exploremores' },
            { xlsx: 'Toffee-tastic', db: 'Toffee-tastic' }
        ];

        const userId = req.session.userId;

        const insertStmt = db.prepare(`
            INSERT INTO sales (
                cookieType, quantity, customerName, customerAddress, customerPhone,
                date, saleType, unitType, orderNumber, orderType, orderStatus, customerEmail, userId
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let importedCount = 0;

        // Use a transaction for better performance
        const importTransaction = db.transaction((rows) => {
            for (const row of rows) {
                // Get order details
                const orderNumber = String(row['Order Number'] || '');
                const orderDate = row['Order Date'];
                const orderType = row['Order Type'] || '';
                const orderStatus = row['Order Status'] || '';
                const customerName = row['Deliver To'] || '';
                const customerAddress = row['Delivery Address'] || '';
                const customerPhone = row['Customer Phone'] || '';
                const customerEmail = row['Customer Email'] || '';

                // Convert date to ISO string
                let dateStr = new Date().toISOString();
                if (orderDate) {
                    if (orderDate instanceof Date) {
                        dateStr = orderDate.toISOString();
                    } else if (typeof orderDate === 'number') {
                        // Excel date serial number
                        const excelEpoch = new Date(1899, 11, 30);
                        const jsDate = new Date(excelEpoch.getTime() + orderDate * 24 * 60 * 60 * 1000);
                        dateStr = jsDate.toISOString();
                    } else if (typeof orderDate === 'string') {
                        const parsedDate = new Date(orderDate);
                        if (!isNaN(parsedDate.getTime())) {
                            dateStr = parsedDate.toISOString();
                        }
                    }
                }

                // Determine sale type based on order type
                let saleType = 'individual';
                if (orderType.toLowerCase().includes('donation')) {
                    saleType = 'donation';
                }

                // Check for donated cookies column
                const donatedCookies = parseInt(row['Donated Cookies'] || row['Donated Cookies (DO NOT DELIVER)'] || 0);
                if (donatedCookies > 0) {
                    // Add donated cookies as a special entry
                    insertStmt.run(
                        'Donated Cookies',
                        donatedCookies,
                        customerName,
                        customerAddress,
                        customerPhone,
                        dateStr,
                        'donation',
                        'box',
                        orderNumber,
                        orderType,
                        orderStatus,
                        customerEmail,
                        userId
                    );
                    importedCount++;
                }

                // Process each cookie type
                for (const cookie of cookieColumns) {
                    const quantity = parseInt(row[cookie.xlsx] || 0);
                    if (quantity > 0) {
                        insertStmt.run(
                            cookie.db,
                            quantity,
                            customerName,
                            customerAddress,
                            customerPhone,
                            dateStr,
                            saleType,
                            'box',
                            orderNumber,
                            orderType,
                            orderStatus,
                            customerEmail,
                            userId
                        );
                        importedCount++;
                    }
                }
            }
        });

        importTransaction(data);

        logger.info('XLSX import completed', {
            filename: req.file.originalname,
            totalRows: data.length,
            importedSales: importedCount,
            userId
        });

        res.json({
            message: 'Import successful',
            ordersProcessed: data.length,
            salesImported: importedCount
        });
    } catch (error) {
        logger.error('Error importing XLSX', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to import file: ' + error.message });
    }
});

// Get payment methods (filtered by userId)
app.get('/api/payment-methods', auth.isAuthenticated, async (req, res) => {
    try {
        const methods = await db.getAll('SELECT * FROM payment_methods WHERE "userId" = $1 ORDER BY id ASC', [req.session.userId]);
        res.json(methods);
    } catch (error) {
        logger.error('Error fetching payment methods', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to fetch payment methods' });
    }
});

// Add payment method
app.post('/api/payment-methods', auth.isAuthenticated, async (req, res) => {
    try {
        const { name, url } = req.body;

        if (!name || !url) {
            return res.status(400).json({ error: 'Name and URL are required' });
        }

        const newMethod = await db.getOne('INSERT INTO payment_methods (name, url, "userId") VALUES ($1, $2, $3) RETURNING *',
            [name.trim(), url.trim(), req.session.userId]);

        logger.info('Payment method added', { id: newMethod.id, name, userId: req.session.userId });
        res.status(201).json(newMethod);
    } catch (error) {
        logger.error('Error adding payment method', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to add payment method' });
    }
});

// Delete payment method (only owner can delete)
app.delete('/api/payment-methods/:id', auth.isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;

        // Check ownership
        const existingMethod = await db.getOne('SELECT "userId" FROM payment_methods WHERE id = $1', [id]);
        if (!existingMethod) {
            return res.status(404).json({ error: 'Payment method not found' });
        }
        // Check if user is deleting their own payment method or is admin
        if (existingMethod.userId !== req.session.userId && req.session.userRole !== 'admin') {
            return res.status(403).json({ error: 'Not authorized to delete this payment method' });
        }

        await db.run('DELETE FROM payment_methods WHERE id = $1', [id]);

        logger.info('Payment method deleted', { id, userId: req.session.userId });
        res.json({ success: true });
    } catch (error) {
        logger.error('Error deleting payment method', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to delete payment method' });
    }
});



// Delete all sales (only current user's sales)
app.delete('/api/sales', auth.isAuthenticated, auth.requirePrivilegeAnyTroop('delete_own_data'), async (req, res) => {
    try {
        const result = await db.run('DELETE FROM sales WHERE "userId" = $1', [req.session.userId]);
        logger.info('All user sales deleted', { deletedCount: result.rowCount, userId: req.session.userId });
        res.json({ success: true, deletedCount: result.rowCount });
    } catch (error) {
        logger.error('Failed to delete sales', { error: error.message });
        res.status(500).json({ error: 'Failed to delete sales' });
    }
});

// Delete all donations (only current user's donations)
app.delete('/api/donations', auth.isAuthenticated, auth.requirePrivilegeAnyTroop('delete_own_data'), async (req, res) => {
    try {
        const result = await db.run('DELETE FROM donations WHERE "userId" = $1', [req.session.userId]);
        logger.info('All user donations deleted', { deletedCount: result.rowCount, userId: req.session.userId });
        res.json({ success: true, deletedCount: result.rowCount });
    } catch (error) {
        logger.error('Failed to delete donations', { error: error.message });
        res.status(500).json({ error: 'Failed to delete donations' });
    }
});

// Delete all data (only current user's sales and donations)
app.delete('/api/data', auth.isAuthenticated, async (req, res) => {
    try {
        const salesResult = await db.run('DELETE FROM sales WHERE "userId" = $1', [req.session.userId]);
        const donationsResult = await db.run('DELETE FROM donations WHERE "userId" = $1', [req.session.userId]);

        const results = { salesDeleted: salesResult.rowCount, donationsDeleted: donationsResult.rowCount };
        logger.info('All user data cleared', { ...results, userId: req.session.userId });
        res.json({ success: true, ...results });
    } catch (error) {
        logger.error('Failed to clear data', { error: error.message });
        res.status(500).json({ error: 'Failed to clear data' });
    }
});



// ============================================================================
// Troop Management Routes (Phase 2)
// ============================================================================

// Get all troops for current user (as leader) or all troops (as admin)
app.get('/api/troop/my-troops', auth.isAuthenticated, async (req, res) => {
    try {
        let troops;
        if (req.session.userRole === 'admin') {
            // Admin sees all troops
            troops = await db.getAll(`
                SELECT t.*, u."firstName" || ' ' || u."lastName" as "leaderName",
                       (SELECT COUNT(*) FROM troop_members WHERE "troopId" = t.id AND status = 'active') as "memberCount"
                FROM troops t
                LEFT JOIN users u ON t."leaderId" = u.id
                WHERE t."isActive" = true
                ORDER BY t."troopNumber"
            `);
        } else {
            // Troop leader sees only their troops
            troops = await db.getAll(`
                SELECT t.*, u."firstName" || ' ' || u."lastName" as "leaderName",
                       (SELECT COUNT(*) FROM troop_members WHERE "troopId" = t.id AND status = 'active') as "memberCount"
                FROM troops t
                LEFT JOIN users u ON t."leaderId" = u.id
                WHERE t."leaderId" = $1 AND t."isActive" = true
                ORDER BY t."troopNumber"
            `, [req.session.userId]);
        }
        res.json(troops);
    } catch (error) {
        logger.error('Error fetching troops', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch troops' });
    }
});

// Get members of a specific troop with sales summaries
app.get('/api/troop/:troopId/members', auth.isAuthenticated, auth.requirePrivilege('view_roster'), async (req, res) => {
    try {
        const { troopId } = req.params;

        // Build scope filter for member visibility
        const scopeFilter = await auth.buildScopeFilter(req.effectiveScope, 'u.id', req, 1);

        // Get members with their sales summaries
        const members = await db.getAll(`
            SELECT
                u.id, u.email, u."firstName", u."lastName", u."photoUrl",
                tm.role as "troopRole", tm."scoutLevel", tm.den, tm.position,
                tm."linkedParentId", tm."joinDate", tm.status,
                COALESCE(SUM(s.quantity), 0) as "totalBoxes",
                COALESCE(SUM(s."amountCollected"), 0) as "totalCollected",
                MAX(s.date) as "lastSaleDate"
            FROM troop_members tm
            JOIN users u ON tm."userId" = u.id
            LEFT JOIN sales s ON s."userId" = u.id
            WHERE tm."troopId" = $1 AND tm.status = 'active'${scopeFilter.clause}
            GROUP BY u.id, tm.role, tm."scoutLevel", tm.den, tm.position, tm."linkedParentId", tm."joinDate", tm.status
            ORDER BY u."lastName", u."firstName"
        `, [troopId, ...scopeFilter.params]);

        res.json(members);
    } catch (error) {
        logger.error('Error fetching troop members', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch troop members' });
    }
});

// ============================================================================
// USER PROFILE MANAGEMENT ENDPOINTS
// ============================================================================

// Get user profile
app.get('/api/users/:userId',
    auth.isAuthenticated,
    auth.requirePrivilegeForUser('view_roster'),
    async (req, res) => {
        try {
            const { userId } = req.params;

            const user = await db.getOne(`
                SELECT id, email, "firstName", "lastName", "photoUrl",
                       "dateOfBirth", "isMinor", "parentEmail", phone, address
                FROM users
                WHERE id = $1
            `, [userId]);

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.json(user);
        } catch (error) {
            logger.error('Error fetching user profile', { error: error.message });
            res.status(500).json({ error: 'Failed to fetch user profile' });
        }
    }
);

// Update user profile
app.put('/api/users/:userId',
    auth.isAuthenticated,
    auth.requirePrivilegeForUser('edit_personal_info'),
    async (req, res) => {
        try {
            const { userId } = req.params;
            const { firstName, lastName, email, phone, address, dateOfBirth, photoUrl } = req.body;

            // Validation
            if (!firstName || !lastName) {
                return res.status(400).json({ error: 'First and last name required' });
            }

            if (email && !auth.isValidEmail(email)) {
                return res.status(400).json({ error: 'Invalid email format' });
            }

            // Check email uniqueness (if changing)
            if (email) {
                const existing = await db.getOne(
                    'SELECT id FROM users WHERE email = $1 AND id != $2',
                    [email, userId]
                );
                if (existing) {
                    return res.status(400).json({ error: 'Email already in use' });
                }
            }

            // Calculate isMinor from dateOfBirth
            const isMinor = dateOfBirth ? auth.isMinor(dateOfBirth) : false;

            const updated = await db.getOne(`
                UPDATE users
                SET "firstName" = $1,
                    "lastName" = $2,
                    email = COALESCE($3, email),
                    phone = $4,
                    address = $5,
                    "dateOfBirth" = $6,
                    "photoUrl" = $7,
                    "isMinor" = $8
                WHERE id = $9
                RETURNING id, "firstName", "lastName", email, phone, address,
                          "dateOfBirth", "photoUrl", "isMinor"
            `, [firstName, lastName, email, phone, address, dateOfBirth, photoUrl, isMinor, userId]);

            await auth.logAuditEvent(db, req.session.userId, 'update_user_profile', req, {
                resourceType: 'user',
                resourceId: userId,
                changes: { firstName, lastName, email, phone, address, dateOfBirth }
            });

            res.json(updated);
        } catch (error) {
            logger.error('Error updating user profile', { error: error.message });
            res.status(500).json({ error: 'Failed to update user profile' });
        }
    }
);

// Update troop member data
app.put('/api/troop/:troopId/members/:userId',
    auth.isAuthenticated,
    auth.requirePrivilege('manage_members'),
    async (req, res) => {
        try {
            const { troopId, userId } = req.params;
            const { role, scoutLevel, den, position, linkedParentId, additionalRoles } = req.body;

            // Verify target is in scope
            const inScope = await auth.isTargetInScope(req, userId);
            if (!inScope) {
                return res.status(403).json({ error: 'Member is outside your access scope' });
            }

            // Verify member exists
            const member = await db.getOne(
                'SELECT * FROM troop_members WHERE "troopId" = $1 AND "userId" = $2',
                [troopId, userId]
            );
            if (!member) {
                return res.status(404).json({ error: 'Member not found in troop' });
            }

            // Validate linkedParentId if provided
            if (linkedParentId) {
                const parentExists = await db.getOne('SELECT id FROM users WHERE id = $1', [linkedParentId]);
                if (!parentExists) {
                    return res.status(400).json({ error: 'Parent user not found' });
                }
            }

            const updated = await db.getOne(`
                UPDATE troop_members
                SET role = COALESCE($1, role),
                    "scoutLevel" = $2,
                    den = $3,
                    position = $4,
                    "linkedParentId" = $5,
                    "additionalRoles" = $6
                WHERE "troopId" = $7 AND "userId" = $8
                RETURNING *
            `, [
                role,
                scoutLevel,
                den,
                position,
                linkedParentId,
                additionalRoles ? JSON.stringify(additionalRoles) : null,
                troopId,
                userId
            ]);

            await auth.logAuditEvent(db, req.session.userId, 'update_troop_member', req, {
                resourceType: 'troop_member',
                resourceId: userId,
                troopId,
                changes: { role, scoutLevel, den, position, linkedParentId }
            });

            res.json(updated);
        } catch (error) {
            logger.error('Error updating troop member', { error: error.message });
            res.status(500).json({ error: 'Failed to update troop member' });
        }
    }
);

// Search for parent users to link
app.get('/api/troop/:troopId/parents',
    auth.isAuthenticated,
    auth.requirePrivilege('view_roster'),
    async (req, res) => {
        try {
            const { troopId } = req.params;
            const { search } = req.query;

            let query = `
                SELECT DISTINCT u.id, u."firstName", u."lastName", u.email
                FROM users u
                JOIN troop_members tm ON u.id = tm."userId"
                WHERE tm."troopId" = $1
                  AND tm.role IN ('parent', 'volunteer', 'co-leader', 'troop_leader')
                  AND tm.status = 'active'
            `;

            const params = [troopId];

            if (search) {
                query += ` AND (
                    u."firstName" ILIKE $2 OR
                    u."lastName" ILIKE $2 OR
                    u.email ILIKE $2
                )`;
                params.push(`%${search}%`);
            }

            query += ` ORDER BY u."lastName", u."firstName" LIMIT 50`;

            const parents = await db.getAll(query, params);
            res.json(parents);
        } catch (error) {
            logger.error('Error fetching parents', { error: error.message });
            res.status(500).json({ error: 'Failed to fetch parents' });
        }
    }
);

// ============================================================================
// PASSWORD RESET ENDPOINTS
// ============================================================================

// Initiate password reset
app.post('/api/users/:userId/password-reset-request',
    auth.isAuthenticated,
    auth.requirePrivilegeForUser('edit_personal_info'),
    async (req, res) => {
        try {
            const { userId } = req.params;

            const user = await db.getOne('SELECT * FROM users WHERE id = $1', [userId]);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Generate secure token
            const resetToken = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 3600000); // 1 hour

            await db.run(`
                UPDATE users
                SET "passwordResetToken" = $1,
                    "passwordResetExpires" = $2
                WHERE id = $3
            `, [resetToken, expiresAt, userId]);

            // TODO: Send email with reset link
            // For development, return token

            await auth.logAuditEvent(db, req.session.userId, 'request_password_reset', req, {
                resourceType: 'user',
                resourceId: userId
            });

            res.json({
                message: 'Password reset initiated',
                resetToken: resetToken // DEV ONLY - remove in production
            });
        } catch (error) {
            logger.error('Error initiating password reset', { error: error.message });
            res.status(500).json({ error: 'Failed to initiate password reset' });
        }
    }
);

// Complete password reset using token
app.post('/api/users/password-reset', async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Token and new password required' });
        }

        // Validate password strength (reuse existing validation)
        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        // Find user by valid token
        const user = await db.getOne(`
            SELECT * FROM users
            WHERE "passwordResetToken" = $1
              AND "passwordResetExpires" > NOW()
        `, [token]);

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        // Hash new password
        const passwordHash = await auth.hashPassword(newPassword);

        // Update password and clear token
        await db.run(`
            UPDATE users
            SET password_hash = $1,
                "passwordResetToken" = NULL,
                "passwordResetExpires" = NULL,
                "lastPasswordChange" = NOW()
            WHERE id = $2
        `, [passwordHash, user.id]);

        await auth.logAuditEvent(db, user.id, 'password_reset_complete', req, {
            resourceType: 'user',
            resourceId: user.id
        });

        res.json({ message: 'Password reset successful' });
    } catch (error) {
        logger.error('Error completing password reset', { error: error.message });
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

// ============================================================================
// PAYMENT METHODS ENDPOINTS
// ============================================================================

// Get user payment methods
app.get('/api/users/:userId/payment-methods',
    auth.isAuthenticated,
    auth.requirePrivilegeForUser('view_sales'),
    async (req, res) => {
        try {
            const { userId } = req.params;

            const methods = await db.getAll(`
                SELECT id, name, url, "isEnabled"
                FROM payment_methods
                WHERE "userId" = $1
                ORDER BY "isEnabled" DESC, name ASC
            `, [userId]);

            res.json(methods);
        } catch (error) {
            logger.error('Error fetching payment methods', { error: error.message });
            res.status(500).json({ error: 'Failed to fetch payment methods' });
        }
    }
);

// Add payment method
app.post('/api/users/:userId/payment-methods',
    auth.isAuthenticated,
    auth.requirePrivilegeForUser('manage_payment_methods'),
    async (req, res) => {
        try {
            const { userId } = req.params;
            const { name, url, isEnabled } = req.body;

            if (!name || !url) {
                return res.status(400).json({ error: 'Name and URL required' });
            }

            // Validate URL format
            try {
                new URL(url);
            } catch (e) {
                return res.status(400).json({ error: 'Invalid URL format' });
            }

            const method = await db.getOne(`
                INSERT INTO payment_methods ("userId", name, url, "isEnabled")
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `, [userId, name, url, isEnabled !== false]);

            await auth.logAuditEvent(db, req.session.userId, 'add_payment_method', req, {
                resourceType: 'payment_method',
                resourceId: method.id,
                userId
            });

            res.json(method);
        } catch (error) {
            logger.error('Error adding payment method', { error: error.message });
            res.status(500).json({ error: 'Failed to add payment method' });
        }
    }
);

// Delete payment method
app.delete('/api/users/:userId/payment-methods/:methodId',
    auth.isAuthenticated,
    auth.requirePrivilegeForUser('manage_payment_methods'),
    async (req, res) => {
        try {
            const { userId, methodId } = req.params;

            // Verify method belongs to user
            const method = await db.getOne(
                'SELECT * FROM payment_methods WHERE id = $1 AND "userId" = $2',
                [methodId, userId]
            );

            if (!method) {
                return res.status(404).json({ error: 'Payment method not found' });
            }

            await db.run('DELETE FROM payment_methods WHERE id = $1', [methodId]);

            await auth.logAuditEvent(db, req.session.userId, 'delete_payment_method', req, {
                resourceType: 'payment_method',
                resourceId: methodId,
                userId
            });

            res.json({ success: true });
        } catch (error) {
            logger.error('Error deleting payment method', { error: error.message });
            res.status(500).json({ error: 'Failed to delete payment method' });
        }
    }
);

// ============================================================================
// ACCOUNT DELETION ENDPOINT
// ============================================================================

// Soft delete user account (COPPA-compliant)
app.delete('/api/users/:userId',
    auth.isAuthenticated,
    auth.requirePrivilegeForUser('delete_own_data'),
    async (req, res) => {
        try {
            const { userId } = req.params;
            const { reason, confirmDelete } = req.body;

            if (!confirmDelete) {
                return res.status(400).json({ error: 'Deletion must be confirmed' });
            }

            const user = await db.getOne('SELECT * FROM users WHERE id = $1', [userId]);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // COPPA protection: Minors cannot self-delete
            if (user.isMinor && req.session.userId === userId) {
                return res.status(403).json({
                    error: 'Minors cannot delete their own account. Parent/guardian must initiate deletion.'
                });
            }

            // Create deletion request (for audit trail)
            const request = await db.getOne(`
                INSERT INTO data_deletion_requests ("userId", "requestedBy", reason, status)
                VALUES ($1, $2, $3, 'pending')
                RETURNING *
            `, [userId, req.session.userId, reason || 'User requested account deletion']);

            // Soft delete: anonymize and mark inactive
            await db.run(`
                UPDATE users
                SET "isActive" = FALSE,
                    email = CONCAT('deleted_', id, '@deleted.local'),
                    phone = NULL,
                    address = NULL
                WHERE id = $1
            `, [userId]);

            // Mark troop memberships inactive
            await db.run(`
                UPDATE troop_members
                SET status = 'inactive',
                    "leaveDate" = NOW()
                WHERE "userId" = $1
            `, [userId]);

            await auth.logAuditEvent(db, req.session.userId, 'delete_user_account', req, {
                resourceType: 'user',
                resourceId: userId,
                isMinor: user.isMinor,
                reason
            });

            res.json({
                message: 'Account deletion initiated. Account will be fully deleted in 30 days.',
                deletionRequestId: request.id
            });
        } catch (error) {
            logger.error('Error deleting user account', { error: error.message });
            res.status(500).json({ error: 'Failed to delete account' });
        }
    }
);

// Get aggregated sales data for a troop
app.get('/api/troop/:troopId/sales', auth.isAuthenticated, auth.requirePrivilege('view_troop_sales'), async (req, res) => {
    try {
        const { troopId } = req.params;

        // Build scope filter for sales visibility
        const scopeFilter = await auth.buildScopeFilter(req.effectiveScope, 's."userId"', req, 1);

        // Get sales by cookie type (prefer productId grouping, fall back to cookieType)
        const salesByCookie = await db.getAll(`
            SELECT
                COALESCE(cp."cookieName", s."cookieType") as "cookieType",
                s."productId",
                cp."shortName" as "productShortName",
                cp."pricePerBox" as "productPrice",
                SUM(s.quantity) as "totalQuantity",
                SUM(s."amountCollected") as "totalCollected"
            FROM sales s
            JOIN troop_members tm ON s."userId" = tm."userId"
            LEFT JOIN cookie_products cp ON s."productId" = cp.id
            WHERE tm."troopId" = $1 AND tm.status = 'active'${scopeFilter.clause}
            GROUP BY COALESCE(cp."cookieName", s."cookieType"), s."productId", cp."shortName", cp."pricePerBox"
            ORDER BY "totalQuantity" DESC
        `, [troopId, ...scopeFilter.params]);

        // Get totals
        const scopeFilter2 = await auth.buildScopeFilter(req.effectiveScope, 's."userId"', req, 1);
        const totals = await db.getOne(`
            SELECT
                COALESCE(SUM(s.quantity), 0) as "totalBoxes",
                COALESCE(SUM(s."amountCollected"), 0) as "totalCollected",
                COALESCE(SUM(s."amountDue"), 0) as "totalDue"
            FROM sales s
            JOIN troop_members tm ON s."userId" = tm."userId"
            WHERE tm."troopId" = $1 AND tm.status = 'active'${scopeFilter2.clause}
        `, [troopId, ...scopeFilter2.params]);

        res.json({
            salesByCookie,
            totals
        });
    } catch (error) {
        logger.error('Error fetching troop sales', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch troop sales' });
    }
});

// Get troop events (Calendar)
app.get('/api/troop/:troopId/events', auth.isAuthenticated, auth.requirePrivilege('view_events'), async (req, res) => {
    try {
        const { troopId } = req.params;
        const { start, end } = req.query; // Optional date range filtering

        let query = 'SELECT * FROM events WHERE "troopId" = $1';
        const params = [troopId];

        if (start && end) {
            query += ' AND "eventDate" BETWEEN $2 AND $3';
            params.push(start, end);
        }

        query += ' ORDER BY "eventDate" ASC, "startTime" ASC';

        const events = await db.getAll(query, params);
        res.json(events);
    } catch (error) {
        logger.error('Error fetching troop events', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

// Export troop events to .ics
app.get('/api/troop/:troopId/calendar/export', auth.isAuthenticated, auth.requirePrivilege('export_calendar'), async (req, res) => {
    try {
        const { troopId } = req.params;

        const troop = await db.getOne('SELECT * FROM troops WHERE id = $1', [troopId]);

        const events = await db.getAll('SELECT * FROM events WHERE "troopId" = $1 ORDER BY "eventDate" ASC', [troopId]);

        let icsContent = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Apex Scout Manager//Troop Calendar//EN\r\n';
        
        events.forEach(event => {
            icsContent += 'BEGIN:VEVENT\r\n';
            icsContent += `UID:event-${event.id}@apexscoutmanager\r\n`;

            // Format timestamps (YYYYMMDDTHHmmssZ)
            const dateStr = new Date(event.eventDate).toISOString().replace(/[-:]/g, '').split('T')[0];
            
            if (event.startTime) {
                const timeStr = event.startTime.replace(':', '') + '00';
                icsContent += `DTSTART:${dateStr}T${timeStr}\r\n`;
            } else {
                icsContent += `DTSTART;VALUE=DATE:${dateStr}\r\n`;
            }
            
            if (event.endTime) {
                const timeStr = event.endTime.replace(':', '') + '00';
                icsContent += `DTEND:${dateStr}T${timeStr}\r\n`;
            }

            icsContent += `SUMMARY:${event.eventName} (${event.targetGroup})\r\n`;
            if (event.description) icsContent += `DESCRIPTION:${event.description}\r\n`;
            if (event.location) icsContent += `LOCATION:${event.location}\r\n`;
            
            icsContent += 'END:VEVENT\r\n';
        });

        icsContent += 'END:VCALENDAR';

        res.setHeader('Content-Type', 'text/calendar');
        res.setHeader('Content-Disposition', `attachment; filename="troop-${troopId}-calendar.ics"`);
        res.send(icsContent);

    } catch (error) {
        logger.error('Error exporting calendar', { error: error.message });
        res.status(500).json({ error: 'Failed to export calendar' });
    }
});

// Get troop goals
app.get('/api/troop/:troopId/goals', auth.isAuthenticated, auth.requirePrivilege('view_goals'), async (req, res) => {
    try {
        const { troopId } = req.params;

        const goals = await db.getAll(`
            SELECT * FROM troop_goals
            WHERE "troopId" = $1
            ORDER BY status, "endDate"
        `, [troopId]);

        res.json(goals);
    } catch (error) {
        logger.error('Error fetching troop goals', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch troop goals' });
    }
});

// Create a new troop
app.post('/api/troop', auth.isAuthenticated, auth.hasRole('troop_leader', 'admin'), async (req, res) => {
    try {
        const { troopNumber, troopType, meetingLocation, meetingDay, meetingTime } = req.body;

        if (!troopNumber || !troopType) {
            return res.status(400).json({ error: 'Troop number and type are required' });
        }

        const validTypes = ['daisy', 'brownie', 'junior', 'cadette', 'senior', 'ambassador', 'multi-level'];
        if (!validTypes.includes(troopType)) {
            return res.status(400).json({ error: 'Invalid troop type' });
        }

        const newTroop = await db.getOne(`
            INSERT INTO troops ("troopNumber", "troopType", "leaderId", "meetingLocation", "meetingDay", "meetingTime", "isActive", "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
            RETURNING *
        `, [
            troopNumber.trim(),
            troopType,
            req.session.userId,
            meetingLocation?.trim() || null,
            meetingDay?.trim() || null,
            meetingTime?.trim() || null
        ]);

        logger.info('Troop created', { troopId: newTroop.id, troopNumber, userId: req.session.userId });
        res.status(201).json(newTroop);
    } catch (error) {
        logger.error('Error creating troop', { error: error.message });
        res.status(500).json({ error: 'Failed to create troop' });
    }
});

// Update a troop
app.put('/api/troop/:troopId', auth.isAuthenticated, auth.requirePrivilege('manage_troop_settings'), async (req, res) => {
    try {
        const { troopId } = req.params;
        const { troopNumber, troopType, meetingLocation, meetingDay, meetingTime, leaderId } = req.body;

        const troop = await db.getOne('SELECT * FROM troops WHERE id = $1', [troopId]);
        if (!troop) {
            return res.status(404).json({ error: 'Troop not found' });
        }

        await db.run(`
            UPDATE troops SET
                "troopNumber" = COALESCE($1, "troopNumber"),
                "troopType" = COALESCE($2, "troopType"),
                "meetingLocation" = $3,
                "meetingDay" = $4,
                "meetingTime" = $5,
                "leaderId" = COALESCE($6, "leaderId"),
                "updatedAt" = NOW()
            WHERE id = $7
        `, [
            troopNumber?.trim() || null,
            troopType || null,
            meetingLocation?.trim() || null,
            meetingDay?.trim() || null,
            meetingTime?.trim() || null,
            leaderId || null,
            troopId
        ]);

        const updatedTroop = await db.getOne('SELECT * FROM troops WHERE id = $1', [troopId]);
        logger.info('Troop updated', { troopId, userId: req.session.userId });
        res.json(updatedTroop);
    } catch (error) {
        logger.error('Error updating troop', { error: error.message });
        res.status(500).json({ error: 'Failed to update troop' });
    }
});

// Add member to troop
app.post('/api/troop/:troopId/members', auth.isAuthenticated, auth.requirePrivilege('manage_members'), async (req, res) => {
    try {
        const { troopId } = req.params;
        const { email, role, firstName, lastName, address, dateOfBirth, den, familyInfo, position, level, roles } = req.body;

        let user = null;

        // If email provided, try to find existing user
        if (email) {
            user = await db.getOne('SELECT id, "firstName", "lastName", email FROM users WHERE email = $1', [email]);
        }

        // If no user found, create one with the provided name
        if (!user) {
            if (!firstName || !lastName) {
                return res.status(400).json({ error: 'First name and last name are required' });
            }

            // Determine user role based on position
            let userRole = 'scout';
            if (position === 'Troop Leader' || position === 'Co-Leader') {
                userRole = 'troop_leader';
            } else if (position === 'Troop Volunteer') {
                userRole = 'parent'; // closest existing role for volunteers
            }

            const newUser = await db.getOne(`
                INSERT INTO users ("firstName", "lastName", email, role, "isActive", "dateOfBirth")
                VALUES ($1, $2, $3, $4, TRUE, $5)
                RETURNING id, "firstName", "lastName", email
            `, [firstName, lastName, email || null, userRole, dateOfBirth || null]);

            user = newUser;
        }

        // Map position to troop_members role
        let memberRole = 'member';
        if (position === 'Troop Leader') memberRole = 'troop_leader';
        else if (position === 'Co-Leader') memberRole = 'co-leader';
        else if (position === 'Troop Volunteer') memberRole = 'volunteer';
        else if (role) {
            const validRoles = ['member', 'co-leader', 'assistant', 'parent', 'troop_leader', 'volunteer'];
            memberRole = validRoles.includes(role) ? role : 'member';
        }

        // Check if already a member
        const existingMember = await db.getOne('SELECT * FROM troop_members WHERE "troopId" = $1 AND "userId" = $2', [troopId, user.id]);
        if (existingMember) {
            if (existingMember.status === 'active') {
                return res.status(409).json({ error: 'User is already a member of this troop' });
            }
            // Reactivate if previously inactive
            await db.run(`
                UPDATE troop_members
                SET status = 'active', role = $1, "joinDate" = NOW(),
                    "scoutLevel" = $2, position = $3, "additionalRoles" = $4, den = $5
                WHERE id = $6
            `, [memberRole, level || null, position || null, JSON.stringify(roles || []), den || null, existingMember.id]);
        } else {
            // Add new member
            await db.run(`
                INSERT INTO troop_members ("troopId", "userId", role, "scoutLevel", position, "additionalRoles", den, "joinDate", status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), 'active')
            `, [troopId, user.id, memberRole, level || null, position || null, JSON.stringify(roles || []), den || null]);
        }

        logger.info('Member added to troop', { troopId, userId: user.id, position, level, addedBy: req.session.userId });
        res.status(201).json({ success: true, member: user });
    } catch (error) {
        logger.error('Error adding troop member', { error: error.message });
        res.status(500).json({ error: 'Failed to add member' });
    }
});

// Add new scout with parent information to troop
app.post('/api/troop/:troopId/members/scout', auth.isAuthenticated, auth.requirePrivilege('manage_members'), async (req, res) => {
    try {
        const { troopId } = req.params;
        const {
            scoutFirstName,
            scoutLastName,
            scoutLevel,
            scoutDateOfBirth,
            parentFirstName,
            parentLastName,
            parentEmail,
            parentPhone,
            parentRole,
            secondaryParentFirstName,
            secondaryParentLastName,
            secondaryParentEmail,
            secondaryParentPhone,
            secondaryParentRole
        } = req.body;

        // Validate required fields
        if (!scoutFirstName || !scoutLastName) {
            return res.status(400).json({ error: 'Scout first and last name are required' });
        }
        if (!parentFirstName || !parentLastName) {
            return res.status(400).json({ error: 'Parent first and last name are required' });
        }
        if (!parentRole) {
            return res.status(400).json({ error: 'Parent role is required' });
        }

        // Use transaction for multi-step operation
        const result = await db.transaction(async (client) => {
            let parentUserId = null;
            let secondaryParentUserId = null;

            // Create or find primary parent account
            if (parentEmail) {
                // Check if parent already exists by email
                const existingParent = await client.query('SELECT id FROM users WHERE email = $1', [parentEmail]);
                if (existingParent.rows.length > 0) {
                    parentUserId = existingParent.rows[0].id;
                } else {
                    // Create new parent account
                    const parentResult = await client.query(`
                        INSERT INTO users ("firstName", "lastName", email, role, "isActive", "createdAt")
                        VALUES ($1, $2, $3, 'parent', true, NOW())
                        RETURNING id
                    `, [parentFirstName, parentLastName, parentEmail]);
                    parentUserId = parentResult.rows[0].id;
                }
            } else {
                // Create parent account without email (can't login until email added)
                const parentResult = await client.query(`
                    INSERT INTO users ("firstName", "lastName", email, role, "isActive", "createdAt")
                    VALUES ($1, $2, NULL, 'parent', true, NOW())
                    RETURNING id
                `, [parentFirstName, parentLastName]);
                parentUserId = parentResult.rows[0].id;
            }

            // Create secondary parent if provided
            if (secondaryParentFirstName && secondaryParentLastName) {
                if (secondaryParentEmail) {
                    // Check if secondary parent already exists by email
                    const existingSecondary = await client.query('SELECT id FROM users WHERE email = $1', [secondaryParentEmail]);
                    if (existingSecondary.rows.length > 0) {
                        secondaryParentUserId = existingSecondary.rows[0].id;
                    } else {
                        // Create new secondary parent account
                        const secondaryResult = await client.query(`
                            INSERT INTO users ("firstName", "lastName", email, role, "isActive", "createdAt")
                            VALUES ($1, $2, $3, 'parent', true, NOW())
                            RETURNING id
                        `, [secondaryParentFirstName, secondaryParentLastName, secondaryParentEmail]);
                        secondaryParentUserId = secondaryResult.rows[0].id;
                    }
                } else {
                    // Create secondary parent account without email
                    const secondaryResult = await client.query(`
                        INSERT INTO users ("firstName", "lastName", email, role, "isActive", "createdAt")
                        VALUES ($1, $2, NULL, 'parent', true, NOW())
                        RETURNING id
                    `, [secondaryParentFirstName, secondaryParentLastName]);
                    secondaryParentUserId = secondaryResult.rows[0].id;
                }
            }

            // Create scout account (no email required)
            const scoutResult = await client.query(`
                INSERT INTO users ("firstName", "lastName", email, role, "dateOfBirth", "isActive", "createdAt")
                VALUES ($1, $2, NULL, 'scout', $3, true, NOW())
                RETURNING id
            `, [scoutFirstName, scoutLastName, scoutDateOfBirth || null]);
            const scoutUserId = scoutResult.rows[0].id;

            // Add scout to troop
            await client.query(`
                INSERT INTO troop_members ("troopId", "userId", role, "scoutLevel", "linkedParentId", "parentRole", "joinDate", status)
                VALUES ($1, $2, 'member', $3, $4, $5, NOW(), 'active')
            `, [troopId, scoutUserId, scoutLevel || null, parentUserId, parentRole]);

            // Add primary parent to troop
            await client.query(`
                INSERT INTO troop_members ("troopId", "userId", role, "linkedParentId", "parentRole", "joinDate", status)
                VALUES ($1, $2, 'parent', $3, $4, NOW(), 'active')
            `, [troopId, parentUserId, scoutUserId, parentRole]);

            // Add secondary parent to troop if provided
            if (secondaryParentUserId) {
                await client.query(`
                    INSERT INTO troop_members ("troopId", "userId", role, "linkedParentId", "parentRole", "joinDate", status)
                    VALUES ($1, $2, 'parent', $3, $4, NOW(), 'active')
                `, [troopId, secondaryParentUserId, scoutUserId, secondaryParentRole || 'parent']);
            }

            logger.info('Scout and parent(s) added to troop', {
                troopId,
                scoutId: scoutUserId,
                parentId: parentUserId,
                secondaryParentId: secondaryParentUserId,
                addedBy: req.session.userId
            });

            return {
                success: true,
                scout: {
                    id: scoutUserId,
                    firstName: scoutFirstName,
                    lastName: scoutLastName,
                    level: scoutLevel
                },
                parent: {
                    id: parentUserId,
                    firstName: parentFirstName,
                    lastName: parentLastName,
                    role: parentRole,
                    email: parentEmail
                },
                secondaryParent: secondaryParentUserId ? {
                    id: secondaryParentUserId,
                    firstName: secondaryParentFirstName,
                    lastName: secondaryParentLastName,
                    role: secondaryParentRole
                } : null
            };
        });

        res.status(201).json(result);

    } catch (error) {
        logger.error('Error adding scout to troop', { error: error.message });
        res.status(500).json({ error: 'Failed to add scout' });
    }
});

// Remove member from troop
app.delete('/api/troop/:troopId/members/:userId', auth.isAuthenticated, auth.requirePrivilege('manage_members'), async (req, res) => {
    try {
        const { troopId, userId } = req.params;

        // Verify target member is within scope
        const inScope = await auth.isTargetInScope(req, userId);
        if (!inScope) {
            return res.status(403).json({ error: 'Target member is outside your access scope' });
        }

        // Set member as inactive (soft delete)
        const result = await db.run(`
            UPDATE troop_members SET status = 'inactive', "leaveDate" = NOW()
            WHERE "troopId" = $1 AND "userId" = $2
        `, [troopId, userId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Member not found in this troop' });
        }

        logger.info('Member removed from troop', { troopId, userId, removedBy: req.session.userId });
        res.json({ success: true });
    } catch (error) {
        logger.error('Error removing troop member', { error: error.message });
        res.status(500).json({ error: 'Failed to remove member' });
    }
});

// Create troop goal
app.post('/api/troop/:troopId/goals', auth.isAuthenticated, auth.requirePrivilege('manage_goals'), async (req, res) => {
    try {
        const { troopId } = req.params;
        const { goalType, targetAmount, startDate, endDate, description } = req.body;

        const validGoalTypes = ['boxes_sold', 'revenue', 'participation', 'events', 'donations'];
        if (!validGoalTypes.includes(goalType)) {
            return res.status(400).json({ error: 'Invalid goal type' });
        }

        const newGoal = await db.getOne(`
            INSERT INTO troop_goals ("troopId", "goalType", "targetAmount", "startDate", "endDate", description, status, "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4, $5, $6, 'in_progress', NOW(), NOW())
            RETURNING *
        `, [troopId, goalType, targetAmount, startDate, endDate, description || null]);

        logger.info('Troop goal created', { goalId: newGoal.id, troopId, goalType });
        res.status(201).json(newGoal);
    } catch (error) {
        logger.error('Error creating troop goal', { error: error.message });
        res.status(500).json({ error: 'Failed to create goal' });
    }
});

// Get all users (for adding members) - admin or troop_leader
app.get('/api/users/search', auth.isAuthenticated, auth.hasRole('troop_leader', 'admin'), async (req, res) => {
    try {
        const { query } = req.query;
        if (!q || q.length < 2) {
            return res.json([]);
        }

        const users = await db.getAll(`
            SELECT id, email, "firstName", "lastName", role
            FROM users
            WHERE (email ILIKE $1 OR "firstName" ILIKE $1 OR "lastName" ILIKE $1)
            AND "isActive" = true
            LIMIT 10
        `, [`%${q}%`]);

        res.json(users);
    } catch (error) {
        logger.error('Error searching users', { error: error.message });
        res.status(500).json({ error: 'Failed to search users' });
    }
});

// ============================================================================
// Phase 3: Cookie Catalog and Season Management Routes
// ============================================================================

// Get active season
app.get('/api/seasons/active', auth.isAuthenticated, async (req, res) => {
    try {
        const season = await db.getOne('SELECT * FROM seasons WHERE "isActive" = true');
        res.json(season || null);
    } catch (error) {
        logger.error('Error fetching active season', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch active season' });
    }
});

// Get all seasons
app.get('/api/seasons', auth.isAuthenticated, async (req, res) => {
    try {
        const seasons = await db.getAll(`
            SELECT s.*,
                   (SELECT COUNT(*) FROM cookie_products WHERE season = s.year) as "cookieCount"
            FROM seasons s
            ORDER BY s.year DESC
        `);
        res.json(seasons);
    } catch (error) {
        logger.error('Error fetching seasons', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch seasons' });
    }
});

// Create new season
app.post('/api/seasons', auth.isAuthenticated, auth.hasRole('admin'), async (req, res) => {
    try {
        const { year, name, startDate, endDate, pricePerBox, copyFromYear } = req.body;

        if (!year || !name || !startDate || !endDate) {
            return res.status(400).json({ error: 'Year, name, start date, and end date are required' });
        }

        // Check if season already exists
        const existing = await db.getOne('SELECT id FROM seasons WHERE year = $1', [year]);
        if (existing) {
            return res.status(409).json({ error: 'Season already exists' });
        }

        // Create season
        const newSeason = await db.getOne(`
            INSERT INTO seasons (year, name, "startDate", "endDate", "pricePerBox", "isActive", "createdAt")
            VALUES ($1, $2, $3, $4, $5, false, NOW())
            RETURNING *
        `, [year, name, startDate, endDate, pricePerBox || 6.00]);

        // Copy cookies from another season if specified
        if (copyFromYear) {
            const cookiesToCopy = await db.getAll(`
                SELECT "cookieName", "shortName", description, "pricePerBox", "boxesPerCase", "sortOrder", "imageUrl"
                FROM cookie_products WHERE season = $1
            `, [copyFromYear]);

            for (const cookie of cookiesToCopy) {
                await db.run(`
                    INSERT INTO cookie_products (season, "cookieName", "shortName", description, "pricePerBox", "boxesPerCase", "sortOrder", "imageUrl", "isActive")
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
                `, [year, cookie.cookieName, cookie.shortName, cookie.description,
                    cookie.pricePerBox, cookie.boxesPerCase, cookie.sortOrder, cookie.imageUrl]);
            }

            logger.info('Copied cookies from previous season', { fromYear: copyFromYear, toYear: year, count: cookiesToCopy.length });
        }

        logger.info('Season created', { year, name });
        res.status(201).json(newSeason);
    } catch (error) {
        logger.error('Error creating season', { error: error.message });
        res.status(500).json({ error: 'Failed to create season' });
    }
});

// Activate a season
app.put('/api/seasons/:year/activate', auth.isAuthenticated, auth.hasRole('admin'), async (req, res) => {
    try {
        const { year } = req.params;

        // Deactivate all seasons
        await db.run('UPDATE seasons SET "isActive" = false');

        // Activate specified season
        const result = await db.run('UPDATE seasons SET "isActive" = true, "updatedAt" = NOW() WHERE year = $1', [year]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Season not found' });
        }

        logger.info('Season activated', { year });
        res.json({ success: true, year });
    } catch (error) {
        logger.error('Error activating season', { error: error.message });
        res.status(500).json({ error: 'Failed to activate season' });
    }
});

// Get all cookies for a season (or active season if not specified)
app.get('/api/cookies', auth.isAuthenticated, async (req, res) => {
    try {
        const { season, includeInactive } = req.query;

        // Get season to query
        let targetSeason = season;
        if (!targetSeason) {
            const active = await db.getOne('SELECT year FROM seasons WHERE "isActive" = true');
            targetSeason = active?.year || '2026';
        }

        // Build query - using PostgreSQL json_agg instead of SQLite json_group_array
        let query = `
            SELECT cp.*,
                   b."bakerName", b."bakerCode",
                   COALESCE(
                       json_agg(
                           json_build_object('id', ca.id, 'type', ca."attributeType", 'value', ca."attributeValue", 'label', ca."displayLabel")
                       ) FILTER (WHERE ca.id IS NOT NULL),
                       '[]'::json
                   ) as "attributesJson"
            FROM cookie_products cp
            LEFT JOIN cookie_attributes ca ON cp.id = ca."productId"
            LEFT JOIN bakers b ON cp."bakerId" = b.id
            WHERE cp.season = $1
        `;

        if (!includeInactive) {
            query += ' AND cp."isActive" = true';
        }

        query += ' GROUP BY cp.id, b."bakerName", b."bakerCode" ORDER BY cp."sortOrder", cp."cookieName"';

        const cookies = await db.getAll(query, [targetSeason]);

        // Parse attributes JSON
        const result = cookies.map(cookie => {
            let attributes = [];
            try {
                const parsed = typeof cookie.attributesJson === 'string' ? JSON.parse(cookie.attributesJson) : cookie.attributesJson;
                attributes = Array.isArray(parsed) ? parsed.filter(a => a.id !== null) : [];
            } catch (e) {
                attributes = [];
            }
            delete cookie.attributesJson;
            return { ...cookie, attributes };
        });

        res.json(result);
    } catch (error) {
        logger.error('Error fetching cookies', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch cookies' });
    }
});

// Get single cookie with nutrition info
app.get('/api/cookies/:id', auth.isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;

        const cookie = await db.getOne('SELECT * FROM cookie_products WHERE id = $1', [id]);
        if (!cookie) {
            return res.status(404).json({ error: 'Cookie not found' });
        }

        const attributes = await db.getAll('SELECT * FROM cookie_attributes WHERE "productId" = $1', [id]);
        const nutrition = await db.getOne('SELECT * FROM cookie_nutrition WHERE "productId" = $1', [id]);

        res.json({ ...cookie, attributes, nutrition });
    } catch (error) {
        logger.error('Error fetching cookie', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch cookie' });
    }
});

// Add new cookie
app.post('/api/cookies', auth.isAuthenticated, auth.hasRole('troop_leader', 'admin'), async (req, res) => {
    try {
        const { season, cookieName, shortName, description, pricePerBox, boxesPerCase, sortOrder, imageUrl, bakerId, organizationId, attributes, nutrition } = req.body;

        if (!season || !cookieName) {
            return res.status(400).json({ error: 'Season and cookie name are required' });
        }

        // Insert cookie
        const newCookie = await db.getOne(`
            INSERT INTO cookie_products (season, "cookieName", "shortName", description, "pricePerBox", "boxesPerCase", "sortOrder", "imageUrl", "bakerId", "organizationId", "isActive", "createdAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, NOW())
            RETURNING *
        `, [season, cookieName, shortName || null, description || null, pricePerBox || 6.00, boxesPerCase || 12, sortOrder || 0, imageUrl || null, bakerId || null, organizationId || null]);

        const productId = newCookie.id;

        // Insert attributes if provided
        if (attributes && Array.isArray(attributes)) {
            for (const attr of attributes) {
                await db.run(`
                    INSERT INTO cookie_attributes ("productId", "attributeType", "attributeValue", "displayLabel")
                    VALUES ($1, $2, $3, $4)
                `, [productId, attr.type, attr.value, attr.label || null]);
            }
        }

        // Insert nutrition if provided
        if (nutrition) {
            await db.run(`
                INSERT INTO cookie_nutrition ("productId", "servingSize", "servingsPerBox", calories, "totalFat", "saturatedFat", "transFat", cholesterol, sodium, "totalCarbs", "dietaryFiber", sugars, protein, ingredients)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            `, [productId, nutrition.servingSize, nutrition.servingsPerBox, nutrition.calories, nutrition.totalFat, nutrition.saturatedFat, nutrition.transFat, nutrition.cholesterol, nutrition.sodium, nutrition.totalCarbs, nutrition.dietaryFiber, nutrition.sugars, nutrition.protein, nutrition.ingredients]);
        }

        logger.info('Cookie created', { productId, cookieName, season });
        res.status(201).json(newCookie);
    } catch (error) {
        logger.error('Error creating cookie', { error: error.message });
        res.status(500).json({ error: 'Failed to create cookie' });
    }
});

// Update cookie
app.put('/api/cookies/:id', auth.isAuthenticated, auth.hasRole('troop_leader', 'admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { cookieName, shortName, description, pricePerBox, boxesPerCase, sortOrder, imageUrl, isActive, bakerId, organizationId, attributes, nutrition } = req.body;

        const existing = await db.getOne('SELECT id FROM cookie_products WHERE id = $1', [id]);
        if (!existing) {
            return res.status(404).json({ error: 'Cookie not found' });
        }

        // Update cookie
        await db.run(`
            UPDATE cookie_products SET
                "cookieName" = COALESCE($1, "cookieName"),
                "shortName" = COALESCE($2, "shortName"),
                description = COALESCE($3, description),
                "pricePerBox" = COALESCE($4, "pricePerBox"),
                "boxesPerCase" = COALESCE($5, "boxesPerCase"),
                "sortOrder" = COALESCE($6, "sortOrder"),
                "imageUrl" = COALESCE($7, "imageUrl"),
                "isActive" = COALESCE($8, "isActive"),
                "bakerId" = COALESCE($9, "bakerId"),
                "organizationId" = COALESCE($10, "organizationId"),
                "updatedAt" = NOW()
            WHERE id = $11
        `, [cookieName, shortName, description, pricePerBox, boxesPerCase, sortOrder, imageUrl, isActive, bakerId, organizationId, id]);

        // Update attributes if provided (replace all)
        if (attributes && Array.isArray(attributes)) {
            await db.run('DELETE FROM cookie_attributes WHERE "productId" = $1', [id]);
            for (const attr of attributes) {
                await db.run(`
                    INSERT INTO cookie_attributes ("productId", "attributeType", "attributeValue", "displayLabel")
                    VALUES ($1, $2, $3, $4)
                `, [id, attr.type, attr.value, attr.label || null]);
            }
        }

        // Update nutrition if provided
        if (nutrition) {
            await db.run('DELETE FROM cookie_nutrition WHERE "productId" = $1', [id]);
            await db.run(`
                INSERT INTO cookie_nutrition ("productId", "servingSize", "servingsPerBox", calories, "totalFat", "saturatedFat", "transFat", cholesterol, sodium, "totalCarbs", "dietaryFiber", sugars, protein, ingredients)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            `, [id, nutrition.servingSize, nutrition.servingsPerBox, nutrition.calories, nutrition.totalFat, nutrition.saturatedFat, nutrition.transFat, nutrition.cholesterol, nutrition.sodium, nutrition.totalCarbs, nutrition.dietaryFiber, nutrition.sugars, nutrition.protein, nutrition.ingredients]);
        }

        const updatedCookie = await db.getOne('SELECT * FROM cookie_products WHERE id = $1', [id]);
        logger.info('Cookie updated', { id });
        res.json(updatedCookie);
    } catch (error) {
        logger.error('Error updating cookie', { error: error.message });
        res.status(500).json({ error: 'Failed to update cookie' });
    }
});

// Delete cookie (soft delete)
app.delete('/api/cookies/:id', auth.isAuthenticated, auth.hasRole('troop_leader', 'admin'), async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.run('UPDATE cookie_products SET "isActive" = false, "updatedAt" = NOW() WHERE id = $1', [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Cookie not found' });
        }

        logger.info('Cookie deactivated', { id });
        res.json({ success: true });
    } catch (error) {
        logger.error('Error deactivating cookie', { error: error.message });
        res.status(500).json({ error: 'Failed to deactivate cookie' });
    }
});

// ============================================================================
// Baker & Troop Product Routes
// ============================================================================

// Get all bakers
app.get('/api/bakers', auth.isAuthenticated, async (req, res) => {
    try {
        const bakers = await db.getAll(`
            SELECT b.*,
                   (SELECT COUNT(*) FROM cookie_products WHERE "bakerId" = b.id AND "isActive" = true) as "productCount"
            FROM bakers b
            WHERE b."isActive" = true
            ORDER BY b."bakerName"
        `);
        res.json(bakers);
    } catch (error) {
        logger.error('Error fetching bakers', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch bakers' });
    }
});

// Get products available for a troop (based on troop's organization + active season)
app.get('/api/troop/:troopId/products', auth.isAuthenticated, auth.requirePrivilege('view_sales'), async (req, res) => {
    try {
        const { troopId } = req.params;
        const { baker, includeInactive } = req.query;

        // Get the troop's organization
        const troop = await db.getOne(`
            SELECT t.id, t."organizationId", so."orgCode", so."orgName"
            FROM troops t
            LEFT JOIN scout_organizations so ON t."organizationId" = so.id
            WHERE t.id = $1
        `, [troopId]);
        if (!troop) return res.status(404).json({ error: 'Troop not found' });

        // Get active season
        const season = await db.getOne('SELECT * FROM seasons WHERE "isActive" = true');
        const targetSeason = season?.year || '2026';

        // Build product query
        let query = `
            SELECT cp.*, b."bakerName", b."bakerCode",
                   COALESCE(
                       json_agg(
                           json_build_object('id', ca.id, 'type', ca."attributeType", 'value', ca."attributeValue", 'label', ca."displayLabel")
                       ) FILTER (WHERE ca.id IS NOT NULL),
                       '[]'::json
                   ) as "attributesJson"
            FROM cookie_products cp
            LEFT JOIN cookie_attributes ca ON cp.id = ca."productId"
            LEFT JOIN bakers b ON cp."bakerId" = b.id
            WHERE cp.season = $1
        `;
        const params = [targetSeason];
        let paramIdx = 2;

        // Filter by organization if troop has one
        if (troop.organizationId) {
            query += ` AND cp."organizationId" = $${paramIdx}`;
            params.push(troop.organizationId);
            paramIdx++;
        }

        // Optional baker filter
        if (baker) {
            query += ` AND b."bakerCode" = $${paramIdx}`;
            params.push(baker);
            paramIdx++;
        }

        if (!includeInactive) {
            query += ' AND cp."isActive" = true';
        }

        query += ' GROUP BY cp.id, b."bakerName", b."bakerCode" ORDER BY cp."sortOrder", cp."cookieName"';

        const products = await db.getAll(query, params);

        // Parse attributes
        const result = products.map(p => {
            let attributes = [];
            try {
                const parsed = typeof p.attributesJson === 'string' ? JSON.parse(p.attributesJson) : p.attributesJson;
                attributes = Array.isArray(parsed) ? parsed.filter(a => a.id !== null) : [];
            } catch (e) { attributes = []; }
            delete p.attributesJson;
            return { ...p, attributes };
        });

        res.json({
            troop: { id: troop.id, orgCode: troop.orgCode, orgName: troop.orgName },
            season: targetSeason,
            products: result
        });
    } catch (error) {
        logger.error('Error fetching troop products', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch troop products' });
    }
});

// ============================================================================
// Phase B: Cookie Dashboard Endpoints
// ============================================================================

// Cookie Dashboard - aggregated data for a troop member
app.get('/api/troop/:troopId/cookie-dashboard', auth.isAuthenticated, auth.requirePrivilege('view_sales'), async (req, res) => {
    try {
        const { troopId } = req.params;
        const userId = req.session.userId;

        // My sales summary
        const mySales = await db.getOne(`
            SELECT COALESCE(SUM(quantity), 0) as "totalBoxes",
                   COALESCE(SUM("amountCollected"), 0) as "totalCollected",
                   COALESCE(SUM("amountDue"), 0) as "totalDue",
                   COUNT(*) as "saleCount"
            FROM sales WHERE "userId" = $1
        `, [userId]);

        // My sales by product
        const myProductBreakdown = await db.getAll(`
            SELECT COALESCE(cp."cookieName", s."cookieType") as "cookieName",
                   cp."shortName", cp."pricePerBox", s."productId",
                   SUM(s.quantity) as "totalQuantity",
                   SUM(s."amountCollected") as "totalCollected"
            FROM sales s
            LEFT JOIN cookie_products cp ON s."productId" = cp.id
            WHERE s."userId" = $1
            GROUP BY COALESCE(cp."cookieName", s."cookieType"), cp."shortName", cp."pricePerBox", s."productId"
            ORDER BY "totalQuantity" DESC
        `, [userId]);

        // My recent sales (last 10)
        const recentSales = await db.getAll(`
            SELECT s.*, cp."cookieName" as "productName", cp."shortName" as "productShortName", cp."pricePerBox" as "productPrice"
            FROM sales s
            LEFT JOIN cookie_products cp ON s."productId" = cp.id
            WHERE s."userId" = $1
            ORDER BY s.date DESC
            LIMIT 10
        `, [userId]);

        // My inventory
        const myInventory = await db.getAll(`
            SELECT si."productId", si.quantity, cp."cookieName", cp."shortName", cp."pricePerBox", cp."sortOrder"
            FROM scout_inventory si
            JOIN cookie_products cp ON si."productId" = cp.id
            WHERE si."userId" = $1
            ORDER BY cp."sortOrder"
        `, [userId]);

        // My goal progress
        const profile = await db.getOne('SELECT "goalBoxes", "goalAmount" FROM profile WHERE "userId" = $1', [userId]);

        // Troop-level data (only if user has view_troop_sales privilege)
        let troopData = null;
        try {
            const scopeFilter = await auth.buildScopeFilter(req.effectiveScope, 's."userId"', req, 1);
            const troopTotals = await db.getOne(`
                SELECT COALESCE(SUM(s.quantity), 0) as "totalBoxes",
                       COALESCE(SUM(s."amountCollected"), 0) as "totalCollected",
                       COUNT(DISTINCT s."userId") as "activeSellers"
                FROM sales s
                JOIN troop_members tm ON s."userId" = tm."userId"
                WHERE tm."troopId" = $1 AND tm.status = 'active'${scopeFilter.clause}
            `, [troopId, ...scopeFilter.params]);

            const troopGoal = await db.getOne(`
                SELECT * FROM troop_goals
                WHERE "troopId" = $1 AND "goalType" = 'boxes_sold' AND status = 'in_progress'
                ORDER BY "endDate" DESC LIMIT 1
            `, [troopId]);

            troopData = { totals: troopTotals, goal: troopGoal };
        } catch (e) { /* user may not have troop sales privilege */ }

        // Troop org info (for dynamic tab naming)
        const troop = await db.getOne(`
            SELECT t.id, so."orgCode", so."orgName"
            FROM troops t
            LEFT JOIN scout_organizations so ON t."organizationId" = so.id
            WHERE t.id = $1
        `, [troopId]);

        res.json({
            orgCode: troop?.orgCode || null,
            orgName: troop?.orgName || null,
            mySales,
            myProductBreakdown,
            recentSales,
            myInventory,
            myGoal: { goalBoxes: profile?.goalBoxes || 0, goalAmount: profile?.goalAmount || 0 },
            troopData
        });
    } catch (error) {
        logger.error('Error fetching cookie dashboard', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch cookie dashboard' });
    }
});

// Troop aggregate inventory (sum of all scout inventories)
app.get('/api/troop/:troopId/inventory', auth.isAuthenticated, auth.requirePrivilege('view_troop_sales'), async (req, res) => {
    try {
        const { troopId } = req.params;
        const inventory = await db.getAll(`
            SELECT si."productId", SUM(si.quantity) as "totalQuantity",
                   COUNT(DISTINCT si."userId") as "scoutCount",
                   cp."cookieName", cp."shortName", cp."pricePerBox", cp."sortOrder"
            FROM scout_inventory si
            JOIN troop_members tm ON si."userId" = tm."userId"
            JOIN cookie_products cp ON si."productId" = cp.id
            WHERE tm."troopId" = $1 AND tm.status = 'active'
            GROUP BY si."productId", cp."cookieName", cp."shortName", cp."pricePerBox", cp."sortOrder"
            ORDER BY cp."sortOrder"
        `, [troopId]);
        res.json(inventory);
    } catch (error) {
        logger.error('Error fetching troop inventory', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch troop inventory' });
    }
});

// ============================================================================
// Phase C: Booth Sales System
// ============================================================================

// --- Booth Events CRUD ---

// List booth events for a troop
app.get('/api/troop/:troopId/booths', auth.isAuthenticated, auth.requirePrivilege('view_events'), async (req, res) => {
    try {
        const { troopId } = req.params;
        const { status: filterStatus } = req.query;

        let query = `
            SELECT be.*,
                   u."firstName" || ' ' || u."lastName" as "createdByName",
                   (SELECT COUNT(*) FROM booth_shifts bs WHERE bs."boothEventId" = be.id) as "shiftCount",
                   (SELECT COALESCE(SUM(bi."soldQty"), 0) FROM booth_inventory bi WHERE bi."boothEventId" = be.id) as "totalSold"
            FROM booth_events be
            LEFT JOIN users u ON be."createdBy" = u.id
            WHERE be."troopId" = $1
        `;
        const params = [troopId];
        if (filterStatus) {
            query += ` AND be.status = $2`;
            params.push(filterStatus);
        }
        query += ' ORDER BY be."startDateTime" DESC';

        const booths = await db.getAll(query, params);
        res.json(booths);
    } catch (error) {
        logger.error('Error fetching booths', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch booth events' });
    }
});

// Get single booth event with full details
app.get('/api/troop/:troopId/booths/:boothId', auth.isAuthenticated, auth.requirePrivilege('view_events'), async (req, res) => {
    try {
        const { troopId, boothId } = req.params;
        const booth = await db.getOne(`
            SELECT be.*,
                   u."firstName" || ' ' || u."lastName" as "createdByName"
            FROM booth_events be
            LEFT JOIN users u ON be."createdBy" = u.id
            WHERE be.id = $1 AND be."troopId" = $2
        `, [boothId, troopId]);
        if (!booth) return res.status(404).json({ error: 'Booth event not found' });

        // Include shifts, inventory, payments
        const shifts = await db.getAll(`
            SELECT bs.*, u."firstName" || ' ' || u."lastName" as "scoutName",
                   p."firstName" || ' ' || p."lastName" as "parentName"
            FROM booth_shifts bs
            JOIN users u ON bs."scoutId" = u.id
            LEFT JOIN users p ON bs."parentId" = p.id
            WHERE bs."boothEventId" = $1
            ORDER BY bs."startTime"
        `, [boothId]);

        const inventory = await db.getAll(`
            SELECT bi.*, cp."cookieName", cp."shortName", cp."pricePerBox"
            FROM booth_inventory bi
            JOIN cookie_products cp ON bi."productId" = cp.id
            WHERE bi."boothEventId" = $1
            ORDER BY cp."sortOrder"
        `, [boothId]);

        const payments = await db.getAll(`
            SELECT bp.*, u."firstName" || ' ' || u."lastName" as "recordedByName"
            FROM booth_payments bp
            LEFT JOIN users u ON bp."recordedBy" = u.id
            WHERE bp."boothEventId" = $1
            ORDER BY bp."recordedAt"
        `, [boothId]);

        res.json({ ...booth, shifts, inventory, payments });
    } catch (error) {
        logger.error('Error fetching booth detail', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch booth event' });
    }
});

// Create booth event
app.post('/api/troop/:troopId/booths', auth.isAuthenticated, auth.requirePrivilege('manage_events'), async (req, res) => {
    try {
        const { troopId } = req.params;
        const { eventType, scoutId, eventName, location, locationAddress, locationNotes,
                startDateTime, endDateTime, startingBank, notes } = req.body;

        if (!eventName || !startDateTime || !endDateTime) {
            return res.status(400).json({ error: 'eventName, startDateTime, and endDateTime are required' });
        }
        if (eventType && !['troop', 'family', 'council'].includes(eventType)) {
            return res.status(400).json({ error: 'Invalid event type' });
        }

        const booth = await db.getOne(`
            INSERT INTO booth_events ("troopId", "eventType", "scoutId", "eventName", location, "locationAddress",
                "locationNotes", "startDateTime", "endDateTime", "startingBank", notes, "createdBy")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *
        `, [troopId, eventType || 'troop', scoutId || null, eventName, location, locationAddress,
            locationNotes, startDateTime, endDateTime, startingBank || 0, notes, req.session.userId]);

        res.status(201).json(booth);
    } catch (error) {
        logger.error('Error creating booth', { error: error.message });
        res.status(500).json({ error: 'Failed to create booth event' });
    }
});

// Update booth event
app.put('/api/troop/:troopId/booths/:boothId', auth.isAuthenticated, auth.requirePrivilege('manage_events'), async (req, res) => {
    try {
        const { troopId, boothId } = req.params;
        const { eventType, eventName, location, locationAddress, locationNotes,
                startDateTime, endDateTime, startingBank, weatherNotes, notes } = req.body;

        const booth = await db.getOne(`
            UPDATE booth_events SET
                "eventType" = COALESCE($1, "eventType"),
                "eventName" = COALESCE($2, "eventName"),
                location = COALESCE($3, location),
                "locationAddress" = COALESCE($4, "locationAddress"),
                "locationNotes" = COALESCE($5, "locationNotes"),
                "startDateTime" = COALESCE($6, "startDateTime"),
                "endDateTime" = COALESCE($7, "endDateTime"),
                "startingBank" = COALESCE($8, "startingBank"),
                "weatherNotes" = COALESCE($9, "weatherNotes"),
                notes = COALESCE($10, notes),
                "updatedAt" = CURRENT_TIMESTAMP
            WHERE id = $11 AND "troopId" = $12
            RETURNING *
        `, [eventType, eventName, location, locationAddress, locationNotes,
            startDateTime, endDateTime, startingBank, weatherNotes, notes, boothId, troopId]);

        if (!booth) return res.status(404).json({ error: 'Booth event not found' });
        res.json(booth);
    } catch (error) {
        logger.error('Error updating booth', { error: error.message });
        res.status(500).json({ error: 'Failed to update booth event' });
    }
});

// Delete booth event
app.delete('/api/troop/:troopId/booths/:boothId', auth.isAuthenticated, auth.requirePrivilege('manage_events'), async (req, res) => {
    try {
        const { troopId, boothId } = req.params;
        const result = await db.run(
            'DELETE FROM booth_events WHERE id = $1 AND "troopId" = $2',
            [boothId, troopId]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: 'Booth event not found' });
        res.json({ message: 'Booth event deleted' });
    } catch (error) {
        logger.error('Error deleting booth', { error: error.message });
        res.status(500).json({ error: 'Failed to delete booth event' });
    }
});

// Booth lifecycle transitions
app.post('/api/troop/:troopId/booths/:boothId/start', auth.isAuthenticated, auth.requirePrivilege('manage_events'), async (req, res) => {
    try {
        const { troopId, boothId } = req.params;
        const booth = await db.getOne(
            'UPDATE booth_events SET status = \'in_progress\', "actualStartTime" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $1 AND "troopId" = $2 AND status IN (\'planning\', \'scheduled\') RETURNING *',
            [boothId, troopId]
        );
        if (!booth) return res.status(400).json({ error: 'Booth not found or cannot be started from current status' });
        res.json(booth);
    } catch (error) {
        logger.error('Error starting booth', { error: error.message });
        res.status(500).json({ error: 'Failed to start booth event' });
    }
});

app.post('/api/troop/:troopId/booths/:boothId/end', auth.isAuthenticated, auth.requirePrivilege('manage_events'), async (req, res) => {
    try {
        const { troopId, boothId } = req.params;
        const booth = await db.getOne(
            'UPDATE booth_events SET status = \'reconciling\', "actualEndTime" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $1 AND "troopId" = $2 AND status = \'in_progress\' RETURNING *',
            [boothId, troopId]
        );
        if (!booth) return res.status(400).json({ error: 'Booth not found or not in progress' });
        res.json(booth);
    } catch (error) {
        logger.error('Error ending booth', { error: error.message });
        res.status(500).json({ error: 'Failed to end booth event' });
    }
});

app.post('/api/troop/:troopId/booths/:boothId/close', auth.isAuthenticated, auth.requirePrivilege('manage_events'), async (req, res) => {
    try {
        const { troopId, boothId } = req.params;
        const booth = await db.getOne(
            'UPDATE booth_events SET status = \'completed\', "updatedAt" = CURRENT_TIMESTAMP WHERE id = $1 AND "troopId" = $2 AND status = \'reconciling\' RETURNING *',
            [boothId, troopId]
        );
        if (!booth) return res.status(400).json({ error: 'Booth not found or not in reconciling status' });
        res.json(booth);
    } catch (error) {
        logger.error('Error closing booth', { error: error.message });
        res.status(500).json({ error: 'Failed to close booth event' });
    }
});

// --- Booth Shifts CRUD ---

app.get('/api/troop/:troopId/booths/:boothId/shifts', auth.isAuthenticated, auth.requirePrivilege('view_events'), async (req, res) => {
    try {
        const { boothId } = req.params;
        const shifts = await db.getAll(`
            SELECT bs.*, u."firstName" || ' ' || u."lastName" as "scoutName",
                   p."firstName" || ' ' || p."lastName" as "parentName"
            FROM booth_shifts bs
            JOIN users u ON bs."scoutId" = u.id
            LEFT JOIN users p ON bs."parentId" = p.id
            WHERE bs."boothEventId" = $1
            ORDER BY bs."startTime"
        `, [boothId]);
        res.json(shifts);
    } catch (error) {
        logger.error('Error fetching shifts', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch shifts' });
    }
});

app.post('/api/troop/:troopId/booths/:boothId/shifts', auth.isAuthenticated, auth.requirePrivilege('manage_events'), async (req, res) => {
    try {
        const { boothId } = req.params;
        const { scoutId, parentId, startTime, endTime, role, notes } = req.body;
        if (!scoutId || !startTime || !endTime) {
            return res.status(400).json({ error: 'scoutId, startTime, and endTime are required' });
        }
        const shift = await db.getOne(`
            INSERT INTO booth_shifts ("boothEventId", "scoutId", "parentId", "startTime", "endTime", role, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
        `, [boothId, scoutId, parentId || null, startTime, endTime, role || 'seller', notes]);
        res.status(201).json(shift);
    } catch (error) {
        logger.error('Error creating shift', { error: error.message });
        res.status(500).json({ error: 'Failed to create shift' });
    }
});

app.put('/api/troop/:troopId/booths/:boothId/shifts/:shiftId', auth.isAuthenticated, auth.requirePrivilege('manage_events'), async (req, res) => {
    try {
        const { shiftId } = req.params;
        const { scoutId, parentId, startTime, endTime, role, status, boxesCredited, notes } = req.body;
        const shift = await db.getOne(`
            UPDATE booth_shifts SET
                "scoutId" = COALESCE($1, "scoutId"),
                "parentId" = COALESCE($2, "parentId"),
                "startTime" = COALESCE($3, "startTime"),
                "endTime" = COALESCE($4, "endTime"),
                role = COALESCE($5, role),
                status = COALESCE($6, status),
                "boxesCredited" = COALESCE($7, "boxesCredited"),
                notes = COALESCE($8, notes)
            WHERE id = $9 RETURNING *
        `, [scoutId, parentId, startTime, endTime, role, status, boxesCredited, notes, shiftId]);
        if (!shift) return res.status(404).json({ error: 'Shift not found' });
        res.json(shift);
    } catch (error) {
        logger.error('Error updating shift', { error: error.message });
        res.status(500).json({ error: 'Failed to update shift' });
    }
});

app.delete('/api/troop/:troopId/booths/:boothId/shifts/:shiftId', auth.isAuthenticated, auth.requirePrivilege('manage_events'), async (req, res) => {
    try {
        const { shiftId } = req.params;
        const result = await db.run('DELETE FROM booth_shifts WHERE id = $1', [shiftId]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Shift not found' });
        res.json({ message: 'Shift deleted' });
    } catch (error) {
        logger.error('Error deleting shift', { error: error.message });
        res.status(500).json({ error: 'Failed to delete shift' });
    }
});

// Shift check-in/check-out
app.post('/api/troop/:troopId/booths/:boothId/shifts/:shiftId/checkin', auth.isAuthenticated, auth.requirePrivilege('manage_events'), async (req, res) => {
    try {
        const { shiftId } = req.params;
        const shift = await db.getOne(
            'UPDATE booth_shifts SET "checkinTime" = CURRENT_TIMESTAMP, status = \'confirmed\' WHERE id = $1 RETURNING *',
            [shiftId]
        );
        if (!shift) return res.status(404).json({ error: 'Shift not found' });
        res.json(shift);
    } catch (error) {
        logger.error('Error checking in', { error: error.message });
        res.status(500).json({ error: 'Failed to check in' });
    }
});

app.post('/api/troop/:troopId/booths/:boothId/shifts/:shiftId/checkout', auth.isAuthenticated, auth.requirePrivilege('manage_events'), async (req, res) => {
    try {
        const { shiftId } = req.params;
        const shift = await db.getOne(
            'UPDATE booth_shifts SET "checkoutTime" = CURRENT_TIMESTAMP, status = \'completed\' WHERE id = $1 RETURNING *',
            [shiftId]
        );
        if (!shift) return res.status(404).json({ error: 'Shift not found' });
        res.json(shift);
    } catch (error) {
        logger.error('Error checking out', { error: error.message });
        res.status(500).json({ error: 'Failed to check out' });
    }
});

// --- Booth Inventory ---

app.get('/api/troop/:troopId/booths/:boothId/inventory', auth.isAuthenticated, auth.requirePrivilege('view_events'), async (req, res) => {
    try {
        const { boothId } = req.params;
        const inventory = await db.getAll(`
            SELECT bi.*, cp."cookieName", cp."shortName", cp."pricePerBox", cp."sortOrder"
            FROM booth_inventory bi
            JOIN cookie_products cp ON bi."productId" = cp.id
            WHERE bi."boothEventId" = $1
            ORDER BY cp."sortOrder"
        `, [boothId]);
        res.json(inventory);
    } catch (error) {
        logger.error('Error fetching booth inventory', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch booth inventory' });
    }
});

// Set/update booth inventory (bulk upsert)
app.put('/api/troop/:troopId/booths/:boothId/inventory', auth.isAuthenticated, auth.requirePrivilege('manage_events'), async (req, res) => {
    try {
        const { boothId } = req.params;
        const { items } = req.body; // [{productId, startingQty, endingQty, damagedQty, notes}]
        if (!items || !Array.isArray(items)) {
            return res.status(400).json({ error: 'items array is required' });
        }

        const results = [];
        for (const item of items) {
            const row = await db.getOne(`
                INSERT INTO booth_inventory ("boothEventId", "productId", "startingQty", "endingQty", "damagedQty", notes)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT ("boothEventId", "productId") DO UPDATE SET
                    "startingQty" = COALESCE(EXCLUDED."startingQty", booth_inventory."startingQty"),
                    "endingQty" = COALESCE(EXCLUDED."endingQty", booth_inventory."endingQty"),
                    "damagedQty" = COALESCE(EXCLUDED."damagedQty", booth_inventory."damagedQty"),
                    notes = COALESCE(EXCLUDED.notes, booth_inventory.notes)
                RETURNING *
            `, [boothId, item.productId, item.startingQty || 0, item.endingQty ?? null, item.damagedQty || 0, item.notes]);
            results.push(row);
        }
        res.json(results);
    } catch (error) {
        logger.error('Error updating booth inventory', { error: error.message });
        res.status(500).json({ error: 'Failed to update booth inventory' });
    }
});

// Record ending count and auto-calculate soldQty
app.post('/api/troop/:troopId/booths/:boothId/inventory/count', auth.isAuthenticated, auth.requirePrivilege('manage_events'), async (req, res) => {
    try {
        const { boothId } = req.params;
        const { items } = req.body; // [{productId, endingQty, damagedQty}]
        if (!items || !Array.isArray(items)) {
            return res.status(400).json({ error: 'items array is required' });
        }

        const results = [];
        for (const item of items) {
            const row = await db.getOne(`
                UPDATE booth_inventory SET
                    "endingQty" = $1,
                    "damagedQty" = COALESCE($2, "damagedQty"),
                    "soldQty" = "startingQty" - $1 - COALESCE($2, "damagedQty", 0)
                WHERE "boothEventId" = $3 AND "productId" = $4
                RETURNING *
            `, [item.endingQty, item.damagedQty || 0, boothId, item.productId]);
            if (row) results.push(row);
        }
        res.json(results);
    } catch (error) {
        logger.error('Error recording inventory count', { error: error.message });
        res.status(500).json({ error: 'Failed to record inventory count' });
    }
});

// --- Booth Payments ---

app.get('/api/troop/:troopId/booths/:boothId/payments', auth.isAuthenticated, auth.requirePrivilege('view_events'), async (req, res) => {
    try {
        const { boothId } = req.params;
        const payments = await db.getAll(`
            SELECT bp.*, u."firstName" || ' ' || u."lastName" as "recordedByName"
            FROM booth_payments bp
            LEFT JOIN users u ON bp."recordedBy" = u.id
            WHERE bp."boothEventId" = $1
            ORDER BY bp."recordedAt"
        `, [boothId]);
        res.json(payments);
    } catch (error) {
        logger.error('Error fetching payments', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch payments' });
    }
});

app.post('/api/troop/:troopId/booths/:boothId/payments', auth.isAuthenticated, auth.requirePrivilege('manage_events'), async (req, res) => {
    try {
        const { boothId } = req.params;
        const { paymentType, amount, referenceNumber, notes } = req.body;
        if (!paymentType || amount === undefined) {
            return res.status(400).json({ error: 'paymentType and amount are required' });
        }
        const validTypes = ['cash', 'check', 'digital_cookie', 'venmo', 'paypal', 'square', 'zelle', 'other'];
        if (!validTypes.includes(paymentType)) {
            return res.status(400).json({ error: `Invalid payment type. Must be one of: ${validTypes.join(', ')}` });
        }
        const payment = await db.getOne(`
            INSERT INTO booth_payments ("boothEventId", "paymentType", amount, "referenceNumber", notes, "recordedBy")
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
        `, [boothId, paymentType, amount, referenceNumber, notes, req.session.userId]);
        res.status(201).json(payment);
    } catch (error) {
        logger.error('Error creating payment', { error: error.message });
        res.status(500).json({ error: 'Failed to create payment' });
    }
});

app.put('/api/troop/:troopId/booths/:boothId/payments/:paymentId', auth.isAuthenticated, auth.requirePrivilege('manage_events'), async (req, res) => {
    try {
        const { paymentId } = req.params;
        const { paymentType, amount, referenceNumber, notes } = req.body;
        const payment = await db.getOne(`
            UPDATE booth_payments SET
                "paymentType" = COALESCE($1, "paymentType"),
                amount = COALESCE($2, amount),
                "referenceNumber" = COALESCE($3, "referenceNumber"),
                notes = COALESCE($4, notes)
            WHERE id = $5 RETURNING *
        `, [paymentType, amount, referenceNumber, notes, paymentId]);
        if (!payment) return res.status(404).json({ error: 'Payment not found' });
        res.json(payment);
    } catch (error) {
        logger.error('Error updating payment', { error: error.message });
        res.status(500).json({ error: 'Failed to update payment' });
    }
});

app.delete('/api/troop/:troopId/booths/:boothId/payments/:paymentId', auth.isAuthenticated, auth.requirePrivilege('manage_events'), async (req, res) => {
    try {
        const { paymentId } = req.params;
        const result = await db.run('DELETE FROM booth_payments WHERE id = $1', [paymentId]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Payment not found' });
        res.json({ message: 'Payment deleted' });
    } catch (error) {
        logger.error('Error deleting payment', { error: error.message });
        res.status(500).json({ error: 'Failed to delete payment' });
    }
});

// Booth reconciliation summary
app.get('/api/troop/:troopId/booths/:boothId/reconcile', auth.isAuthenticated, auth.requirePrivilege('view_events'), async (req, res) => {
    try {
        const { boothId } = req.params;

        // Get booth info
        const booth = await db.getOne('SELECT * FROM booth_events WHERE id = $1', [boothId]);
        if (!booth) return res.status(404).json({ error: 'Booth event not found' });

        // Get inventory totals
        const inventoryTotals = await db.getOne(`
            SELECT COALESCE(SUM("startingQty"), 0) as "totalStarting",
                   COALESCE(SUM("endingQty"), 0) as "totalEnding",
                   COALESCE(SUM("soldQty"), 0) as "totalSold",
                   COALESCE(SUM("damagedQty"), 0) as "totalDamaged"
            FROM booth_inventory WHERE "boothEventId" = $1
        `, [boothId]);

        // Get detailed inventory per product
        const inventoryDetail = await db.getAll(`
            SELECT bi.*, cp."cookieName", cp."shortName", cp."pricePerBox"
            FROM booth_inventory bi
            JOIN cookie_products cp ON bi."productId" = cp.id
            WHERE bi."boothEventId" = $1
            ORDER BY cp."sortOrder"
        `, [boothId]);

        // Calculate expected revenue from inventory
        let expectedRevenue = 0;
        for (const item of inventoryDetail) {
            expectedRevenue += (item.soldQty || 0) * parseFloat(item.pricePerBox || 0);
        }

        // Get payment totals
        const paymentTotals = await db.getOne(`
            SELECT COALESCE(SUM(amount), 0) as "totalCollected",
                   COALESCE(SUM(CASE WHEN "paymentType" = 'cash' THEN amount ELSE 0 END), 0) as "totalCash",
                   COALESCE(SUM(CASE WHEN "paymentType" = 'check' THEN amount ELSE 0 END), 0) as "totalChecks",
                   COALESCE(SUM(CASE WHEN "paymentType" NOT IN ('cash', 'check') THEN amount ELSE 0 END), 0) as "totalDigital"
            FROM booth_payments WHERE "boothEventId" = $1
        `, [boothId]);

        const actualRevenue = parseFloat(paymentTotals.totalCollected) - parseFloat(booth.startingBank || 0);
        const variance = actualRevenue - expectedRevenue;

        res.json({
            booth: { id: booth.id, eventName: booth.eventName, status: booth.status, startingBank: booth.startingBank },
            inventory: {
                ...inventoryTotals,
                detail: inventoryDetail,
                expectedRevenue
            },
            payments: {
                ...paymentTotals,
                startingBank: booth.startingBank,
                actualRevenue
            },
            reconciliation: {
                expectedRevenue,
                actualRevenue,
                variance,
                status: Math.abs(variance) < 0.01 ? 'balanced' : variance > 0 ? 'overage' : 'shortage'
            }
        });
    } catch (error) {
        logger.error('Error reconciling booth', { error: error.message });
        res.status(500).json({ error: 'Failed to reconcile booth' });
    }
});

// ============================================================================
// Phase D: Troop Proceeds & Season Management
// ============================================================================

// Get troop season config
app.get('/api/troop/:troopId/season-config', auth.isAuthenticated, auth.requirePrivilege('view_financials'), async (req, res) => {
    try {
        const { troopId } = req.params;
        const season = await db.getOne('SELECT * FROM seasons WHERE "isActive" = true');
        const targetSeason = season?.year || '2026';

        let config = await db.getOne(
            'SELECT * FROM troop_season_config WHERE "troopId" = $1 AND season = $2',
            [troopId, targetSeason]
        );

        // Auto-create default config if none exists
        if (!config) {
            config = await db.getOne(`
                INSERT INTO troop_season_config ("troopId", season)
                VALUES ($1, $2) RETURNING *
            `, [troopId, targetSeason]);
        }

        res.json(config);
    } catch (error) {
        logger.error('Error fetching season config', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch season config' });
    }
});

// Update troop season config
app.put('/api/troop/:troopId/season-config', auth.isAuthenticated, auth.requirePrivilege('manage_financials'), async (req, res) => {
    try {
        const { troopId } = req.params;
        const { baseProceedsRate, initialOrderBonus, fallProductBonus, optOutBonus,
                initialOrderDate, initialOrderQty, notes } = req.body;

        const season = await db.getOne('SELECT * FROM seasons WHERE "isActive" = true');
        const targetSeason = season?.year || '2026';

        // Calculate effective rate
        let effectiveRate = parseFloat(baseProceedsRate || 0.75);
        if (initialOrderBonus) effectiveRate += 0.10;
        if (fallProductBonus) effectiveRate += 0.10;
        if (optOutBonus) effectiveRate += 0.10;

        const config = await db.getOne(`
            INSERT INTO troop_season_config ("troopId", season, "baseProceedsRate", "initialOrderBonus",
                "fallProductBonus", "optOutBonus", "effectiveProceedsRate", "initialOrderDate", "initialOrderQty", notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT ("troopId", season) DO UPDATE SET
                "baseProceedsRate" = EXCLUDED."baseProceedsRate",
                "initialOrderBonus" = EXCLUDED."initialOrderBonus",
                "fallProductBonus" = EXCLUDED."fallProductBonus",
                "optOutBonus" = EXCLUDED."optOutBonus",
                "effectiveProceedsRate" = EXCLUDED."effectiveProceedsRate",
                "initialOrderDate" = EXCLUDED."initialOrderDate",
                "initialOrderQty" = EXCLUDED."initialOrderQty",
                notes = EXCLUDED.notes
            RETURNING *
        `, [troopId, targetSeason, baseProceedsRate || 0.75, !!initialOrderBonus,
            !!fallProductBonus, !!optOutBonus, effectiveRate,
            initialOrderDate || null, initialOrderQty || null, notes]);

        res.json(config);
    } catch (error) {
        logger.error('Error updating season config', { error: error.message });
        res.status(500).json({ error: 'Failed to update season config' });
    }
});

// Calculate troop proceeds
app.get('/api/troop/:troopId/proceeds', auth.isAuthenticated, auth.requirePrivilege('view_financials'), async (req, res) => {
    try {
        const { troopId } = req.params;
        const season = await db.getOne('SELECT * FROM seasons WHERE "isActive" = true');
        const targetSeason = season?.year || '2026';

        // Get season config
        const config = await db.getOne(
            'SELECT * FROM troop_season_config WHERE "troopId" = $1 AND season = $2',
            [troopId, targetSeason]
        );
        const effectiveRate = parseFloat(config?.effectiveProceedsRate || 0.75);

        // Get total boxes sold by troop
        const totals = await db.getOne(`
            SELECT COALESCE(SUM(s.quantity), 0) as "totalBoxes",
                   COALESCE(SUM(s."amountCollected"), 0) as "totalRevenue"
            FROM sales s
            JOIN troop_members tm ON s."userId" = tm."userId"
            WHERE tm."troopId" = $1 AND tm.status = 'active'
        `, [troopId]);

        const totalBoxes = parseInt(totals.totalBoxes);
        const totalProceeds = totalBoxes * effectiveRate;

        res.json({
            season: targetSeason,
            effectiveRate,
            totalBoxes,
            totalRevenue: parseFloat(totals.totalRevenue),
            totalProceeds,
            bonuses: {
                initialOrder: config?.initialOrderBonus || false,
                fallProduct: config?.fallProductBonus || false,
                optOut: config?.optOutBonus || false
            }
        });
    } catch (error) {
        logger.error('Error calculating proceeds', { error: error.message });
        res.status(500).json({ error: 'Failed to calculate proceeds' });
    }
});

// --- Season Milestones ---

app.get('/api/troop/:troopId/milestones', auth.isAuthenticated, auth.requirePrivilege('view_events'), async (req, res) => {
    try {
        const { troopId } = req.params;
        const season = await db.getOne('SELECT * FROM seasons WHERE "isActive" = true');
        const targetSeason = season?.year || '2026';

        const milestones = await db.getAll(
            'SELECT * FROM season_milestones WHERE "troopId" = $1 AND season = $2 ORDER BY "milestoneDate", "sortOrder"',
            [troopId, targetSeason]
        );
        res.json(milestones);
    } catch (error) {
        logger.error('Error fetching milestones', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch milestones' });
    }
});

app.post('/api/troop/:troopId/milestones', auth.isAuthenticated, auth.requirePrivilege('manage_events'), async (req, res) => {
    try {
        const { troopId } = req.params;
        const { milestoneName, milestoneDate, description, sortOrder } = req.body;
        if (!milestoneName) return res.status(400).json({ error: 'milestoneName is required' });

        const season = await db.getOne('SELECT * FROM seasons WHERE "isActive" = true');
        const targetSeason = season?.year || '2026';

        const milestone = await db.getOne(`
            INSERT INTO season_milestones ("troopId", season, "milestoneName", "milestoneDate", description, "sortOrder")
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
        `, [troopId, targetSeason, milestoneName, milestoneDate || null, description, sortOrder || 0]);
        res.status(201).json(milestone);
    } catch (error) {
        logger.error('Error creating milestone', { error: error.message });
        res.status(500).json({ error: 'Failed to create milestone' });
    }
});

app.put('/api/troop/:troopId/milestones/:milestoneId', auth.isAuthenticated, auth.requirePrivilege('manage_events'), async (req, res) => {
    try {
        const { milestoneId } = req.params;
        const { milestoneName, milestoneDate, description, sortOrder } = req.body;
        const milestone = await db.getOne(`
            UPDATE season_milestones SET
                "milestoneName" = COALESCE($1, "milestoneName"),
                "milestoneDate" = COALESCE($2, "milestoneDate"),
                description = COALESCE($3, description),
                "sortOrder" = COALESCE($4, "sortOrder")
            WHERE id = $5 RETURNING *
        `, [milestoneName, milestoneDate, description, sortOrder, milestoneId]);
        if (!milestone) return res.status(404).json({ error: 'Milestone not found' });
        res.json(milestone);
    } catch (error) {
        logger.error('Error updating milestone', { error: error.message });
        res.status(500).json({ error: 'Failed to update milestone' });
    }
});

app.delete('/api/troop/:troopId/milestones/:milestoneId', auth.isAuthenticated, auth.requirePrivilege('manage_events'), async (req, res) => {
    try {
        const { milestoneId } = req.params;
        const result = await db.run('DELETE FROM season_milestones WHERE id = $1', [milestoneId]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Milestone not found' });
        res.json({ message: 'Milestone deleted' });
    } catch (error) {
        logger.error('Error deleting milestone', { error: error.message });
        res.status(500).json({ error: 'Failed to delete milestone' });
    }
});

// ============================================================================
// Phase 3: Enhanced Troop Goal Routes
// ============================================================================

// Update troop goal
app.put('/api/troop/:troopId/goals/:goalId', auth.isAuthenticated, auth.requirePrivilege('manage_goals'), async (req, res) => {
    try {
        const { troopId, goalId } = req.params;
        const { targetAmount, startDate, endDate, status, description } = req.body;

        // Check goal exists
        const goal = await db.getOne('SELECT * FROM troop_goals WHERE id = $1 AND "troopId" = $2', [goalId, troopId]);
        if (!goal) {
            return res.status(404).json({ error: 'Goal not found' });
        }

        await db.run(`
            UPDATE troop_goals SET
                "targetAmount" = COALESCE($1, "targetAmount"),
                "startDate" = COALESCE($2, "startDate"),
                "endDate" = COALESCE($3, "endDate"),
                status = COALESCE($4, status),
                description = COALESCE($5, description),
                "updatedAt" = NOW()
            WHERE id = $6
        `, [targetAmount, startDate, endDate, status, description, goalId]);

        const updatedGoal = await db.getOne('SELECT * FROM troop_goals WHERE id = $1', [goalId]);
        logger.info('Troop goal updated', { goalId, troopId });
        res.json(updatedGoal);
    } catch (error) {
        logger.error('Error updating troop goal', { error: error.message });
        res.status(500).json({ error: 'Failed to update goal' });
    }
});

// Delete troop goal
app.delete('/api/troop/:troopId/goals/:goalId', auth.isAuthenticated, auth.requirePrivilege('manage_goals'), async (req, res) => {
    try {
        const { troopId, goalId } = req.params;

        const result = await db.run('DELETE FROM troop_goals WHERE id = $1 AND "troopId" = $2', [goalId, troopId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Goal not found' });
        }

        logger.info('Troop goal deleted', { goalId, troopId });
        res.json({ success: true });
    } catch (error) {
        logger.error('Error deleting troop goal', { error: error.message });
        res.status(500).json({ error: 'Failed to delete goal' });
    }
});

// Get troop goal progress
app.get('/api/troop/:troopId/goals/progress', auth.isAuthenticated, auth.requirePrivilege('view_goals'), async (req, res) => {
    try {
        const { troopId } = req.params;

        const goals = await db.getAll('SELECT * FROM troop_goals WHERE "troopId" = $1', [troopId]);

        // Calculate actual amounts for each goal
        const goalsWithProgress = await Promise.all(goals.map(async (goal) => {
            let actualAmount = 0;

            switch (goal.goalType) {
                case 'boxes_sold':
                case 'total_boxes':
                    const boxesResult = await db.getOne(`
                        SELECT COALESCE(SUM(CASE WHEN s."unitType" = 'case' THEN s.quantity * 12 ELSE s.quantity END), 0) as total
                        FROM sales s
                        JOIN troop_members tm ON s."userId" = tm."userId"
                        WHERE tm."troopId" = $1 AND tm.status = 'active'
                        AND s.date BETWEEN $2 AND $3
                    `, [troopId, goal.startDate, goal.endDate]);
                    actualAmount = Number(boxesResult?.total || 0);
                    break;

                case 'revenue':
                case 'total_revenue':
                    const revenueResult = await db.getOne(`
                        SELECT COALESCE(SUM(s."amountCollected"), 0) as total
                        FROM sales s
                        JOIN troop_members tm ON s."userId" = tm."userId"
                        WHERE tm."troopId" = $1 AND tm.status = 'active'
                        AND s.date BETWEEN $2 AND $3
                    `, [troopId, goal.startDate, goal.endDate]);
                    actualAmount = Number(revenueResult?.total || 0);
                    break;

                case 'participation':
                    const totalMembers = await db.getOne(`
                        SELECT COUNT(*) as count FROM troop_members WHERE "troopId" = $1 AND status = 'active'
                    `, [troopId]);
                    const activeMembers = await db.getOne(`
                        SELECT COUNT(DISTINCT tm."userId") as count
                        FROM troop_members tm
                        JOIN sales s ON s."userId" = tm."userId"
                        WHERE tm."troopId" = $1 AND tm.status = 'active'
                        AND s.date BETWEEN $2 AND $3
                    `, [troopId, goal.startDate, goal.endDate]);
                    actualAmount = Number(totalMembers?.count || 0) > 0
                        ? Math.round((Number(activeMembers?.count || 0) / Number(totalMembers.count)) * 100)
                        : 0;
                    break;

                case 'events':
                case 'event_count':
                    const eventsResult = await db.getOne(`
                        SELECT COUNT(*) as count FROM events
                        WHERE "troopId" = $1 AND "eventDate" BETWEEN $2 AND $3
                    `, [troopId, goal.startDate, goal.endDate]);
                    actualAmount = Number(eventsResult?.count || 0);
                    break;

                case 'donations':
                    const donationsResult = await db.getOne(`
                        SELECT COALESCE(SUM(d.amount), 0) as total
                        FROM donations d
                        JOIN troop_members tm ON d."userId" = tm."userId"
                        WHERE tm."troopId" = $1 AND tm.status = 'active'
                        AND d.date BETWEEN $2 AND $3
                    `, [troopId, goal.startDate, goal.endDate]);
                    actualAmount = Number(donationsResult?.total || 0);
                    break;
            }

            const progress = goal.targetAmount > 0 ? Math.min((actualAmount / goal.targetAmount) * 100, 100) : 0;

            return {
                ...goal,
                actualAmount,
                progress: Math.round(progress * 10) / 10
            };
        }));

        res.json(goalsWithProgress);
    } catch (error) {
        logger.error('Error fetching goal progress', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch goal progress' });
    }
});

// ============================================================================
// Phase 3: Leaderboard Route
// ============================================================================

app.get('/api/troop/:troopId/leaderboard', auth.isAuthenticated, auth.requirePrivilege('view_leaderboard'), async (req, res) => {
    try {
        const { troopId } = req.params;
        const { limit = 10, metric = 'boxes' } = req.query;

        const orderBy = metric === 'revenue' ? '"totalRevenue"' : '"totalBoxes"';

        // Build scope filter for leaderboard visibility
        const scopeFilter = await auth.buildScopeFilter(req.effectiveScope, 'u.id', req, 2);

        const leaderboard = await db.getAll(`
            SELECT
                u.id, u."firstName", u."lastName", u."photoUrl",
                COALESCE(SUM(CASE WHEN s."unitType" = 'case' THEN s.quantity * 12 ELSE s.quantity END), 0) as "totalBoxes",
                COALESCE(SUM(s."amountCollected"), 0) as "totalRevenue"
            FROM troop_members tm
            JOIN users u ON tm."userId" = u.id
            LEFT JOIN sales s ON s."userId" = u.id
            WHERE tm."troopId" = $1 AND tm.status = 'active'${scopeFilter.clause}
            GROUP BY u.id, u."firstName", u."lastName", u."photoUrl"
            ORDER BY ${orderBy} DESC
            LIMIT $2
        `, [troopId, parseInt(limit), ...scopeFilter.params]);

        // Add rank
        const rankedLeaderboard = leaderboard.map((member, index) => ({
            ...member,
            rank: index + 1
        }));

        res.json(rankedLeaderboard);
    } catch (error) {
        logger.error('Error fetching leaderboard', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

// ============================================================================
// Phase 3: Member Role Update Route
// ============================================================================

app.put('/api/troop/:troopId/members/:userId', auth.isAuthenticated, auth.requirePrivilege('manage_member_roles'), async (req, res) => {
    try {
        const { troopId, userId } = req.params;
        const { role, linkedScoutId, notes } = req.body;

        // Verify target member is within scope
        const inScope = await auth.isTargetInScope(req, userId);
        if (!inScope) {
            return res.status(403).json({ error: 'Target member is outside your access scope' });
        }

        // Check member exists
        const member = await db.getOne('SELECT * FROM troop_members WHERE "troopId" = $1 AND "userId" = $2', [troopId, userId]);
        if (!member) {
            return res.status(404).json({ error: 'Member not found' });
        }

        // Validate role if provided
        const validRoles = ['member', 'scout', 'parent', 'co-leader', 'assistant', 'cookie_leader'];
        if (role && !validRoles.includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        await db.run(`
            UPDATE troop_members SET
                role = COALESCE($1, role),
                "linkedScoutId" = COALESCE($2, "linkedScoutId"),
                notes = COALESCE($3, notes)
            WHERE "troopId" = $4 AND "userId" = $5
        `, [role, linkedScoutId, notes, troopId, userId]);

        const updatedMember = await db.getOne(`
            SELECT tm.*, u."firstName", u."lastName", u.email
            FROM troop_members tm
            JOIN users u ON tm."userId" = u.id
            WHERE tm."troopId" = $1 AND tm."userId" = $2
        `, [troopId, userId]);

        logger.info('Troop member updated', { troopId, userId });
        res.json(updatedMember);
    } catch (error) {
        logger.error('Error updating troop member', { error: error.message });
        res.status(500).json({ error: 'Failed to update member' });
    }
});

// ============================================================================
// Phase 3: Invitation System Routes
// ============================================================================

// Send invitation
app.post('/api/troop/:troopId/invite', auth.isAuthenticated, auth.requirePrivilege('send_invitations'), async (req, res) => {
    try {
        const { troopId } = req.params;
        const { email, role } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const troop = await db.getOne('SELECT * FROM troops WHERE id = $1', [troopId]);
        if (!troop) {
            return res.status(404).json({ error: 'Troop not found' });
        }

        // Check if user exists
        const user = await db.getOne('SELECT id FROM users WHERE email = $1', [email]);

        // Check for existing pending invitation
        const existingInvite = await db.getOne(`
            SELECT id FROM troop_invitations
            WHERE "troopId" = $1 AND "invitedEmail" = $2 AND status = 'pending'
        `, [troopId, email]);

        if (existingInvite) {
            return res.status(409).json({ error: 'Pending invitation already exists for this email' });
        }

        // Generate unique token
        const token = require('crypto').randomBytes(32).toString('hex');

        // Set expiry (7 days)
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        // Validate role
        const validRoles = ['member', 'scout', 'parent', 'co-leader', 'assistant', 'cookie_leader'];
        const inviteRole = validRoles.includes(role) ? role : 'member';

        // Create invitation
        const newInvite = await db.getOne(`
            INSERT INTO troop_invitations ("troopId", "invitedEmail", "invitedUserId", "invitedRole", "invitedBy", token, "expiresAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
        `, [troopId, email.toLowerCase(), user?.id || null, inviteRole, req.session.userId, token, expiresAt]);

        // Create notification for user if they exist
        if (user) {
            auth.createNotification(
                db,
                user.id,
                'info',
                'Troop Invitation',
                `You've been invited to join Troop ${troop.troopNumber} as a ${inviteRole}.`,
                `/invitations`
            );
        }

        logger.info('Invitation sent', { troopId, email, invitedBy: req.session.userId });
        res.status(201).json({
            success: true,
            message: user ? 'Invitation sent to existing user' : 'Invitation sent (user will receive it after registration)',
            invitationId: newInvite.id
        });
    } catch (error) {
        logger.error('Error sending invitation', { error: error.message });
        res.status(500).json({ error: 'Failed to send invitation' });
    }
});

// Get user's pending invitations
app.get('/api/invitations', auth.isAuthenticated, async (req, res) => {
    try {
        const user = await db.getOne('SELECT email FROM users WHERE id = $1', [req.session.userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const invitations = await db.getAll(`
            SELECT ti.*, t."troopNumber", t."troopType", t."troopName",
                   u."firstName" as "inviterFirstName", u."lastName" as "inviterLastName"
            FROM troop_invitations ti
            JOIN troops t ON ti."troopId" = t.id
            JOIN users u ON ti."invitedBy" = u.id
            WHERE (ti."invitedUserId" = $1 OR LOWER(ti."invitedEmail") = LOWER($2))
            AND ti.status = 'pending'
            AND ti."expiresAt" > NOW()
            ORDER BY ti."createdAt" DESC
        `, [req.session.userId, user.email]);

        res.json(invitations);
    } catch (error) {
        logger.error('Error fetching invitations', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch invitations' });
    }
});

// Accept invitation
app.post('/api/invitations/:id/accept', auth.isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;

        const user = await db.getOne('SELECT id, email FROM users WHERE id = $1', [req.session.userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get invitation
        const invitation = await db.getOne(`
            SELECT * FROM troop_invitations WHERE id = $1
        `, [id]);

        if (!invitation) {
            return res.status(404).json({ error: 'Invitation not found' });
        }

        // Verify invitation belongs to user
        if (invitation.invitedUserId !== user.id && invitation.invitedEmail.toLowerCase() !== user.email.toLowerCase()) {
            return res.status(403).json({ error: 'This invitation is not for you' });
        }

        // Check if expired
        if (new Date(invitation.expiresAt) < new Date()) {
            await db.run('UPDATE troop_invitations SET status = $1 WHERE id = $2', ['expired', id]);
            return res.status(410).json({ error: 'Invitation has expired' });
        }

        // Check if already a member
        const existingMember = await db.getOne(`
            SELECT id FROM troop_members WHERE "troopId" = $1 AND "userId" = $2 AND status = 'active'
        `, [invitation.troopId, user.id]);

        if (existingMember) {
            return res.status(409).json({ error: 'You are already a member of this troop' });
        }

        // Add to troop
        await db.run(`
            INSERT INTO troop_members ("troopId", "userId", role, status, "joinDate")
            VALUES ($1, $2, $3, 'active', NOW())
            ON CONFLICT ("troopId", "userId") DO UPDATE SET status = 'active', role = $3, "joinDate" = NOW()
        `, [invitation.troopId, user.id, invitation.invitedRole]);

        // Update invitation status
        await db.run(`
            UPDATE troop_invitations SET status = 'accepted', "respondedAt" = NOW()
            WHERE id = $1
        `, [id]);

        // Notify troop leader
        const troop = await db.getOne('SELECT * FROM troops WHERE id = $1', [invitation.troopId]);
        if (troop?.leaderId) {
            auth.createNotification(
                db,
                troop.leaderId,
                'success',
                'Invitation Accepted',
                `${user.email} has joined Troop ${troop.troopNumber}.`
            );
        }

        logger.info('Invitation accepted', { invitationId: id, userId: user.id, troopId: invitation.troopId });
        res.json({ success: true, message: 'You have joined the troop!' });
    } catch (error) {
        logger.error('Error accepting invitation', { error: error.message });
        res.status(500).json({ error: 'Failed to accept invitation' });
    }
});

// Decline invitation
app.post('/api/invitations/:id/decline', auth.isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;

        const user = await db.getOne('SELECT id, email FROM users WHERE id = $1', [req.session.userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get invitation
        const invitation = await db.getOne('SELECT * FROM troop_invitations WHERE id = $1', [id]);

        if (!invitation) {
            return res.status(404).json({ error: 'Invitation not found' });
        }

        // Verify invitation belongs to user
        if (invitation.invitedUserId !== user.id && invitation.invitedEmail.toLowerCase() !== user.email.toLowerCase()) {
            return res.status(403).json({ error: 'This invitation is not for you' });
        }

        // Update invitation status
        await db.run(`
            UPDATE troop_invitations SET status = 'declined', "respondedAt" = NOW()
            WHERE id = $1
        `, [id]);

        logger.info('Invitation declined', { invitationId: id, userId: user.id });
        res.json({ success: true });
    } catch (error) {
        logger.error('Error declining invitation', { error: error.message });
        res.status(500).json({ error: 'Failed to decline invitation' });
    }
});

// ============================================================================
// Phase 3: Roster Bulk Import Route
// ============================================================================

app.post('/api/troop/:troopId/roster/import', auth.isAuthenticated, auth.requirePrivilege('import_roster'), upload.single('file'), async (req, res) => {
    try {
        const { troopId } = req.params;

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Parse CSV
        const csvContent = req.file.buffer.toString('utf-8');
        const lines = csvContent.split('\n').filter(line => line.trim());

        if (lines.length < 2) {
            return res.status(400).json({ error: 'CSV file must have at least a header and one data row' });
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

        // Validate required headers
        const requiredHeaders = ['firstname', 'lastname', 'email'];
        for (const required of requiredHeaders) {
            if (!headers.includes(required)) {
                return res.status(400).json({ error: `Missing required column: ${required}` });
            }
        }

        const results = { created: 0, skipped: 0, errors: [] };

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const row = {};
            headers.forEach((header, idx) => {
                row[header] = values[idx] || '';
            });

            try {
                // Check if user already exists
                let user = await db.getOne('SELECT id FROM users WHERE email = $1', [row.email]);

                if (!user) {
                    // Create user
                    const isMinorValue = row.dateofbirth ? auth.isMinor(row.dateofbirth) : false;
                    const tempPassword = require('crypto').randomBytes(16).toString('hex');
                    const passwordHash = await auth.hashPassword(tempPassword);

                    user = await db.getOne(`
                        INSERT INTO users (email, password_hash, "firstName", "lastName", "dateOfBirth", "isMinor", "parentEmail", role, "isActive", "emailVerified")
                        VALUES ($1, $2, $3, $4, $5, $6, $7, 'scout', true, false)
                        RETURNING id
                    `, [
                        row.email,
                        passwordHash,
                        row.firstname,
                        row.lastname,
                        row.dateofbirth || null,
                        isMinorValue,
                        row.parentemail || null
                    ]);

                    // Create profile
                    await db.run(`
                        INSERT INTO profile ("userId", "scoutName", email)
                        VALUES ($1, $2, $3)
                    `, [user.id, `${row.firstname} ${row.lastname}`.trim(), row.email]);
                }

                // Check if already member
                const existingMember = await db.getOne(`
                    SELECT id FROM troop_members WHERE "troopId" = $1 AND "userId" = $2
                `, [troopId, user.id]);

                if (existingMember) {
                    results.skipped++;
                } else {
                    // Add to troop
                    await db.run(`
                        INSERT INTO troop_members ("troopId", "userId", role, status, "joinDate")
                        VALUES ($1, $2, 'member', 'active', NOW())
                    `, [troopId, user.id]);

                    results.created++;
                }

                // Handle parent linking if parent email provided
                if (row.parentemail && row.parentfirstname && row.parentlastname) {
                    let parent = await db.getOne('SELECT id FROM users WHERE email = $1', [row.parentemail]);

                    if (!parent) {
                        const tempPassword = require('crypto').randomBytes(16).toString('hex');
                        const passwordHash = await auth.hashPassword(tempPassword);

                        parent = await db.getOne(`
                            INSERT INTO users (email, password_hash, "firstName", "lastName", role, "isActive", "emailVerified")
                            VALUES ($1, $2, $3, $4, 'parent', true, false)
                            RETURNING id
                        `, [row.parentemail, passwordHash, row.parentfirstname, row.parentlastname]);
                    }

                    // Add parent to troop with linkedScoutId
                    const existingParentMember = await db.getOne(`
                        SELECT id FROM troop_members WHERE "troopId" = $1 AND "userId" = $2
                    `, [troopId, parent.id]);

                    if (!existingParentMember) {
                        await db.run(`
                            INSERT INTO troop_members ("troopId", "userId", role, "linkedScoutId", status, "joinDate")
                            VALUES ($1, $2, 'parent', $3, 'active', NOW())
                        `, [troopId, parent.id, user.id]);
                    }
                }

            } catch (rowError) {
                results.errors.push({ row: i + 1, error: rowError.message });
            }
        }

        logger.info('Roster import completed', { troopId, ...results });
        res.json(results);
    } catch (error) {
        logger.error('Error importing roster', { error: error.message });
        res.status(500).json({ error: 'Failed to import roster' });
    }
});

// ==============================================
// PHASE 3.1: SCOUT PROFILE MANAGEMENT ENDPOINTS
// ==============================================

// GET /api/organizations
// List all scout organizations
app.get('/api/organizations', auth.isAuthenticated, async (req, res) => {
    try {
        const organizations = await db.getAll(`
            SELECT * FROM scout_organizations
            WHERE "isActive" = $1
            ORDER BY "orgName"
        `, [true]);

        logger.info('Organizations fetched', { count: organizations.length, userId: req.session.userId });
        res.json(organizations);
    } catch (error) {
        logger.error('Error fetching organizations', { error: error.message, userId: req.session.userId });
        res.status(500).json({ error: 'Failed to fetch organizations' });
    }
});

// GET /api/organizations/:orgCode
// Get organization details
app.get('/api/organizations/:orgCode', auth.isAuthenticated, async (req, res) => {
    try {
        const { orgCode } = req.params;

        const organization = await db.getOne(`
            SELECT * FROM scout_organizations WHERE "orgCode" = $1
        `, [orgCode]);

        if (!organization) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        logger.info('Organization fetched', { orgCode, userId: req.session.userId });
        res.json(organization);
    } catch (error) {
        logger.error('Error fetching organization', { error: error.message, userId: req.session.userId });
        res.status(500).json({ error: 'Failed to fetch organization' });
    }
});

// GET /api/organizations/:orgCode/levels
// Get scout levels for organization
app.get('/api/organizations/:orgCode/levels', auth.isAuthenticated, async (req, res) => {
    try {
        const { orgCode } = req.params;

        const levels = await db.getAll(`
            SELECT sl.*
            FROM scout_levels sl
            JOIN level_systems ls ON ls.id = sl."levelSystemId"
            JOIN scout_organizations so ON so.id = ls."organizationId"
            WHERE so."orgCode" = $1
              AND sl."isActive" = $2
            ORDER BY sl."sortOrder"
        `, [orgCode, true]);

        if (levels.length === 0) {
            return res.status(404).json({ error: 'Organization or levels not found' });
        }

        logger.info('Levels fetched', { orgCode, count: levels.length, userId: req.session.userId });
        res.json(levels);
    } catch (error) {
        logger.error('Error fetching levels', { error: error.message, userId: req.session.userId });
        res.status(500).json({ error: 'Failed to fetch levels' });
    }
});

// GET /api/organizations/:orgCode/colors
// Get color palette for organization
app.get('/api/organizations/:orgCode/colors', auth.isAuthenticated, async (req, res) => {
    try {
        const { orgCode } = req.params;

        const colors = await db.getAll(`
            SELECT cd.*
            FROM color_definitions cd
            JOIN color_palettes cp ON cp.id = cd."paletteId"
            JOIN scout_organizations so ON so.id = cp."organizationId"
            WHERE so."orgCode" = $1
            ORDER BY cd."colorName"
        `, [orgCode]);

        if (colors.length === 0) {
            return res.status(404).json({ error: 'Organization colors not found' });
        }

        logger.info('Colors fetched', { orgCode, count: colors.length, userId: req.session.userId });
        res.json(colors);
    } catch (error) {
        logger.error('Error fetching colors', { error: error.message, userId: req.session.userId });
        res.status(500).json({ error: 'Failed to fetch colors' });
    }
});

// GET /api/scouts/:userId/profile
// Get scout profile with organization and level details
app.get('/api/scouts/:userId/profile', auth.isAuthenticated, auth.requirePrivilegeForUser('view_scout_profiles'), async (req, res) => {
    try {
        const { userId } = req.params;

        const profile = await db.getOne(`
            SELECT
                sp.*,
                so."orgName",
                so."orgCode",
                sl."displayName" as "levelName",
                sl."levelCode",
                sl."uniformColor",
                sl."gradeRange",
                sl."ageRange",
                t."troopNumber",
                t."troopName",
                u."firstName",
                u."lastName",
                u."email"
            FROM scout_profiles sp
            JOIN scout_organizations so ON so.id = sp."organizationId"
            LEFT JOIN scout_levels sl ON sl.id = sp."currentLevelId"
            LEFT JOIN troops t ON t.id = sp."troopId"
            LEFT JOIN users u ON u.id = sp."userId"
            WHERE sp."userId" = $1
        `, [userId]);

        if (!profile) {
            return res.status(404).json({ error: 'Scout profile not found' });
        }

        logger.info('Scout profile fetched', { userId, orgCode: profile.orgCode });
        res.json(profile);
    } catch (error) {
        logger.error('Error fetching scout profile', { error: error.message, userId: req.params.userId });
        res.status(500).json({ error: 'Failed to fetch scout profile' });
    }
});

// PUT /api/scouts/:userId/level
// Update scout level (troop leaders and council admins only)
app.put('/api/scouts/:userId/level', auth.isAuthenticated, auth.requirePrivilegeForUser('edit_scout_level'), async (req, res) => {
    try {
        const { userId } = req.params;
        const { levelId } = req.body;

        if (!levelId) {
            return res.status(400).json({ error: 'levelId is required' });
        }

        // Verify the level exists
        const level = await db.getOne(`SELECT id FROM scout_levels WHERE id = $1`, [levelId]);
        if (!level) {
            return res.status(404).json({ error: 'Level not found' });
        }

        // Verify the scout profile exists
        const profile = await db.getOne(`SELECT id FROM scout_profiles WHERE "userId" = $1`, [userId]);
        if (!profile) {
            return res.status(404).json({ error: 'Scout profile not found' });
        }

        const updated = await db.getOne(`
            UPDATE scout_profiles
            SET "currentLevelId" = $1,
                "levelSince" = $2,
                "updatedAt" = CURRENT_TIMESTAMP
            WHERE "userId" = $3
            RETURNING *
        `, [levelId, new Date().toISOString().split('T')[0], userId]);

        logger.info('Scout level updated', { userId, levelId, updatedBy: req.session.userId });
        res.json(updated);
    } catch (error) {
        logger.error('Error updating scout level', { error: error.message, userId: req.params.userId });
        res.status(500).json({ error: 'Failed to update scout level' });
    }
});

// GET /api/scouts/:userId/badges
// Get badges earned by scout
app.get('/api/scouts/:userId/badges', auth.isAuthenticated, auth.requirePrivilegeForUser('view_badge_progress'), async (req, res) => {
    try {
        const { userId } = req.params;

        const badges = await db.getAll(`
            SELECT
                sb.*,
                b."badgeName",
                b."badgeType",
                b."description",
                b."imageUrl",
                b."badgeCode",
                verifier."firstName" || ' ' || verifier."lastName" as "verifiedByName"
            FROM scout_badges sb
            JOIN badges b ON b.id = sb."badgeId"
            LEFT JOIN users verifier ON verifier.id = sb."verifiedBy"
            WHERE sb."userId" = $1
            ORDER BY sb."earnedDate" DESC
        `, [userId]);

        logger.info('Scout badges fetched', { userId, count: badges.length });
        res.json(badges);
    } catch (error) {
        logger.error('Error fetching scout badges', { error: error.message, userId: req.params.userId });
        res.status(500).json({ error: 'Failed to fetch badges' });
    }
});

// POST /api/scouts/:userId/badges
// Award a badge to scout (troop leaders and council admins only)
app.post('/api/scouts/:userId/badges', auth.isAuthenticated, auth.requirePrivilegeForUser('award_badges'), async (req, res) => {
    try {
        const { userId } = req.params;
        const { badgeId, earnedDate, notes } = req.body;

        if (!badgeId || !earnedDate) {
            return res.status(400).json({ error: 'badgeId and earnedDate are required' });
        }

        // Verify scout profile exists
        const profile = await db.getOne(`
            SELECT "troopId" FROM scout_profiles WHERE "userId" = $1
        `, [userId]);

        if (!profile) {
            return res.status(404).json({ error: 'Scout profile not found' });
        }

        // Verify badge exists
        const badge = await db.getOne(`SELECT id, "badgeName" FROM badges WHERE id = $1`, [badgeId]);
        if (!badge) {
            return res.status(404).json({ error: 'Badge not found' });
        }

        const awardedBadge = await db.getOne(`
            INSERT INTO scout_badges (
                "userId", "badgeId", "troopId", "earnedDate",
                "verifiedBy", "verifiedDate", notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [
            userId,
            badgeId,
            profile.troopId,
            earnedDate,
            req.session.userId,
            new Date().toISOString().split('T')[0],
            notes || null
        ]);

        logger.info('Badge awarded', { userId, badgeId, badgeName: badge.badgeName, awardedBy: req.session.userId });

        // Create achievement notification for scout
        await db.run(`
            INSERT INTO notifications (
                "userId", type, title, message, "actionUrl"
            ) VALUES ($1, $2, $3, $4, $5)
        `, [
            userId,
            'achievement',
            'New Badge Earned!',
            `You've earned the ${badge.badgeName} badge!`,
            '/profile'
        ]);

        res.status(201).json(awardedBadge);
    } catch (error) {
        if (error.message.includes('duplicate key') || error.code === '23505') {
            return res.status(409).json({ error: 'Badge already awarded on this date' });
        }
        logger.error('Error awarding badge', { error: error.message, userId: req.params.userId });
        res.status(500).json({ error: 'Failed to award badge' });
    }
});

// GET /api/badge-catalogs
// List all badge catalogs (optionally filtered by organization)
app.get('/api/badge-catalogs', auth.isAuthenticated, async (req, res) => {
    try {
        const { orgCode } = req.query;

        let query = `
            SELECT bc.*, so."orgName", so."orgCode"
            FROM badge_catalogs bc
            JOIN scout_organizations so ON so.id = bc."organizationId"
            WHERE bc."isActive" = $1
        `;
        const params = [true];

        if (orgCode) {
            query += ` AND so."orgCode" = $${params.length + 1}`;
            params.push(orgCode);
        }

        query += ` ORDER BY bc."catalogYear" DESC, bc."catalogName"`;

        const catalogs = await db.getAll(query, params);
        logger.info('Badge catalogs fetched', { count: catalogs.length, orgCode: orgCode || 'all' });
        res.json(catalogs);
    } catch (error) {
        logger.error('Error fetching badge catalogs', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch badge catalogs' });
    }
});

// GET /api/badge-catalogs/:catalogId/badges
// Get all badges in a catalog (with filters)
app.get('/api/badge-catalogs/:catalogId/badges', auth.isAuthenticated, async (req, res) => {
    try {
        const { catalogId } = req.params;
        const { level, type, search } = req.query;

        let query = `
            SELECT b.*
            FROM badges b
            WHERE b."badgeCatalogId" = $1
              AND b."isActive" = $2
        `;
        const params = [catalogId, true];

        // Filter by level if provided
        if (level) {
            query += ` AND b."applicableLevels" @> $${params.length + 1}`;
            params.push(JSON.stringify([level]));
        }

        // Filter by type if provided
        if (type) {
            query += ` AND b."badgeType" = $${params.length + 1}`;
            params.push(type);
        }

        // Search by name if provided
        if (search) {
            query += ` AND b."badgeName" ILIKE $${params.length + 1}`;
            params.push(`%${search}%`);
        }

        query += ` ORDER BY b."sortOrder", b."badgeName"`;

        const badges = await db.getAll(query, params);
        logger.info('Catalog badges fetched', { catalogId, count: badges.length, level, type });
        res.json(badges);
    } catch (error) {
        logger.error('Error fetching catalog badges', { error: error.message, catalogId: req.params.catalogId });
        res.status(500).json({ error: 'Failed to fetch catalog badges' });
    }
});

// GET /api/scouts/:userId/available-badges
// Get badges available for scout's current level (not yet earned)
app.get('/api/scouts/:userId/available-badges', auth.isAuthenticated, auth.requirePrivilegeForUser('view_badge_progress'), async (req, res) => {
    try {
        const { userId } = req.params;

        // Get scout profile with level and organization
        const profile = await db.getOne(`
            SELECT sp."currentLevelId", sl."levelCode", so.id as "orgId"
            FROM scout_profiles sp
            JOIN scout_levels sl ON sl.id = sp."currentLevelId"
            JOIN level_systems ls ON ls.id = sl."levelSystemId"
            JOIN scout_organizations so ON so.id = ls."organizationId"
            WHERE sp."userId" = $1
        `, [userId]);

        if (!profile) {
            return res.status(404).json({ error: 'Scout profile not found' });
        }

        // Get badges applicable to scout's level that they haven't earned yet
        const availableBadges = await db.getAll(`
            SELECT b.*
            FROM badges b
            JOIN badge_catalogs bc ON bc.id = b."badgeCatalogId"
            WHERE bc."organizationId" = $1
              AND b."applicableLevels" @> $2
              AND b."isActive" = true
              AND b.id NOT IN (
                  SELECT "badgeId" FROM scout_badges WHERE "userId" = $3
              )
            ORDER BY b."sortOrder", b."badgeName"
        `, [profile.orgId, JSON.stringify([profile.levelCode]), userId]);

        logger.info('Available badges fetched', { userId, count: availableBadges.length, level: profile.levelCode });
        res.json(availableBadges);
    } catch (error) {
        logger.error('Error fetching available badges', { error: error.message, userId: req.params.userId });
        res.status(500).json({ error: 'Failed to fetch available badges' });
    }
});

// ============================================================================
// Privilege Management Routes
// ============================================================================

// Get effective privileges for a troop member
app.get('/api/troop/:troopId/members/:userId/privileges', auth.isAuthenticated, auth.requirePrivilege('manage_privileges'), async (req, res) => {
    try {
        const { troopId, userId } = req.params;

        const member = await db.getOne(`
            SELECT tm.role as "troopRole", u.id, u."firstName", u."lastName"
            FROM troop_members tm
            JOIN users u ON tm."userId" = u.id
            WHERE tm."troopId" = $1 AND tm."userId" = $2 AND tm.status = 'active'
        `, [troopId, userId]);
        if (!member) return res.status(404).json({ error: 'Member not found' });

        const overrides = await db.getAll(
            'SELECT "privilegeCode", scope FROM privilege_overrides WHERE "troopId" = $1 AND "userId" = $2',
            [troopId, userId]
        );

        res.json({
            member: { id: member.id, firstName: member.firstName, lastName: member.lastName, troopRole: member.troopRole },
            privileges: buildEffectivePrivileges(member.troopRole, overrides)
        });
    } catch (error) {
        logger.error('Error fetching member privileges', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch privileges' });
    }
});

// Save privilege overrides for a troop member
app.put('/api/troop/:troopId/members/:userId/privileges', auth.isAuthenticated, auth.requirePrivilege('manage_privileges'), async (req, res) => {
    try {
        const { troopId, userId } = req.params;
        const { overrides } = req.body;

        if (!Array.isArray(overrides)) {
            return res.status(400).json({ error: 'overrides must be an array' });
        }

        // Self-elevation block
        if (userId === req.session.userId) {
            return res.status(403).json({ error: 'Cannot modify your own privileges' });
        }

        const troop = await db.getOne('SELECT * FROM troops WHERE id = $1', [troopId]);
        if (!troop) return res.status(404).json({ error: 'Troop not found' });

        const member = await db.getOne(`
            SELECT tm.role as "troopRole", u.id
            FROM troop_members tm JOIN users u ON tm."userId" = u.id
            WHERE tm."troopId" = $1 AND tm."userId" = $2 AND tm.status = 'active'
        `, [troopId, userId]);
        if (!member) return res.status(404).json({ error: 'Member not found' });

        const roleDefaults = ROLE_PRIVILEGE_DEFAULTS[member.troopRole] || ROLE_PRIVILEGE_DEFAULTS.member;

        // Validate all overrides
        for (const o of overrides) {
            if (!VALID_PRIVILEGE_CODES.includes(o.code)) {
                return res.status(400).json({ error: `Invalid privilege code: ${o.code}` });
            }
            if (!VALID_SCOPES.includes(o.scope)) {
                return res.status(400).json({ error: `Invalid scope: ${o.scope}` });
            }
        }

        await db.transaction(async (client) => {
            for (const o of overrides) {
                const defaultScope = roleDefaults[o.code] || 'none';
                if (o.scope === defaultScope) {
                    // Remove override if it matches the default
                    await client.query(
                        'DELETE FROM privilege_overrides WHERE "troopId" = $1 AND "userId" = $2 AND "privilegeCode" = $3',
                        [troopId, userId, o.code]
                    );
                } else {
                    // Upsert override
                    await client.query(`
                        INSERT INTO privilege_overrides ("troopId", "userId", "privilegeCode", scope, "grantedBy")
                        VALUES ($1, $2, $3, $4, $5)
                        ON CONFLICT ("troopId", "userId", "privilegeCode")
                        DO UPDATE SET scope = $4, "grantedBy" = $5, "updatedAt" = CURRENT_TIMESTAMP
                    `, [troopId, userId, o.code, o.scope, req.session.userId]);
                }
            }
        });

        await auth.logAuditEvent(db, req.session.userId, 'update_privileges', req, {
            resourceType: 'privileges',
            resourceId: userId,
            troopId,
            overrideCount: overrides.length
        });

        // Return updated state
        const updatedOverrides = await db.getAll(
            'SELECT "privilegeCode", scope FROM privilege_overrides WHERE "troopId" = $1 AND "userId" = $2',
            [troopId, userId]
        );

        res.json({
            member: { id: member.id, troopRole: member.troopRole },
            privileges: buildEffectivePrivileges(member.troopRole, updatedOverrides)
        });
    } catch (error) {
        logger.error('Error saving privilege overrides', { error: error.message });
        res.status(500).json({ error: 'Failed to save privileges' });
    }
});

// Reset all privilege overrides for a troop member
app.delete('/api/troop/:troopId/members/:userId/privileges', auth.isAuthenticated, auth.requirePrivilege('manage_privileges'), async (req, res) => {
    try {
        const { troopId, userId } = req.params;

        await db.run(
            'DELETE FROM privilege_overrides WHERE "troopId" = $1 AND "userId" = $2',
            [troopId, userId]
        );

        await auth.logAuditEvent(db, req.session.userId, 'reset_privileges', req, {
            resourceType: 'privileges',
            resourceId: userId,
            troopId
        });

        res.json({ success: true });
    } catch (error) {
        logger.error('Error resetting privilege overrides', { error: error.message });
        res.status(500).json({ error: 'Failed to reset privileges' });
    }
});

// ============================================================================
// Admin API Endpoints (System-Level Administration)
// ============================================================================

/**
 * POST /api/system/bootstrap
 * Bootstrap the first admin account (one-time, no auth required if no admins exist)
 * Body: { email: string, password: string }
 */
app.post('/api/system/bootstrap', async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Validate input
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        if (!auth.isValidEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        const passwordValidation = auth.validatePassword(password);
        if (!passwordValidation.valid) {
            return res.status(400).json({ error: passwordValidation.message });
        }

        // 2. Check if any admins already exist
        const adminCount = await db.getOne(
            'SELECT COUNT(*)::int as count FROM admins WHERE "revokedAt" IS NULL'
        );

        if (Number(adminCount.count) > 0) {
            return res.status(403).json({ error: 'Bootstrap already completed - admin accounts exist' });
        }

        // 3. Create user account
        const hashedPassword = await auth.hashPassword(password);
        const userId = crypto.randomUUID();

        await db.run(
            `INSERT INTO users (id, email, password, role, "createdAt")
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
            [userId, email, hashedPassword, 'admin']
        );

        // 4. Create admin record (grantedBy is NULL for bootstrap)
        await db.run(
            `INSERT INTO admins ("userId", role, "grantedBy")
             VALUES ($1, $2, NULL)`,
            [userId, 'admin']
        );

        // 5. Log audit event
        await auth.logAuditEvent(db, userId, 'bootstrap_admin', req, {
            resourceType: 'admin',
            resourceId: userId
        });

        res.json({
            success: true,
            message: 'First admin account created successfully',
            user: { id: userId, email, role: 'admin' }
        });
    } catch (error) {
        logger.error('Bootstrap admin creation failed', { error: error.message });
        res.status(500).json({ error: 'Failed to create admin account' });
    }
});

/**
 * GET /api/system/bootstrap-status
 * Check if bootstrap is needed (no auth required)
 */
app.get('/api/system/bootstrap-status', async (req, res) => {
    try {
        const adminCount = await db.getOne(
            'SELECT COUNT(*)::int as count FROM admins WHERE "revokedAt" IS NULL'
        );
        res.json({ needsBootstrap: Number(adminCount.count) === 0 });
    } catch (error) {
        logger.error('Bootstrap status check failed', { error: error.message });
        res.status(500).json({ error: 'Failed to check bootstrap status' });
    }
});

/**
 * GET /api/system/admins
 * List all active admin accounts (admin-only)
 */
app.get('/api/system/admins', auth.isAuthenticated, auth.requireAdmin, async (req, res) => {
    try {
        const admins = await db.getAll(`
            SELECT
                a.id,
                a."userId",
                a.role,
                a."grantedAt",
                a."grantedBy",
                a."revokedAt",
                a."revokedBy",
                u.email,
                u.role as "userRole"
            FROM admins a
            JOIN users u ON u.id = a."userId"
            ORDER BY a."grantedAt" DESC
        `);

        res.json({ admins });
    } catch (error) {
        logger.error('Failed to list admins', { error: error.message });
        res.status(500).json({ error: 'Failed to list admins' });
    }
});

/**
 * POST /api/system/admins
 * Create new admin account (requires existing admin)
 * Body: { userId: uuid }
 */
app.post('/api/system/admins', auth.isAuthenticated, auth.requireAdmin, async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        // Validate UUID format (basic check)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(userId)) {
            return res.status(400).json({ error: 'Invalid userId format - must be a valid UUID' });
        }

        // 1. Verify target user exists
        const user = await db.getOne('SELECT id, email FROM users WHERE id = $1', [userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // 2. Check if user is already admin
        const existingAdmin = await db.getOne(
            'SELECT id FROM admins WHERE "userId" = $1 AND "revokedAt" IS NULL',
            [userId]
        );
        if (existingAdmin) {
            return res.status(400).json({ error: 'User is already an admin' });
        }

        // 3. Create or reactivate admin record
        const adminId = crypto.randomUUID();
        await db.run(
            `INSERT INTO admins (id, "userId", role, "grantedBy")
             VALUES ($1, $2, $3, $4)
             ON CONFLICT ("userId") DO UPDATE
             SET "revokedAt" = NULL, "revokedBy" = NULL, "grantedBy" = EXCLUDED."grantedBy"`,
            [adminId, userId, 'admin', req.session.userId]
        );

        // 4. Update user role to admin
        await db.run(
            'UPDATE users SET role = $1 WHERE id = $2',
            ['admin', userId]
        );

        // 5. Log audit event
        await auth.logAuditEvent(db, req.session.userId, 'create_admin', req, {
            resourceType: 'admin',
            resourceId: userId,
            targetEmail: user.email
        });

        res.json({
            success: true,
            message: `${user.email} is now an admin`,
            admin: { userId, email: user.email, role: 'admin' }
        });
    } catch (error) {
        logger.error('Failed to create admin', { error: error.message });
        res.status(500).json({ error: 'Failed to create admin' });
    }
});

/**
 * DELETE /api/system/admins/:userId
 * Revoke admin status (requires existing admin)
 */
app.delete('/api/system/admins/:userId', auth.isAuthenticated, auth.requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;

        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(userId)) {
            return res.status(400).json({ error: 'Invalid userId format - must be a valid UUID' });
        }

        // 1. Verify user exists
        const user = await db.getOne('SELECT id, email FROM users WHERE id = $1', [userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // 2. Prevent admin from revoking themselves
        if (userId === req.session.userId) {
            return res.status(400).json({ error: 'Cannot revoke your own admin access' });
        }

        // 3. Mark admin record as revoked
        await db.run(
            'UPDATE admins SET "revokedAt" = CURRENT_TIMESTAMP, "revokedBy" = $1 WHERE "userId" = $2',
            [req.session.userId, userId]
        );

        // 4. Revert user role to member
        await db.run(
            'UPDATE users SET role = $1 WHERE id = $2',
            ['member', userId]
        );

        // 5. Log audit event
        await auth.logAuditEvent(db, req.session.userId, 'revoke_admin', req, {
            resourceType: 'admin',
            resourceId: userId,
            targetEmail: user.email
        });

        res.json({
            success: true,
            message: `Admin access revoked for ${user.email}`
        });
    } catch (error) {
        logger.error('Failed to revoke admin', { error: error.message });
        res.status(500).json({ error: 'Failed to revoke admin' });
    }
});

/**
 * GET /api/system/stats
 * System monitoring statistics
 */
app.get('/api/system/stats', auth.isAuthenticated, auth.requireAdmin, async (req, res) => {
    try {
        const stats = {
            system: {
                uptime: os.uptime(),
                loadAvg: os.loadavg(),
                totalMem: os.totalmem(),
                freeMem: os.freemem(),
                platform: os.platform(),
                arch: os.arch(),
                cpus: os.cpus().length
            },
            process: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                version: process.version
            },
            database: {
                connected: (await db.testConnection()),
                poolSize: pool.totalCount,
                idleCount: pool.idleCount,
                waitingCount: pool.waitingCount
            },
            redis: {
                connected: redisClient.isOpen
            }
        };
        res.json(stats);
    } catch (error) {
        logger.error('Error getting system stats', { error: error.message });
        res.status(500).json({ error: 'Failed to get system stats' });
    }
});

/**
 * GET /api/system/settings
 * Retrieve system settings
 */
app.get('/api/system/settings', auth.isAuthenticated, auth.requireAdmin, async (req, res) => {
    try {
        const settings = await db.getAll('SELECT * FROM system_settings ORDER BY key');
        const settingsMap = {};
        settings.forEach(s => {
            settingsMap[s.key] = s.value;
        });
        res.json({ settings: settingsMap, metadata: settings });
    } catch (error) {
        logger.error('Error getting settings', { error: error.message });
        res.status(500).json({ error: 'Failed to get settings' });
    }
});

/**
 * POST /api/system/settings
 * Update system settings
 */
app.post('/api/system/settings', auth.isAuthenticated, auth.requireAdmin, async (req, res) => {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
        return res.status(400).json({ error: 'Invalid settings format' });
    }

    try {
        await db.transaction(async (client) => {
            for (const [key, value] of Object.entries(settings)) {
                await client.query(`
                    INSERT INTO system_settings (key, value, "updatedAt", "updatedBy")
                    VALUES ($1, $2, NOW(), $3)
                    ON CONFLICT (key) DO UPDATE SET
                        value = EXCLUDED.value,
                        "updatedAt" = NOW(),
                        "updatedBy" = EXCLUDED."updatedBy"
                `, [key, value, req.session.userId]);
            }
        });
        
        await auth.logAuditEvent(db, req.session.userId, 'update_system_settings', req, { keys: Object.keys(settings) });
        res.json({ success: true, message: 'Settings updated' });
    } catch (error) {
        logger.error('Error updating settings', { error: error.message });
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

/**
 * GET /api/system/sessions
 * List active sessions
 */
app.get('/api/system/sessions', auth.isAuthenticated, auth.requireAdmin, async (req, res) => {
    try {
        const keys = await redisClient.keys('sess:*');
        const sessions = [];
        for (const key of keys) {
            const sessData = await redisClient.get(key);
            if (sessData) {
                try {
                    const sess = JSON.parse(sessData);
                    let userEmail = 'Guest';
                    if (sess.userId) {
                        const user = await db.getOne('SELECT email FROM users WHERE id = $1', [sess.userId]);
                        if (user) userEmail = user.email;
                    }
                    
                    sessions.push({
                        id: key.replace('sess:', ''),
                        userId: sess.userId,
                        userEmail,
                        cookie: sess.cookie,
                        ip: sess.ip // Assuming we stored IP in session at login, if not it will be undefined
                    });
                } catch (e) {
                    // Ignore parse errors
                }
            }
        }
        res.json({ sessions });
    } catch (error) {
        logger.error('Error listing sessions', { error: error.message });
        res.status(500).json({ error: 'Failed to list sessions' });
    }
});

/**
 * DELETE /api/system/sessions/:id
 * Revoke a session
 */
app.delete('/api/system/sessions/:id', auth.isAuthenticated, auth.requireAdmin, async (req, res) => {
    try {
        const sessionId = req.params.id;
        await redisClient.del(`sess:${sessionId}`);
        
        await auth.logAuditEvent(db, req.session.userId, 'revoke_session', req, { sessionId });
        res.json({ success: true });
    } catch (error) {
        logger.error('Error revoking session', { error: error.message });
        res.status(500).json({ error: 'Failed to revoke session' });
    }
});

/**
 * GET /api/system/backup
 * Download database backup
 */
app.get('/api/system/backup', auth.isAuthenticated, auth.requireAdmin, async (req, res) => {
    const { DB_HOST, DB_USER, DB_NAME, DB_PASSWORD, DB_PORT } = process.env;
    
    if (!DB_HOST) return res.status(500).json({ error: 'Database configuration missing' });

    const filename = `backup-${new Date().toISOString().replace(/:/g, '-')}.sql`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/sql');

    const env = { ...process.env, PGPASSWORD: DB_PASSWORD };
    const dumpCommand = `pg_dump -h ${DB_HOST} -p ${DB_PORT || 5432} -U ${DB_USER} ${DB_NAME}`;
    
    const child = exec(dumpCommand, { env });
    
    child.stdout.pipe(res);
    
    child.stderr.on('data', (data) => {
        // Ignore verbose output, only log errors if process fails
        // logger.debug('Backup stderr', { data });
    });
    
    child.on('error', (error) => {
         logger.error('Backup process error', { error: error.message });
         if (!res.headersSent) res.status(500).json({ error: 'Backup failed' });
    });
});

/**
 * POST /api/system/anonymize/:userId
 * Anonymize user data (COPPA compliance)
 */
app.post('/api/system/anonymize/:userId', auth.isAuthenticated, auth.requireAdmin, async (req, res) => {
    const { userId } = req.params;
    
    // Validate UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
        return res.status(400).json({ error: 'Invalid userId format' });
    }

    try {
        const user = await db.getOne('SELECT id, role FROM users WHERE id = $1', [userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Prevent anonymizing admins or self
        if (userId === req.session.userId) {
            return res.status(400).json({ error: 'Cannot anonymize your own account' });
        }
        
        const adminCheck = await db.getOne('SELECT * FROM admins WHERE "userId" = $1 AND "revokedAt" IS NULL', [userId]);
        if (adminCheck) {
            return res.status(400).json({ error: 'Cannot anonymize an active admin. Revoke admin access first.' });
        }

        const anonymizedEmail = `deleted-${userId.substring(0,8)}@anonymized.local`;

        await db.run(`
            UPDATE users SET 
                email = $1,
                "firstName" = 'Deleted',
                "lastName" = 'User',
                "photoUrl" = NULL,
                "googleId" = NULL,
                "parentEmail" = NULL,
                "isActive" = FALSE
            WHERE id = $2
        `, [anonymizedEmail, userId]);

        // Also clean up sessions
        await db.run('DELETE FROM sessions WHERE "userId" = $1', [userId]);

        await auth.logAuditEvent(db, req.session.userId, 'anonymize_user', req, { targetUserId: userId });
        
        res.json({ success: true, message: 'User data anonymized successfully' });
    } catch (error) {
        logger.error('Anonymization failed', { error: error.message });
        res.status(500).json({ error: 'Failed to anonymize user' });
    }
});

/**
 * GET /api/system/roles
 * Get role definitions and privileges
 */
app.get('/api/system/roles', auth.isAuthenticated, auth.requireAdmin, (req, res) => {
    res.json({
        privileges: PRIVILEGE_DEFINITIONS,
        roles: ROLE_PRIVILEGE_DEFAULTS
    });
});

/**
 * GET /api/system/organizations
 * List all organizations (admin view - includes inactive)
 */
app.get('/api/system/organizations', auth.isAuthenticated, auth.requireAdmin, async (req, res) => {
    try {
        const organizations = await db.getAll('SELECT * FROM scout_organizations ORDER BY "orgName"');
        
        // Get stats for each organization
        const orgsWithStats = await Promise.all(organizations.map(async (org) => {
            const troopCount = await db.getOne(
                'SELECT COUNT(*)::int as count FROM troops WHERE "organizationId" = $1',
                [org.id]
            );
            const memberCount = await db.getOne(
                'SELECT COUNT(*)::int as count FROM scout_profiles WHERE "organizationId" = $1',
                [org.id]
            );
            return {
                ...org,
                troopCount: troopCount ? troopCount.count : 0,
                memberCount: memberCount ? memberCount.count : 0
            };
        }));

        res.json({ organizations: orgsWithStats });
    } catch (error) {
        logger.error('Failed to list system organizations', { error: error.message });
        res.status(500).json({ error: 'Failed to list organizations' });
    }
});

/**
 * POST /api/system/organizations
 * Create new organization
 */
app.post('/api/system/organizations', auth.isAuthenticated, auth.requireAdmin, async (req, res) => {
    try {
        const { orgCode, orgName, orgType, description, websiteUrl } = req.body;

        // Validation
        if (!orgCode || !orgName || !orgType) {
            return res.status(400).json({ error: 'orgCode, orgName, and orgType are required' });
        }

        const validTypes = ['girl_scouts', 'scouting_america', 'other'];
        if (!validTypes.includes(orgType)) {
            return res.status(400).json({ error: 'Invalid orgType' });
        }

        // Check for duplicate code
        const existing = await db.getOne('SELECT id FROM scout_organizations WHERE "orgCode" = $1', [orgCode]);
        if (existing) {
            return res.status(409).json({ error: 'Organization code already exists' });
        }

        const id = crypto.randomUUID();
        await db.run(
            `INSERT INTO scout_organizations (id, "orgCode", "orgName", "orgType", description, "websiteUrl")
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [id, orgCode, orgName, orgType, description, websiteUrl]
        );

        await auth.logAuditEvent(db, req.session.userId, 'create_organization', req, {
            resourceType: 'organization',
            resourceId: id,
            details: { orgCode, orgName }
        });

        res.status(201).json({
            success: true,
            message: 'Organization created successfully',
            organization: { id, orgCode, orgName, orgType }
        });
    } catch (error) {
        logger.error('Failed to create organization', { error: error.message });
        res.status(500).json({ error: 'Failed to create organization' });
    }
});

/**
 * PUT /api/system/organizations/:id
 * Update organization
 */
app.put('/api/system/organizations/:id', auth.isAuthenticated, auth.requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { orgName, orgType, description, websiteUrl, isActive } = req.body;

        // Verify exists
        const org = await db.getOne('SELECT * FROM scout_organizations WHERE id = $1', [id]);
        if (!org) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        const validTypes = ['girl_scouts', 'scouting_america', 'other'];
        if (orgType && !validTypes.includes(orgType)) {
            return res.status(400).json({ error: 'Invalid orgType' });
        }

        await db.run(
            `UPDATE scout_organizations 
             SET "orgName" = COALESCE($1, "orgName"),
                 "orgType" = COALESCE($2, "orgType"),
                 description = COALESCE($3, description),
                 "websiteUrl" = COALESCE($4, "websiteUrl"),
                 "isActive" = COALESCE($5, "isActive"),
                 "updatedAt" = CURRENT_TIMESTAMP
             WHERE id = $6`,
            [orgName, orgType, description, websiteUrl, isActive, id]
        );

        await auth.logAuditEvent(db, req.session.userId, 'update_organization', req, {
            resourceType: 'organization',
            resourceId: id,
            details: { orgName, orgType, isActive }
        });

        res.json({ success: true, message: 'Organization updated successfully' });
    } catch (error) {
        logger.error('Failed to update organization', { error: error.message });
        res.status(500).json({ error: 'Failed to update organization' });
    }
});

/**
 * DELETE /api/system/organizations/:id
 * Delete organization (protected against cascade)
 */
app.delete('/api/system/organizations/:id', auth.isAuthenticated, auth.requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const org = await db.getOne('SELECT "orgName" FROM scout_organizations WHERE id = $1', [id]);
        if (!org) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        // Check for dependencies
        const troopCount = await db.getOne('SELECT COUNT(*)::int as count FROM troops WHERE "organizationId" = $1', [id]);
        if (troopCount.count > 0) {
            return res.status(409).json({ 
                error: `Cannot delete organization: It has ${troopCount.count} associated troops. Archive it instead.` 
            });
        }

        await db.run('DELETE FROM scout_organizations WHERE id = $1', [id]);

        await auth.logAuditEvent(db, req.session.userId, 'delete_organization', req, {
            resourceType: 'organization',
            resourceId: id,
            details: { orgName: org.orgName }
        });

        res.json({ success: true, message: 'Organization deleted successfully' });
    } catch (error) {
        logger.error('Failed to delete organization', { error: error.message });
        res.status(500).json({ error: 'Failed to delete organization' });
    }
});

// ============================================================================
// System CRUD Endpoints (Troops & Members)
// ============================================================================

/**
 * GET /api/system/troops
 * List all troops (admin view)
 */
app.get('/api/system/troops', auth.isAuthenticated, auth.requireAdmin, async (req, res) => {
    try {
        const troops = await db.getAll(`
            SELECT 
                t.*,
                so."orgName",
                u."firstName" || ' ' || u."lastName" as "leaderName",
                (SELECT COUNT(*)::int FROM troop_members tm WHERE tm."troopId" = t.id AND tm.status = 'active') as "memberCount"
            FROM troops t
            LEFT JOIN scout_organizations so ON t."organizationId" = so.id
            LEFT JOIN users u ON t."leaderId" = u.id
            ORDER BY t."troopName", t."troopNumber"
        `);
        res.json({ troops });
    } catch (error) {
        logger.error('Failed to list system troops', { error: error.message });
        res.status(500).json({ error: 'Failed to list troops' });
    }
});

/**
 * POST /api/system/troops
 * Create new troop
 */
app.post('/api/system/troops', auth.isAuthenticated, auth.requireAdmin, async (req, res) => {
    try {
        const { troopNumber, troopName, troopType, organizationId, isActive } = req.body;

        if (!troopNumber || !troopType || !organizationId) {
            return res.status(400).json({ error: 'Troop Number, Type, and Organization are required' });
        }

        const id = crypto.randomUUID();
        await db.run(
            `INSERT INTO troops (id, "troopNumber", "troopName", "troopType", "organizationId", "isActive")
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [id, troopNumber, troopName || `Troop ${troopNumber}`, troopType, organizationId, isActive !== false]
        );

        await auth.logAuditEvent(db, req.session.userId, 'create_troop', req, {
            resourceType: 'troop',
            resourceId: id,
            details: { troopNumber, organizationId }
        });

        res.status(201).json({ success: true, message: 'Troop created successfully', troopId: id });
    } catch (error) {
        logger.error('Failed to create troop', { error: error.message });
        res.status(500).json({ error: 'Failed to create troop' });
    }
});

/**
 * PUT /api/system/troops/:id
 * Update troop
 */
app.put('/api/system/troops/:id', auth.isAuthenticated, auth.requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { troopNumber, troopName, troopType, organizationId, isActive } = req.body;

        await db.run(
            `UPDATE troops 
             SET "troopNumber" = COALESCE($1, "troopNumber"),
                 "troopName" = COALESCE($2, "troopName"),
                 "troopType" = COALESCE($3, "troopType"),
                 "organizationId" = COALESCE($4, "organizationId"),
                 "isActive" = COALESCE($5, "isActive"),
                 "updatedAt" = CURRENT_TIMESTAMP
             WHERE id = $6`,
            [troopNumber, troopName, troopType, organizationId, isActive, id]
        );

        await auth.logAuditEvent(db, req.session.userId, 'update_troop', req, {
            resourceType: 'troop',
            resourceId: id,
            details: { troopNumber, isActive }
        });

        res.json({ success: true, message: 'Troop updated successfully' });
    } catch (error) {
        logger.error('Failed to update troop', { error: error.message });
        res.status(500).json({ error: 'Failed to update troop' });
    }
});

/**
 * DELETE /api/system/troops/:id
 * Delete troop (protected)
 */
app.delete('/api/system/troops/:id', auth.isAuthenticated, auth.requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // Check for members
        const memberCount = await db.getOne(
            'SELECT COUNT(*)::int as count FROM troop_members WHERE "troopId" = $1',
            [id]
        );

        if (memberCount.count > 0) {
            return res.status(409).json({ 
                error: `Cannot delete troop: It has ${memberCount.count} members. Remove members first or archive the troop.` 
            });
        }

        await db.run('DELETE FROM troops WHERE id = $1', [id]);

        await auth.logAuditEvent(db, req.session.userId, 'delete_troop', req, {
            resourceType: 'troop',
            resourceId: id
        });

        res.json({ success: true, message: 'Troop deleted successfully' });
    } catch (error) {
        logger.error('Failed to delete troop', { error: error.message });
        res.status(500).json({ error: 'Failed to delete troop' });
    }
});

/**
 * GET /api/system/members
 * List all members (admin view)
 */
app.get('/api/system/members', auth.isAuthenticated, auth.requireAdmin, async (req, res) => {
    try {
        const search = req.query.search ? `%${req.query.search}%` : null;
        let query = `
            SELECT id, email, "firstName", "lastName", role, "isActive", "createdAt", "lastLogin",
            (SELECT COUNT(*)::int FROM troop_members tm WHERE tm."userId" = users.id AND tm.status = 'active') as "troopCount"
            FROM users
        `;
        let params = [];

        if (search) {
            query += ' WHERE email ILIKE $1 OR "firstName" ILIKE $1 OR "lastName" ILIKE $1';
            params = [search];
        }

        query += ' ORDER BY "firstName", "lastName" LIMIT 200';

        const members = await db.getAll(query, params);
        res.json({ members });
    } catch (error) {
        logger.error('Failed to list members', { error: error.message });
        res.status(500).json({ error: 'Failed to list members' });
    }
});

/**
 * POST /api/system/members
 * Create new member
 */
app.post('/api/system/members', auth.isAuthenticated, auth.requireAdmin, async (req, res) => {
    try {
        const { email, password, firstName, lastName, role } = req.body;

        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({ error: 'Email, password, first name, and last name are required' });
        }

        if (!auth.isValidEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        const existing = await db.getOne('SELECT id FROM users WHERE email = $1', [email]);
        if (existing) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const hashedPassword = await auth.hashPassword(password);
        const id = crypto.randomUUID();

        await db.run(
            `INSERT INTO users (id, email, password, "firstName", "lastName", role, "isActive", "createdAt")
             VALUES ($1, $2, $3, $4, $5, $6, true, CURRENT_TIMESTAMP)`,
            [id, email, hashedPassword, firstName, lastName, role || 'member']
        );

        await auth.logAuditEvent(db, req.session.userId, 'create_user', req, {
            resourceType: 'user',
            resourceId: id,
            targetEmail: email
        });

        res.status(201).json({ success: true, message: 'Member created successfully', userId: id });
    } catch (error) {
        logger.error('Failed to create member', { error: error.message });
        res.status(500).json({ error: 'Failed to create member' });
    }
});

/**
 * PUT /api/system/members/:id
 * Update member
 */
app.put('/api/system/members/:id', auth.isAuthenticated, auth.requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { email, firstName, lastName, role, isActive, password } = req.body;

        // If password provided, hash it
        if (password) {
            const hashedPassword = await auth.hashPassword(password);
            await db.run('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, id]);
        }

        await db.run(
            `UPDATE users 
             SET email = COALESCE($1, email),
                 "firstName" = COALESCE($2, "firstName"),
                 "lastName" = COALESCE($3, "lastName"),
                 role = COALESCE($4, role),
                 "isActive" = COALESCE($5, "isActive")
             WHERE id = $6`,
            [email, firstName, lastName, role, isActive, id]
        );

        await auth.logAuditEvent(db, req.session.userId, 'update_user', req, {
            resourceType: 'user',
            resourceId: id,
            details: { email, role, isActive }
        });

        res.json({ success: true, message: 'Member updated successfully' });
    } catch (error) {
        logger.error('Failed to update member', { error: error.message });
        res.status(500).json({ error: 'Failed to update member' });
    }
});

/**
 * DELETE /api/system/members/:id
 * Soft delete member
 */
app.delete('/api/system/members/:id', auth.isAuthenticated, auth.requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // Prevent deleting self
        if (id === req.session.userId) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }

        // Soft delete
        await db.run('UPDATE users SET "isActive" = false WHERE id = $1', [id]);

        await auth.logAuditEvent(db, req.session.userId, 'deactivate_user', req, {
            resourceType: 'user',
            resourceId: id
        });

        res.json({ success: true, message: 'Member deactivated successfully' });
    } catch (error) {
        logger.error('Failed to deactivate member', { error: error.message });
        res.status(500).json({ error: 'Failed to deactivate member' });
    }
});

/**
 * GET /api/system/export
 * Bulk export system data
 */
app.get('/api/system/export', auth.isAuthenticated, auth.requireAdmin, async (req, res) => {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `asm_export_${timestamp}.json`;

        const [organizations, troops, users, auditLog] = await Promise.all([
            db.getAll('SELECT * FROM scout_organizations'),
            db.getAll('SELECT * FROM troops'),
            db.getAll('SELECT id, email, "firstName", "lastName", role, "isActive", "createdAt" FROM users'),
            db.getAll('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT 1000')
        ]);

        const exportData = {
            metadata: {
                version: '1.0',
                exportedAt: new Date().toISOString(),
                exportedBy: req.session.userId
            },
            organizations,
            troops,
            users,
            auditLog
        };

        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.setHeader('Content-Type', 'application/json');
        res.json(exportData);
    } catch (error) {
        logger.error('Export failed', { error: error.message });
        res.status(500).json({ error: 'Export failed' });
    }
});

/**
 * GET /api/audit-log
 * View system audit log (admin panel) - Phase 5
 */
app.get('/api/audit-log', auth.isAuthenticated, auth.requireAdmin, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 1000);
        const search = req.query.search ? `%${req.query.search}%` : null;

        let query = `
            SELECT 
                al.id, 
                al."userId", 
                u."firstName" || ' ' || u."lastName" as "userName",
                u.email as "userEmail",
                al.action, 
                al."resourceType", 
                al."resourceId", 
                al.details, 
                al.timestamp 
            FROM audit_log al
            LEFT JOIN users u ON al."userId" = u.id
        `;
        let params = [];

        if (search) {
            query += ' WHERE al.action ILIKE $1 OR al."resourceType" ILIKE $1 OR al."resourceId"::text ILIKE $1 OR u.email ILIKE $1 OR u."firstName" ILIKE $1 OR u."lastName" ILIKE $1';
            params = [search];
        }

        query += ' ORDER BY al.timestamp DESC LIMIT $' + (params.length + 1);
        params.push(limit);

        const events = await db.getAll(query, params).catch(() => []);

        res.json({ events: events || [] });
    } catch (error) {
        logger.error('Error loading audit log', { error: error.message });
        res.status(500).json({ error: 'Failed to load audit log', events: [] });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', database: 'connected' });
});

// Graceful shutdown
let isShuttingDown = false;

function shutdown(signal) {
    if (isShuttingDown) {
        return;
    }
    isShuttingDown = true;
    
    logger.info(`${signal} received, closing database...`);
    db.close();
    logger.info('Database closed successfully');
    process.exitCode = 0;
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Apex Scout Manager server running on port ${PORT}`);
    logger.info('PostgreSQL database connected', {
        host: process.env.POSTGRES_HOST || 'localhost',
        database: process.env.POSTGRES_DB || 'apex_scout_manager'
    });
});
