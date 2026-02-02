# Phase 3.1: Scout Profile Management

**Status:** 📋 PROPOSED (Extracted from Phase 3 Developer Notes & Scattered Specs)
**Timeline:** Months 4-5 (After Phase 3, Before Phase 4)
**Focus:** Comprehensive scout profile system including badges, achievements, and level progression
**Prerequisites:** Phase 1 (Foundation), Phase 2 (Compliance & Security), Phase 3 (Troop Management)

---

## Overview

Phase 3.1 consolidates and enhances scout profile management capabilities that are scattered across the current v2.0 roadmap. This phase creates a comprehensive scout profile system that tracks individual scout identity, Girl Scout level progression, achievements, badges, and recognitions. It transforms the scout from a simple user account into a fully-realized Girl Scout profile with progression, accomplishments, and recognition features.

**Key Focus Areas:**
- Scout account lifecycle and profile management
- Girl Scout level tracking and progression (Daisy → Ambassador)
- Badge and achievement system
- Scout recognitions and awards
- Scout-specific dashboards and progress views
- Parent oversight and notifications

---

## Deliverables

### 3.1.1 Scout Profile Data Structure

**Goal:** Establish comprehensive scout profile with all necessary identity and status information

**Scout Profile Attributes:**

```
Scout Profile
├── Identity
│   ├── First Name
│   ├── Last Name
│   ├── Date of Birth
│   ├── Profile Photo
│   └── Email (encrypted)
├── Girl Scout Information
│   ├── Girl Scout Level (Daisy-Ambassador)
│   ├── Troop Assignment
│   ├── Join Date
│   ├── Bridging History
│   └── Current Status (Active/Inactive)
├── Parent Linkage
│   ├── Primary Parent/Guardian
│   └── Additional Parents/Guardians
├── Progress Tracking
│   ├── Sales Goals
│   ├── Current Goals Status
│   └── Achievement Progress
├── Achievements
│   ├── Badges Earned
│   ├── Awards Received
│   ├── Recognitions
│   └── Achievement Timeline
└── Preferences
    ├── Notification Settings
    └── Privacy Settings
```

**Database Schema - Enhanced `users` table (for scouts):**

The base `users` table from Phase 1 is extended with scout-specific metadata. Key fields already present:
- `id` - User ID
- `firstName` - Scout's first name
- `lastName` - Scout's last name
- `dateOfBirth` - Used for age calculation and level validation
- `photoUrl` - Scout profile photo
- `email` - Scout email (encrypted)
- `isMinor` - COPPA compliance flag
- `parentEmail` - For minors

**Database Schema - `scout_profiles` table (NEW):**

```sql
CREATE TABLE scout_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL UNIQUE,
    troopId INTEGER NOT NULL,
    troopMemberId INTEGER,                    -- FK to troop_members for level tracking

    -- Girl Scout Information
    scoutLevel TEXT NOT NULL DEFAULT 'daisy', -- daisy, brownie, junior, cadette, senior, ambassador
    levelSince TEXT,                          -- Date when scout reached current level

    -- Progressive Info
    joinedTroopDate TEXT DEFAULT CURRENT_TIMESTAMP,
    bridgeHistory TEXT,                       -- JSON array of {date, fromLevel, toLevel}

    -- Status
    status TEXT DEFAULT 'active',             -- active, inactive, alumni
    uniformColor TEXT,                        -- Visual indicator (blue, brown, green, tan, khaki)

    -- Preferences
    preferredName TEXT,                       -- If different from firstName
    bio TEXT,                                 -- Short bio/about me
    motto TEXT,                               -- Personal motto

    -- Tracking
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT,

    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (troopId) REFERENCES troops(id) ON DELETE CASCADE,
    FOREIGN KEY (troopMemberId) REFERENCES troop_members(id)
);

CREATE INDEX idx_scout_profiles_troop ON scout_profiles(troopId);
CREATE INDEX idx_scout_profiles_level ON scout_profiles(scoutLevel);
CREATE INDEX idx_scout_profiles_status ON scout_profiles(status);
```

**Level Information with Girl Scout Standards:**

```sql
CREATE TABLE scout_levels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    levelCode TEXT UNIQUE NOT NULL,          -- daisy, brownie, junior, cadette, senior, ambassador
    displayName TEXT NOT NULL,                -- Display name for UI
    gradeRange TEXT,                          -- e.g., "K-1"
    ageRange TEXT,                            -- e.g., "5-7"
    uniformColor TEXT,                        -- CSS color or color name
    description TEXT,
    isActive INTEGER DEFAULT 1,
    sortOrder INTEGER
);

-- Seed data
INSERT INTO scout_levels VALUES
(1, 'daisy', 'Daisy', 'K-1', '5-7', 'blue', 'Girl Scouts start their journey as Daisies', 1, 1),
(2, 'brownie', 'Brownie', '2-3', '7-9', 'brown', 'Brownies gain skills and confidence', 1, 2),
(3, 'junior', 'Junior', '4-5', '9-11', 'green', 'Juniors become leaders and innovators', 1, 3),
(4, 'cadette', 'Cadette', '6-8', '11-14', 'tan', 'Cadettes tackle real-world problems', 1, 4),
(5, 'senior', 'Senior', '9-10', '14-16', 'tan', 'Seniors make a difference globally', 1, 5),
(6, 'ambassador', 'Ambassador', '11-12', '16-18', 'tan', 'Ambassadors are role models and mentors', 1, 6);
```

