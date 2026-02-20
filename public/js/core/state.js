// Apex Scout Manager — Reactive State Store

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** @type {Map<string, Set<Function>>} */
const _listeners = new Map();

const _state = {
    // Auth
    currentUser: null,

    // Troop selection
    selectedTroopId: null,
    troopMembers: [],
    troopGoals: [],
    troopSalesData: null,

    // Profile / data arrays
    profile: null,
    donations: [],
    events: [],
    paymentMethods: [],

    // Badge (Phase 3.2)
    earnedBadges: [],
    availableBadges: [],
    badgeGalleryFilter: 'available',
    awardingToUserId: null,
    awardingBadgeOptions: [],

    // Event editing
    editingEventId: null,
    currentCalendarDate: new Date(),

    // Privilege editing
    currentPermsUserId: null,
    currentPermsMemberRole: null,
};

/**
 * Read the current state snapshot.
 * @returns {Readonly<typeof _state>}
 */
export function getState() {
    return Object.freeze({ ..._state });
}

/**
 * Merge partial updates into state and notify listeners for each changed key.
 * @param {Partial<typeof _state>} partial
 */
export function setState(partial) {
    for (const [key, value] of Object.entries(partial)) {
        // Validate selectedTroopId is a proper UUID (or null)
        if (key === 'selectedTroopId' && value !== null && !UUID_RE.test(value)) {
            console.warn(`setState: invalid UUID for selectedTroopId — ignored:`, value);
            continue;
        }
        _state[key] = value;
        _notify(key, value);
    }
}

/**
 * Subscribe to changes for a specific state key.
 * @param {string} key
 * @param {Function} listener  Called with (newValue) on each change
 * @returns {Function} Unsubscribe function
 */
export function subscribe(key, listener) {
    if (!_listeners.has(key)) _listeners.set(key, new Set());
    _listeners.get(key).add(listener);
    return () => _listeners.get(key).delete(listener);
}

function _notify(key, value) {
    const fns = _listeners.get(key);
    if (!fns) return;
    for (const fn of fns) {
        try { fn(value); } catch (e) { console.error(`State listener error (${key}):`, e); }
    }
}
