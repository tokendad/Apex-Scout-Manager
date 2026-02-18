# Admin CRUD Operations Guide

**Last Updated:** February 13, 2026
**Status:** Phase 2 Complete (Read/List Operations), Phase 4 Planned (Full CRUD)
**Related Documentation:**
- [Admin Panel User Guide](/docs/Getting%20Started/ADMIN_PANEL_USER_GUIDE.md)
- [Admin Endpoints API](/docs/API/ADMIN_ENDPOINTS.md)

---

## Overview

This guide provides step-by-step instructions for Create, Read, Update, and Delete (CRUD) operations in the Admin Panel.

**Current Status (Phase 2):**
- ✅ **Read Operations:** View admins, organizations, troops, members, audit log
- ✅ **Admin Management:** Create and revoke admins
- ✅ **Search/Filter:** Search troops, members, audit log
- ⏳ **Full CRUD:** Create/edit/delete organizations, troops, members (Phase 4)

---

## Admin Account Management

### Create New Admin

**Prerequisites:**
- You must be logged in as an admin
- User account must already exist in the system
- User must not already be an admin

**Steps:**

1. **Navigate to Admins Tab**
   - Click "Admins (👨‍💼)" in the sidebar
   - Wait for admin list to load

2. **Open Create Admin Form**
   - Click "+ Add New Admin" button (green)
   - Form appears below button

3. **Enter User Email**
   - Type user's email address in "User Email" field
   - Example: `newadmin@example.com`
   - Email must exactly match existing user account

4. **Submit Form**
   - Click "Create Admin" button
   - Or press Enter in email field

5. **Verify Success**
   - Green success message: "Admin account created successfully"
   - Form closes automatically
   - New admin appears in admin list
   - Check that "Granted" date is today
   - Check "Granted By" shows your user ID

**Common Errors:**

❌ **"User not found"**
- User doesn't exist in system
- Email address misspelled
- Solution: Create user account first, then grant admin

❌ **"User is already an admin"**
- User already has active admin privileges
- Check admin list to verify
- Solution: No action needed, user already has access

❌ **"Authentication required"**
- Session expired or not logged in
- Solution: Log out and log back in

❌ **"Admin access required"**
- Your account doesn't have admin privileges
- Solution: Ask another admin to grant you access

**Best Practices:**
- Verify user identity before granting admin access
- Document reason for admin grant (in your own notes)
- Notify user they've been granted admin access
- Create at least 2 admins for redundancy

---

### Revoke Admin Access

**Prerequisites:**
- You must be logged in as an admin
- Target admin must have active admin access
- Target admin cannot be yourself
- At least 2 admins must exist (cannot revoke last admin)

**Steps:**

1. **Navigate to Admins Tab**
   - Click "Admins (👨‍💼)" in sidebar
   - Wait for admin list to load

2. **Find Target Admin**
   - Locate admin in the table
   - Note their email and granted date
   - Verify they need revocation

3. **Click Revoke Button**
   - Click red "Revoke" button next to admin's name
   - Browser confirmation dialog appears

4. **Confirm Revocation**
   - Read confirmation message: "Are you sure you want to revoke admin access for [email]?"
   - Click "OK" to confirm
   - Or "Cancel" to abort

5. **Verify Success**
   - Green success message: "Admin access revoked successfully"
   - Admin list refreshes automatically
   - Revoked admin may still appear in list (with revoked status)
   - Check "Revoked At" date is today
   - Check "Revoked By" shows your user ID

**Safety Mechanisms:**

🛡️ **Cannot Revoke Self**
- You cannot revoke your own admin access
- Error: "Cannot revoke your own admin access"
- Prevents accidental self-lockout
- Ask another admin to revoke your access if needed

🛡️ **Cannot Revoke Last Admin**
- System requires at least 1 active admin
- Error: "Cannot revoke the last admin account"
- Prevents total system lockout
- Create new admin first, then revoke

