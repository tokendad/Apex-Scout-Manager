# Apex Scout Manager - Test Account Credentials

**Date Created:** 2026-02-10
**Last Updated:** 2026-02-13
**Status:** Active in Development Environment
**Server:** http://localhost:5252

---

## System Administrator Account (Phase 1)

**Role:** `admin` (System-level administrator with full access)

```
Email: admin@test.local
Password: AdminTest123!
```

### Admin Features Available
- ✅ System-level admin access (via `admins` table)
- ✅ Create/revoke other admin accounts
- ✅ Access to all organizations, troops, and members
- ✅ Award badges to any scout
- ✅ Full system configuration access
- ✅ Admin API endpoints (Phase 1 complete)
- ✅ Admin UI Panel (Phase 2 complete - `/admin` route)

### How to Access Admin Panel
1. Log in as admin user (`admin@test.local`)
2. Navigate to `http://localhost:5252/admin`
3. Admin panel loads with 6 tabs:
   - Dashboard (system statistics)
   - Admins (create/revoke admins)
   - Organizations (view organizations)
   - Troops (view/search troops)
   - Members (view/search members)
   - Audit Log (view system activity)

**How to Create:**
```bash
# Bootstrap the first admin (only works if no admins exist)
curl -X POST http://localhost:5252/api/system/bootstrap \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.local",
    "password": "AdminTest123!",
    "firstName": "System",
    "lastName": "Admin"
  }'
```

See [Bootstrap Setup Guide](/docs/Getting%20Started/BOOTSTRAP_SETUP.md) for detailed instructions.

---

## Legacy Superuser Account (DEPRECATED - Phase 6 Removal)

**Role:** `council_admin` (Legacy role - hardcoded bypass)

```
Email: welefort@gmail.com
Password: Admin123!
```

**Status:** Will be removed in Phase 6 after admin panel UI is complete

### Features Available
- ✅ Hardcoded superuser bypass (skips privilege checks)
- ✅ Access to all organizations
- ✅ View all scouts, parents, and leaders
- ✅ Award badges to any scout
- ✅ Create and manage troops

**Note:** This account uses the legacy `isSuperUser()` bypass and will be removed in Phase 6.

---

## Girl Scouts USA Test Accounts

### Scout Account
```
Email: scout.gsusa@test.local
Password: TestPass123!
Role: scout
Organization: Girl Scouts USA (gsusa)
```

### Parent Account
```
Email: parent.gsusa@test.local
Password: TestPass123!
Role: parent
Organization: Girl Scouts USA (gsusa)
```

### Troop Leader Account
```
Email: leader.gsusa@test.local
Password: TestPass123!
Role: troop_leader
Organization: Girl Scouts USA (gsusa)
```

---

## Scouts BSA Test Accounts

### Scout Account
```
Email: scout.sa_bsa@test.local
Password: TestPass123!
Role: scout
Organization: Scouting America - Scouts BSA (sa_bsa)
```

### Parent Account
```
Email: parent.sa_bsa@test.local
Password: TestPass123!
Role: parent
Organization: Scouting America - Scouts BSA (sa_bsa)
```

### Troop Leader Account
```
Email: leader.sa_bsa@test.local
Password: TestPass123!
Role: troop_leader
Organization: Scouting America - Scouts BSA (sa_bsa)
```

---

## Cub Scouts Test Accounts

### Scout Account
```
Email: scout.sa_cub@test.local
Password: TestPass123!
Role: scout
Organization: Scouting America - Cub Scouts (sa_cub)
```

### Parent Account
```
Email: parent.sa_cub@test.local
Password: TestPass123!
Role: parent
Organization: Scouting America - Cub Scouts (sa_cub)
```

### Troop Leader Account
```
Email: leader.sa_cub@test.local
Password: TestPass123!
Role: troop_leader
Organization: Scouting America - Cub Scouts (sa_cub)
```

---

## Quick Test Workflows

### Test Scout Experience
1. Log in as `scout.gsusa@test.local`
2. Navigate to Profile → View badge gallery
3. Check earned badges (initially empty)
4. View available badges for current level

### Test Parent Experience
1. Log in as `parent.gsusa@test.local`
2. View troop roster
3. Check notifications
4. View family scouts

### Test Troop Leader Experience
1. Log in as `leader.gsusa@test.local`
2. Navigate to Troop view
3. Award badge to scout
4. View recent badge awards
5. Manage troop members

### Test Admin Experience (New Admin System - Phase 2 Complete)
1. Bootstrap admin account (if not already done)
2. Log in as `admin@test.local`
3. Navigate to `/admin` to access admin panel
4. Test admin UI features:
   - View Dashboard (statistics and system status)
   - Create/revoke admin accounts in Admins tab
   - View organizations in Organizations tab
   - Search troops in Troops tab
   - Search members in Members tab
   - View audit log in Audit Log tab
