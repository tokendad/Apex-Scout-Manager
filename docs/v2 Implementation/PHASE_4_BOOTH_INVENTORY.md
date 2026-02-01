# Phase 4: Booth Events & Inventory Management

**Status:** ⏳ PLANNED
**Timeline:** Months 6-8
**Focus:** Booth tracking and multi-level inventory
**Prerequisites:** Phase 1-3 completed

---

## Overview

Phase 4 implements comprehensive booth event tracking and a multi-level inventory management system. This is the most complex phase, handling the logistics of cookie booth sales, shift scheduling, and inventory flow from council fulfillment to scouts.

---

## Deliverables

### 4.1 Troop Booth Event Creation and Management

**Goal:** Track multi-scout booth sales events managed by the troop

**Booth Event Lifecycle:**
```
1. PLANNING    → Event created, location/date set
2. SCHEDULED   → Shifts assigned, inventory allocated
3. IN_PROGRESS → Event active, sales being recorded
4. RECONCILING → Event ended, counting inventory/money
5. COMPLETED   → Fully reconciled and closed
6. CANCELLED   → Event cancelled (optional reason)
```

**Database Schema - `booth_events` table:**
```sql
CREATE TABLE booth_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    troopId INTEGER NOT NULL,
    eventType TEXT NOT NULL,              -- 'troop' or 'family'
    scoutId INTEGER,                      -- For family booths only
    eventName TEXT NOT NULL,
    location TEXT NOT NULL,
    locationAddress TEXT,
    locationNotes TEXT,                   -- "Back entrance", "Table 3", etc.
    startDateTime TEXT NOT NULL,
    endDateTime TEXT NOT NULL,
    startingBank REAL DEFAULT 0,          -- Cash for making change
    status TEXT DEFAULT 'planning',
    weatherNotes TEXT,
    actualStartTime TEXT,
    actualEndTime TEXT,
    notes TEXT,
    createdBy INTEGER,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT,
    FOREIGN KEY (troopId) REFERENCES troops(id),
    FOREIGN KEY (scoutId) REFERENCES users(id),
    FOREIGN KEY (createdBy) REFERENCES users(id)
);

CREATE INDEX idx_booth_events_troop ON booth_events(troopId);
CREATE INDEX idx_booth_events_date ON booth_events(startDateTime);
CREATE INDEX idx_booth_events_status ON booth_events(status);
```

**API Endpoints - Booth Events:**
```
# Event CRUD
GET    /api/troops/:tid/booths              - List troop booth events
POST   /api/troops/:tid/booths              - Create booth event
GET    /api/troops/:tid/booths/:bid         - Get booth event details
PUT    /api/troops/:tid/booths/:bid         - Update booth event
DELETE /api/troops/:tid/booths/:bid         - Cancel booth event

# Event Lifecycle
POST   /api/troops/:tid/booths/:bid/start   - Start event (set to IN_PROGRESS)
POST   /api/troops/:tid/booths/:bid/end     - End event (set to RECONCILING)
POST   /api/troops/:tid/booths/:bid/close   - Close event (set to COMPLETED)
```

### 4.2 Family Booth Event Tracking

**Goal:** Track individual scout/family booth sales

**Differences from Troop Booth:**
| Aspect | Troop Booth | Family Booth |
|--------|-------------|--------------|
| Management | Troop leader | Scout/Parent |
| Shifts | Multiple scouts rotate | Single scout/family |
| Inventory | From troop stock | From scout's personal stock |
| Credit | Split among shift workers | 100% to scout |
| Approval | May require leader approval | Self-managed |

**Family Booth Features:**
- Scout creates their own booth event
- Uses scout's personal inventory
- All sales credit goes to scout
- Parent can create on behalf of minor
- Optional leader notification/approval

