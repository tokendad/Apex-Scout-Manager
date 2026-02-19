/**
 * API Wrapper for Apex Scout Manager
 */

export const API_BASE_URL = '/api';

/**
 * Handle API responses and check for auth errors
 * @param {Response} response 
 * @returns {Promise<Response>}
 */
export async function handleApiResponse(response) {
    if (response.status === 401) {
        window.location.href = '/login.html';
        throw new Error('Authentication required');
    }
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }
    return response;
}

/**
 * Generic fetch wrapper with authentication and error handling
 * @param {string} endpoint 
 * @param {Object} options 
 * @returns {Promise<any>}
 */
export async function apiFetch(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
    
    const defaultOptions = {
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json'
        },
        ...options
    };

    const response = await fetch(url, defaultOptions);
    await handleApiResponse(response);
    
    // Some responses might be empty (204 No Content) or just indicate success
    if (response.status === 204) return null;
    
    return await response.json();
}

// Authentication API
export const authApi = {
    me: () => apiFetch('/auth/me'),
    login: (email, password) => apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
    }),
    logout: () => apiFetch('/auth/logout', { method: 'POST' })
};

// Profile API
export const profileApi = {
    get: () => apiFetch('/profile'),
    update: (data) => apiFetch('/profile', {
        method: 'PUT',
        body: JSON.stringify(data)
    }),
    uploadPhoto: (formData) => apiFetch('/profile/photo', {
        method: 'POST',
        body: formData,
        headers: {} // Let browser set Content-Type for FormData
    })
};

// Troop API
export const troopApi = {
    listMyTroops: () => apiFetch('/troops/my'),
    getDetails: (troopId) => apiFetch(`/troop/${troopId}`),
    getMembers: (troopId) => apiFetch(`/troop/${troopId}/members`),
    getSales: (troopId) => apiFetch(`/troop/${troopId}/sales`),
    getGoals: (troopId) => apiFetch(`/troop/${troopId}/goals`),
    getProducts: (troopId) => apiFetch(`/troop/${troopId}/products`),
    getSharedInventory: (troopId) => apiFetch(`/troop/${troopId}/shared-inventory`)
};

// ... more API wrappers as needed
