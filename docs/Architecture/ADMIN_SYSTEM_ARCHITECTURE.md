# Admin System Architecture

**Last Updated:** February 13, 2026
**Status:** ✅ Complete (Production Ready)
**Related Documentation:**
- [Admin Endpoints API](/docs/API/ADMIN_ENDPOINTS.md)
- [Admin Panel User Guide](/docs/Getting%20Started/ADMIN_PANEL_USER_GUIDE.md)
- [Database Schema](/docs/Architecture/DATABASE_SCHEMA.md)

---

## Overview

The Admin System provides a secure, web-based interface for system administrators to manage all aspects of Apex Scout Manager. It follows a client-server architecture with session-based authentication, role-based access control, and comprehensive audit logging.

**Architecture Pattern:** MVC (Model-View-Controller) with RESTful API

**Components:**
1. **Frontend:** HTML/CSS/JavaScript (admin.html, admin.js)
2. **Backend:** Node.js/Express (server.js routes)
3. **Middleware:** Authentication and authorization (auth.js)
4. **Database:** PostgreSQL (admins, users, troops, etc.)
5. **Session Store:** Redis (session management)

---

## System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser (Client)                         │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐   │
│  │  admin.html  │  │   admin.js   │  │    styles.css       │   │
│  │  (UI Layout) │  │  (Logic)     │  │   (Styling)         │   │
│  └──────────────┘  └──────────────┘  └─────────────────────┘   │
│         │                  │                                     │
│         └──────────────────┴─────── HTTP/AJAX Requests          │
│                            │                                     │
└────────────────────────────┼─────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Server (Node.js/Express)                    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                  Routes (server.js)                     │    │
│  │  ┌──────────────────────────────────────────────────┐  │    │
│  │  │ GET  /admin          → Serve admin.html          │  │    │
│  │  │ GET  /admin.html     → Serve admin.html          │  │    │
│  │  │                                                   │  │    │
│  │  │ GET  /api/system/bootstrap-status                │  │    │
│  │  │ POST /api/system/bootstrap                       │  │    │
│  │  │ GET  /api/system/admins     (requireAdmin)       │  │    │
│  │  │ POST /api/system/admins     (requireAdmin)       │  │    │
│  │  │ DELETE /api/system/admins/:userId (requireAdmin) │  │    │
│  │  │                                                   │  │    │
│  │  │ GET  /api/organizations     (requireAdmin)       │  │    │
│  │  │ GET  /api/troops            (requireAdmin)       │  │    │
│  │  │ GET  /api/members           (requireAdmin)       │  │    │
│  │  │ GET  /api/audit-log         (requireAdmin)       │  │    │
│  │  └──────────────────────────────────────────────────┘  │    │
│  └────────────────────────────────────────────────────────┘    │
│         │                                                        │
│         ↓                                                        │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              Middleware (auth.js)                       │    │
│  │  ┌──────────────────────────────────────────────────┐  │    │
│  │  │ isAuthenticated()  → Check session exists        │  │    │
│  │  │ requireAdmin()     → Check admin privileges      │  │    │
│  │  └──────────────────────────────────────────────────┘  │    │
│  └────────────────────────────────────────────────────────┘    │
│         │                                                        │
│         ↓                                                        │
│  ┌────────────────────────────────────────────────────────┐    │
│  │           Query Helpers (database/)                     │    │
│  │  ┌──────────────────────────────────────────────────┐  │    │
│  │  │ getOne()    → Single record query                │  │    │
│  │  │ getMany()   → Multiple records query             │  │    │
│  │  │ execute()   → Generic query execution            │  │    │
│  │  └──────────────────────────────────────────────────┘  │    │
│  └────────────────────────────────────────────────────────┘    │
│         │                                                        │
└─────────┼────────────────────────────────────────────────────────┘
          │
          ↓
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                           │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐   │
│  │    admins    │  │    users     │  │  scout_profiles     │   │
│  ├──────────────┤  ├──────────────┤  ├─────────────────────┤   │
│  │ id           │  │ id           │  │ id                  │   │
│  │ userId       │  │ email        │  │ userId              │   │
│  │ role         │  │ firstName    │  │ scoutOrganizationId │   │
│  │ grantedAt    │  │ lastName     │  │ scoutLevelId        │   │
│  │ grantedBy    │  │ password     │  └─────────────────────┘   │
│  │ revokedAt    │  │ role         │                            │
│  │ revokedBy    │  │ isActive     │  ┌─────────────────────┐   │
│  └──────────────┘  └──────────────┘  │  audit_log          │   │
│                                       ├─────────────────────┤   │
│  ┌──────────────┐  ┌──────────────┐  │ id                  │   │
│  │   troops     │  │organizations │  │ userId              │   │
│  ├──────────────┤  ├──────────────┤  │ action              │   │
│  │ id           │  │ id           │  │ resourceType        │   │
│  │ name         │  │ code         │  │ resourceId          │   │
│  │ number       │  │ name         │  │ details             │   │
│  │ leaderId     │  │ type         │  │ timestamp           │   │
│  └──────────────┘  └──────────────┘  └─────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
          │
          ↓