**API Endpoints - Scout Profiles:**

```
# Scout Profile Management
GET    /api/scouts/:id                     - Get scout profile
GET    /api/scouts/:id/full                - Get complete scout profile with achievements
PUT    /api/scouts/:id                     - Update scout profile (scout/parent/leader)
POST   /api/scouts/:id/photo               - Upload scout profile photo
GET    /api/scouts/:id/levels              - Get scout level history
GET    /api/scouts/levels                  - Get all available scout levels

# Scout Level Management
PUT    /api/troops/:tid/scouts/:sid/level  - Update scout's level (leader)
POST   /api/troops/:tid/scouts/:sid/bridge - Record scout bridging to next level

# Scout Status
GET    /api/scouts/:id/status              - Get scout's current status
PUT    /api/scouts/:id/status              - Update scout status
POST   /api/scouts/:id/deactivate          - Deactivate scout account
POST   /api/scouts/:id/reactivate          - Reactivate scout account
```

---

### 3.1.2 Scout Badge & Achievement System

**Goal:** Track Girl Scout badges, awards, and recognitions earned by scouts

**Background from Developer Notes:**

> "The following website contains a list of badges and awards the girls can be given. Its not a full list of all badges, but very Comprehensive. Will need to update the database to allow these badges to be assigned to girls as they recieve them."
> Reference: https://www.girlscouts.org/content/dam/gsusa/forms-and-documents/members/highest-awards/Cadette_GSUSA_BadgesAwardsAndPins.pdf

**Badge Types in Girl Scouts:**

| Badge Type | Description | Examples |
|-----------|-------------|----------|
| **Activity Badge** | Skills and interests | First Aid, Coding, Environmental Science |
| **Journey Badge** | 4-part program completion | Think Like an Engineer, Celebrate Heritage |
| **Highest Award** | Level-specific top honor | Gold Award (Senior), Silver Award (Cadette) |
| **Honor Badge** | Special recognition | Medal of Honor, Volunteer Service |
| **Special Recognition Pin** | Service and accomplishment | First-Year Pin, Challenge Patch |

**Database Schema - `badges` table (NEW):**

```sql
CREATE TABLE badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    badgeCode TEXT UNIQUE NOT NULL,          -- e.g., 'FA-101' for First Aid
    badgeName TEXT NOT NULL,
    badgeType TEXT NOT NULL,                 -- activity, journey, award, honor, special
    description TEXT,

    -- Level Availability
    applicableLevels TEXT NOT NULL,          -- JSON array: ["daisy", "brownie", "junior", ...]
    minLevel TEXT,                           -- Minimum level required
    maxLevel TEXT,                           -- Maximum level available for

    -- Badge Details
    imageUrl TEXT,
    requirements TEXT,                       -- Summary of requirements
    detailsUrl TEXT,                         -- URL to full requirements (GSUSA)

    -- Metadata
    isActive INTEGER DEFAULT 1,
    isOfficial INTEGER DEFAULT 1,            -- Official GSUSA vs. custom
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT,

    UNIQUE(badgeCode, applicableLevels)
);

CREATE INDEX idx_badges_level ON badges(minLevel);
CREATE INDEX idx_badges_type ON badges(badgeType);
```

**Database Schema - `scout_badges` table (NEW):**

```sql
CREATE TABLE scout_badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    badgeId INTEGER NOT NULL,
    troopId INTEGER,

    -- Earning Information
    earnedDate TEXT NOT NULL,                -- When scout earned the badge
    recognizedDate TEXT,                     -- When officially recognized
    earnedBy TEXT DEFAULT 'individual',      -- individual, troop_event, other
    notes TEXT,                              -- Completion notes

    -- Verification
    verifiedBy INTEGER,                      -- Leader who verified
    verifiedDate TEXT,
    proofOfCompletion TEXT,                  -- URL to photo/documentation

    -- Tracking
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT,

    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (badgeId) REFERENCES badges(id),
    FOREIGN KEY (troopId) REFERENCES troops(id),
    FOREIGN KEY (verifiedBy) REFERENCES users(id),
    UNIQUE(userId, badgeId, earnedDate)     -- Prevent duplicate earnings
);

CREATE INDEX idx_scout_badges_user ON scout_badges(userId);
CREATE INDEX idx_scout_badges_earned_date ON scout_badges(earnedDate);
CREATE INDEX idx_scout_badges_badge ON scout_badges(badgeId);
```

