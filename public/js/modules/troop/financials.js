/**
 * Financials Module - Donations, Goals, and Proceeds
 */
import { apiFetch, troopApi } from '../../api.js';
import { store } from '../../state.js';
import { showFeedback, formatCurrency, escapeHtml } from '../../utils.js';

/**
 * Load donations from API
 */
export async function loadDonations() {
    try {
        const donations = await apiFetch('/donations');
        store.setState({ donations });
        renderDonations();
    } catch (error) {
        console.error('Error loading donations:', error);
        store.setState({ donations: [] });
    }
}

/**
 * Render donations list
 */
export function renderDonations() {
    const { donations } = store.getState();
    const donationsList = document.getElementById('donationsList');
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
                    <div class="donation-amount">${formatCurrency(donation.amount || 0)}</div>
                    <div class="donation-details">
                        ${escapeHtml(donation.donorName)} • ${formattedDate}
                    </div>
                </div>
                <div class="donation-actions">
                    <button class="btn-delete" onclick="handleDeleteDonation('${donation.id}')">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Handle adding a new donation
 */
export async function handleAddDonation(event) {
    event.preventDefault();
    const amount = document.getElementById('donationAmount').value;
    const donorName = document.getElementById('donorName').value;

    try {
        await apiFetch('/donations', {
            method: 'POST',
            body: JSON.stringify({ amount, donorName })
        });
        showFeedback('Donation recorded');
        document.getElementById('donationAmount').value = '';
        document.getElementById('donorName').value = '';
        loadDonations();
    } catch (error) {
        showFeedback('Error: ' + error.message, true);
    }
}

/**
 * Handle deleting a donation
 */
export async function handleDeleteDonation(id) {
    if (!confirm('Are you sure you want to delete this donation?')) return;

    try {
        await apiFetch(`/donations/${id}`, { method: 'DELETE' });
        showFeedback('Donation deleted');
        loadDonations();
    } catch (error) {
        showFeedback('Error deleting donation: ' + error.message, true);
    }
}
