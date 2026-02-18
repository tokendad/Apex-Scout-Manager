# Admin Panel User Guide

**Last Updated:** February 13, 2026
**Status:** Phase 2 Complete
**Related Documentation:**
- [Admin Endpoints API](/docs/API/ADMIN_ENDPOINTS.md)
- [Admin Dashboard](/docs/Getting%20Started/ADMIN_DASHBOARD.md)
- [Admin System Architecture](/docs/Architecture/ADMIN_SYSTEM_ARCHITECTURE.md)

---

## Overview

The Admin Panel is a web-based interface for system administrators to manage all aspects of Apex Scout Manager. It provides centralized access to users, troops, organizations, and system configuration with a clean, intuitive interface.

**Access URL:** `http://localhost:5252/admin` (or `https://your-domain.com/admin` in production)

**Requirements:**
- Active user account
- Admin privileges granted via `admins` table
- Valid session (automatic redirect to login if not authenticated)

---

## Accessing the Admin Panel

### 1. Login Required

The admin panel requires authentication. If you're not logged in, you'll be automatically redirected to the login page:

```
/admin → (redirect) → /login.html?redirect=/admin&reason=auth_required
```

After successful login, you'll be redirected back to the admin panel.

### 2. Admin Access Required

If you're logged in but don't have admin privileges, you'll receive a 403 Forbidden error and be redirected to the home page with an error message:

```
/admin → (redirect) → /?error=admin_access_required
```

**To gain admin access:**
- Bootstrap: If no admins exist, use the bootstrap flow (see [Bootstrap Setup Guide](/docs/Getting%20Started/BOOTSTRAP_SETUP.md))
- Grant: Ask an existing admin to grant you admin access via the Admins tab

### 3. Direct Access

Once authenticated with admin privileges, navigate directly to:
- URL: `http://localhost:5252/admin`
- Or click "Admin Panel" link (if available in navigation)

---

## Admin Panel Interface

### Layout

The admin panel uses a sidebar navigation pattern with 6 main sections plus logout:

```
┌─────────────────┬──────────────────────────────────┐
│   Sidebar       │   Main Content Area              │
│                 │                                  │
│  📊 Dashboard   │   [Active Tab Content]           │
│  👨‍💼 Admins     │                                  │
│  🏢 Organizations│                                  │
│  👥 Troops      │                                  │
│  👤 Members     │                                  │
│  📋 Audit Log   │                                  │
│                 │                                  │
│  ↪ Logout       │                                  │
└─────────────────┴──────────────────────────────────┘
```

### Navigation

**Desktop (>768px):**
- Fixed sidebar on left (always visible)
- Click tab to switch views
- Active tab highlighted in blue

**Mobile (<768px):**
- Hamburger menu icon
- Tap to open slide-in sidebar
- Tap tab to switch views and close menu

**Keyboard Shortcuts:**
- Arrow keys: Navigate between tabs (when sidebar has focus)
- Escape: Close mobile menu (if open)

---

## Tab Sections

### 1. Dashboard (📊)

**Purpose:** System overview and health monitoring

**Features:**
- **System Statistics:**
  - Active Admins count
  - Organizations count
  - Troops count
  - Total Members count

- **System Status:**
  - Server Status (Online/Offline)
  - Database Connection (Connected/Disconnected)
  - Bootstrap Status (Complete/Required)

- **Recent Activities:**
  - Last 10 admin actions
  - User login events
  - System changes

**Common Tasks:**
- Monitor system health at a glance
- Check for issues (bootstrap required, connection errors)
- Review recent system activity

---

### 2. Admins (👨‍💼)

**Purpose:** Manage system administrator accounts

**Features:**
- **Admin List Table:**
  - Email address
  - Role (admin/super_admin)
  - Granted date
  - Granted by (admin who created this admin)
  - Actions (Revoke button)

- **Create Admin Form:**
  - Click "+ Add New Admin" button
  - Enter user email address
  - System searches for existing user
  - Creates admin record for user

**Common Tasks:**

#### Create New Admin
1. Click "+ Add New Admin" button
2. Enter the user's email address
3. Click "Create Admin"
4. Verify success message
5. See new admin in the list

**Notes:**
- User must already exist in the system
- Cannot create admin for email that doesn't exist
- New admin immediately gains full system access

