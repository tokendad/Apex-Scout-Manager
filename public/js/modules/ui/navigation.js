/**
 * Navigation Module - Tab switching and view management
 */
import { store } from '../../state.js';
import { loadCookieDashboard } from '../cookies/dashboard.js';

/**
 * Switch between main application views
 * @param {string} viewId 
 */
export function switchView(viewId) {
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
    store.setState({ activeTab: viewId });

    // Load data for specific views
    if (viewId === 'cookies') {
        loadCookieDashboard();
    }
}

/**
 * Setup main navigation event listeners
 */
export function setupNavigation() {
    const tabButtons = document.querySelectorAll('.tab-btn');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            switchView(btn.dataset.view);
            closeMobileMenu();
        });
    });

    // Load last view or default to profile
    let lastView = localStorage.getItem('lastView') || 'profile';
    if (lastView === 'dashboard' || lastView === 'sales') {
        lastView = 'profile';
    }
    switchView(lastView);
}

/**
 * Setup troop leader sub-navigation
 */
export function setupTroopNavigation() {
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
                if (p.id === 'troop-tab-' + target) p.classList.remove('hidden'); 
                else p.classList.add('hidden');
            });

            // Load data for specific tabs (Phase 4.5)
            const { selectedTroopId } = store.getState();
            if (target === 'fulfillment' && selectedTroopId) {
                // These will be imported and called
                // loadFulfillmentOrders(selectedTroopId);
                // loadTroopSharedInventory(selectedTroopId);
            }
        });
    });
}

function closeMobileMenu() {
    const overlay = document.getElementById('sidebarOverlay');
    const nav = document.querySelector('.tab-nav');
    if (overlay) overlay.classList.remove('active');
    if (nav) nav.classList.remove('active');
}
