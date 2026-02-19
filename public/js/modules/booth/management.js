/**
 * Booth Management Module - Lifecycle and Field Mode
 */
import { apiFetch, API_BASE_URL } from '../../api.js';
import { store } from '../../state.js';
import { showFeedback, formatCurrency } from '../../utils.js';

/**
 * Load booth events for a troop
 */
export async function loadBoothEvents(troopId) {
    try {
        const booths = await apiFetch(`/troop/${troopId}/booths`);
        store.setState({ booths });
        renderBoothEvents(booths);
    } catch (error) {
        console.error('Error loading booths:', error);
    }
}

/**
 * Render booth events list
 */
export function renderBoothEvents(booths) {
    const el = document.getElementById('boothEventsList');
    if (!el) return;
    if (!booths || !booths.length) {
        el.innerHTML = '<p class="empty-state">No booth events scheduled</p>';
        return;
    }

    el.innerHTML = booths.map(b => `
        <div class="booth-event-item glass-card" onclick="openBoothDetail('${b.id}')">
            <div class="booth-event-info">
                <strong>${b.eventName}</strong>
                <span class="booth-event-meta">${new Date(b.startDateTime).toLocaleDateString()} at ${b.location || 'TBD'}</span>
            </div>
            <div class="booth-event-status">
                <span class="booth-status-badge booth-status-${b.status}">${b.status}</span>
                <span class="booth-event-sold">${b.totalSold || 0} boxes sold</span>
            </div>
        </div>
    `).join('');
}

/**
 * Open booth detail view
 */
export async function openBoothDetail(boothId) {
    const { selectedTroopId } = store.getState();
    store.setState({ currentBoothId: boothId });
    try {
        const booth = await apiFetch(`/troop/${selectedTroopId}/booths/${boothId}`);
        
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

        renderBoothInfo(booth);
        renderBoothShifts(booth.shifts || []);
        renderBoothInventory(booth.inventory || []);
        renderBoothPayments(booth.payments || []);
        loadReconciliation(boothId);

        document.getElementById('boothDetailModal').style.display = 'flex';
        switchBoothTab('info');
    } catch (error) {
        console.error('Error loading booth detail:', error);
    }
}

