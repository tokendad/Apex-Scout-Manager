# Apex Scout Manager Database Schema (PostgreSQL)

**Last Updated:** February 8, 2026
**Database System:** PostgreSQL
**Key Feature:** Uses `uuid-ossp` extension for UUID primary keys.

## Overview
The Apex Scout Manager database has been migrated from SQLite to PostgreSQL to support advanced features like role-based access control (RBAC), COPPA compliance, and better scalability. All primary keys use UUID v4.

**Recent Changes (V3):**
- Added normalized `scout_inventory` table.
- Linked `sales` to `cookie_products` via `productId`.
- Deprecated legacy flat-file inventory columns in `profile`.

---

## Authentication & User Management

### `users`
Core user accounts. Supports scouts, parents, troop leaders, and admins.
*Includes COPPA compliance fields for minors.*

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | **PK**, Default: `uuid_v4` | Unique User ID |
| `email` | VARCHAR(255) | Unique, Not Null | User's email address |
| `password_hash` | VARCHAR(255) | | Bcrypt hash |
| `firstName` | VARCHAR(100) | Not Null | |
| `lastName` | VARCHAR(100) | Not Null | |
| `role` | VARCHAR(20) | Default: 'scout' | Enum: `scout`, `troop_leader`, `council_admin`, `parent` |
| `isActive` | BOOLEAN | Default: `true` | Account status |
| `emailVerified` | BOOLEAN | Default: `false` | Email verification status |
| `dateOfBirth` | DATE | | Used for age verification |
| `isMinor` | BOOLEAN | Default: `false` | Flag for users < 13 |
| `parentEmail` | VARCHAR(255) | | Required for minors |
| `parentConsentDate` | TIMESTAMP | | COPPA consent timestamp |
| `parentConsentIP` | VARCHAR(45) | | IP address of consent |
| `googleId` | VARCHAR(255) | Unique | Google OAuth ID |
| `photoUrl` | TEXT | | Profile picture URL |
| `createdAt` | TIMESTAMP | Default: `now()` | |
| `lastLogin` | TIMESTAMP | | |

### `sessions`
Active user sessions.
*(Note: May be moved to Redis in future iterations)*

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | **PK** | Unique Session ID |
| `userId` | UUID | **FK** -> `users.id` | Owner of session |
| `sessionToken` | VARCHAR(255) | Unique, Not Null | Auth token |
| `expiresAt` | TIMESTAMP | Not Null | Expiration time |
| `ipAddress` | VARCHAR(45) | | |
| `userAgent` | TEXT | | Client device info |
| `createdAt` | TIMESTAMP | Default: `now()` | |

### `audit_log`
Security and compliance audit trail.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | **PK** | |
| `userId` | UUID | **FK** -> `users.id` | User performing action |
| `action` | VARCHAR(100) | Not Null | e.g., 'LOGIN', 'UPDATE_PROFILE' |
| `resourceType` | VARCHAR(100) | Not Null | e.g., 'user', 'sale' |
| `resourceId` | UUID | | ID of affected resource |
| `ipAddress` | VARCHAR(45) | | |
| `userAgent` | TEXT | | |
| `details` | TEXT | | JSON or text details |
| `timestamp` | TIMESTAMP | Default: `now()` | |

### `data_deletion_requests`
Tracks requests for data deletion (GDPR/COPPA compliance).

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | **PK** | |
| `userId` | UUID | **FK** -> `users.id` | User to be deleted |
| `requestedBy` | UUID | **FK** -> `users.id` | Requestor (e.g. Parent) |
| `reason` | TEXT | | |
| `requestDate` | TIMESTAMP | Default: `now()` | |
| `status` | VARCHAR(20) | Default: 'pending' | Enum: `pending`, `in_progress`, `completed`, `cancelled` |

### `notifications`
In-app notifications for users.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | **PK** | |
| `userId` | UUID | **FK** -> `users.id` | Recipient |
| `type` | VARCHAR(20) | Not Null | Enum: `info`, `success`, `warning`, `error`, `achievement` |
| `title` | VARCHAR(255) | Not Null | |
| `message` | TEXT | Not Null | |
| `isRead` | BOOLEAN | Default: `false` | |
| `actionUrl` | TEXT | | Link to relevant page |

---

## Organizational Structure

### `councils`
Regional councils (e.g., "Girl Scouts of Greater New York").

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | **PK** | |
| `name` | VARCHAR(255) | Not Null | Council Name |
| `region` | VARCHAR(100) | | |
| `contactEmail` | VARCHAR(255) | | |
| `settings` | TEXT | | JSON configuration |

### `troops`
Individual troops belonging to a council.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | **PK** | |
| `councilId` | UUID | **FK** -> `councils.id` | |
| `troopNumber` | VARCHAR(50) | Not Null | |
| `troopType` | VARCHAR(20) | Not Null | Enum: `daisy`, `brownie`, `junior`, `cadette`, `senior`, `ambassador`, `multi-level` |
| `leaderId` | UUID | **FK** -> `users.id` | Primary Troop Leader |
| `cookieLeaderId` | UUID | **FK** -> `users.id` | Cookie Manager |
| `season` | VARCHAR(20) | | Current active season |
| `timezone` | VARCHAR(50) | Default: 'America/New_York' | |

