// Apex Scout Manager - JavaScript

// API base URL
const API_BASE_URL = '/api';

// Maximum photo file size in bytes (5MB)
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

// Current user info
let currentUser = null;

// Helper function to handle API responses and check for auth errors
async function handleApiResponse(response) {
    if (response.status === 401) {
        // Not authenticated - redirect to login
        window.location.href = '/login.html';
        throw new Error('Authentication required');
    }
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }
    return response;
}

// Check authentication status and get current user
async function checkAuth() {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/me`);
        if (response.status === 401) {
            window.location.href = '/login.html';
            return false;
        }
        if (response.ok) {
            currentUser = await response.json();
            return true;
        }
        return false;
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/login.html';
        return false;
    }
}

// Logout function
async function logout() {
    try {
        await fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST' });
    } catch (error) {
        console.error('Logout error:', error);
    }
    window.location.href = '/login.html';
}

// Data arrays
let donations = [];
let events = [];
let paymentMethods = [];
let profile = null;

// Track which event is being edited (null = adding new)
let editingEventId = null;

// Badge state (Phase 3.2)
let earnedBadges = [];
let availableBadges = [];
let badgeGalleryFilter = 'available';
let awardingToUserId = null;
let awardingBadgeOptions = [];

// Leader catalog state (populated when current user is a leader)
let catalogBadges = [];          // Badges from the leader's troop org catalog(s)
let catalogBadgesByOrg = {};     // { orgCode: [badges...] } (kept for internal use)
let catalogOrgName = '';         // Display name of the leader's troop org (e.g. "Girl Scouts USA")

// Global troop list — populated by loadMyTroops() so other functions can look up org info
let myTroopsList = [];

// Privilege system constants (must match server-side definitions)
const PRIVILEGE_DEFINITIONS = [
    { code: 'view_roster', name: 'View troop roster', category: 'Troop & Member Management' },
    { code: 'manage_members', name: 'Manage troop members', category: 'Troop & Member Management' },
    { code: 'manage_troop_settings', name: 'Manage troop settings', category: 'Troop & Member Management' },
    { code: 'send_invitations', name: 'Send invitations', category: 'Troop & Member Management' },
    { code: 'import_roster', name: 'Import roster', category: 'Troop & Member Management' },
    { code: 'manage_member_roles', name: 'Manage member roles', category: 'Troop & Member Management' },
    { code: 'manage_privileges', name: 'Manage privileges', category: 'Troop & Member Management' },
    { code: 'view_scout_profiles', name: 'View scout profiles', category: 'Scout Profiles & Advancement' },
    { code: 'edit_scout_level', name: 'Edit scout level', category: 'Scout Profiles & Advancement' },
    { code: 'edit_scout_status', name: 'Edit scout status', category: 'Scout Profiles & Advancement' },
    { code: 'award_badges', name: 'Award badges', category: 'Scout Profiles & Advancement' },
    { code: 'view_badge_progress', name: 'View badge progress', category: 'Scout Profiles & Advancement' },
    { code: 'edit_personal_info', name: 'Edit personal info', category: 'Scout Profiles & Advancement' },
    { code: 'view_events', name: 'View events', category: 'Calendar & Events' },
    { code: 'manage_events', name: 'Manage events', category: 'Calendar & Events' },
    { code: 'export_calendar', name: 'Export calendar', category: 'Calendar & Events' },
    { code: 'view_sales', name: 'View sales data', category: 'Fundraising & Sales' },
    { code: 'record_sales', name: 'Record sales', category: 'Fundraising & Sales' },
    { code: 'manage_fundraisers', name: 'Manage fundraisers', category: 'Fundraising & Sales' },
    { code: 'view_troop_sales', name: 'View troop sales', category: 'Fundraising & Sales' },
    { code: 'view_financials', name: 'View financial accounts', category: 'Fundraising & Sales' },
    { code: 'manage_financials', name: 'Manage financial accounts', category: 'Fundraising & Sales' },
    { code: 'view_donations', name: 'View donations', category: 'Donations' },
    { code: 'record_donations', name: 'Record donations', category: 'Donations' },
    { code: 'delete_donations', name: 'Delete donations', category: 'Donations' },
    { code: 'view_goals', name: 'View goals', category: 'Troop Goals & Reporting' },
    { code: 'manage_goals', name: 'Manage goals', category: 'Troop Goals & Reporting' },
    { code: 'view_leaderboard', name: 'View leaderboard', category: 'Troop Goals & Reporting' },
    { code: 'manage_payment_methods', name: 'Manage payment methods', category: 'Data & Settings' },
    { code: 'import_data', name: 'Import data', category: 'Data & Settings' },
    { code: 'export_data', name: 'Export data', category: 'Data & Settings' },
    { code: 'delete_own_data', name: 'Delete own data', category: 'Data & Settings' },
];

const ROLE_PRIVILEGE_DEFAULTS = {
    member:        { view_roster:'none', manage_members:'none', manage_troop_settings:'none', send_invitations:'none', import_roster:'none', manage_member_roles:'none', manage_privileges:'none', view_scout_profiles:'S', edit_scout_level:'none', edit_scout_status:'none', award_badges:'none', view_badge_progress:'S', edit_personal_info:'none', view_events:'T', manage_events:'none', export_calendar:'T', view_sales:'S', record_sales:'S', manage_fundraisers:'none', view_troop_sales:'none', view_financials:'none', manage_financials:'none', view_donations:'S', record_donations:'S', delete_donations:'S', view_goals:'T', manage_goals:'none', view_leaderboard:'T', manage_payment_methods:'S', import_data:'none', export_data:'S', delete_own_data:'S' },
    parent:        { view_roster:'none', manage_members:'none', manage_troop_settings:'none', send_invitations:'none', import_roster:'none', manage_member_roles:'none', manage_privileges:'none', view_scout_profiles:'H', edit_scout_level:'none', edit_scout_status:'none', award_badges:'none', view_badge_progress:'H', edit_personal_info:'H', view_events:'T', manage_events:'none', export_calendar:'T', view_sales:'H', record_sales:'H', manage_fundraisers:'none', view_troop_sales:'none', view_financials:'none', manage_financials:'none', view_donations:'H', record_donations:'H', delete_donations:'H', view_goals:'T', manage_goals:'none', view_leaderboard:'T', manage_payment_methods:'S', import_data:'none', export_data:'H', delete_own_data:'S' },
    volunteer:     { view_roster:'T', manage_members:'none', manage_troop_settings:'none', send_invitations:'none', import_roster:'none', manage_member_roles:'none', manage_privileges:'none', view_scout_profiles:'none', edit_scout_level:'none', edit_scout_status:'none', award_badges:'none', view_badge_progress:'none', edit_personal_info:'none', view_events:'T', manage_events:'none', export_calendar:'T', view_sales:'none', record_sales:'none', manage_fundraisers:'none', view_troop_sales:'none', view_financials:'none', manage_financials:'none', view_donations:'none', record_donations:'none', delete_donations:'none', view_goals:'T', manage_goals:'none', view_leaderboard:'T', manage_payment_methods:'S', import_data:'none', export_data:'none', delete_own_data:'S' },
    assistant:     { view_roster:'T', manage_members:'none', manage_troop_settings:'none', send_invitations:'none', import_roster:'none', manage_member_roles:'none', manage_privileges:'none', view_scout_profiles:'D', edit_scout_level:'none', edit_scout_status:'none', award_badges:'none', view_badge_progress:'D', edit_personal_info:'none', view_events:'T', manage_events:'T', export_calendar:'T', view_sales:'none', record_sales:'none', manage_fundraisers:'none', view_troop_sales:'none', view_financials:'none', manage_financials:'none', view_donations:'none', record_donations:'none', delete_donations:'none', view_goals:'T', manage_goals:'none', view_leaderboard:'T', manage_payment_methods:'S', import_data:'none', export_data:'none', delete_own_data:'S' },
    'co-leader':   { view_roster:'T', manage_members:'T', manage_troop_settings:'T', send_invitations:'T', import_roster:'T', manage_member_roles:'none', manage_privileges:'none', view_scout_profiles:'T', edit_scout_level:'T', edit_scout_status:'T', award_badges:'T', view_badge_progress:'T', edit_personal_info:'T', view_events:'T', manage_events:'T', export_calendar:'T', view_sales:'T', record_sales:'S', manage_fundraisers:'T', view_troop_sales:'T', view_financials:'T', manage_financials:'none', view_donations:'T', record_donations:'S', delete_donations:'S', view_goals:'T', manage_goals:'T', view_leaderboard:'T', manage_payment_methods:'S', import_data:'none', export_data:'T', delete_own_data:'S' },
    cookie_leader: { view_roster:'T', manage_members:'none', manage_troop_settings:'none', send_invitations:'none', import_roster:'none', manage_member_roles:'none', manage_privileges:'none', view_scout_profiles:'none', edit_scout_level:'none', edit_scout_status:'none', award_badges:'none', view_badge_progress:'none', edit_personal_info:'none', view_events:'T', manage_events:'none', export_calendar:'T', view_sales:'T', record_sales:'T', manage_fundraisers:'T', view_troop_sales:'T', view_financials:'T', manage_financials:'T', view_donations:'T', record_donations:'S', delete_donations:'none', view_goals:'T', manage_goals:'none', view_leaderboard:'T', manage_payment_methods:'S', import_data:'T', export_data:'T', delete_own_data:'S' },
    troop_leader:  { view_roster:'T', manage_members:'T', manage_troop_settings:'T', send_invitations:'T', import_roster:'T', manage_member_roles:'T', manage_privileges:'T', view_scout_profiles:'T', edit_scout_level:'T', edit_scout_status:'T', award_badges:'T', view_badge_progress:'T', edit_personal_info:'T', view_events:'T', manage_events:'T', export_calendar:'T', view_sales:'T', record_sales:'T', manage_fundraisers:'T', view_troop_sales:'T', view_financials:'T', manage_financials:'T', view_donations:'T', record_donations:'T', delete_donations:'T', view_goals:'T', manage_goals:'T', view_leaderboard:'T', manage_payment_methods:'S', import_data:'T', export_data:'T', delete_own_data:'S' },
    admin:         { view_roster:'T', manage_members:'T', manage_troop_settings:'T', send_invitations:'T', import_roster:'T', manage_member_roles:'T', manage_privileges:'T', view_scout_profiles:'T', edit_scout_level:'T', edit_scout_status:'T', award_badges:'T', view_badge_progress:'T', edit_personal_info:'T', view_events:'T', manage_events:'T', export_calendar:'T', view_sales:'T', record_sales:'T', manage_fundraisers:'T', view_troop_sales:'T', view_financials:'T', manage_financials:'T', view_donations:'T', record_donations:'T', delete_donations:'T', view_goals:'T', manage_goals:'T', view_leaderboard:'T', manage_payment_methods:'S', import_data:'T', export_data:'T', delete_own_data:'S' },
    cookie_manager:{ view_roster:'T', manage_members:'none', manage_troop_settings:'none', send_invitations:'none', import_roster:'none', manage_member_roles:'none', manage_privileges:'none', view_scout_profiles:'T', edit_scout_level:'none', edit_scout_status:'none', award_badges:'none', view_badge_progress:'T', edit_personal_info:'none', view_events:'T', manage_events:'none', export_calendar:'T', view_sales:'T', record_sales:'T', manage_fundraisers:'T', view_troop_sales:'T', view_financials:'T', manage_financials:'T', view_donations:'T', record_donations:'T', delete_donations:'none', view_goals:'T', manage_goals:'T', view_leaderboard:'T', manage_payment_methods:'S', import_data:'T', export_data:'T', delete_own_data:'S' },
};

const SCOPE_ORDER = ['T', 'D', 'H', 'S', 'none'];
const SCOPE_LABELS = { T: 'Troop', D: 'Den/Patrol', H: 'Household', S: 'Self', none: 'None' };

// Currently loaded privilege data for the selected member
let currentPermsUserId = null;
let currentPermsMemberRole = null;

// DOM Elements

// Profile elements
const photoInput = document.getElementById('photoInput');
const uploadPhotoBtn = document.getElementById('uploadPhotoBtn');
const qrCodeUrlInput = document.getElementById('qrCodeUrl');
const updateQrBtn = document.getElementById('updateQrBtn');

// Payment Method elements
const settingsPaymentMethodsList = document.getElementById('settingsPaymentMethodsList');
const newPaymentNameInput = document.getElementById('newPaymentName');
const newPaymentUrlInput = document.getElementById('newPaymentUrl');
const addPaymentMethodBtn = document.getElementById('addPaymentMethodBtn');

// Profile display elements (for Profile tab)
const profilePhotoDisplay = document.getElementById('profilePhotoDisplay');
const profilePhotoPlaceholderDisplay = document.getElementById('profilePhotoPlaceholderDisplay');
const storeQrImageDisplay = document.getElementById('storeQrImageDisplay');
const storeQrPlaceholder = document.getElementById('storeQrPlaceholder');
const paymentMethodsDisplay = document.getElementById('paymentMethodsDisplay');
const paymentMethodsPlaceholder = document.getElementById('paymentMethodsPlaceholder');

// Donation elements
const donationForm = document.getElementById('donationForm');
const donationAmountInput = document.getElementById('donationAmount');
const donorNameInput = document.getElementById('donorName');
const donationsList = document.getElementById('donationsList');
const totalDonationsElement = document.getElementById('totalDonations');

// Event elements
const eventForm = document.getElementById('eventForm');
const eventNameInput = document.getElementById('eventName');
const eventDateInput = document.getElementById('eventDate');
const eventDescriptionInput = document.getElementById('eventDescription');
const eventsList = document.getElementById('eventsList');

// Initialize app
async function init() {
    // Check authentication first
    const isAuthenticated = await checkAuth();
    if (!isAuthenticated) {
        return; // Will redirect to login
    }

    // Display user info in the header (if user info element exists)
    displayUserInfo();

    await Promise.all([loadDonations(), loadEvents(), loadProfile(), loadPaymentMethods(), loadScoutProfile(), loadEarnedBadges(), loadLinkedScouts()]);
    renderDonations();
    renderCalendar();
    renderPaymentMethodsSettings();
    setupEventListeners();
    if (window.lucide) lucide.createIcons();
}

// Display current user info
function displayUserInfo() {
    const userInfoEl = document.getElementById('userInfo');
    const userNameEl = document.getElementById('userName');
    const logoutBtn = document.getElementById('logoutBtn');

    if (currentUser && userNameEl) {
        userNameEl.textContent = `${currentUser.firstName} ${currentUser.lastName}`;
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
}

// Setup event listeners
function setupEventListeners() {
    // Badge award buttons (delegated — buttons are rendered dynamically)
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.badge-award-btn');
        if (btn) {
            openAwardBadgeModal(btn.dataset.userid, btn.dataset.name);
        }
    });

    // Profile listeners
    if (uploadPhotoBtn && photoInput) {
        uploadPhotoBtn.addEventListener('click', () => photoInput.click());
        photoInput.addEventListener('change', handlePhotoUpload);
    }
    if (updateQrBtn) {
        updateQrBtn.addEventListener('click', handleUpdateQrCode);
    }

    // Payment Method listeners
    if (addPaymentMethodBtn) {
        addPaymentMethodBtn.addEventListener('click', handleAddPaymentMethod);
    }

    // Donation listeners
    if (donationForm) {
        donationForm.addEventListener('submit', handleAddDonation);
    }

    // Event listeners
    if (eventForm) {
        eventForm.addEventListener('submit', handleAddEvent);
    }

    // Calendar filter listeners
    document.querySelectorAll('.event-filter').forEach(cb => {
        cb.addEventListener('change', renderCalendar);
    });
}


// Load donations from API
async function loadDonations() {
    try {
        const response = await fetch(`${API_BASE_URL}/donations`);
        await handleApiResponse(response);
        donations = await response.json();
    } catch (error) {
        if (error.message === 'Authentication required') return;
        console.error('Error loading donations:', error);
        donations = [];
    }
}

// Global calendar state
let currentCalendarDate = new Date();

// Load events from API (Troop Calendar)
async function loadEvents() {
    try {
        let endpoint = `${API_BASE_URL}/events`; // Fallback
        
        if (currentUser && currentUser.troopId) {
             endpoint = `${API_BASE_URL}/troop/${currentUser.troopId}/events`;
        } else {
             console.debug('No troopId for user, using default events endpoint');
        }

        const response = await fetch(endpoint);
        await handleApiResponse(response);
        events = await response.json();
        renderCalendar();
    } catch (error) {
        if (error.message === 'Authentication required') return;
        console.error('Error loading events:', error);
        events = [];
        renderCalendar();
    }
}

// Load profile from API
async function loadProfile() {
    try {
        const response = await fetch(`${API_BASE_URL}/profile`);
        await handleApiResponse(response);
        profile = await response.json();

        // Update Settings page UI with profile data
        if (profile.qrCodeUrl) {
            qrCodeUrlInput.value = profile.qrCodeUrl;
        }

        // Update Profile tab display elements
        updateProfileDisplay();
    } catch (error) {
        if (error.message === 'Authentication required') return;
        console.error('Error loading profile:', error);
        profile = { userId: null, photoData: null, qrCodeUrl: null, paymentQrCodeUrl: null, goalBoxes: 0, goalAmount: 0 };
    }
}

// Load scout profile (Phase 3.1)
async function loadScoutProfile() {
    try {
        if (!currentUser || !currentUser.id) {
            console.debug('No current user, skipping scout profile load');
            return;
        }

        const response = await fetch(`${API_BASE_URL}/scouts/${currentUser.id}/profile`);

        // 404 means no scout profile yet (user might not be a scout)
        if (response.status === 404) {
            console.debug('No scout profile found for user');
            return;
        }

        await handleApiResponse(response);
        const scoutProfile = await response.json();

        console.log('Scout profile loaded:', scoutProfile);
        renderScoutLevelBadge(scoutProfile);
    } catch (error) {
        if (error.message === 'Authentication required') return;
        console.debug('Error loading scout profile:', error.message);
        // Non-critical error, don't break page
    }
}

// ============================================================================
// BADGE SYSTEM (Phase 3.2) - Steps 4, 5, 6
// ============================================================================

// Load earned badges and available badges for the current user
async function loadEarnedBadges() {
    try {
        if (!currentUser || !currentUser.id) return;

        // Leaders see the full badge catalog; scouts see their personal progress
        if (canAwardBadges()) {
            await loadBadgeCatalogForLeader();
            return;
        }

        const response = await fetch(`${API_BASE_URL}/scouts/${currentUser.id}/badges`, { credentials: 'include' });
        if (response.status === 404 || response.status === 403) return;
        if (!response.ok) return;
        earnedBadges = await response.json();

        const availRes = await fetch(`${API_BASE_URL}/scouts/${currentUser.id}/available-badges`, { credentials: 'include' });
        if (availRes.ok) {
            availableBadges = await availRes.json();
        }

        renderBadgeAchievementSection();
    } catch (error) {
        if (error.message === 'Authentication required') return;
        console.debug('Badge loading skipped:', error.message);
    }
}

// Load the badge catalog for leader/co-leader users, filtered to their troop's org
async function loadBadgeCatalogForLeader() {
    try {
        const catalogsRes = await fetch(`${API_BASE_URL}/badge-catalogs`, { credentials: 'include' });
        if (!catalogsRes.ok) return;
        const allCatalogs = await catalogsRes.json();

        catalogBadges = [];
        catalogBadgesByOrg = {};
        catalogOrgName = '';

        // Determine the organization for the currently selected troop (or first troop)
        let troopOrgId = null;
        if (selectedTroopId && myTroopsList.length > 0) {
            const troop = myTroopsList.find(t => t.id === selectedTroopId);
            if (troop) troopOrgId = troop.organizationId || null;
        } else if (myTroopsList.length > 0) {
            troopOrgId = myTroopsList[0].organizationId || null;
        }

        // Filter catalogs to only those matching the troop's org; fall back to all if no match
        let catalogs = allCatalogs;
        if (troopOrgId) {
            const filtered = allCatalogs.filter(c => c.organizationId === troopOrgId);
            if (filtered.length > 0) {
                catalogs = filtered;
                catalogOrgName = filtered[0].orgName || '';
            }
        }

        for (const catalog of catalogs) {
            const badgesRes = await fetch(`${API_BASE_URL}/badge-catalogs/${catalog.id}/badges`, { credentials: 'include' });
            if (!badgesRes.ok) continue;
            const badges = await badgesRes.json();
            // Attach orgCode and orgName so badge cards can display them
            const enriched = badges.map(b => ({ ...b, orgCode: catalog.orgCode, orgName: catalog.orgName, catalogName: catalog.catalogName }));
            catalogBadges = catalogBadges.concat(enriched);
            catalogBadgesByOrg[catalog.orgCode] = (catalogBadgesByOrg[catalog.orgCode] || []).concat(enriched);
        }

        renderLeaderBadgeCatalogSection();
    } catch (error) {
        console.debug('Badge catalog loading skipped:', error.message);
    }
}

// Render the badge achievement section for leaders (shows catalog count + browse button)
function renderLeaderBadgeCatalogSection() {
    const section = document.getElementById('badgeAchievementSection');
    const strip = document.getElementById('earnedBadgesStrip');
    const countPill = document.getElementById('badgeEarnedCount');
    const title = document.getElementById('badgeSectionTitle');
    const browseBtn = document.getElementById('badgeBrowseBtn');
    if (!section || !strip || !countPill) return;

    if (title) title.textContent = 'Badge Catalog';
    if (browseBtn) browseBtn.textContent = 'Browse Badge Catalog';
    const orgLabel = catalogOrgName ? ` \u2014 ${catalogOrgName}` : '';
    countPill.textContent = `${catalogBadges.length} badges${orgLabel}`;

    strip.innerHTML = `<p class="empty-state" style="font-size:0.85rem;margin:0;">
        Browse the badge catalog to find and award badges to scouts.
    </p>`;

    section.style.display = 'block';
    if (window.lucide) lucide.createIcons();
}

// Step 6: Render achievement dashboard strip on Profile tab
function renderBadgeAchievementSection() {
    const section = document.getElementById('badgeAchievementSection');
    const strip = document.getElementById('earnedBadgesStrip');
    const countPill = document.getElementById('badgeEarnedCount');
    if (!section || !strip || !countPill) return;

    const total = earnedBadges.length;
    countPill.textContent = `${total} earned`;

    if (total === 0) {
        strip.innerHTML = '<p class="empty-state" style="font-size:0.85rem;margin:0;">No badges earned yet. Browse available badges!</p>';
    } else {
        const display = earnedBadges.slice(0, 6);
        strip.innerHTML = display.map(b => `
            <div class="earned-badge-chip" title="${escapeHtml(b.badgeName)}" onclick="showBadgeDetail('${escapeHtml(b.badgeId)}', true, false)">
                <span class="earned-badge-icon">${getBadgeIcon(b.badgeType)}</span>
                <span class="earned-badge-name">${escapeHtml(b.badgeName)}</span>
                <span class="earned-badge-date">${escapeHtml(formatBadgeDate(b.earnedDate))}</span>
            </div>
        `).join('');
        if (total > 6) {
            strip.innerHTML += `<button class="btn btn-text btn-sm" onclick="openBadgeGalleryModal('earned')">+${total - 6} more</button>`;
        }
    }

    section.style.display = 'block';
    if (window.lucide) lucide.createIcons();
}

/// Helper: escape HTML to prevent XSS in innerHTML contexts
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Helper: Lucide icon for badge type
function getBadgeIcon(badgeType) {
    const icons = {
        petal: 'flower', journey: 'map', merit: 'star',
        adventure: 'mountain', rank: 'award', eagle: 'bird',
        activity: 'target', honor: 'trophy', special: 'sparkles'
    };
    const iconName = icons[badgeType] || 'medal';
    return `<i data-lucide="${iconName}" class="icon-svg"></i>`;
}

// Helper: short date string for earned date
function formatBadgeDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// Helper: CSS class suffix for badge type color pill
function getBadgeTypeClass(badgeType) {
    const map = {
        petal: 'petal', journey: 'journey', badge: 'badge',
        merit: 'merit', adventure: 'adventure', rank: 'rank',
        eagle: 'eagle', activity: 'activity', honor: 'honor', special: 'special'
    };
    return map[badgeType] || 'badge';
}

// Helper: format applicableLevels array for display (capitalize, join with slash)
function formatBadgeLevels(levels) {
    if (!Array.isArray(levels) || levels.length === 0) return '';
    return levels.map(l => l.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())).join(' / ');
}

/// Step 4: Open badge gallery modal
function openBadgeGalleryModal(initialFilter) {
    if (canAwardBadges()) {
        // Leaders see their troop's org badge catalog (already filtered by org)
        document.getElementById('badgeGalleryModal').style.display = 'flex';
        document.getElementById('badgeSearchInput').value = '';
        updateBadgeGalleryMode();
        renderBadgeGallery();
    } else {
        // Scouts see their personal earned/available badges
        badgeGalleryFilter = initialFilter || 'available';
        document.getElementById('badgeGalleryModal').style.display = 'flex';
        document.getElementById('badgeSearchInput').value = '';
        updateBadgeGalleryMode();
        renderBadgeGallery();
    }
}

function closeBadgeGalleryModal() {
    document.getElementById('badgeGalleryModal').style.display = 'none';
}

// Switch filter for scout personal view
function filterBadges(filter) {
    badgeGalleryFilter = filter;
    updateBadgeGalleryMode();
    renderBadgeGallery();
}

// Show the correct set of filter buttons based on whether user is a leader or scout
function updateBadgeGalleryMode() {
    const scoutFilters = document.getElementById('badgeGalleryScoutFilters');
    const leaderFilters = document.getElementById('badgeGalleryLeaderFilters');

    if (canAwardBadges()) {
        if (scoutFilters) scoutFilters.style.display = 'none';
        // Replace the leader filter area with just the org name label
        if (leaderFilters) {
            leaderFilters.style.display = 'flex';
            const orgNameEl = document.getElementById('badgeCatalogOrgLabel');
            if (orgNameEl) orgNameEl.textContent = catalogOrgName || 'All Organizations';
        }
    } else {
        if (scoutFilters) scoutFilters.style.display = 'flex';
        if (leaderFilters) leaderFilters.style.display = 'none';
        document.querySelectorAll('.badge-filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === badgeGalleryFilter);
        });
    }
}

function filterBadgesBySearch(query) {
    renderBadgeGallery(query.trim().toLowerCase());
}

// Render badge grid inside gallery modal
function renderBadgeGallery(searchQuery) {
    const grid = document.getElementById('badgeGalleryGrid');
    if (!grid) return;
    searchQuery = searchQuery || '';

    let badges;

    if (canAwardBadges()) {
        // Leader: show all catalog badges (already filtered to troop's org)
        badges = catalogBadges.slice();
    } else {
        // Scout: show personal earned/available badges
        if (badgeGalleryFilter === 'earned') {
            badges = earnedBadges.map(eb => ({
                id: eb.badgeId, badgeName: eb.badgeName, badgeType: eb.badgeType,
                imageUrl: eb.imageUrl, isEarned: true, earnedDate: eb.earnedDate
            }));
        } else if (badgeGalleryFilter === 'available') {
            badges = availableBadges.map(b => ({ ...b, isEarned: false }));
        } else {
            const earnedIds = new Set(earnedBadges.map(e => e.badgeId));
            badges = [
                ...earnedBadges.map(eb => ({ id: eb.badgeId, badgeName: eb.badgeName, badgeType: eb.badgeType, imageUrl: eb.imageUrl, isEarned: true, earnedDate: eb.earnedDate })),
                ...availableBadges.filter(b => !earnedIds.has(b.id)).map(b => ({ ...b, isEarned: false }))
            ];
        }
    }

    if (searchQuery) {
        badges = badges.filter(b =>
            (b.badgeName || '').toLowerCase().includes(searchQuery) ||
            (b.badgeType || '').toLowerCase().includes(searchQuery) ||
            (b.orgName || '').toLowerCase().includes(searchQuery) ||
            (b.description || '').toLowerCase().includes(searchQuery) ||
            (Array.isArray(b.applicableLevels) ? b.applicableLevels.join(' ') : '').toLowerCase().includes(searchQuery)
        );
    }

    if (badges.length === 0) {
        grid.innerHTML = '<p class="empty-state">No badges found.</p>';
        return;
    }

    if (canAwardBadges()) {
        // Leader view: type pill, applicable levels, and truncated description
        grid.innerHTML = badges.map(b => {
            const desc = b.description ? (b.description.length > 100 ? escapeHtml(b.description.slice(0, 100)) + '&hellip;' : escapeHtml(b.description)) : '';
            const levels = formatBadgeLevels(b.applicableLevels);
            const visual = b.imageUrl
                ? `<div class="badge-card-img"><img src="${escapeHtml(b.imageUrl)}" alt="${escapeHtml(b.badgeName)}" loading="lazy"></div>`
                : `<div class="badge-card-icon">${getBadgeIcon(b.badgeType)}</div>`;
            return `
            <div class="badge-card" onclick="showBadgeDetail('${escapeHtml(b.id)}', false, true)">
                ${visual}
                <div class="badge-card-name">${escapeHtml(b.badgeName)}</div>
                <span class="badge-type-pill badge-type-${escapeHtml(getBadgeTypeClass(b.badgeType))}">${escapeHtml(b.badgeType || 'badge')}</span>
                ${levels ? `<div class="badge-card-levels">${escapeHtml(levels)}</div>` : ''}
                ${desc ? `<div class="badge-card-desc">${desc}</div>` : ''}
            </div>`;
        }).join('');
    } else {
        grid.innerHTML = badges.map(b => {
            const desc = b.description ? (b.description.length > 100 ? escapeHtml(b.description.slice(0, 100)) + '&hellip;' : escapeHtml(b.description)) : '';
            const levels = formatBadgeLevels(b.applicableLevels);
            const visual = b.imageUrl
                ? `<div class="badge-card-img"><img src="${escapeHtml(b.imageUrl)}" alt="${escapeHtml(b.badgeName)}" loading="lazy"></div>`
                : `<div class="badge-card-icon">${getBadgeIcon(b.badgeType)}</div>`;
            return `
            <div class="badge-card ${b.isEarned ? 'badge-card-earned' : ''}" onclick="showBadgeDetail('${escapeHtml(b.id)}', ${b.isEarned}, false)">
                ${visual}
                <div class="badge-card-name">${escapeHtml(b.badgeName)}</div>
                <span class="badge-type-pill badge-type-${escapeHtml(getBadgeTypeClass(b.badgeType))}">${escapeHtml(b.badgeType || 'badge')}</span>
                ${levels ? `<div class="badge-card-levels">${escapeHtml(levels)}</div>` : ''}
                ${desc ? `<div class="badge-card-desc">${desc}</div>` : ''}
                ${b.isEarned ? `<div class="badge-card-earned-label">Earned ${escapeHtml(formatBadgeDate(b.earnedDate))}</div>` : ''}
            </div>`;
        }).join('');
    }
    if (window.lucide) lucide.createIcons();
}

// Show badge detail modal (read-only)
// isEarned: true if shown from earned list; isCatalog: true if shown from leader catalog view
function showBadgeDetail(badgeId, isEarned, isCatalog) {
    let badge = null;
    if (isCatalog) {
        // Leader catalog view: find in catalogBadges
        badge = catalogBadges.find(b => b.id === badgeId);
    } else if (isEarned) {
        const eb = earnedBadges.find(e => e.badgeId === badgeId);
        if (eb) badge = { id: eb.badgeId, badgeName: eb.badgeName, badgeType: eb.badgeType, description: eb.description, imageUrl: eb.imageUrl, earnedDate: eb.earnedDate, verifiedByName: eb.verifiedByName };
    } else {
        badge = availableBadges.find(b => b.id === badgeId);
    }
    if (!badge) return;

    document.getElementById('badgeDetailName').textContent = badge.badgeName;
    const detailVisual = badge.imageUrl
        ? `<img class="badge-detail-img" src="${escapeHtml(badge.imageUrl)}" alt="${escapeHtml(badge.badgeName)}" loading="lazy">`
        : `<div class="badge-detail-icon">${getBadgeIcon(badge.badgeType)}</div>`;
    document.getElementById('badgeDetailBody').innerHTML = `
        ${detailVisual}
        <p class="badge-detail-type">${escapeHtml(badge.badgeType || 'Badge')}</p>
        ${badge.orgName ? `<p class="badge-detail-org">${escapeHtml(badge.orgName)}</p>` : ''}
        <p class="badge-detail-description">${escapeHtml(badge.description || 'No description available.')}</p>
        ${badge.requirements ? `<p class="badge-detail-requirements"><strong>Requirements:</strong> ${escapeHtml(badge.requirements)}</p>` : ''}
        ${isEarned ? `
            <div class="badge-detail-earned-info">
                <p>Earned: <strong>${escapeHtml(formatBadgeDate(badge.earnedDate))}</strong></p>
                ${badge.verifiedByName ? `<p>Awarded by: <strong>${escapeHtml(badge.verifiedByName)}</strong></p>` : ''}
            </div>
        ` : ''}
    `;
    document.getElementById('badgeDetailModal').style.display = 'flex';
    if (window.lucide) lucide.createIcons();
}

function closeBadgeDetailModal() {
    document.getElementById('badgeDetailModal').style.display = 'none';
}

/// Step 5: Award badge workflow (Troop Leader context)
async function openAwardBadgeModal(scoutUserId, scoutName) {
    if (!selectedTroopId) {
        showFeedback('Please select a troop first');
        return;
    }

    awardingToUserId = scoutUserId;
    document.getElementById('awardBadgeScoutName').textContent = `Awarding badge to: ${scoutName}`;
    document.getElementById('awardEarnedDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('awardNotes').value = '';
    document.getElementById('awardBadgeSelect').innerHTML = '<option value="">Loading...</option>';
    document.getElementById('awardBadgeModal').style.display = 'flex';

    try {
        // Use the full badge catalog so leaders can award any badge, not just
        // those matching the scout's current level. If catalog is already loaded
        // (leader opened the gallery first), reuse it; otherwise fetch now.
        if (catalogBadges.length === 0) {
            await loadBadgeCatalogForLeader();
        }

        awardingBadgeOptions = catalogBadges;

        const select = document.getElementById('awardBadgeSelect');
        if (awardingBadgeOptions.length === 0) {
            select.innerHTML = '<option value="">No badges in catalog</option>';
        } else {
            // Group options by org for readability
            const byOrg = {};
            awardingBadgeOptions.forEach(b => {
                const org = b.orgName || 'Other';
                if (!byOrg[org]) byOrg[org] = [];
                byOrg[org].push(b);
            });
            let optionsHtml = '<option value="">Select a badge...</option>';
            for (const [orgName, badges] of Object.entries(byOrg)) {
                optionsHtml += `<optgroup label="${escapeHtml(orgName)}">`;
                optionsHtml += badges.map(b =>
                    `<option value="${escapeHtml(b.id)}">${escapeHtml(b.badgeName)} (${escapeHtml(b.badgeType || 'badge')})</option>`
                ).join('');
                optionsHtml += '</optgroup>';
            }
            select.innerHTML = optionsHtml;
        }
    } catch (error) {
        console.error('Error loading badge options:', error);
        document.getElementById('awardBadgeSelect').innerHTML = '<option value="">Error loading badges</option>';
    }
}

function closeAwardBadgeModal() {
    document.getElementById('awardBadgeModal').style.display = 'none';
    awardingToUserId = null;
    awardingBadgeOptions = [];
}

async function submitAwardBadge() {
    const badgeId = document.getElementById('awardBadgeSelect').value;
    const earnedDate = document.getElementById('awardEarnedDate').value;
    const notes = document.getElementById('awardNotes').value.trim();

    if (!badgeId) { showFeedback('Please select a badge'); return; }
    if (!earnedDate) { showFeedback('Please enter the date earned'); return; }
    if (!awardingToUserId) { showFeedback('No scout selected'); return; }

    try {
        const res = await fetch(`${API_BASE_URL}/scouts/${awardingToUserId}/badges`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ badgeId, earnedDate, notes: notes || null })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to award badge');
        }

        showFeedback('Badge awarded successfully!');
        // Refresh own badge strip if leader awarded to themselves
        const wasOwnProfile = (awardingToUserId === currentUser.id);
        closeAwardBadgeModal();
        if (wasOwnProfile) {
            loadEarnedBadges();
        }
    } catch (error) {
        console.error('Award badge error:', error);
        showFeedback(error.message || 'Failed to award badge');
    }
}

// Check if current user can award badges (client hint; server enforces actual check)
function canAwardBadges() {
    if (!currentUser) return false;
    return ['troop_leader', 'co-leader', 'cookie_leader', 'admin'].includes(currentUser.role);
}

// Render scout level badge with official colors
function renderScoutLevelBadge(scoutProfile) {
    const container = document.getElementById('scoutLevelBadgeContainer');
    const badge = document.getElementById('scoutLevelBadge');
    const levelName = document.getElementById('scoutLevelName');
    const orgName = document.getElementById('scoutOrgName');

    if (!container || !badge || !levelName || !orgName || !scoutProfile.levelName) {
        return;
    }

    // Set level name and organization
    levelName.textContent = scoutProfile.levelName;
    orgName.textContent = scoutProfile.orgName || 'Scout';

    // Apply color class based on level code
    if (scoutProfile.levelCode) {
        // Remove all level classes
        badge.className = 'scout-level-badge';
        // Add the level-specific class
        badge.classList.add(`${scoutProfile.levelCode}-level`);
    }

    // Show the badge
    container.style.display = 'flex';

    console.log('Scout level badge rendered:', scoutProfile.levelName, scoutProfile.levelCode);
}

// Update Profile tab display
function updateProfileDisplay() {
    // Update profile photo display
    if (profile && profile.photoData && profilePhotoDisplay) {
        profilePhotoDisplay.src = profile.photoData;
        profilePhotoDisplay.style.display = 'block';
        if (profilePhotoPlaceholderDisplay) {
            profilePhotoPlaceholderDisplay.style.display = 'none';
        }
    } else if (profilePhotoDisplay) {
        profilePhotoDisplay.style.display = 'none';
        if (profilePhotoPlaceholderDisplay) {
            profilePhotoPlaceholderDisplay.style.display = 'flex';
        }
    }

    // Update store QR display
    if (profile && profile.qrCodeUrl && storeQrImageDisplay) {
        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(profile.qrCodeUrl)}`;
        storeQrImageDisplay.src = qrApiUrl;
        storeQrImageDisplay.style.display = 'block';
        if (storeQrPlaceholder) {
            storeQrPlaceholder.style.display = 'none';
        }
    } else if (storeQrImageDisplay) {
        storeQrImageDisplay.style.display = 'none';
        if (storeQrPlaceholder) {
            storeQrPlaceholder.style.display = 'block';
        }
    }

    // Update payment methods display
    renderPaymentMethodsProfile();

    // Update inventory display
    updateInventoryDisplay();
}

