/**
 * Parent Module - Linked scouts and COPPA consent
 */
import { apiFetch } from '../../api.js';
import { store } from '../../state.js';
import { showFeedback } from '../../utils.js';

/**
 * Load linked scouts for a parent
 */
export async function loadLinkedScouts() {
    const { currentUser } = store.getState();
    if (!currentUser || currentUser.role !== 'parent') return;
    
    try {
        const scouts = await apiFetch('/parents/scouts');
        store.setState({ linkedScouts: scouts });
        renderParentDashboard(scouts);
    } catch (error) {
        console.error('Error loading linked scouts:', error);
    }
}

/**
 * Render parent dashboard with linked scouts
 */
export function renderParentDashboard(scouts) {
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
                    <button class="btn btn-sm btn-primary" style="margin-top: 10px; width: 100%;" onclick="handleApproveScout('${s.id}')">
                        <i data-lucide="check-circle"></i> Provide Consent
                    </button>
                ` : `
                    <button class="btn btn-sm btn-secondary" style="margin-top: 10px; width: 100%;" onclick="handleViewScoutStats('${s.id}')">
                        <i data-lucide="bar-chart"></i> View Stats
                    </button>
                `}
            </div>
        `).join('');
        if (window.lucide) lucide.createIcons();
    }

    section.style.display = 'block';
}

/**
 * Approve a scout account (COPPA consent)
 */
export async function approveScout(scoutId) {
    if (!confirm('By clicking OK, you provide digital consent for this minor to use Apex Scout Manager in accordance with COPPA regulations.')) {
        return;
    }

    try {
        await apiFetch(`/parents/approve-scout/${scoutId}`, { method: 'POST' });
        showFeedback('Account approved successfully!');
        loadLinkedScouts();
    } catch (error) {
        showFeedback('Error: ' + error.message, true);
    }
}