**API Endpoints - Family Booths:**
```
GET    /api/my/booths                       - List my family booth events
POST   /api/my/booths                       - Create family booth event
GET    /api/my/booths/:bid                  - Get booth details
PUT    /api/my/booths/:bid                  - Update booth
DELETE /api/my/booths/:bid                  - Cancel booth
```

### 4.3 Booth Shift Scheduling and Scout Assignment

**Goal:** Manage rotating shifts for troop booth events

**Database Schema - `booth_shifts` table:**
```sql
CREATE TABLE booth_shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    boothEventId INTEGER NOT NULL,
    scoutId INTEGER NOT NULL,
    parentId INTEGER,                     -- Parent working with scout
    startTime TEXT NOT NULL,
    endTime TEXT NOT NULL,
    role TEXT DEFAULT 'seller',           -- seller, cashier, setup, cleanup
    status TEXT DEFAULT 'scheduled',      -- scheduled, confirmed, completed, no_show
    checkinTime TEXT,
    checkoutTime TEXT,
    boxesCredited INTEGER DEFAULT 0,      -- Boxes credited to this scout
    notes TEXT,
    FOREIGN KEY (boothEventId) REFERENCES booth_events(id) ON DELETE CASCADE,
    FOREIGN KEY (scoutId) REFERENCES users(id),
    FOREIGN KEY (parentId) REFERENCES users(id)
);

CREATE INDEX idx_booth_shifts_event ON booth_shifts(boothEventId);
CREATE INDEX idx_booth_shifts_scout ON booth_shifts(scoutId);
```

**Shift Management Features:**
- Create shift slots with time ranges
- Assign scouts to shifts
- Optional parent accompaniment
- Shift confirmation (scout/parent confirms)
- Check-in/check-out tracking
- No-show handling
- Credit allocation per shift

**API Endpoints - Shifts:**
```
GET    /api/troops/:tid/booths/:bid/shifts         - List shifts
POST   /api/troops/:tid/booths/:bid/shifts         - Create shift
PUT    /api/troops/:tid/booths/:bid/shifts/:sid    - Update shift
DELETE /api/troops/:tid/booths/:bid/shifts/:sid    - Remove shift

POST   /api/troops/:tid/booths/:bid/shifts/:sid/checkin   - Scout checks in
POST   /api/troops/:tid/booths/:bid/shifts/:sid/checkout  - Scout checks out
```

### 4.4 Booth Inventory Tracking (Start/End/Sold)

**Goal:** Track cookie inventory throughout booth event

**Database Schema - `booth_inventory` table:**
```sql
CREATE TABLE booth_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    boothEventId INTEGER NOT NULL,
    cookieProductId INTEGER NOT NULL,
    startingQty INTEGER DEFAULT 0,        -- Boxes at start
    endingQty INTEGER,                    -- Boxes at end (null until counted)
    soldQty INTEGER,                      -- Calculated: starting - ending
    damagedQty INTEGER DEFAULT 0,         -- Damaged/unsellable
    notes TEXT,
    FOREIGN KEY (boothEventId) REFERENCES booth_events(id) ON DELETE CASCADE,
    FOREIGN KEY (cookieProductId) REFERENCES cookie_products(id)
);

CREATE INDEX idx_booth_inventory_event ON booth_inventory(boothEventId);
```

**Inventory Flow:**
```
1. PRE-EVENT:
   - Leader sets starting inventory per cookie type
   - System pulls from troop inventory (or creates allocation)

2. DURING EVENT:
   - Sales recorded (reduces inventory automatically OR manually counted)
   - Damaged cookies recorded

3. POST-EVENT:
   - Ending inventory counted physically
   - System calculates sold = starting - ending - damaged
   - Reconcile with payment records
   - Return unsold to troop inventory
```

**API Endpoints - Booth Inventory:**
```
GET    /api/troops/:tid/booths/:bid/inventory       - Get inventory status
PUT    /api/troops/:tid/booths/:bid/inventory       - Update inventory (bulk)
PUT    /api/troops/:tid/booths/:bid/inventory/:iid  - Update single item
POST   /api/troops/:tid/booths/:bid/inventory/count - Record ending count
```

