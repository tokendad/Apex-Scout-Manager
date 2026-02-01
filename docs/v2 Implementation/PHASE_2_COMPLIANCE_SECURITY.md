# Phase 2: Compliance & Security

**Status:** 🔄 NEXT
**Timeline:** Months 3-4
**Focus:** COPPA compliance and security hardening
**Prerequisites:** Phase 1 (Foundation) completed

---

## Overview

Phase 2 implements comprehensive COPPA (Children's Online Privacy Protection Act) compliance features and hardens the security of the application. Since GSCTracker is designed for Girl Scouts (many of whom are under 13), COPPA compliance is legally required.

---

## Deliverables

### 2.1 Age Verification and Parental Consent Flow

**Goal:** Ensure proper consent is obtained for users under 13

**Registration Flow for Minors:**

```
1. User enters date of birth during registration
2. System calculates age and sets isMinor flag
3. If age < 13:
   a. Require parent/guardian email address
   b. Set isActive = 0 (account pending)
   c. Send consent request email to parent
   d. Parent clicks verification link
   e. Parent reviews privacy policy and consents
   f. System records parentConsentDate and parentConsentIP
   g. Set isActive = 1 (account activated)
4. If age >= 13:
   a. Standard registration continues
   b. Account immediately active
```

**Database Changes:**
```sql
-- Already exists from Phase 1, ensure proper usage:
-- users.dateOfBirth - Store DOB for age calculation
-- users.isMinor - Boolean flag (1 if under 13)
-- users.parentEmail - Required for minors
-- users.parentConsentDate - When consent was given
-- users.parentConsentIP - IP address of consent

-- New table for consent tokens
CREATE TABLE parental_consent_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expiresAt TEXT NOT NULL,
    usedAt TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id)
);
```

**API Endpoints:**
```
POST /api/auth/register          - Enhanced with age verification
GET  /api/consent/verify/:token  - Parent clicks consent link
POST /api/consent/approve        - Parent approves consent
GET  /api/consent/status/:userId - Check consent status
```

**Email Templates:**
- Parental consent request email
- Consent confirmation email to parent
- Account activation email to minor

### 2.2 Parent-Scout Account Linking

**Goal:** Allow parents to view and manage their scout's data

**Features:**
- Parent can link to multiple scouts
- Scout can have multiple linked parents/guardians
- Parent sees aggregated view of all linked scouts
- Parent can record sales on behalf of scout
- Parent receives notifications about scout's activity

**Database Changes:**
```sql
CREATE TABLE parent_scout_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parentUserId INTEGER NOT NULL,
    scoutUserId INTEGER NOT NULL,
    relationship TEXT DEFAULT 'parent', -- parent, guardian, other
    canEdit INTEGER DEFAULT 0,          -- Can parent edit scout's data?
    canViewPayments INTEGER DEFAULT 1,  -- Can parent see payment info?
    linkedAt TEXT DEFAULT CURRENT_TIMESTAMP,
    linkedBy INTEGER,                   -- Who created this link
    status TEXT DEFAULT 'pending',      -- pending, active, revoked
    FOREIGN KEY (parentUserId) REFERENCES users(id),
    FOREIGN KEY (scoutUserId) REFERENCES users(id),
    FOREIGN KEY (linkedBy) REFERENCES users(id),
    UNIQUE(parentUserId, scoutUserId)
);
```

**Linking Flow:**
```
Option A - Parent initiates:
1. Parent enters scout's email
2. System sends link request to scout (or scout's existing parent)
3. Scout/parent approves link
4. Link activated

Option B - Scout/Leader initiates:
1. Scout or troop leader enters parent email
2. If parent has account, link request sent
3. If no account, invitation sent to create account
4. Parent approves and link activated

Option C - Registration linking:
1. During minor registration, parent email required
2. After parent consents, automatic link created
```

**API Endpoints:**
```
POST /api/links/request           - Request to link accounts
GET  /api/links/pending           - Get pending link requests
POST /api/links/approve/:linkId   - Approve link request
POST /api/links/reject/:linkId    - Reject link request
DELETE /api/links/:linkId         - Remove existing link
GET  /api/links/my-scouts         - Parent: get linked scouts
GET  /api/links/my-parents        - Scout: get linked parents
```

### 2.3 Audit Logging for Minor Data Access

**Goal:** Track all access to minor's data for COPPA compliance

**Events to Log:**
| Event | Description |
|-------|-------------|
| `minor_data_view` | Any view of minor's profile/sales/data |
| `minor_data_edit` | Any modification to minor's data |
| `minor_data_export` | Export of minor's data |
| `minor_data_delete` | Deletion of minor's data |
| `consent_request` | Parental consent requested |
| `consent_granted` | Parent granted consent |
| `consent_revoked` | Parent revoked consent |
| `parent_link_created` | Parent-scout link established |
| `parent_link_removed` | Parent-scout link removed |

**Enhanced Audit Log Schema:**
```sql
-- Enhance existing audit_log table
ALTER TABLE audit_log ADD COLUMN isMinorData INTEGER DEFAULT 0;
ALTER TABLE audit_log ADD COLUMN minorUserId INTEGER REFERENCES users(id);
ALTER TABLE audit_log ADD COLUMN dataCategory TEXT; -- profile, sales, etc.
```

**Implementation:**
```javascript
// Middleware to log minor data access
const logMinorAccess = async (req, action, resourceType, resourceId) => {
    const targetUser = await getResourceOwner(resourceType, resourceId);
    if (targetUser && targetUser.isMinor) {
        await db.prepare(`
            INSERT INTO audit_log
            (userId, action, resourceType, resourceId, ipAddress, userAgent,
             isMinorData, minorUserId, dataCategory, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, datetime('now'))
        `).run(
            req.session.userId,
            action,
            resourceType,
            resourceId,
            req.ip,
            req.get('user-agent'),
            targetUser.id,
            resourceType
        );
    }
};
```

### 2.4 Data Encryption at Rest

**Goal:** Encrypt sensitive fields in the database

**Fields to Encrypt:**
| Table | Field | Sensitivity |
|-------|-------|-------------|
| users | email | Medium |
| users | parentEmail | Medium |
| sales | customerEmail | High |
| sales | customerPhone | High |
| sales | customerAddress | High |
| profile | photoData | Medium |

**Implementation Approach:**

```javascript
const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32 bytes
const IV_LENGTH = 16;

function encrypt(text) {
    if (!text) return null;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
    if (!text) return null;
    const [ivHex, encryptedHex] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}
```

**Migration Strategy:**
1. Add new encrypted columns (e.g., `customerEmail_encrypted`)
2. Migrate existing data with encryption
3. Update application to use encrypted fields
4. Remove old unencrypted columns
5. Add database-level constraints

**Environment Variable:**
```env
ENCRYPTION_KEY=your-64-character-hex-key
```

### 2.5 Privacy Policy and Consent Management

**Goal:** Clear privacy disclosures and consent tracking

**Privacy Policy Requirements:**
- What data is collected
- Why data is collected
- How data is used
- How long data is retained
- Who has access to data
- How to request data deletion
- Contact information for privacy questions

**Consent Types:**
| Consent Type | Required For | Can Revoke |
|--------------|--------------|------------|
| Terms of Service | All users | No (account deleted) |
| Privacy Policy | All users | No (account deleted) |
| Parental Consent | Minors | Yes (account deactivated) |
| Marketing Emails | Optional | Yes |
| Data Sharing | Optional | Yes |

**Database Changes:**
```sql
CREATE TABLE consent_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    consentType TEXT NOT NULL,
    consentVersion TEXT NOT NULL,      -- e.g., "privacy-policy-v1.2"
    granted INTEGER NOT NULL,          -- 1 = granted, 0 = revoked
    ipAddress TEXT,
    userAgent TEXT,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id)
);

CREATE TABLE policy_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    policyType TEXT NOT NULL,          -- privacy-policy, terms-of-service
    version TEXT NOT NULL,
    content TEXT NOT NULL,
    effectiveDate TEXT NOT NULL,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(policyType, version)
);
```

**API Endpoints:**
```
GET  /api/privacy/policy              - Get current privacy policy
GET  /api/privacy/terms               - Get current terms of service
POST /api/privacy/consent             - Record user consent
GET  /api/privacy/my-consents         - Get user's consent history
POST /api/privacy/revoke/:consentType - Revoke specific consent
```

### 2.6 Data Deletion and Export Features

**Goal:** Allow users (and parents) to request data deletion or export

**Data Export (COPPA Right to Access):**
- Export all user data in JSON format
- Export all user data in CSV format
- Include: profile, sales, donations, events, audit log
- Exclude: encrypted fields shown as "[ENCRYPTED]"
- Parent can export child's data

**Data Deletion (COPPA Right to Delete):**
- Request deletion of account and all data
- Parent can request deletion of child's data
- Soft delete with 30-day retention (recovery period)
- Hard delete after retention period
- Audit trail preserved (anonymized)

**Database Changes:**
```sql
-- Already exists from Phase 1, ensure implementation:
CREATE TABLE data_deletion_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    requestedBy INTEGER NOT NULL,      -- User or parent who requested
    reason TEXT,
    requestDate TEXT DEFAULT CURRENT_TIMESTAMP,
    scheduledDeletionDate TEXT,        -- 30 days from request
    completionDate TEXT,
    status TEXT DEFAULT 'pending',     -- pending, processing, completed, cancelled
    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (requestedBy) REFERENCES users(id)
);
```

**API Endpoints:**
```
POST /api/privacy/export              - Request data export
GET  /api/privacy/export/:requestId   - Download export file
POST /api/privacy/delete-request      - Request account deletion
GET  /api/privacy/delete-status       - Check deletion request status
POST /api/privacy/cancel-deletion     - Cancel pending deletion
```

**Deletion Workflow:**
```
1. User/Parent requests deletion
2. Confirmation email sent
3. 30-day waiting period begins
4. User can cancel during waiting period
5. After 30 days, data is permanently deleted
6. Anonymized audit records retained
7. Confirmation of deletion sent
```

### 2.7 Security Testing and Penetration Testing

**Goal:** Identify and fix security vulnerabilities

**Security Checklist:**
- [ ] SQL Injection testing (all endpoints)
- [ ] XSS testing (all user inputs)
- [ ] CSRF protection verification
- [ ] Session fixation testing
- [ ] Authentication bypass testing
- [ ] Authorization testing (role boundaries)
- [ ] Rate limiting effectiveness
- [ ] Password policy enforcement
- [ ] Secure headers verification
- [ ] Cookie security flags
- [ ] HTTPS enforcement
- [ ] Error message information leakage

**Security Headers to Implement:**
```javascript
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});
```

**Account Lockout Implementation:**
```javascript
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

// Track failed login attempts
CREATE TABLE login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    ipAddress TEXT NOT NULL,
    attemptTime TEXT DEFAULT CURRENT_TIMESTAMP,
    successful INTEGER DEFAULT 0
);
```

### 2.8 COPPA Compliance Documentation

**Goal:** Document compliance measures for legal review

**Documentation Required:**
1. **Privacy Policy** - Child-friendly language version
2. **Parental Consent Form** - Clear explanation of data collected
3. **Data Inventory** - All data collected from minors
4. **Retention Schedule** - How long each data type is kept
5. **Access Control Matrix** - Who can access minor's data
6. **Incident Response Plan** - Data breach procedures
7. **Compliance Checklist** - Ongoing compliance verification

**COPPA Requirements Checklist:**
- [ ] Parental consent before collecting minor's data
- [ ] Privacy policy posted prominently
- [ ] Direct notice to parents about data collection
- [ ] Parents can review child's data
- [ ] Parents can request data deletion
- [ ] Parents can revoke consent
- [ ] No behavioral advertising to minors
- [ ] Reasonable data security measures
- [ ] Data retention limits
- [ ] Third-party service provider oversight

---

## API Endpoints Summary

### Consent & Verification
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Enhanced with age verification |
| GET | `/api/consent/verify/:token` | Parent consent verification |
| POST | `/api/consent/approve` | Parent approves consent |
| GET | `/api/consent/status/:userId` | Check consent status |

### Parent-Scout Linking
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/links/request` | Request account link |
| GET | `/api/links/pending` | Get pending requests |
| POST | `/api/links/approve/:id` | Approve link |
| POST | `/api/links/reject/:id` | Reject link |
| DELETE | `/api/links/:id` | Remove link |
| GET | `/api/links/my-scouts` | Parent's linked scouts |
| GET | `/api/links/my-parents` | Scout's linked parents |

### Privacy & Data
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/privacy/policy` | Get privacy policy |
| GET | `/api/privacy/terms` | Get terms of service |
| POST | `/api/privacy/consent` | Record consent |
| GET | `/api/privacy/my-consents` | User's consent history |
| POST | `/api/privacy/export` | Request data export |
| GET | `/api/privacy/export/:id` | Download export |
| POST | `/api/privacy/delete-request` | Request deletion |
| POST | `/api/privacy/cancel-deletion` | Cancel deletion |

---

## Frontend Changes

### New Pages
- `privacy-policy.html` - Privacy policy page
- `terms-of-service.html` - Terms of service page
- `consent.html` - Parental consent approval page
- `data-export.html` - Data export request page

### Updated Pages
- `register.html` - Add date of birth, age verification, consent checkboxes
- `login.html` - Add account lockout messaging
- `index.html` - Add parent dashboard view for linked scouts

### New Components
- Consent checkbox component with policy links
- Age verification date picker
- Parent consent status banner
- Linked accounts management panel
- Data export/delete request forms

---

## Environment Variables

```env
# Existing
SESSION_SECRET=your-secure-secret-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# New for Phase 2
ENCRYPTION_KEY=your-64-character-hex-encryption-key
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASS=your-smtp-password
SMTP_FROM=GSCTracker <noreply@example.com>
DATA_RETENTION_DAYS=30
```

---

## Dependencies to Add

```json
{
  "nodemailer": "^6.9.7",
  "crypto": "built-in"
}
```

---

## Testing Checklist

### Age Verification & Consent
- [ ] Minor (under 13) registration requires parent email
- [ ] Minor account inactive until parent consents
- [ ] Parent receives consent email with link
- [ ] Consent link expires after 7 days
- [ ] Parent consent recorded with timestamp and IP
- [ ] Minor account activates after consent

### Parent-Scout Linking
- [ ] Parent can request link to scout
- [ ] Scout/existing parent must approve link
- [ ] Linked parent can view scout's data
- [ ] Parent cannot edit without permission
- [ ] Link can be revoked by either party

### Data Privacy
- [ ] User can export all their data (JSON/CSV)
- [ ] Parent can export child's data
- [ ] User can request account deletion
- [ ] 30-day waiting period before deletion
- [ ] User can cancel deletion request
- [ ] Audit log shows all minor data access

### Security
- [ ] Account locks after 5 failed login attempts
- [ ] Lockout lasts 15 minutes
- [ ] Security headers present on all responses
- [ ] Sensitive data encrypted in database
- [ ] No SQL injection vulnerabilities
- [ ] No XSS vulnerabilities

---

## Acceptance Criteria

1. **Minors cannot use the app without verified parental consent**
2. **Parents have full visibility into their child's data**
3. **All access to minor's data is logged**
4. **Users can export or delete their data on request**
5. **Security testing reveals no critical vulnerabilities**
6. **COPPA compliance documentation is complete and reviewed**

---

## Next Phase

**Phase 3: Troop Management & Cookie Products** will implement:
- Troop hierarchy and organization
- Troop dashboard for leaders
- Cookie product catalog management
- Season/year-based configuration
