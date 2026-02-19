# GSCTracker Version Roadmap

**Document Purpose:** Strategic roadmap tracking product evolution from Girl Scouts (V2.0) through multi-organization support (V3, V4). This document provides architecture guidance and forward-compatibility considerations for all phase development.

**Standing Direction for Claude:** When working on any phase, reference this document to identify future considerations and ensure architectural decisions don't prevent multi-organization support.

---

## Version Overview

### **V2.0: Girl Scouts Foundation** (Current Development)
**Status:** In Progress (Phases 1-8)
**Focus:** Multi-user Girl Scout cookie sales tracking with troop-level management
**Scope:** Girl Scouts of the USA only

**Key Features:**
- Multi-user authentication and COPPA compliance (Phase 1-2) - **COMPLETE**
- Troop management and Girl Scout levels (Phase 3) - **COMPLETE**
- Scout profile management (Phase 3.1) - **COMPLETE**
- Badge System (Phase 3.2) - **COMPLETE**
- Admin Panel (Phase 3.3+) - **COMPLETE**
- Booth event tracking and inventory (Phase 4) - **IN PROGRESS** (Field-Ready mode added)
- Fulfillment and Shared Inventory (Phase 4.5) - **COMPLETE**
- Reporting and analytics (Phase 5) - **IN PROGRESS** (Visual progress added)
- Parent & Compliance UX (Phase 5.5) - **COMPLETE**
- Mobile & UX (Phase 6) - **IN PROGRESS** (Lucide icons, Glassmorphism, Modular Refactor)
- Integrations & API (Phase 7)
- Scale & optimization (Phase 8)

**Deployment Target:** Single organization (Girl Scouts)

---

### **V3: Scouting America Integration** (Future - Not Immediate)
**Status:** Planning phase
**Focus:** Add Scouting America (formerly Boy Scouts) alongside Girl Scouts
**Estimated Timeline:** 12-18 months after V2.0 completion

**Scope Addition:**
- **Cub Scouts Program:**
  - Lion, Tiger, Wolf, Bear, Webelos, Arrow of Light levels
  - Adventure-based progression
  - Different badge/advancement systems

- **Scouts BSA Program:**
  - Scout through Eagle Scout ranks
  - Merit badge system (different from Girl Scout badges)
  - Troop structure and positions

- **Venturers & Other Programs:**
  - Additional program types as needed

**User Experience:**
- Organization mode selector (Girl Scouts vs Scouting America)
- User can manage troops in different organizations
- Organization-specific rules and features

**Compliance:**
- Support for both male and female scouts
- Scouting America privacy and membership policies
- Different COPPA considerations (may vary by program)

---

### **V4: Other Scouting Organizations** (Future - Further Out)
**Status:** Vision/planning
**Focus:** Add support for additional scouting organizations
**Estimated Timeline:** 18-24 months after V3 completion

**Scope Addition:**
- **Navigators USA** - https://www.navigatorsusa.org/
- **Outdoor Service Guides** - https://outdoorserviceguides.org/
- **Camp Fire** - https://campfire.org/
- Additional organizations as identified

**End State:**
- Unified platform for multiple scouting organizations
- Generic multi-organization architecture
- Organization-agnostic core with pluggable organization-specific features

---

## Architecture Considerations for Multi-Organization Support

### Critical Design Points (for V3/V4 Future-Proofing)

#### 1. User & Profile Identity

**V2.0 Current:** Scout = Girl Scout member

**V3/V4 Consideration:**
```
Scout ← Organization Membership
  ├── Girl Scout (GSUSA)
  │   ├── Daisy, Brownie, Junior, Cadette, Senior, Ambassador
  │   └── Cookie sales context
  └── Scouting America (BSA)
      ├── Cub Scout (Lion, Tiger, Wolf, Bear, Webelos, Arrow of Light)
      ├── Scout (Scouts BSA): Scout → Tenderfoot → Second Class → First Class → ...
      └── Venturers & other programs
```

**V2.0 Implementation Notes:**
- ✅ Keep user identity separate from organization
- ✅ `users` table stores base user (name, email, DOB, photo)
- ⚠️ **V3 Consideration:** User will have multiple organization memberships
- ⚠️ **V3 Refactor Point:** Create `organization_memberships` table linking users to orgs