**Database Schema - `scout_awards` table (NEW):**

```sql
CREATE TABLE scout_awards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    awardType TEXT NOT NULL,                 -- gold_award, silver_award, medal_of_honor, etc.
    awardName TEXT NOT NULL,

    -- Award Details
    description TEXT,
    awardedDate TEXT NOT NULL,
    awardedBy TEXT,                          -- Council, Troop Leader, etc.
    awardCertificate TEXT,                   -- URL to certificate image

    -- Project/Achievement
    projectTitle TEXT,
    projectDescription TEXT,
    projectImpact TEXT,                      -- Number of people served, etc.
    projectEvidence TEXT,                    -- URLs to photos/videos

    -- Tracking
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT,

    FOREIGN KEY (userId) REFERENCES users(id)
);

CREATE INDEX idx_scout_awards_user ON scout_awards(userId);
CREATE INDEX idx_scout_awards_type ON scout_awards(awardType);
```

**Database Schema - `achievement_categories` table (NEW):**

```sql
CREATE TABLE achievement_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    categoryName TEXT UNIQUE NOT NULL,       -- Badges, Awards, Recognitions, etc.
    description TEXT,
    sortOrder INTEGER,
    icon TEXT,                               -- Icon name or emoji
    color TEXT                               -- Color for UI
);

-- Seed data
INSERT INTO achievement_categories VALUES
(1, 'Badges', 'Girl Scout badges earned', 1, '🏅', 'blue'),
(2, 'Awards', 'High honors and awards', 2, '🥇', 'gold'),
(3, 'Recognitions', 'Special recognitions and honors', 3, '⭐', 'purple'),
(4, 'Milestones', 'Achievement milestones', 4, '🎯', 'green');
```

**API Endpoints - Badges & Awards:**

```
# Badge Management
GET    /api/badges                          - List all available badges
GET    /api/badges/:id                      - Get badge details
GET    /api/badges/level/:scoutLevel        - Get badges for specific level
POST   /api/badges                          - Create custom badge (admin)
PUT    /api/badges/:id                      - Update badge (admin)

# Scout Badge Earning
POST   /api/scouts/:id/badges               - Award badge to scout (leader)
GET    /api/scouts/:id/badges               - Get scout's earned badges
DELETE /api/scouts/:id/badges/:badgeId      - Remove badge (leader)
PUT    /api/scouts/:id/badges/:badgeId      - Update earned badge info

# Scout Awards
POST   /api/scouts/:id/awards               - Award special honor to scout
GET    /api/scouts/:id/awards               - Get scout's awards
PUT    /api/scouts/:id/awards/:awardId      - Update award

# Achievement Timeline
GET    /api/scouts/:id/achievements/timeline - Get chronological achievement list
GET    /api/scouts/:id/achievements/summary  - Get achievement summary stats
```

**Badge Import from GSUSA:**

Provide tooling to import official Girl Scout badges from GSUSA resources:

```javascript
// Example badge import structure
const badgeImportTemplate = {
    badgeCode: 'FA-101',
    badgeName: 'First Aid',
    badgeType: 'activity',
    applicableLevels: ['junior', 'cadette', 'senior', 'ambassador'],
    minLevel: 'junior',
    description: 'Learn life-saving first aid skills',
    requirements: [
        'Complete a certified first aid course',
        'Learn CPR basics',
        'Demonstrate basic first aid techniques'
    ],
    detailsUrl: 'https://www.girlscouts.org/...'
};
```

---

### 3.1.3 Scout Progress Dashboard

**Goal:** Give scouts personalized view of their progress, achievements, and goals

**Scout Dashboard Sections:**

**1. Profile Overview**
```
┌─────────────────────────────────────┐
│  Jane Doe (Brownie)                 │
│  ┌──────────────────────────────────┤
│  │ Status: Active                   │
│  │ Joined: January 15, 2026         │
│  │ Next Bridging: September 2027    │
│  │                                  │
│  │ [Edit Profile]                   │
│  └──────────────────────────────────┘
└─────────────────────────────────────┘
```

**2. Sales Progress**
```
┌─────────────────────────────────────┐
│ Sales Goal Progress                 │
│                                     │
│ Goal: 200 boxes                     │
│ Sold: 150 boxes (75%)               │
│ ████████████░░░░░░ 75%              │
│                                     │
│ Status: On Track ✓                  │
│ Time Remaining: 45 days             │
└─────────────────────────────────────┘
```

