# Implementation Plan: Member Editing Capabilities

## Context

The Apex Scout Manager currently allows troop leaders to **view** member data in the Troop > Membership tab, but there is no ability to **edit** member details. Users can see member names, roles, levels, and status, with a "View" button that currently does nothing meaningful.

This implementation adds comprehensive member editing functionality for authorized users (troop leaders, co-leaders with proper privileges) to manage:
- **Personal Information**: Name, date of birth, profile picture
- **Contact Information**: Email, phone, address (NEW fields)
- **Troop Information**: Role, position, scout level, den assignment, parent linking
- **Payment Options**: Venmo, PayPal, and other payment method URLs
- **Account Management**: Password reset, account deletion (COPPA-compliant)

This is a critical feature for troop management, allowing leaders to maintain accurate member records, help families update contact information, and manage roster changes throughout the year.

---

## Implementation Overview

### Database Changes (Migration 006)
- Add to `users` table: `phone`, `address`, `passwordResetToken`, `passwordResetExpires`, `lastPasswordChange`
- Add to `troop_members` table: `den`, `position`, `additionalRoles` (if not already present)

### API Endpoints (9 new endpoints)
1. `GET /api/users/:userId` - Fetch user profile
2. `PUT /api/users/:userId` - Update user profile (name, contact, photo)
3. `PUT /api/troop/:troopId/members/:userId` - Update troop-specific data (role, level, den, parent link)
4. `POST /api/users/:userId/password-reset-request` - Initiate password reset
5. `POST /api/users/password-reset` - Complete password reset with token
6. `GET /api/users/:userId/payment-methods` - List payment methods
7. `POST /api/users/:userId/payment-methods` - Add payment method
8. `DELETE /api/users/:userId/payment-methods/:methodId` - Remove payment method
9. `DELETE /api/users/:userId` - Soft delete account (COPPA-compliant)
10. `GET /api/troop/:troopId/parents` - Search for parent users to link

### Frontend Changes
- Add "Edit Member" modal with 5 sections (Personal, Contact, Troop, Payment, Account Actions)
- Add "Delete Account Confirmation" modal
- Update member table "View" buttons to "Edit"
- Add parent linking dropdown (search existing troop members)
- Add payment methods management UI

### Security & Compliance
- Privilege enforcement via `edit_personal_info` (H scope for parents, T for leaders) and `manage_members` (T/D/H/S scopes)
- COPPA compliance: Minors cannot self-delete; parents/leaders only
- Soft delete with 30-day recovery period
- Audit logging for all edit operations

---

## Detailed Implementation Steps

### Step 1: Database Migration

**File**: `/data/ASM/migrations/006_add_member_editing_fields.sql`

```sql
-- Add contact and password reset fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "lastPasswordChange" TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "passwordResetToken" VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS "passwordResetExpires" TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users("passwordResetToken") WHERE "passwordResetToken" IS NOT NULL;

-- Add troop-specific fields to troop_members table (if not already present)
ALTER TABLE troop_members ADD COLUMN IF NOT EXISTS den VARCHAR(50);
ALTER TABLE troop_members ADD COLUMN IF NOT EXISTS position VARCHAR(100);
ALTER TABLE troop_members ADD COLUMN IF NOT EXISTS "additionalRoles" JSONB;

CREATE INDEX IF NOT EXISTS idx_troop_members_den ON troop_members(den) WHERE den IS NOT NULL;

COMMENT ON COLUMN users.phone IS 'Contact phone number';
COMMENT ON COLUMN users.address IS 'Mailing address';
COMMENT ON COLUMN users."passwordResetToken" IS 'Token for password reset (expires in 1 hour)';
COMMENT ON COLUMN troop_members.den IS 'Den or patrol assignment for scope filtering';
COMMENT ON COLUMN troop_members.position IS 'Leadership position or title';
COMMENT ON COLUMN troop_members."additionalRoles" IS 'Array of additional role identifiers';
```

**Rationale**:
- Store contact info in `users` table (not separate table) for simplicity (1:1 relationship)
- Password reset fields support secure token-based reset flow
- `den`, `position`, `additionalRoles` needed for scope-based filtering and role management

---

### Step 2: Backend API Endpoints

#### 2.1 User Profile Endpoints

**File**: `/data/ASM/server.js` (add around line 2400+)

##### GET /api/users/:userId
```javascript
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
```

##### PUT /api/users/:userId
```javascript
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
```

##### PUT /api/troop/:troopId/members/:userId
```javascript
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
```

#### 2.2 Password Reset Endpoints

##### POST /api/users/:userId/password-reset-request
```javascript
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
```

##### POST /api/users/password-reset
```javascript
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
```

#### 2.3 Payment Methods Endpoints

##### GET /api/users/:userId/payment-methods
```javascript
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
```

##### POST /api/users/:userId/payment-methods
```javascript
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
```

##### DELETE /api/users/:userId/payment-methods/:methodId
```javascript
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
```

#### 2.4 Account Deletion (COPPA-Compliant)