// Update inventory display from profile data
function updateInventoryDisplay() {
    if (!profile) return;
    
    const inventoryFields = [
        'ThinMints', 'Samoas', 'Tagalongs', 'Trefoils', 
        'DosiDos', 'LemonUps', 'Adventurefuls', 'Exploremores', 'Toffeetastic'
    ];
    
    inventoryFields.forEach(field => {
        const input = document.getElementById(`inventory${field}`);
        if (input) {
            const value = profile[`inventory${field}`] || 0;
            input.value = value;
        }
    });
}

// Increment inventory
function incrementInventory(cookieType) {
    const input = document.getElementById(`inventory${cookieType}`);
    if (input) {
        input.value = parseInt(input.value || 0) + 1;
        saveInventory();
    }
}

// Decrement inventory
function decrementInventory(cookieType) {
    const input = document.getElementById(`inventory${cookieType}`);
    if (input) {
        const currentValue = parseInt(input.value || 0);
        if (currentValue > 0) {
            input.value = currentValue - 1;
            saveInventory();
        }
    }
}

// Save inventory to profile
async function saveInventory() {
    try {
        const inventoryFields = [
            'ThinMints', 'Samoas', 'Tagalongs', 'Trefoils', 
            'DosiDos', 'LemonUps', 'Adventurefuls', 'Exploremores', 'Toffeetastic'
        ];
        
        const inventoryData = inventoryFields.reduce((data, field) => {
            const input = document.getElementById(`inventory${field}`);
            const value = parseInt(input.value, 10);
            data[`inventory${field}`] = (isNaN(value) || value < 0) ? 0 : value;
            return data;
        }, {});

        const response = await fetch(`${API_BASE_URL}/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(inventoryData)
        });

        if (!response.ok) {
            throw new Error('Failed to save inventory');
        }

        profile = await response.json();
    } catch (error) {
        console.error('Error saving inventory:', error);
        alert('Failed to save inventory');
    }
}

// Render payment methods in Profile tab
function renderPaymentMethodsProfile() {
    if (!paymentMethodsDisplay) return;

    if (paymentMethods.length === 0) {
        paymentMethodsDisplay.innerHTML = '';
        if (paymentMethodsPlaceholder) {
            paymentMethodsPlaceholder.style.display = 'block';
        }
        return;
    }

    if (paymentMethodsPlaceholder) {
        paymentMethodsPlaceholder.style.display = 'none';
    }

    paymentMethodsDisplay.innerHTML = paymentMethods.map(method => {
        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(method.url)}`;
        return `
            <div class="qr-display-container">
                <h4 class="qr-method-title">${method.name}</h4>
                <img src="${qrApiUrl}" alt="${method.name} QR Code">
            </div>
        `;
    }).join('');
}