┌─────────────────────────────────────────────────────────────────┐
│                         Redis (Session Store)                    │
│                                                                  │
│  Session Key: connect.sid=[session-id]                          │
│  Session Data: { userId, userEmail, userRole, ... }             │
│  TTL: 7 days                                                     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Frontend Architecture

### File Structure

```
/data/ASM/public/
├── admin.html      # Admin panel HTML template
├── admin.js        # Admin panel JavaScript (logic)
├── styles.css      # Shared styles (used by admin.html)
├── index.html      # Main app (regular users)
├── login.html      # Login page
└── script.js       # Main app JavaScript
```

### admin.html Structure

**Layout:**
- HTML5 semantic structure
- Header with title and admin badge
- Sidebar navigation (6 tabs + logout)
- Main content area (tab-specific views)
- Inline CSS (admin-specific styles)

**Sections:**
```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Panel - Apex Scout Manager</title>
    <link rel="stylesheet" href="styles.css?v=13">
    <style>
      /* Admin-specific styles */
    </style>
  </head>
  <body>
    <div class="container">
      <header class="admin-header">
        <h1>Admin Panel <span class="admin-badge">ADMIN</span></h1>
      </header>

      <nav class="tab-nav">
        <!-- 6 tabs + logout -->
      </nav>

      <main>
        <!-- 6 view sections (hidden/shown via JavaScript) -->
        <div id="view-dashboard" class="view-section">...</div>
        <div id="view-admins" class="view-section hidden">...</div>
        <div id="view-organizations" class="view-section hidden">...</div>
        <div id="view-troops" class="view-section hidden">...</div>
        <div id="view-members" class="view-section hidden">...</div>
        <div id="view-audit" class="view-section hidden">...</div>
      </main>
    </div>

    <script src="admin.js?v=1"></script>
  </body>
</html>
```

### admin.js Architecture

**Structure:**
```javascript
// ============================================================================
// Authentication Check
// ============================================================================
async function checkAdminAccess() { ... }

// ============================================================================
// View Navigation
// ============================================================================
function switchView(viewId) { ... }
function setupNavigation() { ... }

// ============================================================================
// Dashboard
// ============================================================================
async function loadDashboard() { ... }

// ============================================================================
// Admin Management
// ============================================================================
async function loadAdminsList() { ... }
function showCreateAdminForm() { ... }
function hideCreateAdminForm() { ... }
async function createAdmin() { ... }
async function revokeAdmin(userId, email) { ... }

// ============================================================================
// Organizations
// ============================================================================
async function loadOrganizations() { ... }

// ============================================================================
// Troops
// ============================================================================
async function loadTroops() { ... }
async function searchTroops() { ... }
function displayTroops(troops) { ... }

// ============================================================================
// Members
// ============================================================================
async function loadMembers() { ... }
async function searchMembers() { ... }
function displayMembers(members) { ... }

// ============================================================================
// Audit Log
// ============================================================================
async function loadAuditLog() { ... }
async function searchAuditLog() { ... }
function displayAuditLog(events) { ... }

// ============================================================================
// Utilities
// ============================================================================
function showAlert(elementId, message, type, duration) { ... }
function escapeHtml(text) { ... }

// ============================================================================
// Logout
// ============================================================================
async function logout() { ... }

// ============================================================================
// Initialization
// ============================================================================
async function initAdminPanel() { ... }
document.addEventListener('DOMContentLoaded', initAdminPanel);
```

**Key Design Patterns:**