**3. Badges & Achievements**
```
┌─────────────────────────────────────┐
│ My Badges & Awards (8)              │
│                                     │
│ 🏅 First Aid        🏅 Coding       │
│ 🏅 Environmental    🥇 Bronze Bar   │
│ [View All]                          │
└─────────────────────────────────────┘
```

**4. Recent Activity**
```
┌─────────────────────────────────────┐
│ Recent Activity                     │
│                                     │
│ Jan 30: Earned "First Aid" badge   │
│ Jan 28: Sold 12 boxes at booth     │
│ Jan 25: Joined booth event         │
│ [View All]                          │
└─────────────────────────────────────┘
```

**5. Quick Actions**
```
┌─────────────────────────────────────┐
│ Quick Actions                       │
│                                     │
│ [Record a Sale]  [View Booth Schedule]
│ [View Badges]    [Settings]         │
└─────────────────────────────────────┘
```

**Frontend Components:**
```
/public/
├── scout-dashboard.html       - Scout's personal dashboard
├── scout-profile.html         - Scout profile view/edit
├── scout-badges.html          - Badges and achievements
├── scout-level-info.html      - Girl Scout level information
└── js/
    ├── scout-dashboard.js     - Dashboard logic
    ├── scout-achievements.js  - Badge/award management
    └── scout-profile.js       - Profile management
```

**API Endpoints - Scout Dashboard:**

```
GET    /api/scouts/me                      - Current authenticated scout's profile
GET    /api/scouts/me/dashboard            - Scout's dashboard data
GET    /api/scouts/me/achievements         - Scout's badges/awards summary
GET    /api/scouts/me/activity             - Scout's recent activity
GET    /api/scouts/me/goals                - Scout's personal sales goals
```

---

### 3.1.4 Scout Level Management & Bridging

**Goal:** Manage scout progression through Girl Scout levels

**Scout Level Information:**

The Girl Scout level system is foundational to the scout experience. Each level represents a year range and grade range:

| Level | Grade | Age | Years in Level | Focus |
|-------|-------|-----|----------------|-------|
| Daisy | K-1 | 5-7 | 2 | Exploration & Friendship |
| Brownie | 2-3 | 7-9 | 2 | Skills & Fun |
| Junior | 4-5 | 9-11 | 2 | Leadership & Innovation |
| Cadette | 6-8 | 11-14 | 3 | Advocacy & Change |
| Senior | 9-10 | 14-16 | 2 | Global Perspective |
| Ambassador | 11-12 | 16-18 | 2 | Mentoring & Legacy |

**Bridging Process:**

Bridging occurs when a scout advances to the next Girl Scout level, typically at the end of the school year. This is a significant milestone in a Girl Scout's journey.

```
Bridging Workflow
1. Scout is eligible for bridging (grade advancement)
2. Parent/Leader marks scout as ready to bridge
3. System records bridging event with date
4. Scout's level changes in database
5. Scout may receive bridging badge/recognition
6. Old level data archived for historical reference
7. New level expectations and opportunities available
```

**Database Schema - Bridging Support:**

The `scout_profiles.bridgeHistory` field stores JSON array of bridging events:

```json
{
    "bridgeHistory": [
        {
            "date": "2026-09-01",
            "fromLevel": "daisy",
            "toLevel": "brownie",
            "recordedBy": 5,
            "bridgingBadgeEarned": true,
            "notes": "Completed Daisy journey, earned bridging badge"
        }
    ]
}
```

**API Endpoints - Level Management:**

```
# Level Information
GET    /api/scout-levels                   - Get all scout levels
GET    /api/scout-levels/:levelCode        - Get specific level details
GET    /api/scouts/:id/level-info          - Scout's current level info

# Scout Level Updates
PUT    /api/troops/:tid/scouts/:sid/level  - Update scout's level (leader only)
POST   /api/scouts/:id/bridge              - Record bridging event
GET    /api/scouts/:id/bridging-history    - Get scout's bridging timeline

# Level Validation
GET    /api/scouts/:id/level-eligibility   - Check if scout can bridge
```

**Level-Based Features:**

Different scout levels have access to different features and content:

```javascript
// Feature availability by level
const levelFeatures = {
    'daisy': {
        maxSalesGoal: 100,
        badgesAvailable: ['activity'],
        boothEventParticipation: 'supervised',
        inventory: 'shared_family'
    },
    'brownie': {
        maxSalesGoal: 200,
        badgesAvailable: ['activity', 'journey'],
        boothEventParticipation: 'supervised',
        inventory: 'shared_family'
    },
    'junior': {
        maxSalesGoal: 500,
        badgesAvailable: ['activity', 'journey'],
        boothEventParticipation: 'unsupervised',
        inventory: 'personal'
    },
    // ...
};
```

---

### 3.1.5 Parent-Scout Relationship Management