// Handle photo upload
async function handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check file size
    if (file.size > MAX_PHOTO_SIZE) {
        alert(`Photo size must be less than ${MAX_PHOTO_SIZE / (1024 * 1024)}MB`);
        return;
    }
    
    const reader = new FileReader();
    reader.onload = async (event) => {
        const photoData = event.target.result;
        
        try {
            const response = await fetch(`${API_BASE_URL}/profile`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ photoData })
            });
            
            if (!response.ok) {
                throw new Error('Failed to upload photo');
            }
            
            await loadProfile();
            showFeedback('Profile photo updated!');
        } catch (error) {
            console.error('Error uploading photo:', error);
            alert('Error uploading photo. Please try again.');
        }
    };
    reader.readAsDataURL(file);
}

// Handle QR code update
async function handleUpdateQrCode() {
    const qrCodeUrl = qrCodeUrlInput.value.trim();
    
    if (!qrCodeUrl) {
        alert('Please enter a QR code URL');
        return;
    }
    
    // Validate URL format
    try {
        const urlObj = new URL(qrCodeUrl);
        if (urlObj.protocol !== 'https:' && urlObj.protocol !== 'http:') {
            alert('Please enter a valid HTTP or HTTPS URL');
            return;
        }
    } catch (error) {
        alert('Please enter a valid URL');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ qrCodeUrl })
        });
        
        if (!response.ok) {
            throw new Error('Failed to update QR code');
        }
        
        await loadProfile();
        showFeedback('QR code updated!');
    } catch (error) {
        console.error('Error updating QR code:', error);
        alert('Error updating QR code. Please try again.');
    }
}

// Load payment methods
async function loadPaymentMethods() {
    try {
        const response = await fetch(`${API_BASE_URL}/payment-methods`);
        await handleApiResponse(response);
        paymentMethods = await response.json();
        // Update profile display whenever methods change
        updateProfileDisplay();
    } catch (error) {
        if (error.message === 'Authentication required') return;
        console.error('Error loading payment methods:', error);
        paymentMethods = [];
    }
}

// Handle add payment method
async function handleAddPaymentMethod() {
    const name = newPaymentNameInput.value.trim();
    const url = newPaymentUrlInput.value.trim();
    
    if (!name || !url) {
        alert('Please enter both a name and a URL');
        return;
    }
    
    try {
        // Validate URL
        new URL(url);
    } catch {
        alert('Please enter a valid URL (starting with http:// or https://)');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/payment-methods`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, url })
        });
        
        if (!response.ok) {
            throw new Error('Failed to add payment method');
        }
        
        // Clear inputs
        newPaymentNameInput.value = '';
        newPaymentUrlInput.value = '';
        
        await loadPaymentMethods();
        renderPaymentMethodsSettings();
        showFeedback('Payment method added!');
    } catch (error) {
        console.error('Error adding payment method:', error);
        alert('Error adding payment method');
    }
}

// Handle delete payment method
async function handleDeletePaymentMethod(id) {
    if (!confirm('Delete this payment method?')) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/payment-methods/${id}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete payment method');
        }
        
        await loadPaymentMethods();
        renderPaymentMethodsSettings();
        showFeedback('Payment method deleted');
    } catch (error) {
        console.error('Error deleting payment method:', error);
        alert('Error deleting payment method');
    }
}

// Render payment methods in Settings
function renderPaymentMethodsSettings() {
    if (!settingsPaymentMethodsList) return;
    
    if (paymentMethods.length === 0) {
        settingsPaymentMethodsList.innerHTML = '<p class="empty-message">No payment methods added yet.</p>';
        return;
    }
    
    settingsPaymentMethodsList.innerHTML = paymentMethods.map(method => `
        <div class="payment-method-item">
            <div class="payment-method-info">
                <strong>${method.name}</strong>
                <div class="payment-method-url">${method.url}</div>
            </div>
            <button class="btn-delete-small" onclick="handleDeletePaymentMethod(${method.id})">Remove</button>
        </div>
    `).join('');
}

// Handle set goal
// Handle add donation
async function handleAddDonation(e) {
    e.preventDefault();
    
    const amount = parseFloat(donationAmountInput.value);
    const donorName = donorNameInput.value.trim();
    
    if (!amount || amount <= 0) {
        alert('Please enter a valid donation amount.');
        return;
    }
    
    const donation = {
        amount,
        donorName,
        date: new Date().toISOString()
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}/donations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(donation)
        });
        
        if (!response.ok) {
            throw new Error('Failed to add donation');
        }
        
        await loadDonations();
        renderDonations();

        
        // Reset form
        donationForm.reset();
        
        showFeedback('Donation added successfully!');
    } catch (error) {
        console.error('Error adding donation:', error);
        alert('Error adding donation. Please try again.');
    }
}

// Handle delete donation
async function handleDeleteDonation(id) {
    if (confirm('Are you sure you want to delete this donation?')) {
        try {
            const response = await fetch(`${API_BASE_URL}/donations/${id}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete donation');
            }
            
            await loadDonations();
            renderDonations();
    
            showFeedback('Donation deleted.');
        } catch (error) {
            console.error('Error deleting donation:', error);
            alert('Error deleting donation. Please try again.');
        }
    }
}

// Handle add/edit event
async function handleAddEvent(e) {
    e.preventDefault();
    
    const eventName = eventNameInput.value.trim();
    const eventDate = eventDateInput.value;
    const description = eventDescriptionInput.value.trim();
    
    // New fields
    const eventType = document.getElementById('eventType').value;
    const startTime = document.getElementById('eventStartTime').value;
    const endTime = document.getElementById('eventEndTime').value;
    const location = document.getElementById('eventLocation').value;
    const targetGroup = document.getElementById('targetGroup').value;

    if (!eventName || !eventDate) {
        alert('Please enter event name and date.');
        return;
    }
    
    const event = {
        eventName,
        eventDate, // Send raw date string (YYYY-MM-DD), backend handles parsing
        description,
        initialBoxes: 0,
        initialCases: 0,
        remainingBoxes: 0,
        remainingCases: 0,
        donationsReceived: 0,
        eventType,
        startTime,
        endTime,
        location,
        targetGroup,
        troopId: currentUser ? currentUser.troopId : null
    };
    
    try {
        let response;
        if (editingEventId) {
            // Update existing event
            response = await fetch(`${API_BASE_URL}/events/${editingEventId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(event)
            });
        } else {
            // Create new event
            response = await fetch(`${API_BASE_URL}/events`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(event)
            });
        }
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || (editingEventId ? 'Failed to update event' : 'Failed to add event'));
        }
        
        await loadEvents();
        renderCalendar(); // Use new render function

        
        // Reset form and editing state
        resetEventForm();
        
        // Hide form after save
        toggleAddEventForm();
        
        showFeedback(editingEventId ? 'Event updated successfully!' : 'Event saved successfully!');
    } catch (error) {
        console.error('Error saving event:', error);
        alert(`Error saving event: ${error.message}`);
    }
}

function resetEventForm() {
    eventForm.reset();
    editingEventId = null;
    const submitBtn = eventForm.querySelector('button[type="submit"]');
    submitBtn.textContent = 'Save Event';
    
    // Remove cancel button if it exists
    const cancelBtn = document.getElementById('cancelEditEventBtn');
    if (cancelBtn) {
        cancelBtn.remove();
    }
}

function handleEditEvent(id) {
    const event = events.find(e => e.id == id);
    if (!event) return;
    
    editingEventId = id;
    
    // Populate form
    eventNameInput.value = event.eventName;
    // Extract YYYY-MM-DD from the date string for the date input
    eventDateInput.value = event.eventDate ? event.eventDate.split('T')[0] : '';

    eventDescriptionInput.value = event.description || '';
    document.getElementById('eventType').value = event.eventType || 'event';
    document.getElementById('eventStartTime').value = event.startTime || '';
    document.getElementById('eventEndTime').value = event.endTime || '';
    document.getElementById('eventLocation').value = event.location || '';
    document.getElementById('targetGroup').value = event.targetGroup || 'Troop';
    
    // Change submit button text
    const submitBtn = eventForm.querySelector('button[type="submit"]');
    submitBtn.textContent = 'Update Event';
    
    // Add cancel button if not exists
    if (!document.getElementById('cancelEditEventBtn')) {
        const cancelBtn = document.createElement('button');
        cancelBtn.id = 'cancelEditEventBtn';
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn btn-secondary';
        cancelBtn.style.marginLeft = '10px';
        cancelBtn.textContent = 'Cancel Edit';
        cancelBtn.addEventListener('click', resetEventForm);
        submitBtn.parentNode.insertBefore(cancelBtn, submitBtn.nextSibling);
    }
    
    // Scroll to form
    eventForm.scrollIntoView({ behavior: 'smooth' });
}

// Handle delete event
async function handleDeleteEvent(id) {
    if (confirm('Are you sure you want to delete this event?')) {
        try {
            const response = await fetch(`${API_BASE_URL}/events/${id}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete event');
            }
            
            await loadEvents();
            renderCalendar();
    
            showFeedback('Event deleted.');
        } catch (error) {
            console.error('Error deleting event:', error);
            alert('Error deleting event. Please try again.');
        }
    }
}

// Render Calendar
function renderCalendar() {
    const calendarGrid = document.getElementById('calendarGrid');
    const monthYearLabel = document.getElementById('calendarMonthYear');
    
    if (!calendarGrid || !monthYearLabel) return;

    calendarGrid.innerHTML = '';
    
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    monthYearLabel.textContent = currentCalendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayIndex = firstDay.getDay();
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    
    // Prev Month
    for (let i = startDayIndex - 1; i >= 0; i--) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day other-month';
        dayDiv.innerHTML = `<div class="calendar-date-num">${prevMonthLastDay - i}</div>`;
        calendarGrid.appendChild(dayDiv);
    }
    
    const today = new Date();
    // Get active filters
    const activeFiltersEl = document.querySelectorAll('.event-filter:checked');
    // If no filters found (maybe on different tab), assume all?
    const activeFilters = activeFiltersEl.length > 0 ? Array.from(activeFiltersEl).map(cb => cb.value) : ['Troop', 'Pack', 'Lion', 'Tiger', 'Wolf', 'Bear', 'Webelos', 'AOL', 'Daisy', 'Brownie', 'Junior', 'Cadette', 'Senior', 'Ambassador', 'GS'];

    // Current Month
    for (let i = 1; i <= lastDay.getDate(); i++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        
        if (year === today.getFullYear() && month === today.getMonth() && i === today.getDate()) {
            dayDiv.classList.add('today');
        }
        
        dayDiv.innerHTML = `<div class="calendar-date-num">${i}</div>`;
        
        const dayEvents = events.filter(e => {
            if (!e.eventDate) return false;
            // Parse date string directly to avoid timezone shifts
            const [eYear, eMonth, eDay] = e.eventDate.split('T')[0].split('-').map(Number);
            return eDay === i && (eMonth - 1) === month && eYear === year;
        });
        
        dayEvents.forEach(event => {
            const group = event.targetGroup || 'Troop';
            if (activeFilters.length > 0 && !activeFilters.includes(group)) {
                return;
            }

            const eventPill = document.createElement('div');
            eventPill.className = `calendar-event event-${group}`;
            
            let timeStr = '';
            if (event.startTime) {
                timeStr = event.startTime;
            }
            
            eventPill.textContent = (timeStr ? timeStr + ' ' : '') + event.eventName;
            eventPill.title = `${event.eventName}\n${event.startTime || ''} - ${event.endTime || ''}\n${event.location || ''}\n${event.description || ''}`;
            
            eventPill.onclick = (e) => {
                e.stopPropagation();
                alert(`${event.eventName}\nTime: ${event.startTime || 'N/A'}\nLocation: ${event.location || 'N/A'}\nGroup: ${group}\n\n${event.description || ''}`);
            };
            
            dayDiv.appendChild(eventPill);
        });
        
        calendarGrid.appendChild(dayDiv);
    }
    
    // Next Month
    const totalCells = startDayIndex + lastDay.getDate();
    const rows = Math.ceil(totalCells / 7);
    const nextMonthPadding = (rows * 7) - totalCells;
    
    for (let i = 1; i <= nextMonthPadding; i++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day other-month';
        dayDiv.innerHTML = `<div class="calendar-date-num">${i}</div>`;
        calendarGrid.appendChild(dayDiv);
    }
}

// Calendar Helpers
function changeMonth(offset) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + offset);
    renderCalendar();
}

function goToToday() {
    currentCalendarDate = new Date();
    renderCalendar();
}

function toggleAddEventForm() {
    const form = document.getElementById('addEventSection');
    if (form) form.classList.toggle('hidden');
}

async function exportCalendar() {
    if (!currentUser || !currentUser.troopId) {
        alert('No troop selected or not a member of a troop.');
        return;
    }
    window.location.href = `${API_BASE_URL}/troop/${currentUser.troopId}/calendar/export`;
}

// Render donations list
function renderDonations() {
    if (!donationsList) return;
    if (donations.length === 0) {
        donationsList.innerHTML = '<p class="empty-message">No donations recorded yet.</p>';
        return;
    }
    
    donationsList.innerHTML = donations.map(donation => {
        const date = new Date(donation.date);
        const formattedDate = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        return `
            <div class="donation-item">
                <div class="donation-info">
                    <div class="donation-amount">$${parseFloat(donation.amount || 0).toFixed(2)}</div>
                    <div class="donation-details">
                        ${donation.donorName} • ${formattedDate}
                    </div>
                </div>
                <div class="donation-actions">
                    <button class="btn-delete" onclick="handleDeleteDonation(${donation.id})">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

// Show feedback message (simple toast-like notification)
function showFeedback(message) {
    // Create a simple temporary feedback element
    const feedback = document.createElement('div');
    feedback.textContent = message;
    feedback.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background-color: var(--primary-color);
        color: white;
        padding: 12px 24px;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        z-index: 1000;
        animation: slideDown 0.3s ease-out;
        font-weight: 500;
    `;
    
    document.body.appendChild(feedback);
    
    // Remove after 2 seconds
    setTimeout(() => {
        feedback.style.animation = 'slideUp 0.3s ease-out';
        setTimeout(() => {
            if (document.body.contains(feedback)) {
                feedback.remove();
            }
        }, 300);
    }, 2000);
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideDown {
        from {
            transform: translateX(-50%) translateY(-100%);
            opacity: 0;
        }
        to {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
    }
    
    @keyframes slideUp {
        from {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
        to {
            transform: translateX(-50%) translateY(-100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Switch View (Global)
function switchView(viewId) {
    const views = document.querySelectorAll('.view-section');
    const tabButtons = document.querySelectorAll('.tab-btn');

    // Hide all views
    views.forEach(view => view.classList.add('hidden'));

    // Show selected view
    const selectedView = document.getElementById('view-' + viewId);
    if (selectedView) {
        selectedView.classList.remove('hidden');
    }

    // Update tab buttons
    tabButtons.forEach(btn => {
        if (btn.dataset.view === viewId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Save preference
    localStorage.setItem('lastView', viewId);

    // Load cookie dashboard data when switching to cookies view
    if (viewId === 'cookies') {
        loadCookieDashboard();
    }
}

// Navigation Logic
function setupNavigation() {
    const tabButtons = document.querySelectorAll('.tab-btn');

    // Add event listeners — skip buttons that have no data-view (e.g. logout)
    tabButtons.forEach(btn => {
        if (!btn.dataset.view) return;
        btn.addEventListener('click', () => {
            switchView(btn.dataset.view);
            // Close mobile menu after selection
            closeMobileMenu();
        });
    });

    // Load last view or default to profile (fallback removed views)
    let lastView = localStorage.getItem('lastView') || 'profile';
    if (lastView === 'dashboard' || lastView === 'sales') {
        lastView = 'profile';
    }
    switchView(lastView);
}

// Troop top navigation (Membership / placeholders)
function setupTroopNavigation() {
    const troopTabs = document.querySelectorAll('.troop-tab');
    const panels = document.querySelectorAll('.troop-tab-panel');

    if (!troopTabs.length) return;

    troopTabs.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.tab;

            // Toggle active on tabs
            troopTabs.forEach(t => t.classList.toggle('active', t === btn));

            // Show matching panel
            panels.forEach(p => {
                if (p.id === 'troop-tab-' + target) p.classList.remove('hidden'); else p.classList.add('hidden');
            });

            // Load data for specific tabs (Phase 4.5)
            if (target === 'fulfillment' && selectedTroopId) {
                loadFulfillmentOrders(selectedTroopId);
                loadTroopSharedInventory(selectedTroopId);
            }
        });
    });

    // Membership search behavior (filter rows across sub-panels)
    const memberSearch = document.getElementById('memberSearch');
    if (memberSearch) {
        memberSearch.addEventListener('input', () => {
            const q = memberSearch.value.toLowerCase();
            const bodies = document.querySelectorAll('[id^="membershipTableBody_"]');
            bodies.forEach(body => {
                Array.from(body.querySelectorAll('tr')).forEach(tr => {
                    tr.style.display = q ? (tr.textContent.toLowerCase().includes(q) ? '' : 'none') : '';
                });
            });
        });
    }

    // Membership sub-tab switching
    const subTabs = document.querySelectorAll('.membership-subtab');
    const subPanels = document.querySelectorAll('.membership-subpanel');
    if (subTabs.length) {
        subTabs.forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.sub;
                subTabs.forEach(t => t.classList.toggle('active', t === btn));
                subPanels.forEach(p => {
                    if (p.id === 'membership-sub-' + target) p.classList.remove('hidden'); else p.classList.add('hidden');
                });
                // Update add-member button label when switching subtabs
                try { updateAddMemberButtonLabel(); } catch (e) { /* ignore */ }
            });
        });
    }
}

// Mobile Menu Management
function setupMobileMenu() {
    const menuBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.querySelector('.tab-nav');
    const overlay = document.getElementById('sidebarOverlay');

    if (menuBtn) {
        menuBtn.addEventListener('click', toggleMobileMenu);
    }

    if (overlay) {
        overlay.addEventListener('click', closeMobileMenu);
    }
}

function toggleMobileMenu() {
    const sidebar = document.querySelector('.tab-nav');
    const overlay = document.getElementById('sidebarOverlay');

    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}

function closeMobileMenu() {
    const sidebar = document.querySelector('.tab-nav');
    const overlay = document.getElementById('sidebarOverlay');

    if (sidebar) sidebar.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
}

// Theme Management
function setupTheme() {
    const themeButtons = document.querySelectorAll('.theme-btn');
    const savedTheme = localStorage.getItem('theme') || 'system';

    // Apply saved theme on load
    applyTheme(savedTheme);
    updateThemeButtons(savedTheme);

    // Listen for system preference changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        const currentTheme = localStorage.getItem('theme') || 'system';
        if (currentTheme === 'system') {
            applyTheme('system');
        }
    });

    // Add event listeners for theme buttons
    themeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.dataset.theme;
            localStorage.setItem('theme', theme);
            applyTheme(theme);
            updateThemeButtons(theme);
            showFeedback(`Theme changed to ${theme}`);
        });
    });
}

function applyTheme(theme) {
    const html = document.documentElement;

    if (theme === 'system') {
        // Use system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        html.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
        html.setAttribute('data-theme', theme);
    }
}

