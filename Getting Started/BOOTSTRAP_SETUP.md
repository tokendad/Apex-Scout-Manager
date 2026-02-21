# Bootstrap Setup Guide - First Admin Account

**Last Updated:** February 13, 2026
**Status:** Phase 1 Complete
**Prerequisites:** Database migrated with migration 007 (admins table created)

---

## Overview

The Bootstrap process creates the first system administrator account in Apex Scout Manager. This is a one-time setup procedure that runs when the system has no existing admin accounts.

**Key Concepts:**
- Bootstrap is **only available when zero admins exist** in the system
- No authentication required for bootstrap (intentionally - this is initial setup)
- After bootstrap, additional admins must be created via the admin API
- Bootstrap admin has `grantedBy: NULL` since no admin existed to grant it

**Security Note:** In production, consider additional protections like IP restrictions or one-time setup tokens.

---

## Quick Start

### Step 1: Check Bootstrap Status

Before attempting bootstrap, verify the system needs it:

**Request:**
```bash
curl http://localhost:5252/api/system/bootstrap-status
```

**Response (Needs Bootstrap):**
```json
{
    "needsBootstrap": true,
    "adminCount": 0
}
```

**Response (Already Bootstrapped):**
```json
{
    "needsBootstrap": false,
    "adminCount": 2
}
```

### Step 2: Create First Admin

If bootstrap is needed, create the first admin account:

**Request:**
```bash
curl -X POST http://localhost:5252/api/system/bootstrap \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "SecureAdminPass123!",
    "firstName": "System",
    "lastName": "Administrator"
  }'
```

**Response (Success):**
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

### Step 3: Log In

Use the bootstrap credentials to log in:

**Request:**
```bash
curl -X POST http://localhost:5252/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "SecureAdminPass123!"
  }'
```

**Response:**
```json
{
    "message": "Login successful",
    "user": {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "email": "admin@example.com",
        "firstName": "System",
        "lastName": "Administrator",
        "role": "scout"
    }
}
```

**Note:** The session cookie is automatically set and used for subsequent authenticated requests.

### Step 4: Create Additional Admins

**Best Practice:** Create 2-3 admin accounts for redundancy.

**Request:**
```bash
curl -X POST http://localhost:5252/api/system/admins \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
  -d '{
    "userId": "ANOTHER_USER_UUID"
  }'
```

See [Admin Endpoints Documentation](/docs/API/ADMIN_ENDPOINTS.md) for complete admin management API reference.

---

## Detailed Bootstrap Process

### Prerequisites

Before running bootstrap, ensure:

1. **Database Migrations Complete**: Migration 007 must be applied
   ```bash
   docker exec asm-dev psql -U postgres -d asm -c "SELECT * FROM admins LIMIT 1;"
   ```
   If table doesn't exist, run migrations.

2. **Server Running**: Application must be accessible
   ```bash
   curl http://localhost:5252/health
   ```

3. **No Existing Admins**: Verify no admins exist
   ```bash
   curl http://localhost:5252/api/system/bootstrap-status
   ```

### Bootstrap Request Fields

| Field | Type | Required | Validation |
| :--- | :--- | :---: | :--- |
| `email` | string | ✅ | Valid email format, must not already exist |
| `password` | string | ✅ | Min 8 chars, must contain uppercase, lowercase, and number |
| `firstName` | string | ✅ | 1-100 characters |
| `lastName` | string | ✅ | 1-100 characters |