**Database Future-Proofing:**
```sql
-- V2.0: Current structure (organization-agnostic user)
CREATE TABLE users (
    id PRIMARY KEY,
    email TEXT,
    firstName TEXT,
    lastName TEXT,
    dateOfBirth TEXT,
    photoUrl TEXT,
    -- NO organization-specific fields in base user table ✓
);

-- V3: Will add this (keeping user table unchanged)
CREATE TABLE organization_memberships (
    id PRIMARY KEY,
    userId REFERENCES users(id),
    organizationId REFERENCES organizations(id),
    memberId TEXT,  -- Organization-specific ID
    joinDate TEXT,
    status TEXT
);
```

#### 2. Levels, Ranks, and Progression

**V2.0 Current:** Girl Scout Levels
- Daisy, Brownie, Junior, Cadette, Senior, Ambassador
- Based on grade/age
- Simple progression (one level per year)

**V3/V4 Consideration:** Different progression systems
- Scouting America: Rank-based, merit badge focused
- Cub Scouts: Level-based but different (Lion → Arrow of Light)
- Navigators/Camp Fire: Potentially different systems
- Some organizations: Non-linear progression (can earn badges in different order)

**Current V2.0 Approach:**
- Scout levels stored in `troop_members.scoutLevel`
- Levels defined in Phase 3: Daisy, Brownie, etc.

**V3 Refactoring Point:**
```sql
-- V3 Will introduce generic level system
CREATE TABLE level_definitions (
    id PRIMARY KEY,
    organizationId REFERENCES organizations(id),
    levelCode TEXT,         -- daisy, brownie, lion, tiger, scout, tenderfoot, etc.
    displayName TEXT,
    ageRange TEXT,
    gradeRange TEXT,
    progressionOrder INTEGER,  -- For sorting
    organizationSpecificData JSON
);

-- V2.0 workaround: Keep girl_scout_levels table separate
CREATE TABLE girl_scout_levels (
    levelCode TEXT PRIMARY KEY,
    displayName TEXT,
    ageRange TEXT,
    gradeRange TEXT,
    uniformColor TEXT
);
```

**V2.0 Standing Direction for Claude:**
- ✅ Store levels in a way that's easy to query by organization (use levelCode, not numeric ID)
- ✅ Avoid hardcoding level names - reference level definitions
- ⚠️ Don't create calculations based on Girl Scout level order - will break in V3

#### 3. Badges, Merit Badges, and Achievement Systems

**V2.0 Current:** Girl Scout Badges
- Activity badges, Journey badges, Highest awards
- GSUSA official + custom badges
- Stored in `badges` and `scout_badges` tables

**V3/V4 Consideration:** Different badge/achievement systems
- Scouting America: Merit badges (100+ different badges)
- Different earning requirements and verification process
- Cub Scouts: Adventures (different from badges)
- Different visual representation and organization