function updateThemeButtons(activeTheme) {
    const themeButtons = document.querySelectorAll('.theme-btn');
    themeButtons.forEach(btn => {
        if (btn.dataset.theme === activeTheme) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// Import Management
function setupImport() {
    const importFileInput = document.getElementById('importFile');
    const selectFileBtn = document.getElementById('selectFileBtn');
    const importBtn = document.getElementById('importBtn');
    const selectedFileName = document.getElementById('selectedFileName');
    const importStatus = document.getElementById('importStatus');

    if (!importFileInput || !selectFileBtn || !importBtn) return;

    selectFileBtn.addEventListener('click', () => {
        importFileInput.click();
    });

    importFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            selectedFileName.textContent = file.name;
            importBtn.disabled = false;
            importStatus.className = 'import-status';
            importStatus.textContent = '';
        } else {
            selectedFileName.textContent = '';
            importBtn.disabled = true;
        }
    });

    importBtn.addEventListener('click', async () => {
        const file = importFileInput.files[0];
        if (!file) {
            showFeedback('Please select a file first');
            return;
        }

        // Show loading state
        importBtn.disabled = true;
        importStatus.className = 'import-status loading';
        importStatus.textContent = 'Importing...';

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${API_BASE_URL}/import`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Import failed');
            }

            // Show success
            importStatus.className = 'import-status success';
            importStatus.textContent = `Successfully imported ${result.salesImported} sales from ${result.ordersProcessed} orders`;

            showFeedback('Import successful!');

            // Reset file input
            importFileInput.value = '';
            selectedFileName.textContent = '';
            importBtn.disabled = true;

        } catch (error) {
            console.error('Import error:', error);
            importStatus.className = 'import-status error';
            importStatus.textContent = `Error: ${error.message}`;
            importBtn.disabled = false;
        }
    });
}

// Setup Danger Zone buttons
function setupDangerZone() {
    const deleteAllDataBtn = document.getElementById('deleteAllDataBtn');

    if (deleteAllDataBtn) {
        deleteAllDataBtn.addEventListener('click', async () => {
            const confirmed = confirm(
                '⚠️ WARNING: Delete All Data?\n\n' +
                'This will permanently delete ALL sales and donation records.\n' +
                'This action cannot be undone.\n\n' +
                'Are you sure you want to continue?'
            );

            if (!confirmed) return;

            // Double confirmation for safety
            const doubleConfirm = confirm(
                '🚨 FINAL WARNING 🚨\n\n' +
                'You are about to delete ALL data.\n' +
                'Click OK to permanently wipe the database.'
            );

            if (!doubleConfirm) return;

            try {
                const response = await fetch(`${API_BASE_URL}/data`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    const result = await response.json();
                    showFeedback(`Deleted ${result.salesDeleted} sales and ${result.donationsDeleted} donations`);
                    await loadDonations();
                } else {
                    showFeedback('Failed to delete data', true);
                }
            } catch (error) {
                console.error('Delete data error:', error);
                showFeedback('Error deleting data: ' + error.message, true);
            }
        });
    }
}

// ============================================================================
// Troop Management (Phase 2)
// ============================================================================

let selectedTroopId = null;
let troopMembers = [];
let troopGoals = [];
let troopSalesData = null;

// Setup role-based UI visibility
function setupRoleBasedUI() {
    const troopLeaderTab = document.getElementById('troopLeaderTab');
    const councilTab = document.getElementById('councilTab');

    if (troopLeaderTab && currentUser) {
        if (currentUser.role === 'troop_leader' || currentUser.role === 'admin') {
            troopLeaderTab.style.display = '';
        } else {
            troopLeaderTab.style.display = 'none';
        }
    }

    if (councilTab && currentUser) {
        if (currentUser.role === 'admin') {
            councilTab.style.display = '';
        } else {
            councilTab.style.display = 'none';
        }
    }
}

// Setup troop management
function setupTroopManagement() {
    const troopSelector = document.getElementById('troopSelector');
    const createTroopBtn = document.getElementById('createTroopBtn');
    const addGoalBtn = document.getElementById('addGoalBtn');
    const memberSearchEmail = document.getElementById('memberSearchEmail');

    // Attach click handler to all add-member buttons
    document.querySelectorAll('.add-member-btn').forEach(btn => {
        btn.addEventListener('click', openAddMemberModal);
    });

    if (troopSelector) {
        troopSelector.addEventListener('change', (e) => {
            selectedTroopId = e.target.value;
            if (selectedTroopId) {
                loadTroopData(selectedTroopId);
            } else {
                showTroopEmptyState();
            }
        });
    }

    if (createTroopBtn) {
        createTroopBtn.addEventListener('click', openCreateTroopModal);
    }

    if (addGoalBtn) {
        addGoalBtn.addEventListener('click', openAddGoalModal);
    }

    if (memberSearchEmail) {
        let searchTimeout;
        memberSearchEmail.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => searchUsers(e.target.value), 300);
        });
    }

    // Permissions tab listeners
    const permsMemberSelect = document.getElementById('permsMemberSelect');
    if (permsMemberSelect) {
        permsMemberSelect.addEventListener('change', loadMemberPrivileges);
    }
    const savePermsBtn = document.getElementById('savePermsBtn');
    if (savePermsBtn) {
        savePermsBtn.addEventListener('click', savePrivilegeOverrides);
    }
    const resetPermsBtn = document.getElementById('resetPermsBtn');
    if (resetPermsBtn) {
        resetPermsBtn.addEventListener('click', resetPrivilegesToDefaults);
    }

    // Load troops on init
    loadMyTroops();
}

// Load user's troops
async function loadMyTroops() {
    try {
        const response = await fetch(`${API_BASE_URL}/troop/my-troops`, {
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to load troops');

        const troops = await response.json();
        myTroopsList = troops; // Store globally so badge catalog can filter by org
        const troopSelector = document.getElementById('troopSelector');

        if (troopSelector) {
            troopSelector.innerHTML = '<option value="">Select a troop...</option>';
            troops.forEach(troop => {
                const option = document.createElement('option');
                option.value = troop.id;
                option.textContent = `Troop ${troop.troopNumber} (${troop.troopType}) - ${troop.memberCount} members`;
                troopSelector.appendChild(option);
            });

            // Auto-select if only one troop
            if (troops.length === 1) {
                troopSelector.value = troops[0].id;
                selectedTroopId = troops[0].id;
                loadTroopData(troops[0].id);
            } else if (troops.length === 0) {
                showTroopEmptyState();
            }
        }

        // Reload badge catalog now that myTroopsList and selectedTroopId are set,
        // in case loadBadgeCatalogForLeader() ran earlier (from init) before troops loaded.
        if (canAwardBadges() && myTroopsList.length > 0) {
            loadBadgeCatalogForLeader();
        }
    } catch (error) {
        console.error('Error loading troops:', error);
    }
}

// Load all data for a specific troop
async function loadTroopData(troopId) {
    try {
        const [membersRes, salesRes, goalsRes] = await Promise.all([
            fetch(`${API_BASE_URL}/troop/${troopId}/members`, { 
                credentials: 'include',
                cache: 'no-cache'
            }),
            fetch(`${API_BASE_URL}/troop/${troopId}/sales`, { 
                credentials: 'include',
                cache: 'no-cache'
            }),
            fetch(`${API_BASE_URL}/troop/${troopId}/goals`, { 
                credentials: 'include',
                cache: 'no-cache'
            })
        ]);

        if (!membersRes.ok || !salesRes.ok || !goalsRes.ok) {
            throw new Error('Failed to load troop data');
        }

        troopMembers = await membersRes.json();
        troopSalesData = await salesRes.json();
        troopGoals = await goalsRes.json();

        renderTroopDashboard();
    } catch (error) {
        console.error('Error loading troop data:', error);
        showFeedback('Failed to load troop data', true);
    }
}

// Render the troop dashboard
function renderTroopDashboard() {
    const dashboardTab = document.getElementById('troop-tab-dashboard');
    const emptyState = document.getElementById('troopEmptyState');

    // Show dashboard content within the tab
    if (dashboardTab) {
        // Remove the inline display:none if it was set
        const summaryCards = dashboardTab.querySelector('.summary-cards');
        if (summaryCards) summaryCards.style.display = '';
    }
    if (emptyState) emptyState.style.display = 'none';

    // Update summary cards
    document.getElementById('troopTotalBoxes').textContent = troopSalesData?.totals?.totalBoxes || 0;
    document.getElementById('troopTotalCollected').textContent = `$${parseFloat(troopSalesData?.totals?.totalCollected || 0).toFixed(2)}`;
    document.getElementById('troopMemberCount').textContent = troopMembers.length;

    // Render members table
    renderTroopMembers();
    // Render membership tab (top-nav) if present
    renderMembershipTab();

    // Render goals
    renderTroopGoals();

    // Render sales by cookie
    renderTroopSalesByCookie();

    // Populate permissions member dropdown
    populatePermsMemberDropdown();
}

// Show empty state when no troop selected
function showTroopEmptyState() {
    const emptyState = document.getElementById('troopEmptyState');

    if (emptyState) emptyState.style.display = 'block';
}

// Render troop members table
function renderTroopMembers() {
    const tbody = document.getElementById('troopMembersTable');
    if (!tbody) return;

    if (troopMembers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No members yet. Add members to get started!</td></tr>';
        return;
    }

    tbody.innerHTML = troopMembers.map(member => {
        const lastSale = member.lastSaleDate ? new Date(member.lastSaleDate).toLocaleDateString() : 'No sales';
        const roleDisplay = {
            'member': 'Scout',
            'co-leader': 'Co-Leader',
            'assistant': 'Assistant'
        }[member.troopRole] || member.troopRole;

        return `
            <tr>
                <td>
                    <div class="member-name">
                        ${member.photoUrl ? `<img src="${member.photoUrl}" class="member-avatar" alt="">` : ''}
                        <span>${member.firstName} ${member.lastName}</span>
                    </div>
                </td>
                <td><span class="role-badge role-${member.troopRole}">${roleDisplay}</span></td>
                <td>${member.totalBoxes}</td>
                <td>$${parseFloat(member.totalCollected || 0).toFixed(2)}</td>
                <td>${lastSale}</td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="removeMember('${member.id}')" title="Remove">
                        ✕
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Render troop goals
function renderTroopGoals() {
    const container = document.getElementById('troopGoalsList');
    if (!container) return;

    if (troopGoals.length === 0) {
        container.innerHTML = '<p class="empty-state">No goals set. Add a goal to track progress!</p>';
        return;
    }

    container.innerHTML = troopGoals.map(goal => {
        const targetAmount = parseFloat(goal.targetAmount || 0);
        const actualAmount = parseFloat(goal.actualAmount || 0);
        const progress = targetAmount > 0 ? Math.min(100, (actualAmount / targetAmount) * 100) : 0;
        const typeLabels = {
            'boxes_sold': 'Boxes Sold',
            'revenue': 'Revenue',
            'participation': 'Participation'
        };

        return `
            <div class="goal-card">
                <div class="goal-header">
                    <span class="goal-type">${typeLabels[goal.goalType] || goal.goalType}</span>
                    <span class="goal-status status-${goal.status}">${goal.status.replace('_', ' ')}</span>
                </div>
                <div class="goal-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                    <span class="progress-text">${actualAmount} / ${targetAmount}</span>
                </div>
                ${goal.description ? `<p class="goal-description">${goal.description}</p>` : ''}
            </div>
        `;
    }).join('');
}

// Render the simple membership tab table (top-nav view)
function renderMembershipTab() {
    // Populate sub-panels: scout, family, leadership, volunteer
    const scoutBody = document.getElementById('membershipTableBody_scout');
    const familyBody = document.getElementById('membershipTableBody_family');
    const leadershipBody = document.getElementById('membershipTableBody_leadership');
    const volunteerBody = document.getElementById('membershipTableBody_volunteer');

    const members = troopMembers || [];

    // Scouts: treat troopRole 'member' as scouts
    const scouts = members.filter(m => !m.troopRole || m.troopRole === 'member' || m.troopRole === 'scout');
    if (scoutBody) {
        if (scouts.length === 0) {
            scoutBody.innerHTML = '<tr><td colspan="5" class="empty-state">No scouts yet.</td></tr>';
        } else {
            scoutBody.innerHTML = scouts.map(m => {
                const name = `${m.firstName || ''} ${m.lastName || ''}`.trim() || m.email || 'Unknown';
                const level = m.scoutLevel || '-';
                const status = m.status || 'Active';
                return `
                    <tr>
                        <td>${name}</td>
                        <td>${m.troopRole || 'Scout'}</td>
                        <td>${level}</td>
                        <td>${status}</td>
                        <td class="member-actions-cell">
                            <button class="btn btn-sm" onclick="viewMember('${m.id}')">Edit</button>
                            ${canAwardBadges() ? `<button class="btn btn-sm btn-secondary badge-award-btn" data-userid="${escapeHtml(m.id)}" data-name="${escapeHtml(name)}">+ Badge</button>` : ''}
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }

    // Family: show distinct last names for members with parent role
    if (familyBody) {
        const families = members.filter(m => m.troopRole === 'parent' || m.troopRole === 'guardian');
        if (families.length === 0) {
            familyBody.innerHTML = '<tr><td class="empty-state">No family records yet.</td></tr>';
        } else {
            const lastNames = [...new Set(families.map(f => (f.lastName || '').trim()).filter(Boolean))];
            familyBody.innerHTML = lastNames.map(ln => `<tr><td>${ln}</td></tr>`).join('');
        }
    }

    // Leadership: co-leader, assistant, troop_leader
    if (leadershipBody) {
        const leads = members.filter(m => ['co-leader', 'assistant', 'troop_leader'].includes(m.troopRole));
        if (leads.length === 0) {
            leadershipBody.innerHTML = '<tr><td colspan="5" class="empty-state">No leadership members</td></tr>';
        } else {
            leadershipBody.innerHTML = leads.map(m => {
                const name = `${m.firstName || ''} ${m.lastName || ''}`.trim() || m.email || 'Unknown';
                return `
                    <tr>
                        <td>${name}</td>
                        <td>${m.troopRole}</td>
                        <td>${m.scoutLevel || '-'}</td>
                        <td>${m.status || 'Active'}</td>
                        <td><button class="btn" onclick="viewMember('${m.id}')">Edit</button></td>
                    </tr>
                `;
            }).join('');
        }
    }

    // Volunteers
    if (volunteerBody) {
        const vols = members.filter(m => m.troopRole === 'volunteer' || m.troopRole === 'parent');
        if (vols.length === 0) {
            volunteerBody.innerHTML = '<tr><td colspan="5" class="empty-state">No volunteers</td></tr>';
        } else {
            volunteerBody.innerHTML = vols.map(m => {
                const name = `${m.firstName || ''} ${m.lastName || ''}`.trim() || m.email || 'Unknown';
                return `
                    <tr>
                        <td>${name}</td>
                        <td>${m.troopRole}</td>
                        <td>${m.scoutLevel || '-'}</td>
                        <td>${m.status || 'Active'}</td>
                        <td><button class="btn" onclick="viewMember('${m.id}')">Edit</button></td>
                    </tr>
                `;
            }).join('');
        }
    }

    // Update Add Member button label based on active subtab
    updateAddMemberButtonLabel();
}

function updateAddMemberButtonLabel() {
    const active = document.querySelector('.membership-subtab.active');
    const addBtn = document.getElementById('addMemberBtnMembership');
    if (!addBtn) return;
    const map = {
        scout: 'Add Scout',
        family: 'Add Family',
        leadership: 'Add Leadership',
        volunteer: 'Add Volunteer'
    };
    const label = active ? map[active.dataset.sub] || 'Add Member' : 'Add Member';
    addBtn.textContent = label;
}

// Simple view member handler (placeholder - can open detailed modal)
function viewMember(memberId) {
    const member = troopMembers.find(m => m.id === memberId);
    if (!member) return showFeedback('Member not found', true);
    alert(`Member:\n\nName: ${member.firstName} ${member.lastName}\nRole: ${member.troopRole || '-'}\nLevel: ${member.scoutLevel || '-'}\nEmail: ${member.email || '--'}`);
}

// Render sales by cookie type
function renderTroopSalesByCookie() {
    const container = document.getElementById('troopSalesByCookie');
    if (!container) return;

    const salesByCookie = troopSalesData?.salesByCookie || [];

    if (salesByCookie.length === 0) {
        container.innerHTML = '<p class="empty-state">No sales data yet</p>';
        return;
    }

    // Find max quantity for scaling bars
    const maxQty = Math.max(...salesByCookie.map(i => i.totalQuantity));

    container.innerHTML = salesByCookie.map(item => {
        const pct = maxQty > 0 ? Math.round((item.totalQuantity / maxQty) * 100) : 0;
        return `
            <div class="cookie-sale-item-v2" style="margin-bottom: var(--space-md);">
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span class="cookie-name" style="font-weight:600;">${item.cookieType}</span>
                    <span class="cookie-quantity">${item.totalQuantity} boxes</span>
                </div>
                <div class="progress-bar-container" style="height: 8px; background: var(--gray-200); border-radius: 4px; overflow: hidden;">
                    <div class="progress-bar-fill" style="width: ${pct}%; height: 100%; background: var(--primary-color); border-radius: 4px;"></div>
                </div>
                <div style="text-align:right; font-size:0.8rem; color: #666; margin-top:2px;">
                    $${parseFloat(item.totalCollected || 0).toFixed(2)}
                </div>
            </div>
        `;
    }).join('');
}

// ============================================================================
// Privilege Management Functions
// ============================================================================

function populatePermsMemberDropdown() {
    const select = document.getElementById('permsMemberSelect');
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="">Choose a member...</option>';

    if (!troopMembers || troopMembers.length === 0) return;

    // Filter out the current user (no self-modification)
    const members = troopMembers.filter(m => m.id !== currentUser?.id && m.status !== 'inactive');
    members.sort((a, b) => {
        const nameA = `${a.lastName || ''}, ${a.firstName || ''}`.toLowerCase();
        const nameB = `${b.lastName || ''}, ${b.firstName || ''}`.toLowerCase();
        return nameA.localeCompare(nameB);
    });

    for (const m of members) {
        const opt = document.createElement('option');
        opt.value = m.id;
        const role = m.troopRole || m.role || 'member';
        opt.textContent = `${m.lastName || ''}, ${m.firstName || ''} (${role})`;
        select.appendChild(opt);
    }

    // Restore selection if still valid
    if (currentValue && members.some(m => m.id === currentValue)) {
        select.value = currentValue;
    }
}

async function loadMemberPrivileges() {
    const select = document.getElementById('permsMemberSelect');
    const userId = select ? select.value : '';
    const container = document.getElementById('permsMatrixContainer');
    const emptyState = document.getElementById('permsEmptyState');

    if (!userId) {
        if (container) container.style.display = 'none';
        if (emptyState) emptyState.style.display = '';
        currentPermsUserId = null;
        currentPermsMemberRole = null;
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/troop/${selectedTroopId}/members/${userId}/privileges`, {
            credentials: 'include'
        });
        await handleApiResponse(res);
        const data = await res.json();

        currentPermsUserId = userId;
        currentPermsMemberRole = data.member.troopRole;

        // Show member info
        const memberInfo = document.getElementById('permsMemberInfo');
        if (memberInfo) {
            memberInfo.innerHTML = `
                <strong>${data.member.firstName} ${data.member.lastName}</strong>
                <span class="role-badge role-${data.member.troopRole}">${data.member.troopRole}</span>
            `;
        }

        renderPrivilegeMatrix(data.privileges);

        if (container) container.style.display = '';
        if (emptyState) emptyState.style.display = 'none';
    } catch (error) {
        console.error('Failed to load privileges:', error);
        showFeedback('Failed to load member privileges', true);
    }
}

function renderPrivilegeMatrix(privileges) {
    const tbody = document.getElementById('permsMatrixBody');
    if (!tbody) return;

    let html = '';
    let lastCategory = '';

    for (const priv of privileges) {
        // Category header row
        if (priv.category !== lastCategory) {
            lastCategory = priv.category;
            html += `<tr class="priv-category-row"><td colspan="7">${priv.category}</td></tr>`;
        }

        const isOverride = priv.effectiveScope !== priv.defaultScope;
        const rowClass = isOverride ? 'priv-row-override' : '';
        const futureTag = priv.future ? ' <span class="priv-future-tag">(future)</span>' : '';

        html += `<tr class="${rowClass}" data-code="${priv.code}">`;
        html += `<td class="priv-name-col">${priv.name}${futureTag}</td>`;

        for (const scope of SCOPE_ORDER) {
            const checked = priv.effectiveScope === scope ? 'checked' : '';
            html += `<td class="priv-scope-col">
                <input type="radio" name="priv_${priv.code}" value="${scope}" ${checked}
                    data-code="${priv.code}" data-default="${priv.defaultScope}">
            </td>`;
        }

        html += `<td class="priv-default-col">${priv.defaultScope === 'none' ? '---' : priv.defaultScope}</td>`;
        html += '</tr>';
    }

    tbody.innerHTML = html;

    // Add change listeners to highlight overrides
    tbody.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const row = e.target.closest('tr');
            const defaultScope = e.target.dataset.default;
            if (e.target.value !== defaultScope) {
                row.classList.add('priv-row-override');
            } else {
                row.classList.remove('priv-row-override');
            }
        });
    });
}

function collectPrivilegeOverrides() {
    const overrides = [];
    for (const priv of PRIVILEGE_DEFINITIONS) {
        const checked = document.querySelector(`input[name="priv_${priv.code}"]:checked`);
        if (checked) {
            overrides.push({ code: priv.code, scope: checked.value });
        }
    }
    return overrides;
}

async function savePrivilegeOverrides() {
    if (!currentPermsUserId || !selectedTroopId) return;

    const overrides = collectPrivilegeOverrides();

    try {
        const res = await fetch(`${API_BASE_URL}/troop/${selectedTroopId}/members/${currentPermsUserId}/privileges`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ overrides })
        });
        await handleApiResponse(res);
        const data = await res.json();

        // Re-render with saved state
        renderPrivilegeMatrix(data.privileges);
        showFeedback('Permissions saved successfully');
    } catch (error) {
        console.error('Failed to save privileges:', error);
        showFeedback('Failed to save permissions', true);
    }
}

