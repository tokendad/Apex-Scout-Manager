# Changelog

All notable changes to Apex Scout Manager will be documented in this file.

## [2.1.0] - 2026-02-19

### Phase 4.5: Field-Ready UX & Fulfillment System

This release introduces significant UI/UX improvements focused on field operations and closes the inventory loop with a new fulfillment system.

### Added

**Visual Dashboard Enhancements:**
- Implemented a primary **Visual Goal Progress Ring** (SVG) on the cookie dashboard.
- Applied **Glassmorphism** styling to dashboard cards for a modern SaaS aesthetic.
- Migrated from emoji-based icons to **Lucide Icons** across the entire application.

**Booth Field Mode:**
- Added a dedicated, full-screen **Booth Mode** for mobile devices.
- Features large touch targets and simplified +/- controls for rapid inventory counting in active environments.

**Fulfillment System:**
- New **Fulfillment Orders** system to track council-level orders.
- Automated inventory updates: Delivered fulfillment orders now automatically increase troop shared inventory.
- Added **Troop Shared Inventory** tracking to the leadership view.

**Parent & Compliance Improvements:**
- New **Parent Dashboard** section showing all linked scouts and their status.
- Implemented **Digital COPPA Consent** flow: parents can now approve minor accounts directly from their dashboard.
- Enhanced login security with specific messaging for accounts requiring parental consent.

**Troop Leader Analytics:**
- Added visual **Cookie Popularity** bars to the troop leader dashboard.
- Improved visual hierarchy for troop performance metrics.

### Technical Details

**Database Schema (v4.5):**
- Added `fulfillment_orders` and `fulfillment_order_items` tables.
- Added `inventory_balances` table with multi-level tracking (Troop, Scout, Booth).
- Refined unique constraints to support both user-linked and troop-shared inventory.

**API Endpoints:**
- `GET /api/troop/:troopId/fulfillment` - List council orders.
- `POST /api/troop/:troopId/fulfillment` - Create a new order.
- `PUT /api/troop/:troopId/fulfillment/:orderId` - Update order status and trigger inventory loop.
- `GET /api/parents/scouts` - Retrieve linked minor accounts.
- `POST /api/parents/approve-scout/:scoutId` - Digital consent processing.
- `GET /api/troop/:troopId/shared-inventory` - View troop shared stock.

**Frontend Modernization:**
- Integrated Lucide Icons via CDN.
- Implemented dynamic icon refreshing for AJAX-rendered content.
- Standardized UI components with glassmorphism tokens.

## [2.0.1] - 2026-02-07

### Major Infrastructure Upgrade: PostgreSQL Migration

This release completes the migration from SQLite to PostgreSQL with UUID primary keys, significantly improving scalability, concurrent user support, and production readiness.

### Added

**Database Migration to PostgreSQL:**
- Migrated from SQLite to PostgreSQL 16 with full UUID support
- Implemented UUID v4 primary keys across all 19 database tables
- Created comprehensive PostgreSQL schema with proper constraints and indexes
- Added connection pooling with pg-pool (configurable pool size 2-10 connections)
- Implemented query helper utilities for abstraction layer
- Added slow query detection and logging (>1000ms threshold)

**Session Storage Migration:**
- Migrated session storage from SQLite to Redis 7
- Implemented automatic session TTL management via Redis
- Added Redis connection error handling and automatic reconnection
- Removed manual session cleanup (Redis handles TTL automatically)

**Code Modernization:**
- Converted all 200+ database queries from synchronous to asynchronous (async/await)
- Updated all 54 API route handlers to async pattern
- Converted Passport authentication strategies to async
- Implemented proper transaction handling with PostgreSQL pattern
- Added comprehensive error handling for all database operations

**Documentation:**
- Created PostgreSQL migration guides and conversion summaries
- Updated all phase documentation with PostgreSQL status
- Added database connection troubleshooting guides
- Created .env.example with PostgreSQL and Redis configuration

### Changed

**Database Architecture:**
- SQLite (synchronous) → PostgreSQL 16 (asynchronous)
- Integer auto-increment IDs → UUID v4 primary keys
- Boolean representation: `0/1` → `true/false`
- Timestamp functions: `datetime('now')` → `NOW()`
- Query placeholders: `?` → `$1, $2, $3...` (PostgreSQL style)
- Column naming: Added quotes for camelCase columns (e.g., `"userId"`, `"firstName"`)