**1. Async/Await for API Calls**
```javascript
async function loadDashboard() {
    try {
        const [adminsResponse, orgsResponse, ...] = await Promise.all([
            fetch('/api/system/admins', { credentials: 'include' }),
            fetch('/api/organizations', { credentials: 'include' }),
            // ... parallel API calls
        ]);

        const admins = await adminsResponse.json();
        const orgs = await orgsResponse.json();

        // Update UI
        document.getElementById('statAdmins').textContent = admins.admins.length;
        // ...
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showAlert('dashboardAlert', 'Failed to load dashboard: ' + error.message, 'error');
    }
}
```

**2. View Switching (Single Page App)**
```javascript
function switchView(viewId) {
    // Hide all views
    document.querySelectorAll('.view-section').forEach(view => {
        view.classList.add('hidden');
    });

    // Show selected view
    document.getElementById('view-' + viewId).classList.remove('hidden');

    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === viewId);
    });

    // Save preference
    localStorage.setItem('adminLastView', viewId);

    // Load data for view
    if (viewId === 'dashboard') loadDashboard();
    else if (viewId === 'admins') loadAdminsList();
    // ...
}
```

**3. Alert System**
```javascript
function showAlert(elementId, message, type = 'success', duration = 0) {
    const element = document.getElementById(elementId);
    element.className = `alert ${type}`;
    element.textContent = message;
    element.style.display = 'block';

    if (duration > 0) {
        setTimeout(() => {
            element.style.display = 'none';
        }, duration);
    }
}
```

**4. HTML Escaping (Security)**
```javascript
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
```

**5. Error Handling**
```javascript
async function createAdmin() {
    try {
        // ... API call
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create admin');
        }

        showAlert('adminsAlert', 'Admin created successfully', 'success');
        loadAdminsList();
    } catch (error) {
        console.error('Error creating admin:', error);
        showAlert('adminsAlert', 'Failed to create admin: ' + error.message, 'error');
    }
}
```

---

## Backend Architecture

### Server Routes (server.js)

**Admin Panel Routes:**
```javascript
// Serve admin panel HTML (requires authentication)
app.get('/admin', auth.isAuthenticated, (req, res) => {
    res.redirect('/admin.html');
});

app.get('/admin.html', auth.isAuthenticated, async (req, res) => {
    // Check admin access
    const isAdmin = await db.getOne(
        'SELECT * FROM admins WHERE "userId" = $1 AND "revokedAt" IS NULL',
        [req.session.userId]
    );

    if (!isAdmin) {
        return res.redirect('/?error=admin_access_required');
    }

    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
```

**API Routes:**
```javascript
// Bootstrap endpoints (no auth required)
app.get('/api/system/bootstrap-status', async (req, res) => { ... });
app.post('/api/system/bootstrap', async (req, res) => { ... });

// Admin management (requireAdmin middleware)
app.get('/api/system/admins', auth.isAuthenticated, auth.requireAdmin, async (req, res) => { ... });
app.post('/api/system/admins', auth.isAuthenticated, auth.requireAdmin, async (req, res) => { ... });
app.delete('/api/system/admins/:userId', auth.isAuthenticated, auth.requireAdmin, async (req, res) => { ... });

// Data endpoints (requireAdmin middleware)
app.get('/api/organizations', auth.isAuthenticated, auth.requireAdmin, async (req, res) => { ... });
app.get('/api/troops', auth.isAuthenticated, auth.requireAdmin, async (req, res) => { ... });
app.get('/api/members', auth.isAuthenticated, auth.requireAdmin, async (req, res) => { ... });
app.get('/api/audit-log', auth.isAuthenticated, auth.requireAdmin, async (req, res) => { ... });
```

### Middleware (auth.js)

**isAuthenticated Middleware:**
```javascript
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated && req.isAuthenticated()) {
        return next();
    }

    // Check session manually
    if (req.session && req.session.userId) {
        return next();
    }

    return res.status(401).json({ error: 'Authentication required' });
}
```

**requireAdmin Middleware:**
```javascript
async function requireAdmin(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const adminCheck = await db.getOne(
            'SELECT * FROM admins WHERE "userId" = $1 AND "revokedAt" IS NULL',
            [req.session.userId]
        );

        if (!adminCheck) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        req.adminRole = adminCheck.role;
        next();
    } catch (error) {
        console.error('Admin check failed:', error);
        return res.status(500).json({ error: 'Admin check failed' });
    }
}
```

