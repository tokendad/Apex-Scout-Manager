# Account Access Schema

## Global User Roles (`users.role`)

| Role | Level | Description |
| :--- | :---: | :--- |
| scout | 1 | Default for new registrations. Individual youth member. |
| parent | 1 | Parent/guardian of a scout (COPPA compliance). Primary login for minors under 18. |
| volunteer | 1 | Troop volunteer with no default access to personal data. |
| troop_leader | 2 | Adult leader managing a troop. Highest operational role (scoped to own troop). |
| council_admin | 3 | Regional council administrator with system-wide access across all troops. |

*Plus a hardcoded superuser bypass for `welefort@gmail.com` that skips all role checks during development.*

---

## Troop-Level Roles (`troop_members.role`)

When a user joins a troop they receive a secondary context role within that troop:

| Troop Role | Typical Global Role | Description |
| :--- | :--- | :--- |
| member | scout | Regular scout or participant |
| parent | parent | Parent/guardian linked to a scout in this troop |
| volunteer | volunteer | Adult volunteer helper |
| assistant | volunteer/troop_leader | Assists leaders (Den Assistant, Asst. Scoutmaster, etc.) |
| co-leader | troop_leader | Co-manages the troop with the primary leader |
| cookie_leader | troop_leader/volunteer | Manages fundraising sales logistics for the troop |
| troop_leader | troop_leader | Primary leader of the troop |

---

## Frontend Tab Visibility

| Tab | Visible To |
| :--- | :--- |
| Profile, Calendar, Settings | All authenticated users |
| Troop | `troop_leader` + `council_admin` |
| Council | `council_admin` only |

---

## Privilege System

Privileges control what actions a user can perform within a troop context. Each privilege is **defaulted by role** but can be **overridden per-user** by a troop leader or council admin. No user can grant themselves privileges — only a higher-level person can modify another user's access.

### Scope Levels

Each privilege operates at one of these scope levels, determining how broadly it applies:

| Scope | Meaning |
| :--- | :--- |
| **Troop** | Applies to all members of the troop/pack |
| **Den/Patrol** | Applies only to members of a specific den or patrol |
| **Household** | Applies only to the user's linked parent/scout accounts |
| **Self** | Applies only to the user's own data |
| **None** | No access |

---

### Privilege Definitions

Privileges are grouped by the current program features they control.

#### Troop & Member Management

| Privilege | Code | Description |
| :--- | :--- | :--- |
| View troop roster | `view_roster` | View troop member list (names, roles, contact info) |
| Manage troop members | `manage_members` | Add, edit, remove, or transfer troop members |
| Manage troop settings | `manage_troop_settings` | Edit troop name, meeting location/time, organization |
| Send invitations | `send_invitations` | Invite new members to the troop via email |
| Import roster | `import_roster` | Bulk import members from CSV/XLSX files |
| Manage member roles | `manage_member_roles` | Change a member's troop role or position |
| Manage privileges | `manage_privileges` | Grant or revoke individual privileges for troop members |

#### Scout Profiles & Advancement

| Privilege | Code | Description |
| :--- | :--- | :--- |
| View scout profiles | `view_scout_profiles` | View scout profile details (level, organization, status) |
| Edit scout level | `edit_scout_level` | Promote or change a scout's rank/level |
| Edit scout status | `edit_scout_status` | Set a scout to active, inactive, transferred, or graduated |
| Award badges | `award_badges` | Award earned badges to scouts and record verification |
| View badge progress | `view_badge_progress` | View available and earned badges for scouts |
| Edit personal info | `edit_personal_info` | Modify a scout's or parent's personal information (name, address, phone) |

#### Calendar & Events

| Privilege | Code | Description |
| :--- | :--- | :--- |
| View events | `view_events` | View troop calendar events |
| Manage events | `manage_events` | Create, edit, and delete troop calendar events |
| Export calendar | `export_calendar` | Export troop calendar as .ics file |

#### Fundraising & Sales *(not yet reimplemented — future)*