async function resetPrivilegesToDefaults() {
    if (!currentPermsUserId || !selectedTroopId) return;
    if (!confirm('Reset all privileges to role defaults? You must click Save to apply.')) return;

    // Reset radios to defaults using client-side constants
    const roleDefaults = ROLE_PRIVILEGE_DEFAULTS[currentPermsMemberRole] || ROLE_PRIVILEGE_DEFAULTS.member;

    for (const priv of PRIVILEGE_DEFINITIONS) {
        const defaultScope = roleDefaults[priv.code] || 'none';
        const radio = document.querySelector(`input[name="priv_${priv.code}"][value="${defaultScope}"]`);
        if (radio) {
            radio.checked = true;
            const row = radio.closest('tr');
            if (row) row.classList.remove('priv-row-override');
        }
    }
}

// Modal functions
function openCreateTroopModal() {
    document.getElementById('createTroopModal').style.display = 'flex';
}

function closeCreateTroopModal() {
    document.getElementById('createTroopModal').style.display = 'none';
    // Clear form
    document.getElementById('newTroopNumber').value = '';
    document.getElementById('newTroopType').value = '';
    document.getElementById('newTroopMeetingLocation').value = '';
    document.getElementById('newTroopMeetingDay').value = '';
    document.getElementById('newTroopMeetingTime').value = '';
}

function openAddMemberModal() {
    if (!selectedTroopId) {
        showFeedback('Please select a troop first', true);
        return;
    }
    // Determine active membership subtab to set modal defaults
    const activeSub = document.querySelector('.membership-subtab.active');
    const subtype = activeSub ? activeSub.dataset.sub : null;
    const header = document.querySelector('#addMemberModal .modal-header h3');
    const confirmBtn = document.getElementById('confirmAddMemberBtn');

    let defaultPosition = '';
    let headerLabel = 'Add Member';
    if (subtype === 'scout') {
        defaultPosition = 'Scout';
        headerLabel = 'Add Scout';
    } else if (subtype === 'family') {
        defaultPosition = 'Troop Volunteer';
        headerLabel = 'Add Family';
    } else if (subtype === 'leadership') {
        defaultPosition = 'Co-Leader';
        headerLabel = 'Add Leadership';
    } else if (subtype === 'volunteer') {
        defaultPosition = 'Troop Volunteer';
        headerLabel = 'Add Volunteer';
    }

    if (header) header.textContent = headerLabel;
    if (confirmBtn) confirmBtn.textContent = 'Save';

    // Populate roles based on current position selection and show modal
    const memberLevelSelect = document.getElementById('memberLevel');
    if (memberLevelSelect && defaultPosition) memberLevelSelect.value = defaultPosition;
    const currentPosition = document.getElementById('memberLevel')?.value || '';
    populateMemberRolesSelect(currentPosition);
    document.getElementById('addMemberModal').style.display = 'flex';
}

function closeAddMemberModal() {
    document.getElementById('addMemberModal').style.display = 'none';
    // Clear generic add-member form fields
    const fields = [
        'memberFirstName','memberLastName','memberEmail','memberAddress','memberBirthdate','memberDen','memberFamilyInfo','memberLevel'
    ];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.tagName === 'SELECT') el.selectedIndex = 0; else el.value = '';
    });
    // Clear roles options
    const rolesSelect = document.getElementById('memberRoles');
    if (rolesSelect) rolesSelect.innerHTML = '';
}

function openAddGoalModal() {
    if (!selectedTroopId) {
        showFeedback('Please select a troop first', true);
        return;
    }
    // Set default dates
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('goalStartDate').value = today;
    document.getElementById('addGoalModal').style.display = 'flex';
}

function closeAddGoalModal() {
    document.getElementById('addGoalModal').style.display = 'none';
    document.getElementById('goalType').value = '';
    document.getElementById('goalTarget').value = '';
    document.getElementById('goalStartDate').value = '';
    document.getElementById('goalEndDate').value = '';
    document.getElementById('goalDescription').value = '';
}

// Create a new troop
async function createTroop() {
    const troopNumber = document.getElementById('newTroopNumber').value.trim();
    const troopType = document.getElementById('newTroopType').value;
    const meetingLocation = document.getElementById('newTroopMeetingLocation').value.trim();
    const meetingDay = document.getElementById('newTroopMeetingDay').value;
    const meetingTime = document.getElementById('newTroopMeetingTime').value;

    if (!troopNumber || !troopType) {
        showFeedback('Please fill in required fields', true);
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/troop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                troopNumber,
                troopType,
                meetingLocation,
                meetingDay,
                meetingTime
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create troop');
        }

        const newTroop = await response.json();
        showFeedback(`Troop ${troopNumber} created successfully!`);
        closeCreateTroopModal();

        // Reload troops and select the new one
        await loadMyTroops();
        document.getElementById('troopSelector').value = newTroop.id;
        selectedTroopId = newTroop.id;
        loadTroopData(newTroop.id);

    } catch (error) {
        console.error('Error creating troop:', error);
        showFeedback(error.message, true);
    }
}

// Tab switching for Add Member modal
function switchToNewScoutTab() {
    document.getElementById('tabNewScout').classList.add('active');
    document.getElementById('tabExistingUser').classList.remove('active');
    document.getElementById('tabContentNewScout').style.display = 'block';
    document.getElementById('tabContentExistingUser').style.display = 'none';
}

function switchToExistingUserTab() {
    document.getElementById('tabExistingUser').classList.add('active');
    document.getElementById('tabNewScout').classList.remove('active');
    document.getElementById('tabContentExistingUser').style.display = 'block';
    document.getElementById('tabContentNewScout').style.display = 'none';
}

// Search users for adding members
let selectedMemberEmail = null;

async function searchUsers(query) {
    const resultsContainer = document.getElementById('memberSearchResults');
    const confirmBtn = document.getElementById('confirmAddMemberBtn');

    if (!query || query.length < 2) {
        resultsContainer.innerHTML = '';
        confirmBtn.disabled = true;
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/users/search?q=${encodeURIComponent(query)}`, {
            credentials: 'include'
        });

        if (!response.ok) throw new Error('Search failed');

        const users = await response.json();

        if (users.length === 0) {
            resultsContainer.innerHTML = '<div class="search-no-results">No users found</div>';
            confirmBtn.disabled = true;
            return;
        }

        resultsContainer.innerHTML = users.map(user => `
            <div class="search-result-item" onclick="selectMember('${user.email}', '${user.firstName} ${user.lastName}')">
                <span class="result-name">${user.firstName} ${user.lastName}</span>
                <span class="result-email">${user.email}</span>
            </div>
        `).join('');

    } catch (error) {
        console.error('Search error:', error);
        resultsContainer.innerHTML = '<div class="search-error">Search failed</div>';
    }
}

function selectMember(email, name) {
    selectedMemberEmail = email;
    document.getElementById('memberSearchEmail').value = email;
    document.getElementById('memberSearchResults').innerHTML = `<div class="search-selected">Selected: ${name}</div>`;
    document.getElementById('confirmAddMemberBtn').disabled = false;
}

// Submit Add Member (generic form)
async function submitAddMember() {
    // Determine which subtab is active and map to position/role
    if (!selectedTroopId) return showFeedback('Please select a troop first', true);

    const activeSub = document.querySelector('.membership-subtab.active');
    const subtype = activeSub ? activeSub.dataset.sub : null;

    // Collect form values
    const firstName = (document.getElementById('memberFirstName')?.value || '').trim();
    const lastName = (document.getElementById('memberLastName')?.value || '').trim();
    const email = (document.getElementById('memberEmail')?.value || '').trim();
    const address = (document.getElementById('memberAddress')?.value || '').trim();
    const birthdate = document.getElementById('memberBirthdate')?.value || null;
    const familyInfo = (document.getElementById('memberFamilyInfo')?.value || '').trim();
    const position = document.getElementById('memberLevel')?.value || '';

    if (!firstName || !lastName) {
        return showFeedback('First and last name are required', true);
    }

    // For family tab, prefer creating a parent/guardian record
    let payload = {
        firstName,
        lastName,
        email: email || null,
        address: address || null,
        dateOfBirth: birthdate || null,
        familyInfo: familyInfo || null,
        position: position || null
    };

    // If subtype indicates family, set position to a parent/volunteer role if not already
    if (subtype === 'family') payload.position = payload.position || 'Troop Volunteer';
    if (subtype === 'leadership') payload.position = payload.position || 'Co-Leader';
    if (subtype === 'volunteer') payload.position = payload.position || 'Troop Volunteer';
    if (subtype === 'scout') payload.position = payload.position || 'Scout';

    try {
        const res = await fetch(`${API_BASE_URL}/troop/${selectedTroopId}/members`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to add member');
        }

        showFeedback('Member added successfully');
        closeAddMemberModal();
        // Refresh troop data
        await loadTroopData(selectedTroopId);
    } catch (error) {
        console.error('Add member error:', error);
        showFeedback(error.message || 'Failed to add member', true);
    }
}

// Roles to populate the roles multi-select (based on Resources doc)
const ADULT_ROLE_OPTIONS = [
    'Troop Treasurer', 'Troop Cookie Manager', 'Troop Admin',
    'Program Coordinator', 'Outdoor / Camp-Trained Adult'
];

const SCOUT_LEVEL_OPTIONS = [
    { value: 'Daisy',      label: 'Girl Scout Daisy (K–1)',       color: '#a0def1' },
    { value: 'Brownie',    label: 'Brownie Girl Scout (2–3)',     color: '#d5ca9f' },
    { value: 'Junior',     label: 'Junior Girl Scout (4–5)',      color: '#00b2be' },
    { value: 'Cadette',    label: 'Cadette Girl Scout (6–8)',     color: '#ee3124' },
    { value: 'Senior',     label: 'Senior Girl Scout (9–10)',     color: '#ff7818' },
    { value: 'Ambassador', label: 'Ambassador Girl Scout (11–12)', color: '#ee3124' }
];

function onPositionChange() {
    const position = document.getElementById('memberLevel')?.value;
    populateMemberRolesSelect(position);
}

function populateMemberRolesSelect(position) {
    const select = document.getElementById('memberRoles');
    const label = document.getElementById('rolesLabel');
    const group = document.getElementById('rolesGroup');
    if (!select) return;

    select.innerHTML = '';

    if (!position) {
        if (label) label.textContent = 'Roles';
        select.multiple = true;
        select.size = 6;
        if (group) group.style.display = '';
        return;
    }

    if (position === 'Scout') {
        // Single-select scout levels, color-coded
        if (label) label.textContent = 'Scout Level';
        select.multiple = false;
        select.size = 1;

        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = 'Select level...';
        select.appendChild(defaultOpt);

        SCOUT_LEVEL_OPTIONS.forEach(level => {
            const opt = document.createElement('option');
            opt.value = level.value;
            opt.textContent = level.label;
            opt.style.backgroundColor = level.color;
            opt.style.color = isLightColor(level.color) ? '#333' : '#fff';
            opt.style.fontWeight = '600';
            opt.style.padding = '4px 8px';
            select.appendChild(opt);
        });
    } else {
        // Multi-select adult roles for Leader / Co-Leader / Volunteer
        if (label) label.textContent = 'Roles (select one or more)';
        select.multiple = true;
        select.size = 5;

        ADULT_ROLE_OPTIONS.forEach(role => {
            const opt = document.createElement('option');
            opt.value = role;
            opt.textContent = role;
            select.appendChild(opt);
        });
    }
}

// Helper: determine if a hex color is light (for text contrast)
function isLightColor(hex) {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

// Add a generic member to the troop
async function addGenericMemberToTroop() {
    if (!selectedTroopId) {
        showFeedback('Please select a troop first', true);
        return;
    }

    const firstName = (document.getElementById('memberFirstName')?.value || '').trim();
    const lastName = (document.getElementById('memberLastName')?.value || '').trim();
    const email = (document.getElementById('memberEmail')?.value || '').trim();
    const address = (document.getElementById('memberAddress')?.value || '').trim();
    const dateOfBirth = (document.getElementById('memberBirthdate')?.value || '') || null;
    const den = (document.getElementById('memberDen')?.value || '').trim();
    const familyInfo = (document.getElementById('memberFamilyInfo')?.value || '').trim();
    const position = (document.getElementById('memberLevel')?.value || '').trim() || null;

    // Collect selected roles/level
    const rolesSelect = document.getElementById('memberRoles');
    const roles = [];
    let scoutLevel = null;
    if (rolesSelect) {
        if (position === 'Scout') {
            // Single select = scout level
            scoutLevel = rolesSelect.value || null;
        } else {
            Array.from(rolesSelect.selectedOptions).forEach(o => roles.push(o.value));
        }
    }

    if (!firstName || !lastName) {
        showFeedback('First name and last name are required', true);
        return;
    }

    const payload = {
        firstName: firstName || null,
        lastName: lastName || null,
        email: email || null,
        address: address || null,
        dateOfBirth: dateOfBirth,
        den: den || null,
        familyInfo: familyInfo || null,
        level: scoutLevel,
        position: position,
        roles: roles
    };

    try {
        const response = await fetch(`${API_BASE_URL}/troop/${selectedTroopId}/members`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to add member');
        }

        showFeedback('Member added successfully!');
        closeAddMemberModal();
        await loadTroopData(selectedTroopId);
    } catch (error) {
        console.error('Error adding member:', error);
        showFeedback(error.message || 'Failed to add member', true);
    }
}

// Add new scout with parent information to troop
async function addNewScoutToTroop() {
    if (!selectedTroopId) {
        showFeedback('Please select a troop first', true);
        return;
    }

    // Validate required fields
    const scoutFirstName = document.getElementById('scoutFirstName').value.trim();
    const scoutLastName = document.getElementById('scoutLastName').value.trim();
    const parentFirstName = document.getElementById('parentFirstName').value.trim();
    const parentLastName = document.getElementById('parentLastName').value.trim();
    const parentRole = document.getElementById('parentRole').value;

    if (!scoutFirstName || !scoutLastName) {
        showFeedback('Scout name is required', true);
        return;
    }

    if (!parentFirstName || !parentLastName) {
        showFeedback('Parent name is required', true);
        return;
    }

    if (!parentRole) {
        showFeedback('Parent role is required', true);
        return;
    }

    // Build request body
    const requestData = {
        scoutFirstName,
        scoutLastName,
        scoutLevel: document.getElementById('scoutLevel').value || null,
        scoutDateOfBirth: document.getElementById('scoutDateOfBirth').value || null,
        parentFirstName,
        parentLastName,
        parentEmail: document.getElementById('parentEmail').value.trim() || null,
        parentPhone: document.getElementById('parentPhone').value.trim() || null,
        parentRole,
        secondaryParentFirstName: document.getElementById('secondaryParentFirstName').value.trim() || null,
        secondaryParentLastName: document.getElementById('secondaryParentLastName').value.trim() || null,
        secondaryParentEmail: document.getElementById('secondaryParentEmail').value.trim() || null,
        secondaryParentPhone: document.getElementById('secondaryParentPhone').value.trim() || null,
        secondaryParentRole: document.getElementById('secondaryParentRole').value || null
    };

    try {
        const response = await fetch(`${API_BASE_URL}/troop/${selectedTroopId}/members/scout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to add scout');
        }

        showFeedback('Scout and parent added successfully!');
        closeAddMemberModal();
        loadTroopData(selectedTroopId);

    } catch (error) {
        console.error('Error adding scout:', error);
        showFeedback(error.message, true);
    }
}

// Add member to troop
async function addMemberToTroop() {
    if (!selectedMemberEmail || !selectedTroopId) {
        showFeedback('Please select a member to add', true);
        return;
    }

    const role = document.getElementById('memberRole').value;

    try {
        const response = await fetch(`${API_BASE_URL}/troop/${selectedTroopId}/members`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                email: selectedMemberEmail,
                role
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to add member');
        }

        showFeedback('Member added successfully!');
        closeAddMemberModal();
        selectedMemberEmail = null;

        // Reload troop data
        loadTroopData(selectedTroopId);

    } catch (error) {
        console.error('Error adding member:', error);
        showFeedback(error.message, true);
    }
}

// Remove member from troop
async function removeMember(userId) {
    if (!selectedTroopId) return;

    const confirmed = confirm('Are you sure you want to remove this member from the troop?');
    if (!confirmed) return;

    try {
        const response = await fetch(`${API_BASE_URL}/troop/${selectedTroopId}/members/${userId}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to remove member');
        }

        showFeedback('Member removed');
        loadTroopData(selectedTroopId);

    } catch (error) {
        console.error('Error removing member:', error);
        showFeedback(error.message, true);
    }
}

// Create troop goal
async function createGoal() {
    const goalType = document.getElementById('goalType').value;
    const targetAmount = parseFloat(document.getElementById('goalTarget').value);
    const startDate = document.getElementById('goalStartDate').value;
    const endDate = document.getElementById('goalEndDate').value;
    const description = document.getElementById('goalDescription').value.trim();

    if (!goalType || !targetAmount || targetAmount <= 0) {
        showFeedback('Please fill in required fields', true);
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/troop/${selectedTroopId}/goals`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                goalType,
                targetAmount,
                startDate: startDate || new Date().toISOString(),
                endDate: endDate || null,
                description
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create goal');
        }

        showFeedback('Goal created successfully!');
        closeAddGoalModal();

        // Reload troop data
        loadTroopData(selectedTroopId);

    } catch (error) {
        console.error('Error creating goal:', error);
        showFeedback(error.message, true);
    }
}

// ============================================================================
// Phase 3: Cookie Catalog and Nutrition
// ============================================================================

let cookieCatalog = [];

async function loadCookieCatalog() {
    try {
        const response = await fetch(`${API_BASE_URL}/cookies`, { credentials: 'include' });
        if (response.ok) {
            cookieCatalog = await response.json();
        }
    } catch (error) {
        console.error('Error loading cookie catalog:', error);
        cookieCatalog = [];
    }
}

function getAttributeIcon(value) {
    const icons = {
        'vegan': '🌱',
        'gluten_free': 'GF',
        'contains_peanuts': '🥜',
        'contains_tree_nuts': '🌰',
        'contains_coconut': '🥥',
        'kosher': '✡️'
    };
    return icons[value] || '•';
}