**Session Management:**
- Session store: SQLiteStore → RedisStore
- Session backend: connect-sqlite3 → connect-redis
- TTL management: Manual cleanup → Automatic Redis expiration

**Query Pattern:**
- Synchronous prepared statements → Asynchronous parameterized queries
- `db.prepare().get()` → `await db.getOne()`
- `db.prepare().all()` → `await db.getAll()`
- `db.prepare().run()` → `await db.run()`
- `db.transaction()` → `await db.transaction(async (client) => {...})`

**Dependencies:**
- Added: `pg` (^8.11.3), `pg-pool` (^3.6.1), `redis` (^4.6.12), `connect-redis` (^7.1.0), `uuid` (^9.0.1), `dotenv` (^17.2.4)
- Retained (for backward compatibility): `better-sqlite3`, `connect-sqlite3`

### Infrastructure

**Docker Services:**
- PostgreSQL 16 Alpine with health checks and volume persistence
- Redis 7 Alpine with health checks and data volumes
- Docker Compose configuration for development environment

**Environment Configuration:**
- Added PostgreSQL connection settings (host, port, database, user, password, SSL, pool config)
- Added Redis connection settings (host, port, password, database)
- Implemented dotenv for environment variable management

### Performance

- Connection pooling enables efficient concurrent user support
- Asynchronous queries prevent blocking operations
- Redis session storage provides sub-millisecond session access
- PostgreSQL query optimizer for complex JOIN operations
- Prepared statement caching via pg-pool

### Migration Status

**Completed:**
- ✅ PostgreSQL schema creation with UUIDs (19 tables)
- ✅ Redis session storage implementation
- ✅ All 200+ query conversions to async/await
- ✅ Passport strategy updates
- ✅ Docker containerization
- ✅ Development environment setup
- ✅ Admin user creation
- ✅ Full endpoint testing

**Verified Working:**
- ✅ Authentication (login, logout, session persistence)
- ✅ User profile management
- ✅ Sales CRUD operations
- ✅ Donations CRUD operations
- ✅ Events CRUD operations
- ✅ Payment methods management
- ✅ All troop management endpoints
- ✅ Cookie catalog and seasons
- ✅ Invitation system
- ✅ Bulk imports and exports

### Technical Details

**Schema Enhancements:**
- Foreign key constraints with CASCADE and SET NULL actions
- CHECK constraints for enum-like fields
- Comprehensive indexing on foreign keys and frequently queried columns
- Unique constraints on natural keys (email, googleId, token)
- Proper NULL handling and default values

**Security Improvements:**
- Parameterized queries prevent SQL injection
- Connection pooling with connection limits
- Redis password support for production
- SSL support for PostgreSQL connections
- Audit logging with UUID tracking

### Breaking Changes

**For Developers:**
- All database access must now be asynchronous (requires `await`)
- Column names with camelCase must be quoted in SQL queries
- Transaction syntax changed to PostgreSQL pattern
- Integer IDs replaced with UUID strings
- Boolean values are now `true/false` instead of `0/1`

**For Deployment:**
- Requires PostgreSQL 14+ and Redis 6+ servers
- New environment variables required (see .env.example)
- Database must be initialized with migration scripts
- Docker Compose recommended for local development

### Notes

This is a major infrastructure upgrade that significantly improves the application's ability to scale to multiple concurrent users. The migration to PostgreSQL with UUIDs provides enterprise-grade reliability and prepares the application for production deployment.

All existing functionality has been preserved with 100% feature parity. The asynchronous architecture improves responsiveness under load.

---

## [2.0.0] - 2026-02-02

### Major Release: Multi-User Authentication & Troop Management Foundation

This major release transforms Apex Scout Manager from a single-user application into a comprehensive multi-user troop management platform with enterprise-grade security.

### Added

**Authentication & Security:**
- Multi-user authentication system with email/password and Google OAuth 2.0 support
- Session-based authentication with HTTP-only cookies and IP tracking
- Password hashing with bcryptjs (12 salt rounds)
- Rate limiting on authentication endpoints
- COPPA compliance features for minors (age verification, parental consent tracking)
- Audit logging system for all user actions