| Privilege | Code | Description |
| :--- | :--- | :--- |
| View sales data | `view_sales` | View sales records (own or troop-wide based on scope) |
| Record sales | `record_sales` | Add new individual sale entries |
| Manage fundraisers | `manage_fundraisers` | Create/edit fundraiser campaigns, manage products, track sales |
| View troop sales | `view_troop_sales` | View aggregated sales data across all troop members |
| View financial accounts | `view_financials` | Read-only access to troop financial summaries |
| Manage financial accounts | `manage_financials` | Add debits/credits to troop or youth money accounts |

#### Donations

| Privilege | Code | Description |
| :--- | :--- | :--- |
| View donations | `view_donations` | View donation records |
| Record donations | `record_donations` | Add new donation entries |
| Delete donations | `delete_donations` | Remove donation records |

#### Troop Goals & Reporting

| Privilege | Code | Description |
| :--- | :--- | :--- |
| View goals | `view_goals` | View troop goals and progress |
| Manage goals | `manage_goals` | Create, edit, and delete troop goals |
| View leaderboard | `view_leaderboard` | View member performance leaderboard |

#### Data & Settings

| Privilege | Code | Description |
| :--- | :--- | :--- |
| Manage payment methods | `manage_payment_methods` | Add/remove personal payment links (Venmo, PayPal, etc.) |
| Import data | `import_data` | Bulk import sales data from XLSX |
| Export data | `export_data` | Export personal or troop data |
| Delete own data | `delete_own_data` | Permanently delete own sales, donations, and profile data |

#### Council Administration *(council_admin only)*

| Privilege | Code | Description |
| :--- | :--- | :--- |
| Manage seasons | `manage_seasons` | Create and activate sales seasons |
| Manage product catalog | `manage_products` | Create, update, and deactivate fundraising products |
| View all troops | `view_all_troops` | View all troops across the council |
| Manage all troops | `manage_all_troops` | Full administrative access to any troop's data |

---

### Default Privileges by Role

The following matrix defines which privileges each role receives **by default**. Troop leaders and council admins can override individual privileges for specific users.

**Scope key:** T = Troop, D = Den/Patrol, H = Household, S = Self, — = None

#### Troop & Member Management

| Privilege | Scout | Parent | Volunteer | Assistant | Co-Leader | Cookie Leader | Troop Leader | Council Admin |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `view_roster` | — | — | T | T | T | T | T | T |
| `manage_members` | — | — | — | — | T | — | T | T |
| `manage_troop_settings` | — | — | — | — | T | — | T | T |
| `send_invitations` | — | — | — | — | T | — | T | T |
| `import_roster` | — | — | — | — | T | — | T | T |
| `manage_member_roles` | — | — | — | — | — | — | T | T |
| `manage_privileges` | — | — | — | — | — | — | T | T |

#### Scout Profiles & Advancement

| Privilege | Scout | Parent | Volunteer | Assistant | Co-Leader | Cookie Leader | Troop Leader | Council Admin |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `view_scout_profiles` | S | H | — | D | T | — | T | T |
| `edit_scout_level` | — | — | — | — | T | — | T | T |
| `edit_scout_status` | — | — | — | — | T | — | T | T |
| `award_badges` | — | — | — | — | T | — | T | T |
| `view_badge_progress` | S | H | — | D | T | — | T | T |
| `edit_personal_info` | — | H | — | — | T | — | T | T |

#### Calendar & Events

| Privilege | Scout | Parent | Volunteer | Assistant | Co-Leader | Cookie Leader | Troop Leader | Council Admin |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `view_events` | T | T | T | T | T | T | T | T |
| `manage_events` | — | — | — | T | T | — | T | T |
| `export_calendar` | T | T | T | T | T | T | T | T |

#### Fundraising & Sales

| Privilege | Scout | Parent | Volunteer | Assistant | Co-Leader | Cookie Leader | Troop Leader | Council Admin |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `view_sales` | S | H | — | — | T | T | T | T |
| `record_sales` | S | H | — | — | S | T | T | T |
| `manage_fundraisers` | — | — | — | — | T | T | T | T |
| `view_troop_sales` | — | — | — | — | T | T | T | T |
| `view_financials` | — | — | — | — | T | T | T | T |
| `manage_financials` | — | — | — | — | — | T | T | T |

#### Donations

