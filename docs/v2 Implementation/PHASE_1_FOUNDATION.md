# Phase 1: Foundation

**Status:** ✅ COMPLETED
**Timeline:** Months 1-3
**Focus:** Core multi-user support and authentication

---

## Overview

Phase 1 establishes the foundational infrastructure for transforming GSCTracker from a single-user application into a multi-user platform. This phase implements user authentication, session management, and the basic role-based access control system.

---

## Deliverables

### 1.1 User Management System

**Goal:** Support multiple users with secure account management

**Features:**
- [x] User registration with email/password
- [x] User profile management (firstName, lastName, email)
- [x] Password hashing with bcrypt (12 salt rounds)
- [x] Account activation/deactivation (`isActive` flag)
- [x] Email verification tracking (`emailVerified` flag)
- [x] Last login tracking (`lastLogin` timestamp)

**Database Schema - `users` table:**
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    firstName TEXT,
    lastName TEXT,
    googleId TEXT UNIQUE,
    photoUrl TEXT,
    role TEXT DEFAULT 'scout',
    dateOfBirth TEXT,
    isMinor INTEGER DEFAULT 0,
    parentEmail TEXT,
    parentConsentDate TEXT,
    parentConsentIP TEXT,
    isActive INTEGER DEFAULT 1,
    emailVerified INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    lastLogin TEXT
);
```

### 1.2 Google OAuth Integration

**Goal:** Simplify authentication with secure Google Sign-In

**Features:**
- [x] Google OAuth 2.0 authentication flow
- [x] "Sign in with Google" button on login page
- [x] Automatic account creation for new Google users
- [x] Link Google accounts to existing email accounts
- [x] Store Google ID for future logins (`googleId` field)
- [x] Retrieve and store Google profile photo (`photoUrl`)

**Implementation:**
- [x] Passport.js with `passport-google-oauth20` strategy
- [x] Environment variables for OAuth credentials:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_CALLBACK_URL`

**API Endpoints:**
```
GET  /api/auth/google           - Initiate Google OAuth flow
GET  /api/auth/google/callback  - Handle OAuth callback
```

### 1.3 Role-Based Access Control (RBAC)

**Goal:** Implement granular permissions for different user types

**Roles Implemented:**
| Role | Description | Permissions |
|------|-------------|-------------|
| `scout` | Girl Scout member | Manage own data only |
| `parent` | Parent/Guardian | View/assist linked scout's data |
| `troop_leader` | Troop Leader | Manage all troop members |
| `council_admin` | Council Admin | Full system access |

**Authorization Middleware:**
```javascript
// Authentication check
auth.isAuthenticated

// Role-based access
auth.hasRole('troop_leader', 'council_admin')

// Resource ownership check
auth.canAccessResource('sales')
```

### 1.4 Session Management

**Goal:** Secure session handling with persistence

**Features:**
- [x] SQLite-backed session store (`connect-sqlite3`)
- [x] 7-day session expiry
- [x] Daily session cleanup job
- [x] Session tracking with IP and user-agent
- [x] Secure cookie configuration (HttpOnly, Secure in production)

**Database Schema - `sessions` table:**
```sql
CREATE TABLE sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    sessionToken TEXT UNIQUE,
    expiresAt TEXT,
    ipAddress TEXT,
    userAgent TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id)
);
```

**Session Configuration:**
```javascript
{
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
    }
}
```

### 1.5 TLS/HTTPS Enforcement

**Goal:** Ensure all data transmission is encrypted

**Features:**
- [x] HTTPS support via reverse proxy (nginx/Caddy)
- [x] Secure cookie flag in production
- [x] Environment-based security configuration

**Production Requirements:**
- Configure reverse proxy with SSL certificate
- Set `NODE_ENV=production` for secure cookies
- Use Let's Encrypt for free SSL certificates

### 1.6 Database Schema Migration

**Goal:** Add multi-user support to existing tables

**Changes to Existing Tables:**

```sql
-- Add userId foreign key to sales table
ALTER TABLE sales ADD COLUMN userId INTEGER REFERENCES users(id);

-- Add userId foreign key to profile table
ALTER TABLE profile ADD COLUMN userId INTEGER REFERENCES users(id);

-- Add userId foreign key to donations table
ALTER TABLE donations ADD COLUMN userId INTEGER REFERENCES users(id);

-- Add userId and troopId foreign keys to events table
ALTER TABLE events ADD COLUMN userId INTEGER REFERENCES users(id);
ALTER TABLE events ADD COLUMN troopId INTEGER REFERENCES troops(id);
```