---

## Authentication Flow

### 1. Initial Page Load

```
User navigates to /admin
    ↓
Server checks isAuthenticated middleware
    ↓
If not authenticated: Redirect to /login.html?redirect=/admin
If authenticated: Continue to admin access check
    ↓
Server queries admins table for user's admin record
    ↓
If no admin record: Redirect to /?error=admin_access_required
If admin record exists: Serve admin.html
    ↓
Browser loads admin.html and admin.js
    ↓
admin.js calls checkAdminAccess() on load
    ↓
If access check fails: Redirect to login
If access check passes: Load dashboard and setup navigation
```

### 2. API Request Flow

```
User clicks "View Admins" tab
    ↓
admin.js calls loadAdminsList()
    ↓
fetch('/api/system/admins', { credentials: 'include' })
    ↓
Server receives request with session cookie
    ↓
isAuthenticated middleware checks session
    ↓
If no session: Return 401 Unauthorized
If session exists: Continue
    ↓
requireAdmin middleware checks admin record
    ↓
If no admin record: Return 403 Forbidden
If admin record exists: Continue
    ↓
Server queries database for admin list
    ↓
Return JSON response with admin data
    ↓
admin.js receives response
    ↓
Update UI with admin list table
    ↓
Display success alert
```

### 3. Bootstrap Flow (No Auth)

```
System has no admins
    ↓
User creates account and logs in
    ↓
User calls /api/system/bootstrap-status
    ↓
Server checks admin count in database
    ↓
If admins exist: Return { needsBootstrap: false }
If no admins: Return { needsBootstrap: true }
    ↓
User calls /api/system/bootstrap with credentials
    ↓
Server checks admin count again (prevent race condition)
    ↓
If admins exist: Return 400 error
If no admins: Create user and admin record
    ↓
Return success with new admin user
    ↓
User logs in with bootstrap credentials
    ↓
User gains admin access
```

---

## Database Schema

### admins Table

```sql
CREATE TABLE admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'admin' NOT NULL CHECK (role IN ('admin', 'super_admin')),
    "grantedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "grantedBy" UUID REFERENCES users(id) ON DELETE SET NULL,
    "revokedAt" TIMESTAMP WITH TIME ZONE,
    "revokedBy" UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_admins_user_id ON admins("userId");
CREATE INDEX idx_admins_active ON admins WHERE "revokedAt" IS NULL;
```

**Relationships:**
- `userId` → `users.id` (CASCADE on delete)
- `grantedBy` → `users.id` (SET NULL on delete)
- `revokedBy` → `users.id` (SET NULL on delete)

**Indexes:**
- Primary key on `id`
- Unique index on `userId`
- Partial index on active admins (`revokedAt IS NULL`)

**Query Patterns:**

**Check if user is admin:**
```sql
SELECT * FROM admins
WHERE "userId" = $1 AND "revokedAt" IS NULL;
```

**List all admins (with user info):**
```sql
SELECT
    a.*,
    u.email,
    u."firstName",
    u."lastName",
    u."isActive"
FROM admins a
JOIN users u ON a."userId" = u.id
ORDER BY a."grantedAt" DESC;
```

**Count active admins:**
```sql
SELECT COUNT(*)::int FROM admins
WHERE "revokedAt" IS NULL;
```

---

## Session Management

### Session Store: Redis

**Configuration:**
```javascript
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const { createClient } = require('redis');

const redisClient = createClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
});

app.use(session({
    store: new RedisStore({ client: redisClient }),
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    }
}));
```

**Session Data:**
```javascript
{
    userId: 'UUID',
    userEmail: 'admin@example.com',
    userRole: 'admin',
    cookie: {
        originalMaxAge: 604800000,
        expires: '2026-02-20T10:30:00.000Z',
        secure: false,
        httpOnly: true
    }
}
```

**Session Flow:**
1. User logs in → Session created in Redis
2. Session cookie sent to browser (`connect.sid`)
3. Browser includes cookie with all requests
4. Server reads session from Redis using cookie
5. Middleware checks session for userId
6. If userId exists, user is authenticated

---

## State Management

### Frontend State

**LocalStorage:**
- `adminLastView`: Last visited tab (restored on load)