### 4.5 Multi-Payment Type Tracking for Booths

**Goal:** Track all payment types received at booth events

**Database Schema - `booth_payments` table:**
```sql
CREATE TABLE booth_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    boothEventId INTEGER NOT NULL,
    paymentType TEXT NOT NULL,            -- cash, check, digital_cookie, venmo, paypal, square, other
    amount REAL NOT NULL,
    referenceNumber TEXT,                 -- Check number, transaction ID, etc.
    notes TEXT,
    recordedBy INTEGER,
    recordedAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (boothEventId) REFERENCES booth_events(id) ON DELETE CASCADE,
    FOREIGN KEY (recordedBy) REFERENCES users(id)
);

CREATE INDEX idx_booth_payments_event ON booth_payments(boothEventId);
```

**Payment Types:**
| Type | Description | Reference Field |
|------|-------------|-----------------|
| `cash` | Cash collected | N/A |
| `check` | Personal checks | Check number |
| `digital_cookie` | Girl Scout Digital Cookie | Order ID |
| `venmo` | Venmo payment | Transaction ID |
| `paypal` | PayPal payment | Transaction ID |
| `square` | Square payment | Transaction ID |
| `zelle` | Zelle payment | Confirmation |
| `other` | Other payment method | Description |

**API Endpoints - Payments:**
```
GET    /api/troops/:tid/booths/:bid/payments        - List payments
POST   /api/troops/:tid/booths/:bid/payments        - Record payment
PUT    /api/troops/:tid/booths/:bid/payments/:pid   - Update payment
DELETE /api/troops/:tid/booths/:bid/payments/:pid   - Remove payment
```

### 4.6 Starting Bank (Cash for Change) Management

**Goal:** Track starting cash bank separate from sales revenue

**Starting Bank Workflow:**
```
1. Leader sets starting bank amount (e.g., $50 in change)
2. Starting bank recorded in booth_events.startingBank
3. During event, all cash goes into one pool
4. At end, total cash counted
5. Revenue = Total Cash - Starting Bank
6. Starting bank returned to troop funds
```

**Reconciliation Formula:**
```
Expected Revenue = (Boxes Sold × Price Per Box)
Actual Revenue = Cash + Checks + Digital Payments - Starting Bank
Variance = Actual Revenue - Expected Revenue

If Variance > 0: Overage (tips, rounding up)
If Variance < 0: Shortage (missing money, theft, error)
If Variance = 0: Perfect reconciliation
```

### 4.7 Four-Level Inventory System

**Goal:** Track cookies at multiple levels throughout the supply chain

**Inventory Levels:**
```
Level 1: FULFILLMENT (Council)
    ↓ Order placed, cookies received
Level 2: TROOP INVENTORY
    ↓ Allocated to booth or scout
Level 3: BOOTH INVENTORY (for events)
    ↓ Sold or returned
Level 4: SCOUT PERSONAL INVENTORY
    ↓ Sold to customers
SOLD (end state)
```

**Database Schema - `inventory_balances` table:**
```sql
CREATE TABLE inventory_balances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    troopId INTEGER NOT NULL,
    userId INTEGER,                       -- NULL for troop-level inventory
    boothEventId INTEGER,                 -- NULL unless booth-specific
    inventoryType TEXT NOT NULL,          -- troop, scout_personal, booth
    cookieProductId INTEGER NOT NULL,
    quantity INTEGER DEFAULT 0,
    lastUpdated TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (troopId) REFERENCES troops(id),
    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (boothEventId) REFERENCES booth_events(id),
    FOREIGN KEY (cookieProductId) REFERENCES cookie_products(id),
    UNIQUE(troopId, userId, boothEventId, inventoryType, cookieProductId)
);

CREATE INDEX idx_inventory_balances_troop ON inventory_balances(troopId);
CREATE INDEX idx_inventory_balances_user ON inventory_balances(userId);
CREATE INDEX idx_inventory_balances_type ON inventory_balances(inventoryType);
```

