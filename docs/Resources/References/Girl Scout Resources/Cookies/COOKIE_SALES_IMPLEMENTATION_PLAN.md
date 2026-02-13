# Cookie Sales Implementation Plan

**Based on**: Cookie Sales Quick Reference.md, 2024-2025 Cookie Manager Manual, Booth Inventory Sheet, Interactive Sales (Goal Getter Order Card)
**Status**: IMPLEMENTED - All Phases Complete
**Date**: 2026-02-11 (Originally drafted 2026-02-10, implemented 2026-02-11)
**Existing Phase 4 Plan**: `/data/ASM/docs/v2 Implementation/PHASE_4_BOOTH_INVENTORY.md`

---

## Summary

The Cookie Sales Quick Reference identifies several features needed to properly support cookie (and product) sales in ASM. This plan maps each requirement to concrete implementation steps, building on what already exists in the codebase and aligning with the Phase 4 plan where applicable.

### What Already Exists
- `cookie_products` table with 9 cookie types, price, and season fields
- `scout_inventory` table (normalized, created but not yet used by the app)
- `sales` table with `productId` FK (added in migration 003, not yet used)
- `seasons` table for managing cookie seasons
- Hardcoded inventory columns on `profile` table (9 cookie types)
- Individual sales API (CRUD at `/api/sales`)
- Troop sales reporting (`GET /api/troop/:troopId/sales`)
- Events/booth tracking (basic - `events` table with boxes/cases counts)
- Troop goals system (CRUD with 5 goal types)
- Individual goals on profile (goalBoxes, goalAmount)
- Phase 4 detailed plan for booth events, shifts, inventory, payments, fulfillment

### What Needs to Be Built
The Quick Reference calls out these key gaps (numbered for tracking):

1. **Configurable cookie products per council/baker** - Cookie names and flavors vary by bakery (ABC vs Little Brownie) and change annually
2. **Cookie Dashboard** - A dedicated view for cookie sales (org-aware: "Cookies" for GS, "Popcorn" for SA)
3. **Service Unit Cookie Manager (SUCM) role** - New troop role with dedicated permissions
4. **Sales path tracking** - Individual (in-person, digital-delivered, digital-shipped, donation), Troop Booth, Family Booth, Council Booth
5. **Goal Getter Order Card** - Digital version of the paper order card for individual sales
6. **Booth Inventory Sheet** - Digital version of the paper booth inventory sheet
7. **Booth type distinctions** - Troop Booth (2-5 girls), Family Booth (1 girl), Council Booth
8. **Multi-payment booth reconciliation** - Cash, checks, credit cards, Venmo, PayPal, digital payments + starting bank

---

## Implementation Phases

This plan is organized into 4 sub-phases that can be implemented incrementally. Each builds on the previous.

---

### Phase A: Cookie Product Configuration (Foundation) - ✅ COMPLETE

**Goal**: Make cookie products configurable per organization/baker so troops can manage their product lineup each season.
**Status**: All steps implemented. Bakers table seeded, product management API live, normalized inventory working, sales linked to products.

#### A.1 - Baker Support

Add baker information to the organization/product system.

**Database Changes:**
```sql
-- Add baker field to cookie_products (or create a baker reference)
ALTER TABLE cookie_products ADD COLUMN IF NOT EXISTS "bakerId" UUID;
ALTER TABLE cookie_products ADD COLUMN IF NOT EXISTS "organizationId" UUID
    REFERENCES scout_organizations(id);

-- Bakers table
CREATE TABLE IF NOT EXISTS bakers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "bakerName" VARCHAR(100) NOT NULL,      -- 'Little Brownie Bakers', 'ABC Bakers'
    "bakerCode" VARCHAR(20) NOT NULL UNIQUE, -- 'lbb', 'abc'
    website VARCHAR(255),
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE cookie_products ADD CONSTRAINT fk_cookie_products_baker
    FOREIGN KEY ("bakerId") REFERENCES bakers(id);
```