async function showNutritionModal(cookieId) {
    try {
        const response = await fetch(`${API_BASE_URL}/cookies/${cookieId}`, { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to load cookie data');

        const cookie = await response.json();

        document.getElementById('nutritionCookieName').textContent = cookie.cookieName;

        if (cookie.nutrition) {
            document.getElementById('nutritionServing').textContent =
                `Serving Size: ${cookie.nutrition.servingSize || '--'} (${cookie.nutrition.servingsPerBox || '--'} servings per box)`;

            document.getElementById('nutritionTableBody').innerHTML = `
                <tr><td>Calories</td><td>${cookie.nutrition.calories || '--'}</td></tr>
                <tr><td>Total Fat</td><td>${cookie.nutrition.totalFat || '--'}g</td></tr>
                <tr class="nutrient-indent"><td>Saturated Fat</td><td>${cookie.nutrition.saturatedFat || '--'}g</td></tr>
                <tr class="nutrient-indent"><td>Trans Fat</td><td>${cookie.nutrition.transFat || '--'}g</td></tr>
                <tr><td>Cholesterol</td><td>${cookie.nutrition.cholesterol || '--'}mg</td></tr>
                <tr><td>Sodium</td><td>${cookie.nutrition.sodium || '--'}mg</td></tr>
                <tr><td>Total Carbs</td><td>${cookie.nutrition.totalCarbs || '--'}g</td></tr>
                <tr class="nutrient-indent"><td>Dietary Fiber</td><td>${cookie.nutrition.dietaryFiber || '--'}g</td></tr>
                <tr class="nutrient-indent"><td>Sugars</td><td>${cookie.nutrition.sugars || '--'}g</td></tr>
                <tr><td>Protein</td><td>${cookie.nutrition.protein || '--'}g</td></tr>
            `;

            document.getElementById('ingredientsList').textContent =
                cookie.nutrition.ingredients || 'Not available';
        } else {
            document.getElementById('nutritionServing').textContent = 'Nutrition information not available';
            document.getElementById('nutritionTableBody').innerHTML = '';
            document.getElementById('ingredientsList').textContent = '--';
        }

        // Show attributes
        const attributesContainer = document.getElementById('nutritionAttributes');
        if (cookie.attributes && cookie.attributes.length > 0) {
            attributesContainer.innerHTML = cookie.attributes.map(attr =>
                `<span class="cookie-badge ${attr.attributeType}">${getAttributeIcon(attr.attributeValue)} ${attr.displayLabel}</span>`
            ).join('');
        } else {
            attributesContainer.innerHTML = '';
        }

        document.getElementById('nutritionModal').style.display = 'flex';
    } catch (error) {
        console.error('Error showing nutrition modal:', error);
        showFeedback('Failed to load nutrition info', true);
    }
}

function closeNutritionModal() {
    document.getElementById('nutritionModal').style.display = 'none';
}

// ============================================================================
// Phase 3: Invitation System
// ============================================================================

let pendingInvitations = [];

async function loadInvitations() {
    try {
        const response = await fetch(`${API_BASE_URL}/invitations`, { credentials: 'include' });
        if (response.ok) {
            pendingInvitations = await response.json();
            updateInvitationBadge();
        }
    } catch (error) {
        console.error('Error loading invitations:', error);
        pendingInvitations = [];
    }
}

function updateInvitationBadge() {
    const btn = document.getElementById('invitationsBtn');
    const badge = document.getElementById('invitationBadge');

    if (pendingInvitations.length > 0) {
        if (btn) btn.style.display = 'flex';
        if (badge) badge.textContent = pendingInvitations.length;
    } else {
        if (btn) btn.style.display = 'none';
    }
}

function openInvitationsModal() {
    renderInvitations();
    document.getElementById('invitationsModal').style.display = 'flex';
}

function closeInvitationsModal() {
    document.getElementById('invitationsModal').style.display = 'none';
}

function renderInvitations() {
    const container = document.getElementById('invitationsList');
    if (!container) return;

    if (pendingInvitations.length === 0) {
        container.innerHTML = '<p class="empty-state">No pending invitations</p>';
        return;
    }

    container.innerHTML = pendingInvitations.map(inv => `
        <div class="invitation-item">
            <h4>Troop ${inv.troopNumber}${inv.troopName ? ` - ${inv.troopName}` : ''}</h4>
            <p>You've been invited to join as a <strong>${inv.invitedRole}</strong></p>
            <div class="invitation-meta">
                Invited by ${inv.inviterFirstName} ${inv.inviterLastName}
            </div>
            <div class="invitation-actions">
                <button class="btn btn-primary btn-sm" onclick="acceptInvitation(${inv.id})">Accept</button>
                <button class="btn btn-secondary btn-sm" onclick="declineInvitation(${inv.id})">Decline</button>
            </div>
        </div>
    `).join('');
}

async function acceptInvitation(invitationId) {
    try {
        const response = await fetch(`${API_BASE_URL}/invitations/${invitationId}/accept`, {
            method: 'POST',
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to accept invitation');
        }

        showFeedback('Invitation accepted! You are now a member of the troop.');
        await loadInvitations();
        renderInvitations();
        await loadMyTroops();
    } catch (error) {
        console.error('Error accepting invitation:', error);
        showFeedback(error.message, true);
    }
}

async function declineInvitation(invitationId) {
    if (!confirm('Are you sure you want to decline this invitation?')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/invitations/${invitationId}/decline`, {
            method: 'POST',
            credentials: 'include'
        });

        if (!response.ok) throw new Error('Failed to decline invitation');

        showFeedback('Invitation declined');
        await loadInvitations();
        renderInvitations();
    } catch (error) {
        console.error('Error declining invitation:', error);
        showFeedback('Failed to decline invitation', true);
    }
}

function openSendInviteModal() {
    document.getElementById('inviteEmail').value = '';
    document.getElementById('inviteRole').value = 'scout';
    document.getElementById('sendInviteModal').style.display = 'flex';
}

function closeSendInviteModal() {
    document.getElementById('sendInviteModal').style.display = 'none';
}

async function sendInvitation() {
    const email = document.getElementById('inviteEmail').value.trim();
    const role = document.getElementById('inviteRole').value;

    if (!email || !selectedTroopId) {
        showFeedback('Please enter an email address', true);
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/troop/${selectedTroopId}/invite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, role })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to send invitation');
        }

        showFeedback('Invitation sent successfully!');
        closeSendInviteModal();
    } catch (error) {
        console.error('Error sending invitation:', error);
        showFeedback(error.message, true);
    }
}

// ============================================================================
// Phase 3: Leaderboard
// ============================================================================

let leaderboardData = [];

async function loadLeaderboard() {
    if (!selectedTroopId) return;

    const metricSelect = document.getElementById('leaderboardMetric');
    const metric = metricSelect ? metricSelect.value : 'boxes';

    try {
        const response = await fetch(
            `${API_BASE_URL}/troop/${selectedTroopId}/leaderboard?limit=10&metric=${metric}`,
            { credentials: 'include' }
        );

        if (response.ok) {
            leaderboardData = await response.json();
            renderLeaderboard();
        }
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        leaderboardData = [];
    }
}

function renderLeaderboard() {
    const container = document.getElementById('leaderboardList');
    if (!container) return;

    if (leaderboardData.length === 0) {
        container.innerHTML = '<p class="empty-state">No sales data yet</p>';
        return;
    }

    const metricSelect = document.getElementById('leaderboardMetric');
    const metric = metricSelect ? metricSelect.value : 'boxes';

    container.innerHTML = leaderboardData.map((member, index) => `
        <div class="leaderboard-item ${index < 3 ? 'top-three' : ''}">
            <span class="rank">${member.rank}</span>
            <div class="member-info">
                <span class="member-name">${member.firstName} ${member.lastName}</span>
            </div>
            <span class="score">${metric === 'revenue' ? '$' + parseFloat(member.totalRevenue || 0).toFixed(2) : member.totalBoxes + ' boxes'}</span>
        </div>
    `).join('');
}

// ============================================================================
// Phase 3: Enhanced Goal Management
// ============================================================================

async function loadGoalProgress() {
    if (!selectedTroopId) return;

    try {
        const response = await fetch(
            `${API_BASE_URL}/troop/${selectedTroopId}/goals/progress`,
            { credentials: 'include' }
        );

        if (response.ok) {
            const goalsWithProgress = await response.json();
            renderTroopGoalsWithProgress(goalsWithProgress);
        }
    } catch (error) {
        console.error('Error loading goal progress:', error);
    }
}

function renderTroopGoalsWithProgress(goals) {
    const container = document.getElementById('troopGoalsList');
    if (!container) return;

    if (!goals || goals.length === 0) {
        container.innerHTML = '<p class="empty-state">No goals set. Add a goal to track progress!</p>';
        return;
    }

    const goalTypeLabels = {
        'boxes_sold': 'Boxes Sold',
        'total_boxes': 'Total Boxes',
        'revenue': 'Revenue',
        'total_revenue': 'Total Revenue',
        'participation': 'Participation',
        'events': 'Events',
        'event_count': 'Event Count',
        'donations': 'Donations'
    };

    container.innerHTML = goals.map(goal => {
        const formatValue = (type, value) => {
            const numValue = parseFloat(value || 0);
            if (type.includes('revenue') || type === 'donations') return '$' + numValue.toFixed(2);
            if (type === 'participation') return numValue.toFixed(1) + '%';
            return numValue;
        };

        return `
            <div class="goal-card">
                <div class="goal-header">
                    <span class="goal-type">${goalTypeLabels[goal.goalType] || goal.goalType}</span>
                    <span class="goal-progress-text">${formatValue(goal.goalType, goal.actualAmount)} / ${formatValue(goal.goalType, goal.targetAmount)}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${Math.min(goal.progress, 100)}%"></div>
                </div>
                <div class="goal-dates">
                    ${goal.startDate ? new Date(goal.startDate).toLocaleDateString() : ''} - ${goal.endDate ? new Date(goal.endDate).toLocaleDateString() : 'Ongoing'}
                </div>
                ${goal.description ? `<p style="font-size: 0.8rem; color: #666; margin-top: 0.5rem;">${goal.description}</p>` : ''}
                <div class="goal-actions">
                    <button class="btn btn-sm btn-secondary" onclick="deleteGoal(${goal.id})">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

async function deleteGoal(goalId) {
    if (!confirm('Are you sure you want to delete this goal?')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/troop/${selectedTroopId}/goals/${goalId}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (!response.ok) throw new Error('Failed to delete goal');

        showFeedback('Goal deleted');
        loadGoalProgress();
    } catch (error) {
        console.error('Error deleting goal:', error);
        showFeedback('Failed to delete goal', true);
    }
}

// Override renderTroopGoals to use progress data
const originalRenderTroopGoals = typeof renderTroopGoals !== 'undefined' ? renderTroopGoals : null;

// Hook into loadTroopData to also load leaderboard and goal progress
const originalLoadTroopData = loadTroopData;
loadTroopData = async function(troopId) {
    await originalLoadTroopData(troopId);
    loadLeaderboard();
    loadGoalProgress();
};

// Setup table scroll indicators
function setupScrollIndicators() {
    const containers = document.querySelectorAll(
        '.cookie-selection-table-container, .sales-table-container, .members-table-wrapper'
    );

    function updateScrollIndicators() {
        containers.forEach(container => {
            if (container.scrollWidth > container.clientWidth) {
                container.classList.add('has-scroll');
            } else {
                container.classList.remove('has-scroll');
            }
        });
    }

    // Check on load and resize
    updateScrollIndicators();
    window.addEventListener('resize', updateScrollIndicators);

    // Also check after dynamic content updates
    containers.forEach(container => {
        const observer = new MutationObserver(updateScrollIndicators);
        observer.observe(container, { childList: true, subtree: true });
    });
}

// ============================================================================
// Cookie Dashboard (Phase B)
// ============================================================================

let cookieDashboardData = null;
let cookieDashboardTroopId = null;
let currentBoothId = null;
let orderCardProducts = [];

async function loadCookieDashboard() {
    try {
        // Find the user's troop
        const troopsRes = await fetch(`${API_BASE_URL}/troop/my-troops`, { credentials: 'include' });
        if (!troopsRes.ok) return;
        const troops = await troopsRes.json();
        if (!troops.length) return;

        const troop = troops[0]; // Use first troop
        cookieDashboardTroopId = troop.id;

        // Load dashboard data
        const dashRes = await fetch(`${API_BASE_URL}/troop/${troop.id}/cookie-dashboard`, { credentials: 'include' });
        if (!dashRes.ok) return;
        cookieDashboardData = await dashRes.json();

        // Set dynamic tab label
        const tabLabel = document.getElementById('cookiesTabLabel');
        const dashTitle = document.getElementById('cookieDashTitle');
        const orgCode = cookieDashboardData.orgCode;
        let productLabel = 'Products';
        if (orgCode === 'gsusa') productLabel = 'Cookies';
        else if (orgCode === 'sa_cub' || orgCode === 'sa_bsa') productLabel = 'Popcorn';
        if (tabLabel) tabLabel.textContent = productLabel;
        if (dashTitle) dashTitle.textContent = `${productLabel} Dashboard`;

        renderCookieDashboard();
        loadQuickSaleProducts(troop.id);
        loadBoothEvents(troop.id);
        loadTroopProceeds(troop.id);
        loadSeasonMilestones(troop.id);
    } catch (error) {
        console.error('Error loading cookie dashboard:', error);
    }
}

function renderCookieDashboard() {
    const data = cookieDashboardData;
    if (!data) return;

    // Summary cards
    document.getElementById('myTotalBoxes').textContent = data.mySales?.totalBoxes || 0;
    document.getElementById('myTotalCollected').textContent = `$${parseFloat(data.mySales?.totalCollected || 0).toFixed(2)}`;

    // Goal progress
    const goalBoxes = data.myGoal?.goalBoxes || 0;
    const totalBoxes = parseInt(data.mySales?.totalBoxes || 0);
    const goalPct = goalBoxes > 0 ? Math.round((totalBoxes / goalBoxes) * 100) : 0;
    const displayPct = Math.min(100, goalPct);
    document.getElementById('myGoalProgress').textContent = goalBoxes > 0 ? `${goalPct}%` : '--';

    // Animate goal ring
    const goalRing = document.getElementById('goalRingProgress');
    if (goalRing) {
        const circumference = 283;
        const offset = circumference - (displayPct / 100) * circumference;
        goalRing.style.strokeDashoffset = offset;
    }

    // Product breakdown
    const breakdownEl = document.getElementById('cookieProductBreakdown');
    if (data.myProductBreakdown?.length) {
        breakdownEl.innerHTML = data.myProductBreakdown.map(p => `
            <div class="cookie-product-item">
                <div class="cookie-product-name">${p.cookieName}${p.shortName ? ` (${p.shortName})` : ''}</div>
                <div class="cookie-product-stats">
                    <span class="cookie-product-qty">${p.totalQuantity} boxes</span>
                    <span class="cookie-product-rev">$${parseFloat(p.totalCollected || 0).toFixed(2)}</span>
                </div>
            </div>
        `).join('');
    } else {
        breakdownEl.innerHTML = '<p class="empty-state">No sales recorded yet</p>';
    }

    // Inventory
    const invEl = document.getElementById('cookieInventoryGrid');
    if (data.myInventory?.length) {
        invEl.innerHTML = data.myInventory.map(i => `
            <div class="cookie-inv-item">
                <span class="cookie-inv-name">${i.cookieName} (${i.shortName})</span>
                <div class="cookie-inv-controls">
                    <button class="inventory-btn" onclick="adjustCookieInventory('${i.productId}', -1)">-</button>
                    <span class="cookie-inv-qty">${i.quantity}</span>
                    <button class="inventory-btn" onclick="adjustCookieInventory('${i.productId}', 1)">+</button>
                </div>
            </div>
        `).join('');
    } else {
        invEl.innerHTML = '<p class="empty-state">No inventory tracked yet. Record inventory from Products.</p>';
    }

    // Recent sales
    const recentEl = document.getElementById('cookieRecentSales');
    if (data.recentSales?.length) {
        recentEl.innerHTML = data.recentSales.map(s => `
            <div class="recent-sale-item">
                <div class="recent-sale-info">
                    <span class="recent-sale-cookie">${s.productName || s.cookieType}</span>
                    <span class="recent-sale-customer">${s.customerName || 'Anonymous'}</span>
                </div>
                <div class="recent-sale-details">
                    <span class="recent-sale-qty">${s.quantity} box${s.quantity !== 1 ? 'es' : ''}</span>
                    <span class="recent-sale-type">${formatSaleType(s.saleType)}</span>
                    <span class="recent-sale-date">${new Date(s.date).toLocaleDateString()}</span>
                </div>
                <button class="btn btn-sm btn-danger" onclick="deleteSaleFromDashboard('${s.id}')">Del</button>
            </div>
        `).join('');
    } else {
        recentEl.innerHTML = '<p class="empty-state">No recent sales</p>';
    }

    // Troop section
    if (data.troopData) {
        document.getElementById('cookieTroopSection').style.display = '';
        document.getElementById('cookieTroopBoxes').textContent = data.troopData.totals?.totalBoxes || 0;
        document.getElementById('cookieTroopCollected').textContent = `$${parseFloat(data.troopData.totals?.totalCollected || 0).toFixed(2)}`;
    }
}

function formatSaleType(type) {
    const labels = {
        individual: 'Individual', individual_inperson: 'In-Person',
        individual_digital_delivered: 'Digital (Delivered)', individual_digital_shipped: 'Digital (Shipped)',
        individual_donation: 'Donation', booth_troop: 'Troop Booth',
        booth_family: 'Family Booth', booth_council: 'Council Booth', event: 'Event'
    };
    return labels[type] || type;
}

async function adjustCookieInventory(productId, delta) {
    try {
        const item = cookieDashboardData?.myInventory?.find(i => i.productId === productId);
        const newQty = Math.max(0, (item?.quantity || 0) + delta);
        await fetch(`${API_BASE_URL}/inventory/${productId}`, {
            method: 'PUT', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantity: newQty })
        });
        loadCookieDashboard();
    } catch (error) {
        console.error('Error adjusting inventory:', error);
    }
}

async function loadQuickSaleProducts(troopId) {
    try {
        const res = await fetch(`${API_BASE_URL}/troop/${troopId}/products`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        const select = document.getElementById('qsProduct');
        if (!select) return;
        orderCardProducts = data.products || [];
        select.innerHTML = '<option value="">Select cookie...</option>' +
            orderCardProducts.map(p => `<option value="${p.id}">${p.cookieName} (${p.shortName}) - $${p.pricePerBox}</option>`).join('');
    } catch (error) {
        console.error('Error loading products for quick sale:', error);
    }
}

// Quick Sale Form
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('quickSaleForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const productId = document.getElementById('qsProduct').value;
            const quantity = parseInt(document.getElementById('qsQuantity').value);
            const saleType = document.getElementById('qsSaleType').value;
            const customerName = document.getElementById('qsCustomer').value.trim();

            if (!productId || !quantity) return alert('Please select a product and quantity');

            try {
                const res = await fetch(`${API_BASE_URL}/sales`, {
                    method: 'POST', credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ productId, quantity, saleType, customerName, date: new Date().toISOString().split('T')[0] })
                });
                if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
                document.getElementById('qsQuantity').value = 1;
                document.getElementById('qsCustomer').value = '';
                loadCookieDashboard();
            } catch (error) {
                alert('Error recording sale: ' + error.message);
            }
        });
    }
});

async function deleteSaleFromDashboard(saleId) {
    if (!confirm('Delete this sale?')) return;
    try {
        await fetch(`${API_BASE_URL}/sales/${saleId}`, { method: 'DELETE', credentials: 'include' });
        loadCookieDashboard();
    } catch (error) {
        alert('Error deleting sale: ' + error.message);
    }
}

// ============================================================================
// Goal Getter Order Card (Phase B.3)
// ============================================================================

function toggleOrderCard() {
    const container = document.getElementById('orderCardContainer');
    container.classList.toggle('hidden');
    if (!container.classList.contains('hidden')) {
        setupOrderCard();
    }
}

function setupOrderCard() {
    if (!orderCardProducts.length) return;

    // Header info
    const scoutName = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : '';
    document.getElementById('orderCardScoutName').textContent = scoutName;
    document.getElementById('orderCardTroop').textContent = `Troop ${cookieDashboardData?.troopData?.goal?.troopId ? '' : ''}`;
    document.getElementById('orderCardGoal').textContent = `Goal: ${cookieDashboardData?.myGoal?.goalBoxes || 0} boxes`;

    // Build table header with product columns
    const thead = document.getElementById('orderCardHead');
    thead.innerHTML = `<tr>
        <th>Customer</th><th>Phone</th>
        ${orderCardProducts.map(p => `<th class="oc-product-col" title="${p.cookieName}">${p.shortName}</th>`).join('')}
        <th>Total</th><th>Paid</th>
    </tr>`;

    // Build footer totals
    const tfoot = document.getElementById('orderCardFoot');
    tfoot.innerHTML = `<tr>
        <td colspan="2"><strong>Totals</strong></td>
        ${orderCardProducts.map((p, i) => `<td class="oc-total" id="ocTotal_${i}">0</td>`).join('')}
        <td class="oc-total" id="ocGrandTotal">0</td><td></td>
    </tr>`;

    // Add initial rows
    const tbody = document.getElementById('orderCardBody');
    if (!tbody.children.length) {
        for (let i = 0; i < 5; i++) addOrderCardRow();
    }
}

function addOrderCardRow() {
    const tbody = document.getElementById('orderCardBody');
    const row = document.createElement('tr');
    row.innerHTML = `
        <td><input type="text" class="oc-input oc-customer" placeholder="Name"></td>
        <td><input type="tel" class="oc-input oc-phone" placeholder="Phone"></td>
        ${orderCardProducts.map((p, i) => `<td><input type="number" class="oc-input oc-qty" data-idx="${i}" min="0" value="" placeholder="0" onchange="updateOrderCardTotals()"></td>`).join('')}
        <td class="oc-row-total">0</td>
        <td><input type="checkbox" class="oc-paid"></td>
    `;
    tbody.appendChild(row);
}