| Privilege | Scout | Parent | Volunteer | Assistant | Co-Leader | Cookie Leader | Troop Leader | Council Admin |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `view_donations` | S | H | — | — | T | T | T | T |
| `record_donations` | S | H | — | — | S | S | T | T |
| `delete_donations` | S | H | — | — | S | — | T | T |

#### Troop Goals & Reporting

| Privilege | Scout | Parent | Volunteer | Assistant | Co-Leader | Cookie Leader | Troop Leader | Council Admin |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `view_goals` | T | T | T | T | T | T | T | T |
| `manage_goals` | — | — | — | — | T | — | T | T |
| `view_leaderboard` | T | T | T | T | T | T | T | T |

#### Data & Settings

| Privilege | Scout | Parent | Volunteer | Assistant | Co-Leader | Cookie Leader | Troop Leader | Council Admin |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `manage_payment_methods` | S | S | S | S | S | S | S | S |
| `import_data` | — | — | — | — | — | T | T | T |
| `export_data` | S | H | — | — | T | T | T | T |
| `delete_own_data` | S | S | S | S | S | S | S | S |

#### Council Administration

| Privilege | Scout | Parent | Volunteer | Assistant | Co-Leader | Cookie Leader | Troop Leader | Council Admin |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `manage_seasons` | — | — | — | — | — | — | — | T |
| `manage_products` | — | — | — | — | — | — | — | T |
| `view_all_troops` | — | — | — | — | — | — | — | T |
| `manage_all_troops` | — | — | — | — | — | — | — | T |

---

## Role Assignment Rules

1. **No self-elevation.** A user cannot add or change their own role. Only a person with a higher-level role can modify it.
2. **Troop Leader is the highest operational role** for now, but is restricted to actions within their own troop.
3. **Council Admin** has system-wide access across all troops but should still respect the privilege framework.
4. **Privilege overrides** are stored per-user-per-troop and take precedence over role defaults.

---

## Minor (Under 18) Account Rules

When adding a scout under 18 (based on date of birth):

1. A **parent account is required**. The parent email address is mandatory and serves as the primary login.
2. The **scout email address is not required** for minors.
3. The scout is **linked to the parent** via `linkedParentId` in `troop_members`.
4. A **secondary login** for the scout can be generated (derived from parent information) so the scout can log in independently.
5. **Both parent and scout** have access to all the scout's data.
6. **Only the parent login** has the `edit_personal_info` privilege for the linked scout (name changes, address changes, etc.).
7. Volunteers have **no access** to modify personal data of scouts or parents unless explicitly granted the `edit_personal_info` privilege by a troop leader.

---

## API Access Pattern Summary

* **Ownership-based:** Scouts and parents can only access their own data (scope: Self/Household)
* **Troop membership:** Leaders and co-leaders can access their troop members' data (scope: Troop)
* **Role-gated endpoints:** Creating troops, managing seasons, awarding badges, changing scout levels all require `troop_leader` or `council_admin`
* **Privilege-gated:** Granular actions check the user's effective privilege (role default + any overrides)
* **Superuser:** Bypasses all checks (development only)



**Developer notes**  Added 2/10/26  10pm

`Aditional role information that will need to be incorporated into the Schema

#### Primary Leadership Roles
- Troop Leader / Co-Leader: The main mentors who organize meetings, facilitate activities, and manage the troop's overall direction.
- Troop Assistant / Advisor: Individuals who support the leader in running meetings and ensuring safety ratios are met. 
#### Specialized Coordination Roles
- Troop Cookie Manager: Oversees the annual cookie sale, handles inventory, and manages troop funds during the program.
- Troop Treasurer: Manages the troop bank account, tracks expenses, and submits annual financial reports.
- Fall Product Manager: Coordinates the Mags&Munchies or Fall Product sale.
- Outdoor / Camping Coordinator: A certified adult who helps plan and lead outdoor trips and camping experiences. 
#### Support & Committee Roles
- Troop Driver & Chaperone: Background-checked adults who provide transportation and supervision during field trips.
- First Aider: A volunteer with CPR/First Aid certification required for certain outings and high-adventure activities.
- Troop Helper / Admin: A "catch-all" role for volunteers who assist with snacks, crafts, or communications on an as-needed basis. 