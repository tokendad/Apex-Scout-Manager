# CLAUDE.md - v2.0 Branch (Development)

**Repository**: `/data/ApexScoutManager`
**Branch**: `v2.0` (Development/Multi-User Features)
**Purpose**: Active development of v2.0 with multi-user authentication, role-based access control, and enhanced features

> **Note**: For production bug fixes and stable code, use the main repository which tracks the `main` branch.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Run Commands

### Docker (Recommended)
```bash
docker-compose up -d          # Start the application (accessible at http://localhost:8282)
docker-compose down           # Stop the application
docker-compose up -d --build  # Rebuild and start
docker-compose logs -f        # View logs
```

### Local Development
```bash
npm install                   # Install dependencies
npm start                     # Start server (runs node server.js on port 3000)
```

### Database Migration
```bash
node migrations/migrate-to-v2.js     # Migrate v1.x to v2.0 (multi-user)
node migrations/verify-migration.js  # Verify migration integrity
```

### Screenshot Generation
```bash
npm run capture-screenshots   # Generate screenshots using Playwright
```

## Architecture Overview

### Tech Stack
- **Backend**: Node.js with Express server
- **Database**: SQLite via better-sqlite3 (synchronous driver, ~1.3x faster than async)
- **Frontend**: Pure HTML/CSS/JavaScript (no frameworks, vanilla JS with fetch API)
- **Authentication**: Passport.js with local (bcryptjs) and Google OAuth 2.0 strategies
- **Session Store**: SQLite-backed sessions (connect-sqlite3)
- **Logging**: Winston with daily rotation and colored console output
- **File Uploads**: Multer with memory storage (10MB limit for XLSX imports)

### Multi-User Architecture (v2.0)

**Phase 1 Status (Current):**
- Multi-user authentication system implemented (local + Google OAuth)
- Role-based access control (RBAC) with 4 roles: scout, parent, troop_leader, council_admin
- User table with COPPA compliance fields (minors require parent consent)
- Audit logging of authentication events with IP/user-agent tracking
- Session management with 7-day expiry and daily cleanup
- Database schema includes userId foreign keys on core tables (sales, events, donations, profile)
- Authorization middleware: `isAuthenticated`, `hasRole()`, `canAccessResource()`

**Phase 2+ (Planned):**
- Troop and council management with hierarchical data access
- Troop goals and member management
- Notification system
- Data deletion requests workflow

### Directory Structure

```
/
├── server.js              # Main Express application (1200+ lines)
├── auth.js                # Authentication middleware (isAuthenticated, hasRole, canAccessResource)
├── passport-config.js     # Passport strategies (local email/password + Google OAuth)
├── logger.js              # Winston logger configuration with rotation
├── public/                # Static frontend files
│   ├── index.html         # Main authenticated dashboard (5-tab SPA interface)
│   ├── login.html         # Login page (public)
│   ├── register.html      # Registration page (public)
│   ├── script.js          # Client-side logic (1700+ lines)
│   └── styles.css         # Responsive CSS with dark mode support
├── migrations/            # Database migration scripts
│   ├── migrate-to-v2.js   # v1.x → v2.0 migration (multi-user schema)
│   └── verify-migration.js # Post-migration validation
├── /data                  # Runtime data directory (configurable via DATA_DIR)
│   ├── asm.db             # Primary SQLite database
│   ├── sessions.db        # Session store database
│   └── logs/              # Winston log files (7-day retention)
```

### Database Schema

**Core Tables (v1.x + userId FK in v2.0):**
```sql
sales:
  id, cookieType, quantity, customerName, date, saleType,
  customerAddress, customerPhone, customerEmail, unitType,
  amountCollected, amountDue, paymentMethod, orderNumber,
  orderType, orderStatus, userId (FK)

profile:
  id (singleton: 1), photoData, qrCodeUrl, paymentQrCodeUrl,
  goalBoxes, goalAmount, inventory_* (9 cookie variants), userId (FK)

donations:
  id, amount, donorName, date, userId (FK)

events:
  id, eventName, eventDate, description, initialBoxes, initialCases,
  remainingBoxes, remainingCases, donationsReceived, userId (FK), troopId (FK)

payment_methods:
  id, name, url, isEnabled
```