**Goal:** Establish and manage parent/guardian relationships with scouts

**Extends Phase 2 Implementation:**

Phase 3.1 enhances the parent-scout linking from Phase 2 with scout-specific context:

```sql
-- Enhanced parent_scout_links for scout profile context
ALTER TABLE parent_scout_links ADD COLUMN scoutProfile TEXT;  -- References scout_profiles
ALTER TABLE parent_scout_links ADD COLUMN accessLevel TEXT DEFAULT 'view';  -- view, edit, manage
ALTER TABLE parent_scout_links ADD COLUMN notificationPrefs TEXT;  -- JSON notification settings
```

**Parent View of Scout:**

Parents can see:
- Scout's profile and Girl Scout level
- Scout's sales progress toward goals
- Scout's earned badges and achievements
- Scout's booth event participation
- Scout's activity timeline
- Linked achievement milestones

**Parent Permissions by Scout Type:**

| Action | Scout <13 (With Consent) | Scout 13+ |
|--------|--------------------------|-----------|
| View profile | ✓ | ✓ (if linked) |
| View sales | ✓ | ✓ |
| View badges | ✓ | ✓ |
| Edit profile | ✓ | Limited |
| Record sales | ✓ | Limited |
| View activity | ✓ | ✓ |

**API Endpoints - Parent-Scout Relationships:**

```
# Parent Management (already in Phase 2, reference here)
GET    /api/scouts/:id/parents             - Get scout's linked parents
POST   /api/scouts/:id/request-parent      - Request parent linkage
PUT    /api/scouts/:id/parents/:pid        - Update parent relationship

# Parent Scout View
GET    /api/parents/me/scouts              - Get parent's linked scouts
GET    /api/parents/me/scouts/:id/profile  - View linked scout's profile
GET    /api/parents/me/scouts/:id/progress - View linked scout's progress
```

---

### 3.1.6 Scout Privacy & Data Access

**Goal:** Implement scout-specific privacy controls aligned with COPPA

**Data Access Rules:**

```
Scout Age < 13:
├── Scout can see: Own data only
├── Parent(s) can see: All scout's data
├── Troop Leader can see: Sales, level, activity
├── Other scouts see: Limited profile (name, level, badges)
└── Public sees: Nothing (requires consent)

Scout Age >= 13:
├── Scout can see: Own data, parents' links
├── Parent(s) can see: Only linked scout's data (if approved)
├── Troop Leader can see: Sales, level, activity, achievements
├── Other scouts see: Public profile (if shared)
└── Public sees: Nothing (still protected)
```

**Privacy Settings:**

```sql
CREATE TABLE scout_privacy_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL UNIQUE,

    -- Visibility Controls
    profileVisibility TEXT DEFAULT 'troop',  -- private, troop, public
    showBadges INTEGER DEFAULT 1,
    showAchievements INTEGER DEFAULT 1,
    showSalesProgress INTEGER DEFAULT 1,

    -- Notification Preferences
    emailNotifications INTEGER DEFAULT 1,
    parentNotifications INTEGER DEFAULT 1,
    troopNotifications INTEGER DEFAULT 1,

    -- Data Sharing
    allowParentAccess INTEGER DEFAULT 1,
    allowTroopAccess INTEGER DEFAULT 1,
    allowPhotosInReports INTEGER DEFAULT 0,

    FOREIGN KEY (userId) REFERENCES users(id)
);
```

**API Endpoints - Privacy:**

```
GET    /api/scouts/:id/privacy             - Get privacy settings (scout/parent)
PUT    /api/scouts/:id/privacy             - Update privacy settings
GET    /api/scouts/:id/consent-status      - Check COPPA consent status (Phase 2)
```

---

### 3.1.7 Scout Activity Tracking

**Goal:** Track and display scout's activities and milestones

**Activity Types:**

```sql
CREATE TABLE scout_activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    activityType TEXT NOT NULL,            -- badge_earned, sale_recorded, event_attended, etc.

    -- Activity Details
    title TEXT,
    description TEXT,
    relevantDate TEXT,                     -- When the activity occurred

    -- Relationships
    relatedBadgeId INTEGER,
    relatedEventId INTEGER,
    relatedSaleId INTEGER,

    -- Metadata
    visibility TEXT DEFAULT 'troop',       -- private, troop, public
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (relatedBadgeId) REFERENCES badges(id),
    FOREIGN KEY (relatedEventId) REFERENCES events(id),
    FOREIGN KEY (relatedSaleId) REFERENCES sales(id)
);

CREATE INDEX idx_activity_user ON scout_activity_log(userId);
CREATE INDEX idx_activity_date ON scout_activity_log(relevantDate);
CREATE INDEX idx_activity_type ON scout_activity_log(activityType);
```

**Activity Types:**