**Common Errors:**

❌ **"Cannot revoke your own admin access"**
- You're trying to revoke yourself
- Solution: Ask another admin to revoke you

❌ **"Cannot revoke the last admin account"**
- This is the last active admin
- Solution: Create another admin first, then revoke this one

❌ **"Admin record not found or already revoked"**
- Admin was already revoked
- Or admin was deleted from database
- Solution: Check admin list, no action needed

**Best Practices:**
- Always maintain 2-3 active admins
- Document reason for revocation
- Notify user their admin access was revoked
- Review admin list weekly

---

## Organization Management

**Current Status:** Read-only (Phase 2)

**Available Operations:**
- ✅ View all organizations
- ✅ See organization details (code, name, type, level count)
- ⏳ Create organizations (Phase 4)
- ⏳ Edit organizations (Phase 4)
- ⏳ Delete organizations (Phase 4)

### View Organizations

**Steps:**

1. Navigate to Organizations tab
2. View complete list of scout organizations
3. Note organization codes:
   - `gsusa` - Girl Scouts USA
   - `sa_cub` - Scouting America - Cub Scouts
   - `sa_bsa` - Scouting America - Scouts BSA

**Information Displayed:**
- Code (short identifier)
- Name (full organization name)
- Type (youth_organization)
- Level Count (number of ranks/levels in organization)
- Created Date

**Phase 4 Planned Features:**
- Create new organizations
- Edit organization details
- Configure level systems
- Manage color palettes
- Add badge catalogs

---

## Troop Management

**Current Status:** Read + Search (Phase 2)

**Available Operations:**
- ✅ View all troops
- ✅ Search troops by name
- ⏳ Create troops (Phase 4)
- ⏳ Edit troops (Phase 4)
- ⏳ Delete troops (Phase 4)
- ⏳ Assign leaders (Phase 4)

### View All Troops

**Steps:**

1. Navigate to Troops tab
2. Wait for troop list to load
3. View complete table of troops

**Information Displayed:**
- Troop Name
- Troop Number
- Leader Name (or "Unassigned")
- Member Count
- Created Date

**Sorting:**
- Currently: No sorting (displays in default order)
- Phase 4: Click column headers to sort

### Search Troops

**Steps:**

1. Navigate to Troops tab
2. Enter search term in search box:
   - Troop name (e.g., "Sunshine Troop")
   - Troop number (e.g., "101")
3. Click "Search" button or press Enter
4. View filtered results
5. Clear search box and click "Search" to see all troops

**Search Tips:**
- Search is case-insensitive
- Partial matches work (e.g., "Sun" matches "Sunshine Troop")
- Search matches troop name and number
- Empty search returns all troops

**Phase 4 Planned Features:**
- Create new troop (with organization, leader, members)
- Edit troop details (name, number, location)
- Delete troop (with cascade protection)
- Assign/change troop leader
- Add/remove troop members
- Bulk operations (import troops from CSV)

---

## Member Management

**Current Status:** Read + Search (Phase 2)

**Available Operations:**
- ✅ View all members (users)
- ✅ Search members by name or email
- ⏳ Create members (Phase 4)
- ⏳ Edit members (Phase 4)
- ⏳ Delete members (Phase 4)
- ⏳ Change roles (Phase 4)

### View All Members

**Steps:**

1. Navigate to Members tab
2. Wait for member list to load
3. View complete table of users

**Information Displayed:**
- Full Name (First + Last)
- Email Address
- Role (scout, parent, troop_leader, etc.)
- Troop Count (number of troops user belongs to)
- Status (Active/Inactive)

**Status Indicators:**
- ✓ Active (green) - Account is active
- ✗ Inactive (gray) - Account is disabled/inactive

### Search Members

**Steps:**

1. Navigate to Members tab
2. Enter search term in search box:
   - Name (e.g., "John Smith")
   - Email (e.g., "leader@test.com")
   - Partial name or email (e.g., "test.com")