**User Management:**
- User registration and login system
- User roles: Scout, Parent, Troop Leader, Council Admin
- Multi-user data isolation - users only see their own data
- Account lockout after failed login attempts

**Organization & Troop Management:**
- Council organization structure
- Multiple troops per council with troop details (number, type, leadership)
- Scout levels support (Daisy, Brownie, Junior, Cadette, Senior, Ambassador)
- Troop membership with role-based permissions
- Scout-parent linking for family account management
- Troop goals tracking (boxes sold, revenue, participation, events)
- Troop invitations and member management

**Database Enhancements:**
- New multi-user schema with foreign key relationships
- Automatic database migration from v1.0 to v2.0
- New tables: users, sessions, councils, troops, troop_members, troop_goals, audit_log, notifications
- Backward compatibility with v1.0 data

**Data Backup & Safety:**
- Automatic timestamped database backups on application startup
- Migration verification script to ensure data integrity
- Backup retention (keeps last 5 backups)

### Changed

**Architecture:**
- Refactored authentication from custom middleware to Passport.js
- Updated all API endpoints to include user context filtering
- All database queries now respect user isolation boundaries
- Docker configuration updated for production deployment

**Data Model:**
- Added `userId` foreign key to: sales, profile, donations, events tables
- Added `troopId` to events for troop-specific tracking
- Profile table now linked to multi-user system
- All existing v1.0 data automatically migrated with admin user assignment

**Frontend:**
- Added login.html and register.html for authentication
- User info displayed in dashboard header
- Added logout functionality
- Session management integrated

### Security

- Implemented role-based access control (RBAC)
- Passport.js authentication strategies (local + Google OAuth)
- Audit trail for compliance and security monitoring
- Removed hardcoded credentials - uses environment variables
- COPPA-compliant minor tracking

### Migration

- Automatic v1.0 → v2.0 database migration with backup
- Default admin user created from v1.0 profile
- All existing sales, donations, and events linked to admin user
- Existing data fully preserved and accessible

### Breaking Changes

- Database schema updated (migration required)
- Login now required to access application
- All API endpoints now require authentication
- User context required for all data operations

## [1.2.0] - 2026-01-21

### Removed
- **Digital Cookie Sync (Scraping)** removed to comply with Digital Cookie Terms of Service.
- **Puppeteer dependencies** removed to reduce application size and complexity.

## [1.1.0] - 2026-01-20

### Added
- **Edit Order functionality** for manual orders - edit customer info, cookies, payment details
- **Status color coding** for Recent Sales table:
  - Green: Complete/Delivered orders
  - Yellow: Shipped orders
  - Blue: In-Person delivery orders
  - Red: Awaiting Payment orders
- **Status legend** below Recent Sales table
- **Order Complete button** replaced checkbox with styled button
- **Multiple payment methods** support with dynamic QR code generation
- **Bordered settings sections** for better visual organization in Settings page

### Changed
- **Digital Cookie Sync** no longer requires Orders Page URL - automatically detected after login
- **Scraper performance** improved with parallel tab processing (3x-5x faster)
- **Cookie Breakdown** now shows individual cookie types instead of "Assorted" for synced orders
- **Online orders** from Digital Cookie sync are automatically marked as Paid
- **Upload Photo button** renamed to "Upload Profile Photo" and moved above Store URL
- **README** updated with corrected Digital Cookie sync instructions

### Fixed
- **Order details extraction** from Digital Cookie - now captures phone, email, address correctly
- **Security vulnerabilities** - replaced vulnerable `xlsx` package with `exceljs`

### Security
- Resolved Dependabot alerts:
  - GHSA-4r6h-8v6p-xvw6 (Prototype Pollution in SheetJS)
  - GHSA-5pgg-2g8v-p4x9 (SheetJS ReDoS vulnerability)

## [1.0.0] - 2026-01-19

### Added
- Initial release
- Cookie sales tracking with individual and event sales
- Digital Cookie sync integration
- Profile management with photo upload
- QR code generation for store links
- Dark mode support
- SQLite database storage
- Docker support