**Seed Data:**
- Little Brownie Bakers (lbb): Adventurefuls, Lemon-Ups, Trefoils, Do-si-dos, Samoas, Tagalongs, Thin Mints, Exploremores/S'mores, Toffee-tastic
- ABC Bakers (abc): Toast-Yay!, Lemonades, Shortbread, Peanut Butter Patties, Caramel deLites, Peanut Butter Sandwich, Thin Mints, S'mores, Toffee-tastic

> **Note from Quick Reference**: "Each council has different cookies based on which bakery it uses. So the cookies will need to be tailored and adjusted each year."

#### A.2 - Cookie Product Management API

Allow leaders/admins to manage the cookie product lineup for their troop's season.

**New Endpoints:**
```
GET    /api/troop/:troopId/products              - List products for current season
POST   /api/troop/:troopId/products              - Add product to troop's season lineup
PUT    /api/troop/:troopId/products/:productId   - Update product (price, active status)
DELETE /api/troop/:troopId/products/:productId   - Remove product from lineup

GET    /api/seasons                               - List available seasons
POST   /api/seasons                               - Create new season (admin only)
PUT    /api/seasons/:seasonId                      - Update season dates/status
```

**Privileges**: `manage_fundraisers` (existing, currently marked `future: true` - activate it)

#### A.3 - Migrate to Normalized Inventory

Switch the app from hardcoded profile inventory columns to the `scout_inventory` table.

**Changes:**
1. Update `GET /api/profile` to also return inventory from `scout_inventory` joined with `cookie_products`
2. Update `PUT /api/profile` inventory fields to write to `scout_inventory` instead of profile columns
3. Update frontend `displayInventory()` / `saveInventory()` to use product-based data
4. Migrate existing profile inventory data to `scout_inventory` rows
5. Keep profile columns for backward compatibility but deprecate them

#### A.4 - Link Sales to Products

Update the sales system to use `productId` (already column exists) instead of `cookieType` text.

**Changes:**
1. Update `POST /api/sales` to accept `productId` (keep `cookieType` as fallback)
2. Update `GET /api/sales` to join `cookie_products` for product details
3. Update `GET /api/troop/:troopId/sales` to group by `productId` instead of `cookieType`
4. Update frontend sales form to use a product dropdown populated from `/api/troop/:troopId/products`

---

### Phase B: Cookie Dashboard & Sales Paths - ✅ COMPLETE

**Goal**: Create the dedicated Cookie Dashboard view and support all sales path types.
**Status**: Cookie Dashboard tab added to sidebar with dynamic labeling. All sales path types supported. Goal Getter Order Card implemented. SUCM role added to privilege system.

#### B.1 - Cookie Dashboard View

A new navigation tab that displays cookie-specific data. Per the Quick Reference:
> "A new 'Cookie' Dashboard may be created for this. This can display the individual sales and Troop sales based on permission level."
> "While Girl Scouts sell cookies, Scouting America/Cub Scouts sell popcorn. So this 'cookie' dashboard should only be displayed for users in the Girl Scout Troops. A placeholder 'Popcorn' name can be used for the Scouting America/Cub Scouts"

**Frontend Changes:**
- Add a 7th navigation tab: "Cookies" (or "Popcorn" for SA troops, or "Products" as generic)
- Tab label dynamically set based on the user's troop organization:
  - `gsusa` -> "Cookies"
  - `sa_cub` / `sa_bsa` -> "Popcorn"
  - fallback -> "Products"
- Dashboard sections:
  1. **My Sales Summary** - Total boxes sold, revenue, goal progress (ring chart)
  2. **Product Breakdown** - Sales per cookie type (bar chart with cookie colors)
  3. **My Inventory** - Current on-hand inventory per product (moved from Profile tab)
  4. **Quick Sale Entry** - Streamlined form for recording a sale (replaces current Individual Sales approach)
  5. **Recent Sales** - Last 10 sales with edit/delete
- Troop-level sections (visible with `view_troop_sales` privilege):
  6. **Troop Sales Summary** - Total troop boxes, revenue, troop goal progress
  7. **Scout Leaderboard** - Top sellers (uses existing leaderboard endpoint)
  8. **Troop Inventory** - Aggregate inventory across all scouts (future Phase C)

