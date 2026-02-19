/**
 * Cookie Dashboard Module - Sales, Inventory, and Order Card
 */
import { apiFetch, troopApi } from '../../api.js';
import { store } from '../../state.js';
import { showFeedback, formatCurrency, formatDate } from '../../utils.js';

/**
 * Load cookie dashboard data
 */
export async function loadCookieDashboard() {
    const { selectedTroopId } = store.getState();
    if (!selectedTroopId) return;

    try {
        const data = await apiFetch(`/troop/${selectedTroopId}/cookie-dashboard`);
        store.setState({ cookieDashboardData: data });

        // Set dynamic tab label
        const tabLabel = document.getElementById('cookiesTabLabel');
        const dashTitle = document.getElementById('cookieDashTitle');
        const orgCode = data.orgCode;
        let productLabel = 'Products';
        if (orgCode === 'gsusa') productLabel = 'Cookies';
        else if (orgCode === 'sa_cub' || orgCode === 'sa_bsa') productLabel = 'Popcorn';
        if (tabLabel) tabLabel.textContent = productLabel;
        if (dashTitle) dashTitle.textContent = `${productLabel} Dashboard`;

        renderCookieDashboard();
        
        // Also load related data
        const products = await troopApi.getProducts(selectedTroopId);
        store.setState({ orderCardProducts: products });
        loadQuickSaleProducts(products);
        
        loadTroopProceeds(selectedTroopId);
        loadSeasonMilestones(selectedTroopId);
    } catch (error) {
        console.error('Error loading cookie dashboard:', error);
    }
}

/**
 * Render cookie dashboard
 */
export function renderCookieDashboard() {
    const { cookieDashboardData: data } = store.getState();
    if (!data) return;

    // Summary cards
    document.getElementById('myTotalBoxes').textContent = data.mySales?.totalBoxes || 0;
    document.getElementById('myTotalCollected').textContent = formatCurrency(data.mySales?.totalCollected || 0);

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
                    <span class="cookie-product-rev">${formatCurrency(p.totalCollected || 0)}</span>
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
        const troopSection = document.getElementById('cookieTroopSection');
        if (troopSection) {
            troopSection.style.display = '';
            document.getElementById('cookieTroopBoxes').textContent = data.troopData.totals?.totalBoxes || 0;
            document.getElementById('cookieTroopCollected').textContent = formatCurrency(data.troopData.totals?.totalCollected || 0);
        }
    }
}

/**
 * Format sale type label
 */
export function formatSaleType(type) {
    const labels = {
        individual: 'Individual', 
        individual_inperson: 'In-Person',
        individual_digital_delivered: 'Digital (Delivered)',
        individual_digital_shipped: 'Digital (Shipped)',
        individual_donation: 'Donation',
        booth_troop: 'Troop Booth',
        booth_family: 'Family Booth',
        booth_council: 'Council Booth',
        event: 'Event'
    };
    return labels[type] || type;
}

/**
 * Populate quick sale product dropdown
 */
function loadQuickSaleProducts(products) {
    const select = document.getElementById('qsProduct');
    if (!select) return;
    
    select.innerHTML = '<option value="">Select cookie...</option>' + 
        products.map(p => `<option value="${p.id}">${p.cookieName}</option>`).join('');
}

/**
 * Adjust personal inventory
 */
export async function adjustCookieInventory(productId, amount) {
    try {
        await apiFetch('/profile/inventory', {
            method: 'POST',
            body: JSON.stringify({ productId, amount })
        });
        loadCookieDashboard(); // Refresh
    } catch (error) {
        showFeedback('Error adjusting inventory: ' + error.message, true);
    }
}

/**
 * Delete a sale from the dashboard
 */
export async function deleteSaleFromDashboard(saleId) {
    if (!confirm('Are you sure you want to delete this sale record?')) return;
    try {
        await apiFetch(`/sales/${saleId}`, { method: 'DELETE' });
        loadCookieDashboard();
    } catch (error) {
        showFeedback('Error deleting sale: ' + error.message, true);
    }
}

export async function loadTroopProceeds(troopId) {
    try {
        const data = await apiFetch(`/troop/${troopId}/proceeds`);
        const el = document.getElementById('cookieTroopProceeds');
        if (el) el.textContent = formatCurrency(data.totalProceeds);
    } catch (error) {
        // May not have view_financials
    }
}

export async function loadSeasonMilestones(troopId) {
    try {
        const milestones = await apiFetch(`/troop/${troopId}/milestones`);
        const el = document.getElementById('cookieMilestonesList');
        if (!el) return;
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
        // May not have view_events
    }
}

// Order Card Logic
export function toggleOrderCard() {
    const container = document.getElementById('orderCardContainer');
    container.classList.toggle('hidden');
    if (!container.classList.contains('hidden')) {
        renderOrderCard();
    }
}

export function renderOrderCard() {
    // Render implementation details skipped for brevity in this step
}
