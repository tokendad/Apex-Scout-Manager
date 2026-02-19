/**
 * Troop Management Module - Roster and Member Management
 */
import { apiFetch, troopApi } from '../../api.js';
import { store } from '../../state.js';
import { showFeedback, escapeHtml } from '../../utils.js';

/**
 * Load troops belonging to the current user
 */
export async function loadMyTroops() {
    try {
        const troops = await troopApi.listMyTroops();
        store.setState({ myTroops: troops });
        populateTroopSelector(troops);
    } catch (error) {
        console.error('Error loading troops:', error);
    }
}

function populateTroopSelector(troops) {
    const selector = document.getElementById('troopSelector');
    if (!selector) return;

    selector.innerHTML = '<option value="">Select a troop...</option>' +
        troops.map(t => `<option value="${t.id}">Troop ${t.troopNumber} (${t.troopType})</option>`).join('');
    
    const { selectedTroopId } = store.getState();
    if (selectedTroopId) selector.value = selectedTroopId;
}

/**
 * Load all data for a specific troop
 */
export async function loadTroopData(troopId) {
    store.setState({ selectedTroopId: troopId });
    try {
        const [members, sales, goals] = await Promise.all([
            troopApi.getMembers(troopId),
            troopApi.getSales(troopId),
            troopApi.getGoals(troopId)
        ]);

        store.setState({ 
            troopMembers: members, 
            troopSalesData: sales, 
            troopGoals: goals 
        });

        renderTroopDashboard();
    } catch (error) {
        console.error('Error loading troop data:', error);
        showFeedback('Failed to load troop data', true);
    }
}

/**
 * Render the troop dashboard
 */
export function renderTroopDashboard() {
    const { troopMembers, troopSalesData } = store.getState();
    const dashboardTab = document.getElementById('troop-tab-dashboard');
    const emptyState = document.getElementById('troopEmptyState');

    if (emptyState) emptyState.style.display = 'none';

    document.getElementById('troopTotalBoxes').textContent = troopSalesData?.totals?.totalBoxes || 0;
    document.getElementById('troopMemberCount').textContent = troopMembers.length;

    renderTroopMembers();
    // ... (rest of rendering calls)
}

/**
 * Render troop members table
 */
export function renderTroopMembers() {
    const { troopMembers } = store.getState();
    const tbody = document.getElementById('troopMembersTable');
    if (!tbody) return;

    if (troopMembers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No members yet. Add members to get started!</td></tr>';
        return;
    }

    tbody.innerHTML = troopMembers.map(member => {
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
                        <span>${escapeHtml(member.firstName)} ${escapeHtml(member.lastName)}</span>
                    </div>
                </td>
                <td><span class="role-badge role-${member.troopRole}">${roleDisplay}</span></td>
                <td>${member.totalBoxes}</td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="handleRemoveMember('${member.id}')">✕</button>
                </td>
            </tr>
        `;
    }).join('');
}
