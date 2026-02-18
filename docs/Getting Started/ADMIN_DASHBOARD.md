# Admin Dashboard Guide

**Last Updated:** February 13, 2026
**Status:** Phase 2 Complete
**Related Documentation:**
- [Admin Panel User Guide](/docs/Getting%20Started/ADMIN_PANEL_USER_GUIDE.md)
- [Admin Endpoints API](/docs/API/ADMIN_ENDPOINTS.md)

---

## Overview

The Admin Dashboard is the central hub of the Admin Panel, providing a real-time overview of system health, statistics, and recent activity. It's the first view shown when accessing the admin panel and serves as a monitoring dashboard for system administrators.

**Access:** Navigate to `/admin` or click the Dashboard (📊) tab in the admin panel sidebar.

---

## Dashboard Layout

```
┌─────────────────────────────────────────────────────┐
│                   Dashboard                         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌────────┐│
│  │ Active  │  │  Org.   │  │ Troops  │  │Members ││
│  │ Admins  │  │  Count  │  │  Count  │  │ Count  ││
│  │    3    │  │    3    │  │   12    │  │   45   ││
│  └─────────┘  └─────────┘  └─────────┘  └────────┘│
│                                                     │
│  System Status                                      │
│  ┌───────────────────────────────────────────────┐ │
│  │ Server Status:     ✓ Online                  │ │
│  │ Database:          ✓ Connected               │ │
│  │ Bootstrap Status:  ✓ Complete                │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  Recent Activities                                  │
│  ┌───────────────────────────────────────────────┐ │
│  │ [Last 10 admin actions displayed here]       │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## System Statistics Cards

The dashboard displays four key metrics at the top:

### 1. Active Admins

**Display:** Large number with "Active Admins" label

**Meaning:**
- Number of admin accounts with active admin privileges
- Counts only non-revoked admins (`revokedAt IS NULL`)
- Does NOT include revoked or inactive admins

**Typical Values:**
- Production: 2-5 admins
- Development: 1-3 admins

**Alert Levels:**
- ⚠️ **0 Admins:** Critical - system is in bootstrap mode
- ⚠️ **1 Admin:** Warning - no redundancy, create backup admin
- ✅ **2-5 Admins:** Healthy - good redundancy
- ⚠️ **>10 Admins:** Review needed - may have too many admins

**Recommended Actions:**
- Keep 2-3 active admins at minimum
- Revoke admin access when no longer needed
- Review admin list weekly

---

### 2. Organizations

**Display:** Large number with "Organizations" label

**Meaning:**
- Number of scout organizations configured in the system
- Includes GSUSA, Cub Scouts, Scouts BSA, and any custom organizations

**Typical Values:**
- Standard Setup: 3 organizations (GSUSA, Cub Scouts, Scouts BSA)
- Custom Setup: 1-10 organizations

**What This Tells You:**
- System is configured for multi-organization support
- Each organization has levels, colors, and badge catalogs
- Organizations represent different scouting programs

**Recommended Actions:**
- Verify expected organizations are present
- Check that each organization has level systems configured
- Ensure badge catalogs are populated (Phase 3.2+)

---

### 3. Troops

**Display:** Large number with "Troops" label

**Meaning:**
- Total number of troops across all organizations
- Includes active and inactive troops
- Each troop belongs to one organization

**Typical Values:**
- Small Deployment: 1-10 troops
- Medium Deployment: 10-50 troops
- Large Deployment: 50+ troops

**What This Tells You:**
- System usage and scale
- Growth over time (compare to previous checks)
- Active communities using the system

**Recommended Actions:**
- Monitor growth trends
- Identify inactive troops (no recent activity)
- Plan for capacity as troop count grows

---

### 4. Total Members

**Display:** Large number with "Total Members" label

**Meaning:**
- Total number of user accounts in the system
- Includes all roles: scouts, parents, leaders, volunteers
- Includes active and inactive accounts

**Typical Values:**
- Small Deployment: 10-100 members
- Medium Deployment: 100-1,000 members
- Large Deployment: 1,000+ members

**What This Tells You:**
- Total user base size
- System usage and engagement
- Growth trends

**Recommended Actions:**
- Monitor user growth
- Plan for scaling (database, server resources)
- Review inactive accounts periodically
- Check for duplicate accounts

---

## System Status Section

### Server Status

**Display:** "Server Status: ✓ Online" (green) or "✗ Offline" (red)

**Meaning:**
- Indicates if the admin panel can communicate with the server
- Updated when dashboard loads
- Green checkmark = healthy
- Red X = server unreachable

**Troubleshooting "Offline":**
1. Check if server container is running:
   ```bash
   docker compose ps
   ```
2. Check server logs:
   ```bash
   docker compose logs -f asm-dev
   ```
3. Restart server if needed:
   ```bash
   docker compose restart asm-dev
   ```

---

### Database Connection

**Display:** "Database Connection: ✓ Connected" (green) or "✗ Disconnected" (red)

**Meaning:**
- Indicates if server can connect to PostgreSQL database
- Updated when API calls complete successfully
- Green checkmark = database queries working
- Red X = database connection failed

**Troubleshooting "Disconnected":**
1. Check database container status:
   ```bash
   docker compose ps postgres
   ```
2. Check database logs:
   ```bash
   docker compose logs -f postgres
   ```
3. Verify database credentials in environment variables
4. Check connection pool health:
   ```sql
   SELECT count(*) FROM pg_stat_activity;
   ```
5. Restart database if needed:
   ```bash
   docker compose restart postgres
   ```

---

### Bootstrap Status

**Display:**
- "Bootstrap Status: ✓ Complete" (green)
- "Bootstrap Status: ⚠ Bootstrap Required" (orange)

**Meaning:**
- **Complete:** At least one admin account exists in the system
- **Bootstrap Required:** No admin accounts exist, system needs initial setup

**"Complete" State:**
- System has been initialized
- At least one admin account active
- Normal operations can proceed

**"Bootstrap Required" State:**
- No admin accounts exist
- Bootstrap endpoint is active
- Initial admin setup needed

**How to Bootstrap:**
1. Call bootstrap endpoint:
   ```bash
   curl -X POST http://localhost:5252/api/system/bootstrap \
     -H "Content-Type: application/json" \
     -d '{
       "email": "admin@example.com",
       "password": "SecurePassword123!",
       "firstName": "System",
       "lastName": "Admin"
     }'
   ```
2. Refresh dashboard
3. Verify status shows "Complete"

**See:** [Bootstrap Setup Guide](/docs/Getting%20Started/BOOTSTRAP_SETUP.md) for detailed instructions.

---

## Recent Activities Section

**Display:** "Recent Activities" heading with loading indicator or activity list

**Purpose:**
- Show recent admin actions and system events
- Provide visibility into what's happening in the system
- Quick audit trail for recent changes

**Current Implementation (Phase 2):**
- Shows "Loading..." placeholder
- Full implementation planned for Phase 4

**Planned Features (Phase 4):**
- Last 10 admin actions (grants, revocations, data changes)
- Last 10 user logins
- Recent troop creations
- Recent badge awards
- System configuration changes

**Example Future Display:**
```
Recent Activities
┌─────────────────────────────────────────────────┐
│ 2026-02-13 10:30 - Admin granted to user123    │
│ 2026-02-13 09:15 - Troop created: Troop 501    │
│ 2026-02-13 08:45 - Badge awarded: First Aid    │
│ 2026-02-12 16:20 - User login: leader@test.com │
│ 2026-02-12 14:10 - Admin revoked from user456  │
└─────────────────────────────────────────────────┘
```

**Workaround (Phase 2):**
- Use Audit Log tab to view recent system events
- Navigate to specific tabs (Admins, Troops, Members) for recent changes

---

## Dashboard Refresh

### Automatic Refresh

**Current Behavior:**
- Dashboard loads when you navigate to it
- Data fetched fresh from API each time
- No auto-refresh while viewing

**Manual Refresh:**
- Click away from Dashboard tab and back to refresh
- Or hard refresh browser (Ctrl+Shift+R)

**Planned Features (Phase 5):**
- Auto-refresh every 30 seconds
- Real-time updates via WebSocket
- Manual refresh button

---

## Understanding the Metrics

### Healthy System Indicators

✅ **Good System Health:**
- 2-3 active admins
- Organizations match expected count (usually 3)
- Troops growing steadily over time
- Members actively engaging
- Server status: Online
- Database: Connected
- Bootstrap: Complete

### Warning Signs

⚠️ **Issues to Address:**
- Only 1 admin (create backup admin immediately)
- Server offline (check logs, restart container)
- Database disconnected (check database container)
- Bootstrap required (system not initialized)
- Sudden drop in member count (investigate deletions)
- No troop growth for extended period (low engagement)

### Critical Alerts

🚨 **Immediate Action Required:**
- 0 admins (bootstrap required, potential lockout)
- Server offline for >5 minutes (system down)
- Database disconnected (data not accessible)
- All statistics showing 0 (API failure or data loss)

---

## Dashboard Performance

### Load Time

**Expected Load Times:**
- Fresh load: <2 seconds
- Subsequent loads: <1 second (browser cache)
- On slow networks: up to 5 seconds

**If dashboard loads slowly (>5 seconds):**
1. Check network connection
2. Check server logs for slow queries
3. Check database query performance
4. Consider indexing optimizations (contact developer)

### API Calls

**Dashboard makes 5 parallel API calls on load:**
1. `GET /api/system/admins` - Get admin count
2. `GET /api/organizations` - Get organization count
3. `GET /api/troops` - Get troop count
4. `GET /api/members` - Get member count
5. `GET /api/system/bootstrap-status` - Get bootstrap status

**All calls must complete for dashboard to fully load.**

**If one API fails:**
- Stat card shows "0"
- Error message displayed in alert area
- Other stat cards still load correctly

---

## Responsive Design

### Desktop View (>768px)

- 4 stat cards in horizontal row
- Wide system status table
- Spacious layout with padding

### Tablet View (768px-1024px)

- 2 stat cards per row (2 rows)
- Full-width system status table
- Adjusted padding for medium screens

### Mobile View (<768px)

- 1 stat card per row (4 rows stacked)
- Full-width system status table
- Compact layout for small screens
- Touch-friendly buttons and cards

---

## Troubleshooting Dashboard Issues

### Statistics Show "0" But Data Exists

**Cause:** API calls failing or returning empty data

**Solutions:**
1. Check browser console (F12) for JavaScript errors
2. Check Network tab for failed API requests
3. Verify you're logged in and have admin access
4. Check server logs for API errors
5. Hard refresh browser (Ctrl+Shift+R)
6. Try logging out and back in

### "Loading..." Never Completes

**Cause:** API calls timing out or JavaScript error

**Solutions:**
1. Check browser console for errors
2. Check network tab for stuck requests
3. Hard refresh browser
4. Check server is running
5. Check database is accessible
6. Try different browser

### Dashboard Looks Broken/Unstyled

**Cause:** CSS not loading or caching issues

**Solutions:**
1. Hard refresh (Ctrl+Shift+R)
2. Clear browser cache
3. Check console for 404 errors on CSS files
4. Verify `/public/styles.css` is accessible:
   ```
   http://localhost:5252/styles.css?v=13
   ```
5. Check CSS version in HTML matches deployed version

### Server Status Always Shows "Offline"

**Cause:** API endpoint not accessible or CORS issue

**Solutions:**
1. Check if admin panel loaded at all (if yes, server is online)
2. This is a display issue, not actual server issue
3. Check browser console for CORS errors
4. Verify admin panel JavaScript loaded correctly
5. Check `/admin.js` file for errors

---

## Monitoring Best Practices

### Daily Checks (2 minutes)

1. Open Admin Dashboard
2. Check all 4 stat cards (verify numbers look correct)
3. Check System Status (all green checkmarks)
4. Note any anomalies

### Weekly Reviews (10 minutes)

1. Compare statistics to last week:
   - Admin count (should be stable)
   - Organization count (should be stable)
   - Troop count (should grow or stay stable)
   - Member count (should grow)

2. Review Recent Activities (when implemented)
3. Check for any unusual patterns
4. Document any issues or trends

### Monthly Audits (30 minutes)

1. Review all statistics and note growth trends
2. Check Admins tab - verify all admins still need access
3. Check Organizations - ensure all are properly configured
4. Check Troops - identify inactive troops
5. Check Members - review for duplicates or inactive accounts
6. Export Audit Log for compliance (Phase 5)
7. Document findings

---

## Dashboard Data Sources

### Data Flow

```
Dashboard (admin.html)
    ↓
admin.js loadDashboard()
    ↓
API Endpoints (server.js)
    ↓
Database (PostgreSQL)
    ↓
Response Back to Browser
    ↓
Update Stat Cards & Status
```

### Database Queries

**Admin Count:**
```sql
SELECT COUNT(*) FROM admins WHERE "revokedAt" IS NULL
```

**Organization Count:**
```sql
SELECT COUNT(*) FROM scout_organizations
```

**Troop Count:**
```sql
SELECT COUNT(*) FROM troops
```

**Member Count:**
```sql
SELECT COUNT(*) FROM users
```

**All queries run in parallel for performance.**

---

## Related Documentation

- [Admin Panel User Guide](/docs/Getting%20Started/ADMIN_PANEL_USER_GUIDE.md) - Complete admin panel documentation
- [Admin Endpoints API](/docs/API/ADMIN_ENDPOINTS.md) - API reference
- [Admin System Architecture](/docs/Architecture/ADMIN_SYSTEM_ARCHITECTURE.md) - Technical details
- [Bootstrap Setup Guide](/docs/Getting%20Started/BOOTSTRAP_SETUP.md) - Initial setup

---

**Last Updated:** February 13, 2026
**Phase:** Phase 2 Complete
**Status:** Fully Functional
