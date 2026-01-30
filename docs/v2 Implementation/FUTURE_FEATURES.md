# GSCTracker 2.0 - Future Features & Roadmap

This document outlines the planned features and enhancements for GSCTracker 2.0, focusing on multi-user support, compliance, and troop-level management features.

---

## ✅ v2.0 Implementation Status (PR #106)

**Status:** Completed and Merged (January 30, 2026)

PR #106 implemented the foundational security and authentication system for COPPA compliance. This represents the initial phase of the v2.0 roadmap, establishing secure user authentication and data encryption.

### Implemented Features

#### Authentication System ✅
- **User Management:** Username/password-based authentication system
- **Password Security:** bcrypt hashing with 12 rounds
- **Session Management:** HTTP-only, SameSite=Strict cookies with 24-hour expiration
- **Rate Limiting:** 5 login attempts per 15 minutes with account lockout on failure
- **Login/Registration UI:** Dedicated authentication pages with user display
- **Logout Functionality:** Session termination with secure cleanup
- **Authentication Middleware:** All API endpoints protected via `requireAuth`

#### Data Encryption ✅
- **Field-Level Encryption:** AES-256-GCM for sensitive data (emails, extensible to phone/address)
- **Key Management:** Environment variable-based encryption key (`ENCRYPTION_KEY`)
- **Crypto Utilities:** Centralized encryption/decryption functions in `crypto-util.js`
- **Database Security:** Encrypted storage for sensitive user information

#### Security Headers & Middleware ✅
- **Helmet.js Integration:** CSP, HSTS, X-Frame-Options, X-XSS-Protection
- **CSRF Protection:** SameSite=Strict cookies (mitigates 95%+ of CSRF attacks)
- **SQL Injection Prevention:** Prepared statements throughout codebase
- **Environment Configuration:** Production-ready with `SESSION_SECRET` and `ENCRYPTION_KEY`

