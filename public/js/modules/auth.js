/**
 * Authentication Module
 */
import { authApi } from '../api.js';
import { store } from '../state.js';

/**
 * Check authentication status and get current user
 * @returns {Promise<boolean>}
 */
export async function checkAuth() {
    try {
        const user = await authApi.me();
        store.setState({ currentUser: user });
        return true;
    } catch (error) {
        console.error('Auth check failed:', error);
        // apiFetch/handleApiResponse handles redirect to login.html on 401
        return false;
    }
}

/**
 * Logout function
 */
export async function logout() {
    try {
        await authApi.logout();
    } catch (error) {
        console.error('Logout error:', error);
    }
    window.location.href = '/login.html';
}

/**
 * Display current user info in the UI
 */
export function displayUserInfo() {
    const { currentUser } = store.getState();
    const userNameEl = document.getElementById('userName');
    const logoutBtn = document.getElementById('logoutBtn');

    if (currentUser && userNameEl) {
        userNameEl.textContent = `${currentUser.firstName} ${currentUser.lastName}`;
    }

    if (logoutBtn) {
        logoutBtn.onclick = logout;
    }
}
