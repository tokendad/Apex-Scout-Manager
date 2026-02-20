// Apex Scout Manager — Client-side Router / Navigation

import { setState, getState } from './state.js';

/**
 * Switch the visible view panel and update sidebar tab-button active states.
 * Persists selection to localStorage.
 * @param {string} viewId
 */
export function switchView(viewId) {
    document.querySelectorAll('.view-section').forEach(v => v.classList.add('hidden'));

    const target = document.getElementById('view-' + viewId);
    if (target) target.classList.remove('hidden');

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === viewId);
    });

    localStorage.setItem('lastView', viewId);

    // Lazy-load cookie dashboard data when switching to that view
    if (viewId === 'cookies') {
        // loadCookieDashboard is registered on window during init (Phase 1+)
        if (typeof window.loadCookieDashboard === 'function') {
            window.loadCookieDashboard();
        }
    }
}

/**
 * Bind sidebar tab-btn clicks and restore the last active view.
 * Call this once after DOM is ready.
 */
export function setupNavigation() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchView(btn.dataset.view);
            closeMobileMenu();
        });
    });

    let lastView = localStorage.getItem('lastView') || 'profile';
    // Guard removed views that may have been persisted
    if (lastView === 'dashboard' || lastView === 'sales') lastView = 'profile';
    switchView(lastView);
}

/**
 * Bind troop-level top-navigation tabs (Membership / Fulfillment / …)
 * and membership sub-tabs.
 */
export function setupTroopNavigation() {
    const troopTabs = document.querySelectorAll('.troop-tab');
    const panels    = document.querySelectorAll('.troop-tab-panel');

    if (!troopTabs.length) return;

    troopTabs.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabTarget = btn.dataset.tab;

            troopTabs.forEach(t => t.classList.toggle('active', t === btn));
            panels.forEach(p => {
                p.id === 'troop-tab-' + tabTarget
                    ? p.classList.remove('hidden')
                    : p.classList.add('hidden');
            });

            if (tabTarget === 'fulfillment') {
                const { selectedTroopId } = getState();
                if (selectedTroopId) {
                    if (typeof window.loadFulfillmentOrders === 'function')     window.loadFulfillmentOrders(selectedTroopId);
                    if (typeof window.loadTroopSharedInventory === 'function')  window.loadTroopSharedInventory(selectedTroopId);
                }
            }
        });
    });

    // Membership search filter across sub-panels
    const memberSearch = document.getElementById('memberSearch');
    if (memberSearch) {
        memberSearch.addEventListener('input', () => {
            const q = memberSearch.value.toLowerCase();
            document.querySelectorAll('[id^="membershipTableBody_"]').forEach(body => {
                Array.from(body.querySelectorAll('tr')).forEach(tr => {
                    tr.style.display = q
                        ? (tr.textContent.toLowerCase().includes(q) ? '' : 'none')
                        : '';
                });
            });
        });
    }

    // Membership sub-tab switching
    const subTabs   = document.querySelectorAll('.membership-subtab');
    const subPanels = document.querySelectorAll('.membership-subpanel');
    if (subTabs.length) {
        subTabs.forEach(btn => {
            btn.addEventListener('click', () => {
                const subTarget = btn.dataset.sub;
                subTabs.forEach(t => t.classList.toggle('active', t === btn));
                subPanels.forEach(p => {
                    p.id === 'membership-sub-' + subTarget
                        ? p.classList.remove('hidden')
                        : p.classList.add('hidden');
                });
                try { if (typeof window.updateAddMemberButtonLabel === 'function') window.updateAddMemberButtonLabel(); } catch (_) { /* ignore */ }
            });
        });
    }
}

/** Close the mobile slide-in sidebar (no-op if already closed). */
function closeMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar)  sidebar.classList.remove('open');
    if (overlay)  overlay.classList.remove('active');
}