#### Database Schema ✅
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,        -- bcrypt hashed
    email TEXT,                         -- AES-256-GCM encrypted
    isActive INTEGER DEFAULT 1,
    lastLogin TEXT
);
```

### Deferred to v2.1

The following features were identified during PR #106 implementation but deferred to future releases:

#### Recommended for v2.1
1. **Token-Based CSRF Protection:** Traditional CSRF tokens for defense-in-depth
2. **COPPA Age Verification:** Date of birth collection and validation
3. **Parental Consent Flow:** Email-based consent system for users under 13
4. **Google OAuth Integration:** "Sign in with Google" for simplified authentication
5. **Email Verification:** Account activation via email confirmation
6. **Password Reset/Recovery:** Self-service password reset functionality
7. **Advanced Rate Limiting:** Distributed rate limiting for scaled deployments
8. **Audit Logging:** Comprehensive logging of sensitive data access

#### Security Recommendations for v2.1+
- **HTTPS Enforcement:** Require TLS/SSL in production (currently documented)
- **Enhanced Session Security:** Implement session rotation and fingerprinting
- **Multi-Factor Authentication (MFA):** Optional 2FA for enhanced security
- **Biometric Authentication:** Future consideration for mobile apps

### Setup Requirements

**Production Environment Variables:**
```bash
export ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
export SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
export NODE_ENV=production
```

**Required for Production:**
- HTTPS/TLS via reverse proxy (nginx, Caddy, or cloud provider)
- Secure environment variable storage
- Regular key rotation procedures

### Security Notes from PR #106

- **CodeQL Scan:** Identified missing token-based CSRF; mitigated via SameSite=Strict cookies
- **Dependency Audit:** bcrypt 6.0.0 scanned with no vulnerabilities
- **Browser Compatibility:** SameSite=Strict supported by 95%+ of modern browsers

---

## Version 2.0 Goals

Transform GSCTracker from a single-user application into a multi-user, **troop-level** management platform with enterprise-grade security and COPPA compliance features suitable for Girl Scout troops, scouts, and their parents.

### Scope Definition

**In Scope:**
- Troop-level management
- Scout (child) tracking and reporting
- Parent/Guardian access and oversight
- Troop Leader and Cookie Leader roles
- Integration with external fulfillment (council inventory) for ordering only

**Out of Scope:**
- Council-level management features
- Multi-council administration
- Council inventory management (except as external fulfillment source)

### Key Terminology

| Term | Definition |
|------|------------|
| **Scout** (Child) | Girl Scout member selling cookies |
| **Parent** | Parent/Guardian of Scout(s) |
| **Troop Leader** | Adult leader of the troop |
| **Cookie Leader** | Adult responsible for fulfilling orders and placing orders with fulfillment |
| **Fulfillment** | Council-level master inventory for the region (external system) |
| **Troop Booth** | Event created and manned by multiple scouts, parents, and leaders on rotating basis |
| **Family Booth** | Booth created and run by one scout/family individually |

---

## 1. Multi-User Support & Authentication

### 1.1 User Management System
**Goal:** Support multiple users with role-based access control

**Status:** ✅ **Partially Implemented in PR #106** (Basic authentication complete, advanced features pending)

**Implemented (v2.0):**
- ✅ User registration and profile management (username/password)
- ✅ User account activation/deactivation
- ✅ Last login tracking and session management
- ✅ Basic `users` table with encrypted email storage

**Pending (v2.1+):**
- ⏳ Email verification for new accounts
- ⏳ Password reset/recovery functionality
- ⏳ Enhanced `sessions` table with detailed tracking
- ⏳ `userId` foreign key additions to existing tables

**Database Changes:**
- ✅ **Implemented:** `users` table: `id`, `username`, `password_hash`, `email` (encrypted), `isActive`, `lastLogin`
- ⏳ **Pending:** Extended fields: `firstName`, `lastName`, `role`, `emailVerified`, `createdAt`
- ⏳ **Pending:** `sessions` table: `id`, `userId`, `sessionToken`, `expiresAt`, `ipAddress`, `userAgent`
- ⏳ **Pending:** Add `userId` foreign key to existing tables (`profile`, `sales`, `donations`, `events`)

### 1.2 Google OAuth Integration
**Goal:** Simplify authentication with secure Google Sign-In

**Status:** ⏳ **Deferred to v2.1** (Foundation established with current authentication system)

**Implementation:**
- Integrate Google OAuth 2.0 for authentication
- Support "Sign in with Google" buttons
- Link existing accounts to Google accounts
- Store OAuth tokens securely (encrypted)
- Support OAuth token refresh

**Benefits:**
- No password management for users
- Reduced security risk
- Faster onboarding
- COPPA-compliant parental consent flow

**Technical Stack:**
- `passport` + `passport-google-oauth20` for Node.js
- Google Cloud Platform OAuth 2.0 credentials
- Secure token storage with encryption

### 1.3 Role-Based Access Control (RBAC)
**Goal:** Implement granular permissions for different user types

**User Roles:**
1. **Scout** (Child - Basic User)
   - Manage own profile, sales, and donations
   - View own statistics and reports
   - Record individual sales and family booth events
   - Cannot access other scouts' data

2. **Parent/Guardian** (Limited Access)
   - View their scout's data (read-only or limited edit)
   - Receive notifications about their scout's progress
   - Assist with recording sales on behalf of scout
   - View payment status and outstanding balances

3. **Troop Leader** (Manager)
   - View and manage all scouts in their troop
   - Create and manage troop booth events
   - Generate troop-level reports
   - Manage troop settings and goals
   - Assign scouts to troop booth shifts

4. **Cookie Leader** (Fulfillment Manager)
   - All Troop Leader permissions
   - Place orders with fulfillment (council)
   - Track troop inventory
   - Manage cookie distribution to scouts
   - Reconcile inventory and payments

**Permissions Matrix:**
| Feature | Scout | Parent | Troop Leader | Cookie Leader |
|---------|-------|--------|--------------|---------------|
| Own Sales CRUD | ✓ | ✓ (limited) | ✓ | ✓ |
| Other Scout's Sales | ✗ | ✗ | ✓ (view/edit) | ✓ (view/edit) |
| Family Booth Events | ✓ | ✓ | ✓ | ✓ |
| Troop Booth Events | View only | View only | ✓ (create/manage) | ✓ (create/manage) |
| Troop Reports | ✗ | ✗ | ✓ | ✓ |
| Inventory Management | Own only | Own scout only | ✓ (troop-level) | ✓ (full access) |
| Fulfillment Orders | ✗ | ✗ | ✗ | ✓ |
| User Management | ✗ | ✗ | ✓ (troop only) | ✓ (troop only) |

---

## 2. Security & COPPA Compliance

### 2.1 TLS/SSL Encryption
**Goal:** Ensure all data transmission is encrypted to protect minors' information

**Status:** ✅ **Partially Implemented in PR #106** (Headers configured, deployment required)

**Implemented (v2.0):**
- ✅ HSTS (HTTP Strict Transport Security) headers via Helmet.js
- ✅ Secure cookie flags (Secure, HttpOnly, SameSite)

**Pending (Production Deployment):**
- ⏳ Enforce HTTPS for all connections (requires reverse proxy setup)
- ⏳ TLS 1.2+ minimum (preferably TLS 1.3)
- ⏳ Valid SSL certificates (Let's Encrypt for self-hosted, managed for cloud)
- ⏳ HTTP to HTTPS redirect
- ⏳ Docker image with built-in HTTPS support
- ⏳ Automatic certificate renewal (certbot)
- ⏳ Configuration guide for reverse proxy (nginx/Caddy)
- ⏳ Development mode with self-signed certificates

**Note:** See `docs/SECURITY.md` for reverse proxy configuration guidance.

### 2.2 COPPA Compliance Features
**Goal:** Comply with Children's Online Privacy Protection Act requirements

**Status:** ⏳ **Deferred to v2.1** (Foundation established with data encryption and security)

**Current Implementation (v2.0):**
- ✅ Secure data storage with AES-256-GCM encryption
- ✅ Minimal authentication data collection
- ✅ No behavioral advertising or tracking

**Key Requirements for v2.1:**
- Parental consent for users under 13
- Minimal data collection from children
- Parental access to child's data
- Data deletion requests
- Clear privacy policy
- No behavioral advertising
- Secure data storage

**Implementation:**
1. **Age Verification:** Date of birth collection during registration
2. **Parental Consent Flow:**
   - If user < 13, require parent email
   - Send parental consent form via email
   - Parent must approve before account activation
   - Consent records stored with timestamp

3. **Privacy Controls:**
   - Privacy policy acceptance checkbox
   - Data collection disclosure (what we collect, why, how long)
   - Parent dashboard to view/delete child's data
   - Data export functionality (JSON/CSV)

4. **Data Minimization:**
   - Only collect essential information
   - Optional fields clearly marked
   - Regular data retention review
   - Automatic data purging after configurable period

5. **Audit Trail:**
   - Log all access to minor's data
   - Track consent history
   - Record data deletion requests

**Database Changes:**
- Add to `users` table: `dateOfBirth`, `isMinor`, `parentEmail`, `parentConsentDate`, `parentConsentIP`
- New `audit_log` table: `id`, `userId`, `action`, `resourceType`, `resourceId`, `ipAddress`, `timestamp`, `details`
- New `data_deletion_requests` table: `id`, `userId`, `requestDate`, `completionDate`, `status`

### 2.3 Data Security Enhancements
**Goal:** Protect sensitive user information

**Status:** ✅ **Implemented in PR #106** (Core features complete, advanced features pending)

**Implemented (v2.0):**
- ✅ Password hashing with bcrypt (12 rounds)
- ✅ Encryption at rest for sensitive fields (emails via AES-256-GCM, extensible to phone/addresses)
- ✅ Rate limiting on authentication endpoints (5 attempts per 15 minutes)
- ✅ Account lockout after failed login attempts
- ✅ Session timeout (24-hour expiration)
- ✅ SQL injection prevention (prepared statements)
- ✅ XSS protection (CSP headers via Helmet.js)
- ✅ CSRF protection (SameSite=Strict cookies)

**Pending (v2.1+):**
- ⏳ Inactivity logout detection
- ⏳ IP-based suspicious activity detection
- ⏳ Token-based CSRF protection (defense-in-depth)
- ⏳ Advanced audit logging
- ⏳ Session rotation and fingerprinting

**Technical Implementation:**
- `crypto-util.js`: AES-256-GCM encryption/decryption utilities
- `auth-middleware.js`: Authentication and rate limiting middleware
- Helmet.js: Security headers (CSP, HSTS, X-Frame-Options, X-XSS-Protection)
- bcrypt: Password hashing library (v6.0.0, no known vulnerabilities)

---

## 3. Troop-Level Management

### 3.1 Troop Hierarchy & Organization
**Goal:** Support organizational structure at the troop level

**Data Model:**
```
Troop
  ├── Cookie Leader(s)
  ├── Troop Leader(s)
  ├── Scouts (Children)
  └── Parents/Guardians