**In-Memory State:**
- Current view (managed by switchView)
- Active tab (managed by tab button classes)
- Alert visibility (managed by showAlert)

**No Global State:**
- Data fetched fresh from API each time
- No client-side caching of admin/user/troop data
- Always reflects latest database state

**Advantages:**
- Simple architecture (no Redux/Vuex)
- Always shows current data
- No state synchronization issues

**Disadvantages:**
- Multiple API calls on tab switches
- Slower for large datasets
- No offline capability

**Future Enhancement (Phase 5):**
- Client-side caching with TTL
- WebSocket for real-time updates
- Optimistic UI updates

---

## Security Architecture

### Authentication Layers

**Layer 1: Session-Based Auth**
- User must be logged in (valid session cookie)
- Session stored in Redis (7-day TTL)
- Session contains userId

**Layer 2: Admin Role Check**
- User must have active admin record
- Query: `SELECT FROM admins WHERE userId = ? AND revokedAt IS NULL`
- Immediate revocation (no cache)

**Layer 3: Authorization (Future)**
- Super admin vs regular admin (Phase 5)
- Fine-grained permissions (Phase 5)
- IP-based restrictions (Phase 5)

### Data Protection

**SQL Injection Prevention:**
- Parameterized queries ($1, $2, etc.)
- No string concatenation in SQL
- Query helpers enforce parameterization

**XSS Prevention:**
- HTML escaping on display (`escapeHtml()` function)
- Content Security Policy headers (future)
- No `innerHTML` with user input

**CSRF Prevention:**
- Session cookies with `httpOnly` flag
- Same-origin policy
- CSRF tokens (future enhancement)

**Password Security:**
- Bcrypt hashing (10 rounds)
- Never expose password hashes in API responses
- Password validation on bootstrap

### Access Control

**Admin Panel:**
- URL: `/admin` requires authentication + admin role
- API endpoints protected by `requireAdmin` middleware
- No admin features visible to non-admins

**Data Access:**
- Admins can view all organizations, troops, members
- Regular users can only see their troop data
- Scoped queries enforce access control

---

## Error Handling

### Frontend Error Handling

**Try-Catch Pattern:**
```javascript
async function loadData() {
    try {
        const response = await fetch('/api/endpoint');
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Request failed');
        }
        const data = await response.json();
        // Process data
    } catch (error) {
        console.error('Error:', error);
        showAlert('alertId', 'Failed to load data: ' + error.message, 'error');
    }
}
```

**Error Display:**
- Red alert boxes at top of each tab section
- Error messages extracted from API responses
- Console logging for debugging

**Network Errors:**
- Caught by try-catch
- Generic "Network error" message
- User prompted to check connection

### Backend Error Handling

**API Response Pattern:**
```javascript
app.post('/api/endpoint', async (req, res) => {
    try {
        // Validate input
        if (!req.body.field) {
            return res.status(400).json({ error: 'Field is required' });
        }

        // Process request
        const result = await db.execute(query, params);

        // Return success
        return res.status(200).json({ message: 'Success', data: result });
    } catch (error) {
        console.error('API error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
```