| Activity | Visibility | Default |
|----------|-----------|---------|
| Badge Earned | Configurable | Troop |
| Award Received | Configurable | Troop |
| Sale Recorded | Private | Private |
| Booth Attended | Private | Private |
| Level Bridged | Configurable | Troop |
| Goal Achieved | Configurable | Troop |
| Recognition Received | Configurable | Troop |

**API Endpoints - Activity:**

```
GET    /api/scouts/:id/activity            - Get scout's activity timeline
GET    /api/scouts/:id/activity/summary    - Get activity summary
POST   /api/scouts/:id/activity            - Log new activity (system)
```

---

## Database Schema Summary

**New Tables in Phase 3.1:**

| Table | Purpose |
|-------|---------|
| `scout_profiles` | Scout-specific profile data and metadata |
| `scout_levels` | Scout level definitions and information |
| `badges` | Badge catalog (official GSUSA + custom) |
| `scout_badges` | Badges earned by individual scouts |
| `scout_awards` | Special awards and honors |
| `achievement_categories` | Categories for organizing achievements |
| `scout_privacy_settings` | Privacy and visibility preferences |
| `scout_activity_log` | Activity timeline and milestones |

**Modified Tables:**

| Table | Changes |
|-------|---------|
| `users` | Already has scout-specific fields (firstName, lastName, dateOfBirth, photoUrl) |
| `troop_members` | References scout_profiles, maintains scoutLevel |
| `parent_scout_links` | (Phase 2) Enhanced with scout profile context |

---

## API Endpoints Summary

### Scout Profile Endpoints
| Method | Endpoint | Access |
|--------|----------|--------|
| GET | `/api/scouts/:id` | Scout, Parents, Leaders |
| GET | `/api/scouts/:id/full` | Scout, Parents, Leaders |
| PUT | `/api/scouts/:id` | Scout, Parents, Leaders |
| POST | `/api/scouts/:id/photo` | Scout, Parents |

### Scout Level Endpoints
| Method | Endpoint | Access |
|--------|----------|--------|
| GET | `/api/scout-levels` | All |
| GET | `/api/scout-levels/:code` | All |
| PUT | `/api/troops/:tid/scouts/:sid/level` | Leader |
| POST | `/api/scouts/:id/bridge` | Leader |

### Badge & Achievement Endpoints
| Method | Endpoint | Access |
|--------|----------|--------|
| GET | `/api/badges` | All |
| GET | `/api/scouts/:id/badges` | Scout, Parents, Leaders |
| POST | `/api/scouts/:id/badges` | Leader |
| GET | `/api/scouts/:id/awards` | Scout, Parents, Leaders |
| POST | `/api/scouts/:id/awards` | Leader |

### Dashboard & Activity Endpoints
| Method | Endpoint | Access |
|--------|----------|--------|
| GET | `/api/scouts/me/dashboard` | Scout |
| GET | `/api/scouts/:id/activity` | Scout, Parents, Leaders |
| GET | `/api/scouts/:id/achievements/summary` | Scout, Parents, Leaders |

---

## Frontend Changes

### New Pages
```
/public/
├── scout-profile.html          - Scout profile view/edit
├── scout-dashboard.html        - Scout's personal dashboard
├── scout-badges.html           - Badges and achievements gallery
├── scout-level-info.html       - Girl Scout level information
├── scout-achievements-timeline.html  - Achievement timeline
└── js/
    ├── scout-profile.js        - Profile management logic
    ├── scout-dashboard.js      - Dashboard data and rendering
    └── scout-achievements.js   - Badge and award management
```

### Modified Pages
```
/public/
├── scout-roster.html           - Add scout level visibility, badge icons
├── troop-dashboard.html        - Add achievement summaries
├── index.html                  - Add scout dashboard link for logged-in scouts
└── js/
    ├── common.js               - Add scout level utilities
    └── auth.js                 - Add scout-specific UI elements
```

### New Components
- Scout profile card (with photo, level, badges)
- Scout level badge/icon
- Achievement badges gallery
- Activity timeline component
- Scout progress widget
- Bridging milestone display

---

## Testing Checklist

### Scout Profile
- [ ] User can view their scout profile
- [ ] Scout profile displays correct Girl Scout level
- [ ] Scout can update profile information
- [ ] Scout can upload profile photo
- [ ] Parents can view linked scout's profile
- [ ] Leaders can view scout roster with profiles
- [ ] Profile photo displays correctly in all views

### Scout Levels
- [ ] All 6 Girl Scout levels available (Daisy-Ambassador)
- [ ] Scout level displays with grade and age ranges
- [ ] Troop leader can update scout's level
- [ ] Level change is recorded with bridging date
- [ ] Scout level is shown in roster, dashboard, reports
- [ ] Bridging milestone is recognized and recorded
- [ ] Old level data archived for historical reports

