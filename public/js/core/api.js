// Apex Scout Manager — API Fetch Wrapper

import { API_BASE_URL } from './constants.js';

/**
 * Centralized fetch wrapper.
 * - Automatically includes cookies (credentials: 'include')
 * - Sets Content-Type: application/json for non-FormData bodies
 * - Merges caller-supplied headers without overwriting defaults
 * - Redirects to /login.html on 401
 * - Throws Error with server message on non-OK responses
 *
 * @param {string} path   - Path relative to API_BASE_URL, e.g. '/auth/me'
 * @param {RequestInit} options - Standard fetch options (method, body, headers, …)
 * @returns {Promise<Response>}
 */
export async function apiFetch(path, options = {}) {
    const { headers: customHeaders = {}, ...restOptions } = options;
    const isFormData = restOptions.body instanceof FormData;

    const headers = isFormData
        ? { ...customHeaders }
        : { 'Content-Type': 'application/json', ...customHeaders };

    const response = await fetch(`${API_BASE_URL}${path}`, {
        credentials: 'include',
        headers,
        ...restOptions,
    });

    if (response.status === 401) {
        window.location.href = '/login.html';
        throw new Error('Authentication required');
    }

    if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `HTTP ${response.status}`);
    }

    return response;
}

/**
 * Check auth status and populate currentUser.
 * Returns the user object on success, or redirects to /login.html.
 */
export async function checkAuth() {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, { credentials: 'include' });
        if (response.status === 401) {
            window.location.href = '/login.html';
            return null;
        }
        if (response.ok) {
            return await response.json();
        }
        return null;
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/login.html';
        return null;
    }
}

/** POST /auth/logout then redirect to login. */
export async function logout() {
    try {
        await fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch (error) {
        console.error('Logout error:', error);
    }
    window.location.href = '/login.html';
}