##### DELETE /api/users/:userId
```javascript
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
```

#### 2.5 Parent Linking Helper

##### GET /api/troop/:troopId/parents
```javascript
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
```

#### 2.6 Update GET /api/troop/:troopId/members

**Change**: Add missing fields to SELECT query

```javascript
// Current line 1797-1809: Add scoutLevel, den, position, linkedParentId to SELECT
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
```

---

### Step 3: Frontend - Edit Member Modal

**File**: `/data/ASM/public/index.html` (add around line 1250, after existing modals)

```html
<!-- Edit Member Modal -->
<div id="editMemberModal" class="modal" style="display: none;">
  <div class="modal-content modal-lg" style="max-height: 90vh; overflow-y: auto;">
    <div class="modal-header">
      <h3>Edit Member</h3>
      <button class="modal-close" onclick="closeEditMemberModal()">&times;</button>
    </div>
    <div class="modal-body">
      <form id="editMemberForm">
        <input type="hidden" id="editMemberId" value="">

        <!-- Personal Information -->
        <div class="form-section">
          <h4>Personal Information</h4>
          <div class="form-row">
            <div class="form-group">
              <label for="editFirstName">First Name *</label>
              <input type="text" id="editFirstName" required>
            </div>
            <div class="form-group">
              <label for="editLastName">Last Name *</label>
              <input type="text" id="editLastName" required>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="editDateOfBirth">Date of Birth</label>
              <input type="date" id="editDateOfBirth">
              <small class="form-help" id="editMinorStatus"></small>
            </div>
            <div class="form-group">
              <label for="editPhotoUrl">Photo URL</label>
              <input type="url" id="editPhotoUrl" placeholder="https://...">
            </div>
          </div>
        </div>

        <!-- Contact Information -->
        <div class="form-section">
          <h4>Contact Information</h4>
          <div class="form-group">
            <label for="editEmail">Email</label>
            <input type="email" id="editEmail">
            <small class="form-help">Used for login and notifications</small>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="editPhone">Phone</label>
              <input type="tel" id="editPhone" placeholder="(555) 123-4567">
            </div>
            <div class="form-group">
              <label for="editAddress">Address</label>
              <input type="text" id="editAddress" placeholder="123 Main St, City, ST 12345">
            </div>
          </div>
        </div>

        <!-- Troop Information -->
        <div class="form-section">
          <h4>Troop Information</h4>
          <div class="form-row">
            <div class="form-group">
              <label for="editRole">Role</label>
              <select id="editRole">
                <option value="member">Scout/Member</option>
                <option value="parent">Parent</option>
                <option value="volunteer">Volunteer</option>
                <option value="assistant">Assistant Leader</option>
                <option value="co-leader">Co-Leader</option>
              </select>
            </div>
            <div class="form-group">
              <label for="editPosition">Position</label>
              <input type="text" id="editPosition" placeholder="e.g., Treasurer, Scribe">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="editScoutLevel">Scout Level</label>
              <select id="editScoutLevel">
                <option value="">Not a scout</option>
                <option value="Daisy">Daisy</option>
                <option value="Brownie">Brownie</option>
                <option value="Junior">Junior</option>
                <option value="Cadette">Cadette</option>
                <option value="Senior">Senior</option>
                <option value="Ambassador">Ambassador</option>
              </select>
            </div>
            <div class="form-group">
              <label for="editDen">Den</label>
              <input type="text" id="editDen" placeholder="Den name/number">
            </div>
          </div>
          <div class="form-group">
            <label for="editLinkedParent">Linked Parent/Guardian</label>
            <select id="editLinkedParent">
              <option value="">No parent linked</option>
            </select>
            <small class="form-help">Link this scout to a parent/guardian in the troop</small>
          </div>
        </div>

        <!-- Payment Methods -->
        <div class="form-section">
          <h4>Payment Methods</h4>
          <div id="editPaymentMethodsList"></div>
          <button type="button" class="btn btn-secondary btn-sm" onclick="addPaymentMethod()">
            + Add Payment Method
          </button>
        </div>

        <!-- Account Actions -->
        <div class="form-section">
          <h4>Account Actions</h4>
          <div class="action-buttons">
            <button type="button" class="btn btn-warning" onclick="initiatePasswordReset()">
              Reset Password
            </button>
            <button type="button" class="btn btn-danger" onclick="confirmDeleteAccount()">
              Delete Account
            </button>
          </div>
          <small class="form-help text-danger">
            Warning: Account deletion is permanent and cannot be undone.
          </small>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeEditMemberModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveEditMember()">Save Changes</button>
    </div>
  </div>
</div>

<!-- Delete Account Confirmation Modal -->
<div id="deleteAccountModal" class="modal" style="display: none;">
  <div class="modal-content">
    <div class="modal-header">
      <h3>Confirm Account Deletion</h3>
      <button class="modal-close" onclick="closeDeleteAccountModal()">&times;</button>
    </div>
    <div class="modal-body">
      <p class="text-danger">
        <strong>Warning:</strong> This action will permanently delete this account and all associated data.
      </p>
      <p>The account will be deactivated immediately and fully deleted after 30 days.</p>
      <div class="form-group">
        <label for="deleteReason">Reason for deletion (optional)</label>
        <textarea id="deleteReason" rows="3" placeholder="e.g., Member left troop, duplicate account, etc."></textarea>
      </div>
      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" id="confirmDeleteCheckbox">
          I understand this action is permanent
        </label>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeDeleteAccountModal()">Cancel</button>
      <button class="btn btn-danger" onclick="executeAccountDeletion()">Delete Account</button>
    </div>
  </div>
</div>
```