**Privilege Mapping:**
- My Sales/Inventory sections: `view_sales` (default S for member)
- Troop sections: `view_troop_sales` (default T for troop_leader, none for member)

#### B.2 - Sales Path Types

Expand the `saleType` field to support all paths from the Quick Reference:

**Current values**: `individual`, `event`

**New values**:
| saleType Value | Description | Goal Credit |
|---|---|---|
| `individual_inperson` | In-person individual sale (door-to-door, order card) | Scout |
| `individual_digital_delivered` | Digital Cookie - ordered online, delivered in person | Scout |
| `individual_digital_shipped` | Digital Cookie - ordered online, shipped directly | Scout |
| `individual_donation` | Cookie donation (bought for charity distribution) | Scout |
| `booth_troop` | Troop booth sale | Split among shift workers |
| `booth_family` | Family booth sale (1 scout + parent) | Scout |
| `booth_council` | Council booth sale | Split among shift workers |

**Database Change:**
```sql
-- No schema change needed - saleType is already VARCHAR(20), expand to VARCHAR(50)
ALTER TABLE sales ALTER COLUMN "saleType" TYPE VARCHAR(50);
```

**API Changes:**
- Update `POST /api/sales` to validate new saleType values
- Update sales reporting queries to group/filter by sale type
- Add `saleType` filter to `GET /api/sales` and `GET /api/troop/:troopId/sales`

#### B.3 - Goal Getter Order Card (Digital)

Digital version of the paper "Goal Getter Order Card" from the Interactive Sales PDF.

**Features:**
- Scout's name, troop number, personal goal displayed at top
- Grid of products with customer rows (name, contact, quantities per product)
- Running totals per product and overall
- "Check When Paid" column
- Amount due calculation
- Save/print functionality

**Implementation:**
- New section within Cookie Dashboard or standalone modal
- Data stored as individual sales records (one per customer per product)
- `orderNumber` field groups sales from the same order card session
- Print-friendly CSS for paper output

#### B.4 - SUCM Role

Add "Service Unit Cookie Manager" to the roles and permissions system.

**Changes:**
1. Add `sucm` to `VALID_TROOP_ROLES` in server.js
2. Add `sucm` to `ROLE_PRIVILEGE_DEFAULTS` in privileges.js with appropriate scopes:
   - `view_roster`: T, `view_troop_sales`: T, `view_events`: T
   - `manage_members`: none, `manage_troop_settings`: none
   - `view_goals`: T, `manage_goals`: T
   - `view_sales`: T, `record_sales`: T
   - `manage_fundraisers`: T
   - All inventory/booth privileges: T
3. Add to frontend role dropdown in member management
4. Update `cookie_leader` role defaults to also have full cookie management access

> **From Quick Reference**: "The person in charge of the cookies is the Service Unit Cookie Manager (SUCM). This title will need to be added to the permissions matrix."

---

### Phase C: Booth Sales System - ✅ COMPLETE

**Goal**: Implement booth event tracking with inventory, shifts, and payment reconciliation. This aligns directly with Phase 4 of the existing implementation plan.
**Status**: Full booth lifecycle implemented (planning → scheduled → in_progress → reconciling → completed). Shifts with checkin/checkout, inventory tracking, multi-payment reconciliation all working.

> **Note**: Phase 4 already has a comprehensive plan at `/data/ASM/docs/v2 Implementation/PHASE_4_BOOTH_INVENTORY.md`. This section summarizes what's needed specifically for the cookie program and references that plan.

#### C.1 - Booth Event Types

The Quick Reference and Cookie Manager Manual define 3 booth types:

| Type | Description | Scouts | Adults Required | Inventory Source |
|---|---|---|---|---|
| **Troop Booth** | 2-5 Girl Scouts at a location | 2-5 | 2 CORI'd, registered adults | Troop stock |
| **Family Booth** | 1 girl + parent/guardian | 1 | 1 registered parent/guardian | Scout's personal stock |
| **Council Booth** | Set up by council, troops sign up | Varies | 2 CORI'd, registered adults | Troop stock |