function updateOrderCardTotals() {
    const tbody = document.getElementById('orderCardBody');
    const rows = tbody.querySelectorAll('tr');
    const productTotals = new Array(orderCardProducts.length).fill(0);
    let grandTotal = 0;

    rows.forEach(row => {
        let rowTotal = 0;
        row.querySelectorAll('.oc-qty').forEach(input => {
            const val = parseInt(input.value) || 0;
            const idx = parseInt(input.dataset.idx);
            productTotals[idx] += val;
            rowTotal += val;
        });
        const totalCell = row.querySelector('.oc-row-total');
        if (totalCell) totalCell.textContent = rowTotal;
        grandTotal += rowTotal;
    });

    productTotals.forEach((total, i) => {
        const el = document.getElementById(`ocTotal_${i}`);
        if (el) el.textContent = total;
    });
    const grandEl = document.getElementById('ocGrandTotal');
    if (grandEl) grandEl.textContent = grandTotal;
}

async function saveOrderCard() {
    const tbody = document.getElementById('orderCardBody');
    const rows = tbody.querySelectorAll('tr');
    const orderNumber = `OC-${Date.now()}`;
    let savedCount = 0;

    for (const row of rows) {
        const customer = row.querySelector('.oc-customer')?.value.trim();
        if (!customer) continue;
        const phone = row.querySelector('.oc-phone')?.value.trim();
        const paid = row.querySelector('.oc-paid')?.checked;
        const qtyInputs = row.querySelectorAll('.oc-qty');

        for (const input of qtyInputs) {
            const qty = parseInt(input.value) || 0;
            if (qty <= 0) continue;
            const idx = parseInt(input.dataset.idx);
            const product = orderCardProducts[idx];
            if (!product) continue;

            try {
                await fetch(`${API_BASE_URL}/sales`, {
                    method: 'POST', credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        productId: product.id, quantity: qty,
                        saleType: 'individual_inperson', customerName: customer,
                        customerPhone: phone, orderNumber,
                        amountDue: qty * product.pricePerBox,
                        amountCollected: paid ? qty * product.pricePerBox : 0,
                        orderStatus: paid ? 'Paid' : 'Pending',
                        date: new Date().toISOString().split('T')[0]
                    })
                });
                savedCount++;
            } catch (e) {
                console.error('Error saving order card row:', e);
            }
        }
    }

    if (savedCount > 0) {
        alert(`Saved ${savedCount} sale(s) from order card`);
        loadCookieDashboard();
    } else {
        alert('No sales to save. Fill in customer names and quantities.');
    }
}

function printOrderCard() {
    const container = document.getElementById('orderCardContainer');
    const printWin = window.open('', '_blank');
    printWin.document.write(`
        <html><head><title>Goal Getter Order Card</title>
        <style>
            body { font-family: Arial, sans-serif; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #333; padding: 4px 6px; text-align: center; }
            th { background: #f0f0f0; }
            .oc-input { border: none; width: 100%; text-align: center; }
            .order-card-header { margin-bottom: 10px; }
            @media print { button { display: none; } }
        </style></head><body>
        ${container.innerHTML}
        <script>window.print(); window.close();</script>
        </body></html>
    `);
}

// ============================================================================
// Booth Events Management (Phase C)
// ============================================================================

async function loadBoothEvents(troopId) {
    try {
        const res = await fetch(`${API_BASE_URL}/troop/${troopId}/booths`, { credentials: 'include' });
        if (!res.ok) { document.getElementById('cookieBoothSection').style.display = 'none'; return; }
        const booths = await res.json();
        document.getElementById('cookieBoothSection').style.display = '';

        const listEl = document.getElementById('boothEventsList');
        if (!booths.length) {
            listEl.innerHTML = '<p class="empty-state">No booth events scheduled</p>';
            return;
        }
        listEl.innerHTML = booths.map(b => `
            <div class="booth-event-card" onclick="openBoothDetail('${b.id}')">
                <div class="booth-event-header">
                    <span class="booth-event-name">${b.eventName}</span>
                    <span class="booth-status-badge booth-status-${b.status}">${b.status}</span>
                </div>
                <div class="booth-event-meta">
                    <span>${b.eventType} booth</span>
                    <span>${b.location || 'No location'}</span>
                    <span>${new Date(b.startDateTime).toLocaleDateString()} ${new Date(b.startDateTime).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</span>
                </div>
                <div class="booth-event-stats">
                    <span>${b.shiftCount || 0} shifts</span>
                    <span>${b.totalSold || 0} boxes sold</span>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading booths:', error);
    }
}

function openCreateBoothModal() {
    document.getElementById('createBoothModal').style.display = 'flex';
}
function closeCreateBoothModal() {
    document.getElementById('createBoothModal').style.display = 'none';
}

async function createBoothEvent() {
    const data = {
        eventName: document.getElementById('boothEventName').value,
        eventType: document.getElementById('boothEventType').value,
        startingBank: parseFloat(document.getElementById('boothStartingBank').value) || 0,
        location: document.getElementById('boothLocation').value,
        locationAddress: document.getElementById('boothLocationAddress').value,
        startDateTime: document.getElementById('boothStartDate').value,
        endDateTime: document.getElementById('boothEndDate').value,
        notes: document.getElementById('boothNotes').value
    };
    if (!data.eventName || !data.startDateTime || !data.endDateTime) return alert('Fill in required fields');

    try {
        const res = await fetch(`${API_BASE_URL}/troop/${cookieDashboardTroopId}/booths`, {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
        closeCreateBoothModal();
        loadBoothEvents(cookieDashboardTroopId);
    } catch (error) {
        alert('Error creating booth: ' + error.message);
    }
}

async function openBoothDetail(boothId) {
    currentBoothId = boothId;
    try {
        const res = await fetch(`${API_BASE_URL}/troop/${cookieDashboardTroopId}/booths/${boothId}`, { credentials: 'include' });
        if (!res.ok) return;
        const booth = await res.json();

        document.getElementById('boothDetailTitle').textContent = booth.eventName;
        document.getElementById('boothDetailStatus').textContent = booth.status;
        document.getElementById('boothDetailStatus').className = `booth-status-badge booth-status-${booth.status}`;

        // Lifecycle action buttons
        const actionsEl = document.getElementById('boothDetailActions');
        let btns = '';
        if (booth.status === 'planning' || booth.status === 'scheduled') btns += `<button class="btn btn-sm btn-primary" onclick="boothLifecycle('start')">Start Event</button>`;
        if (booth.status === 'in_progress') btns += `<button class="btn btn-sm btn-warning" onclick="boothLifecycle('end')">End Event</button>`;
        if (booth.status === 'reconciling') btns += `<button class="btn btn-sm btn-primary" onclick="boothLifecycle('close')">Complete</button>`;
        actionsEl.innerHTML = btns;

        // Render tabs
        renderBoothInfo(booth);
        renderBoothShifts(booth.shifts || []);
        renderBoothInventory(booth.inventory || []);
        renderBoothPayments(booth.payments || []);
        loadReconciliation(boothId);

        // Populate shift scout selector
        populateShiftScoutSelect();

        document.getElementById('boothDetailModal').style.display = 'flex';
        switchBoothTab('info');
    } catch (error) {
        console.error('Error loading booth detail:', error);
    }
}

function closeBoothDetailModal() {
    document.getElementById('boothDetailModal').style.display = 'none';
    currentBoothId = null;
}

function switchBoothTab(tab) {
    document.querySelectorAll('.booth-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.boothTab === tab));
    document.querySelectorAll('.booth-panel').forEach(panel => panel.classList.add('hidden'));
    const panel = document.getElementById(`booth-panel-${tab}`);
    if (panel) panel.classList.remove('hidden');
}

function renderBoothInfo(booth) {
    document.getElementById('boothDetailInfo').innerHTML = `
        <div class="booth-info-grid">
            <div><strong>Type:</strong> ${booth.eventType} booth</div>
            <div><strong>Location:</strong> ${booth.location || 'N/A'}</div>
            <div><strong>Address:</strong> ${booth.locationAddress || 'N/A'}</div>
            <div><strong>Start:</strong> ${new Date(booth.startDateTime).toLocaleString()}</div>
            <div><strong>End:</strong> ${new Date(booth.endDateTime).toLocaleString()}</div>
            <div><strong>Starting Bank:</strong> $${parseFloat(booth.startingBank || 0).toFixed(2)}</div>
            ${booth.notes ? `<div><strong>Notes:</strong> ${booth.notes}</div>` : ''}
        </div>
    `;
}

function renderBoothShifts(shifts) {
    const el = document.getElementById('boothShiftsList');
    if (!shifts.length) { el.innerHTML = '<p class="empty-state">No shifts scheduled</p>'; return; }
    el.innerHTML = shifts.map(s => `
        <div class="shift-item">
            <div class="shift-scout">${s.scoutName}${s.parentName ? ` (with ${s.parentName})` : ''}</div>
            <div class="shift-time">${new Date(s.startTime).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} - ${new Date(s.endTime).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>
            <span class="booth-status-badge booth-status-${s.status}">${s.status}</span>
            ${s.status === 'scheduled' ? `<button class="btn btn-sm" onclick="checkinShift('${s.id}')">Check In</button>` : ''}
            ${s.status === 'confirmed' ? `<button class="btn btn-sm" onclick="checkoutShift('${s.id}')">Check Out</button>` : ''}
        </div>
    `).join('');
}

function renderBoothInventory(inventory) {
    const el = document.getElementById('boothInventoryTable');
    if (!inventory.length) { el.innerHTML = '<p class="empty-state">No inventory set up. Click "Setup Inventory" to begin.</p>'; return; }
    el.innerHTML = `<div class="booth-field-actions" style="display:flex; gap:var(--space-md); margin-bottom:var(--space-md);">
        <button class="btn btn-sm btn-primary" onclick="enterBoothFieldMode('start')"><i data-lucide="edit-3"></i> Field Mode (Start)</button>
        <button class="btn btn-sm btn-secondary" onclick="enterBoothFieldMode('end')"><i data-lucide="check-circle"></i> Field Mode (End)</button>
    </div>
    <table class="booth-inv-table">
        <thead><tr><th>Cookie</th><th>Starting</th><th>Ending</th><th>Damaged</th><th>Sold</th></tr></thead>
        <tbody>${inventory.map(i => `
            <tr>
                <td>${i.cookieName} (${i.shortName})</td>
                <td><input type="number" class="bi-start" data-product="${i.productId}" value="${i.startingQty || 0}" min="0"></td>
                <td><input type="number" class="bi-end" data-product="${i.productId}" value="${i.endingQty ?? ''}" min="0" placeholder="--"></td>
                <td><input type="number" class="bi-damaged" data-product="${i.productId}" value="${i.damagedQty || 0}" min="0"></td>
                <td>${i.soldQty ?? '--'}</td>
            </tr>
        `).join('')}</tbody>
    </table>`;
    document.getElementById('saveBoothInventoryBtn').style.display = '';
    document.getElementById('recordEndCountBtn').style.display = '';
}

function renderBoothPayments(payments) {
    const el = document.getElementById('boothPaymentsList');
    if (!payments.length) { el.innerHTML = '<p class="empty-state">No payments recorded</p>'; return; }
    el.innerHTML = payments.map(p => `
        <div class="payment-item">
            <span class="payment-type">${p.paymentType}</span>
            <span class="payment-amount">$${parseFloat(p.amount).toFixed(2)}</span>
            <span class="payment-ref">${p.referenceNumber || ''}</span>
            <button class="btn btn-sm btn-danger" onclick="deleteBoothPayment('${p.id}')">Del</button>
        </div>
    `).join('');
}

async function boothLifecycle(action) {
    try {
        const res = await fetch(`${API_BASE_URL}/troop/${cookieDashboardTroopId}/booths/${currentBoothId}/${action}`, {
            method: 'POST', credentials: 'include'
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
        openBoothDetail(currentBoothId);
        loadBoothEvents(cookieDashboardTroopId);
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Shifts
function openAddShiftForm() { document.getElementById('addShiftForm').classList.toggle('hidden'); }

async function populateShiftScoutSelect() {
    try {
        const res = await fetch(`${API_BASE_URL}/troop/${cookieDashboardTroopId}/members`, { credentials: 'include' });
        if (!res.ok) return;
        const members = await res.json();
        const select = document.getElementById('shiftScoutSelect');
        select.innerHTML = members.map(m => `<option value="${m.userId}">${m.firstName} ${m.lastName}</option>`).join('');
    } catch (e) { console.error('Error loading members for shift:', e); }
}

async function addShift() {
    const data = {
        scoutId: document.getElementById('shiftScoutSelect').value,
        startTime: document.getElementById('shiftStartTime').value,
        endTime: document.getElementById('shiftEndTime').value
    };
    if (!data.scoutId || !data.startTime || !data.endTime) return alert('Fill in all shift fields');
    try {
        await fetch(`${API_BASE_URL}/troop/${cookieDashboardTroopId}/booths/${currentBoothId}/shifts`, {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        openBoothDetail(currentBoothId);
    } catch (error) { alert('Error adding shift: ' + error.message); }
}

async function checkinShift(shiftId) {
    await fetch(`${API_BASE_URL}/troop/${cookieDashboardTroopId}/booths/${currentBoothId}/shifts/${shiftId}/checkin`, { method: 'POST', credentials: 'include' });
    openBoothDetail(currentBoothId);
}

async function checkoutShift(shiftId) {
    await fetch(`${API_BASE_URL}/troop/${cookieDashboardTroopId}/booths/${currentBoothId}/shifts/${shiftId}/checkout`, { method: 'POST', credentials: 'include' });
    openBoothDetail(currentBoothId);
}

// Booth Inventory
async function setupBoothInventory() {
    if (!orderCardProducts.length) return alert('No products loaded');
    const items = orderCardProducts.map(p => ({ productId: p.id, startingQty: 0 }));
    try {
        await fetch(`${API_BASE_URL}/troop/${cookieDashboardTroopId}/booths/${currentBoothId}/inventory`, {
            method: 'PUT', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items })
        });
        openBoothDetail(currentBoothId);
    } catch (error) { alert('Error setting up inventory: ' + error.message); }
}

async function saveBoothInventory() {
    const items = [];
    document.querySelectorAll('.bi-start').forEach(input => {
        items.push({
            productId: input.dataset.product,
            startingQty: parseInt(input.value) || 0,
            damagedQty: parseInt(document.querySelector(`.bi-damaged[data-product="${input.dataset.product}"]`)?.value) || 0
        });
    });
    try {
        await fetch(`${API_BASE_URL}/troop/${cookieDashboardTroopId}/booths/${currentBoothId}/inventory`, {
            method: 'PUT', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items })
        });
        alert('Inventory saved');
        openBoothDetail(currentBoothId);
    } catch (error) { alert('Error saving inventory: ' + error.message); }
}

async function recordEndingCount() {
    const items = [];
    document.querySelectorAll('.bi-end').forEach(input => {
        const endVal = input.value;
        if (endVal === '') return;
        items.push({
            productId: input.dataset.product,
            endingQty: parseInt(endVal) || 0,
            damagedQty: parseInt(document.querySelector(`.bi-damaged[data-product="${input.dataset.product}"]`)?.value) || 0
        });
    });
    if (!items.length) return alert('Enter ending counts first');
    try {
        await fetch(`${API_BASE_URL}/troop/${cookieDashboardTroopId}/booths/${currentBoothId}/inventory/count`, {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items })
        });
        alert('Ending count recorded');
        openBoothDetail(currentBoothId);
    } catch (error) { alert('Error recording count: ' + error.message); }
}

// Payments
function openAddPaymentForm() { document.getElementById('addPaymentForm').classList.toggle('hidden'); }

async function addPayment() {
    const data = {
        paymentType: document.getElementById('paymentTypeSelect').value,
        amount: parseFloat(document.getElementById('paymentAmount').value),
        referenceNumber: document.getElementById('paymentReference').value
    };
    if (!data.amount) return alert('Enter an amount');
    try {
        await fetch(`${API_BASE_URL}/troop/${cookieDashboardTroopId}/booths/${currentBoothId}/payments`, {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        document.getElementById('paymentAmount').value = '';
        document.getElementById('paymentReference').value = '';
        openBoothDetail(currentBoothId);
    } catch (error) { alert('Error adding payment: ' + error.message); }
}

async function deleteBoothPayment(paymentId) {
    if (!confirm('Delete this payment?')) return;
    try {
        await fetch(`${API_BASE_URL}/troop/${cookieDashboardTroopId}/booths/${currentBoothId}/payments/${paymentId}`, {
            method: 'DELETE', credentials: 'include'
        });
        openBoothDetail(currentBoothId);
    } catch (error) { alert('Error deleting payment: ' + error.message); }
}

// Reconciliation
async function loadReconciliation(boothId) {
    try {
        const res = await fetch(`${API_BASE_URL}/troop/${cookieDashboardTroopId}/booths/${boothId}/reconcile`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();

        const el = document.getElementById('reconciliationSummary');
        el.innerHTML = `
            <div class="recon-section">
                <h4>Inventory Summary</h4>
                <div class="recon-grid">
                    <div><strong>Total Starting:</strong> ${data.inventory.totalStarting} boxes</div>
                    <div><strong>Total Ending:</strong> ${data.inventory.totalEnding} boxes</div>
                    <div><strong>Total Sold:</strong> ${data.inventory.totalSold} boxes</div>
                    <div><strong>Total Damaged:</strong> ${data.inventory.totalDamaged} boxes</div>
                </div>
            </div>
            <div class="recon-section">
                <h4>Payment Summary</h4>
                <div class="recon-grid">
                    <div><strong>Cash:</strong> $${parseFloat(data.payments.totalCash).toFixed(2)}</div>
                    <div><strong>Checks:</strong> $${parseFloat(data.payments.totalChecks).toFixed(2)}</div>
                    <div><strong>Digital:</strong> $${parseFloat(data.payments.totalDigital).toFixed(2)}</div>
                    <div><strong>Total Collected:</strong> $${parseFloat(data.payments.totalCollected).toFixed(2)}</div>
                    <div><strong>Starting Bank:</strong> -$${parseFloat(data.payments.startingBank || 0).toFixed(2)}</div>
                    <div><strong>Actual Revenue:</strong> $${parseFloat(data.payments.actualRevenue).toFixed(2)}</div>
                </div>
            </div>
            <div class="recon-section recon-result recon-${data.reconciliation.status}">
                <h4>Reconciliation</h4>
                <div class="recon-grid">
                    <div><strong>Expected Revenue:</strong> $${parseFloat(data.reconciliation.expectedRevenue).toFixed(2)}</div>
                    <div><strong>Actual Revenue:</strong> $${parseFloat(data.reconciliation.actualRevenue).toFixed(2)}</div>
                    <div class="recon-variance"><strong>Variance:</strong> $${parseFloat(data.reconciliation.variance).toFixed(2)}
                        <span class="recon-badge">${data.reconciliation.status}</span>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading reconciliation:', error);
    }
}

// ============================================================================
// Phase D: Proceeds & Season Milestones
// ============================================================================

async function loadTroopProceeds(troopId) {
    try {
        const res = await fetch(`${API_BASE_URL}/troop/${troopId}/proceeds`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        document.getElementById('cookieTroopProceeds').textContent = `$${parseFloat(data.totalProceeds).toFixed(2)}`;
    } catch (error) {
        // User may not have view_financials privilege
    }
}

async function loadSeasonMilestones(troopId) {
    try {
        const res = await fetch(`${API_BASE_URL}/troop/${troopId}/milestones`, { credentials: 'include' });
        if (!res.ok) return;
        const milestones = await res.json();
        const el = document.getElementById('cookieMilestonesList');
        if (!milestones.length) {
            el.innerHTML = '<p class="empty-state">No milestones set</p>';
            return;
        }
        el.innerHTML = milestones.map(m => `
            <div class="milestone-item">
                <span class="milestone-date">${m.milestoneDate ? new Date(m.milestoneDate).toLocaleDateString() : 'TBD'}</span>
                <span class="milestone-name">${m.milestoneName}</span>
                ${m.description ? `<span class="milestone-desc">${m.description}</span>` : ''}
            </div>
        `).join('');
    } catch (error) {
        // User may not have view_events privilege for milestones
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        await init();
        setupRoleBasedUI();
        setupNavigation();
        setupMobileMenu();
        setupTheme();
        setupImport();

        setupDangerZone();
        setupTroopManagement();
        setupTroopNavigation();
        setupScrollIndicators();
        loadInvitations();
        loadCookieCatalog();
    });
} else {
    (async () => {
        await init();
        setupRoleBasedUI();
        setupNavigation();
        setupMobileMenu();
        setupTheme();
        setupImport();

        setupDangerZone();
        setupScrollIndicators();
        setupTroopManagement();
        setupTroopNavigation();
        loadInvitations();
        loadCookieCatalog();
    })();
}

// ============================================================================
// MEMBER EDITING FUNCTIONS
// ============================================================================

let currentEditingMemberId = null;

/**
 * Open edit member modal
 */
async function openEditMemberModal(userId) {
    if (!selectedTroopId) {
        showFeedback('Please select a troop first', true);
        return;
    }

    currentEditingMemberId = userId;

    try {
        // Fetch member from troopMembers array
        const member = troopMembers.find(m => m.id === userId);
        if (!member) {
            showFeedback('Member not found', true);
            return;
        }

        // Fetch full user details (includes contact info)
        const userResponse = await fetch(`${API_BASE_URL}/users/${userId}`);
        const user = await userResponse.json();

        // Fetch payment methods
        const paymentResponse = await fetch(`${API_BASE_URL}/users/${userId}/payment-methods`);
        const paymentMethods = await paymentResponse.json();

        // Populate form - Personal Info
        document.getElementById('editMemberId').value = userId;
        document.getElementById('editFirstName').value = user.firstName || '';
        document.getElementById('editLastName').value = user.lastName || '';
        document.getElementById('editDateOfBirth').value = user.dateOfBirth || '';
        document.getElementById('editPhotoUrl').value = user.photoUrl || '';

        // Show minor status
        if (user.dateOfBirth) {
            const age = calculateAge(user.dateOfBirth);
            const minorStatus = document.getElementById('editMinorStatus');
            if (age < 18) {
                minorStatus.textContent = `Age ${age} - Minor (COPPA protected)`;
                minorStatus.className = 'form-help text-warning';
            } else {
                minorStatus.textContent = `Age ${age}`;
                minorStatus.className = 'form-help';
            }
        }

        // Contact Info
        document.getElementById('editEmail').value = user.email || '';
        document.getElementById('editPhone').value = user.phone || '';
        document.getElementById('editAddress').value = user.address || '';

        // Troop Info
        document.getElementById('editRole').value = member.troopRole || 'member';
        document.getElementById('editPosition').value = member.position || '';
        document.getElementById('editScoutLevel').value = member.scoutLevel || '';
        document.getElementById('editDen').value = member.den || '';

        // Load parent options
        await loadParentOptions(member.linkedParentId);

        // Load payment methods
        renderPaymentMethods(paymentMethods);

        // Show modal
        document.getElementById('editMemberModal').style.display = 'flex';

    } catch (error) {
        console.error('Error loading member details:', error);
        showFeedback('Failed to load member details', true);
    }
}

/**
 * Close edit member modal
 */
function closeEditMemberModal() {
    document.getElementById('editMemberModal').style.display = 'none';
    currentEditingMemberId = null;
}

/**
 * Save member edits
 */
async function saveEditMember() {
    const userId = document.getElementById('editMemberId').value;

    if (!userId) {
        showFeedback('Invalid member ID', true);
        return;
    }

    try {
        // Collect user data
        const userData = {
            firstName: document.getElementById('editFirstName').value.trim(),
            lastName: document.getElementById('editLastName').value.trim(),
            email: document.getElementById('editEmail').value.trim() || null,
            phone: document.getElementById('editPhone').value.trim() || null,
            address: document.getElementById('editAddress').value.trim() || null,
            dateOfBirth: document.getElementById('editDateOfBirth').value || null,
            photoUrl: document.getElementById('editPhotoUrl').value.trim() || null
        };

        // Collect troop data
        const troopData = {
            role: document.getElementById('editRole').value,
            position: document.getElementById('editPosition').value.trim() || null,
            scoutLevel: document.getElementById('editScoutLevel').value || null,
            den: document.getElementById('editDen').value.trim() || null,
            linkedParentId: document.getElementById('editLinkedParent').value || null
        };

        // Validate
        if (!userData.firstName || !userData.lastName) {
            showFeedback('First and last name are required', true);
            return;
        }

        // Update user profile
        const userResponse = await fetch(`${API_BASE_URL}/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });

        if (!userResponse.ok) {
            const error = await userResponse.json();
            throw new Error(error.error || 'Failed to update user');
        }

        // Update troop member data
        const troopResponse = await fetch(`${API_BASE_URL}/troop/${selectedTroopId}/members/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(troopData)
        });

        if (!troopResponse.ok) {
            const error = await troopResponse.json();
            throw new Error(error.error || 'Failed to update troop data');
        }

        showFeedback('Member updated successfully');
        closeEditMemberModal();

        // Reload troop data
        await loadTroopData(selectedTroopId);

    } catch (error) {
        console.error('Error saving member:', error);
        showFeedback(error.message || 'Failed to save member', true);
    }
}

/**
 * Load parent options dropdown
 */
async function loadParentOptions(currentParentId) {
    try {
        const response = await fetch(`${API_BASE_URL}/troop/${selectedTroopId}/parents`);
        const parents = await response.json();

        const select = document.getElementById('editLinkedParent');
        select.innerHTML = '<option value="">No parent linked</option>';

        parents.forEach(parent => {
            const option = document.createElement('option');
            option.value = parent.id;
            option.textContent = `${parent.firstName} ${parent.lastName}${parent.email ? ` (${parent.email})` : ''}`;
            if (parent.id === currentParentId) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading parents:', error);
    }
}

/**
 * Render payment methods list
 */
function renderPaymentMethods(methods) {
    const container = document.getElementById('editPaymentMethodsList');

    if (methods.length === 0) {
        container.innerHTML = '<p class="empty-state">No payment methods configured</p>';
        return;
    }

    container.innerHTML = methods.map(method => `
        <div class="payment-method-item" data-id="${method.id}">
            <div class="payment-method-info">
                <strong>${method.name}</strong>
                <small>${method.url}</small>
                <span class="badge ${method.isEnabled ? 'badge-success' : 'badge-secondary'}">
                    ${method.isEnabled ? 'Active' : 'Inactive'}
                </span>
            </div>
            <button type="button" class="btn btn-sm btn-danger" onclick="deletePaymentMethod('${method.id}')">
                Remove
            </button>
        </div>
    `).join('');
}

/**
 * Add payment method
 */
async function addPaymentMethod() {
    const userId = currentEditingMemberId;

    const name = prompt('Payment method name (e.g., Venmo, PayPal):');
    if (!name) return;

    const url = prompt('Payment URL or handle:');
    if (!url) return;

    try {
        const response = await fetch(`${API_BASE_URL}/users/${userId}/payment-methods`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, url, isEnabled: true })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }

        showFeedback('Payment method added');

        // Reload payment methods
        const listResponse = await fetch(`${API_BASE_URL}/users/${userId}/payment-methods`);
        const methods = await listResponse.json();
        renderPaymentMethods(methods);

    } catch (error) {
        console.error('Error adding payment method:', error);
        showFeedback(error.message || 'Failed to add payment method', true);
    }
}

/**
 * Delete payment method
 */
async function deletePaymentMethod(methodId) {
    const userId = currentEditingMemberId;

    if (!confirm('Remove this payment method?')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/users/${userId}/payment-methods/${methodId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }

        showFeedback('Payment method removed');

        // Reload payment methods
        const listResponse = await fetch(`${API_BASE_URL}/users/${userId}/payment-methods`);
        const methods = await listResponse.json();
        renderPaymentMethods(methods);

    } catch (error) {
        console.error('Error deleting payment method:', error);
        showFeedback(error.message || 'Failed to delete payment method', true);
    }
}

/**
 * Initiate password reset
 */
async function initiatePasswordReset() {
    const userId = currentEditingMemberId;

    if (!confirm('Send password reset to this user?')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/users/${userId}/password-reset-request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }

        showFeedback('Password reset initiated');

    } catch (error) {
        console.error('Error initiating password reset:', error);
        showFeedback(error.message || 'Failed to initiate password reset', true);
    }
}