### `troop_members`
Linking table between Users and Troops. Defines roles within a troop.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | **PK** | |
| `troopId` | UUID | **FK** -> `troops.id` | |
| `userId` | UUID | **FK** -> `users.id` | |
| `role` | VARCHAR(20) | Default: 'member' | Enum: `member`, `co-leader`, `assistant`, `parent` |
| `scoutLevel` | VARCHAR(20) | | e.g., 'Junior', 'Cadette' |
| `linkedParentId` | UUID | **FK** -> `users.id` | Parent account (if user is minor) |
| `linkedScoutId` | UUID | **FK** -> `users.id` | Scout account (if user is parent) |
| `status` | VARCHAR(20) | Default: 'active' | Enum: `active`, `inactive`, `transferred` |

### `troop_goals`
Financial or activity goals for the troop.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | **PK** | |
| `troopId` | UUID | **FK** -> `troops.id` | |
| `goalType` | VARCHAR(20) | Not Null | Enum: `boxes_sold`, `revenue`, `participation`, `events`, `donations` |
| `targetAmount` | NUMERIC | Not Null | |
| `currentAmount` | NUMERIC | Default: 0 | |
| `status` | VARCHAR(20) | Default: 'in_progress' | |

### `troop_invitations`
Pending invites for new members.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | **PK** | |
| `troopId` | UUID | **FK** -> `troops.id` | |
| `invitedEmail` | VARCHAR(255) | Not Null | |
| `token` | VARCHAR(255) | Unique | Invitation token |
| `expiresAt` | TIMESTAMP | Not Null | |
| `status` | VARCHAR(20) | Default: 'pending' | |

---

## Cookie Catalog

### `seasons`
Defines sales seasons (e.g., "2026").

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | **PK** | |
| `year` | VARCHAR(10) | Unique, Not Null | |
| `name` | VARCHAR(100) | Not Null | e.g., "2026 Cookie Season" |
| `isActive` | BOOLEAN | Default: `false` | Only one active at a time |
| `pricePerBox` | NUMERIC | Default: 6.00 | Global default price |

### `cookie_products`
The catalog of cookies available for a specific season.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | **PK** | |
| `season` | VARCHAR(10) | Not Null | |
| `cookieName` | VARCHAR(100) | Not Null | e.g., "Thin Mints" |
| `shortName` | VARCHAR(50) | | e.g., "TM" |
| `pricePerBox` | NUMERIC | Not Null | Override global price if needed |
| `boxesPerCase` | INTEGER | Default: 12 | |
| `isActive` | BOOLEAN | Default: `true` | |

### `cookie_nutrition`
Nutritional info for products.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | **PK** | |
| `productId` | UUID | **FK** -> `cookie_products.id` | One-to-One |
| `calories` | INTEGER | | |
| `totalFat` | NUMERIC | | |
| `ingredients` | TEXT | | |

---

## Core Data (Sales & Inventory)

### `scout_inventory` (New V3)
Normalized inventory tracking per scout. Replaces legacy `profile` columns.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | **PK** | |
| `userId` | UUID | **FK** -> `users.id` | |
| `productId` | UUID | **FK** -> `cookie_products.id` | |
| `quantity` | INTEGER | Default: 0 | |
| `lastUpdated` | TIMESTAMP | Default: `now()` | |

### `sales`
Individual transaction records.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | **PK** | |
| `userId` | UUID | **FK** -> `users.id` | Seller |
| `productId` | UUID | **FK** -> `cookie_products.id` | **New V3 Link** |
| `customerName` | VARCHAR(255) | Not Null | |
| `cookieType` | VARCHAR(100) | | **DEPRECATED** (Use `productId`) |
| `quantity` | INTEGER | Not Null | |
| `amountCollected`| NUMERIC | Default: 0 | |
| `amountDue` | NUMERIC | Default: 0 | |
| `saleType` | VARCHAR(20) | Default: 'individual'| 'individual' or 'booth' |
| `orderStatus` | VARCHAR(50) | | |
| `season` | VARCHAR(10) | | |

### `profile`
User-specific settings and goals.
*Note: Inventory columns (`inventoryThinMints`, etc.) are now DEPRECATED in favor of `scout_inventory`.*

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | **PK** | |
| `userId` | UUID | **FK** -> `users.id` | One-to-One |
| `scoutName` | VARCHAR(255) | | Display name |
| `goalBoxes` | INTEGER | Default: 0 | Personal goal |
| `inventory...` | INTEGER | | **DEPRECATED** (Legacy flat columns) |

### `donations`
Direct monetary donations (e.g., "Cookie Share").

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | **PK** | |
| `userId` | UUID | **FK** -> `users.id` | Scout receiving donation |
| `amount` | NUMERIC | Not Null | |
| `donorName` | VARCHAR(255) | Not Null | |
| `date` | DATE | Not Null | |

### `events`
Cookie Booths or Troop Events.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | **PK** | |
| `userId` | UUID | **FK** -> `users.id` | Creator/Owner |
| `troopId` | UUID | **FK** -> `troops.id` | Associated Troop |
| `eventName` | VARCHAR(255) | Not Null | |
| `eventDate` | DATE | Not Null | |
| `initialBoxes` | INTEGER | | Inventory start |
| `remainingBoxes` | INTEGER | | Inventory end |

### `payment_methods`
User-defined payment links (Venmo, PayPal, etc).

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | **PK** | |
| `userId` | UUID | **FK** -> `users.id` | |
| `name` | VARCHAR(100) | Not Null | e.g., "Mom's Venmo" |
| `url` | TEXT | Not Null | |
| `isEnabled` | BOOLEAN | Default: `true` | |