**Implementation**: Use Phase 4's `booth_events` table with `eventType` values: `troop`, `family`, `council`

#### C.2 - Booth Inventory Sheet (Digital)

Digital version of the paper Booth Inventory Sheet from the PDF. This is the core tracking tool for each booth event.

**Data captured per booth event per product:**
| Field | Description |
|---|---|
| Starting Inventory | Boxes brought to booth |
| Packages Sold | Tally of boxes sold (multiple rows for tally marks) |
| Donations | Boxes donated at booth |
| Ending Inventory | Boxes remaining after booth |
| Total Packages Sold | Calculated: Starting - Ending |

**Additional data captured:**
- Girl Scouts on duty (name, start time, end time)
- Adult supervisors
- Cash reconciliation:
  - Ending Cash - Starting Cash = Total Cash Collected
  - Total Cash Collected + Credit/PayPal/Venmo + Checks = Total Collected
- Notes field
- Adult signature (future: digital signature)

**Implementation**: Phase 4's `booth_inventory` + `booth_payments` + `booth_shifts` tables cover this. The UI should mirror the paper form layout for familiarity.

#### C.3 - Booth Payment Reconciliation

From the Booth Inventory Sheet, payment tracking includes:

| Payment Type | Description |
|---|---|
| Starting Cash | Change bank brought to booth |
| Ending Cash | All cash at end of booth |
| Cash Collected | Ending Cash - Starting Cash |
| Credit cards, PayPal, Venmo | Digital payments |
| Checks | Paper checks received |
| **Total Collected** | Sum of all payment types |

**Reconciliation Logic:**
```
Expected Revenue = Total Packages Sold x Price Per Package
Actual Revenue   = Total Collected (all payment types)
Variance         = Actual - Expected
```

**Implementation**: Phase 4's `booth_payments` table + `startingBank` field on `booth_events`. Add reconciliation endpoint:
```
POST /api/troop/:troopId/booths/:boothId/reconcile
```

#### C.4 - Booth Shift Tracking

From the Booth Inventory Sheet, track which scouts worked which time slots.

**Data per shift:**
- Girl Scout name (linked to user)
- Start time
- End time
- Adult supervisors present

**Business rules from the manual:**
- Troop Booth: Min 2 girls, max 5 girls at any time
- Family Booth: Exactly 1 girl + parent/guardian
- 2 CORI'd registered adults required for troop/council booths
- Schedule shorter shifts for larger troops so every girl participates

**Implementation**: Phase 4's `booth_shifts` table. Add validation for min/max scouts per booth type.

---

### Phase D: Troop Proceeds & Season Management - ✅ COMPLETE

**Goal**: Track troop financial proceeds from cookie sales and manage cookie season lifecycle.
**Status**: troop_season_config table with bonus tracking, proceeds calculation endpoint, season milestones CRUD all implemented.

#### D.1 - Troop Proceeds Tracking

From the Cookie Manager Manual, troops earn proceeds based on packages sold:

| Proceeds Type | Amount | Condition |
|---|---|---|
| Base Troop Proceeds | $0.75/package | All troops |
| Initial Order Commitment Bonus | +$0.10/package | 125 pkgs/girl initial order, no returns |
| Fall Product Program PGA Bonus | +$0.10/package | $300+ per-girl-average in Fall Product |
| Opt-Out Bonus | +$0.10/package | Junior+ troops opt out of girl rewards |
| **Maximum** | **$1.05/package** | All bonuses earned |

**Database Changes:**
```sql
CREATE TABLE IF NOT EXISTS troop_season_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "troopId" UUID NOT NULL REFERENCES troops(id),
    season VARCHAR(10) NOT NULL,
    "baseProceedsRate" NUMERIC(5,3) DEFAULT 0.750,
    "initialOrderBonus" BOOLEAN DEFAULT false,
    "fallProductBonus" BOOLEAN DEFAULT false,
    "optOutBonus" BOOLEAN DEFAULT false,
    "effectiveProceedsRate" NUMERIC(5,3) DEFAULT 0.750,
    "initialOrderDate" DATE,
    "initialOrderQty" INTEGER,
    notes TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("troopId", season)
);
```

