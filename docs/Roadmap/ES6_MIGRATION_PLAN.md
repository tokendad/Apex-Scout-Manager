# ES6 Module Migration Plan
**Project**: Apex Scout Manager (ASM)
**Started**: 2026-02-19
**Status**: Phase 0 Complete / Phase 1 In Progress (paused)

---

## Background

Commit `3e1e034` (Gemini) split the 4,799-line `script.js` into ES6 modules but introduced:
- Fatal missing exports that silently prevented the entire app from loading
- URL mismatches, stub functions, XSS holes, and broken header merging

After reviewing and attempting repairs, the decision was made to:
1. Restore the original `script.js` (from `script.js.old`)
2. Remove the broken `public/js/` tree
3. Plan and execute a **proper, incremental migration** from scratch

---

## Migration Phases

### ✅ Phase 0 — Core Infrastructure (COMPLETE)
Create `js/core/` files that faithfully extract from `script.js` with ES6 exports.
`script.js` still loads; these files are not yet referenced by HTML.

| File | Contents | Status |
|------|----------|--------|
| `js/core/constants.js` | `API_BASE_URL`, `MAX_PHOTO_SIZE`, `PRIVILEGE_DEFINITIONS`, `ROLE_PRIVILEGE_DEFAULTS`, `SCOPE_ORDER`, `SCOPE_LABELS` | ✅ Done |
| `js/core/api.js` | `apiFetch()`, `checkAuth()`, `logout()`, `handleApiResponse()` | ✅ Done |
| `js/core/state.js` | Reactive state store: `getState()`, `setState()`, `subscribe()` — holds all global variables (`currentUser`, `selectedTroopId`, `donations`, `events`, `paymentMethods`, `profile`, `earnedBadges`, `availableBadges`, etc.) | ✅ Done |
| `js/core/utils.js` | `escapeHtml()`, `showFeedback(msg, isError?)`, `getBadgeIcon()`, `formatBadgeDate()`, `formatSaleType()` | ✅ Done |
| `js/core/router.js` | `switchView()`, `setupNavigation()`, `setupTroopNavigation()` | ✅ Done |

**Improvements over original during Phase 0:**
- `showFeedback` now accepts `isError = false` parameter (red vs green background)
- `apiFetch` properly merges headers (does not clobber Content-Type with FormData)
- `checkAuth` returns user object instead of mutating a global
- UUID validation in state for `selectedTroopId`
- Listener error isolation in state `_notify()`
- `closeMobileMenu` in router references `#sidebar` + `#sidebarOverlay` (matching actual HTML IDs)

---

### ⏸ Phase 1 — Atomic Cutover (NOT STARTED)
**Goal**: Replace `script.js` in `index.html` with `<script type="module" src="js/main.js">`.
This is one atomic PR — all remaining code either moves to named modules or is inlined in `main.js`.

#### Module targets for Phase 1:
- `js/modules/auth.js` — `checkAuth`, `logout`, `displayUserInfo`
- `js/modules/profile.js` — `loadProfile`, `updateProfileDisplay`, `handlePhotoUpload`, `handleUpdateQrCode`, photo/QR render
- `js/modules/badges.js` — full badge system: `loadEarnedBadges`, `renderBadgeAchievementSection`, `renderBadgeGallery`, `openBadgeGalleryModal`, `closeBadgeGalleryModal`, `filterBadges`, `filterBadgesBySearch`, `openAwardBadgeModal`, `submitAwardBadge`, `showBadgeDetail`, `closeBadgeDetailModal`, `renderScoutLevelBadge`

#### `js/main.js` will inline (not extracted yet):
- Donations (`loadDonations`, `renderDonations`, `handleAddDonation`, `handleDeleteDonation`)
- Events / Calendar (`loadEvents`, `renderCalendar`, `handleAddEvent`, `handleEditEvent`, `handleDeleteEvent`, `changeMonth`, `goToToday`, `exportCalendar`)
- Payment Methods (`loadPaymentMethods`, `renderPaymentMethodsProfile`, `renderPaymentMethodsSettings`, `handleAddPaymentMethod`, `handleDeletePaymentMethod`)
- Settings (`setupTheme`, `applyTheme`, `updateThemeButtons`, `setupImport`, `setupDangerZone`)
- Troop management (all of sections 1680–2800 in `script.js`)
- Leaderboard, Goals, Cookie dashboard, Booth events, Fulfillment

#### Key rules for Phase 1:
1. Use `Promise.allSettled` (not `Promise.all`) in `init()`
2. Assign every `onclick=""` handler to `window.X` at module init time
3. `escapeHtml()` on all `innerHTML` user data
4. UUID validation before API calls with `selectedTroopId`
5. Run regression script after cutover (see Validation section below)

---

### Phase 2 — Settings Module
Extract: `setupTheme`, `applyTheme`, `updateThemeButtons`, `setupImport`, `setupDangerZone`
Target: `js/modules/settings.js`