export function switchBoothTab(tab) {
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
            <div><strong>Starting Bank:</strong> ${formatCurrency(booth.startingBank || 0)}</div>
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
        </div>
    `).join('');
}

export function renderBoothInventory(inventory) {
    const el = document.getElementById('boothInventoryTable');
    if (!el) return;
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
    const saveBtn = document.getElementById('saveBoothInventoryBtn');
    const endBtn = document.getElementById('recordEndCountBtn');
    if (saveBtn) saveBtn.style.display = '';
    if (endBtn) endBtn.style.display = '';
}

function renderBoothPayments(payments) {
    const el = document.getElementById('boothPaymentsList');
    if (!el) return;
    if (!payments.length) { el.innerHTML = '<p class="empty-state">No payments recorded</p>'; return; }
    el.innerHTML = payments.map(p => `
        <div class="payment-item">
            <span class="payment-type">${p.paymentType}</span>
            <span class="payment-amount">${formatCurrency(p.amount)}</span>
            <span class="payment-ref">${p.referenceNumber || ''}</span>
        </div>
    `).join('');
}

async function loadReconciliation(boothId) {
    const { selectedTroopId } = store.getState();
    try {
        const data = await apiFetch(`/troop/${selectedTroopId}/booths/${boothId}/reconcile`);
        const el = document.getElementById('reconciliationSummary');
        if (!el) return;
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
                    <div><strong>Cash:</strong> ${formatCurrency(data.payments.totalCash)}</div>
                    <div><strong>Checks:</strong> ${formatCurrency(data.payments.totalChecks)}</div>
                    <div><strong>Digital:</strong> ${formatCurrency(data.payments.totalDigital)}</div>
                    <div><strong>Total Collected:</strong> ${formatCurrency(data.payments.totalCollected)}</div>
                    <div><strong>Starting Bank:</strong> -${formatCurrency(data.payments.startingBank || 0)}</div>
                    <div><strong>Actual Revenue:</strong> ${formatCurrency(data.payments.actualRevenue)}</div>
                </div>
            </div>
            <div class="recon-section recon-result recon-${data.reconciliation.status}">
                <h4>Reconciliation</h4>
                <div class="recon-grid">
                    <div><strong>Expected Revenue:</strong> ${formatCurrency(data.reconciliation.expectedRevenue)}</div>
                    <div><strong>Actual Revenue:</strong> ${formatCurrency(data.reconciliation.actualRevenue)}</div>
                    <div class="recon-variance"><strong>Variance:</strong> ${formatCurrency(data.reconciliation.variance)}
                        <span class="recon-badge">${data.reconciliation.status}</span>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading reconciliation:', error);
    }
}

/**
 * Handle booth lifecycle actions (start, end, close)
 */
export async function boothLifecycle(action) {
    const { selectedTroopId, currentBoothId } = store.getState();
    try {
        await apiFetch(`/troop/${selectedTroopId}/booths/${currentBoothId}/${action}`, {
            method: 'POST'
        });
        openBoothDetail(currentBoothId);
        loadBoothEvents(selectedTroopId);
    } catch (error) {
        showFeedback('Error updating booth: ' + error.message, true);
    }
}

// Booth Field Mode logic
export function enterBoothFieldMode(type) {
    const { orderCardProducts } = store.getState();
    store.setState({ boothFieldModeType: type });
    
    const boothFieldMode = document.getElementById('boothFieldMode');
    const title = document.getElementById('boothModeTitle');
    if (!title) return;
    
    title.textContent = type === 'start' ? 'Record Starting Count' : 'Record Ending Count';
    
    const items = [];
    const rows = document.querySelectorAll('.booth-inv-table tbody tr');
    
    if (rows.length === 0) {
        if (!orderCardProducts.length) {
            alert('No products loaded. Please try again.');
            return;
        }
        orderCardProducts.forEach(p => {
            items.push({ productId: p.id, name: p.cookieName, currentQty: 0 });
        });
    } else {
        rows.forEach(row => {
            const name = row.cells[0].textContent;
            const startInput = row.querySelector('.bi-start');
            const productId = startInput.dataset.product;
            const endInput = row.querySelector('.bi-end');
            
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
        <div class="booth-inventory-row-field" data-product="${i.productId}">
            <div class="cookie-name-field">${i.name}</div>
            <div class="cookie-qty-control">
                <button class="qty-btn" onclick="adjustFieldQty('${i.productId}', -1)">-</button>
                <input type="number" class="qty-input-field" value="${i.currentQty}" min="0">
                <button class="qty-btn" onclick="adjustFieldQty('${i.productId}', 1)">+</button>
            </div>
        </div>
    `).join('');
}

export async function saveBoothFieldMode() {
    const { selectedTroopId, currentBoothId, boothFieldModeType } = store.getState();
    const items = [];
    document.querySelectorAll('.booth-inventory-row-field').forEach(row => {
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
            `/troop/${selectedTroopId}/booths/${currentBoothId}/inventory` :
            `/troop/${selectedTroopId}/booths/${currentBoothId}/inventory/count`;
        
        await apiFetch(endpoint, {
            method: boothFieldModeType === 'start' ? 'PUT' : 'POST',
            body: JSON.stringify({ items })
        });
        
        showFeedback('Inventory updated');
        exitBoothFieldMode();
        openBoothDetail(currentBoothId);
    } catch (error) {
        showFeedback('Error saving: ' + error.message, true);
    }
}

export function exitBoothFieldMode() {
    document.getElementById('boothFieldMode').classList.add('hidden');
}