**Password Requirements:**
- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)
- Recommended: Include special characters (!@#$%^&*)

**Example Strong Passwords:**
- `AdminSecure2026!`
- `MyTroop#Admin99`
- `Bootstrap$Pass123`

### Bootstrap Response

On success, bootstrap returns:

```json
{
    "message": "Bootstrap successful",
    "admin": {
        "id": "<admin_record_uuid>",
        "userId": "<user_uuid>",
        "role": "admin",
        "grantedAt": "<timestamp>",
        "grantedBy": null
    },
    "user": {
        "id": "<user_uuid>",
        "email": "<email>",
        "firstName": "<firstName>",
        "lastName": "<lastName>"
    }
}
```

**Key Fields:**
- `admin.id`: Primary key of admin record
- `admin.userId`: Links to users table
- `admin.grantedBy`: NULL for bootstrap admin
- `user`: Complete user record

### What Bootstrap Does

Behind the scenes, the bootstrap endpoint:

1. **Checks Admin Count**: Queries `admins` table to verify zero active admins exist
   ```sql
   SELECT COUNT(*)::int as count FROM admins WHERE "revokedAt" IS NULL
   ```

2. **Validates Input**: Ensures all required fields present and valid

3. **Checks Email Uniqueness**: Verifies email doesn't already exist
   ```sql
   SELECT * FROM users WHERE email = $1
   ```

4. **Creates User Account**: Inserts new user with hashed password
   ```sql
   INSERT INTO users (id, email, password_hash, firstName, lastName, role, isActive, emailVerified, createdAt)
   VALUES (uuid_v4(), $1, $2, $3, $4, 'scout', true, true, NOW())
   ```

5. **Creates Admin Record**: Links user to admin role
   ```sql
   INSERT INTO admins (id, userId, role, grantedAt, grantedBy)
   VALUES (uuid_v4(), $1, 'admin', NOW(), NULL)
   ```

6. **Returns Success**: Provides admin and user details for verification

---

## Common Bootstrap Scenarios

### Scenario 1: Fresh Installation

**Situation:** Brand new deployment with empty database

**Steps:**
1. Deploy application
2. Run database migrations
3. Access application URL
4. Call bootstrap endpoint to create first admin
5. Log in with admin credentials
6. Create additional admin accounts
7. Begin configuring organizations and troops

**Time Required:** 5-10 minutes

---

### Scenario 2: Development Environment Reset

**Situation:** Need to reset development database and start fresh

**Steps:**
1. Drop and recreate database:
   ```bash
   docker exec -it asm-dev psql -U postgres -d asm -c "DROP DATABASE IF EXISTS asm; CREATE DATABASE asm;"
   ```

2. Run migrations:
   ```bash
   docker exec asm-dev npm run migrate
   ```

3. Bootstrap new admin:
   ```bash
   curl -X POST http://localhost:5252/api/system/bootstrap \
     -H "Content-Type: application/json" \
     -d '{
       "email": "dev.admin@test.local",
       "password": "DevAdmin123!",
       "firstName": "Dev",
       "lastName": "Admin"
     }'
   ```

4. Optionally seed test data:
   ```bash
   docker exec asm-dev node migrations/seed-test-users.js
   ```

**Time Required:** 5 minutes

---

### Scenario 3: Disaster Recovery

**Situation:** All admin accounts deleted or lost

**Steps:**
1. Verify no admins exist:
   ```bash
   curl http://localhost:5252/api/system/bootstrap-status
   ```

2. If admins still exist but locked out, manually delete from database:
   ```bash
   docker exec -it asm-dev psql -U postgres -d asm -c "DELETE FROM admins;"
   ```

3. Run bootstrap to create new admin:
   ```bash
   curl -X POST http://localhost:5252/api/system/bootstrap \
     -H "Content-Type: application/json" \
     -d '{
       "email": "recovery.admin@example.com",
       "password": "RecoveryPass123!",
       "firstName": "Recovery",
       "lastName": "Admin"
     }'
   ```

4. Log in and recreate additional admin accounts

5. Review audit logs to understand how admins were lost

**Time Required:** 10-15 minutes

---

## Troubleshooting

### Error: "System has already been bootstrapped"

**Cause:** One or more admins already exist in the system

**Solution:**
1. Check current admin count:
   ```bash
   curl http://localhost:5252/api/system/bootstrap-status
   ```

2. List existing admins (requires admin login):
   ```bash
   curl http://localhost:5252/api/system/admins \
     -H "Cookie: connect.sid=YOUR_SESSION_COOKIE"
   ```

3. If you need to re-bootstrap:
   ```bash
   docker exec -it asm-dev psql -U postgres -d asm -c "DELETE FROM admins;"
   ```

**Warning:** Deleting all admins will require re-bootstrap. Only do this in development or as last resort.

---

### Error: "User with this email already exists"

**Cause:** A user account with the bootstrap email already exists

**Solution Option 1:** Use a different email for bootstrap
```bash
curl -X POST http://localhost:5252/api/system/bootstrap \
  -H "Content-Type: application/json" \
  -d '{
    "email": "different.admin@example.com",
    "password": "SecurePass123!",
    "firstName": "Admin",
    "lastName": "User"
  }'
```

**Solution Option 2:** Make existing user an admin (if you can log in as an existing admin)
```bash
# First, get the userId of the existing user
curl http://localhost:5252/api/users?email=existing@example.com \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE"

# Then grant admin access
curl -X POST http://localhost:5252/api/system/admins \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
  -d '{"userId": "EXISTING_USER_UUID"}'
```

**Solution Option 3:** Delete existing user and re-bootstrap (development only)
```bash
docker exec -it asm-dev psql -U postgres -d asm \
  -c "DELETE FROM users WHERE email = 'existing@example.com';"
```

---

### Error: "Password validation failed"

**Cause:** Password doesn't meet security requirements

**Requirements:**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

**Examples of Valid Passwords:**
- `AdminPass123`
- `SecureAdmin99`
- `Bootstrap2026!`

**Examples of Invalid Passwords:**
- `admin` (too short, no uppercase, no numbers)
- `adminpassword` (no uppercase, no numbers)
- `ADMINPASS` (no lowercase, no numbers)
- `Admin123` (too short - less than 8 characters)

---

### Error: Connection Refused

**Cause:** Application server not running

**Solution:**
1. Check if server is running:
   ```bash
   docker ps | grep asm-dev
   ```

2. If not running, start it:
   ```bash
   docker compose up -d
   ```

3. Check server logs:
   ```bash
   docker compose logs -f asm-dev
   ```

4. Wait for "Server listening on port 3000" message

5. Retry bootstrap

---

### Error: Database Connection Failed

**Cause:** PostgreSQL database not accessible

**Solution:**
1. Check if PostgreSQL is running:
   ```bash
   docker ps | grep postgres
   ```

2. Test database connection:
   ```bash
   docker exec -it asm-dev psql -U postgres -d asm -c "SELECT 1;"
   ```

3. If connection fails, check environment variables:
   ```bash
   docker exec asm-dev printenv | grep DB
   ```

4. Verify PostgreSQL service is healthy:
   ```bash
   docker compose ps postgres
   ```

5. Check PostgreSQL logs:
   ```bash
   docker compose logs postgres
   ```

---

## Security Best Practices

### Development Environment

1. **Use Test Credentials**: Don't use real emails or passwords
   ```json
   {
       "email": "dev.admin@test.local",
       "password": "DevAdmin123!"
   }
   ```

2. **Document Test Accounts**: Keep credentials in TEST_ACCOUNTS.md

3. **Rotate Regularly**: Change test passwords periodically

4. **Don't Commit Credentials**: Never commit passwords to git

### Production Environment

1. **Strong Passwords**: Use 16+ character passwords with mixed case, numbers, and symbols
   ```
   Example: Tr00p#Leader$2026!SecureAdmin
   ```

2. **Unique Emails**: Use dedicated email addresses for admin accounts
   ```
   Good: admin@yourdomain.com
   Bad: personal.email@gmail.com
   ```

3. **Secure Transmission**: Always use HTTPS in production
   ```
   https://yourdomain.com/api/system/bootstrap
   ```

4. **IP Restrictions**: Consider restricting bootstrap endpoint to specific IPs

5. **One-Time Token**: Add environment variable requirement for bootstrap:
   ```javascript
   if (process.env.BOOTSTRAP_TOKEN !== req.headers['x-bootstrap-token']) {
       return res.status(403).json({ error: 'Invalid bootstrap token' });
   }
   ```

6. **Disable After Use**: Consider disabling bootstrap endpoint after first use

7. **Audit Logging**: Monitor and log all bootstrap attempts

8. **Multi-Factor Auth**: Implement 2FA for admin accounts (Phase 5)

---

## Post-Bootstrap Checklist

After successfully bootstrapping your first admin:

- [ ] Log in with admin credentials to verify access
- [ ] Create at least 1-2 additional admin accounts for redundancy
- [ ] Document admin credentials securely (use password manager)
- [ ] Test admin endpoints (list admins, create admin, revoke admin)
- [ ] Configure organizations and troops
- [ ] Create troop leader accounts
- [ ] Test privilege system
- [ ] Review audit logs
- [ ] Set up backup procedures
- [ ] Plan for Phase 2 (Admin Panel UI)

---

## Next Steps

After bootstrap is complete:

1. **Configure Organizations**: Set up Girl Scouts, Cub Scouts, Scouts BSA
   - See [Organization Management Guide](/docs/Features/ORGANIZATIONS.md) (Phase 4)

2. **Create Troops**: Add troops for each organization
   - See [Troop Management Guide](/docs/Features/TROOPS.md) (Phase 4)

3. **Add Users**: Create troop leader, parent, and scout accounts
   - See [User Management Guide](/docs/Features/USERS.md) (Phase 4)

4. **Assign Privileges**: Configure role-based access control
   - See [Account Access Schema](/docs/Architecture/Account%20Access%20Schema.md)

5. **Test System**: Verify all roles work correctly
   - See [Test Accounts](/docs/Getting%20Started/TEST_ACCOUNTS.md)

6. **Plan Admin UI**: Prepare for Phase 2 implementation
   - See [Admin Panel Plan](/docs/Roadmap/ADMIN_PANEL_PLAN.md)

---

## Related Documentation

- [Admin Endpoints API](/docs/API/ADMIN_ENDPOINTS.md) - Complete API reference for admin management
- [Database Schema](/docs/Architecture/DATABASE_SCHEMA.md) - Database structure including admins table
- [Account Access Schema](/docs/Architecture/Account%20Access%20Schema.md) - Role and privilege system
- [Admin Panel Plan](/docs/Roadmap/ADMIN_PANEL_PLAN.md) - Full implementation roadmap
- [Test Accounts](/docs/Getting%20Started/TEST_ACCOUNTS.md) - Development test credentials

---

## FAQ

**Q: Can I have multiple admins?**
A: Yes! You should create 2-3 admin accounts for redundancy. Use `POST /api/system/admins` after bootstrap.

**Q: What if I forget the admin password?**
A: Use the database to reset it or create a new admin account. If all admins are lost, delete admin records and re-bootstrap.

**Q: Can I revoke the bootstrap admin?**
A: Yes, but only after creating at least one other admin. The system prevents revoking the last admin.

**Q: Is bootstrap secure?**
A: It's intentionally unauthenticated for initial setup. In production, add IP restrictions or one-time tokens.

**Q: Can I bootstrap multiple times?**
A: No, bootstrap only works when zero admins exist. Delete all admins to re-enable bootstrap.

**Q: What's the difference between admin and council_admin?**
A: `admin` is the new system-level role (Phase 1). `council_admin` is legacy and will be removed in Phase 6.

**Q: Do admins need to be troop members?**
A: No, admin is system-level. However, admins may also have troop memberships with different roles.

**Q: How do I add admin UI access?**
A: Admin UI (`/admin` route) will be implemented in Phase 2. Phase 1 is API-only.

---

**Last Updated:** February 13, 2026
**Phase:** Phase 1 Complete
**Status:** Production Ready (API Only)
