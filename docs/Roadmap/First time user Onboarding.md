# First Time User Self-Registration & Onboarding

## Implementation Task List

- [ ] **Phase 1: Database & Backend Core**
    - [ ] Update `Users` table schema (add `status`, `organization_id`, `unit_id`).
    - [ ] Create `MembershipRequests` table (user_id, unit_id, role_intent, status, scout_names_intent).
    - [ ] Create `TroopCreationRequests` table for new units.
    - [ ] API: Endpoint to `GET /api/organizations` and `GET /api/units` (searchable).
    - [ ] API: Endpoint to `POST /api/onboarding/join-request` (submit request).
    - [ ] API: Endpoint to `POST /api/onboarding/create-troop` (submit new troop).
    - [ ] API: Middleware to enforce "Limbo" state restrictions on existing endpoints.

- [ ] **Phase 2: Frontend - The Onboarding Wizard**
    - [ ] Design/Build "Limbo" Dashboard layout (Empty state with call-to-actions).
    - [ ] Implement "Welcome" Modal/Wizard for new users.
    - [ ] Implement "Organization & Troop Selector" step (search & select).
    - [ ] Implement "Role & Scout Claim" step (form input).
    - [ ] Implement "Wait Screen" (visual feedback for pending state).

- [ ] **Phase 3: Profile Page Enhancements**
    - [ ] Expand Profile form to include all new personal fields (Emergency contacts, address, etc.).
    - [ ] Add Profile Picture upload/cropping functionality.
    - [ ] Ensure Profile page is fully accessible in "Limbo" state.

- [ ] **Phase 4: Leadership Tools**
    - [ ] Build "Pending Members" Widget for Troop Leaders.
    - [ ] Create "Approve/Deny" Modal flow for Leaders.
    - [ ] Implement "Link to Scout" logic (Select existing vs. Create new Scout).
    - [ ] Build "Troop Approval" Admin Interface for System Admins.

- [ ] **Phase 5: Notifications & Polish**
    - [ ] Implement Email/In-App notifications for Leaders (New Request).
    - [ ] Implement Email/In-App notifications for Users (Request Approved/Denied).
    - [ ] Final Security Review (Verify unapproved users cannot access unit data).

---

## 1. Overview & Goals

**Goal:** Streamline the process for new users (parents, volunteers, potential leaders) to join the platform, affiliate with an organization, and connect with their specific unit (Troop/Pack/Crew) while ensuring security and verification through unit leadership.

**Current Problem:** Currently, new users created via Google OAuth or manual registration land in a "Limbo" state without clear direction or permissions.

**Solution:** Implement a dedicated "Onboarding Wizard" and a "Pending Approval" state that guides users to complete their profile and request access to a specific unit.

## 2. User States & Roles

### 2.1. The "Limbo" State (Unverified User)
*   **Definition:** A user who has authenticated (logged in) but has not been assigned a role or attached to a Troop/Unit.
*   **Access:**
    *   **Can:** View and edit their own Personal Profile.
    *   **Can:** Search for and request to join a Troop.
    *   **Can:** Request to start a new Troop (requires Admin approval).
    *   **Cannot:** View events, financial data, other member details, or inventory.
*   **UI Experience:** Dashboard is restricted. Main content area displays a "Complete Your Setup" call-to-action or the status of their pending request.

### 2.2. Roles
*   **Troop Leader:** Can approve new members, assign roles, and manage the unit.
*   **Co-Leader / Volunteer:** specific permissions granted by the Leader.
*   **Parent/Guardian:** Linked to one or more Scouts. Can manage scout details and sales (if enabled).
*   **Scout:** (Future/Optional) Limited access for the youth member themselves.
*   **System Admin:** Global administrator who approves new Troop creations.

## 3. User Flows

### 3.1. Flow A: New Member Joining Existing Troop
1.  **Registration:** User signs up (Google/Email).
2.  **Organization Selection:**
    *   User selects Organization (e.g., "Girl Scouts USA", "Scouts BSA", "Cub Scouts").
    *   *System filters available Troops based on this selection.*