#### Revoke Admin Access
1. Find admin in the list
2. Click "Revoke" button next to their name
3. Confirm in the dialog
4. Admin access removed immediately

**Safety Protections:**
- Cannot revoke your own admin access
- Cannot revoke the last admin account
- Revocation is logged with timestamp and revoking admin

---

### 3. Organizations (🏢)

**Purpose:** View scout organizations in the system

**Features:**
- **Organization List Table:**
  - Organization Code (gsusa, sa_cub, sa_bsa)
  - Organization Name
  - Type (youth_organization)
  - Level Count (number of ranks/levels)
  - Created Date

**Currently Available Organizations:**
- Girl Scouts USA (gsusa) - 6 levels
- Scouting America - Cub Scouts (sa_cub) - 6 ranks
- Scouting America - Scouts BSA (sa_bsa) - 7 ranks

**Common Tasks:**
- View all organizations
- Check level counts
- Verify organization setup

**Note:** Full CRUD operations (create/edit/delete organizations) will be added in Phase 4.

---

### 4. Troops (👥)

**Purpose:** Browse and search troops across all organizations

**Features:**
- **Search Box:**
  - Search by troop name
  - Real-time filtering

- **Troops Table:**
  - Troop Name
  - Troop Number
  - Leader Name
  - Member Count
  - Created Date

**Common Tasks:**

#### View All Troops
1. Navigate to Troops tab
2. View complete list of troops
3. Sort by clicking column headers (if enabled)

#### Search for Specific Troop
1. Enter troop name or number in search box
2. Click "Search" button (or press Enter)
3. View filtered results
4. Clear search to see all troops again

**Tips:**
- Leave search empty and click "Search" to reload all troops
- Search is case-insensitive
- Search matches troop name and number

**Note:** Full CRUD operations (create/edit/delete troops) will be added in Phase 4.

---

### 5. Members (👤)

**Purpose:** Search and view all users across the system

**Features:**
- **Search Box:**
  - Search by name or email
  - Real-time filtering

- **Members Table:**
  - Full Name
  - Email Address
  - Role (scout, parent, troop_leader, etc.)
  - Troop Count (number of troops user belongs to)
  - Status (Active/Inactive)

**Common Tasks:**

#### View All Members
1. Navigate to Members tab
2. View complete list of all users
3. Check status indicators

#### Search for Specific Member
1. Enter name or email in search box
2. Click "Search" button (or press Enter)
3. View filtered results
4. Check user details

#### Find Users by Role
1. Search for role keywords (e.g., "leader", "scout", "parent")
2. Filter results manually from displayed list

**Status Indicators:**
- ✓ Active (green) - User account is active
- ✗ Inactive (gray) - User account is inactive/disabled

**Note:** Full CRUD operations (create/edit/delete members) will be added in Phase 4.

---

### 6. Audit Log (📋)

**Purpose:** Review system activity and admin actions

**Features:**
- **Search Box:**
  - Search by action, user, or resource
  - Filter audit events

- **Audit Log Table:**
  - Timestamp (date and time of event)
  - User (who performed the action)
  - Action (what was done: create, update, delete, grant, revoke)
  - Resource (what was affected: admin, user, troop, etc.)
  - Details (JSON summary of changes)

**Common Tasks:**

#### View Recent Activity
1. Navigate to Audit Log tab
2. View last 50 events (default)
3. Review timestamps and actions

#### Search Audit Log
1. Enter search term (action, user ID, resource type)
2. Click "Search" button
3. View filtered events
4. Clear search to see all events

#### Track Admin Changes
1. Search for "admin" to see admin-related actions
2. Look for "grant" and "revoke" actions
3. Check grantedBy/revokedBy fields in details

**Event Types:**
- `admin_granted` - Admin access granted to user
- `admin_revoked` - Admin access removed from user
- `user_created` - New user account created
- `user_updated` - User account modified
- `troop_created` - New troop created
- `badge_awarded` - Badge awarded to scout
- And more...

**Note:** Full audit log with filtering and export will be enhanced in Phase 5.

---

## Common Workflows

### Daily Admin Tasks

1. **Morning Check:**
   - Open Dashboard
   - Check system status (all green)
   - Review recent activities
   - Check for anomalies

2. **User Management:**
   - Navigate to Members tab
   - Search for new users
   - Verify user roles
   - Check troop assignments