**API Endpoints:**
```
GET  /api/troop/:troopId/season-config       - Get current season config
PUT  /api/troop/:troopId/season-config       - Update season bonuses
GET  /api/troop/:troopId/proceeds            - Calculate total proceeds
```

#### D.2 - Cookie Season Calendar

From the manual's "Important Dates" page, key dates for the cookie season.

**Implementation:**
- Seed season milestone events into the events/calendar system
- Allow troop leaders to view key dates on the Calendar tab
- These are informational - no automation needed initially

**Example milestones for a season:**
- Order Card taking begins
- Cookie Program begins
- ACH withdrawal dates
- Last day to return cookies
- Cookie Program ends
- Girl Rewards due

---

## Implementation Priority & Dependencies

```
Phase A (Foundation) ──────────────────────────────────────
  A.1 Baker Support              [No dependencies]
  A.2 Product Management API     [Depends on A.1]
  A.3 Normalized Inventory       [Depends on A.2]
  A.4 Link Sales to Products     [Depends on A.2]

Phase B (Dashboard & Sales) ───────────────────────────────
  B.1 Cookie Dashboard View      [Depends on A.3, A.4]
  B.2 Sales Path Types           [No dependencies]
  B.3 Goal Getter Order Card     [Depends on B.1]
  B.4 SUCM Role                  [No dependencies]

Phase C (Booth System) ────────────────────────────────────
  C.1 Booth Event Types          [Depends on A.2]
  C.2 Booth Inventory Sheet      [Depends on C.1, A.3]
  C.3 Booth Payment Reconcile    [Depends on C.1]
  C.4 Booth Shift Tracking       [Depends on C.1]

Phase D (Proceeds & Season) ───────────────────────────────
  D.1 Troop Proceeds Tracking    [Depends on A.4]
  D.2 Cookie Season Calendar     [No dependencies]
```

## Recommended Build Order

| Step | Task | Estimated Scope |
|---|---|---|
| 1 | A.1 + A.2: Bakers + Product Management | Migration + 6 endpoints |
| 2 | B.4 + B.2: SUCM Role + Sales Path Types | Config + minor API update |
| 3 | A.3: Normalized Inventory migration | API refactor + frontend update |
| 4 | A.4: Link Sales to Products | API refactor + frontend update |
| 5 | B.1: Cookie Dashboard View | New frontend tab + wiring |
| 6 | B.3: Goal Getter Order Card | Frontend component |
| 7 | C.1: Booth Event Types | Migration + CRUD endpoints (Phase 4.1-4.2) |
| 8 | C.4: Booth Shift Tracking | Migration + endpoints (Phase 4.3) |
| 9 | C.2: Booth Inventory Sheet | Migration + endpoints + UI (Phase 4.4) |
| 10 | C.3: Booth Payment Reconciliation | Migration + endpoints + UI (Phase 4.5-4.6) |
| 11 | D.1: Troop Proceeds Tracking | Migration + endpoints |
| 12 | D.2: Cookie Season Calendar | Seed data + UI integration |

## Files Affected

### New Files
- `migrations/006_cookie_sales_foundation.sql` - Bakers table, product updates
- `migrations/007_booth_events.sql` - Booth events, shifts, inventory, payments (from Phase 4)
- `migrations/008_troop_season_config.sql` - Proceeds tracking

### Modified Files
- `server.js` - New endpoints for products, booths, proceeds
- `privileges.js` - SUCM role defaults, activate `manage_fundraisers`
- `auth.js` - No changes expected (privilege middleware already handles new privileges)
- `public/index.html` - Cookie Dashboard tab, order card UI, booth inventory UI
- `public/script.js` - Dashboard rendering, product-based inventory, sales forms
- `public/styles.css` - Cookie dashboard styling, order card layout, booth sheet layout
- `Dockerfile` - No changes expected (migrations already copied)

## Relationship to Phase 4