3.  **Troop Search/Selection:**
    *   User searches by Troop Number, Zip Code, or Council.
    *   User selects "Join this Troop".
4.  **Role Indication:**
    *   User indicates their intent: "I am a Parent", "I am a Volunteer", etc.
    *   *Optional:* If "Parent", they can input the name of their Scout(s) immediately to help the Leader identify them.
5.  **Pending State:**
    *   User sees: "Request Sent to Troop Leader [Name]. Please update your profile while you wait."
    *   Troop Leader receives Notification (In-App, Email, optional SMS).
6.  **Approval:**
    *   Leader views request in "Pending Members" list.
    *   Leader approves and assigns specific role(s) (e.g., "Parent of Scout X" and "Cookie Chair").
    *   *Logic:* If the User claimed a Scout that exists, Leader confirms the link. If Scout doesn't exist, Leader can "Create & Link" in one step.

### 3.2. Flow B: New Troop Leader (Creating a Troop)
1.  **Registration:** User signs up.
2.  **Selection:** Selects Organization -> Selects "Create a New Troop".
3.  **Troop Details:** Inputs Council Name, District (optional), Troop Number, Location.
4.  **Verification:**
    *   Request goes to **System Admin** (Super User).
    *   User sees: "Troop creation pending verification."
5.  **Approval:**
    *   System Admin verifies the validity of the request.
    *   Upon approval, the User becomes the first "Troop Leader" of that new unit.

## 4. UI/UX Requirements

### 4.1. The Onboarding Wizard (Modal/Overlay)
*   **Step 1: Welcome.** "Welcome to Apex Scout Manager. Let's get you set up."
*   **Step 2: Who are you?** Simple cards for "Parent/Volunteer" vs "Troop Leader".
*   **Step 3: Find your Unit.** Auto-complete dropdown for Organization. Search bar for Troop Number.
*   **Step 4: Request Access.** Comments field (e.g., "Hi, I'm Timmy's dad").

### 4.2. Restricted Dashboard (Limbo View)
*   **Navigation:** All tabs disabled/hidden except "Profile" and "Home".
*   **Home Tab:**
    *   Status Card: "Waiting for approval from Troop 123."
    *   Action Item: "Complete your Profile."
    *   Action Item: "Add Payment Method" (for dues/fees).

### 4.3. Profile Page Improvements
The Profile page is the *only* fully functional area for a new user. It must capture:
*   **Personal Info:** Name, Profile Picture (upload/crop).
*   **Contact:** Cell Phone, Home Phone, Email.
*   **Emergency Info:** Emergency Contact Name/Relation/Phone.
*   **Family:** Spouse/Partner information.
*   **Address:** Physical address (for carpooling/forms).
*   **Preferences:** "Available for volunteering?" toggle.

### 4.4. Leader's "Pending Approvals" Widget
*   Located on the Leader's Dashboard.
*   List of pending users.
*   **Actions:**
    *   **Approve:** Opens modal to assign Role and Link to Scout.
    *   **Deny:** Removes request (requires reason).
    *   **Message:** Email the user back for clarification.

## 5. Data & Notifications

### 5.1. Notifications
*   **To Leader:** "New Member Request: [User Name] wants to join Troop [ID]."
*   **To User:** "Welcome! Your request to join Troop [ID] has been approved."
*   **To Admin:** "New Troop Creation Request: [Troop Details]."

### 5.2. Data Model Implications
*   `Users` table needs a `status` field (Active, Pending, Disabled).
*   `Users` table needs an `organization_id` and `unit_id` (nullable until approved).
*   New `TroopRequests` or `MembershipRequests` table to track the "Limbo" state link between a User and a Troop before approval.

## 6. Security & Compliance (COPPA)
*   **Minors:** If a user indicates they are under 13 (unlikely for the primary account holder, but possible for Scouts), strict COPPA flows must trigger.
*   *Assumption:* Primary account holders are adults (Parents/Guardians).
*   **Visibility:** Unapproved users cannot see *any* data about the Troop or its members to prevent social engineering or stalking. They can only see the Troop Number they applied to.