### Badges & Awards
- [ ] Leader can award badge to scout
- [ ] Badge appears in scout's profile and dashboard
- [ ] Scout receives recognition for earned badge
- [ ] Multiple badges display correctly
- [ ] Badge details show requirements (if available)
- [ ] Awards (Gold, Silver, etc.) can be recorded
- [ ] Achievement timeline shows badges earned

### Scout Dashboard
- [ ] Scout sees personalized dashboard
- [ ] Dashboard shows current Girl Scout level
- [ ] Sales progress visible and accurate
- [ ] Earned badges displayed
- [ ] Recent activity shown
- [ ] Quick actions available and functional
- [ ] Dashboard is responsive on mobile

### Privacy & COPPA
- [ ] Scout < 13 requires parental consent to view profile publicly
- [ ] Scout privacy settings enforced
- [ ] Parent can view linked scout's complete profile
- [ ] Other scouts cannot see private information
- [ ] Activity log respects privacy settings
- [ ] Audit trail records who viewed scout's data

### Parent-Scout Relationship
- [ ] Parent can link to scout
- [ ] Scout receives notification of parent link request
- [ ] Scout/parent can approve/reject link
- [ ] Parent sees linked scout's progress
- [ ] Parent can record sales for younger scout
- [ ] Parent receives achievement notifications
- [ ] Multiple parent linking works correctly

### Activity Timeline
- [ ] Significant events recorded in activity log
- [ ] Achievement timeline displays chronologically
- [ ] Activity respects privacy settings
- [ ] Activity summary shows accurate counts
- [ ] Timeline filters work correctly

---

## Acceptance Criteria

1. **Scout profiles are comprehensive and display correctly**
   - Scouts can view and edit their own profiles
   - Parents can view linked scout profiles
   - Leaders can manage scout profiles in roster
   - All profile information is properly secured/encrypted

2. **Girl Scout level system is fully implemented**
   - All 6 levels available (Daisy through Ambassador)
   - Levels can be assigned and updated
   - Bridging process is documented and tracked
   - Level information aids feature availability

3. **Badge and achievement system is functional**
   - Badges can be awarded to scouts
   - Badge catalog available (official GSUSA reference)
   - Scouts see earned badges in profile and dashboard
   - Awards and special recognitions can be recorded

4. **Scout dashboard provides personalized view**
   - Scouts see their progress, badges, and achievements
   - Activity timeline shows recent milestones
   - Quick actions relevant to scout level
   - Mobile-responsive and accessible

5. **Privacy and COPPA compliance maintained**
   - Scout < 13 protected with parental consent
   - Privacy settings respected across system
   - Data access audit trail maintained
   - Sensitive information encrypted

6. **Parent-scout relationship properly managed**
   - Parent linking workflow functional
   - Parents can oversee linked scout(s)
   - Notifications sent for important milestones
   - Multiple parent scenarios supported

---

## Architectural Changes Required in Other Phases

### Changes to Phase 1 (Foundation)

**User Profile Enhancement:**
- Ensure `dateOfBirth`, `photoUrl` are properly used for scouts
- Add scout-specific fields to user registration flow
- Implement scout age verification (already in Phase 2)

### Changes to Phase 2 (Compliance & Security)

**COPPA Enhancement for Scouts:**
- Parent-scout consent specifically linked to scout profile
- Activity logging tracks badge/achievement awards for minors
- Privacy settings need to accommodate scout-specific data (badges, levels)
- Audit logs need scout profile access tracking

**Parent-Scout Linking Enhancement:**
- Link should reference `scout_profiles` table
- Parent notifications should include scout-specific milestones (badges, bridging)
- Parent permissions should reflect scout-specific features

### Changes to Phase 3 (Troop Management)

**Scout Roster Enhancement:**
- Roster display should include scout level badge/icon
- Bulk import should support scout level and profile info
- Scout roster should link to detailed scout profiles
- Leaderboard should include achievement categories

**Troop Dashboard Enhancement:**
- Dashboard widgets should show scout achievement summaries
- Activity feed should include badge achievements
- Alerts should consider scout level capabilities

### Changes to Phase 4 (Booth Events & Inventory)

**Booth Event Participation:**
- Shift assignments should consider scout level
- Scout credit calculation should note scout level at time of event
- Activity log should record booth participation

**Inventory Management:**
- Scout inventory access should consider scout level
- Personal inventory recommendations based on level

### Changes to Phase 5 (Reporting & Analytics)

**Scout Reports:**
- Add badge/achievement reports
- Add level progression tracking
- Add activity timeline reports
- Achievement summaries in scout comparison reports

### Changes to Phase 6 (Mobile & UX)

**Scout Onboarding:**
- Scout profile setup during onboarding
- Girl Scout level selection/confirmation
- Achievement gamification for motivation

