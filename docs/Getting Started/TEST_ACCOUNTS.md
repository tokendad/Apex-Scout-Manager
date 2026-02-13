# Apex Scout Manager - Test Account Credentials

**Date Created:** 2026-02-10
**Status:** Active in Development Environment
**Server:** http://localhost:5252

---

## Superuser / Council Admin Account

**Role:** `council_admin` (Full access to all data)

```
Email: welefort@gmail.com
Password: Admin123!
```

### Features Available
- ✅ Access to all organizations
- ✅ View all scouts, parents, and leaders
- ✅ Award badges to any scout
- ✅ Create and manage troops
- ✅ Administrative dashboard
- ✅ System settings and configuration

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

### Test Admin Experience
1. Log in as `welefort@gmail.com`
2. Access all organizations
3. View all troops and scouts
4. Create new accounts
5. Award badges across all scouts

---

## Account Status

| Email | Role | Organization | Created | Active |
|-------|------|--------------|---------|--------|
| welefort@gmail.com | council_admin | All | 2026-02-10 | ✅ |
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
- 🔒 **Change Passwords:** In production, change all test passwords
- 🗑️ **Clean Up:** Delete test accounts before deploying to production
- 📝 **Idempotent:** The seed script can be run multiple times safely
- ✅ **All Organizations:** Test accounts represent all supported scouting organizations
- 🎯 **Complete Coverage:** Includes all major user roles for comprehensive testing

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
- [x] Admin view (all data)

---

**Last Updated:** 2026-02-10
**Status:** Ready for Testing
