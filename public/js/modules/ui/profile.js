/**
 * Profile Module - User profile settings, photos, and payment methods
 */
import { profileApi, apiFetch } from '../../api.js';
import { store } from '../../state.js';
import { showFeedback, escapeHtml } from '../../utils.js';

/**
 * Load profile from API
 */
export async function loadProfile() {
    try {
        const profile = await profileApi.get();
        store.setState({ profile });

        // Update Settings page UI with profile data
        const qrCodeUrlInput = document.getElementById('qrCodeUrl');
        if (qrCodeUrlInput && profile.qrCodeUrl) {
            qrCodeUrlInput.value = profile.qrCodeUrl;
        }

        // Update Profile tab display elements
        updateProfileDisplay();
    } catch (error) {
        console.error('Error loading profile:', error);
        store.setState({ profile: { userId: null, photoData: null, qrCodeUrl: null, paymentQrCodeUrl: null, goalBoxes: 0, goalAmount: 0 } });
    }
}

/**
 * Update Profile tab display elements
 */
export function updateProfileDisplay() {
    const { profile } = store.getState();
    if (!profile) return;

    const profilePhotoDisplay = document.getElementById('profilePhotoDisplay');
    const profilePhotoPlaceholderDisplay = document.getElementById('profilePhotoPlaceholderDisplay');
    const storeQrImageDisplay = document.getElementById('storeQrImageDisplay');
    const storeQrPlaceholder = document.getElementById('storeQrPlaceholder');

    // Update photo
    if (profile.photoData) {
        if (profilePhotoDisplay) {
            profilePhotoDisplay.src = profile.photoData;
            profilePhotoDisplay.style.display = 'block';
        }
        if (profilePhotoPlaceholderDisplay) profilePhotoPlaceholderDisplay.style.display = 'none';
    } else if (profile.photoUrl) {
        if (profilePhotoDisplay) {
            profilePhotoDisplay.src = profile.photoUrl;
            profilePhotoDisplay.style.display = 'block';
        }
        if (profilePhotoPlaceholderDisplay) profilePhotoPlaceholderDisplay.style.display = 'none';
    } else {
        if (profilePhotoDisplay) profilePhotoDisplay.style.display = 'none';
        if (profilePhotoPlaceholderDisplay) profilePhotoPlaceholderDisplay.style.display = 'flex';
    }

    // Update Store QR
    if (profile.qrCodeUrl) {
        if (storeQrImageDisplay) {
            storeQrImageDisplay.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(profile.qrCodeUrl)}`;
            storeQrImageDisplay.style.display = 'block';
        }
        if (storeQrPlaceholder) storeQrPlaceholder.style.display = 'none';
    } else {
        if (storeQrImageDisplay) storeQrImageDisplay.style.display = 'none';
        if (storeQrPlaceholder) storeQrPlaceholder.style.display = 'block';
    }
}

/**
 * Handle profile photo upload
 */
export async function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
        showFeedback('Photo file size must be less than 5MB', true);
        return;
    }

    const formData = new FormData();
    formData.append('photo', file);

    try {
        const result = await profileApi.uploadPhoto(formData);
        showFeedback('Profile photo updated');
        loadProfile(); // Reload to update UI
    } catch (error) {
        showFeedback('Failed to upload photo: ' + error.message, true);
    }
}

/**
 * Handle updating cookie store URL/QR code
 */
export async function handleUpdateQrCode() {
    const qrCodeUrl = document.getElementById('qrCodeUrl').value.trim();
    
    try {
        await profileApi.update({ qrCodeUrl });
        showFeedback('Cookie store URL updated');
        loadProfile(); // Reload to update UI
    } catch (error) {
        showFeedback('Failed to update URL: ' + error.message, true);
    }
}

/**
 * Load payment methods
 */
export async function loadPaymentMethods() {
    try {
        const methods = await apiFetch('/profile/payment-methods');
        store.setState({ paymentMethods: methods });
        renderPaymentMethodsSettings();
        updateProfileDisplay(); // To refresh the methods on profile tab
    } catch (error) {
        console.error('Error loading payment methods:', error);
    }
}

/**
 * Render payment methods in Settings tab
 */
export function renderPaymentMethodsSettings() {
    const { paymentMethods } = store.getState();
    const list = document.getElementById('settingsPaymentMethodsList');
    if (!list) return;

    if (paymentMethods.length === 0) {
        list.innerHTML = '<p class="empty-message">No payment methods added yet.</p>';
    } else {
        list.innerHTML = paymentMethods.map(method => `
            <div class="payment-method-item">
                <div class="payment-method-info">
                    <strong>${escapeHtml(method.name)}</strong>
                    <span class="payment-method-url">${escapeHtml(method.url)}</span>
                </div>
                <button class="btn btn-sm btn-danger" onclick="handleDeletePaymentMethod('${method.id}')">Delete</button>
            </div>
        `).join('');
    }
}

/**
 * Add a new payment method
 */
export async function handleAddPaymentMethod() {
    const name = document.getElementById('newPaymentName').value.trim();
    const url = document.getElementById('newPaymentUrl').value.trim();

    if (!name || !url) {
        showFeedback('Please enter both name and URL', true);
        return;
    }

    try {
        await apiFetch('/profile/payment-methods', {
            method: 'POST',
            body: JSON.stringify({ name, url })
        });
        document.getElementById('newPaymentName').value = '';
        document.getElementById('newPaymentUrl').value = '';
        showFeedback('Payment method added');
        loadPaymentMethods();
    } catch (error) {
        showFeedback('Failed to add payment method: ' + error.message, true);
    }
}

/**
 * Delete a payment method
 */
export async function handleDeletePaymentMethod(id) {
    if (!confirm('Are you sure you want to delete this payment method?')) return;

    try {
        await apiFetch(`/profile/payment-methods/${id}`, { method: 'DELETE' });
        showFeedback('Payment method deleted');
        loadPaymentMethods();
    } catch (error) {
        showFeedback('Failed to delete payment method: ' + error.message, true);
    }
}