3. Click "Search" button or press Enter
4. View filtered results
5. Clear search and click "Search" to see all members

**Search Tips:**
- Search is case-insensitive
- Matches first name, last name, or email
- Partial matches work
- Search both fields simultaneously
- Use specific terms for faster results

**Common Searches:**

**Find All Leaders:**
- Search for "leader" (matches email pattern)
- Manually filter by Role column

**Find All Scouts:**
- Search for "scout" (matches email pattern)
- Manually filter by Role column

**Find Specific User:**
- Search for full email address
- Or search for last name

**Phase 4 Planned Features:**
- Create new user account (with role, email, password)
- Edit user details (name, email, role)
- Delete user (soft delete with cascade handling)
- Change user role
- Assign to troops
- Reset password
- Deactivate/reactivate account
- Bulk operations (import users from CSV)

---

## Audit Log Review

**Current Status:** Read + Search (Phase 2)

**Available Operations:**
- ✅ View recent audit events (last 50)
- ✅ Search audit log by action, user, or resource
- ⏳ Filter by date range (Phase 5)
- ⏳ Export audit log (CSV/JSON) (Phase 5)
- ⏳ Advanced filtering (Phase 5)

### View Recent Activity

**Steps:**

1. Navigate to Audit Log tab
2. Wait for log to load (last 50 events)
3. Review event table

**Information Displayed:**
- Timestamp (date and time)
- User (who performed action)
- Action (what was done: grant, revoke, create, update, delete)
- Resource (what was affected: admin, user, troop, etc.)
- Details (JSON summary of changes)

**Event Order:**
- Newest events first (reverse chronological)
- Limit: 50 most recent events

### Search Audit Log

**Steps:**

1. Navigate to Audit Log tab
2. Enter search term in search box:
   - Action type (e.g., "grant", "revoke", "create")
   - User ID (e.g., UUID)
   - Resource type (e.g., "admin", "user", "troop")
3. Click "Search" button or press Enter
4. View filtered events (up to 50 matches)
5. Clear search and click "Search" to see recent events

**Search Examples:**

**Find Admin Changes:**
```
Search: admin
Results: admin_granted, admin_revoked events
```

**Find All Grants:**
```
Search: grant
Results: All grant actions
```

**Find Specific User's Actions:**
```
Search: 550e8400-e29b-41d4-a716-446655440001
Results: All events by that user ID
```

**Track Specific Resource:**
```
Search: troop
Results: All troop-related events
```

**Common Audit Tasks:**

### Track Admin Grants
1. Search for "admin_granted"
2. Check who granted access (userId field)
3. Check who received access (details field)
4. Note timestamp

### Track Admin Revocations
1. Search for "admin_revoked"
2. Check who revoked access
3. Check who lost access
4. Note timestamp and reason (if in details)

### Review Recent User Actions
1. Search for user ID
2. Review all actions by that user
3. Check for suspicious activity
4. Note patterns

### Compliance Review
1. View recent 50 events
2. Export to spreadsheet (manual copy for now, CSV export in Phase 5)
3. Document any incidents
4. Archive monthly logs

**Phase 5 Planned Features:**
- Date range filtering (e.g., "Show me January 2026")
- Export audit log (CSV, JSON, PDF)
- Advanced search (multiple criteria)
- Pagination (view more than 50 events)
- Real-time audit log updates
- Audit log archival
- Compliance reports

---

## Bulk Operations (Phase 4)

**Status:** Not yet implemented

**Planned Features:**

### Import Users (CSV)
- Upload CSV file with user data
- Validate data format
- Preview import
- Confirm and import
- Handle errors (duplicates, validation)

### Import Troops (CSV)
- Upload CSV file with troop data
- Map to organizations
- Assign leaders
- Import members
- Validate and import

### Export Data (CSV/JSON)
- Export all organizations
- Export all troops
- Export all members
- Export audit log
- Choose format (CSV, JSON)
- Download file

