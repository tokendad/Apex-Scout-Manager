# Admin System API Endpoints

**Last Updated:** February 13, 2026
**Status:** Phase 1 Complete
**Related Documentation:**
- [Database Schema](/docs/Architecture/DATABASE_SCHEMA.md)
- [Account Access Schema](/docs/Architecture/Account%20Access%20Schema.md)
- [Bootstrap Setup Guide](/docs/Getting%20Started/BOOTSTRAP_SETUP.md)

---

## Overview

The Admin System provides system-level administrative access separate from troop-level roles. Admins have full access to manage all aspects of the Apex Scout Manager system, including organizations, troops, members, and system configuration.

**Key Concepts:**
- **Admin Role**: System-level role stored in the `admins` table, separate from troop roles
- **Bootstrap Flow**: First-time setup creates the initial admin account
- **Audit Trail**: All admin grants/revocations are tracked with timestamps and granting user
- **Admin Middleware**: `requireAdmin` middleware protects admin-only endpoints

---

## Authentication & Authorization

### Admin Middleware

All admin endpoints use the `requireAdmin` middleware which:
1. Verifies user is authenticated (has active session)
2. Checks if user has an active admin record in `admins` table
3. Returns 401 if not authenticated
4. Returns 403 if authenticated but not an admin

**Example Usage:**
```javascript
app.get('/api/system/admins', auth.isAuthenticated, auth.requireAdmin, async (req, res) => {
    // Only admins can access this endpoint
});
```

### Admin Access Pattern

```
User Login → Session Created → Request to Admin Endpoint
    ↓
Check req.session.userId exists
    ↓
Query admins table: SELECT * FROM admins WHERE userId = ? AND revokedAt IS NULL
    ↓
If found: Allow access
If not found: Return 403 Forbidden
```

---

## Bootstrap Endpoints

### Check Bootstrap Status

**Endpoint:** `GET /api/system/bootstrap-status`
**Authentication:** None (public endpoint)
**Description:** Check if the system needs to be bootstrapped with a first admin account

**Response (200 OK):**
```json
{
    "needsBootstrap": true,
    "adminCount": 0
}
```

**Response (200 OK - Already Bootstrapped):**
```json
{
    "needsBootstrap": false,
    "adminCount": 2
}
```

**Error Response (500 Internal Server Error):**
```json
{
    "error": "Failed to check bootstrap status"
}
```

**Usage Notes:**
- This endpoint can be called by anyone (no authentication required)
- Use this to determine if the bootstrap endpoint should be available
- Returns the count of active (non-revoked) admins in the system

---

### Bootstrap First Admin

**Endpoint:** `POST /api/system/bootstrap`
**Authentication:** None (but only works if no admins exist)
**Description:** Create the first admin account in the system

**Request Body:**
```json
{
    "email": "admin@example.com",
    "password": "SecurePassword123!",
    "firstName": "System",
    "lastName": "Administrator"
}
```

**Field Validations:**
- `email`: Required, valid email format, must not already exist
- `password`: Required, minimum 8 characters, must contain uppercase, lowercase, and number
- `firstName`: Required, 1-100 characters
- `lastName`: Required, 1-100 characters

**Response (201 Created):**
```json
{
    "message": "Bootstrap successful",
    "admin": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "userId": "550e8400-e29b-41d4-a716-446655440001",
        "role": "admin",
        "grantedAt": "2026-02-13T10:30:00.000Z",
        "grantedBy": null
    },
    "user": {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "email": "admin@example.com",
        "firstName": "System",
        "lastName": "Administrator"
    }
}
```

**Error Responses:**

**400 Bad Request - Missing Fields:**
```json
{
    "error": "Email, password, firstName, and lastName are required"
}
```

**400 Bad Request - Admin Already Exists:**
```json
{
    "error": "System has already been bootstrapped"
}
```

**409 Conflict - Email Exists:**
```json
{
    "error": "User with this email already exists"
}
```

**500 Internal Server Error:**
```json
{
    "error": "Failed to bootstrap admin"
}
```

**Usage Notes:**
- This endpoint only works when the `admins` table has zero active records
- Once an admin exists, this endpoint returns 400 error
- The first admin has `grantedBy: null` since no admin existed to grant it
- After bootstrap, use the admin login to create additional admins
- Recommended: Create at least 2 admin accounts for redundancy