```

**Database Tables:**
- `troops` table: `id`, `troopNumber`, `troopType` (Daisy/Brownie/Junior/Cadette/Senior/Ambassador), `season`, `meetingLocation`, `settings`
- `troop_members` table: `id`, `troopId`, `userId`, `role` (scout/parent/troop_leader/cookie_leader), `joinDate`, `status`, `linkedScoutId` (for parents)
- `fulfillment_info` table: `id`, `troopId`, `contactName`, `contactEmail`, `contactPhone`, `orderingInstructions`, `notes`

**Features:**
- Troop creation and management
- Scout enrollment and assignment
- Parent linking to scouts
- Troop leader and cookie leader assignment
- Season/year management (cookie selling seasons)
- External fulfillment contact information

### 3.2 Troop-Wide Goals & Tracking
**Goal:** Set and track goals at the troop level

**Features:**
- Troop sales goals (total boxes, revenue)
- Troop participation goals (% of scouts selling)
- Cookie type distribution targets
- Event attendance tracking
- Progress visualization (charts, progress bars)
- Goal achievement notifications
- Historical goal tracking

**Database Changes:**
- `troop_goals` table: `id`, `troopId`, `goalType`, `targetAmount`, `startDate`, `endDate`, `status`, `actualAmount`

### 3.3 Troop Dashboard
**Goal:** Centralized view for troop leaders

**Dashboard Sections:**
1. **Overview:** Total sales, active scouts, recent activity
2. **Scout Roster:** List of all scouts with status and sales
3. **Leaderboard:** Top sellers, most improved
4. **Upcoming Events:** Calendar of troop events
5. **Alerts:** Scouts needing attention (low sales, missed events)
6. **Quick Actions:** Add sale, add event, message troop

---

## 4. Enhanced Reporting & Analytics

### 4.1 Summary Reports
**Goal:** Comprehensive reporting for all user levels

**Scout-Level Reports:**
- Personal sales summary (boxes sold, revenue, payment status)
- Cookie type breakdown
- Sales by channel (online, events, individual)
- Sales timeline (daily, weekly, monthly trends)
- Payment collection status
- Customer list with contact info

**Troop-Level Reports:**
- Troop sales summary (total boxes, revenue, average per scout)
- Scout comparison and rankings
- Event performance analysis
- Cookie inventory status
- Payment collection summary
- Geographic distribution of sales (within troop territory)

### 4.2 Export & Sharing
**Goal:** Export reports in multiple formats

**Features:**
- PDF export with professional formatting
- Excel/CSV export for data analysis
- Scheduled email reports (daily, weekly, monthly)
- Shareable links with access control
- Print-optimized views
- Data visualization (charts, graphs)

**Export Formats:**
- PDF: Professional reports with charts
- Excel: Detailed data with formulas
- CSV: Raw data for analysis
- JSON: API integration

### 4.3 Advanced Analytics
**Goal:** Provide insights to improve sales performance

**Features:**
- Sales trends and forecasting
- Peak selling times identification
- Customer retention analysis
- Cookie variety popularity trends
- Event ROI analysis
- Scout performance patterns
- Predictive goal achievement

**Visualizations:**
- Line charts for sales trends
- Bar charts for cookie type comparison
- Pie charts for sales channel breakdown
- Heat maps for selling patterns
- Funnel charts for sales pipeline

---

## 5. Communication & Collaboration

### 5.1 In-App Messaging
**Goal:** Enable communication between troop members

**Features:**
- Direct messages between users
- Troop-wide announcements
- Event reminders and notifications
- Sales milestone celebrations
- Read receipts and typing indicators
- Message history and search

**COPPA Considerations:**
- Parental approval for minor messaging
- Monitored conversations for minors
- Report inappropriate content
- Parent access to child's messages

### 5.2 Notification System
**Goal:** Keep users informed of important events

**Notification Types:**
- New sale recorded
- Goal milestone reached
- Event reminder (24hr, 1hr before)
- Payment collected
- Troop announcement
- Account activity alerts

**Delivery Channels:**
- In-app notifications
- Email notifications
- SMS/text notifications (optional)
- Push notifications (PWA)

**Settings:**
- Per-notification type preferences
- Quiet hours configuration
- Digest mode (daily summary)

### 5.3 Troop Calendar
**Goal:** Centralized event management

**Features:**
- Shared troop calendar
- Event creation and editing
- RSVP functionality
- Event reminders
- Recurring events support
- Export to Google Calendar/iCal
- Event types (booth sales, meetings, deliveries)

---

## 5.5 Cookie Product Management

**Goal:** Flexible cookie catalog that can be updated yearly

**Features:**
- Admin interface to add/remove/update cookie types
- Season-specific cookie catalogs
- Cookie attributes:
  - Name and description
  - Price per box
  - Boxes per case
  - Nutrition information (calories, serving size, etc.)
  - Dietary attributes (Gluten Free, Vegan, Non-Dairy, Nut-Free, etc.)
  - Active/Inactive status
  - Available dates (season dates)
- Archive old cookie types for historical reporting
- Import/export cookie catalog
- Default catalog for new seasons

**Database Changes:**
- `cookie_products` table: `id`, `season`, `cookieName`, `description`, `pricePerBox`, `boxesPerCase`, `isActive`, `sortOrder`
- `cookie_attributes` table: `id`, `productId`, `attributeType` (dietary/allergen/other), `attributeValue`, `displayLabel`
- `cookie_nutrition` table: `id`, `productId`, `servingSize`, `servingsPerBox`, `calories`, `totalFat`, `saturatedFat`, `transFat`, `cholesterol`, `sodium`, `totalCarbs`, `dietaryFiber`, `sugars`, `protein`, `ingredients`

**UI Features:**
- Cookie catalog editor (troop leader/cookie leader only)
- Bulk copy catalog from previous season
- Visual badges for dietary attributes (GF, V, DF icons)
- Nutrition label view

---

## 6. Booth Event Management

### 6.1 Troop Booth Events
**Goal:** Comprehensive tracking for multi-scout booth sales events

**Booth Types:**
1. **Troop Booth:** Managed by troop with rotating scout/parent shifts
2. **Family Booth:** Managed by individual scout/family

**Troop Booth Features:**
- Event creation with date, time, location
- Shift scheduling (rotating scouts and parents)
- Starting inventory breakdown by cookie type
- Ending inventory breakdown by cookie type
- Automatic calculation of cookies sold
- Multi-payment tracking:
  - Cash collected
  - Checks received
  - Digital Cookie store sales
  - Payment processor (Venmo, PayPal, etc.)
- Starting cash bank (change fund)
- Final sales total (excluding starting bank)
- Individual scout credit for their shifts
- Parent/volunteer assignment

**Family Booth Features:**
- Same tracking as troop booth but single scout/family
- Credit goes entirely to the scout
- Simpler shift management (just the family)

**Database Changes:**
- `booth_events` table: `id`, `troopId`, `eventType` (troop/family), `scoutId` (for family booths), `eventName`, `location`, `startDateTime`, `endDateTime`, `startingBank`, `status`
- `booth_shifts` table: `id`, `boothEventId`, `scoutId`, `parentId`, `startTime`, `endTime`, `notes`
- `booth_inventory` table: `id`, `boothEventId`, `cookieType`, `startingQty`, `endingQty`, `soldQty`
- `booth_payments` table: `id`, `boothEventId`, `paymentType` (cash/check/digital_cookie/venmo/paypal/other), `amount`, `notes`

**UI Requirements (See: Cookie_Booth_Sheet idea.xlsx):**
- Pre-event setup: Starting inventory, starting bank
- During event: Quick sale entry, payment tracking
- Post-event: Final inventory count, reconciliation, shift credit allocation

### 6.2 Inventory Management

**Goal:** Track cookie inventory at multiple levels

**Inventory Levels:**
1. **Troop Inventory:** Shared troop stock managed by cookie leader
2. **Troop Booth Inventory:** Specific allocation for booth events
3. **Scout Personal Inventory:** Individual scout's on-hand cookies
4. **Scout Event Inventory:** Allocation for family booth events

**Features:**
- Initial inventory allocation from fulfillment
- Real-time inventory updates
- Low stock alerts for scouts and troop
- Transfer cookies between scouts
- Transfer from troop inventory to scout
- Damaged/expired cookie tracking
- Inventory reconciliation
- Reorder recommendations

**Database Changes:**
- `inventory_transactions` table: `id`, `userId`, `cookieType`, `quantity`, `transactionType` (received/sold/damaged/transferred/allocated), `fromInventoryType`, `toInventoryType`, `timestamp`, `notes`, `relatedEventId`
- `inventory_balances` table: `id`, `userId`, `troopId`, `inventoryType` (troop/scout_personal/booth), `cookieType`, `quantity`, `lastUpdated`
- `fulfillment_orders` table: `id`, `troopId`, `orderedBy`, `orderDate`, `deliveryDate`, `status`, `totalBoxes`, `notes`
- `fulfillment_order_items` table: `id`, `orderId`, `cookieType`, `quantity`, `unitPrice`

---

## 6.3 Sales Process Workflows

**Goal:** Support complete sales and fulfillment workflows

### Basic Individual Sales Process

**Workflow:**
1. **Scout Records Sale:**
   - Scout takes orders from customers (multiple sales entries)
   - Orders can be paid at time of sale OR marked for later payment
   - Payment methods: Cash, Check, Digital Cookie store, Payment processor (Venmo/PayPal)

2. **Weekly Fulfillment:**
   - Scout brings sales report to troop meeting (usually weekly)
   - Troop leader or cookie leader reviews orders

3. **Order Fulfillment:**
   - Cookie leader checks troop inventory
   - **Option A:** Pull from troop inventory if available
   - **Option B:** Place order with fulfillment (council) if stock insufficient
   - Individual orders are tracked separately

4. **Delivery:**
   - Cookies distributed to scout
   - Scout delivers to customers
   - Payments collected (if not already paid)
   - Scout returns money to cookie leader

### Troop Booth Sales Process

**Workflow:**
1. **Event Planning:**
   - Troop leader creates booth event
   - Sets date, time, location
   - Assigns scout shifts (rotating participation)

2. **Inventory Allocation:**
   - Cookie leader estimates needed inventory
   - Places order with fulfillment
   - May include individual scout orders + booth inventory in same fulfillment order

3. **Order Receipt:**
   - Fulfillment order arrives
   - Individual scout orders separated and distributed
   - Booth inventory kept separate for event

4. **Booth Event:**
   - Starting inventory counted
   - Starting bank (cash for change) established
   - Scouts work shifts selling cookies
   - Payments tracked by type (cash/check/digital/venmo/paypal)
   - Ending inventory counted
   - Final sales total calculated (excluding starting bank)

5. **Reconciliation:**
   - Calculate boxes sold (starting - ending inventory)
   - Verify money collected matches boxes sold
   - Credit scouts for their shift participation
   - Return unsold inventory to troop stock

### Family Booth Sales Process

**Workflow:**
1. **Scout Plans Event:**
   - Scout/parent identifies opportunity (location, time)
   - Records as family booth event

2. **Inventory:**
   - Uses scout's personal inventory
   - OR requests allocation from troop inventory

3. **Event Execution:**
   - Same tracking as troop booth (start/end inventory, payments)
   - All credit goes to individual scout

4. **Reconciliation:**
   - Scout reports sales and payments
   - Updates personal inventory

### Fulfillment Order Management

**Features:**
- Cookie leader places orders with external fulfillment
- Order tracking: Placed → Confirmed → In Transit → Delivered
- Orders can combine:
  - Individual scout orders
  - Troop booth event inventory
  - Troop general inventory replenishment
- Track order cost, delivery date, delivery method
- Link delivered items to scout inventory/booth events

**Database:**
- `fulfillment_orders` table tracks orders
- `fulfillment_order_items` table tracks individual line items
- `fulfillment_allocations` table links delivered items to scouts/events/troop inventory

---

## 7. Payment Processing & Financial Management

### 7.1 Integrated Payment Processing
**Goal:** Accept payments directly through the app

**Features:**
- Stripe/Square integration
- Accept credit/debit cards
- QR code payment links
- Payment receipt generation
- Refund processing
- Split payments (partial payment tracking)

**COPPA Note:** Payment processing must comply with payment card industry standards and maintain COPPA compliance for minor's information.

### 7.2 Financial Reporting
**Goal:** Comprehensive financial tracking

**Features:**
- Money owed tracking
- Payment collection status
- Cash vs digital payment breakdown
- Outstanding balance reports
- Payment history
- Financial reconciliation tools
- Tax reporting support (for donations)

### 7.3 Troop Finances
**Goal:** Manage troop-level finances

**Features:**
- Troop account balance
- Proceeds calculation (total revenue - costs)
- Per-scout earnings tracking
- Troop activity fund management
- Expense tracking
- Profit distribution reports

---

## 8. Mobile App Development

### 8.1 Native Mobile Apps
**Goal:** Provide native mobile experience

**Platforms:**
- iOS (React Native or Flutter)
- Android (React Native or Flutter)

**Features:**
- Offline mode with sync
- Camera integration for receipts
- Push notifications
- Biometric authentication
- Location services for event check-in
- NFC/QR code scanning

### 8.2 Progressive Web App (PWA) Enhancements
**Goal:** Improve existing PWA capabilities

**Features:**
- Enhanced offline support
- Background sync
- Install prompts
- App shortcuts
- Share target integration
- File handling
- Improved caching strategy

---

## 9. Integration & API

### 9.1 Public API
**Goal:** Allow third-party integrations

**Features:**
- RESTful API with authentication
- API key management
- Rate limiting
- Webhook support
- Comprehensive API documentation
- SDKs for popular languages

**Use Cases:**
- Custom reporting tools for troop leaders
- Troop management dashboards
- Integration with Girl Scouts Digital Cookie platform
- Mobile app integration
- Third-party analytics and visualization tools

### 9.2 Girl Scouts Digital Cookie Integration
**Goal:** Re-implement Digital Cookie sync with official API

**Features:**
- Official API integration (if available)
- Automatic order import
- Two-way sync (updates both systems)
- Conflict resolution
- Sync status dashboard

**Note:** Only implement if official API becomes available and Terms of Service permit integration.

### 9.3 Import/Export Improvements
**Goal:** Better data portability

**Features:**
- Bulk import from CSV/Excel
- Import validation and error handling
- Template downloads
- Mapping wizard for custom formats
- Automatic duplicate detection
- Import history and rollback

---

## 10. User Experience Enhancements

### 10.1 Onboarding & Training
**Goal:** Help new users get started quickly

**Features:**
- Interactive tutorial on first login
- Contextual help tooltips
- Video tutorials
- FAQ/Knowledge base
- In-app chat support
- Sample data mode for testing

### 10.2 Accessibility Improvements
**Goal:** Make app usable for all users

**Features:**
- WCAG 2.1 AA compliance
- Screen reader optimization
- Keyboard navigation
- High contrast mode
- Font size adjustment
- Alternative text for images
- ARIA labels

### 10.3 Internationalization (i18n)
**Goal:** Support multiple languages

**Features:**
- Multi-language support
- Locale-specific formatting (dates, currency)
- Right-to-left language support
- Translation management
- User language preferences

**Initial Languages:**
- English (US)
- Spanish (ES)
- French (FR)

---

## 11. Performance & Scalability

### 11.1 Database Optimization
**Goal:** Support larger user bases

**Features:**
- Database indexing optimization
- Query optimization
- Connection pooling
- Read replicas for reporting
- Database partitioning
- Caching layer (Redis)

### 11.2 Application Performance
**Goal:** Maintain fast response times

**Features:**
- Code splitting and lazy loading
- Image optimization
- CDN for static assets
- Server-side rendering (SSR)
- API response caching
- Compression (gzip/brotli)

### 11.3 Monitoring & Observability
**Goal:** Track application health

**Features:**
- Application performance monitoring (APM)
- Error tracking (Sentry)
- Uptime monitoring
- Performance metrics dashboard
- User session replay
- Log aggregation and search

---

## 12. Deployment & DevOps

### 12.1 Cloud Deployment Options
**Goal:** Provide flexible hosting options

**Options:**
1. **Self-Hosted:** Docker Compose (current)
2. **Cloud Managed:** AWS/GCP/Azure deployment guides
3. **SaaS:** Hosted service by maintainers (optional)

**Features:**
- One-click deployment scripts
- Automated backups
- Disaster recovery procedures
- Horizontal scaling support
- Load balancing
- Database migration tools

### 12.2 Multi-Tenancy Support
**Goal:** Support multiple troops in single deployment (optional)

**Features:**
- Tenant isolation (data segregation between troops)
- Custom domains or subdomains per troop (optional)
- Per-troop configuration
- Troop-specific branding (colors, logo)
- Usage analytics per troop
- Troop provisioning/deprovisioning
- Shared cookie catalog with troop-specific overrides

**Note:** Can also be deployed as one instance per troop for maximum isolation.

---

## Implementation Phases

### Phase 1: Foundation (Months 1-3) - ✅ **PARTIALLY COMPLETED (PR #106)**
**Focus:** Core multi-user support and authentication

**Deliverables:**
- [x] ✅ User management system (basic username/password authentication)
- [ ] ⏳ Google OAuth integration (deferred to v2.1)
- [ ] ⏳ Basic RBAC (Scout, Parent, Troop Leader, Cookie Leader roles)
- [x] ✅ Session management (HTTP-only cookies, 24h expiration)
- [x] ✅ Security headers and middleware (Helmet.js, rate limiting)
- [ ] ⏳ TLS/HTTPS enforcement (deployment configuration required)
- [ ] ⏳ Database schema migration from SQLite to PostgreSQL
- [ ] ⏳ User profile enhancements with role assignment

**PR #106 Achievements:**
- ✅ Username/password authentication with bcrypt (12 rounds)
- ✅ AES-256-GCM encryption for sensitive data
- ✅ Session management with secure cookies
- ✅ Rate limiting (5 attempts per 15 minutes)
- ✅ Security headers (CSP, HSTS, X-Frame-Options)
- ✅ CSRF protection via SameSite=Strict cookies
- ✅ SQL injection prevention
- ✅ Login/Registration UI

### Phase 2: Compliance & Security (Months 3-4) - ⏳ **IN PLANNING (v2.1)**
**Focus:** COPPA compliance and security hardening

**Deliverables:**
- [ ] Age verification and parental consent flow
- [ ] Parent-scout account linking
- [ ] Audit logging for minor data access
- [x] ✅ Data encryption at rest for sensitive fields (completed in PR #106)
- [ ] Privacy policy and consent management
- [ ] Data deletion and export features
- [ ] Security testing and penetration testing
- [ ] COPPA compliance documentation

**Notes from PR #106:**
- Foundation for compliance established with encryption and secure authentication
- Age verification and parental consent flows prioritized for v2.1
- Token-based CSRF protection recommended for defense-in-depth

### Phase 3: Troop Management & Cookie Products (Months 4-6)
**Focus:** Troop-level features and cookie catalog

**Deliverables:**
- [ ] Troop hierarchy (Troop → Leaders → Scouts/Parents)
- [ ] Troop dashboard for leaders
- [ ] Troop-wide goals and tracking
- [ ] Troop roster management with parent linking
- [ ] Cookie product catalog management
- [ ] Nutrition and dietary attribute tracking
- [ ] Season/year-based cookie catalog

### Phase 4: Booth Events & Inventory Management (Months 6-8)
**Focus:** Booth tracking and multi-level inventory

**Deliverables:**
- [ ] Troop booth event creation and management
- [ ] Family booth event tracking
- [ ] Booth shift scheduling and scout assignment
- [ ] Booth inventory tracking (start/end/sold)
- [ ] Multi-payment type tracking for booths
- [ ] Starting bank (cash for change) management
- [ ] Four-level inventory system (Troop/Troop Booth/Scout Personal/Scout Event)
- [ ] Fulfillment order management
- [ ] Inventory transfer workflows
- [ ] Sales process implementation (individual/booth workflows)
- [ ] Inventory reconciliation and low-stock alerts

### Phase 5: Reporting & Analytics (Months 8-9)
**Focus:** Enhanced reporting and insights

**Deliverables:**
- [ ] Summary reports (Scout, Troop levels)
- [ ] Booth performance reports
- [ ] Export functionality (PDF, Excel, CSV) with booth data
- [ ] Data visualizations and charts
- [ ] Scout participation and shift credit tracking
- [ ] Payment collection status reports

### Phase 6: Mobile & UX (Months 9-11)
**Focus:** Mobile experience and usability

**Deliverables:**
- [ ] PWA enhancements (offline mode for booth events, push notifications)
- [ ] Mobile-optimized booth tracking interface
- [ ] Quick sale entry for booth events
- [ ] Onboarding and tutorials for all roles
- [ ] Accessibility improvements (WCAG 2.1 AA)
- [ ] Performance optimization

### Phase 7: Integrations & API (Months 11-12)
**Focus:** External integrations and extensibility

**Deliverables:**
- [ ] Troop-level API with authentication
- [ ] API key management for cookie leaders
- [ ] Improved import/export (bulk sales import)
- [ ] Payment processing integration (Stripe/Square)
- [ ] Digital Cookie store integration (if API available)
- [ ] Calendar export (iCal format for booth events)

### Phase 8: Scale & Polish (Months 12-14)
**Focus:** Production readiness and documentation

**Deliverables:**
- [ ] Performance optimization and caching
- [ ] Database optimization (indexing, query tuning)
- [ ] Monitoring and alerting setup
- [ ] Cloud deployment options (AWS/GCP/Azure guides)
- [ ] Backup and disaster recovery procedures
- [ ] Load testing for multi-troop scenarios
- [ ] Production deployment guide
- [ ] User documentation and training materials

---

## Technical Architecture Changes

### Backend
- **Framework:** Express.js (continue)
- **Database:** SQLite → PostgreSQL (for multi-user scalability)
- **Authentication:** Passport.js + Google OAuth
- **Session Store:** Redis (instead of memory)
- **Background Jobs:** Bull queue (Redis-based)
- **Email:** Nodemailer + SendGrid/Mailgun
- **File Storage:** Local → S3/Cloud Storage

### Frontend
- **Framework:** Consider React or Vue.js (instead of vanilla JS)
- **State Management:** Context API or Redux
- **UI Library:** Material-UI or Tailwind CSS
- **Build Tool:** Vite or Webpack
- **Testing:** Jest + React Testing Library

### Infrastructure
- **Container:** Docker + Kubernetes (optional)
- **Reverse Proxy:** Nginx or Caddy
- **SSL:** Let's Encrypt (automated)
- **Monitoring:** Prometheus + Grafana
- **Logging:** ELK Stack or Loki

---

## Database Migration Strategy

### Migration from 1.x to 2.0

1. **Backup:** Full database backup before migration
2. **User Migration:**
   - Convert existing single-user profile to multi-user
   - Create admin account from existing profile
   - Assign all existing data to admin account
3. **Schema Updates:**
   - Add new tables (users, troops, troop_members, cookie_products, booth_events, inventory_balances, fulfillment_orders, etc.)
   - Add userId and troopId foreign keys to existing tables
   - Migrate data with proper associations
4. **Testing:** Comprehensive testing with migrated data
5. **Rollback Plan:** Ability to revert if issues occur

---

## Success Metrics

### User Engagement
- Daily/Monthly Active Users (DAU/MAU) per troop
- Session duration
- Feature adoption rates (booth tracking, inventory management)
- Retention rate (scouts, parents, leaders)
- Booth event participation rate

### Business Metrics
- Number of troops using the platform
- Total scouts tracked per troop
- Total cookie boxes tracked
- Total revenue processed
- Average boxes sold per scout
- Booth event success rate (boxes sold per event)
- Fulfillment order accuracy

### Technical Metrics
- Page load time < 2 seconds
- API response time < 200ms (critical for booth event tracking)
- Uptime > 99.5%
- Error rate < 0.1%
- Offline mode functionality for booth events

---

## Risk Assessment

### Technical Risks
1. **Database Migration:** Complex migration from SQLite to PostgreSQL
   - *Mitigation:* Comprehensive testing, staged rollout, rollback plan

2. **Performance:** Multi-user system may be slower
   - *Mitigation:* Caching, query optimization, load testing

3. **Security:** Increased attack surface with multi-user
   - *Mitigation:* Security audits, penetration testing, bug bounty

### Compliance Risks
1. **COPPA Violations:** Mishandling of minor's data
   - *Mitigation:* Legal review, privacy audit, parental controls

2. **Data Breach:** Unauthorized access to user data
   - *Mitigation:* Encryption, access controls, monitoring

### Business Risks
1. **Adoption:** Users may not migrate to 2.0
   - *Mitigation:* Clear value proposition, migration support, documentation

2. **Support Burden:** Increased support needs with more features
   - *Mitigation:* Documentation, tutorials, community forums

---

## Cost Estimates

### Development Costs
- Phase 1-3: ~400-500 developer hours
- Phase 4-6: ~300-400 developer hours
- Phase 7: ~150-200 developer hours
- **Total:** ~850-1100 developer hours

### Infrastructure Costs (Annual, Estimated)
- Cloud hosting (AWS/GCP): $100-500/month
- Database: $20-100/month
- Email service: $10-50/month
- Monitoring/logging: $20-100/month
- SSL certificates: Free (Let's Encrypt)
- **Total:** ~$150-750/month ($1,800-9,000/year)

### Ongoing Costs
- Maintenance: 10-20 hours/month
- Support: Varies by user base
- Security updates: 5-10 hours/month

---

## Open Questions

1. **Monetization:** Will this be free, freemium, or paid? How to sustain development?
2. **Support Model:** Community support, paid support, or managed service?
3. **Official Partnership:** Partnership with Girl Scouts of USA for official Digital Cookie API integration?
4. **Data Residency:** Any requirements for where data is stored (country/region)?
5. **Licensing:** Keep open-source or commercial license for 2.0?
6. **Multi-Troop Deployment:** Should a single deployment support multiple troops, or one deployment per troop?
7. **Fulfillment Integration:** Is there a standard API for council fulfillment systems, or will this remain manual entry?
8. **Cookie Catalog:** Should there be a shared national cookie catalog, or does each troop manage their own?

---

## Contributing

This is a living document. Suggestions and feedback are welcome via:
- GitHub Issues
- Pull Requests
- Email: [contact information]

---

## Document Notes

**Important:** This document should be reviewed regularly when working on v2.0 branch development. Developer comments and clarifications have been integrated throughout this document to ensure alignment with the troop-focused scope.

**Key Scope Changes from Original v1.0:**
- Removed council-level management features
- Focus on Troop → Leaders → Scouts/Parents hierarchy
- Added comprehensive booth tracking (Troop Booth & Family Booth)
- Added four-level inventory management
- Added cookie product management with nutrition info
- Detailed sales process workflows
- Fulfillment treated as external ordering system only

**Reference Materials:**
- See: `Cookie_Booth_Sheet idea.xlsx` in v2 Implementation folder for booth tracking UI example

---

**Document Version:** 2.0
**Last Updated:** 2026-01-25
**Maintainer:** GSCTracker Development Team
**Changelog:**
- v2.0 (2026-01-25): Integrated developer comments, removed council scope, added booth tracking, updated workflows
- v1.0 (2026-01-23): Initial roadmap draft
