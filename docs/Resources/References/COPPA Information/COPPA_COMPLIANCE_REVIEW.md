# COPPA Compliance Review Report
**Apex Scout Manager - Member Editing Feature**
**Date**: 2026-02-12
**Reviewer**: COPPA Compliance Agent
**Status**: ❌ **NON-COMPLIANT** - Critical violations require immediate remediation

---

## Executive Summary

This review evaluates the newly implemented member editing functionality in Apex Scout Manager for compliance with the Children's Online Privacy Protection Act (COPPA). The application collects personal information from children under 13 and is therefore subject to COPPA requirements.

**Overall Assessment**: The application has **CRITICAL COMPLIANCE VIOLATIONS** that must be addressed before deploying to production with users under 13.

### Critical Issues Found
1. ❌ No verifiable parental consent mechanism
2. ❌ No privacy policy or parental notice
3. ⚠️ Collecting unnecessary information from minors
4. ⚠️ Incomplete data anonymization on deletion

### Compliant Features
- ✅ Correct age calculation (under 13)
- ✅ Minor self-deletion prevention
- ✅ Audit trails for data changes
- ✅ Household scope access control

---

## Detailed Findings

### CRITICAL VIOLATION #1: No Verifiable Parental Consent Mechanism

**Location**: `/data/ASM/server.js` lines 510-576 (registration endpoint)

**Issue**: The application collects `parentEmail` from minors under 13 but NEVER obtains or verifies parental consent before collecting personal information.

**Evidence**:
- Line 516-520: Requires `parentEmail` for minors during registration
- Line 543: Sets minors to `isActive = FALSE` (account disabled)
- Line 559-566: Creates notification saying "consent email has been sent to parent/guardian" but **NO EMAIL IS ACTUALLY SENT**
- Database fields `parentConsentDate` and `parentConsentIP` exist but are NEVER populated
- No code pathway exists to activate minor accounts after consent

**COPPA Violation**: 16 CFR § 312.5(a) - "An operator must obtain verifiable parental consent before any collection, use, or disclosure of personal information from children."

**Risk Level**: **CRITICAL**

**Potential Penalties**: FTC enforcement action with civil penalties up to $51,744 per violation.

**Current Code Issues**:
```javascript
// Line 559-566 in server.js
const notification = await db.getOne(`
    INSERT INTO notifications ("userId", message, "isRead")
    VALUES ($1, $2, FALSE)
    RETURNING *
`, [userId, 'Welcome! A consent email has been sent to your parent/guardian.']);

// ❌ NO EMAIL IS ACTUALLY SENT
// ❌ parentConsentDate remains NULL
// ❌ Account stays disabled forever
```

---

### CRITICAL VIOLATION #2: No Privacy Policy or Parental Notice

**Location**: Entire codebase

**Issue**: No privacy policy exists anywhere in the application. Parents cannot review data practices before providing consent.

**Evidence**:
- Searched entire codebase: No privacy policy file found
- Registration form (`/data/ASM/public/register.html`): No link to privacy policy
- No disclosure of:
  - What personal information is collected
  - How it will be used
  - Whether it's shared with third parties
  - Parent rights to review/delete data
  - Contact information for privacy inquiries

**COPPA Violation**: 16 CFR § 312.4 - "An operator must provide clear, understandable, and complete notice of its information practices."

**Required Disclosures (Missing)**:
1. Types of personal information collected
2. How information will be used
3. Whether information is disclosed to third parties
4. Parental rights (review, delete, refuse further collection)
5. Operator contact information

**Risk Level**: **CRITICAL**

**Impact**: Without a privacy policy, any parental consent obtained would be invalid, as parents cannot make informed decisions.

---

### HIGH PRIORITY ISSUE #3: Collecting Unnecessary Information from Minors

**Location**:
- `/data/ASM/server.js` lines 1853-1910 (PUT /api/users/:userId)
- `/data/ASM/public/index.html` lines 1265+ (Edit Member modal)
- `/data/ASM/migrations/006_add_member_editing_fields.sql`

**Issue**: The application collects phone numbers, physical addresses, and payment method URLs without clear justification for their necessity.

**Evidence**:
- Migration 006 added `phone` and `address` fields to users table
- Edit Member modal collects: phone, address, payment URLs (Venmo, PayPal)
- No indication that these fields are required for basic troop participation
- No separate parental consent for payment information collection

**Fields Collected**:
```sql
-- Added in migration 006
ALTER TABLE users ADD COLUMN phone VARCHAR(20);
ALTER TABLE users ADD COLUMN address TEXT;

-- Payment methods table
CREATE TABLE payment_methods (
    "userId" UUID,
    name VARCHAR(255),     -- "Venmo", "PayPal"
    url TEXT,             -- Payment URL or handle
    "isEnabled" BOOLEAN
);
```