**Error Status Codes:**
- `400` - Bad Request (validation error)
- `401` - Unauthorized (not authenticated)
- `403` - Forbidden (not admin)
- `404` - Not Found (resource doesn't exist)
- `409` - Conflict (duplicate, constraint violation)
- `500` - Internal Server Error (unexpected error)

**Error Logging:**
- Console.error() for all errors
- Includes stack traces in development
- Audit log for admin actions (Phase 4)

---

## Performance Considerations

### Frontend Performance

**Parallel API Calls:**
```javascript
const [r1, r2, r3] = await Promise.all([
    fetch('/api/admins'),
    fetch('/api/orgs'),
    fetch('/api/troops')
]);
```

**Benefits:**
- Load dashboard in one round trip
- Faster initial page load
- Better user experience

**Lazy Loading:**
- Only load data when tab is clicked
- Don't load all tabs on initial page load
- Saves bandwidth and server resources

**Client-Side Filtering:**
- Search/filter on already-loaded data (where possible)
- Reduces server round trips
- Instant feedback to user

### Backend Performance

**Database Indexing:**
- Index on `admins.userId` for fast admin checks
- Partial index on `admins WHERE revokedAt IS NULL` for active admin queries
- Indexes on foreign keys (userId, troopId, etc.)

**Connection Pooling:**
- PostgreSQL connection pool (pg-pool.js)
- Reuse database connections
- Avoid connection overhead

**Query Optimization:**
- Use JOIN instead of N+1 queries
- Select only needed columns
- Limit results (e.g., audit log limited to 50)

**Caching (Future):**
- Redis cache for frequently accessed data
- Cache admin list (1-minute TTL)
- Invalidate cache on admin grant/revoke

---

## Scalability

### Current Architecture Scalability

**Strengths:**
- Stateless server (sessions in Redis)
- Horizontal scaling possible (load balancer + multiple instances)
- Database connection pooling
- Efficient queries with indexes

**Limitations:**
- No caching (every request hits database)
- No pagination (loads all troops/members)
- No real-time updates (manual refresh required)
- Single database (no replication)

### Future Enhancements for Scale

**Phase 4: Pagination**
- Limit members/troops to 50 per page
- Cursor-based pagination for performance
- Lazy loading as user scrolls

**Phase 5: Caching**
- Redis cache for read-heavy data
- Cache invalidation on writes
- Reduce database load

**Phase 6: Real-Time Updates**
- WebSocket for live updates
- Push notifications for admin actions
- Collaborative editing

**Database Scaling:**
- Read replicas for reporting
- Partitioning for large tables
- Sharding by organization (if multi-tenant)

---

## Testing Strategy

### Unit Tests (Future)

**Frontend Unit Tests (Jest):**
- `switchView()` function
- `escapeHtml()` function
- `showAlert()` function
- Form validation logic

**Backend Unit Tests (Mocha/Chai):**
- Middleware (requireAdmin)
- Query helpers
- Validation functions
- Error handling

### Integration Tests (Future)

**API Endpoint Tests:**
- Bootstrap flow (empty database → first admin)
- Admin CRUD (create, list, revoke)
- Access control (non-admin blocked)
- Error cases (invalid input, missing fields)

**End-to-End Tests (Playwright):**
- Login → Admin panel → Dashboard
- Create admin flow
- Revoke admin flow
- Search functionality

### Manual Testing (Current)

**Test Checklist:**
- [ ] Login as admin → See admin panel
- [ ] Login as non-admin → See 403 error
- [ ] Dashboard loads with correct stats
- [ ] All tabs load correctly
- [ ] Create admin works
- [ ] Revoke admin works (with safety checks)
- [ ] Search functions work (troops, members, audit)
- [ ] Logout works
- [ ] Mobile responsive design works
- [ ] Hard refresh doesn't break session

---

## Deployment Architecture

### Development Environment

```
Docker Compose (docker-compose.yml)
├── postgres (database)
├── redis (session store)
└── asm-dev (Node.js app)
    ├── /data/ASM (mounted volume)
    ├── Port 3000 → 5252 (host)
    └── Environment variables
```

**Access:**
- App: `http://localhost:5252`
- Admin Panel: `http://localhost:5252/admin`
- Database: `localhost:5432` (internal: postgres:5432)
- Redis: `localhost:6379` (internal: redis:6379)

### Production Environment (Future)

```
Load Balancer (nginx)
    ↓
App Servers (Node.js x3)
    ↓
PostgreSQL Primary + Replicas
    ↓
Redis Cluster
```

**Considerations:**
- HTTPS only (SSL certificates)
- Environment variable secrets (not hardcoded)
- Database backups (daily)
- Redis persistence (AOF)
- Log aggregation (CloudWatch, Datadog)
- Monitoring (health checks, alerts)

---

## Related Documentation

- [Admin Endpoints API](/docs/API/ADMIN_ENDPOINTS.md) - API specification
- [Database Schema](/docs/Architecture/DATABASE_SCHEMA.md) - Complete database schema
- [Account Access Schema](/docs/Architecture/Account%20Access%20Schema.md) - Roles and privileges
- [Admin Panel Plan](/docs/Roadmap/ADMIN_PANEL_PLAN.md) - Implementation roadmap
- [Bootstrap Setup Guide](/docs/Getting%20Started/BOOTSTRAP_SETUP.md) - Initial setup

---

**Last Updated:** February 13, 2026
**Phase:** Phase 2 Complete (Frontend + Backend)
**Status:** Production Ready (Read Operations + Admin CRUD)