**Multi-User Tables (v2.0):**
```sql
users:
  id, email (UNIQUE), password_hash, firstName, lastName, googleId (UNIQUE),
  photoUrl, role, dateOfBirth, isMinor, parentEmail, parentConsentDate,
  parentConsentIP, isActive, emailVerified, createdAt, lastLogin

sessions:
  id, userId (FK), sessionToken, expiresAt, ipAddress, userAgent, createdAt

councils:
  id, name, region, contactEmail, contactPhone, address, website, settings

troops:
  id, councilId (FK), troopNumber, troopType, leaderId (FK),
  meetingLocation, meetingDay, meetingTime, settings

troop_members:
  id, troopId (FK), userId (FK), role, joinDate, leaveDate, status

troop_goals:
  id, troopId (FK), goalType, targetAmount, actualAmount,
  startDate, endDate, status, description

audit_log:
  id, userId (FK), action, resourceType, resourceId, ipAddress,
  userAgent, details, timestamp

notifications:
  id, userId (FK), type, title, message, isRead, actionUrl,
  createdAt, readAt

data_deletion_requests:
  id, userId (FK), requestedBy (FK), reason, requestDate,
  completionDate, status
```

### API Endpoints

**Public Routes:**
- `GET /login.html` - Login page
- `GET /register.html` - Registration page
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - Local email/password login
- `GET /api/auth/google` - Google OAuth redirect
- `GET /api/auth/google/callback` - Google OAuth callback

**Authenticated Routes (require session):**
- `GET /` - Main dashboard (redirects to /login.html if not authenticated)
- `POST /api/auth/logout` - Session logout
- `GET /api/auth/me` - Current user info

**Resource Routes (CRUD with authorization):**
- `GET/POST/PUT/DELETE /api/sales` - Cookie sales management
- `GET/PUT /api/profile` - User profile with goals and inventory
- `GET/POST/DELETE /api/donations` - Donation tracking
- `GET/POST/PUT/DELETE /api/events` - Event sales tracking
- `GET/POST/PUT/DELETE /api/payment-methods` - Payment provider QR codes
- `POST /api/import` - Bulk order import from XLSX (Multer upload)
- `GET /api/export` - Export sales data to XLSX
- `GET /api/health` - Health check endpoint

**Rate Limiting:**
All `/api/*` routes limited to 100 requests per 15-minute window per IP.

### Frontend Architecture

**Tab-Based Navigation:**
The dashboard (`index.html`) uses a 5-tab interface:
1. **Profile** - Scout photo, goals, QR codes for payment methods
2. **Summary** - Total boxes sold, revenue, donation stats, cookie breakdown chart
3. **Individual Sales** - Form to add/edit orders, sales table with inline editing
4. **Events** - Booth sales tracking with inventory management
5. **Settings** - Data import/export, payment method configuration, bulk delete

**Data Flow Pattern:**
```
Page Load → init() → Promise.all([loadSales(), loadProfile(), ...]) → render*() functions
User Action → Event Handler → fetch POST/PUT/DELETE → loadData() → render*()
```

**In-Memory Cache:**
`script.js` maintains local arrays (`sales`, `donations`, `events`, `paymentMethods`, `profile`) that are refreshed on each page load. No persistent client-side state.

**Mobile Optimization:**
- Viewport meta tags for proper scaling
- 48px minimum touch targets
- CSS Grid + Flexbox responsive layout
- Dark mode via `prefers-color-scheme` media query
- Progressive Web App capable (add to home screen)

## Key Development Patterns

### Authentication Flow
1. User visits `/` → middleware checks `req.session.userId`
2. If not authenticated → redirect to `/login.html`
3. Login form submits to `/api/auth/login` → Passport local strategy
4. On success → create session → redirect to `/`
5. Protected routes use `auth.isAuthenticated` middleware

### Authorization Pattern
```javascript
// Role-based access
app.get('/api/troop/data', auth.isAuthenticated, auth.hasRole('troop_leader', 'council_admin'), (req, res) => {
  // Only troop leaders and council admins can access
});

// Resource ownership check
app.put('/api/sales/:id', auth.isAuthenticated, auth.canAccessResource('sales'), (req, res) => {
  // User can only edit their own sales unless they have elevated permissions
});
```

### Database Access Pattern
Always use prepared statements to prevent SQL injection:
```javascript
const stmt = db.prepare('SELECT * FROM sales WHERE userId = ?');
const sales = stmt.all(req.session.userId);
```

For mutations:
```javascript
const stmt = db.prepare('INSERT INTO sales (cookieType, quantity, userId) VALUES (?, ?, ?)');
const result = stmt.run(cookieType, quantity, req.session.userId);
const newId = result.lastInsertRowid;
```

For transactions (atomic multi-operation):
```javascript
const insert = db.prepare('INSERT INTO sales ...');
const transaction = db.transaction((sales) => {
  for (const sale of sales) insert.run(sale);
});
transaction(salesArray);
```