/**
 * Confirm account deletion
 */
function confirmDeleteAccount() {
    document.getElementById('deleteAccountModal').style.display = 'flex';
}

/**
 * Close delete account modal
 */
function closeDeleteAccountModal() {
    document.getElementById('deleteAccountModal').style.display = 'none';
    document.getElementById('deleteReason').value = '';
    document.getElementById('confirmDeleteCheckbox').checked = false;
}

/**
 * Execute account deletion
 */
async function executeAccountDeletion() {
    const userId = currentEditingMemberId;
    const reason = document.getElementById('deleteReason').value;
    const confirmed = document.getElementById('confirmDeleteCheckbox').checked;

    if (!confirmed) {
        showFeedback('Please confirm account deletion', true);
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason, confirmDelete: true })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }

        const result = await response.json();
        showFeedback(result.message || 'Account deleted successfully');

        closeDeleteAccountModal();
        closeEditMemberModal();

        // Reload troop data
        await loadTroopData(selectedTroopId);

    } catch (error) {
        console.error('Error deleting account:', error);
        showFeedback(error.message || 'Failed to delete account', true);
    }
}

/**
 * Calculate age from date of birth
 */
function calculateAge(dateOfBirth) {
    const today = new Date();
    const birth = new Date(dateOfBirth);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age;
}

// Update viewMember function to open edit modal
function viewMember(memberId) {
    openEditMemberModal(memberId);
}

// Booth Field Mode (Phase 4.5)
let boothFieldModeType = 'start';

function enterBoothFieldMode(type) {
    boothFieldModeType = type;
    const boothFieldMode = document.getElementById('boothFieldMode');
    const title = document.getElementById('boothModeTitle');
    title.textContent = type === 'start' ? 'Record Starting Count' : 'Record Ending Count';
    
    // Get inventory from current table
    const items = [];
    const rows = document.querySelectorAll('.booth-inv-table tbody tr');
    
    if (rows.length === 0) {
        // Fallback: use orderCardProducts if inventory not yet set up
        if (!orderCardProducts.length) {
            alert('No products loaded. Please try again.');
            return;
        }
        orderCardProducts.forEach(p => {
            items.push({
                productId: p.id,
                name: p.cookieName,
                currentQty: 0
            });
        });
    } else {
        rows.forEach(row => {
            const name = row.cells[0].textContent;
            const startInput = row.querySelector('.bi-start');
            const endInput = row.querySelector('.bi-end');
            const productId = startInput.dataset.product;
            
            items.push({
                productId,
                name,
                currentQty: type === 'start' ? (parseInt(startInput.value) || 0) : (parseInt(endInput.value) || 0)
            });
        });
    }
    
    renderBoothFieldInventory(items);
    boothFieldMode.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

function renderBoothFieldInventory(items) {
    const list = document.getElementById('boothFieldInventoryList');
    list.innerHTML = items.map(i => `
        <div class='booth-inventory-row-field' data-product='${i.productId}'>
            <div class='cookie-name-field'>${i.name}</div>
            <div class='cookie-qty-control'>
                <button class='qty-btn' onclick='adjustFieldQty("${i.productId}", -1)'>-</button>
                <input type='number' class='qty-input-field' value='${i.currentQty}' min='0'>
                <button class='qty-btn' onclick='adjustFieldQty("${i.productId}", 1)'>+</button>
            </div>
        </div>
    `).join('');
}

function adjustFieldQty(productId, amount) {
    const row = document.querySelector(".booth-inventory-row-field[data-product=\"${productId}\"]");
    const input = row.querySelector('.qty-input-field');
    let val = parseInt(input.value) || 0;
    val = Math.max(0, val + amount);
    input.value = val;
}

function exitBoothFieldMode() {
    document.getElementById('boothFieldMode').classList.add('hidden');
}

async function saveBoothFieldMode() {
    const items = [];
    const rows = document.querySelectorAll('.booth-inventory-row-field');
    rows.forEach(row => {
        const productId = row.dataset.product;
        const qty = parseInt(row.querySelector('.qty-input-field').value) || 0;
        
        if (boothFieldModeType === 'start') {
            items.push({ productId, startingQty: qty });
        } else {
            items.push({ productId, endingQty: qty });
        }
    });
    
    try {
        const endpoint = boothFieldModeType === 'start' ?
            `${API_BASE_URL}/troop/${cookieDashboardTroopId}/booths/${currentBoothId}/inventory` :
            `${API_BASE_URL}/troop/${cookieDashboardTroopId}/booths/${currentBoothId}/inventory/count`;
        
        const method = boothFieldModeType === 'start' ? 'PUT' : 'POST';
        
        const payload = { items };
        
        const res = await fetch(endpoint, {
            method, credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!res.ok) throw new Error('Save failed');
        
        alert('Inventory updated');
        exitBoothFieldMode();
        openBoothDetail(currentBoothId);
    } catch (error) {
        alert('Error saving: ' + error.message);
    }
}

// Fulfillment System (Phase 4.5)
function openCreateFulfillmentModal() {
    if (!orderCardProducts.length) return alert('No products loaded');
    const list = document.getElementById('fulfillmentItemsList');
    list.innerHTML = orderCardProducts.map(p => `
        <div class='booth-inventory-row-field' data-product='${p.id}'>
            <div class='cookie-name-field'>${p.cookieName}</div>
            <div class='cookie-qty-control'>
                <button class='qty-btn' onclick='adjustFulfillmentQty("${p.id}", -1)'>-</button>
                <input type='number' class='qty-input-field fulfillment-qty' data-product='${p.id}' value='0' min='0'>
                <button class='qty-btn' onclick='adjustFulfillmentQty("${p.id}", 1)'>+</button>
            </div>
        </div>
    `).join('');
    document.getElementById('fulfillmentNotes').value = '';
    document.getElementById('createFulfillmentModal').style.display = 'flex';
    if (window.lucide) lucide.createIcons();
}

function adjustFulfillmentQty(productId, amount) {
    const input = document.querySelector(`.fulfillment-qty[data-product=\"${productId}\"]`);
    let val = parseInt(input.value) || 0;
    val = Math.max(0, val + amount);
    input.value = val;
}

function closeCreateFulfillmentModal() {
    document.getElementById('createFulfillmentModal').style.display = 'none';
}

async function submitFulfillmentOrder() {
    const items = [];
    document.querySelectorAll('.fulfillment-qty').forEach(input => {
        const qty = parseInt(input.value) || 0;
        if (qty > 0) {
            items.push({ productId: input.dataset.product, quantity: qty });
        }
    });

    if (!items.length) return alert('Add at least one item');

    const notes = document.getElementById('fulfillmentNotes').value;

    try {
        const res = await fetch(`${API_BASE_URL}/troop/${selectedTroopId}/fulfillment`, {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items, notes })
        });
        if (!res.ok) throw new Error('Order failed');
        alert('Order placed successfully');
        closeCreateFulfillmentModal();
        loadFulfillmentOrders(selectedTroopId);
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function loadFulfillmentOrders(troopId) {
    try {
        const res = await fetch(`${API_BASE_URL}/troop/${troopId}/fulfillment`, { credentials: 'include' });
        if (!res.ok) return;
        const orders = await res.json();
        renderFulfillmentOrders(orders);
    } catch (error) {
        console.error('Error loading fulfillment orders:', error);
    }
}

function renderFulfillmentOrders(orders) {
    const el = document.getElementById('fulfillmentOrdersList');
    if (!orders.length) {
        el.innerHTML = '<p class="empty-state">No fulfillment orders placed yet.</p>';
        return;
    }

    el.innerHTML = `
        <div class='orders-list'>
            ${orders.map(o => `
                <div class='order-item glass-card' style='margin-bottom: var(--space-md); padding: var(--space-md);'>
                    <div style='display:flex; justify-content:space-between; align-items:center;'>
                        <div>
                            <strong>Order #${o.id.substring(0, 8)}</strong><br>
                            <small>${new Date(o.orderDate).toLocaleDateString()} by ${o.orderedByName}</small>
                        </div>
                        <div>
                            <span class='booth-status-badge booth-status-${o.status}'>${o.status}</span>
                        </div>
                    </div>
                    <div style='margin-top:var(--space-sm); font-size:0.9rem;'>
                        Total: ${o.totalBoxes} boxes ($${parseFloat(o.totalAmount).toFixed(2)})
                    </div>
                    ${o.notes ? `<div style='margin-top:var(--space-xs); font-style:italic; font-size:0.8rem;'>${o.notes}</div>` : ''}
                    <div style='margin-top:var(--space-md); display:flex; gap:var(--space-sm);'>
                        ${o.status === 'pending' ? `
                            <button class='btn btn-sm btn-primary' onclick='updateFulfillmentStatus("${o.id}", "confirmed")'>Confirm</button>
                            <button class='btn btn-sm btn-danger' onclick='updateFulfillmentStatus("${o.id}", "cancelled")'>Cancel</button>
                        ` : ''}
                        ${o.status === 'confirmed' ? `<button class='btn btn-sm btn-primary' onclick='updateFulfillmentStatus("${o.id}", "shipped")'>Mark Shipped</button>` : ''}
                        ${o.status === 'shipped' ? `<button class='btn btn-sm btn-primary' onclick='updateFulfillmentStatus("${o.id}", "delivered")'>Mark Delivered</button>` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

async function updateFulfillmentStatus(orderId, status) {
    try {
        const res = await fetch(`${API_BASE_URL}/troop/${selectedTroopId}/fulfillment/${orderId}`, {
            method: 'PUT', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        if (!res.ok) throw new Error('Update failed');
        loadFulfillmentOrders(selectedTroopId);
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function loadTroopSharedInventory(troopId) {
    try {
        const res = await fetch(`${API_BASE_URL}/troop/${troopId}/shared-inventory`, { credentials: 'include' });
        if (!res.ok) return;
        const inventory = await res.json();
        renderTroopSharedInventory(inventory);
    } catch (error) {
        console.error('Error loading shared inventory:', error);
    }
}

function renderTroopSharedInventory(inventory) {
    const el = document.getElementById('troopSharedInventoryList');
    if (!el) return;
    if (!inventory.length) {
        el.innerHTML = '<p class="empty-state">No shared inventory tracked yet.</p>';
        return;
    }

    el.innerHTML = inventory.map(i => `
        <div class='cookie-product-item glass-card' style='padding: var(--space-md);'>
            <div class='cookie-product-name'>${i.cookieName} (${i.shortName})</div>
            <div class='cookie-product-stats'>
                <span class='cookie-product-qty'>${i.quantity} boxes</span>
            </div>
        </div>
    `).join('');
}

async function loadLinkedScouts() {
    if (!currentUser || currentUser.role !== 'parent') return;
    try {
        const response = await fetch(`${API_BASE_URL}/parents/scouts`);
        await handleApiResponse(response);
        const scouts = await response.json();
        renderParentDashboard(scouts);
    } catch (error) {
        console.error('Error loading linked scouts:', error);
    }
}

function renderParentDashboard(scouts) {
    const section = document.getElementById('parentDashboardSection');
    const list = document.getElementById('linkedScoutsList');
    if (!section || !list) return;

    if (scouts.length === 0) {
        list.innerHTML = '<p class="empty-state">No scouts linked to your account.</p>';
    } else {
        list.innerHTML = scouts.map(s => `
            <div class="scout-card glass-card" style="padding: var(--space-md); text-align: center; border-radius: 12px;">
                <div class="scout-photo-small" style="width: 60px; height: 60px; border-radius: 50%; background: var(--gray-200); margin: 0 auto 10px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                    ${s.photoUrl ? `<img src="${s.photoUrl}" style="width: 100%; height: 100%; object-fit: cover;">` : '<i data-lucide="user"></i>'}
                </div>
                <div style="font-weight: 600;">${s.firstName} ${s.lastName}</div>
                <div style="font-size: 0.8rem; color: #666;">Troop ${s.troopNumber} • ${s.scoutLevel}</div>
                <div style="margin-top: 5px;">
                    <span class="booth-status-badge ${s.isActive ? 'booth-status-completed' : 'booth-status-planning'}">
                        ${s.isActive ? 'Active' : 'Pending Consent'}
                    </span>
                </div>
                ${!s.isActive ? `
                    <button class="btn btn-sm btn-primary" style="margin-top: 10px; width: 100%;" onclick="approveScout('${s.id}')">
                        <i data-lucide="check-circle"></i> Provide Consent
                    </button>
                ` : `
                    <button class="btn btn-sm btn-secondary" style="margin-top: 10px; width: 100%;" onclick="viewScoutStats('${s.id}')">
                        <i data-lucide="bar-chart"></i> View Stats
                    </button>
                `}
            </div>
        `).join('');
        if (window.lucide) lucide.createIcons();
    }

    section.style.display = 'block';
}

async function approveScout(scoutId) {
    if (!confirm('By clicking OK, you provide digital consent for this minor to use Apex Scout Manager in accordance with COPPA regulations.')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/parents/approve-scout/${scoutId}`, {
            method: 'POST',
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Approval failed');
        alert('Account approved successfully!');
        loadLinkedScouts();
    } catch (error) {
        alert('Error: ' + error.message);
    }
}