**V2.0 Implementation:**
Phase 3.1 creates badge system with:
- `badges` table (badge catalog)
- `scout_badges` table (individual scout's earned badges)
- Badge types: activity, journey, award, honor, special

**V3 Refactoring Point:**
```sql
-- Add badge system type to identify achievement paradigm
ALTER TABLE badges ADD COLUMN badgeSystemType TEXT;
-- Values: 'girl_scout_badge', 'scouting_america_merit', 'cub_scout_adventure', etc.

-- Keep badge earning flexible
-- scout_badges table remains, but can store different badge types
```

**V2.0 Standing Direction for Claude:**
- ✅ Design badges as organization-agnostic (could be any achievement type)
- ✅ Use `badgeSystemType` field even in V2 (prepares for V3)
- ✅ Store badge requirements as flexible JSON/text (don't assume Girl Scout structure)
- ⚠️ Don't assume Girl Scout-specific earning logic (e.g., "Journey takes 4 meetings")

#### 4. Troop Structure and Leadership Positions

**V2.0 Current:** Girl Scout Troop
- Scout, Parent, Troop Leader, Cookie Leader
- Flat structure for cookie sales focus

**V3/V4 Consideration:** Scouting America has complex troop structures
```
Scouting America Scout Troop:
├── Scoutmaster (primary leader)
├── Assistant Scoutmaster(s)
├── Scribe
├── Quartermaster
├── Patrol Leaders
├── Senior Patrol Leader
└── Troop Committee
    ├── Committee Chair
    ├── Committee Vice Chair
    └── Multiple committee members
```

Cub Scouts:
```
Cub Scout Pack:
├── Cubmaster
├── Assistant Cubmaster(s)
├── Den Leader(s)
├── Assistant Den Leader(s)
└── Pack Committee
```

**V2.0 Implementation:**
- `troop_members` table with `role` field
- Roles: scout, parent, troop_leader, cookie_leader

**V3 Refactoring Point:**
```sql
-- Keep flexible role system
CREATE TABLE organization_roles (
    id PRIMARY KEY,
    organizationId REFERENCES organizations(id),
    roleCode TEXT,          -- troop_leader, scoutmaster, cubmaster, etc.
    displayName TEXT,
    permissions JSON        -- Organization-specific permissions
);

-- V2.0 can use flexible role strings
-- V3 will replace with organization-specific roles
```

**V2.0 Standing Direction for Claude:**
- ✅ Keep roles flexible (use text, not enum)
- ✅ Store permissions by role (don't hardcode per role name)
- ⚠️ Don't assume Girl Scout troop structure applies to all organizations

#### 5. Sales/Activity Tracking

**V2.0 Current:** Cookie sales focused
- Sales table tracks cookie boxes sold
- Cookie products specific to Girl Scouts

**V3/V4 Consideration:** Different organization activities
- Scouting America: Fundraising (camp fees, activity fees, not cookies)
- Different products/activities by organization
- Different tracking requirements and reporting

**V2.0 Implementation:**
- `sales` table for cookie transactions
- `cookie_products` table for product catalog
- `booth_events` for sales events

**V3 Refactoring Point:**
```sql
-- Keep sales generic enough for other activities
ALTER TABLE sales ADD COLUMN activityType TEXT;
-- Values: 'cookie_sale', 'fundraising_activity', etc.

-- V2.0 can continue with cookie_products
-- V3 can create organization-specific activity catalogs
```

**V2.0 Standing Direction for Claude:**
- ✅ Don't assume all activities are cookie sales
- ✅ Structure `sales` table to support other transaction types
- ✅ Keep `cookie_products` Girl Scout specific (will be replaced/generalized in V3)
- ⚠️ Document assumptions about cookie sales in code comments

#### 6. Privacy, COPPA, and Compliance

**V2.0 Current:** COPPA compliance for Girl Scouts (many under 13)

**V3/V4 Consideration:** Different compliance requirements
- Scouting America: Different age distribution (Cub Scouts go up to age 11, then Scouts BSA 11-18)
- Different privacy policies per organization
- Different consent requirements
- Possibly different country/region requirements

**V2.0 Implementation:**
Phase 2 creates:
- Age verification (`dateOfBirth`)
- Parental consent flow for < 13
- Audit logging for minor data access

**V3 Refactoring Point:**
```sql
-- Add organization-specific compliance context
ALTER TABLE users ADD COLUMN organizationComplianceProfile TEXT;

-- V3 can define compliance rules per organization
CREATE TABLE organization_compliance (
    organizationId PRIMARY KEY,
    minorAgeThreshold INTEGER,  -- When parental consent required
    dataRetentionDays INTEGER,
    privacyPolicyUrl TEXT
);
```

**V2.0 Standing Direction for Claude:**
- ✅ Implement COPPA compliance generally (not hardcoded to Girl Scouts)
- ✅ Use `dateOfBirth` and `isMinor` - will work for other organizations
- ✅ Keep audit logging organization-agnostic
- ⚠️ Don't assume all organizations have same minor age threshold (13)

#### 7. Reporting and Analytics

**V2.0 Current:** Girl Scout sales focus
- Sales summaries, goal tracking, leaderboards
- Cookie-type breakdowns
- Scout achievement recognition

**V3/V4 Consideration:** Different metrics per organization
- Scouting America: Merit badge advancement, rank progression
- Different KPIs and success metrics
- Different reporting requirements

**V2.0 Implementation:**
Phase 5 creates:
- Scout-level sales reports
- Troop-level summaries
- Achievement tracking

**V3 Refactoring Point:**
```sql
-- Keep reports organization-agnostic where possible
-- Sales reports will generalize to activity reports
-- Achievement reports remain flexible (badges vs. ranks vs. adventures)
```

**V2.0 Standing Direction for Claude:**
- ✅ Design reports to be organization-agnostic (activity, achievements, etc.)
- ✅ Don't hardcode "cookies" in report templates
- ✅ Make metrics configurable where possible
- ⚠️ Document which reports are Girl Scout specific

---

## Feature Comparison Matrix (for Reference)

| Feature | V2.0 (Girl Scouts) | V3 (+ Scouting America) | V4 (+ Others) |
|---------|-------------------|------------------------|---------------|
| **Organization Modes** | 1 (GSUSA) | 2 (GSUSA, BSA) | 4+ (GSUSA, BSA, Navigators, OSG, Camp Fire) |
| **Program Types** | 1 (Girl Scouts) | 3 (Girls, Cubs, Scouts, Venturers) | Multiple per org |
| **Level System** | Age-based progression | Rank-based progression | Organization-specific |
| **Achievement Type** | Badges | Badges + Merit Badges + Adventures | Various systems |
| **Sales Focus** | Cookie-specific | Activity-based (fundraising) | Organization-specific |
| **Troop Structure** | Simple (4 roles) | Complex (10+ roles) | Variable |
| **User Base** | Primarily girls/women | Girls & boys | Mixed |
| **Privacy Model** | COPPA-centric | Age-range specific | Organization-specific |
| **Core Database** | Single-org schema | Multi-org schema | Pluggable schema |

---

## Phase-by-Phase Forward-Compatibility Checklist

### Phase 1: Foundation (User Management)
**V2.0 Focus:** Girl Scout user accounts, RBAC
**V3/V4 Considerations:**
- [ ] User identity separate from organization
- [ ] Role system flexible (not hardcoded to Girl Scouts)
- [ ] `dateOfBirth` and `isMinor` generic enough for all ages
- [ ] No Girl Scout-specific fields in core `users` table

### Phase 2: Compliance & Security
**V2.0 Focus:** COPPA for scouts < 13
**V3/V4 Considerations:**
- [ ] Age-based rules not hardcoded to 13 (make configurable)
- [ ] Parent consent flow organization-agnostic
- [ ] Privacy settings flexible for different age groups
- [ ] Audit logging organization-agnostic

### Phase 3: Troop Management
**V2.0 Focus:** Girl Scout troop hierarchy
**V3/V4 Considerations:**
- [ ] Troop table not Girl Scout specific
- [ ] Role system flexible for different org structures
- [ ] Don't assume one troop per person
- [ ] Level system in separate table (not hardcoded)

### Phase 3.1: Scout Profile Management
**V2.0 Focus:** Girl Scout levels, badges
**V3/V4 Considerations:**
- [ ] Level system queryable by organization
- [ ] Badge system supports different badge types
- [ ] Achievement categories extensible
- [ ] Profile structure works for male/female scouts
- [ ] Document Girl Scout-specific assumptions

### Phase 4: Booth Events & Inventory
**V2.0 Focus:** Cookie booth sales tracking
**V3/V4 Considerations:**
- [ ] Sales table generic (support other activity types)
- [ ] Inventory generic (not cookie-specific)
- [ ] Event structure flexible for different activities
- [ ] Don't assume cookie-specific rules apply to all orgs

### Phase 5: Reporting & Analytics
**V2.0 Focus:** Sales goals, leaderboards, achievements
**V3/V4 Considerations:**
- [ ] Reports organization-agnostic titles
- [ ] Metrics not hardcoded to cookies
- [ ] Achievement reports flexible
- [ ] Export formats generic

### Phase 6: Mobile & UX
**V2.0 Focus:** Scout-focused dashboard and onboarding
**V3/V4 Considerations:**
- [ ] UI supports mode/organization switching
- [ ] Onboarding organization-agnostic
- [ ] Dashboard structure works for multiple program types
- [ ] Branding supports multiple organizations

### Phase 7: Integrations & API
**V2.0 Focus:** Scout APIs, badge endpoints
**V3/V4 Considerations:**
- [ ] API versioning strategy (v1 = Girl Scouts only, v2 = multi-org)
- [ ] Endpoints support organization filtering
- [ ] Webhooks organization-specific
- [ ] Documentation notes Girl Scout focus

### Phase 8: Scale & Optimization
**V2.0 Focus:** Performance for single organization
**V3/V4 Considerations:**
- [ ] Indexes support multi-org queries
- [ ] Caching strategy handles organization context
- [ ] Query patterns work at multi-org scale
- [ ] Database partitioning by organization considered

---

## V3 Planning Notes (Not Immediate)

When V3 development begins, prioritize:

1. **Multi-Organization Infrastructure**
   - Organizations table and membership system
   - Organization-specific configuration
   - Mode switching UI

2. **Scouting America Program Integration**
   - Cub Scouts levels and adventures
   - Scouts BSA ranks and merit badges
   - Male/female scout support

3. **Troop Structure Unification**
   - Support for complex organizational structures
   - Organization-specific roles and permissions

4. **Level/Badge System Abstraction**
   - Generic level definitions
   - Organization-specific badge/achievement types
   - Flexible progression models

5. **Activity Tracking Generalization**
   - Support for non-cookie activities
   - Organization-specific transaction types

6. **Compliance Flexibility**
   - Organization-specific privacy policies
   - Configurable age-based rules
   - Multi-region support

---

## Standing Directions for Development Teams

### When Working on ANY Phase

1. **Check This Document First**
   - Review V3/V4 considerations for your phase
   - Identify forward-compatibility requirements

2. **Design for Multi-Organization (Even in V2)**
   - Don't hardcode Girl Scout assumptions
   - Use organization-agnostic names/fields where possible
   - Document Girl Scout-specific logic in comments

3. **Keep Organization Context Flexible**
   - Use organization IDs/codes, not hardcoded strings
   - Make role systems extensible
   - Design levels/badges as pluggable

4. **Plan for Future Refactoring**
   - Identify tables that will need organization context in V3
   - Add extensible fields (JSON columns) for future use
   - Document refactoring points clearly

5. **Test with Organization Context in Mind**
   - Use test data that works for multiple organizations
   - Don't assume single-organization logic
   - Test with organization-specific variations

### Documentation Requirements

- **Add to Phase Docs:** "V3/V4 Forward-Compatibility Considerations" section
- **Mark Code Comments:** `// V3: This will change for multi-org support`
- **Track Refactoring Points:** Document tables/functions needing changes in V3

---

## Success Criteria for Version Roadmap

**By End of V2.0 Development:**
- ✅ All phases reference forward-compatibility considerations
- ✅ No hardcoded Girl Scout assumptions in core systems
- ✅ Database schema ready for multi-organization in V3
- ✅ Clear documentation of refactoring points
- ✅ Team understands multi-organization vision

**By V3 Start:**
- ✅ Database migration plan documented
- ✅ Multi-org infrastructure designed
- ✅ Scouting America requirements detailed
- ✅ Backward compatibility approach defined

---

## Document Management

**Last Updated:** 2026-02-01
**Maintained By:** Development Team
**Review Frequency:** Quarterly or when new version planning begins
**Related Documents:**
- `/docs/v2 Implementation/` - Current version phases
- `/docs/v3 Project Documentation/overview.md` - V3 vision
- `/docs/v4 Project Documentation/overview.md` - V4 vision

---

## Standing Direction for Claude Code

When working on any phase documentation or implementation:

1. **Always reference this Version Roadmap** for context on future multi-organization support
2. **Highlight V3/V4 refactoring points** in phase documents
3. **Design systems to be organization-agnostic** even when building Girl Scout features
4. **Document Girl Scout-specific logic** clearly so future developers understand what will change
5. **Avoid architectural decisions** that would prevent multi-organization support
6. **Consider flexible schemas** that can accommodate different organizations' requirements

This ensures V2.0 is built on a foundation ready for V3's expansion to Scouting America and V4's support for additional organizations.