### Migration Pattern
Migrations in `server.js` are idempotent and run on every startup:
```javascript
// Check if column exists before adding
const columns = db.pragma('table_info(sales)');
if (!columns.find(c => c.name === 'userId')) {
  db.exec('ALTER TABLE sales ADD COLUMN userId INTEGER');
}
```

For major schema changes, use dedicated migration scripts in `/migrations/` with:
- Automatic backup creation (`gsctracker.db.backup.{timestamp}`)
- Transaction wrapping (`BEGIN TRANSACTION` ... `COMMIT`)
- Verification script for post-migration validation

### Error Handling
- Server-side: Try-catch with logger + appropriate HTTP status codes
- Client-side: Fetch error handling with user-friendly alerts
- Security: No sensitive data in error messages or logs

### Logging Pattern
Use Winston logger instead of console.log:
```javascript
logger.info('User logged in', { userId: user.id, email: user.email });
logger.warn('Failed login attempt', { email, ip: req.ip });
logger.error('Database error', { error: err.message, stack: err.stack });
```

Logs are stored in `/data/logs/` with:
- `asm-YYYY-MM-DD.log` - All logs
- `error-YYYY-MM-DD.log` - Errors only
- 7-day retention with daily rotation

## Environment Variables

**Required in Production:**
- `SESSION_SECRET` - Change from default insecure value
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `GOOGLE_CALLBACK_URL` - OAuth redirect URL (e.g., `http://localhost:3000/api/auth/google/callback`)

**Optional Configuration:**
- `PORT` - Server port (default: 3000)
- `DATA_DIR` - Database/log directory (default: `/data`)
- `LOG_DIR` - Log directory (default: `$DATA_DIR/logs`)
- `LOG_LEVEL` - Winston log level (default: `info`)
- `NODE_ENV` - Set to `production` for HTTPS-only secure cookies
- `CORS_ORIGIN` - CORS whitelist (default: `http://localhost:3000`)

See `.env.example` for template.

## Important Conventions

### Cookie Types
The app tracks 9 cookie varieties (plus "Donated Cookies"):
- Thin Mints, Samoas, Tagalongs, Trefoils, Do-si-dos
- Lemon-Ups, Adventurefuls, Toffee-tastic, Caramel Chocolate Chip

Price: $6 per box (configurable via `PRICE_PER_BOX` constant in `script.js`)

### Unit Handling
Sales can be recorded in boxes or cases:
- 1 case = 12 boxes
- `convertToBoxes()` function normalizes to box units

### Database Naming
- Tables/columns: snake_case (`password_hash`, `troop_members`)
- Some legacy camelCase fields exist (`firstName`, `lastName`)
- DOM IDs: camelCase with prefixes (`inventoryThinMints`, `totalBoxesInput`)

### Security Practices
- **Password Hashing**: bcryptjs with 12 salt rounds
- **SQL Injection Prevention**: Parameterized queries throughout
- **Session Security**: HttpOnly cookies, secure flag in production, 7-day expiry
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Audit Logging**: Track auth events with IP and user-agent
- **COPPA Compliance**: Minors require parent email and consent

### COPPA Compliance for Minors
When implementing features involving users under 13:
- Check `isMinor` flag before allowing actions
- Require `parentEmail` at registration
- Default `isActive = 0` until `parentConsentDate` is set
- Store `parentConsentIP` for legal compliance
- Notify parents via email (when email feature is implemented)

## Git Workflow

**Repository Structure:**
- **`/data/ApexScoutManager`** - Main/Production branch repository
  - Branch: `main`
  - Stable, production-ready code (v1.x)
  - Bug fixes and critical patches only

- **`/data/ApexScoutManager`** (this directory) - v2.0 Development repository
  - Branch: `v2.0`
  - Multi-user features, RBAC, enhanced functionality
  - Active development work

**Branch Strategy:**
- `main` - Production branch (v1.x stable)
- `v2.0` - Multi-user development branch (current work)

**Committing to v2.0:**
All changes should be committed directly to the `v2.0` branch and pushed to:
`https://github.com/tokendad/ApexScoutManager/` (remote: origin/v2.0)

**When Working on Code:**
- **New features and v2.0 development**: Work in `/data/ApexScoutManager` (this directory) on the `v2.0` branch
- **Production bug fixes**: Work in `/data/ApexScoutManager` on the `main` branch
- Always verify you're in the correct directory before making changes

**Changelog:**
Update `CHANGELOG.md` when merging PRs. The changelog is automatically updated from PR titles with appropriate labels (`feature`, `bug`, `documentation`).