3. **Troop Management:**
   - Navigate to Troops tab
   - Review troop list
   - Check member counts
   - Identify troops needing attention

4. **Admin Management:**
   - Navigate to Admins tab
   - Review active admins
   - Verify admin assignments
   - Revoke unnecessary access

5. **Audit Review:**
   - Navigate to Audit Log
   - Review recent actions
   - Check for suspicious activity
   - Export log for compliance (Phase 5)

### Weekly Admin Tasks

1. **System Health:**
   - Check Dashboard statistics
   - Verify all services online
   - Review growth trends (members, troops)

2. **Access Review:**
   - Review Admins list
   - Verify all admins still need access
   - Revoke inactive admin accounts
   - Ensure 2+ admins always exist

3. **Data Quality:**
   - Review Members for duplicates
   - Check Troops for orphaned records
   - Verify Organizations are correct

4. **Audit Compliance:**
   - Export Audit Log (Phase 5)
   - Review admin actions
   - Document any incidents

### Emergency Procedures

#### Lost Admin Access (All Admins Revoked)

If you accidentally revoke all admin accounts:

1. Access database directly (via psql or database tool)
2. Delete all admin records:
   ```sql
   DELETE FROM admins;
   ```
3. Bootstrap endpoint reactivates automatically
4. Call bootstrap endpoint to create new first admin:
   ```bash
   curl -X POST http://localhost:5252/api/system/bootstrap \
     -H "Content-Type: application/json" \
     -d '{
       "email": "recovery-admin@example.com",
       "password": "SecurePassword123!",
       "firstName": "Recovery",
       "lastName": "Admin"
     }'
   ```
5. Log in with new admin account
6. Recreate admin accounts as needed

#### System Not Responding

1. Check server status in Dashboard
2. If offline, check server logs:
   ```bash
   docker compose logs -f asm-dev
   ```
3. Restart container if needed:
   ```bash
   docker compose restart asm-dev
   ```
4. Check database connection
5. Contact system administrator if issues persist

---

## Alert Messages

The admin panel uses color-coded alerts to communicate status:

### Success (Green)
- "Dashboard loaded successfully"
- "Admin created successfully"
- "Admin revoked successfully"
- "Found X member(s)"

**Action:** No action needed, operation completed successfully

### Error (Red)
- "Failed to load dashboard: [error message]"
- "Failed to create admin: User not found"
- "Search failed: [error message]"
- "Admin access required"

**Action:** Review error message, fix issue, retry operation

### Alert Auto-Dismiss

Most success alerts auto-dismiss after 2-3 seconds. Error alerts remain visible until the next operation.

---

## Search Tips

### Members Search
- **By Email:** Enter full or partial email (e.g., "test.local", "leader")
- **By Name:** Enter first or last name (e.g., "John", "Smith")
- **By Role:** Search won't filter by role directly, but you can visually scan results

### Troops Search
- **By Name:** Enter troop name (e.g., "Troop 101", "Sunshine")
- **By Number:** Enter troop number (e.g., "101")

### Audit Log Search
- **By Action:** Search for action types (e.g., "grant", "revoke", "create")
- **By User:** Search for user ID or email
- **By Resource:** Search for resource type (e.g., "admin", "user", "troop")

**Pro Tips:**
- Searches are case-insensitive
- Partial matches work
- Leave search blank and click "Search" to reset and see all results
- Use specific terms for faster results

---

## Responsive Design

### Desktop Experience (>768px)

- Fixed sidebar navigation (always visible)
- Wide main content area
- Tables with full columns
- Hover effects on buttons and rows

### Mobile Experience (<768px)

- Hamburger menu icon (top-left)
- Slide-in sidebar navigation
- Responsive tables (font size adjusted)
- Touch-friendly buttons
- Auto-close menu after selection

**Mobile Tips:**
- Tap hamburger icon to open menu
- Tap outside menu to close
- Scroll tables horizontally if needed
- Use landscape orientation for better table viewing

---

## Keyboard Navigation

### Tab Navigation
- **Tab:** Move between form fields
- **Shift+Tab:** Move backward
- **Enter:** Submit form or click focused button
- **Escape:** Close modals or mobile menu

### Table Navigation
- **Arrow Keys:** Navigate table cells (if enabled)
- **Page Up/Down:** Scroll through long tables