**See:** [Admin Panel Plan](/docs/Roadmap/ADMIN_PANEL_PLAN.md) Phase 4 for details

---

## Data Validation

### Email Validation

**Rules:**
- Valid email format (user@domain.com)
- Maximum 255 characters
- Must be unique (cannot duplicate existing email)

**Examples:**
- ✅ `admin@example.com`
- ✅ `user.name+tag@company.co.uk`
- ❌ `invalid-email` (no @ symbol)
- ❌ `user@` (incomplete domain)
- ❌ (empty string)

### Password Validation (Bootstrap)

**Rules:**
- Minimum 8 characters
- Must contain:
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
- No maximum length (reasonable limit ~255 chars)

**Examples:**
- ✅ `AdminPass123!`
- ✅ `SecurePassword456`
- ❌ `weak` (too short)
- ❌ `alllowercase123` (no uppercase)
- ❌ `ALLUPPERCASE123` (no lowercase)
- ❌ `NoNumbers!` (no numbers)

### Name Validation (Bootstrap)

**Rules:**
- Required (cannot be empty)
- 1-100 characters
- Any Unicode characters allowed

**Examples:**
- ✅ `John`
- ✅ `O'Brien`
- ✅ `José García`
- ❌ (empty string)
- ❌ (>100 characters)

---

## Error Handling

### Common Error Messages

**Authentication Errors:**
- "Authentication required" → Log in
- "Admin access required" → Ask admin to grant access
- "Session expired" → Log out and log back in

**Validation Errors:**
- "Email is required" → Enter email
- "User not found" → Create user account first
- "Invalid email format" → Check email syntax

**Permission Errors:**
- "Cannot revoke your own admin access" → Ask another admin
- "Cannot revoke the last admin account" → Create another admin first

**System Errors:**
- "Failed to load data" → Refresh page, check server logs
- "Network error" → Check internet connection
- "Database error" → Check database status, contact admin

### Error Recovery

**If operation fails:**
1. Note the error message
2. Check browser console (F12) for details
3. Verify prerequisites are met
4. Retry operation
5. If persistent, check server logs
6. Contact system administrator if needed

**If data doesn't load:**
1. Hard refresh browser (Ctrl+Shift+R)
2. Check you're logged in and have admin access
3. Check server is running
4. Check database is accessible
5. Review server logs for errors

---

## Best Practices

### Admin Management
- Always maintain 2-3 active admins
- Review admin list weekly
- Revoke access when no longer needed
- Document reasons for grants/revocations
- Notify users when access changes

### Data Management
- Search before creating (avoid duplicates)
- Verify data before deleting
- Use soft deletes when possible (Phase 4)
- Export data before bulk changes (Phase 4)
- Review audit log after major operations

### Security
- Use strong passwords (8+ chars, mixed case, numbers)
- Log out when finished
- Don't share admin credentials
- Review audit log for suspicious activity
- Report security incidents immediately

### Performance
- Use search to filter large data sets
- Avoid loading all members at once (use search)
- Clear search after use
- Close admin panel when not in use
- Hard refresh if UI seems slow or broken

---

## Related Documentation

- [Admin Panel User Guide](/docs/Getting%20Started/ADMIN_PANEL_USER_GUIDE.md) - Complete admin panel documentation
- [Admin Endpoints API](/docs/API/ADMIN_ENDPOINTS.md) - API reference for CRUD operations
- [Admin System Architecture](/docs/Architecture/ADMIN_SYSTEM_ARCHITECTURE.md) - Technical implementation details
- [Admin Panel Plan](/docs/Roadmap/ADMIN_PANEL_PLAN.md) - Full implementation roadmap

---

**Last Updated:** February 13, 2026
**Phase:** Phase 2 Complete (Read + Admin CRUD)
**Next Phase:** Phase 4 (Full CRUD for Organizations, Troops, Members)