**Mobile Dashboard:**
- Scout dashboard should be primary mobile view
- Achievement notifications
- Level-appropriate features

### Changes to Phase 7 (Integrations & API)

**Scout API Endpoints:**
- Public API should support badge queries
- Scout profile exports should include achievements
- Activity timeline export

### Changes to Phase 8 (Scale & Polish)

**Database Optimization:**
- Indexes on `scout_profiles.scoutLevel`
- Indexes on `scout_badges.earnedDate`
- Query optimization for achievement queries

**Caching:**
- Cache scout profile data
- Cache badge catalog
- Cache achievement summaries

---

## Migration Strategy

**For v2.0 to v3.1 Transition:**

1. **Add new tables** (scout_profiles, badges, scout_badges, etc.)
2. **Migrate existing scout users:**
   - Create `scout_profiles` for each scout user
   - Set default level based on existing profile/preferences
   - Initialize bridging history as empty
3. **Seed badge catalog** from GSUSA reference
4. **Maintain backward compatibility:**
   - Existing sales, events, profiles continue to work
   - `troop_members.scoutLevel` remains source of truth during transition
5. **Phase in UI updates** gradually to show new profile features

---

## Dependencies & Prerequisites

**Must complete before Phase 3.1:**
- ✅ Phase 1: Foundation (user management, RBAC)
- ✅ Phase 2: Compliance & Security (COPPA, parent-scout links)
- ✅ Phase 3: Troop Management (troops, scout membership, levels)

**Can proceed in parallel with:**
- Phase 4: Booth Events & Inventory (benefits from scout profiles)
- Phase 5: Reporting & Analytics (uses scout achievement data)

---

## Risk Assessment

### Technical Risks

1. **Badge Catalog Maintenance:**
   - *Risk:* GSUSA badge list changes frequently
   - *Mitigation:* Design for easy badge import/update, provide admin tools

2. **Data Migration Complexity:**
   - *Risk:* Moving scout data to new schema
   - *Mitigation:* Careful scripting, testing with production data backup

3. **Privacy Compliance:**
   - *Risk:* Incorrect enforcement of scout-specific privacy rules
   - *Mitigation:* Thorough testing, audit logging, legal review

### Business Risks

1. **Feature Scope Creep:**
   - *Risk:* Too many badge types and recognition options
   - *Mitigation:* Start with activity/journey badges, add others in v3.2

2. **User Education:**
   - *Risk:* Scouts/parents not understanding level progression
   - *Mitigation:* Clear documentation, in-app help, onboarding tutorial

---

## Cost Estimates

### Development Effort
- Scout profile system: 40-50 hours
- Badge/achievement system: 50-60 hours
- Privacy/COPPA enhancements: 20-30 hours
- Testing and QA: 30-40 hours
- **Total: ~140-180 developer hours**

### Implementation Timeline (Estimate)
- Month 4-5: Design and database schema
- Month 5: API endpoints implementation
- Month 6: Frontend UI development
- Month 6-7: Testing, bug fixes, documentation
- Month 7: Deployment and training

---

## Open Questions

1. **Badge Import Source:** Should badges be imported from official GSUSA API (if available) or manually curated?
2. **Achievement Gamification:** Should system support badges/points for non-official achievements (e.g., "Top Seller Badge")?
3. **Scout Level Flexibility:** Should troops be able to create multi-level badges, or should levels be strictly enforced?
4. **Public Profiles:** Should scouts be able to have public-facing profiles showcasing achievements, or keep everything private?
5. **Badge Evidence:** Should scouts be required to submit proof (photos/certificates) before badge is awarded?
6. **Parent Approval:** Should parent consent be required for all scout profile updates, or just for certain fields?

---

## Next Phase

**Phase 4: Booth Events & Inventory Management** will integrate with Scout Profile Management by:
- Recording scout participation in booth events linked to scout profile
- Using scout level to determine event participation rules
- Tracking achievement milestones during events
- Updating activity timeline with event participation

---

## Document History

**Version:** 1.0
**Created:** 2026-02-01
**Based on:** Phase 3 developer notes, scattered v2.0 roadmap specs
**Extracted from:** PHASE_3_TROOP_MANAGEMENT.md line 672-674
**Status:** Proposed - Ready for Review and Approval

---

## References

- [Girl Scouts of the USA - Badges & Awards](https://www.girlscouts.org/content/dam/gsusa/forms-and-documents/members/highest-awards/Cadette_GSUSA_BadgesAwardsAndPins.pdf)
- [Girl Scouts - Grade Levels](https://www.girlscouts.org/en/discover/about-us/what-girl-scouts-do/grade-levels.html)
- PHASE_3_TROOP_MANAGEMENT.md (Parent document)
- PHASE_1_FOUNDATION.md
- PHASE_2_COMPLIANCE_SECURITY.md

