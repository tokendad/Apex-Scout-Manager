# Apex-Scout-Manager: Hierarchy Definitions & Access Control Design

## 1. Access Control Philosophy: "The Cascade"
The system relies on a **Scope + Role** model.
* **Scope:** Defines *where* a user has power (e.g., Council-wide vs. specific Troop vs. specific Scout).
* **Role:** Defines *what* a user can do within that scope.

This ensures that a **Council Admin** automatically inherits view access to all troops (Scope = All), while a **Parent** is restricted to a specific family unit (Scope = Family).

---

## 2. User Roles & Hierarchy Definitions

### Level 1: Council Admin (Global Scope)   - Not Implemented in the Current v2.  may be a v3 option
* **Authority:** Full Read/Write access to all Troops, Users, and Configurations within the Council.
* **Unique Capabilities:**
    * Create new Troops.
    * Assign Troop Leaders.
    * View aggregate stats.
    * Audit all financial records.

### Level 2: Troop Leader (Troop Admin Scope)
* **Authority:** Full Read/Write access within *their assigned Troop(s)* only.
* **Unique Capabilities:**
    * Edit "Overall Troop Information" (Meeting locations, Troop numbers, Rosters).
    * Assign "Troop Assistant" roles to other parents.
    * View all Scouts' full profiles (Medical, Advancement, Financials).

### Level 3: Troop Assistant / Role-Specific (Limited Troop Scope)
* **General Rule:** "See most, change little." They cannot delete the Troop or change high-level settings (Meeting Times, Locations).
* **Sub-Roles (Derived from Volunteer Guide):**
    * **Treasurer:** Full access to **Finances** module (Bank accounts, Dues, Ledger). *Read-only* for Scout medical/advancement.
    * **Product Manager (Cookie/Fall):** Full access to **Sales/Inventory** module. Can edit Scout sales numbers.
    * **First Aider:** View-only access to **Medical/Emergency** records. No edit access to Roster or Finance.
    * **Camping Coordinator:** Full access to **Events/Trips** module (create trips, manage permission slips).
    * **Troop Support / Activity Helper:** Read-only access to Calendar and Roster (Names/Parents only, hidden PII). Can take **Attendance**.

### Level 4: Parent (Family Scope)
* **Authority:** Access restricted strictly to data linked to their `FamilyID`.
* **Capabilities:**
    * View own children's progress, events, and financial balance.
    * Edit own contact info and children's medical info (with audit log).
    * **Cannot** see other Scouts' data.

### Level 5: Scout (Self Scope)
* **Authority:** Read-only access to their own profile.
* **Capabilities:** View calendar, badge progress, and sales goals.

---

## 3. Database Design (Schema Hints)

To implement this, you need a flexible schema that separates the *User* from their *Access*.

**Table: `Users`**
* `id`, `email`, `password_hash`, `display_name`

**Table: `Troops`**
* `id`, `troop_number`, `council_id`, `meeting_location`

**Table: `Roles`**
* `id`, `name` (e.g., "Troop_Leader", "Treasurer", "Parent")
* `permissions` (JSON or Bitmask of granular rights: `{"can_edit_troop_info": false, "can_view_medical": true}`)

**Table: `User_Assignments` (The Core Logic)**
* `user_id` (FK)
* `scope_id` (FK -> refers to a Troop ID, Council ID, or Family ID)
* `scope_type` (Enum: "COUNCIL", "TROOP", "FAMILY")
* `role_id` (FK)

*Why this design?* It allows one user (e.g., a parent who is also a Treasurer for a different troop) to have multiple roles with a single login.

---

## 4. Permissions Matrix

| Feature / Module | Council Admin | Troop Leader | Treasurer | Product Mgr | First Aider | Parent |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Troop Settings** (Loc/Time) | **Edit** | **Edit** | View | View | View | View |
| **Roster** (Add/Remove Scout) | **Edit** | **Edit** | View | View | View | View (Own) |
| **Finances** (Ledger/Bank) | **Audit** | **Edit** | **Edit** | View | No Access | View (Own) |
| **Medical Records** | View | View | No Access | No Access | **View** | **Edit (Own)** |
| **Events/Trips** | View | **Edit** | View | View | View | View/RSVP |
| **Advancement** (Badges) | View | **Edit** | View | View | View | View (Own) |
| **Sales** (Cookies/Popcorn) | View | **Edit** | View | **Edit** | View | Edit (Own) |

---

## 5. Implementation Logic (Pseudo-Code)

When a user requests a resource (e.g., `GET /troop/55/settings`), the backend middleware should run this check:

```python
def check_access(user, resource_type, resource_id, required_action):
    # 1. Fetch User's Assignment for this context
    assignment = get_assignment(user, scope_id=resource_id)

    # 2. Hierarchy Bypass
    if user.is_council_admin():
        return True

    # 3. Scope Check
    if not assignment:
        return False # User has no relationship with this Troop

    # 4. Role Capability Check
    role = assignment.role
    if role.has_permission(required_action):
        return True

    return False


    UI/UX Considerations

        Troop Leader Dashboard: Show "Quick Actions" for Emailing Roster, Editing Meeting, and Financial Overview.

        Assistant Dashboard: Hide the "Edit Troop Settings" gear icon. If a Treasurer logs in, their dashboard specifically highlights the "Finances" tab.

        Parent Dashboard: Default to a "My Family" view showing a card for each child with their upcoming events and badge progress.
