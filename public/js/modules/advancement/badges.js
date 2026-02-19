/**
 * Advancement Module - Badges and Scout Profiles
 */
import { apiFetch } from '../api.js';
import { store } from '../state.js';
import { escapeHtml, formatDate } from '../utils.js';

// Helper: Lucide icon for badge type
export function getBadgeIcon(badgeType) {
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

/**
 * Load earned badges and available badges for the current user
 */
export async function loadEarnedBadges() {
    const { currentUser } = store.getState();
    try {
        if (!currentUser || !currentUser.id) return;

        const earnedBadges = await apiFetch(`/scouts/${currentUser.id}/badges`);
        const availableBadges = await apiFetch(`/scouts/${currentUser.id}/available-badges`);
        
        store.setState({ earnedBadges, availableBadges });
        renderBadgeAchievementSection();
    } catch (error) {
        console.debug('Badge loading skipped:', error.message);
    }
}

/**
 * Render achievement dashboard strip on Profile tab
 */
export function renderBadgeAchievementSection() {
    const { earnedBadges } = store.getState();
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
            <div class="earned-badge-chip" title="${escapeHtml(b.badgeName)}" onclick="showBadgeDetail('${escapeHtml(b.badgeId)}', true)">
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

/**
 * Open badge gallery modal
 */
export function openBadgeGalleryModal(initialFilter) {
    store.setState({ badgeGalleryFilter: initialFilter || 'available' });
    document.getElementById('badgeGalleryModal').style.display = 'flex';
    document.getElementById('badgeSearchInput').value = '';
    updateBadgeFilterButtons();
    renderBadgeGallery();
}

export function closeBadgeGalleryModal() {
    document.getElementById('badgeGalleryModal').style.display = 'none';
}

function updateBadgeFilterButtons() {
    const { badgeGalleryFilter } = store.getState();
    document.querySelectorAll('.badge-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === badgeGalleryFilter);
    });
}

/**
 * Render badge grid inside gallery modal
 */
export function renderBadgeGallery(searchQuery) {
    const { earnedBadges, availableBadges, badgeGalleryFilter } = store.getState();
    const grid = document.getElementById('badgeGalleryGrid');
    if (!grid) return;
    searchQuery = searchQuery || '';

    let badges;
    if (badgeGalleryFilter === 'earned') {
        badges = earnedBadges.map(eb => ({
            id: eb.badgeId, badgeName: eb.badgeName, badgeType: eb.badgeType,
            isEarned: true, earnedDate: eb.earnedDate
        }));
    } else if (badgeGalleryFilter === 'available') {
        badges = availableBadges.map(b => ({ ...b, isEarned: false }));
    } else {
        const earnedIds = new Set(earnedBadges.map(e => e.badgeId));
        badges = [
            ...earnedBadges.map(eb => ({ id: eb.badgeId, badgeName: eb.badgeName, badgeType: eb.badgeType, isEarned: true, earnedDate: eb.earnedDate })),
            ...availableBadges.filter(b => !earnedIds.has(b.id)).map(b => ({ ...b, isEarned: false }))
        ];
    }

    if (searchQuery) {
        badges = badges.filter(b =>
            (b.badgeName || '').toLowerCase().includes(searchQuery) ||
            (b.badgeType || '').toLowerCase().includes(searchQuery)
        );
    }

    if (badges.length === 0) {
        grid.innerHTML = '<p class="empty-state">No badges found.</p>';
        return;
    }

    grid.innerHTML = badges.map(b => `
        <div class="badge-card ${b.isEarned ? 'badge-card-earned' : ''}" onclick="showBadgeDetail('${escapeHtml(b.id)}', ${b.isEarned})">
            <div class="badge-card-icon">${getBadgeIcon(b.badgeType)}</div>
            <div class="badge-card-name">${escapeHtml(b.badgeName)}</div>
            <div class="badge-card-type">${escapeHtml(b.badgeType || '')}</div>
            ${b.isEarned ? `<div class="badge-card-earned-label">Earned ${escapeHtml(formatBadgeDate(b.earnedDate))}</div>` : ''}
        </div>
    `).join('');
    if (window.lucide) lucide.createIcons();
}

/**
 * Show badge detail modal (read-only)
 */
export function showBadgeDetail(badgeId, isEarned) {
    const { earnedBadges, availableBadges } = store.getState();
    let badge = null;
    if (isEarned) {
        const eb = earnedBadges.find(e => e.badgeId === badgeId);
        if (eb) badge = { id: eb.badgeId, badgeName: eb.badgeName, badgeType: eb.badgeType, description: eb.description, earnedDate: eb.earnedDate, verifiedByName: eb.verifiedByName };
    } else {
        badge = availableBadges.find(b => b.id === badgeId);
    }
    if (!badge) return;

    document.getElementById('badgeDetailName').textContent = badge.badgeName;
    document.getElementById('badgeDetailBody').innerHTML = `
        <div class="badge-detail-icon">${getBadgeIcon(badge.badgeType)}</div>
        <p class="badge-detail-type">${escapeHtml(badge.badgeType || 'Badge')}</p>
        <p class="badge-detail-description">${escapeHtml(badge.description || 'No description available.')}</p>
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

/**
 * Load scout profile (Phase 3.1)
 */
export async function loadScoutProfile() {
    const { currentUser } = store.getState();
    try {
        if (!currentUser || !currentUser.id) return;

        const scoutProfile = await apiFetch(`/scouts/${currentUser.id}/profile`);
        store.setState({ scoutProfile });
        renderScoutLevelBadge(scoutProfile);
    } catch (error) {
        console.debug('Error loading scout profile:', error.message);
    }
}

/**
 * Render scout level badge
 */
export function renderScoutLevelBadge(scoutProfile) {
    const container = document.getElementById('scoutLevelBadgeContainer');
    const levelName = document.getElementById('scoutLevelName');
    const orgName = document.getElementById('scoutOrgName');
    
    if (!container || !scoutProfile || !scoutProfile.scoutLevel) {
        if (container) container.style.display = 'none';
        return;
    }

    levelName.textContent = scoutProfile.scoutLevel;
    orgName.textContent = scoutProfile.orgName || '';
    
    // Set level-specific class
    const badge = document.getElementById('scoutLevelBadge');
    badge.className = 'scout-level-badge level-' + scoutProfile.scoutLevel.toLowerCase();
    
    container.style.display = 'flex';
}