**COPPA Violation**: 16 CFR § 312.7 - "An operator may not condition a child's participation in a game, the offering of a prize, or another activity on the child disclosing more personal information than is reasonably necessary to participate in such activity."

**Risk Level**: **HIGH**

**Data Minimization Violation**: Collecting more data than necessary increases liability and violates COPPA's data minimization principle.

**Recommendation**:
- Make phone and address **optional** fields
- Add clear purpose statements ("Only required for emergency contact")
- Require separate parental consent for payment method storage
- Consider if payment URLs are necessary at all for minors

---

### HIGH PRIORITY ISSUE #4: Incomplete Data Anonymization on Deletion

**Location**: `/data/ASM/server.js` lines 2255-2263

**Issue**: Soft delete implementation clears some PII but retains identifying information including name, date of birth, and photo URL.

**Current Implementation**:
```javascript
// Soft delete: anonymize and mark inactive
await db.run(`
    UPDATE users
    SET "isActive" = FALSE,
        email = CONCAT('deleted_', id, '@deleted.local'),
        phone = NULL,
        address = NULL
    WHERE id = $1
`, [userId]);
```

**Data Still Retained After "Deletion"**:
- ❌ `firstName` - Child's first name
- ❌ `lastName` - Child's last name
- ❌ `dateOfBirth` - Age/birthday information
- ❌ `photoUrl` - Potentially contains child's image
- ❌ `isMinor` - Flag indicating child status
- ❌ Scout profile data (badges, achievements)
- ❌ Payment methods

**COPPA Violation**: 16 CFR § 312.10 - "An operator must delete personal information collected from a child upon request by the child's parent and must also delete such information collected from a child when the information is no longer necessary to fulfill the specific purpose for which it was collected."

**Risk Level**: **HIGH**

**Impact**: Retained PII could be considered non-compliance with COPPA deletion requirements and expose organization to liability.

---

### MEDIUM PRIORITY ISSUE #5: No Parental Access Portal

**Issue**: No dedicated mechanism for parents to comprehensively review all data collected about their child in one place.

**Current State**:
- Parents have `edit_personal_info` privilege with "H" (household) scope
- Parents can edit data through the standard Edit Member modal
- No comprehensive "My Child's Data" view exists

**Missing Capabilities**:
- No single view showing all data collected about child
- No way to see data sharing history
- No download/export of child's data

**COPPA Requirement**: 16 CFR § 312.6 - "A parent must be provided a reasonable means to review the personal information collected from his or her child."

**Risk Level**: **MEDIUM**

**Current Workaround**: Parents can use Edit Member modal to view/edit data, but this doesn't show comprehensive data collection (sales history, event participation, audit logs, etc.)