**Security Considerations:**
- This endpoint is intentionally unauthenticated to allow initial setup
- It's protected by checking the admin count in the database
- In production, consider restricting this endpoint by IP or requiring a setup token
- Always use HTTPS in production to protect credentials during bootstrap

---

## Admin Management Endpoints

### List All Admins

**Endpoint:** `GET /api/system/admins`
**Authentication:** Required (admin access)
**Description:** Get a list of all admin accounts (both active and revoked)

**Response (200 OK):**
```json
{
    "admins": [
        {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "userId": "550e8400-e29b-41d4-a716-446655440001",
            "role": "admin",
            "grantedAt": "2026-02-13T10:30:00.000Z",
            "grantedBy": null,
            "revokedAt": null,
            "revokedBy": null,
            "email": "admin@example.com",
            "firstName": "System",
            "lastName": "Administrator",
            "isActive": true
        },
        {
            "id": "550e8400-e29b-41d4-a716-446655440002",
            "userId": "550e8400-e29b-41d4-a716-446655440003",
            "role": "admin",
            "grantedAt": "2026-02-13T14:15:00.000Z",
            "grantedBy": "550e8400-e29b-41d4-a716-446655440001",
            "revokedAt": "2026-02-13T16:20:00.000Z",
            "revokedBy": "550e8400-e29b-41d4-a716-446655440001",
            "email": "former.admin@example.com",
            "firstName": "Former",
            "lastName": "Admin",
            "isActive": false
        }
    ]
}
```

**Error Responses:**

**401 Unauthorized:**
```json
{
    "error": "Authentication required"
}
```

**403 Forbidden:**
```json
{
    "error": "Admin access required"
}
```

**500 Internal Server Error:**
```json
{
    "error": "Failed to list admins"
}
```

**Usage Notes:**
- Returns both active and revoked admins for audit purposes
- Includes user information joined from the `users` table
- Use `revokedAt` field to determine if admin is currently active
- `grantedBy` and `revokedBy` reference the userId of the admin who performed the action

---

### Create New Admin

**Endpoint:** `POST /api/system/admins`
**Authentication:** Required (admin access)
**Description:** Grant admin privileges to an existing user

**Request Body:**
```json
{
    "userId": "550e8400-e29b-41d4-a716-446655440010"
}
```

**Field Validations:**
- `userId`: Required, must be a valid UUID, must reference existing user

**Response (201 Created):**
```json
{
    "message": "Admin created successfully",
    "admin": {
        "id": "550e8400-e29b-41d4-a716-446655440020",
        "userId": "550e8400-e29b-41d4-a716-446655440010",
        "role": "admin",
        "grantedAt": "2026-02-13T15:00:00.000Z",
        "grantedBy": "550e8400-e29b-41d4-a716-446655440001"
    }
}
```

**Error Responses:**

**400 Bad Request - Missing userId:**
```json
{
    "error": "userId is required"
}
```

**401 Unauthorized:**
```json
{
    "error": "Authentication required"
}
```

**403 Forbidden:**
```json
{
    "error": "Admin access required"
}
```

**404 Not Found:**
```json
{
    "error": "User not found"
}
```

**409 Conflict:**
```json
{
    "error": "User is already an admin"
}
```

**500 Internal Server Error:**
```json
{
    "error": "Failed to create admin"
}
```