**Database Schema - `inventory_transactions` table:**
```sql
CREATE TABLE inventory_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    troopId INTEGER NOT NULL,
    userId INTEGER,
    boothEventId INTEGER,
    cookieProductId INTEGER NOT NULL,
    quantity INTEGER NOT NULL,            -- Positive = add, Negative = remove
    transactionType TEXT NOT NULL,        -- received, sold, damaged, transferred, allocated, returned
    fromInventoryType TEXT,               -- Source inventory type
    toInventoryType TEXT,                 -- Destination inventory type
    fromUserId INTEGER,                   -- Source user (for transfers)
    toUserId INTEGER,                     -- Destination user (for transfers)
    relatedOrderId INTEGER,               -- Link to fulfillment order
    relatedSaleId INTEGER,                -- Link to sale record
    notes TEXT,
    recordedBy INTEGER,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (troopId) REFERENCES troops(id),
    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (boothEventId) REFERENCES booth_events(id),
    FOREIGN KEY (cookieProductId) REFERENCES cookie_products(id),
    FOREIGN KEY (recordedBy) REFERENCES users(id)
);

CREATE INDEX idx_inventory_transactions_troop ON inventory_transactions(troopId);
CREATE INDEX idx_inventory_transactions_type ON inventory_transactions(transactionType);
CREATE INDEX idx_inventory_transactions_date ON inventory_transactions(timestamp);
```

**API Endpoints - Inventory:**
```
# Balance queries
GET    /api/troops/:tid/inventory                   - Troop inventory summary
GET    /api/troops/:tid/inventory/scouts            - All scouts' inventory
GET    /api/my/inventory                            - My personal inventory

# Transactions
POST   /api/troops/:tid/inventory/receive           - Receive from fulfillment
POST   /api/troops/:tid/inventory/allocate          - Allocate to scout/booth
POST   /api/troops/:tid/inventory/transfer          - Transfer between scouts
POST   /api/troops/:tid/inventory/return            - Return to troop stock
POST   /api/troops/:tid/inventory/damage            - Record damaged cookies

# History
GET    /api/troops/:tid/inventory/history           - Transaction history
GET    /api/my/inventory/history                    - My inventory history
```

### 4.8 Fulfillment Order Management

**Goal:** Track orders placed with council fulfillment

**Database Schema - `fulfillment_orders` table:**
```sql
CREATE TABLE fulfillment_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    troopId INTEGER NOT NULL,
    orderedBy INTEGER NOT NULL,           -- Cookie leader who placed order
    orderNumber TEXT,                     -- External order reference
    orderDate TEXT DEFAULT CURRENT_TIMESTAMP,
    expectedDeliveryDate TEXT,
    actualDeliveryDate TEXT,
    deliveryLocation TEXT,
    status TEXT DEFAULT 'draft',          -- draft, submitted, confirmed, shipped, delivered, cancelled
    totalBoxes INTEGER DEFAULT 0,
    totalCost REAL DEFAULT 0,
    notes TEXT,
    FOREIGN KEY (troopId) REFERENCES troops(id),
    FOREIGN KEY (orderedBy) REFERENCES users(id)
);

CREATE INDEX idx_fulfillment_orders_troop ON fulfillment_orders(troopId);
CREATE INDEX idx_fulfillment_orders_status ON fulfillment_orders(status);
```

**Database Schema - `fulfillment_order_items` table:**
```sql
CREATE TABLE fulfillment_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orderId INTEGER NOT NULL,
    cookieProductId INTEGER NOT NULL,
    quantityOrdered INTEGER NOT NULL,     -- Boxes ordered
    quantityReceived INTEGER,             -- Boxes actually received
    unitCost REAL,                        -- Cost per box from council
    notes TEXT,
    FOREIGN KEY (orderId) REFERENCES fulfillment_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (cookieProductId) REFERENCES cookie_products(id)
);

CREATE INDEX idx_fulfillment_items_order ON fulfillment_order_items(orderId);
```

