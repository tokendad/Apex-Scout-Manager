# Phase 3: Troop Management & Cookie Products

**Status:** ✅ IMPLEMENTED
**Completed:** 2026-02-01
**Focus:** Troop-level features and cookie catalog management
**Prerequisites:** Phase 1 (Foundation), Phase 2 (Compliance & Security)

---

## Overview

Phase 3 implements the organizational hierarchy for troops and introduces a flexible cookie product catalog system. This phase transforms GSCTracker from an individual scout tool into a troop-level management platform.

---

## Deliverables

### 3.1 Troop Hierarchy and Organization

**Goal:** Support organizational structure at the troop level

**Hierarchy Model:**
```
Troop
├── Cookie Leader(s)      - Manages inventory, fulfillment orders
├── Troop Leader(s)       - Manages scouts, events, reports
├── Scouts (Children)     - Records sales, tracks personal goals
└── Parents/Guardians     - Views linked scout data, assists with sales
```

**Database Schema - `troops` table:**
```sql
CREATE TABLE troops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    councilId INTEGER,                    -- Optional council reference
    troopNumber TEXT NOT NULL,            -- e.g., "1234"
    troopType TEXT NOT NULL,              -- Daisy, Brownie, Junior, Cadette, Senior, Ambassador
    troopName TEXT,                       -- Optional friendly name
    leaderId INTEGER,                     -- Primary troop leader
    cookieLeaderId INTEGER,               -- Primary cookie leader
    meetingLocation TEXT,
    meetingDay TEXT,                      -- e.g., "Tuesday"
    meetingTime TEXT,                     -- e.g., "6:00 PM"
    season TEXT,                          -- e.g., "2026"
    timezone TEXT DEFAULT 'America/New_York',
    isActive INTEGER DEFAULT 1,
    settings TEXT,                        -- JSON blob for troop-specific settings
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT,
    FOREIGN KEY (councilId) REFERENCES councils(id),
    FOREIGN KEY (leaderId) REFERENCES users(id),
    FOREIGN KEY (cookieLeaderId) REFERENCES users(id)
);

CREATE INDEX idx_troops_number ON troops(troopNumber);
CREATE INDEX idx_troops_season ON troops(season);
```

**Troop Types (Girl Scout Levels):**
| Type | Grade Level | Age Range |
|------|-------------|-----------|
| Daisy | K-1 | 5-7 |
| Brownie | 2-3 | 7-9 |
| Junior | 4-5 | 9-11 |
| Cadette | 6-8 | 11-14 |
| Senior | 9-10 | 14-16 |
| Ambassador | 11-12 | 16-18 |

**Database Schema - `troop_members` table:**
```sql
CREATE TABLE troop_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    troopId INTEGER NOT NULL,
    userId INTEGER NOT NULL,
    role TEXT NOT NULL,                   -- scout, parent, troop_leader, cookie_leader
    scoutLevel TEXT,                      -- For scouts: Daisy, Brownie, Junior, Cadette, Senior, Ambassador
    linkedScoutId INTEGER,                -- For parents: which scout they're linked to
    joinDate TEXT DEFAULT CURRENT_TIMESTAMP,
    leaveDate TEXT,
    status TEXT DEFAULT 'active',         -- active, inactive, pending, left
    notes TEXT,
    FOREIGN KEY (troopId) REFERENCES troops(id),
    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (linkedScoutId) REFERENCES users(id),
    UNIQUE(troopId, userId)
);

CREATE INDEX idx_troop_members_troop ON troop_members(troopId);
CREATE INDEX idx_troop_members_user ON troop_members(userId);
CREATE INDEX idx_troop_members_status ON troop_members(status);
CREATE INDEX idx_troop_members_level ON troop_members(scoutLevel);
```

**API Endpoints - Troop Management:**
```
# Troop CRUD
POST   /api/troops                    - Create new troop
GET    /api/troops                    - List user's troops
GET    /api/troops/:id                - Get troop details
PUT    /api/troops/:id                - Update troop
DELETE /api/troops/:id                - Deactivate troop

# Member Management
GET    /api/troops/:id/members        - List troop members
POST   /api/troops/:id/members        - Add member to troop
PUT    /api/troops/:id/members/:uid   - Update member role/status
DELETE /api/troops/:id/members/:uid   - Remove member from troop

# Invitations
POST   /api/troops/:id/invite         - Send invitation to join troop
GET    /api/invitations               - User's pending invitations
POST   /api/invitations/:id/accept    - Accept invitation
POST   /api/invitations/:id/decline   - Decline invitation
```

