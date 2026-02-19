/**
 * Application Entry Point
 */
import { checkAuth, displayUserInfo } from './modules/auth.js';
import { loadProfile, handlePhotoUpload, handleUpdateQrCode, handleAddPaymentMethod } from './modules/ui/profile.js';
import { loadEarnedBadges, loadScoutProfile, openBadgeGalleryModal, closeBadgeGalleryModal, filterBadges, filterBadgesBySearch, showBadgeDetail, closeBadgeDetailModal } from './modules/advancement/badges.js';
import { setupNavigation, setupTroopNavigation, switchView } from './modules/ui/navigation.js';
import { loadDonations, handleAddDonation } from './modules/troop/financials.js';
import { loadEvents, handleAddEvent } from './modules/events/calendar.js';
import { loadMyTroops, loadTroopData } from './modules/troop/management.js';
import { loadLinkedScouts, approveScout } from './modules/troop/parent.js';
import { toggleOrderCard, adjustCookieInventory, deleteSaleFromDashboard } from './modules/cookies/dashboard.js';
import { openBoothDetail, boothLifecycle, enterBoothFieldMode, exitBoothFieldMode, saveBoothFieldMode } from './modules/booth/management.js';
import { store } from './state.js';

async function init() {
    // 1. Check Auth
    const isAuthenticated = await checkAuth();
    if (!isAuthenticated) return;

    // 2. Load initial data
    displayUserInfo();
    await Promise.all([
        loadProfile(),
        loadDonations(),
        loadEvents(),
        loadScoutProfile(),
        loadEarnedBadges(),
        loadLinkedScouts(),
        loadMyTroops()
    ]);

    // 3. Setup UI and Navigation
    setupNavigation();
    setupTroopNavigation();
    setupEventListeners();

    // 4. Attach common functions to window for HTML event handlers (Legacy support)
    // In a full refactor, these would be handled via addEventListener in JS
    window.switchView = switchView;
    window.openBadgeGalleryModal = openBadgeGalleryModal;
    window.closeBadgeGalleryModal = closeBadgeGalleryModal;
    window.filterBadges = filterBadges;
    window.filterBadgesBySearch = filterBadgesBySearch;
    window.showBadgeDetail = showBadgeDetail;
    window.closeBadgeDetailModal = closeBadgeDetailModal;
    window.handlePhotoUpload = handlePhotoUpload;
    window.handleUpdateQrCode = handleUpdateQrCode;
    window.handleAddPaymentMethod = handleAddPaymentMethod;
    window.toggleOrderCard = toggleOrderCard;
    window.adjustCookieInventory = adjustCookieInventory;
    window.deleteSaleFromDashboard = deleteSaleFromDashboard;
    window.openBoothDetail = openBoothDetail;
    window.boothLifecycle = boothLifecycle;
    window.enterBoothFieldMode = enterBoothFieldMode;
    window.exitBoothFieldMode = exitBoothFieldMode;
    window.saveBoothFieldMode = saveBoothFieldMode;
    window.approveScout = approveScout;

    if (window.lucide) lucide.createIcons();
    console.log('App initialized');
}

function setupEventListeners() {
    // Re-attach listeners that were in script.js
    const photoInput = document.getElementById('photoInput');
    if (photoInput) photoInput.addEventListener('change', handlePhotoUpload);

    const donationForm = document.getElementById('donationForm');
    if (donationForm) donationForm.addEventListener('submit', handleAddDonation);

    const eventForm = document.getElementById('eventForm');
    if (eventForm) eventForm.addEventListener('submit', handleAddEvent);
    
    // Troop selector
    const troopSelector = document.getElementById('troopSelector');
    if (troopSelector) {
        troopSelector.addEventListener('change', (e) => {
            const troopId = e.target.value;
            if (troopId) loadTroopData(troopId);
        });
    }
}

// Global initialization
document.addEventListener('DOMContentLoaded', init);