---

## Privilege Enforcement Matrix

| Action | Privilege | Scope | Who Can Access |
|--------|-----------|-------|----------------|
| View member details | `view_roster` | T/D/H/S | All per scope |
| Edit personal info | `edit_personal_info` | H (parents), T (leaders) | Parents (household), Leaders (troop) |
| Edit troop role | `manage_members` | T/D/H/S | Leaders per scope |
| Link parent | `manage_members` | T | Troop-wide leaders |
| View payment methods | `view_sales` | S/H | Self or household |
| Manage payment methods | `manage_payment_methods` | S | Self only |
| Reset password (others) | `edit_personal_info` | T | Leaders |
| Delete account (minor) | `delete_own_data` | T (leaders only) | Leaders or parents |
| Delete own account | `delete_own_data` | S | Adults 18+ only |

---

## Implementation Checklist

### Phase 1: Database & Core Editing (Day 1-2)
- [ ] Create migration 006
- [ ] Run migration in dev environment
- [ ] Add GET /api/users/:userId endpoint
- [ ] Add PUT /api/users/:userId endpoint
- [ ] Add PUT /api/troop/:troopId/members/:userId endpoint
- [ ] Update GET /api/troop/:troopId/members to include new fields
- [ ] Create Edit Member modal HTML (basic fields only)
- [ ] Add openEditMemberModal(), closeEditMemberModal(), saveEditMember() functions
- [ ] Update "View" button to "Edit" and call openEditMemberModal()
- [ ] Test basic profile editing

### Phase 2: Parent Linking & Payment Methods (Day 3)
- [ ] Add GET /api/troop/:troopId/parents endpoint
- [ ] Add loadParentOptions() function
- [ ] Add parent linking UI to modal
- [ ] Add GET /api/users/:userId/payment-methods endpoint
- [ ] Add POST /api/users/:userId/payment-methods endpoint
- [ ] Add DELETE /api/users/:userId/payment-methods/:methodId endpoint
- [ ] Add renderPaymentMethods(), addPaymentMethod(), deletePaymentMethod() functions
- [ ] Add payment methods section to modal
- [ ] Test parent linking and payment methods

### Phase 3: Password Reset (Day 4)
- [ ] Add POST /api/users/:userId/password-reset-request endpoint
- [ ] Add POST /api/users/password-reset endpoint
- [ ] Add initiatePasswordReset() function
- [ ] Add password reset button to modal
- [ ] Test password reset flow (dev mode - token display)

### Phase 4: Account Deletion (Day 5)
- [ ] Add DELETE /api/users/:userId endpoint
- [ ] Create Delete Account Confirmation modal HTML
- [ ] Add confirmDeleteAccount(), closeDeleteAccountModal(), executeAccountDeletion() functions
- [ ] Implement COPPA minor protection
- [ ] Test deletion workflow (minor protection, soft delete, audit logging)

### Phase 5: Polish & Testing (Day 6)
- [ ] Add CSS styles for modals and forms
- [ ] Add calculateAge() helper function
- [ ] Add minor status display on edit form
- [ ] Test all privilege scopes (T/D/H/S)
- [ ] Test mobile responsive layout
- [ ] Error handling improvements
- [ ] Final manual testing of all scenarios

---

## Critical Files to Modify

1. **`/data/ASM/migrations/006_add_member_editing_fields.sql`** (NEW) - Database schema updates
2. **`/data/ASM/server.js`** - Add 10 new API endpoints (~500 lines)
3. **`/data/ASM/public/index.html`** - Add Edit Member modal and Delete Confirmation modal (~250 lines)
4. **`/data/ASM/public/script.js`** - Add member editing functions (~450 lines)
5. **`/data/ASM/public/styles.css`** - Add modal and form styles (~150 lines)

**Total estimated code**: ~1,350 lines

---

## Verification Steps

After implementation:

1. **Database Migration**: Run migration and verify columns added
2. **API Testing**: Use curl/Postman to test all 10 endpoints
3. **UI Testing**: Open Edit Member modal and verify all sections render
4. **Privilege Testing**: Test with different user roles (member, parent, volunteer, leader)
5. **COPPA Testing**: Verify minors cannot self-delete
6. **Audit Logging**: Check `audit_log` table for all edit operations
7. **Mobile Testing**: Test responsive layout on mobile device/emulator