**New Tables Created:**
- `users` - User accounts and profiles
- `sessions` - Session management
- `councils` - Council organizations (placeholder)
- `troops` - Troop organizations (placeholder)
- `troop_members` - Troop membership (placeholder)
- `troop_goals` - Troop goals (placeholder)
- `audit_log` - Security audit trail
- `notifications` - User notifications (placeholder)
- `data_deletion_requests` - COPPA compliance (placeholder)

### 1.7 User Profile Enhancements

**Goal:** Extended user profiles with role assignment

**Features:**
- [x] Role assignment during registration
- [x] COPPA fields for minors (dateOfBirth, isMinor, parentEmail)
- [x] Profile photo support (Google OAuth or uploaded)
- [x] Account status management

---

## API Endpoints

### Authentication Routes (Public)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/login.html` | Login page |
| GET | `/register.html` | Registration page |
| POST | `/api/auth/register` | Create new account |
| POST | `/api/auth/login` | Email/password login |
| GET | `/api/auth/google` | Google OAuth redirect |
| GET | `/api/auth/google/callback` | Google OAuth callback |

### Authenticated Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Main dashboard (redirects if not authenticated) |
| POST | `/api/auth/logout` | End session |
| GET | `/api/auth/me` | Get current user info |

---

## Frontend Changes

### New Pages
- `login.html` - Login form with Google OAuth button
- `register.html` - Registration form with role selection

### Updated Pages
- `index.html` - Protected dashboard, requires authentication
- Added logout functionality
- User info display in header

### Authentication Flow
```
1. User visits / → middleware checks session
2. No session → redirect to /login.html
3. Login form → POST /api/auth/login
4. Success → create session → redirect to /
5. Protected routes check req.session.userId
```

---

## Security Measures Implemented

| Measure | Implementation |
|---------|----------------|
| Password Hashing | bcryptjs with 12 salt rounds |
| SQL Injection | Prepared statements throughout |
| Session Security | HttpOnly, Secure flags, 7-day expiry |
| Rate Limiting | 100 requests per 15 min per IP |
| Audit Logging | Auth events with IP/user-agent |
| COPPA Fields | Minor tracking, parent consent fields |

---

## Environment Variables

**Required:**
```env
SESSION_SECRET=your-secure-secret-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
```

**Optional:**
```env
PORT=3000
DATA_DIR=/data
NODE_ENV=development
```

---

## Migration Script

Location: `migrations/migrate-to-v2.js`

**Features:**
- Automatic backup creation before migration
- Idempotent operations (safe to run multiple times)
- Transaction wrapping for atomic changes
- Verification script for post-migration validation

**Usage:**
```bash
node migrations/migrate-to-v2.js     # Run migration
node migrations/verify-migration.js  # Verify integrity
```

---

## Testing Checklist

- [x] User can register with email/password
- [x] User can login with email/password
- [x] User can login with Google OAuth
- [x] Session persists across page refreshes
- [x] Session expires after 7 days
- [x] Unauthenticated users redirected to login
- [x] Users can only access their own data
- [x] Logout properly destroys session
- [x] Rate limiting prevents brute force
- [x] Audit log captures auth events

---

## Dependencies Added

```json
{
  "passport": "^0.7.0",
  "passport-local": "^1.0.0",
  "passport-google-oauth20": "^2.0.0",
  "bcryptjs": "^2.4.3",
  "connect-sqlite3": "^0.9.13",
  "express-session": "^1.17.3",
  "express-rate-limit": "^7.1.5"
}
```

---

## Completion Notes

Phase 1 was completed with the following commit:
- `ef17181` - Implement GSCTracker v2.0 Phase 1: Multi-user authentication and foundation

All core authentication and authorization features are functional. The system supports both local email/password authentication and Google OAuth, with role-based access control ready for future phases.

---

## Next Phase

**Phase 2: Compliance & Security** will build upon this foundation by implementing:
- Age verification and parental consent flow
- Parent-scout account linking
- Enhanced audit logging for minor data access
- Data encryption at rest
- Privacy policy and consent management