**Recommendation**: Create dedicated parent portal showing:
- Profile information
- Troop memberships
- Sales/fundraising history
- Badge/achievement data
- Event registrations
- Payment methods
- Audit log (who accessed child's data)

---

### MEDIUM PRIORITY ISSUE #6: Third-Party Payment URLs Without Consent

**Location**: `/data/ASM/server.js` lines 2145-2183 (payment methods endpoints)

**Issue**: Payment method URLs (Venmo, PayPal) are stored without disclosure about potential third-party data sharing.

**Evidence**:
```javascript
// POST /api/users/:userId/payment-methods
// No check if user is minor
// No parental consent required
// No disclosure of third-party implications

app.post('/api/users/:userId/payment-methods', async (req, res) => {
    const { name, url, isEnabled } = req.body;

    // Validate URL format
    try {
        new URL(url);
    } catch (e) {
        return res.status(400).json({ error: 'Invalid URL format' });
    }

    // ❌ No check for minor status
    // ❌ No parental consent verification

    const method = await db.getOne(`
        INSERT INTO payment_methods ("userId", name, url, "isEnabled")
        VALUES ($1, $2, $3, $4)
        RETURNING *
    `, [userId, name, url, isEnabled !== false]);
});
```

**Concerns**:
- Payment URLs may enable direct contact with child outside the platform
- Venmo/PayPal profiles may contain additional personal information
- URLs might be visible to other troop members (need to verify)
- No disclosure in (non-existent) privacy policy about this data collection

**COPPA Consideration**: Sharing personal information or persistent identifiers with third parties requires clear disclosure in privacy policy and may require separate consent.

**Risk Level**: **MEDIUM**

**Recommendation**:
1. Disclose payment URL collection in privacy policy
2. Prevent minors from adding payment methods themselves:
   ```javascript
   if (user.isMinor && req.session.userId === userId) {
       return res.status(403).json({
           error: 'Parent/guardian must add payment methods for minor accounts'
       });
   }
   ```
3. Add separate consent checkbox for payment information

---

### LOW PRIORITY ISSUE #7: Weak Password Reset Security for Minors

**Location**: `/data/ASM/server.js` lines 2025-2116

**Issue**: Password reset tokens are sent to the child's email address instead of the parent's email for minor accounts.

**Current Implementation**:
```javascript
app.post('/api/users/:userId/password-reset-request', async (req, res) => {
    const user = await db.getOne('SELECT * FROM users WHERE id = $1', [userId]);

    // Generate token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // TODO: Send email with reset link
    // ❌ Sends to user.email (child's email)
    // ❌ Should send to user.parentEmail if user.isMinor === true

    res.json({
        message: 'Password reset initiated',
        resetToken: resetToken // DEV ONLY - remove in production
    });
});
```

**Issues**:
- Password reset sent to child's email, not parent's email
- Dev mode exposes token in API response (noted as "DEV ONLY")
- Could allow child to reset password without parent knowledge

**Risk Level**: **LOW** (assuming dev mode token exposure removed before production)

**Recommendation**:
```javascript
// Send to parent email if minor
const recipientEmail = user.isMinor ? user.parentEmail : user.email;
await sendPasswordResetEmail(recipientEmail, { resetToken });
```

---

## Compliant Features ✅

### 1. Correct Age Calculation

**Location**: `/data/ASM/auth.js` lines 514-534

The `isMinor()` function correctly identifies children under 13 (COPPA threshold):

```javascript
function isMinor(dateOfBirth) {
    if (!dateOfBirth) return false;
    return calculateAge(dateOfBirth) < 13;  // ✅ Correct: under 13
}

function calculateAge(dateOfBirth) {
    const today = new Date();
    const birth = new Date(dateOfBirth);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    // Account for birthday not yet occurred this year
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age;
}
```

**Correct Behavior**:
- Uses 13 as threshold (not 18)
- Properly accounts for month and day when calculating age
- Returns `false` if no date of birth provided

---

### 2. Minor Self-Deletion Prevention

**Location**: `/data/ASM/server.js` lines 2241-2246

Properly prevents minors from deleting their own accounts:

```javascript
// COPPA protection: Minors cannot self-delete
if (user.isMinor && req.session.userId === userId) {
    return res.status(403).json({
        error: 'Minors cannot delete their own account. Parent/guardian must initiate deletion.'
    });
}
```

**Correct Behavior**:
- Checks if target user is minor (`user.isMinor`)
- Checks if deletion requester is the minor themselves (`req.session.userId === userId`)
- Returns 403 Forbidden with clear error message
- Allows parents/guardians (different user ID) to delete minor accounts

---

### 3. Audit Trail for Data Changes

**Location**: Throughout server.js

All profile updates, deletions, and sensitive operations are logged to `audit_log` table:

```javascript
await auth.logAuditEvent(db, req.session.userId, 'update_user_profile', req, {
    resourceType: 'user',
    resourceId: userId,
    changes: { firstName, lastName, email, phone, address, dateOfBirth }
});
```

**Information Logged**:
- User ID of person making change
- Action type (update_user_profile, delete_user_account, etc.)
- Timestamp
- IP address
- User agent
- Resource type and ID
- Details of what changed

**COPPA Benefit**: Provides accountability and transparency. Parents can (in theory) review who accessed their child's data.

---

### 4. Household Scope Access Control

**Location**: `/data/ASM/privileges.js` line 58

Parents have 'H' (household) scope for `edit_personal_info` privilege:

```javascript
parent: {
    view_roster: 'T',           // Can view all troop members
    edit_personal_info: 'H',    // ✅ Can only edit household members
    view_sales: 'H',            // Can only view household sales
    record_sales: 'S',          // Can only record own sales
    // ...
}
```

**Correct Behavior**:
- Parents can edit personal info for their linked children (household scope)
- Parents cannot edit other families' children
- Prevents unauthorized access to other minors' data
- Implements principle of least privilege

---

## Remediation Plan

### Phase 1: Critical Fixes (Required Before Production)

**Estimated Effort**: 7-10 days
**Priority**: CRITICAL - DO NOT DEPLOY WITHOUT THESE

#### 1.1 Implement Verifiable Parental Consent System (3-5 days)

**Database Migration**:
```sql
-- Add consent tracking fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS "parentConsentToken" VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS "parentConsentExpires" TIMESTAMP WITH TIME ZONE;

CREATE INDEX idx_users_consent_token ON users("parentConsentToken")
WHERE "parentConsentToken" IS NOT NULL;
```

**Backend Implementation**:

**Step 1**: Modify registration to generate consent token
```javascript
// In server.js registration endpoint (around line 559)
if (isMinorUser && parentEmail) {
    const consentToken = crypto.randomBytes(32).toString('hex');
    const consentExpires = new Date(Date.now() + 7 * 24 * 3600000); // 7 days

    await db.run(`
        UPDATE users
        SET "parentConsentToken" = $1,
            "parentConsentExpires" = $2
        WHERE id = $3
    `, [consentToken, consentExpires, userId]);

    // Send email to parent
    await sendParentConsentEmail(parentEmail, {
        childName: `${firstName} ${lastName}`,
        childEmail: email || 'Not provided',
        consentUrl: `${process.env.APP_URL}/parent-consent?token=${consentToken}`,
        dataCollected: [
            'First and last name',
            'Email address',
            'Date of birth',
            'Troop membership information',
            'Optional: phone, address, photo'
        ],
        purpose: 'Troop management, event coordination, fundraising tracking',
        expiresIn: '7 days'
    });

    logger.info('Parent consent email sent', {
        childId: userId,
        parentEmail
    });
}
```

**Step 2**: Create parent consent endpoint
```javascript
// New endpoint for parent consent
app.post('/api/parent-consent', async (req, res) => {
    const { token, parentName, agrees } = req.body;

    // Validate consent
    if (!agrees) {
        return res.status(400).json({
            error: 'Parental consent is required to activate account'
        });
    }

    if (!parentName || parentName.trim().length === 0) {
        return res.status(400).json({
            error: 'Parent name is required for consent verification'
        });
    }

    // Find user by valid consent token
    const user = await db.getOne(`
        SELECT * FROM users
        WHERE "parentConsentToken" = $1
        AND "parentConsentExpires" > NOW()
        AND "isMinor" = TRUE
    `, [token]);

    if (!user) {
        return res.status(400).json({
            error: 'Invalid or expired consent link. Please contact support.'
        });
    }

    // Record consent and activate account
    await db.run(`
        UPDATE users
        SET "isActive" = TRUE,
            "parentConsentDate" = NOW(),
            "parentConsentIP" = $1,
            "parentConsentToken" = NULL,
            "parentConsentExpires" = NULL
        WHERE id = $2
    `, [req.ip, user.id]);

    // Log consent in audit trail
    await auth.logAuditEvent(db, user.id, 'parental_consent_granted', req, {
        resourceType: 'user',
        resourceId: user.id,
        parentEmail: user.parentEmail,
        parentName: parentName,
        consentMethod: 'email_link'
    });

    // Send confirmation email to parent
    await sendConsentConfirmationEmail(user.parentEmail, {
        childName: `${user.firstName} ${user.lastName}`,
        parentName: parentName,
        consentDate: new Date().toISOString()
    });

    res.json({
        message: 'Parental consent recorded successfully. Account is now active.',
        childName: `${user.firstName} ${user.lastName}`
    });
});
```

**Step 3**: Create parent consent page
```html
<!-- /data/ASM/public/parent-consent.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Parental Consent - Apex Scout Manager</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="consent-container">
        <h1>Parental Consent Required</h1>

        <div class="consent-notice">
            <h2>About This Consent Request</h2>
            <p>Your child has registered for Apex Scout Manager. Because they are under 13 years old,
            federal law (COPPA) requires us to obtain your consent before we can collect or use
            their personal information.</p>
        </div>

        <div class="data-collection-notice">
            <h3>Information We Collect:</h3>
            <ul>
                <li>First and last name</li>
                <li>Email address (optional)</li>
                <li>Date of birth</li>
                <li>Troop membership information</li>
                <li>Optionally: phone number, mailing address, profile photo</li>
            </ul>

            <h3>How We Use This Information:</h3>
            <ul>
                <li>Manage troop membership and activities</li>
                <li>Coordinate events and meetings</li>
                <li>Track fundraising participation</li>
                <li>Communicate with troop members and families</li>
            </ul>

            <h3>Your Rights as a Parent:</h3>
            <ul>
                <li>Review your child's information at any time</li>
                <li>Request changes to incorrect information</li>
                <li>Request deletion of your child's account</li>
                <li>Refuse to allow further collection or use</li>
            </ul>

            <p><strong>Privacy Policy:</strong> <a href="/privacy-policy.html" target="_blank">Read our full privacy policy</a></p>
            <p><strong>Contact:</strong> privacy@apexscoutmanager.org</p>
        </div>

        <form id="consentForm">
            <div class="form-group">
                <label for="parentName">Your Name (Parent/Guardian) *</label>
                <input type="text" id="parentName" required>
            </div>

            <div class="form-group checkbox-group">
                <label>
                    <input type="checkbox" id="consentCheckbox" required>
                    I am the parent or legal guardian of this child, and I consent to the collection,
                    use, and disclosure of my child's personal information as described above.
                </label>
            </div>

            <div class="form-actions">
                <button type="submit" class="btn btn-primary">Grant Consent</button>
                <button type="button" class="btn btn-secondary" onclick="denyConsent()">Deny Consent</button>
            </div>
        </form>

        <div id="feedback" class="feedback hidden"></div>
    </div>

    <script>
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');

        if (!token) {
            document.getElementById('feedback').textContent = 'Invalid consent link';
            document.getElementById('feedback').classList.add('error');
            document.getElementById('consentForm').style.display = 'none';
        }

        document.getElementById('consentForm').addEventListener('submit', async (e) => {
            e.preventDefault();

            const parentName = document.getElementById('parentName').value.trim();
            const agrees = document.getElementById('consentCheckbox').checked;

            if (!agrees) {
                alert('Please check the consent checkbox to proceed');
                return;
            }

            try {
                const response = await fetch('/api/parent-consent', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, parentName, agrees })
                });

                const result = await response.json();

                if (response.ok) {
                    document.getElementById('feedback').textContent = result.message;
                    document.getElementById('feedback').classList.add('success', 'visible');
                    document.getElementById('consentForm').style.display = 'none';
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                document.getElementById('feedback').textContent = error.message;
                document.getElementById('feedback').classList.add('error', 'visible');
            }
        });

        function denyConsent() {
            if (confirm('Are you sure you want to deny consent? This will prevent the account from being activated.')) {
                window.location.href = '/consent-denied.html';
            }
        }
    </script>
</body>
</html>
```

**Acceptable Consent Methods** (choose at least one):
1. ✅ **Email with unique link** (implemented above) - Acceptable for COPPA
2. Credit card verification (more robust but complex)
3. Video conference verification
4. Signed consent form via email/fax/mail
5. Government ID verification

---

#### 1.2 Create Comprehensive Privacy Policy (2-3 days)

**File**: `/data/ASM/public/privacy-policy.html`

**Required Sections**:

```markdown
# Privacy Policy - Apex Scout Manager

**Last Updated**: [Date]

## Introduction

Apex Scout Manager ("we", "us", "our") provides troop management software for Girl Scout and Scouting America troops. We are committed to protecting the privacy of all users, especially children under 13.

This Privacy Policy explains what information we collect, how we use it, and the rights parents have regarding their children's information.

## Information We Collect

### From All Users
- **Account Information**: First name, last name, email address
- **Profile Information**: Date of birth, profile photo (optional)
- **Troop Membership**: Troop affiliation, role, scout level
- **Activity Information**: Event participation, fundraising sales
- **Technical Information**: IP address, browser type, session data

### From Children Under 13 (Additional)
- **Parent Contact**: Parent/guardian email address (required)
- **Optional Information**: Phone number, mailing address (only if parent consents)

### From Parents/Guardians
- **Contact Information**: Email address, phone number (optional)
- **Consent Records**: Date, time, and method of consent

## How We Use Information

We use collected information to:
- Manage troop membership and activities
- Coordinate events and meetings
- Track fundraising participation
- Communicate with troop members and families
- Improve our services
- Comply with legal obligations

## Information Sharing

### We DO Share:
- **Within Your Troop**: Troop leaders and authorized volunteers can view member information within their assigned scope
- **With Service Providers**: Hosting (PostgreSQL, Redis), email delivery (only with parental consent)

### We DO NOT:
- Sell personal information to third parties
- Share information with advertisers
- Use information for targeted advertising
- Share children's information outside the troop without parental consent

## Children Under 13 (COPPA Compliance)

### Parental Consent
We require verifiable parental consent before collecting personal information from children under 13. Parents will receive an email with:
- Description of information collected
- How information will be used
- Link to provide or deny consent
- Account remains inactive until consent granted

### Parental Rights
Parents of children under 13 have the right to:
- **Review**: View all information collected about their child
- **Edit**: Correct inaccurate information
- **Delete**: Request deletion of their child's account
- **Refuse**: Prevent further collection or use of information
- **Withdraw**: Revoke consent at any time

To exercise these rights, contact: privacy@apexscoutmanager.org

### Data Minimization
We only collect information reasonably necessary for troop participation. Optional fields (phone, address) are clearly marked and only collected with parental consent.

## Data Security

We protect personal information using:
- Industry-standard encryption (HTTPS, TLS 1.3)
- Secure password hashing (bcrypt with 12 rounds)
- Access controls and privilege-based permissions
- Regular security audits
- Audit logging of all data access

## Data Retention

- **Active Accounts**: Information retained while account is active
- **Deleted Accounts**: Information anonymized immediately, fully deleted within 30 days
- **Audit Logs**: Retained for 3 years for compliance and security purposes

## Cookies and Tracking

We use:
- **Session Cookies**: Required for login and account management
- **No Tracking**: We do not use analytics, advertising, or third-party tracking

## Your Rights

All users have the right to:
- Access their personal information
- Correct inaccurate information
- Delete their account
- Export their data
- Object to certain processing

## Changes to This Policy

We will notify users of material changes to this Privacy Policy by:
- Email notification to registered users
- Notice on our website
- For changes affecting children under 13: email to parents

## Contact Information

**Privacy Officer**: privacy@apexscoutmanager.org
**Mailing Address**: [Your Organization Address]
**Phone**: [Phone Number]

## Legal Compliance

This policy complies with:
- Children's Online Privacy Protection Act (COPPA)
- Family Educational Rights and Privacy Act (FERPA) where applicable
- State privacy laws

For COPPA-related inquiries: coppa@apexscoutmanager.org

---

**Consent Record**: If you are a parent providing consent for a child under 13, your consent was recorded on [date] at [time] from IP address [IP]. You may withdraw this consent at any time by contacting us.
```

**Add Privacy Policy Link to Registration**:
```html
<!-- In register.html -->
<p class="privacy-notice">
    By registering, you agree to our <a href="/privacy-policy.html" target="_blank">Privacy Policy</a>.
    <br>For users under 13, parental consent is required.
</p>
```

---

#### 1.3 Fix Data Deletion to Fully Anonymize PII (1 day)

**Location**: `/data/ASM/server.js` line 2255-2263

**Current (Incomplete)**:
```javascript
await db.run(`
    UPDATE users
    SET "isActive" = FALSE,
        email = CONCAT('deleted_', id, '@deleted.local'),
        phone = NULL,
        address = NULL
    WHERE id = $1
`, [userId]);
```

**Fixed (Complete Anonymization)**:
```javascript
// Soft delete: anonymize ALL PII fields
await db.run(`
    UPDATE users
    SET "isActive" = FALSE,
        email = CONCAT('deleted_', id, '@deleted.local'),
        "firstName" = 'Deleted',
        "lastName" = 'User',
        phone = NULL,
        address = NULL,
        "dateOfBirth" = NULL,
        "photoUrl" = NULL,
        "parentEmail" = NULL,
        "isMinor" = FALSE,
        "parentConsentDate" = NULL,
        "parentConsentIP" = NULL,
        password_hash = NULL
    WHERE id = $1
`, [userId]);

// Delete related PII from other tables
await db.run(`DELETE FROM scout_profiles WHERE "userId" = $1`, [userId]);
await db.run(`DELETE FROM payment_methods WHERE "userId" = $1`, [userId]);
await db.run(`DELETE FROM scout_badges WHERE "userId" = $1`, [userId]);

// Anonymize sales records (keep for audit but remove identifying info)
await db.run(`
    UPDATE sales
    SET "customerName" = 'Deleted User',
        "customerEmail" = NULL,
        "customerPhone" = NULL,
        "customerAddress" = NULL
    WHERE "userId" = $1
`, [userId]);
```

**Retain Only**:
- User ID (for referential integrity)
- Audit log entries (for legal compliance)
- Anonymized transaction records (userId only, no names)

---

#### 1.4 Implement Data Minimization (1-2 days)

**Make Optional Fields Clearly Optional**:

**Frontend (index.html)**:
```html
<!-- Contact Information Section -->
<div class="form-section">
    <h4>Contact Information</h4>
    <p class="form-help">
        Optional fields are only collected if necessary for specific troop activities.
        Parents must approve collection of optional information for children under 13.
    </p>

    <div class="form-group">
        <label for="editEmail">Email</label>
        <input type="email" id="editEmail">
        <small class="form-help">Used for login and troop communications</small>
    </div>

    <div class="form-row">
        <div class="form-group">
            <label for="editPhone">Phone <span class="optional-badge">Optional</span></label>
            <input type="tel" id="editPhone" placeholder="(555) 123-4567">
            <small class="form-help">Only required for emergency contact purposes</small>
        </div>
        <div class="form-group">
            <label for="editAddress">Address <span class="optional-badge">Optional</span></label>
            <input type="text" id="editAddress" placeholder="123 Main St, City, ST 12345">
            <small class="form-help">Only required for cookie delivery coordination</small>
        </div>
    </div>
</div>
```

**Prevent Minors from Adding Payment Methods**:

```javascript
// In server.js POST /api/users/:userId/payment-methods
const user = await db.getOne('SELECT * FROM users WHERE id = $1', [userId]);

if (user.isMinor && req.session.userId === userId) {
    return res.status(403).json({
        error: 'Parent/guardian must add payment methods for minor accounts'
    });
}
```

**Add CSS for Optional Badge**:
```css
.optional-badge {
    font-size: 0.75rem;
    color: var(--gray-500);
    font-weight: normal;
    font-style: italic;
}
```

---

### Phase 2: High Priority Improvements (3-5 days)

**Priority**: HIGH - Complete before public launch

#### 2.1 Create Parental Data Access Portal (2-3 days)

**New Endpoint**: `GET /api/parent/child-data/:childId`

```javascript
app.get('/api/parent/child-data/:childId',
    auth.isAuthenticated,
    async (req, res) => {
        try {
            const { childId } = req.params;

            // Verify requester is parent of child
            const child = await db.getOne(
                `SELECT * FROM users
                WHERE id = $1
                AND "parentEmail" = (
                    SELECT email FROM users WHERE id = $2
                )`,
                [childId, req.session.userId]
            );

            if (!child) {
                return res.status(403).json({
                    error: 'Not authorized to access this child\'s data'
                });
            }

            // Gather comprehensive data
            const data = {
                profile: {
                    firstName: child.firstName,
                    lastName: child.lastName,
                    email: child.email,
                    phone: child.phone,
                    address: child.address,
                    dateOfBirth: child.dateOfBirth,
                    photoUrl: child.photoUrl,
                    isActive: child.isActive,
                    parentEmail: child.parentEmail,
                    parentConsentDate: child.parentConsentDate
                },
                troopMemberships: await db.getAll(
                    'SELECT * FROM troop_members WHERE "userId" = $1',
                    [childId]
                ),
                scoutProfile: await db.getOne(
                    'SELECT * FROM scout_profiles WHERE "userId" = $1',
                    [childId]
                ),
                badges: await db.getAll(
                    'SELECT * FROM scout_badges WHERE "userId" = $1 ORDER BY "earnedDate" DESC',
                    [childId]
                ),
                sales: await db.getAll(
                    'SELECT * FROM sales WHERE "userId" = $1 ORDER BY date DESC',
                    [childId]
                ),
                events: await db.getAll(
                    'SELECT * FROM event_registrations WHERE "userId" = $1',
                    [childId]
                ),
                paymentMethods: await db.getAll(
                    'SELECT id, name, url, "isEnabled" FROM payment_methods WHERE "userId" = $1',
                    [childId]
                ),
                auditLog: await db.getAll(
                    `SELECT "performedBy", action, "performedAt", details
                    FROM audit_log
                    WHERE "resourceId" = $1
                    ORDER BY "performedAt" DESC
                    LIMIT 50`,
                    [childId]
                )
            };

            res.json(data);
        } catch (error) {
            logger.error('Error fetching child data for parent', { error: error.message });
            res.status(500).json({ error: 'Failed to fetch child data' });
        }
    }
);
```

**Frontend UI** (`/public/parent-dashboard.html`):
```html
<div class="parent-dashboard">
    <h2>My Child's Data</h2>

    <div class="data-section">
        <h3>Profile Information</h3>
        <dl>
            <dt>Name:</dt><dd id="childName"></dd>
            <dt>Email:</dt><dd id="childEmail"></dd>
            <dt>Date of Birth:</dt><dd id="childDOB"></dd>
            <dt>Account Status:</dt><dd id="childStatus"></dd>
        </dl>
    </div>

    <div class="data-section">
        <h3>Consent Information</h3>
        <p>Consent granted on: <span id="consentDate"></span></p>
        <button onclick="withdrawConsent()">Withdraw Consent & Delete Account</button>
    </div>

    <div class="data-section">
        <h3>Troop Memberships</h3>
        <table id="troopMemberships"></table>
    </div>

    <div class="data-section">
        <h3>Activity History</h3>
        <table id="activityHistory"></table>
    </div>

    <div class="data-section">
        <h3>Data Access Log</h3>
        <p>Who has accessed your child's data:</p>
        <table id="auditLog"></table>
    </div>

    <div class="actions">
        <button onclick="exportChildData()">Export All Data (JSON)</button>
        <button onclick="requestCorrection()">Request Data Correction</button>
        <button onclick="deleteChildAccount()" class="danger">Delete Child's Account</button>
    </div>
</div>
```

---

#### 2.2 Send Password Resets to Parent Email for Minors (1 day)

**Location**: `/data/ASM/server.js` line 2025-2060

**Fix**:
```javascript
app.post('/api/users/:userId/password-reset-request', async (req, res) => {
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

    // ✅ Send to parent email if minor, otherwise to user email
    const recipientEmail = user.isMinor ? user.parentEmail : user.email;
    const recipientName = user.isMinor
        ? `Parent/Guardian of ${user.firstName} ${user.lastName}`
        : `${user.firstName} ${user.lastName}`;

    await sendPasswordResetEmail(recipientEmail, {
        recipientName,
        userName: `${user.firstName} ${user.lastName}`,
        isMinor: user.isMinor,
        resetUrl: `${process.env.APP_URL}/reset-password?token=${resetToken}`,
        expiresIn: '1 hour'
    });

    await auth.logAuditEvent(db, req.session.userId, 'request_password_reset', req, {
        resourceType: 'user',
        resourceId: userId,
        sentTo: recipientEmail
    });

    res.json({
        message: user.isMinor
            ? 'Password reset link sent to parent/guardian email'
            : 'Password reset link sent to your email'
    });
});
```

---

### Phase 3: Additional Improvements

#### Age Gate on Registration
Collect date of birth FIRST, then show COPPA notice if under 13:

```javascript
// Step 1: Collect DOB first
// Step 2: Calculate age
// Step 3: If < 13, show COPPA notice and require parentEmail
// Step 4: Collect remaining information
```

#### Annual Consent Re-verification
```javascript
// Check if consent older than 1 year
const oneYearAgo = new Date();
oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

if (user.isMinor && user.parentConsentDate < oneYearAgo) {
    // Send annual re-consent email
    await sendAnnualConsentEmail(user.parentEmail, {
        childName: `${user.firstName} ${user.lastName}`,
        lastConsentDate: user.parentConsentDate,
        reConsentUrl: `${APP_URL}/annual-consent?userId=${user.id}`
    });
}
```

---

## Testing Checklist

Before deploying to production, verify:

### Parental Consent
- [ ] Minor registration creates disabled account
- [ ] Consent email sent to parentEmail
- [ ] Consent link works and activates account
- [ ] Expired consent links rejected (> 7 days)
- [ ] Consent date/IP recorded in database
- [ ] Audit log entry created

### Privacy Policy
- [ ] Privacy policy accessible at /privacy-policy.html
- [ ] Linked from registration page
- [ ] Linked from login page
- [ ] Contains all required COPPA disclosures
- [ ] Contact information correct

### Data Deletion
- [ ] All PII fields anonymized (firstName, lastName, DOB, photo, etc.)
- [ ] Scout profiles deleted
- [ ] Payment methods deleted
- [ ] Sales records anonymized
- [ ] Troop memberships ended
- [ ] Audit log preserved

### Access Controls
- [ ] Parents can view child data via household scope
- [ ] Parents cannot view other families' data
- [ ] Minors cannot self-delete
- [ ] Minors cannot add payment methods
- [ ] Password resets go to parent email for minors

---

## Questions for Legal Review

1. **Email Consent Sufficiency**: Is email-based consent acceptable for your organization, or do you need stronger verification (credit card, video call)?

2. **Data Retention**: Is 30-day retention after deletion acceptable, or should it be shorter?

3. **Third-Party Services**: Are you using any third-party services (email, analytics, hosting) that need disclosure?

4. **State Laws**: Do you need to comply with state laws (California CCPA, etc.) in addition to COPPA?

5. **Organization Type**: Are you a non-profit? This may affect COPPA applicability.

6. **International Users**: Will you serve users outside the US? (GDPR compliance needed)

7. **Insurance**: Do you have cyber liability insurance covering COPPA violations?

---

## Resources

### COPPA Compliance
- **FTC COPPA Rule**: https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa
- **Compliance FAQ**: https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
- **Six-Step Plan**: https://www.ftc.gov/business-guidance/resources/childrens-online-privacy-protection-rule-six-step-compliance-plan

### Penalties
- **Per-Violation Fine**: Up to $51,744 per violation (as of 2024)
- **Recent Enforcement**: https://www.ftc.gov/news-events/topics/protecting-consumer-privacy-security/childrens-privacy

### Best Practices
- **Privacy by Design**: https://www.ftc.gov/reports/privacy-design-framework
- **Age Verification Methods**: https://www.ftc.gov/business-guidance/resources/how-comply-coppa-rule

---

## Risk Summary

| Risk | Severity | Likelihood | Impact | Mitigation Status |
|------|----------|------------|--------|-------------------|
| FTC Enforcement Action | Critical | High | $51k+ per violation | ❌ Not Mitigated |
| Parent Lawsuit | High | Medium | Legal fees, damages | ❌ Not Mitigated |
| Reputational Damage | High | High | Loss of trust | ❌ Not Mitigated |
| Data Breach Liability | Medium | Low | Increased if non-compliant | ⚠️ Partially Mitigated |

**Overall Risk Assessment**: **CRITICAL** - Do not deploy to production with users under 13 until critical fixes implemented.

---

## Approval & Sign-Off

**Technical Review**: ✅ Complete
**Legal Review**: ⬜ Required
**Privacy Officer Approval**: ⬜ Required
**Management Approval**: ⬜ Required

---

**Report Prepared By**: COPPA Compliance Agent
**Date**: 2026-02-12
**Next Review Date**: [After remediation implementation]

---

## Appendix A: COPPA Rule Summary

### 16 CFR Part 312 - Key Requirements

1. **§ 312.4 Notice**: Clear, understandable notice of data practices
2. **§ 312.5 Consent**: Verifiable parental consent before collection
3. **§ 312.6 Access**: Parents can review child's information
4. **§ 312.7 Conditioning**: Cannot require more data than necessary
5. **§ 312.8 Confidentiality**: Maintain reasonable security
6. **§ 312.10 Deletion**: Delete data when no longer necessary or upon parent request

### Verifiable Parental Consent Methods

**Acceptable Methods**:
- Email with unique link (if combined with additional steps)
- Credit card, debit card, or other payment method
- Face-to-face or video conference
- Signed form (mail, fax, email)
- Photo ID check
- Answering knowledge-based questions

**Not Acceptable**:
- Simple checkbox
- Email to parent asking to reply with "yes"

---

## Document Version

**Version**: 1.0
**Last Updated**: 2026-02-12
**Applies To**: Apex Scout Manager v2.0 Member Editing Feature
**Status**: Initial Assessment - Remediation Required