---

### Phase 3 — Cookie Dashboard + Calendar Modules
Extract: `loadCookieDashboard`, `renderCookieDashboard`, `adjustCookieInventory`, `loadQuickSaleProducts`, `deleteSaleFromDashboard`, `saveOrderCard`, cookie booth sub-functions
Target: `js/modules/cookies/dashboard.js`

Extract: `loadEvents`, `renderCalendar`, `handleAddEvent`, `handleEditEvent`, `handleDeleteEvent`, `changeMonth`, `goToToday`, `toggleAddEventForm`, `exportCalendar`
Target: `js/modules/events/calendar.js`

---

### Phase 4 — Troop Management Cluster
Extract troop management, privileges, invitations:
- `js/modules/troop/management.js` — `loadMyTroops`, `loadTroopData`, `renderTroopDashboard`, `renderTroopMembers`, `renderTroopGoals`, `renderMembershipTab`, `setupTroopManagement`, `addGenericMemberToTroop`, `addNewScoutToTroop`, `removeMember`, etc.
- `js/modules/troop/privileges.js` — `loadMemberPrivileges`, `renderPrivilegeMatrix`, `savePrivilegeOverrides`, `resetPrivilegesToDefaults`
- `js/modules/troop/invitations.js` — `loadInvitations`, `renderInvitations`, `acceptInvitation`, `declineInvitation`, `sendInvitation`

---

### Phase 5 — Booth Events + Fulfillment
Extract: `loadBoothEvents`, `createBoothEvent`, `openBoothDetail`, `renderBoothInfo`, `renderBoothShifts`, `renderBoothInventory`, `renderBoothPayments`, `boothLifecycle`, `populateShiftScoutSelect`, `addShift`, `adjustShiftInventory`, `recordBoothPayment`, etc.
Target: `js/modules/booth/management.js`

Extract: fulfillment order functions
Target: `js/modules/booth/fulfillment.js`

---

### Phase 6 — Cleanup
- Remove all `window.X` assignments where handler is now set via `addEventListener`
- Remove remaining dead code and unused imports
- Final XSS audit
- Remove hardcoded admin accounts (per original Phase 3.3+ plan)

---

### Phase 7 — HTML Cleanup + Delete script.js
- Replace all `onclick="..."` attributes with `data-action` + event delegation
- Delete `public/script.js` and `public/script.js.old`
- Final audit and smoke test

---

## Validation Checklist (run after each phase)

```js
// Paste in browser console to verify all window functions are present
const required = [
    'logout','switchView','filterBadges','filterBadgesBySearch',
    'openBadgeGalleryModal','closeBadgeGalleryModal','closeBadgeDetailModal',
    'showBadgeDetail','openAwardBadgeModal','submitAwardBadge',
    'handlePhotoUpload','handleUpdateQrCode',
    'handleAddPaymentMethod','handleDeletePaymentMethod',
    'handleAddDonation','handleDeleteDonation',
    'changeMonth','goToToday','toggleAddEventForm','exportCalendar',
    'loadCookieDashboard','adjustCookieInventory','deleteSaleFromDashboard','saveOrderCard',
    'loadBoothEvents','boothLifecycle','adjustFieldQty','switchBoothTab',
    'removeMember','loadMemberPrivileges','savePrivilegeOverrides','resetPrivilegesToDefaults',
    'openAddMemberModal','submitAddMember','addGenericMemberToTroop','addNewScoutToTroop',
    'loadInvitations','acceptInvitation','declineInvitation',
    'loadGoalProgress','createGoal','deleteGoal',
    'updateAddMemberButtonLabel',
];
required.forEach(fn => {
    if (typeof window[fn] !== 'function') console.warn('MISSING:', fn);
    else console.log('OK:', fn);
});
```

---

## Key Bug Fixes to Apply During Migration

| Bug | Fix |
|-----|-----|
| `loadEvents` uses `currentUser.troopId` (doesn't exist) | Use `selectedTroopId` from state |
| `adjustFieldQty` missing in booth management | Implement: `async function adjustFieldQty(productId, delta)` using `/inventory` endpoint |
| `Promise.all` in `init()` aborts on first 404 | Use `Promise.allSettled` with per-rejection logging |
| `showFeedback` ignores `isError` param | Already fixed in `utils.js` |
| `apiFetch` headers override bug | Already fixed in `api.js` |
| `renderOrderCard` was a stub | Implement using `orderCardHead`/`orderCardBody`/`orderCardFoot` DOM structure |

---

## File Reference

- **Source of truth**: `/data/ASM/public/script.js` (4,799 lines — current working monolith)
- **Old broken modules**: deleted (were in `public/js/` before restoration)
- **New core infrastructure**: `/data/ASM/public/js/core/` (Phase 0, complete)
- **Plan doc**: this file

---
*Last Updated: 2026-02-19 — Paused after Phase 0 completion*