**Fulfillment Order Workflow:**
```
1. DRAFT      → Cookie leader creates order, adds items
2. SUBMITTED  → Order sent to council (manual process)
3. CONFIRMED  → Council confirms order
4. SHIPPED    → Cookies in transit
5. DELIVERED  → Cookies received, inventory updated
6. CANCELLED  → Order cancelled (before delivery)
```

**API Endpoints - Fulfillment:**
```
GET    /api/troops/:tid/orders                      - List fulfillment orders
POST   /api/troops/:tid/orders                      - Create new order
GET    /api/troops/:tid/orders/:oid                 - Get order details
PUT    /api/troops/:tid/orders/:oid                 - Update order
DELETE /api/troops/:tid/orders/:oid                 - Cancel order

PUT    /api/troops/:tid/orders/:oid/submit          - Submit order
PUT    /api/troops/:tid/orders/:oid/receive         - Mark as received
```

### 4.9 Inventory Transfer Workflows

**Goal:** Move cookies between inventory levels

**Transfer Types:**
| From | To | Initiated By | Use Case |
|------|-----|--------------|----------|
| Troop | Scout | Leader | Give scout cookies to sell |
| Troop | Booth | Leader | Allocate for booth event |
| Scout | Scout | Leader | Transfer between scouts |
| Scout | Troop | Leader/Scout | Return unsold cookies |
| Booth | Troop | Leader | Return unsold after event |
| Booth | Scout | Leader | Credit booth sales to scout |

**Transfer Request Flow (optional approval):**
```
1. Scout requests cookies from troop
2. Leader reviews and approves/denies
3. If approved, inventory transferred
4. Transaction logged
```

### 4.10 Sales Process Implementation

**Goal:** Connect sales to inventory system

**Individual Sale Flow:**
```
1. Scout records sale (existing sales table)
2. System checks scout's personal inventory
3. If sufficient inventory:
   - Deduct from scout inventory
   - Create inventory transaction (sold)
4. If insufficient inventory:
   - Warning shown
   - Sale recorded but flagged
   - Leader notified to allocate more
```

**Booth Sale Recording:**
```
Option A: Automatic (based on inventory count)
- Starting inventory recorded
- Ending inventory counted
- Sold = Starting - Ending - Damaged

Option B: Manual (record each sale)
- Each sale recorded individually
- Inventory updated in real-time
- Ending count for verification
```

### 4.11 Inventory Reconciliation and Low-Stock Alerts

**Goal:** Ensure inventory accuracy and prevent stockouts

**Reconciliation Features:**
- Compare physical count to system count
- Record discrepancies with explanations
- Adjust inventory with audit trail
- Generate reconciliation reports

**Alert Types:**
| Alert | Trigger | Recipient |
|-------|---------|-----------|
| Scout Low Stock | Scout inventory < 12 boxes | Scout, Parent |
| Troop Low Stock | Troop inventory < 24 boxes | Cookie Leader |
| Reorder Needed | Total inventory below threshold | Cookie Leader |
| Reconciliation Variance | Physical ≠ System count | Leader |

**Database Schema - `inventory_alerts` table:**
```sql
CREATE TABLE inventory_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    troopId INTEGER NOT NULL,
    userId INTEGER,                       -- Scout for scout alerts
    alertType TEXT NOT NULL,
    cookieProductId INTEGER,
    currentQuantity INTEGER,
    thresholdQuantity INTEGER,
    message TEXT,
    isRead INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    readAt TEXT,
    FOREIGN KEY (troopId) REFERENCES troops(id),
    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (cookieProductId) REFERENCES cookie_products(id)
);
```