### 3.2 Troop Dashboard for Leaders

**Goal:** Centralized view for troop leaders to manage their troop

**Dashboard Sections:**

**1. Overview Panel**
- Total troop sales (boxes, revenue)
- Active scouts count
- Sales goal progress
- Recent activity feed

**2. Scout Roster**
```
| Scout Name | Sales (Boxes) | Goal Progress | Last Activity | Status |
|------------|---------------|---------------|---------------|--------|
| Jane Doe   | 150           | 75%           | Today         | Active |
| Sarah S.   | 89            | 44%           | 2 days ago    | Active |
```

**3. Leaderboard**
- Top 10 sellers
- Most improved (week over week)
- Goal achievers

**4. Upcoming Events**
- Next 5 scheduled events
- Quick add event button

**5. Alerts & Notifications**
- Scouts below sales pace
- Pending approvals
- Low inventory warnings

**6. Quick Actions**
- Add sale for scout
- Schedule event
- Send troop announcement
- Generate report

**Frontend Components:**
```
/public/
├── troop-dashboard.html      - Main troop dashboard
├── troop-roster.html         - Scout roster management
├── troop-settings.html       - Troop configuration
└── js/
    ├── troop-dashboard.js    - Dashboard logic
    └── troop-components.js   - Reusable troop UI components
```

### 3.3 Troop-Wide Goals and Tracking

**Goal:** Set and track goals at the troop level

**Goal Types:**
| Goal Type | Description | Metric |
|-----------|-------------|--------|
| `total_boxes` | Total boxes sold by troop | Count |
| `total_revenue` | Total revenue generated | Currency |
| `participation` | % of scouts actively selling | Percentage |
| `per_scout_average` | Average boxes per scout | Count |
| `event_count` | Number of booth events | Count |

**Database Schema - `troop_goals` table:**
```sql
CREATE TABLE troop_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    troopId INTEGER NOT NULL,
    goalType TEXT NOT NULL,
    targetAmount REAL NOT NULL,
    actualAmount REAL DEFAULT 0,
    startDate TEXT NOT NULL,
    endDate TEXT NOT NULL,
    status TEXT DEFAULT 'active',         -- active, achieved, missed, cancelled
    description TEXT,
    createdBy INTEGER,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT,
    FOREIGN KEY (troopId) REFERENCES troops(id),
    FOREIGN KEY (createdBy) REFERENCES users(id)
);

CREATE INDEX idx_troop_goals_troop ON troop_goals(troopId);
CREATE INDEX idx_troop_goals_status ON troop_goals(status);
```

**API Endpoints - Goals:**
```
GET    /api/troops/:id/goals          - List troop goals
POST   /api/troops/:id/goals          - Create new goal
PUT    /api/troops/:id/goals/:gid     - Update goal
DELETE /api/troops/:id/goals/:gid     - Delete goal
GET    /api/troops/:id/goals/progress - Get goal progress summary
```

**Goal Progress Calculation:**
```javascript
// Example: Calculate total boxes goal progress
async function calculateTotalBoxesProgress(troopId, startDate, endDate) {
    const result = db.prepare(`
        SELECT COALESCE(SUM(
            CASE WHEN unitType = 'cases' THEN quantity * 12 ELSE quantity END
        ), 0) as totalBoxes
        FROM sales s
        JOIN troop_members tm ON s.userId = tm.userId
        WHERE tm.troopId = ?
          AND tm.role = 'scout'
          AND s.date BETWEEN ? AND ?
    `).get(troopId, startDate, endDate);

    return result.totalBoxes;
}
```

### 3.4 Scout Level Selection

**Goal:** Allow parents or troop leaders to select the appropriate Girl Scout level for each scout