### Accessibility
- All buttons have clear labels
- Tables have proper headers
- Forms have labels for screen readers
- Focus indicators visible

---

## Troubleshooting

### Cannot Access Admin Panel

**Symptom:** Redirected to login page or home page with error

**Solutions:**
1. Verify you're logged in (check for logout button)
2. Verify you have admin access:
   ```sql
   SELECT * FROM admins WHERE "userId" = 'YOUR_USER_ID' AND "revokedAt" IS NULL;
   ```
3. Ask another admin to grant you access
4. If no admins exist, use bootstrap flow

### Dashboard Shows "0" for All Statistics

**Symptom:** All stat cards show "0" even though data exists

**Solutions:**
1. Check browser console for errors (F12)
2. Verify API endpoints are accessible:
   ```bash
   curl http://localhost:5252/api/system/admins \
     -H "Cookie: [your-session-cookie]"
   ```
3. Check server logs for errors
4. Hard refresh browser (Ctrl+Shift+R)

### Search Not Working

**Symptom:** Search returns no results or errors

**Solutions:**
1. Check search term (try simpler/shorter terms)
2. Clear search and retry
3. Check browser console for errors
4. Verify API endpoint is accessible
5. Check server logs for query errors

### Tables Not Displaying

**Symptom:** "Loading..." or "No data found" when data should exist

**Solutions:**
1. Check browser console for JavaScript errors
2. Hard refresh browser (Ctrl+Shift+R)
3. Clear browser cache
4. Check API endpoint responses (Network tab in DevTools)
5. Verify database contains data

### Admin Panel Looks Broken

**Symptom:** Styles missing, layout broken

**Solutions:**
1. Hard refresh browser (Ctrl+Shift+R)
2. Clear browser cache
3. Check that `/public/styles.css` is accessible
4. Check browser console for 404 errors on CSS files
5. Verify CSS version in HTML matches deployed version

---

## Browser Compatibility

### Supported Browsers
- ✅ Chrome 90+ (recommended)
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

### Not Supported
- ❌ Internet Explorer (any version)
- ❌ Browsers with JavaScript disabled

**Note:** For best experience, use latest version of Chrome or Firefox.

---

## Security Best Practices

### Session Security
- Admin sessions expire after 7 days (same as regular users)
- Always log out when finished
- Don't share admin credentials
- Use strong, unique passwords

### Admin Account Management
- Maintain 2-3 active admin accounts (redundancy)
- Review admin list weekly
- Revoke admin access when no longer needed
- Document why admin access was granted

### Data Protection
- Don't share admin panel screenshots with sensitive data
- Don't leave admin panel open on shared computers
- Lock computer when stepping away
- Use HTTPS in production (protects data in transit)

### Audit Trail
- Review Audit Log regularly
- Watch for suspicious activity
- Document incidents
- Export logs monthly for compliance (Phase 5)

---

## Future Enhancements

### Phase 4: Full CRUD Operations
- Create/edit/delete organizations
- Create/edit/delete troops
- Create/edit/delete members
- Bulk operations (import/export)

### Phase 5: Advanced Features
- Session management (view/revoke active sessions)
- System configuration interface
- Backup/restore functionality
- Performance monitoring
- Data anonymization tools

### Phase 6: Remove Legacy Admin
- Remove hardcoded welefort@gmail.com account
- Remove council_admin role completely
- Migrate all admin users to new system

---

## Related Documentation

- [Admin Endpoints API](/docs/API/ADMIN_ENDPOINTS.md) - API reference for admin endpoints
- [Admin Dashboard](/docs/Getting%20Started/ADMIN_DASHBOARD.md) - Dashboard-specific documentation
- [Admin CRUD Guide](/docs/Getting%20Started/ADMIN_CRUD_GUIDE.md) - CRUD operation walkthroughs
- [Admin System Architecture](/docs/Architecture/ADMIN_SYSTEM_ARCHITECTURE.md) - Technical architecture
- [Bootstrap Setup Guide](/docs/Getting%20Started/BOOTSTRAP_SETUP.md) - Initial admin setup
- [Admin Panel Plan](/docs/Roadmap/ADMIN_PANEL_PLAN.md) - Full implementation roadmap

---

**Last Updated:** February 13, 2026
**Phase:** Phase 2 Complete (Frontend UI)
**Status:** Ready for Use