**Usage Notes:**
- User must already exist in the `users` table
- If user was previously an admin and was revoked, this creates a new admin record (doesn't un-revoke)
- The `grantedBy` field is automatically set to the current admin's userId
- Consider notifying the user via email when they're granted admin access

**Best Practices:**
- Verify the target user's identity before granting admin access
- Maintain at least 2 active admins to prevent lockout
- Document why admin access was granted (in your own audit system)
- Use principle of least privilege - only grant admin when necessary

---

### Revoke Admin Access

**Endpoint:** `DELETE /api/system/admins/:userId`
**Authentication:** Required (admin access)
**Description:** Revoke admin privileges from a user (soft delete)

**URL Parameters:**
- `userId`: UUID of the user whose admin access should be revoked

**Response (200 OK):**
```json
{
    "message": "Admin revoked successfully",
    "admin": {
        "id": "550e8400-e29b-41d4-a716-446655440020",
        "userId": "550e8400-e29b-41d4-a716-446655440010",
        "role": "admin",
        "grantedAt": "2026-02-13T15:00:00.000Z",
        "grantedBy": "550e8400-e29b-41d4-a716-446655440001",
        "revokedAt": "2026-02-13T18:30:00.000Z",
        "revokedBy": "550e8400-e29b-41d4-a716-446655440001"
    }
}
```

**Error Responses:**

**400 Bad Request - Cannot Revoke Self:**
```json
{
    "error": "Cannot revoke your own admin access"
}
```

**400 Bad Request - Last Admin:**
```json
{
    "error": "Cannot revoke the last admin account"
}
```

**401 Unauthorized:**
```json
{
    "error": "Authentication required"
}
```

**403 Forbidden:**
```json
{
    "error": "Admin access required"
}
```

**404 Not Found:**
```json
{
    "error": "Admin record not found or already revoked"
}
```

**500 Internal Server Error:**
```json
{
    "error": "Failed to revoke admin"
}
```

**Usage Notes:**
- This is a soft delete - sets `revokedAt` and `revokedBy` timestamps
- Admin record remains in database for audit trail
- Admins cannot revoke their own access (prevents lockout)
- Cannot revoke the last admin (prevents total lockout)
- The `revokedBy` field is automatically set to the current admin's userId
- User immediately loses admin access after revocation
- User's regular account and troop memberships are unaffected

**Safety Mechanisms:**
1. **Self-Revocation Prevention**: Admins cannot remove their own admin access
2. **Last Admin Protection**: System requires at least one active admin at all times
3. **Audit Trail**: All revocations are permanently recorded with timestamp and revoking admin

**Best Practices:**
- Always maintain at least 2-3 active admins
- Document the reason for revocation in your own audit system
- Consider notifying the user when admin access is revoked
- Review admin list regularly and revoke unnecessary access

---

## Admin Privilege System

### Admin Role Definition

Admins automatically receive all 33 system privileges at Troop (T) scope. The admin role is defined in `/data/ASM/privileges.js`:

```javascript
admin: {
    // All privileges at 'T' (troop-wide) scope
    view_roster: 'T',
    manage_members: 'T',
    manage_troop_settings: 'T',
    send_invitations: 'T',
    import_roster: 'T',
    manage_member_roles: 'T',
    manage_privileges: 'T',
    view_scout_profiles: 'T',
    edit_scout_level: 'T',
    edit_scout_status: 'T',
    award_badges: 'T',
    view_badge_progress: 'T',
    edit_personal_info: 'T',
    view_events: 'T',
    manage_events: 'T',
    export_calendar: 'T',
    view_sales: 'T',
    record_sales: 'T',
    manage_fundraisers: 'T',
    view_troop_sales: 'T',
    view_financials: 'T',
    manage_financials: 'T',
    view_donations: 'T',
    record_donations: 'T',
    delete_donations: 'T',
    view_goals: 'T',
    manage_goals: 'T',
    view_leaderboard: 'T',
    manage_payment_methods: 'T',
    import_data: 'T',
    export_data: 'T',
    delete_own_data: 'T'
}
```

**Key Characteristics:**
- **System-Level Role**: Admin is not a troop role - it exists outside troop membership
- **Full Privilege Access**: All 33 privileges granted at Troop scope
- **Cross-Troop Access**: Admins can operate across all troops in the system
- **Separate from Troop Roles**: A user can be an admin AND have troop memberships with different roles

### Admin vs Council Admin

**Admin (New System-Level Role):**
- Stored in `admins` table
- Managed via admin panel and API endpoints
- Bootstrap flow for initial setup
- Auditable grant/revoke system
- Separate from troop membership

**Council Admin (Legacy - To Be Removed in Phase 6):**
- Stored as `users.role = 'council_admin'`
- Hardcoded in seed data
- No audit trail
- Will be completely removed once admin panel is fully implemented

---

## Security Considerations

### Bootstrap Security

1. **One-Time Setup**: Bootstrap endpoint only works when no admins exist
2. **No Authentication**: Bootstrap is intentionally unauthenticated for initial setup
3. **Production Hardening**: Consider these additional protections in production:
   - Restrict bootstrap endpoint by IP address
   - Require a one-time setup token from environment variable
   - Disable bootstrap endpoint after first use
   - Use HTTPS to protect credentials

### Admin Access Control

1. **Session-Based**: Admin access tied to active session (7-day TTL)
2. **No Token Bypass**: Cannot use API tokens to gain admin access
3. **Immediate Revocation**: Revoked admins lose access immediately
4. **Audit Trail**: All admin actions logged with timestamp and user ID

### Lockout Prevention

1. **Cannot Revoke Self**: Admins cannot remove their own admin access
2. **Last Admin Protection**: Cannot revoke the last remaining admin
3. **Bootstrap Recovery**: If all admins are accidentally removed, bootstrap endpoint reactivates

### Best Practices

1. **Multiple Admins**: Always maintain 2-3 active admin accounts
2. **Regular Review**: Periodically review admin list and revoke unnecessary access
3. **Strong Passwords**: Enforce strong password requirements for admin accounts
4. **HTTPS Only**: Always use HTTPS in production
5. **Principle of Least Privilege**: Only grant admin access when absolutely necessary
6. **Audit Logging**: Monitor admin actions through audit logs

---

## Common Workflows

### Initial System Setup

1. Deploy application with empty database
2. Run migrations (creates `admins` table)
3. Access application and create first user account
4. Call `GET /api/system/bootstrap-status` to verify bootstrap needed
5. Call `POST /api/system/bootstrap` with admin credentials
6. Log in with admin account
7. Create 1-2 additional admin accounts for redundancy

### Adding a New Admin

1. Create user account (if doesn't exist)
2. Get user's UUID from `users` table or user management UI
3. Call `POST /api/system/admins` with `{ userId: "..." }`
4. Verify admin was created with `GET /api/system/admins`
5. Notify user of admin access grant

### Removing an Admin

1. Call `GET /api/system/admins` to list current admins
2. Verify there are at least 2 active admins
3. Call `DELETE /api/system/admins/:userId` to revoke access
4. Verify revocation with `GET /api/system/admins`
5. Notify user of admin access revocation

### Recovering from Lost Admin Access

If all admins are accidentally removed or locked out:

1. Manually delete all records from `admins` table:
   ```sql
   DELETE FROM admins;
   ```
2. Bootstrap endpoint will reactivate automatically
3. Call `POST /api/system/bootstrap` to create new admin
4. Log in and recreate admin accounts

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

**Column Details:**
- `id`: Primary key for admin record
- `userId`: Foreign key to `users.id` (the admin user)
- `role`: Admin role type (currently only 'admin', 'super_admin' reserved for future)
- `grantedAt`: Timestamp when admin access was granted
- `grantedBy`: userId of admin who granted access (NULL for bootstrap admin)
- `revokedAt`: Timestamp when admin access was revoked (NULL if active)
- `revokedBy`: userId of admin who revoked access (NULL if active)

**Indexes:**
- `idx_admins_user_id`: Fast lookup by userId
- `idx_admins_active`: Fast filtering of active (non-revoked) admins

**Constraints:**
- `userId` is UNIQUE (one admin record per user)
- CASCADE delete when user is deleted
- SET NULL when granting/revoking admin is deleted

---

## Testing

### Manual Testing with cURL

**Check Bootstrap Status:**
```bash
curl http://localhost:5252/api/system/bootstrap-status
```

**Bootstrap First Admin:**
```bash
curl -X POST http://localhost:5252/api/system/bootstrap \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "AdminPass123!",
    "firstName": "System",
    "lastName": "Admin"
  }'
```

**List Admins (requires login):**
```bash
curl http://localhost:5252/api/system/admins \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE"
```

**Create New Admin (requires login):**
```bash
curl -X POST http://localhost:5252/api/system/admins \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
  -d '{
    "userId": "550e8400-e29b-41d4-a716-446655440010"
  }'
```

**Revoke Admin (requires login):**
```bash
curl -X DELETE http://localhost:5252/api/system/admins/550e8400-e29b-41d4-a716-446655440010 \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE"
```

### Integration Testing

See `/data/ASM/tests/admin-endpoints.test.js` for automated test suite (when implemented).

**Test Coverage:**
- Bootstrap with no admins
- Bootstrap when admins exist (should fail)
- Create admin with valid userId
- Create admin with invalid userId
- List all admins
- Revoke admin
- Prevent self-revocation
- Prevent last admin revocation
- Verify access control (non-admin cannot access)

---

## Troubleshooting

### Bootstrap Endpoint Returns 400

**Problem:** Bootstrap endpoint returns "System has already been bootstrapped"

**Solution:**
- Check admin count: `SELECT COUNT(*) FROM admins WHERE "revokedAt" IS NULL`
- If admins exist but you need to re-bootstrap, manually delete admin records
- Verify no zombie admin records exist

### Cannot Access Admin Endpoints

**Problem:** Receiving 403 Forbidden on admin endpoints

**Solution:**
- Verify you're logged in: Check session cookie exists
- Verify admin record: `SELECT * FROM admins WHERE "userId" = 'YOUR_USER_ID' AND "revokedAt" IS NULL`
- Check session is valid: `SELECT * FROM sessions WHERE "userId" = 'YOUR_USER_ID' AND "expiresAt" > NOW()`
- Verify middleware is working: Check server logs for admin check queries

### All Admins Were Revoked

**Problem:** No active admins remain in the system

**Solution:**
- Delete all admin records: `DELETE FROM admins`
- Bootstrap endpoint will reactivate automatically
- Call `POST /api/system/bootstrap` to create new first admin

### Admin Privileges Not Working

**Problem:** Admin user cannot access troop-level features

**Solution:**
- Verify admin role is in `ROLE_PRIVILEGE_DEFAULTS` in `/data/ASM/privileges.js`
- Check that privilege middleware references admin role correctly
- Ensure admin privileges are all set to 'T' scope
- Admin must still be a member of a troop to access troop-specific features (in current implementation)

---

## Admin Panel UI Integration (Phase 2)

### Frontend Files

**Admin Panel Interface:**
- `/public/admin.html` - Admin panel HTML template with 6 tabs
- `/public/admin.js` - Frontend logic (navigation, API calls, UI updates)
- `/public/styles.css` - Shared styles (admin panel uses existing styles)

**Routes:**
- `GET /admin` - Redirects to `/admin.html` (requires authentication + admin access)
- `GET /admin.html` - Serves admin panel (checks admin privileges, redirects non-admins)

**Frontend Features:**
- Tab-based navigation (Dashboard, Admins, Organizations, Troops, Members, Audit Log)
- Real-time statistics display
- Admin CRUD operations (create/revoke admins)
- Search/filter functionality (troops, members, audit log)
- Mobile responsive design
- Client-side session validation

**See Documentation:**
- [Admin Panel User Guide](/docs/Getting%20Started/ADMIN_PANEL_USER_GUIDE.md)
- [Admin Dashboard Guide](/docs/Getting%20Started/ADMIN_DASHBOARD.md)
- [Admin CRUD Guide](/docs/Getting%20Started/ADMIN_CRUD_GUIDE.md)
- [Admin System Architecture](/docs/Architecture/ADMIN_SYSTEM_ARCHITECTURE.md)

---

## Future Enhancements

### Phase 4: Full CRUD Operations
- Create/edit/delete organizations
- Create/edit/delete troops
- Create/edit/delete members
- Bulk import/export (CSV, JSON)
- Advanced filtering and sorting

### Phase 5: Advanced Admin Features
- Super Admin role with additional privileges
- Admin activity logging and enhanced audit trail
- Session management (view/revoke active sessions)
- IP-based access restrictions
- Two-factor authentication for admins
- Real-time updates via WebSocket
- Performance monitoring dashboard

### Phase 6: Remove Legacy Council Admin
- Remove `council_admin` role from `users.role`
- Remove hardcoded superuser bypass (welefort@gmail.com)
- Fully migrate to new admin system
- Clean up seed data and documentation

---

## Related Documentation

- [Admin Panel User Guide](/docs/Getting%20Started/ADMIN_PANEL_USER_GUIDE.md) - Complete user guide for admin panel
- [Admin Dashboard Guide](/docs/Getting%20Started/ADMIN_DASHBOARD.md) - Dashboard features and monitoring
- [Admin CRUD Guide](/docs/Getting%20Started/ADMIN_CRUD_GUIDE.md) - Step-by-step CRUD operations
- [Admin System Architecture](/docs/Architecture/ADMIN_SYSTEM_ARCHITECTURE.md) - Technical architecture and design patterns
- [Database Schema](/docs/Architecture/DATABASE_SCHEMA.md) - Complete database schema including admins table
- [Account Access Schema](/docs/Architecture/Account%20Access%20Schema.md) - Role and privilege system documentation
- [Bootstrap Setup Guide](/docs/Getting%20Started/BOOTSTRAP_SETUP.md) - Step-by-step initial setup instructions
- [Admin Panel Plan](/docs/Roadmap/ADMIN_PANEL_PLAN.md) - Full implementation plan with all phases
- [Migration 007](/migrations/007_create_admins_table.sql) - Database migration creating admins table

---

**Last Updated:** February 13, 2026
**Phase:** Phase 2 Complete (API + UI)
**Status:** Production Ready (Read Operations + Admin Management)
