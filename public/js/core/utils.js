// Apex Scout Manager — UI Utilities

let _feedbackStylesInjected = false;

function _ensureFeedbackStyles() {
    if (_feedbackStylesInjected) return;
    _feedbackStylesInjected = true;
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideDown {
            from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
            to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
        }
        @keyframes slideUp {
            from { transform: translateX(-50%) translateY(0);    opacity: 1; }
            to   { transform: translateX(-50%) translateY(-100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

/**
 * Show a temporary toast notification.
 * @param {string}  message
 * @param {boolean} isError - Red background when true, primary color when false
 */
export function showFeedback(message, isError = false) {
    _ensureFeedbackStyles();

    const feedback = document.createElement('div');
    feedback.textContent = message;
    feedback.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background-color: ${isError ? 'var(--danger-color, #e53e3e)' : 'var(--primary-color)'};
        color: white;
        padding: 12px 24px;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 9999;
        animation: slideDown 0.3s ease-out;
        font-weight: 500;
    `;
    document.body.appendChild(feedback);

    setTimeout(() => {
        feedback.style.animation = 'slideUp 0.3s ease-out';
        setTimeout(() => { if (document.body.contains(feedback)) feedback.remove(); }, 300);
    }, 2000);
}

/**
 * Escape a string for safe HTML insertion.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Return a Lucide icon tag for the given badge type.
 * @param {string} badgeType
 * @returns {string} HTML string
 */
export function getBadgeIcon(badgeType) {
    const icons = {
        petal: 'flower', journey: 'map', merit: 'star',
        adventure: 'mountain', rank: 'award', eagle: 'bird',
        activity: 'target', honor: 'trophy', special: 'sparkles',
    };
    const iconName = icons[badgeType] || 'medal';
    return `<i data-lucide="${iconName}" class="icon-svg"></i>`;
}

/**
 * Format a date string as "Mon YYYY" (badge earned date display).
 * @param {string} dateStr
 * @returns {string}
 */
export function formatBadgeDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/**
 * Format sale/fundraiser type code as human-readable label.
 * @param {string} type
 * @returns {string}
 */
export function formatSaleType(type) {
    const labels = {
        booth: 'Booth Sale',
        door_to_door: 'Door-to-Door',
        online: 'Online',
        order_card: 'Order Card',
    };
    return labels[type] || type;
}