---

## Frontend Changes

### New Pages
```
/public/
├── booth-list.html           - List of booth events
├── booth-detail.html         - Booth event details
├── booth-create.html         - Create/edit booth event
├── booth-shifts.html         - Shift management
├── booth-inventory.html      - Booth inventory tracking
├── booth-reconcile.html      - End-of-event reconciliation
├── inventory-dashboard.html  - Troop inventory overview
├── inventory-transfer.html   - Transfer cookies
├── fulfillment-orders.html   - Order management
└── fulfillment-receive.html  - Receive order
```

### New Components
- Booth event card
- Shift schedule grid (Gantt-style)
- Inventory count form
- Payment entry form
- Transfer request modal
- Low stock warning badge
- Reconciliation calculator

---

## API Endpoints Summary

### Booth Events
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/troops/:tid/booths` | List booth events |
| POST | `/api/troops/:tid/booths` | Create booth event |
| GET | `/api/troops/:tid/booths/:bid` | Get booth details |
| PUT | `/api/troops/:tid/booths/:bid` | Update booth |
| POST | `/api/troops/:tid/booths/:bid/start` | Start event |
| POST | `/api/troops/:tid/booths/:bid/end` | End event |
| POST | `/api/troops/:tid/booths/:bid/close` | Close/complete |

### Shifts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/troops/:tid/booths/:bid/shifts` | List shifts |
| POST | `/api/troops/:tid/booths/:bid/shifts` | Create shift |
| PUT | `/api/troops/:tid/booths/:bid/shifts/:sid` | Update shift |
| POST | `/api/.../shifts/:sid/checkin` | Check in |
| POST | `/api/.../shifts/:sid/checkout` | Check out |

### Inventory
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/troops/:tid/inventory` | Troop inventory |
| GET | `/api/my/inventory` | My inventory |
| POST | `/api/troops/:tid/inventory/allocate` | Allocate cookies |
| POST | `/api/troops/:tid/inventory/transfer` | Transfer |
| POST | `/api/troops/:tid/inventory/return` | Return cookies |

### Fulfillment
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/troops/:tid/orders` | List orders |
| POST | `/api/troops/:tid/orders` | Create order |
| PUT | `/api/troops/:tid/orders/:oid/receive` | Receive order |

---

## Testing Checklist

### Booth Events
- [ ] Leader can create troop booth event
- [ ] Scout can create family booth event
- [ ] Event status transitions work correctly
- [ ] Starting/ending times recorded

### Shifts
- [ ] Leader can create shift slots
- [ ] Scouts can be assigned to shifts
- [ ] Check-in/check-out works
- [ ] Shift credit calculated correctly

### Inventory
- [ ] Starting inventory recorded
- [ ] Ending inventory counted
- [ ] Sold quantity calculated correctly
- [ ] Damaged cookies tracked
- [ ] Unsold returned to troop

### Payments
- [ ] All payment types can be recorded
- [ ] Reconciliation calculates correctly
- [ ] Variance flagged appropriately

### Four-Level Inventory
- [ ] Troop inventory tracked accurately
- [ ] Scout personal inventory tracked
- [ ] Booth inventory isolated
- [ ] Transfers logged correctly

### Fulfillment
- [ ] Orders can be created
- [ ] Order status transitions work
- [ ] Receiving updates inventory
- [ ] Order history maintained

---

## Acceptance Criteria

1. **Troop booth events can be created, staffed, and reconciled**
2. **Family booths work independently for scouts**
3. **All payment types tracked and reconciled**
4. **Four-level inventory system accurately tracks cookies**
5. **Fulfillment orders manage council inventory requests**
6. **Low stock alerts notify appropriate users**

---

## Next Phase

**Phase 5: Reporting & Analytics** will implement:
- Summary reports at scout and troop levels
- Booth performance reports
- Export functionality (PDF, Excel, CSV)
- Data visualizations and charts