**Girl Scout Membership Levels:**
Based on [Girl Scouts of the USA official grade levels](https://www.girlscouts.org/en/discover/about-us/what-girl-scouts-do/grade-levels.html):

| Level | Grade | Age Range | Uniform Color |
|-------|-------|-----------|---------------|
| Daisy | K-1 | 5-7 | Blue |
| Brownie | 2-3 | 7-9 | Brown |
| Junior | 4-5 | 9-11 | Green |
| Cadette | 6-8 | 11-14 | Tan/Khaki |
| Senior | 9-10 | 14-16 | Tan/Khaki |
| Ambassador | 11-12 | 16-18 | Tan/Khaki |

**Note:** Girl Scouts are considered in the appropriate level based on their grade on October 1, the start of each new Girl Scout year. Scouts "bridge" to the next level, usually at the end of the school year.

**Level Selection Features:**
- **During Scout Registration:** Parent or troop leader selects level from dropdown
- **Profile Update:** Level can be updated when scout bridges to next level
- **Validation:** System can optionally validate level against scout's date of birth
- **Multi-Level Troops:** Troops may contain scouts of multiple levels (e.g., a combined Junior/Cadette troop)

**Who Can Set Scout Level:**
| Role | Can Set Level |
|------|---------------|
| Parent (of linked scout) | ✓ |
| Troop Leader | ✓ |
| Cookie Leader | ✓ |
| Scout (self) | ✗ |

**Frontend Implementation:**
```html
<!-- Scout level selector (shown during enrollment or profile edit) -->
<div class="form-group">
    <label for="scoutLevel">Girl Scout Level *</label>
    <select id="scoutLevel" name="scoutLevel" required>
        <option value="">Select Level...</option>
        <option value="daisy">Daisy (Grades K-1, Ages 5-7)</option>
        <option value="brownie">Brownie (Grades 2-3, Ages 7-9)</option>
        <option value="junior">Junior (Grades 4-5, Ages 9-11)</option>
        <option value="cadette">Cadette (Grades 6-8, Ages 11-14)</option>
        <option value="senior">Senior (Grades 9-10, Ages 14-16)</option>
        <option value="ambassador">Ambassador (Grades 11-12, Ages 16-18)</option>
    </select>
    <small class="help-text">Based on grade as of October 1st of the current school year</small>
</div>
```

**API Endpoints:**
```
PUT    /api/troops/:id/scouts/:uid/level    - Update scout's level (parent/leader)
GET    /api/scouts/levels                   - Get list of valid scout levels with descriptions
```

**Bridging Support:**
When a scout bridges to the next level:
1. Parent or leader updates the scout's level in the system
2. System records the bridge date in member notes
3. Historical data (sales, events) retains original level context
4. If scout needs to move to a different troop (level-specific), a transfer workflow is initiated

---

### 3.5 Troop Roster Management with Parent Linking

**Goal:** Comprehensive scout and parent management

**Roster Features:**
- View all scouts in troop with their Girl Scout level
- Add/remove scouts
- Link parents to scouts
- Set and update scout level (Daisy through Ambassador)
- Track scout status (active, inactive)
- View individual scout sales summaries
- Bulk import scouts from CSV

**Scout Profile View (Leader Perspective):**
```
Scout: Jane Doe
├── Level: Brownie (Grades 2-3)
├── Status: Active
├── Joined: Jan 15, 2026
├── Sales: 150 boxes ($900)
├── Goal: 200 boxes (75% complete)
├── Linked Parents:
│   ├── Mary Doe (Primary)
│   └── John Doe
├── Recent Activity:
│   ├── Jan 30: Sold 12 boxes (Booth Event)
│   └── Jan 28: Sold 5 boxes (Individual)
└── Notes: [Leader notes here]
```

**Bulk Import Format (CSV):**
```csv
firstName,lastName,email,dateOfBirth,scoutLevel,parentEmail,parentFirstName,parentLastName
Jane,Doe,jane@example.com,2015-03-15,brownie,mary@example.com,Mary,Doe
Sarah,Smith,sarah@example.com,2014-07-22,junior,tom@example.com,Tom,Smith
```

**Valid scoutLevel values:** `daisy`, `brownie`, `junior`, `cadette`, `senior`, `ambassador`

**API Endpoints - Roster:**
```
GET    /api/troops/:id/roster         - Full roster with stats
POST   /api/troops/:id/roster/import  - Bulk import from CSV
GET    /api/troops/:id/scouts/:uid    - Individual scout detail
PUT    /api/troops/:id/scouts/:uid    - Update scout info
```

### 3.6 Cookie Product Catalog Management

**Goal:** Flexible cookie catalog that can be updated yearly

**Features:**
- Admin interface to add/remove/update cookie types
- Season-specific cookie catalogs
- Cookie attributes (dietary, allergens)
- Nutrition information
- Active/inactive status per season
- Archive old cookie types for historical reporting

**Database Schema - `cookie_products` table:**
```sql
CREATE TABLE cookie_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    season TEXT NOT NULL,                 -- e.g., "2026"
    cookieName TEXT NOT NULL,
    shortName TEXT,                       -- e.g., "TM" for Thin Mints
    description TEXT,
    pricePerBox REAL NOT NULL,
    boxesPerCase INTEGER DEFAULT 12,
    isActive INTEGER DEFAULT 1,
    sortOrder INTEGER DEFAULT 0,
    imageUrl TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT,
    UNIQUE(season, cookieName)
);

CREATE INDEX idx_cookie_products_season ON cookie_products(season);
```

**Database Schema - `cookie_attributes` table:**
```sql
CREATE TABLE cookie_attributes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    productId INTEGER NOT NULL,
    attributeType TEXT NOT NULL,          -- dietary, allergen, certification
    attributeValue TEXT NOT NULL,         -- gluten_free, contains_nuts, kosher
    displayLabel TEXT,                    -- "Gluten Free", "Contains Tree Nuts"
    FOREIGN KEY (productId) REFERENCES cookie_products(id) ON DELETE CASCADE
);

CREATE INDEX idx_cookie_attributes_product ON cookie_attributes(productId);
```

**Database Schema - `cookie_nutrition` table:**
```sql
CREATE TABLE cookie_nutrition (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    productId INTEGER NOT NULL UNIQUE,
    servingSize TEXT,                     -- e.g., "2 cookies (28g)"
    servingsPerBox INTEGER,
    calories INTEGER,
    totalFat REAL,                        -- grams
    saturatedFat REAL,
    transFat REAL,
    cholesterol REAL,                     -- mg
    sodium REAL,                          -- mg
    totalCarbs REAL,                      -- grams
    dietaryFiber REAL,
    sugars REAL,
    protein REAL,                         -- grams
    ingredients TEXT,
    FOREIGN KEY (productId) REFERENCES cookie_products(id) ON DELETE CASCADE
);
```

**Default Cookie Catalog (2026 Season):**
```javascript
const defaultCookies = [
    { cookieName: 'Thin Mints', shortName: 'TM', pricePerBox: 6.00,
      attributes: ['vegan'],
      description: 'Crispy chocolate wafers dipped in chocolatey coating' },
    { cookieName: 'Samoas', shortName: 'SM', pricePerBox: 6.00,
      attributes: ['contains_coconut'],
      description: 'Caramel, coconut, and chocolatey stripes' },
    { cookieName: 'Tagalongs', shortName: 'TG', pricePerBox: 6.00,
      attributes: ['contains_peanuts'],
      description: 'Crispy cookies layered with peanut butter and chocolate' },
    { cookieName: 'Trefoils', shortName: 'TF', pricePerBox: 6.00,
      attributes: [],
      description: 'Traditional shortbread cookie' },
    { cookieName: 'Do-si-dos', shortName: 'DD', pricePerBox: 6.00,
      attributes: ['contains_peanuts'],
      description: 'Oatmeal sandwich cookies with peanut butter filling' },
    { cookieName: 'Lemon-Ups', shortName: 'LU', pricePerBox: 6.00,
      attributes: [],
      description: 'Crispy lemon cookies with messages' },
    { cookieName: 'Adventurefuls', shortName: 'AF', pricePerBox: 6.00,
      attributes: [],
      description: 'Brownie-inspired cookies with caramel filling' },
    { cookieName: 'Toffee-tastic', shortName: 'TT', pricePerBox: 6.00,
      attributes: ['gluten_free'],
      description: 'Gluten-free butter cookies with toffee bits' },
    { cookieName: 'Caramel Chocolate Chip', shortName: 'CCC', pricePerBox: 6.00,
      attributes: ['gluten_free'],
      description: 'Gluten-free chewy cookies with caramel and chocolate chips' },
];
```

**API Endpoints - Cookie Catalog:**
```
# Cookie Products
GET    /api/cookies                       - List active cookies for current season
GET    /api/cookies/all                   - List all cookies (including inactive)
GET    /api/cookies/:id                   - Get cookie details with nutrition
POST   /api/cookies                       - Add new cookie (leader/admin)
PUT    /api/cookies/:id                   - Update cookie (leader/admin)
DELETE /api/cookies/:id                   - Deactivate cookie (leader/admin)

# Season Management
GET    /api/cookies/seasons               - List available seasons
POST   /api/cookies/seasons/:year/copy    - Copy catalog from another season
PUT    /api/cookies/seasons/:year/price   - Bulk update prices for season
```

### 3.7 Nutrition and Dietary Attribute Tracking

**Goal:** Display allergen and dietary information for customers

**Attribute Types:**
| Type | Values | Display |
|------|--------|---------|
| Dietary | `vegan`, `vegetarian` | 🌱 Vegan |
| Allergen | `contains_peanuts`, `contains_tree_nuts`, `contains_wheat`, `contains_milk`, `contains_soy`, `contains_coconut` | ⚠️ Contains Peanuts |
| Certification | `gluten_free`, `kosher` | GF Gluten Free |

**Frontend Display:**
```html
<!-- Cookie card with dietary badges -->
<div class="cookie-card">
    <img src="/images/thin-mints.jpg" alt="Thin Mints">
    <h3>Thin Mints</h3>
    <p class="description">Crispy chocolate wafers...</p>
    <div class="badges">
        <span class="badge vegan">🌱 Vegan</span>
    </div>
    <p class="price">$6.00 per box</p>
    <button class="nutrition-btn">Nutrition Info</button>
</div>

<!-- Nutrition modal -->
<div class="nutrition-modal">
    <h4>Thin Mints - Nutrition Facts</h4>
    <p>Serving Size: 4 cookies (32g)</p>
    <p>Servings Per Box: 7</p>
    <table>
        <tr><td>Calories</td><td>160</td></tr>
        <tr><td>Total Fat</td><td>8g</td></tr>
        <!-- ... -->
    </table>
    <p class="ingredients">Ingredients: Sugar, enriched flour...</p>
</div>
```

### 3.8 Season/Year-Based Cookie Catalog

**Goal:** Support different cookie offerings per selling season

**Season Management:**
- Each season has its own cookie catalog
- Prices can vary by season
- New cookies can be added per season
- Old cookies can be retired (inactive)
- Historical data references the season's catalog

**Season Transition Workflow:**
```
1. Admin creates new season (e.g., "2027")
2. Copy previous season's catalog as starting point
3. Modify: add new cookies, retire old ones, update prices
4. Set new season as "active"
5. All new sales automatically use active season's catalog
6. Historical reports use the season at time of sale
```

**API Endpoints - Seasons:**
```
GET    /api/seasons                       - List all seasons
GET    /api/seasons/active                - Get current active season
POST   /api/seasons                       - Create new season
PUT    /api/seasons/:year/activate        - Set season as active
GET    /api/seasons/:year/summary         - Season sales summary
```

---

## Database Schema Summary

**New Tables:**
| Table | Purpose |
|-------|---------|
| `troops` | Troop organization data |
| `troop_members` | Scout/leader membership |
| `troop_goals` | Troop-level goals |
| `cookie_products` | Cookie catalog per season |
| `cookie_attributes` | Dietary/allergen info |
| `cookie_nutrition` | Nutrition facts |

**Modified Tables:**
| Table | Changes |
|-------|---------|
| `sales` | Add `season` column |
| `events` | Ensure `troopId` FK is used |

---

## Frontend Changes

### New Pages
```
/public/
├── troop-dashboard.html      - Leader dashboard
├── troop-roster.html         - Scout management
├── troop-settings.html       - Troop configuration
├── troop-goals.html          - Goal management
├── cookie-catalog.html       - Cookie catalog editor
└── cookie-nutrition.html     - Nutrition info display
```

### New Components
- Troop selector dropdown (for users in multiple troops)
- Scout roster table with sorting/filtering
- Goal progress cards with visual indicators
- Cookie catalog grid with dietary badges
- Nutrition facts modal
- Leaderboard widget
- Activity feed component

### Navigation Updates
- Add "Troop" section to main navigation (for leaders)
- Role-based menu items (scouts see different menu than leaders)

---

## API Endpoints Summary

### Troop Management
| Method | Endpoint | Access |
|--------|----------|--------|
| POST | `/api/troops` | Any authenticated |
| GET | `/api/troops` | Any authenticated |
| GET | `/api/troops/:id` | Troop members |
| PUT | `/api/troops/:id` | Troop leader |
| DELETE | `/api/troops/:id` | Troop leader |

### Member Management
| Method | Endpoint | Access |
|--------|----------|--------|
| GET | `/api/troops/:id/members` | Troop members |
| POST | `/api/troops/:id/members` | Troop leader |
| PUT | `/api/troops/:id/members/:uid` | Troop leader |
| DELETE | `/api/troops/:id/members/:uid` | Troop leader |

### Goals
| Method | Endpoint | Access |
|--------|----------|--------|
| GET | `/api/troops/:id/goals` | Troop members |
| POST | `/api/troops/:id/goals` | Troop leader |
| PUT | `/api/troops/:id/goals/:gid` | Troop leader |
| DELETE | `/api/troops/:id/goals/:gid` | Troop leader |

### Cookie Catalog
| Method | Endpoint | Access |
|--------|----------|--------|
| GET | `/api/cookies` | Any authenticated |
| POST | `/api/cookies` | Troop leader+ |
| PUT | `/api/cookies/:id` | Troop leader+ |
| DELETE | `/api/cookies/:id` | Troop leader+ |

---

## Testing Checklist

### Troop Management
- [ ] User can create a new troop
- [ ] Troop creator becomes troop leader
- [ ] Leader can invite members via email
- [ ] Users can accept/decline invitations
- [ ] Leader can assign roles to members
- [ ] Leader can remove members
- [ ] Members see troop in their troop list

### Scout Level Selection
- [ ] Parent can select scout level during registration
- [ ] Troop leader can select/update scout level when adding scout
- [ ] Level selector shows all 6 levels with grade/age info (Daisy through Ambassador)
- [ ] Scout level displays correctly in roster and profile views
- [ ] Bulk import correctly sets scout level from CSV
- [ ] Leader can update scout level when scout bridges
- [ ] Scout cannot change their own level

### Troop Dashboard
- [ ] Dashboard shows troop overview stats
- [ ] Scout roster displays all scouts with their level
- [ ] Leaderboard shows top sellers
- [ ] Activity feed shows recent events
- [ ] Quick actions work correctly

### Goals
- [ ] Leader can create goals
- [ ] Goal progress updates automatically
- [ ] Goals show visual progress indicator
- [ ] Completed goals marked as achieved

### Cookie Catalog
- [ ] Default cookies loaded for new season
- [ ] Leader can add new cookies
- [ ] Leader can edit cookie details
- [ ] Leader can deactivate cookies
- [ ] Nutrition info displays correctly
- [ ] Dietary badges show on cookie cards
- [ ] Season copy works correctly

---

## Acceptance Criteria

1. **Troop leaders can create and manage their troop**
2. **Scouts can be enrolled and linked to parents**
3. **Parents or troop leaders can select the appropriate Girl Scout level (Daisy, Brownie, Junior, Cadette, Senior, Ambassador) for each scout**
4. **Scout level can be updated when a scout bridges to the next level**
5. **Troop dashboard provides actionable insights**
6. **Goals can be set and tracked at troop level**
7. **Cookie catalog is fully configurable per season**
8. **Nutrition and dietary information is accessible**

---Developer notes:
The following website contains a list of badges and awards the girls can be given.  Its not a full list of all badges, but very Comprehensive. Will need to update the database to allow these badges to be assigned to girls as they recieve them.
 https://www.girlscouts.org/content/dam/gsusa/forms-and-documents/members/highest-awards/Cadette_GSUSA_BadgesAwardsAndPins.pdf  

## Next Phase

**Phase 4: Booth Events & Inventory Management** will implement:
- Troop booth event creation and tracking
- Family booth event tracking
- Booth shift scheduling
- Multi-level inventory system
- Fulfillment order management