This plan incorporates and extends the Phase 4 plan:
- **Phase C** of this plan = Phase 4 sections 4.1-4.6 (booth events, shifts, inventory, payments)
- Phase 4 sections 4.7-4.11 (four-level inventory, fulfillment orders, transfers, alerts) are **deferred** as they represent advanced features beyond what the Quick Reference requires
- When Phase C is built, it should follow Phase 4's schema designs but can simplify the initial implementation (e.g., start with 2-level inventory: troop + scout, add fulfillment later)

## Open Questions

1. **ABC Baker support priority** - The Quick Reference mentions both bakers but the troop appears to use Little Brownie Bakers. Should ABC Baker products be seeded now or deferred?
  > Both Bakers should be seeding with current products,  but it is to be noted,  products might change next year.  Including the ability to manually update or pull new data next year should be accounted for.  A map of their current distribution is available in file cookies.webp. 
2. **Digital Cookie integration** - The manual references the Digital Cookie platform (digitalcookie.girlscouts.org). Is API integration desired, or just manual entry of digital sales?
  > The current code should include the ability to import csv or excel files. This was the primary method.  there is no public API to intergrate with the digital cookie platform
4. **eBudde integration** - The manual heavily references eBudde for order management. Is integration planned, or is ASM a standalone complement?
  > Standalone
6. **Girl Rewards tracking** - The manual mentions girl rewards based on sales tiers. Should ASM track reward eligibility?
    >not at this time.  Future development
7. **Booth scheduler** - The manual describes a booth scheduling process through eBudde. Should ASM replicate booth scheduling/signup functionality?
  > No.  The simple "Calendar Events"  is fine for now.


**Developer Notes**
 > The original purpose of this project was a simple sales and cookie tracking form for individual scouts.  It has since pivoted into a more troop management platform.  Many of the sales functions should already exist in the base program.  However if they are no longer needed or if the code has changed they can be removed.

---

## Implementation Completion Summary (2026-02-11)

All four phases were implemented in a single development session. Key deliverables:

### Database Tables Added
- `bakers` - Baker organizations (LBB, ABC)
- `booth_events` - Booth events with lifecycle status
- `booth_shifts` - Scout shift assignments with checkin/checkout
- `booth_inventory` - Per-product inventory per booth event
- `booth_payments` - Multi-payment type tracking per booth
- `troop_season_config` - Season proceeds configuration with bonuses
- `season_milestones` - Cookie season key dates
- `scout_inventory` - Normalized per-scout inventory (replacing profile columns)

### API Endpoints Added (~30 new endpoints)
- Cookie Dashboard: `GET /api/troop/:troopId/cookie-dashboard`
- Troop Inventory: `GET /api/troop/:troopId/inventory`
- Booth CRUD: `GET/POST/PUT/DELETE /api/troop/:troopId/booths`
- Booth Lifecycle: `POST .../start`, `.../end`, `.../close`
- Booth Shifts: `GET/POST/PUT/DELETE .../shifts` + checkin/checkout
- Booth Inventory: `GET/PUT .../inventory` + ending count
- Booth Payments: `GET/POST/PUT/DELETE .../payments`
- Reconciliation: `GET .../reconcile`
- Season Config: `GET/PUT /api/troop/:troopId/season-config`
- Proceeds: `GET /api/troop/:troopId/proceeds`
- Milestones: `GET/POST/PUT/DELETE /api/troop/:troopId/milestones`

### Frontend
- New "Cookies" sidebar tab (dynamic label based on org)
- Cookie Dashboard view with summary cards, quick sale, product breakdown, inventory, recent sales
- Goal Getter Order Card with print support
- Booth management with create/detail modals
- Booth detail tabs: Info, Shifts, Inventory, Payments, Reconcile
- Troop overview section with proceeds and milestones

### What's NOT Included (Deferred per Phase 4 plan)
- Four-level inventory system (Phase 4.7)
- Fulfillment order management (Phase 4.8)
- Inventory transfer workflows (Phase 4.9)
- Inventory reconciliation alerts (Phase 4.11)
- Booth min/max scout validation rules (C.4 business rules)