5. Test admin API endpoints (via API or UI):
   - GET /api/system/admins (list all admins)
   - POST /api/system/admins (create new admin)
   - DELETE /api/system/admins/:userId (revoke admin)
6. Access all organizations and troops
7. Award badges across all scouts (via main app)

### Test Legacy Admin Experience (DEPRECATED)
1. Log in as `welefort@gmail.com`
2. Access all organizations
3. View all troops and scouts
4. Note: Will be removed in Phase 6

---

## Account Status

| Email | Role | Organization | Created | Active | Notes |
|-------|------|--------------|---------|--------|-------|
| admin@test.local | admin | All | Bootstrap | ✅ | New admin system (Phase 1) |
| welefort@gmail.com | council_admin | All | 2026-02-10 | ✅ | Legacy - Will be removed Phase 6 |
| scout.gsusa@test.local | scout | Girl Scouts | 2026-02-10 | ✅ |
| parent.gsusa@test.local | parent | Girl Scouts | 2026-02-10 | ✅ |
| leader.gsusa@test.local | troop_leader | Girl Scouts | 2026-02-10 | ✅ |
| scout.sa_bsa@test.local | scout | Scouts BSA | 2026-02-10 | ✅ |
| parent.sa_bsa@test.local | parent | Scouts BSA | 2026-02-10 | ✅ |
| leader.sa_bsa@test.local | troop_leader | Scouts BSA | 2026-02-10 | ✅ |
| scout.sa_cub@test.local | scout | Cub Scouts | 2026-02-10 | ✅ |
| parent.sa_cub@test.local | parent | Cub Scouts | 2026-02-10 | ✅ |
| leader.sa_cub@test.local | troop_leader | Cub Scouts | 2026-02-10 | ✅ |

---

## Seed Script Reference

**Location:** `/data/ASM/migrations/seed-test-users.js`

**Created by:** Claude Code (2026-02-10)

**Automatically Creates:**
- 1 superuser account (council_admin)
- 9 role-based test accounts across 3 organizations
- Test troops for each organization
- Proper role assignments and troop memberships
- Scout profile associations

**Run Command:**
```bash
docker exec asm-dev node migrations/seed-test-users.js
```

---

## Important Notes

- ⚠️ **Development Only:** These accounts are for testing purposes in development environments only
- 🔒 **Change Passwords:** In production, change all test passwords and use bootstrap flow
- 🗑️ **Clean Up:** Delete test accounts before deploying to production
- 📝 **Idempotent:** The seed script can be run multiple times safely
- ✅ **All Organizations:** Test accounts represent all supported scouting organizations
- 🎯 **Complete Coverage:** Includes all major user roles for comprehensive testing
- 🆕 **Bootstrap Required:** Use bootstrap endpoint to create first admin in fresh environments
- 🔐 **Admin System:** New admin role (Phase 1) replaces legacy council_admin (Phase 6)

---

## Features to Test with These Accounts

### Phase 3.1 - Scout Profile Management
- [x] Scout profile creation
- [x] Organization linking
- [x] Scout level assignment
- [x] Profile viewing

### Phase 3.2 - Badge Management
- [x] Badge catalog browsing
- [x] Available badges display
- [x] Badge detail viewing
- [x] Leader badge awarding
- [x] Badge tracking

### Role-Based Access
- [x] Scout view (limited to own data)
- [x] Parent view (limited to child scouts)
- [x] Leader view (troop data)
- [x] Admin view (all data via new admin system)
- [x] Legacy council_admin view (all data via hardcoded bypass)

### Admin System (Phases 1-2 Complete)
- [x] Bootstrap flow for first admin
- [x] Admin role with all privileges at T scope
- [x] Admin management API endpoints
- [x] Admin audit trail (grants/revocations)
- [x] Admin UI panel (Phase 2 - `/admin` route)
- [x] Dashboard with system statistics
- [x] Admin CRUD operations (create/revoke)
- [x] Search functionality (troops, members, audit log)
- [ ] Full CRUD for organizations, troops, members (Phase 4)

---

## Admin System Resources

- [Bootstrap Setup Guide](/docs/Getting%20Started/BOOTSTRAP_SETUP.md) - How to create first admin
- [Admin Endpoints API](/docs/API/ADMIN_ENDPOINTS.md) - Complete admin API reference
- [Admin Panel Plan](/docs/Roadmap/ADMIN_PANEL_PLAN.md) - Implementation roadmap
- [Account Access Schema](/docs/Architecture/Account%20Access%20Schema.md) - Admin role documentation

---

**Last Updated:** 2026-02-13
**Status:** Ready for Testing (Phases 1-2 Admin System Complete - UI + API)
