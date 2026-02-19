/**
 * Admin Panel JavaScript
 * Manages admin interface for system administration
 */

// ============================================================================
// Authentication Check
// ============================================================================

/**
 * Verify user has admin access
 */
async function checkAdminAccess() {
    try {
        const response = await fetch('/api/system/admins', {
            method: 'GET',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.status === 401) {
            window.location.href = '/login.html?redirect=/admin&reason=auth_required';
            return false;
        }

        if (response.status === 403) {
            window.location.href = '/?error=admin_access_required';
            return false;
        }

        return response.ok;
    } catch (error) {
        console.error('Admin access check failed:', error);
        return false;
    }
}

// ============================================================================
// View Navigation
// ============================================================================

/**
 * Switch between admin panel tabs
 */
function switchView(viewId) {
    const views = document.querySelectorAll('.view-section');
    const tabButtons = document.querySelectorAll('.tab-btn');

    // Hide all views
    views.forEach(view => view.classList.add('hidden'));

    // Show selected view
    const selectedView = document.getElementById('view-' + viewId);
    if (selectedView) {
        selectedView.classList.remove('hidden');
    }

    // Update tab buttons
    tabButtons.forEach(btn => {
        if (btn.dataset.view === viewId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Save preference
    localStorage.setItem('adminLastView', viewId);

    // Load data for specific views
    if (viewId === 'dashboard') {
        loadDashboard();
    } else if (viewId === 'admins') {
        loadAdminsList();
    } else if (viewId === 'organizations') {
        loadOrganizations();
    } else if (viewId === 'troops') {
        loadTroops();
    } else if (viewId === 'members') {
        loadMembers();
    } else if (viewId === 'roles') {
        loadRoles();
    } else if (viewId === 'audit') {
        loadAuditLog();
    } else if (viewId === 'settings') {
        loadSettings();
        loadSessions();
        loadSystemStats();
    }
}

/**
 * Setup navigation event listeners
 */
function setupNavigation() {
    const tabButtons = document.querySelectorAll('.tab-btn');

    tabButtons.forEach(btn => {
        if (btn.id !== 'logoutBtn') {
            btn.addEventListener('click', () => {
                switchView(btn.dataset.view);
            });
        }
    });

    // Load last view or default to dashboard
    let lastView = localStorage.getItem('adminLastView') || 'dashboard';
    switchView(lastView);
}

// ============================================================================
// Dashboard
// ============================================================================

/**
 * Load and display dashboard statistics
 */
async function loadDashboard() {
    try {
        // Load basic stats
        const [adminsResponse, orgsResponse, troopsResponse, membersResponse, bootstrapResponse] = await Promise.all([
            fetch('/api/system/admins', { credentials: 'include' }),
            fetch('/api/system/organizations', { credentials: 'include' }),
            fetch('/api/system/troops', { credentials: 'include' }),
            fetch('/api/system/members', { credentials: 'include' }),
            fetch('/api/system/bootstrap-status', { credentials: 'include' })
        ]);

        const admins = await adminsResponse.json();
        const orgs = await orgsResponse.json();
        const troops = await troopsResponse.json();
        const members = await membersResponse.json();
        const bootstrap = await bootstrapResponse.json();

        // Update stat cards
        document.getElementById('statAdmins').textContent = admins.admins ? admins.admins.length : 0;
        document.getElementById('statOrganizations').textContent = orgs.organizations ? orgs.organizations.length : 0;
        document.getElementById('statTroops').textContent = troops.troops ? troops.troops.length : 0;
        document.getElementById('statMembers').textContent = members.members ? members.members.length : 0;

        // Update bootstrap status
        const bootstrapBadge = document.getElementById('bootstrapStatus');
        if (bootstrap.needsBootstrap) {
            bootstrapBadge.innerHTML = '<span style="color: #e74c3c;">⚠ Bootstrap Required</span>';
        } else {
            bootstrapBadge.innerHTML = '<span style="color: #27ae60;">✓ Complete</span>';
        }

        if (window.lucide) lucide.createIcons();
        showAlert('dashboardAlert', 'Dashboard loaded successfully', 'success', 3000);
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showAlert('dashboardAlert', 'Failed to load dashboard: ' + error.message, 'error');
    }
}

// ============================================================================
// Admin Management
// ============================================================================

/**
 * Load and display list of admins
 */
async function loadAdminsList() {
    try {
        const response = await fetch('/api/system/admins', {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to load admins');
        }

        const data = await response.json();
        const adminsList = document.getElementById('adminsList');

        if (!data.admins || data.admins.length === 0) {
            adminsList.innerHTML = '<div class="no-data">No admin accounts found</div>';
            return;
        }

        let html = `
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Granted</th>
                        <th>Granted By</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        for (const admin of data.admins) {
            const grantedDate = new Date(admin.grantedAt).toLocaleDateString();
            const grantedBy = admin.grantedBy ? '(system)' : 'Bootstrap';

            html += `
                <tr>
                    <td>${escapeHtml(admin.email)}</td>
                    <td><span style="background: #3498db; color: white; padding: 0.25rem 0.5rem; border-radius: 3px; font-size: 0.9rem;">${admin.role}</span></td>
                    <td>${grantedDate}</td>
                    <td>${grantedBy}</td>
                    <td>
                        <button class="action-btn delete" onclick="revokeAdmin('${admin.userId}', '${escapeHtml(admin.email)}')">Revoke</button>
                    </td>
                </tr>
            `;
        }

        html += '</tbody></table>';
        adminsList.innerHTML = html;
        showAlert('adminsAlert', 'Admin list loaded', 'success', 2000);
    } catch (error) {
        console.error('Error loading admins:', error);
        showAlert('adminsAlert', 'Failed to load admin list: ' + error.message, 'error');
    }
}

/**
 * Show create admin form
 */
function showCreateAdminForm() {
    document.getElementById('createAdminForm').style.display = 'block';
    document.getElementById('newAdminEmail').focus();
}

/**
 * Hide create admin form
 */
function hideCreateAdminForm() {
    document.getElementById('createAdminForm').style.display = 'none';
    document.getElementById('newAdminEmail').value = '';
}

/**
 * Create new admin account
 */
async function createAdmin() {
    const email = document.getElementById('newAdminEmail').value.trim();

    if (!email) {
        showAlert('adminsAlert', 'Please enter an email address', 'error');
        return;
    }

    try {
        // First, find the user by email
        const userResponse = await fetch(`/api/members?search=${encodeURIComponent(email)}`, {
            credentials: 'include'
        });

        if (!userResponse.ok) {
            showAlert('adminsAlert', 'Failed to search for user', 'error');
            return;
        }

        const userData = await userResponse.json();
        let userId = null;

        // Check if we found a user with matching email
        if (userData.members && userData.members.length > 0) {
            const matchingUser = userData.members.find(m => m.email === email);
            if (matchingUser) {
                userId = matchingUser.id;
            }
        }

        if (!userId) {
            showAlert('adminsAlert', 'User not found. Please create the user account first.', 'error');
            return;
        }

        // Create admin
        const response = await fetch('/api/system/admins', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create admin');
        }

        showAlert('adminsAlert', 'Admin account created successfully', 'success');
        hideCreateAdminForm();
        loadAdminsList();
    } catch (error) {
        console.error('Error creating admin:', error);
        showAlert('adminsAlert', 'Failed to create admin: ' + error.message, 'error');
    }
}

/**
 * Revoke admin access
 */
async function revokeAdmin(userId, email) {
    if (!confirm(`Are you sure you want to revoke admin access for ${email}?`)) {
        return;
    }

    try {
        const response = await fetch(`/api/system/admins/${userId}`, {
            method: 'DELETE',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to revoke admin');
        }

        showAlert('adminsAlert', 'Admin access revoked successfully', 'success');
        loadAdminsList();
    } catch (error) {
        console.error('Error revoking admin:', error);
        showAlert('adminsAlert', 'Failed to revoke admin: ' + error.message, 'error');
    }
}

// ============================================================================
// Organizations
// ============================================================================

/**
 * Load and display organizations
 */
async function loadOrganizations() {
    try {
        const response = await fetch('/api/system/organizations', {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to load organizations');
        }

        const data = await response.json();
        const orgsList = document.getElementById('organizationsList');
        const organizations = data.organizations || [];

        if (organizations.length === 0) {
            orgsList.innerHTML = '<div class="no-data">No organizations found</div>';
            return;
        }

        let html = `
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Code</th>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Troops</th>
                        <th>Members</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        for (const org of organizations) {
            const statusClass = org.isActive ? 'color: #27ae60;' : 'color: #e74c3c;';
            const statusText = org.isActive ? 'Active' : 'Inactive';
            const safeOrg = JSON.stringify(org).replace(/"/g, '&quot;');

            html += `
                <tr>
                    <td><strong>${escapeHtml(org.orgCode)}</strong></td>
                    <td>${escapeHtml(org.orgName)}</td>
                    <td>${escapeHtml(org.orgType || 'N/A')}</td>
                    <td>${org.troopCount || 0}</td>
                    <td>${org.memberCount || 0}</td>
                    <td><span style="${statusClass}">${statusText}</span></td>
                    <td>
                        <button class="action-btn edit" onclick="editOrganization(${safeOrg})">Edit</button>
                        <button class="action-btn delete" onclick="deleteOrganization('${org.id}', '${escapeHtml(org.orgName)}')">Delete</button>
                    </td>
                </tr>
            `;
        }

        html += '</tbody></table>';
        orgsList.innerHTML = html;
        showAlert('organizationsAlert', 'Organizations loaded', 'success', 2000);
    } catch (error) {
        console.error('Error loading organizations:', error);
        showAlert('organizationsAlert', 'Failed to load organizations: ' + error.message, 'error');
    }
}

/**
 * Show Create Organization Form
 */
function showCreateOrgForm() {
    document.getElementById('orgFormTitle').textContent = 'Create New Organization';
    document.getElementById('editOrgId').value = '';
    document.getElementById('orgCode').value = '';
    document.getElementById('orgCode').disabled = false;
    document.getElementById('orgName').value = '';
    document.getElementById('orgType').value = 'girl_scouts';
    document.getElementById('orgWebsite').value = '';
    document.getElementById('orgDescription').value = '';
    document.getElementById('orgActiveGroup').style.display = 'none';
    
    document.getElementById('createOrgForm').style.display = 'block';
    document.getElementById('organizationsList').style.display = 'none';
}

/**
 * Hide Create Organization Form
 */
function hideCreateOrgForm() {
    document.getElementById('createOrgForm').style.display = 'none';
    document.getElementById('organizationsList').style.display = 'block';
}

/**
 * Edit Organization
 */
function editOrganization(org) {
    document.getElementById('orgFormTitle').textContent = 'Edit Organization';
    document.getElementById('editOrgId').value = org.id;
    document.getElementById('orgCode').value = org.orgCode;
    document.getElementById('orgCode').disabled = true; // Cannot change code
    document.getElementById('orgName').value = org.orgName;
    document.getElementById('orgType').value = org.orgType;
    document.getElementById('orgWebsite').value = org.websiteUrl || '';
    document.getElementById('orgDescription').value = org.description || '';
    
    document.getElementById('orgActive').checked = org.isActive;
    document.getElementById('orgActiveGroup').style.display = 'block';
    
    document.getElementById('createOrgForm').style.display = 'block';
    document.getElementById('organizationsList').style.display = 'none';
}

/**
 * Submit Organization (Create or Update)
 */
async function submitOrganization() {
    const id = document.getElementById('editOrgId').value;
    const orgCode = document.getElementById('orgCode').value.trim();
    const orgName = document.getElementById('orgName').value.trim();
    const orgType = document.getElementById('orgType').value;
    const websiteUrl = document.getElementById('orgWebsite').value.trim();
    const description = document.getElementById('orgDescription').value.trim();
    const isActive = document.getElementById('orgActive').checked;

    if (!orgName) {
        showAlert('organizationsAlert', 'Organization Name is required', 'error');
        return;
    }

    if (!id && !orgCode) {
        showAlert('organizationsAlert', 'Organization Code is required', 'error');
        return;
    }

    const payload = {
        orgCode,
        orgName,
        orgType,
        websiteUrl,
        description,
        isActive
    };

    try {
        let response;
        if (id) {
            // Update
            response = await fetch(`/api/system/organizations/${id}`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } else {
            // Create
            response = await fetch('/api/system/organizations', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Operation failed');
        }

        showAlert('organizationsAlert', id ? 'Organization updated' : 'Organization created', 'success');
        hideCreateOrgForm();
        loadOrganizations();
    } catch (error) {
        console.error('Error saving organization:', error);
        showAlert('organizationsAlert', error.message, 'error');
    }
}

/**
 * Delete Organization
 */
async function deleteOrganization(id, name) {
    if (!confirm(`Are you sure you want to delete organization "${name}"?\n\nThis cannot be undone if troops or members are associated with it.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/system/organizations/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete organization');
        }

        showAlert('organizationsAlert', 'Organization deleted successfully', 'success');
        loadOrganizations();
    } catch (error) {
        console.error('Error deleting organization:', error);
        showAlert('organizationsAlert', error.message, 'error');
    }
}

// ============================================================================
// Troops
// ============================================================================

/**
 * Load troops
 */
async function loadTroops() {
    try {
        const response = await fetch('/api/system/troops', {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to load troops');
        }

        const data = await response.json();
        displayTroops(data.troops || []);
    } catch (error) {
        console.error('Error loading troops:', error);
        showAlert('troopsAlert', 'Failed to load troops: ' + error.message, 'error');
    }
}

/**
 * Search troops (client-side filtering for now since API returns all)
 */
async function searchTroops() {
    // Reload all first to ensure fresh data, then filter
    // In a real large-scale app, we'd use server-side search
    loadTroops();
}

/**
 * Display troops in table
 */
function displayTroops(troops) {
    const troopsList = document.getElementById('troopsList');
    const query = document.getElementById('troopSearch').value.trim().toLowerCase();

    // Filter if search query exists
    let filteredTroops = troops;
    if (query) {
        filteredTroops = troops.filter(t => 
            t.troopName.toLowerCase().includes(query) || 
            t.troopNumber.includes(query)
        );
    }

    if (!filteredTroops || filteredTroops.length === 0) {
        troopsList.innerHTML = '<div class="no-data">No troops found</div>';
        return;
    }

    let html = `
        <table class="admin-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Number</th>
                    <th>Organization</th>
                    <th>Leader</th>
                    <th>Members</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;

    for (const troop of filteredTroops) {
        const statusClass = troop.isActive ? 'color: #27ae60;' : 'color: #e74c3c;';
        const statusText = troop.isActive ? 'Active' : 'Inactive';
        const safeTroop = JSON.stringify(troop).replace(/"/g, '&quot;');

        html += `
            <tr>
                <td><strong>${escapeHtml(troop.troopName)}</strong></td>
                <td>${escapeHtml(troop.troopNumber)}</td>
                <td>${escapeHtml(troop.orgName || 'N/A')}</td>
                <td>${escapeHtml(troop.leaderName || 'Unassigned')}</td>
                <td>${troop.memberCount || 0}</td>
                <td><span style="${statusClass}">${statusText}</span></td>
                <td>
                    <button class="action-btn edit" onclick="editTroop(${safeTroop})">Edit</button>
                    <button class="action-btn delete" onclick="deleteTroop('${troop.id}', '${escapeHtml(troop.troopName)}')">Delete</button>
                </td>
            </tr>
        `;
    }

    html += '</tbody></table>';
    troopsList.innerHTML = html;
    showAlert('troopsAlert', `Found ${filteredTroops.length} troop(s)`, 'success', 2000);
}

/**
 * Show Create Troop Form
 */
async function showCreateTroopForm() {
    document.getElementById('troopFormTitle').textContent = 'Create New Troop';
    document.getElementById('editTroopId').value = '';
    document.getElementById('troopNumber').value = '';
    document.getElementById('troopName').value = '';
    document.getElementById('troopType').value = 'daisy';
    document.getElementById('troopActiveGroup').style.display = 'none';

    await populateOrganizationSelect();
    
    document.getElementById('createTroopForm').style.display = 'block';
    document.getElementById('troopsList').style.display = 'none';
    document.querySelector('#view-troops .search-box').style.display = 'none';
}

/**
 * Hide Create Troop Form
 */
function hideCreateTroopForm() {
    document.getElementById('createTroopForm').style.display = 'none';
    document.getElementById('troopsList').style.display = 'block';
    document.querySelector('#view-troops .search-box').style.display = 'flex';
}

/**
 * Populate Organization Select Dropdown
 */
async function populateOrganizationSelect(selectedId = null) {
    const select = document.getElementById('troopOrgId');
    select.innerHTML = '<option value="">Loading...</option>';

    try {
        const response = await fetch('/api/system/organizations', { credentials: 'include' });
        const data = await response.json();
        const orgs = data.organizations || [];

        select.innerHTML = '<option value="">Select Organization...</option>';
        orgs.forEach(org => {
            if (!org.isActive && org.id !== selectedId) return; // Skip inactive unless currently selected
            const option = document.createElement('option');
            option.value = org.id;
            option.textContent = `${org.orgName} (${org.orgCode})`;
            if (selectedId && org.id === selectedId) option.selected = true;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading organizations:', error);
        select.innerHTML = '<option value="">Error loading organizations</option>';
    }
}

/**
 * Edit Troop
 */
async function editTroop(troop) {
    document.getElementById('troopFormTitle').textContent = 'Edit Troop';
    document.getElementById('editTroopId').value = troop.id;
    document.getElementById('troopNumber').value = troop.troopNumber;
    document.getElementById('troopName').value = troop.troopName;
    document.getElementById('troopType').value = troop.troopType;
    
    document.getElementById('troopActive').checked = troop.isActive;
    document.getElementById('troopActiveGroup').style.display = 'block';

    await populateOrganizationSelect(troop.organizationId);
    
    document.getElementById('createTroopForm').style.display = 'block';
    document.getElementById('troopsList').style.display = 'none';
    document.querySelector('#view-troops .search-box').style.display = 'none';
}

/**
 * Submit Troop (Create or Update)
 */
async function submitTroop() {
    const id = document.getElementById('editTroopId').value;
    const troopNumber = document.getElementById('troopNumber').value.trim();
    const troopName = document.getElementById('troopName').value.trim();
    const troopType = document.getElementById('troopType').value;
    const organizationId = document.getElementById('troopOrgId').value;
    const isActive = document.getElementById('troopActive').checked;

    if (!troopNumber || !organizationId) {
        showAlert('troopsAlert', 'Troop Number and Organization are required', 'error');
        return;
    }

    const payload = {
        troopNumber,
        troopName,
        troopType,
        organizationId,
        isActive
    };

    try {
        let response;
        if (id) {
            response = await fetch(`/api/system/troops/${id}`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } else {
            response = await fetch('/api/system/troops', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Operation failed');
        }

        showAlert('troopsAlert', id ? 'Troop updated' : 'Troop created', 'success');
        hideCreateTroopForm();
        loadTroops();
    } catch (error) {
        console.error('Error saving troop:', error);
        showAlert('troopsAlert', error.message, 'error');
    }
}

/**
 * Delete Troop
 */
async function deleteTroop(id, name) {
    if (!confirm(`Are you sure you want to delete "${name}"?\n\nThis will fail if the troop has members.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/system/troops/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete troop');
        }

        showAlert('troopsAlert', 'Troop deleted successfully', 'success');
        loadTroops();
    } catch (error) {
        console.error('Error deleting troop:', error);
        showAlert('troopsAlert', error.message, 'error');
    }
}

// ============================================================================
// Members
// ============================================================================

/**
 * Load members
 */
async function loadMembers() {
    try {
        const response = await fetch('/api/system/members', {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to load members');
        }

        const data = await response.json();
        displayMembers(data.members || []);
    } catch (error) {
        console.error('Error loading members:', error);
        showAlert('membersAlert', 'Failed to load members: ' + error.message, 'error');
    }
}

/**
 * Search members (client-side filter)
 */
async function searchMembers() {
    const query = document.getElementById('memberSearch').value.trim().toLowerCase();
    
    // In a real app, we'd refetch with query param, but for now we'll filter client-side
    // or call loadMembers which fetches all (limited to 200)
    // Let's refetch to be safe if we implement server-side search later
    try {
        const response = await fetch(`/api/system/members?search=${encodeURIComponent(query)}`, {
            credentials: 'include'
        });
        
        if (!response.ok) throw new Error('Search failed');
        const data = await response.json();
        displayMembers(data.members || []);
    } catch (error) {
        console.error('Search error:', error);
        showAlert('membersAlert', 'Search failed', 'error');
    }
}

/**
 * Display members in table
 */
function displayMembers(members) {
    const membersList = document.getElementById('membersList');

    if (!members || members.length === 0) {
        membersList.innerHTML = '<div class="no-data">No members found</div>';
        return;
    }

    let html = `
        <table class="admin-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Troops</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;

    for (const member of members) {
        const status = member.isActive ? 'Active' : 'Inactive';
        const statusColor = member.isActive ? '#27ae60' : '#95a5a6';
        const safeMember = JSON.stringify(member).replace(/"/g, '&quot;');

        html += `
            <tr>
                <td><strong>${escapeHtml(member.firstName)} ${escapeHtml(member.lastName)}</strong></td>
                <td>${escapeHtml(member.email || 'N/A')}</td>
                <td>${escapeHtml(member.role || 'member')}</td>
                <td>${member.troopCount || 0}</td>
                <td><span style="color: ${statusColor};">${status}</span></td>
                <td>
                    <button class="action-btn edit" onclick="editMember(${safeMember})">Edit</button>
                    <button class="action-btn delete" onclick="deleteMember('${member.id}', '${escapeHtml(member.email)}')">Deactivate</button>
                    <button class="action-btn delete" style="background-color: #34495e;" onclick="anonymizeUser('${member.id}', '${escapeHtml(member.email)}')">Anonymize</button>
                </td>
            </tr>
        `;
    }

    html += '</tbody></table>';
    membersList.innerHTML = html;
    showAlert('membersAlert', `Found ${members.length} member(s)`, 'success', 2000);
}

/**
 * Anonymize User (COPPA)
 */
async function anonymizeUser(id, email) {
    if (!confirm(`DANGER: Are you sure you want to ANONYMIZE user ${email}? This will permanently remove all PII (name, email, photo) and cannot be undone. This is for COPPA compliance.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/system/anonymize/${id}`, {
            method: 'POST',
            credentials: 'include'
        });

        const data = await response.json();

        if (response.ok) {
            showAlert('membersAlert', 'User anonymized successfully', 'success');
            loadMembers(); // Refresh list
        } else {
            throw new Error(data.error || 'Failed to anonymize user');
        }
    } catch (error) {
        console.error('Anonymize error:', error);
        showAlert('membersAlert', error.message, 'error');
    }
}

/**
 * Load Roles Reference
 */
async function loadRoles() {
    const list = document.getElementById('rolesList');
    list.innerHTML = '<div class="loading">Loading role definitions...</div>';

    try {
        const response = await fetch('/api/system/roles', { credentials: 'include' });
        const data = await response.json();

        if (!data.roles) {
            list.innerHTML = '<div class="no-data">No role definitions found</div>';
            return;
        }

        let html = '';

        // Role Cards
        for (const [roleName, privileges] of Object.entries(data.roles)) {
            html += `
                <div class="admin-form" style="max-width: 100%; margin-bottom: 2rem;">
                    <h3 style="text-transform: capitalize; border-bottom: 2px solid #eee; padding-bottom: 0.5rem;">
                        ${roleName.replace('_', ' ')}
                    </h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; margin-top: 1rem;">
            `;

            for (const [code, scope] of Object.entries(privileges)) {
                if (scope !== 'none') {
                    const scopeLabel = {
                        'T': 'Troop (All)',
                        'D': 'Den/Patrol',
                        'H': 'Household',
                        'S': 'Self Only'
                    }[scope] || scope;
                    
                    const scopeColor = {
                        'T': '#e74c3c', // Red (High)
                        'D': '#e67e22', // Orange
                        'H': '#f1c40f', // Yellow
                        'S': '#2ecc71'  // Green (Low)
                    }[scope] || '#95a5a6';

                    html += `
                        <div style="background: #f8f9fa; padding: 0.5rem; border-radius: 4px; border-left: 3px solid ${scopeColor};">
                            <div style="font-weight: bold; font-size: 0.85rem;">${code}</div>
                            <div style="font-size: 0.8rem; color: #666;">Scope: ${scopeLabel}</div>
                        </div>
                    `;
                }
            }

            html += `
                    </div>
                </div>
            `;
        }

        list.innerHTML = html;
        showAlert('rolesAlert', 'Role definitions loaded', 'success', 2000);
    } catch (error) {
        console.error('Error loading roles:', error);
        list.innerHTML = '<div class="alert error">Failed to load roles</div>';
    }
}

/**
 * Show Create Member Form
 */
function showCreateMemberForm() {
    document.getElementById('memberFormTitle').textContent = 'Create New Member';
    document.getElementById('editMemberId').value = '';
    document.getElementById('memberEmail').value = '';
    document.getElementById('memberEmail').disabled = false;
    document.getElementById('memberFirstName').value = '';
    document.getElementById('memberLastName').value = '';
    document.getElementById('memberRole').value = 'member';
    document.getElementById('memberPassword').value = '';
    document.getElementById('memberPassword').placeholder = 'New Password';
    document.getElementById('passwordHelp').style.display = 'none';
    document.getElementById('memberActiveGroup').style.display = 'none';
    
    document.getElementById('createMemberForm').style.display = 'block';
    document.getElementById('membersList').style.display = 'none';
    document.querySelector('#view-members .search-box').style.display = 'none';
}

/**
 * Hide Create Member Form
 */
function hideCreateMemberForm() {
    document.getElementById('createMemberForm').style.display = 'none';
    document.getElementById('membersList').style.display = 'block';
    document.querySelector('#view-members .search-box').style.display = 'flex';
}

/**
 * Edit Member
 */
function editMember(member) {
    document.getElementById('memberFormTitle').textContent = 'Edit Member';
    document.getElementById('editMemberId').value = member.id;
    document.getElementById('memberEmail').value = member.email;
    document.getElementById('memberEmail').disabled = false; // Allow email change? Yes usually
    document.getElementById('memberFirstName').value = member.firstName;
    document.getElementById('memberLastName').value = member.lastName;
    document.getElementById('memberRole').value = member.role;
    
    document.getElementById('memberPassword').value = '';
    document.getElementById('memberPassword').placeholder = '(Unchanged)';
    document.getElementById('passwordHelp').style.display = 'block';
    
    document.getElementById('memberActive').checked = member.isActive;
    document.getElementById('memberActiveGroup').style.display = 'block';
    
    document.getElementById('createMemberForm').style.display = 'block';
    document.getElementById('membersList').style.display = 'none';
    document.querySelector('#view-members .search-box').style.display = 'none';
}

/**
 * Submit Member (Create or Update)
 */
async function submitMember() {
    const id = document.getElementById('editMemberId').value;
    const email = document.getElementById('memberEmail').value.trim();
    const firstName = document.getElementById('memberFirstName').value.trim();
    const lastName = document.getElementById('memberLastName').value.trim();
    const role = document.getElementById('memberRole').value;
    const password = document.getElementById('memberPassword').value;
    const isActive = document.getElementById('memberActive').checked;

    if (!email || !firstName || !lastName) {
        showAlert('membersAlert', 'Email and Name are required', 'error');
        return;
    }

    if (!id && !password) {
        showAlert('membersAlert', 'Password is required for new users', 'error');
        return;
    }

    const payload = {
        email,
        firstName,
        lastName,
        role,
        isActive,
        password: password || undefined // Only send if changed
    };

    try {
        let response;
        if (id) {
            response = await fetch(`/api/system/members/${id}`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } else {
            response = await fetch('/api/system/members', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Operation failed');
        }

        showAlert('membersAlert', id ? 'Member updated' : 'Member created', 'success');
        hideCreateMemberForm();
        loadMembers();
    } catch (error) {
        console.error('Error saving member:', error);
        showAlert('membersAlert', error.message, 'error');
    }
}

/**
 * Delete (Deactivate) Member
 */
async function deleteMember(id, email) {
    if (!confirm(`Are you sure you want to deactivate user "${email}"?`)) {
        return;
    }

    try {
        const response = await fetch(`/api/system/members/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to deactivate member');
        }

        showAlert('membersAlert', 'Member deactivated successfully', 'success');
        loadMembers();
    } catch (error) {
        console.error('Error deactivating member:', error);
        showAlert('membersAlert', error.message, 'error');
    }
}

// ============================================================================
// Audit Log
// ============================================================================

/**
 * Load audit log
 */
async function loadAuditLog() {
    try {
        const response = await fetch('/api/audit-log?limit=50', {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to load audit log');
        }

        const data = await response.json();
        displayAuditLog(data.events || []);
    } catch (error) {
        console.error('Error loading audit log:', error);
        showAlert('auditAlert', 'Failed to load audit log: ' + error.message, 'error');
    }
}

/**
 * Search audit log
 */
async function searchAuditLog() {
    const query = document.getElementById('auditSearch').value.trim();
    if (!query) {
        loadAuditLog();
        return;
    }

    try {
        const response = await fetch(`/api/audit-log?search=${encodeURIComponent(query)}&limit=50`, {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Search failed');
        }

        const data = await response.json();
        displayAuditLog(data.events || []);
    } catch (error) {
        console.error('Error searching audit log:', error);
        showAlert('auditAlert', 'Search failed: ' + error.message, 'error');
    }
}

/**
 * Display audit log entries
 */
function displayAuditLog(events) {
    const auditLogList = document.getElementById('auditLogList');

    if (!events || events.length === 0) {
        auditLogList.innerHTML = '<div class="no-data">No audit log entries found</div>';
        return;
    }

    let html = `
        <table class="admin-table">
            <thead>
                <tr>
                    <th>Timestamp</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Resource</th>
                    <th>Details</th>
                </tr>
            </thead>
            <tbody>
    `;

    for (const event of events) {
        const timestamp = new Date(event.timestamp).toLocaleString();
        const details = event.details ? JSON.stringify(event.details).substring(0, 100) : 'N/A';
        const userDisplay = event.userName 
            ? `<span title="${escapeHtml(event.userEmail)} (${escapeHtml(event.userId)})">${escapeHtml(event.userName)}</span>` 
            : `<span title="Unknown User">${escapeHtml(event.userId)}</span>`;

        html += `
            <tr>
                <td>${timestamp}</td>
                <td>${userDisplay}</td>
                <td><strong>${escapeHtml(event.action)}</strong></td>
                <td>${escapeHtml(event.resourceType || 'N/A')}</td>
                <td style="font-size: 0.9rem; color: #666;">${escapeHtml(details)}</td>
            </tr>
        `;
    }

    html += '</tbody></table>';
    auditLogList.innerHTML = html;
    showAlert('auditAlert', `Showing ${events.length} event(s)`, 'success', 2000);
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Display alert message
 */
function showAlert(elementId, message, type = 'success', duration = 0) {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.className = `alert ${type}`;
    element.textContent = message;
    element.style.display = 'block';

    if (duration > 0) {
        setTimeout(() => {
            element.style.display = 'none';
        }, duration);
    }
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================================
// Logout
// ============================================================================

/**
 * Logout user
 */
async function logout() {
    try {
        const response = await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
            window.location.href = '/login.html';
        }
    } catch (error) {
        console.error('Logout failed:', error);
        window.location.href = '/login.html';
    }
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize admin panel
 */
// ============================================================================
// System Settings & Monitoring
// ============================================================================

/**
 * Load system settings
 */
async function loadSettings() {
    try {
        const response = await fetch('/api/system/settings');
        const data = await response.json();
        
        if (data.settings) {
            for (const [key, value] of Object.entries(data.settings)) {
                const input = document.getElementById('setting_' + key);
                if (input) {
                    if (input.type === 'checkbox') {
                        input.checked = value === 'true' || value === true;
                    } else if (typeof value === 'object') {
                        input.value = JSON.stringify(value);
                    } else {
                        input.value = value;
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error loading settings:', error);
        showAlert('settingsAlert', 'Failed to load settings', 'error');
    }
}

/**
 * Save system settings
 */
async function saveSettings() {
    const settings = {};
    const inputs = document.querySelectorAll('[id^="setting_"]');
    
    inputs.forEach(input => {
        const key = input.id.replace('setting_', '');
        if (input.type === 'checkbox') {
            settings[key] = input.checked;
        } else {
            settings[key] = input.value;
        }
    });

    try {
        const response = await fetch('/api/system/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settings })
        });
        
        if (response.ok) {
            showAlert('settingsAlert', 'Settings saved successfully', 'success');
        } else {
            throw new Error('Save failed');
        }
    } catch (error) {
        console.error('Error saving settings:', error);
        showAlert('settingsAlert', 'Failed to save settings', 'error');
    }
}

/**
 * Load active sessions
 */
async function loadSessions() {
    const list = document.getElementById('sessionsList');
    list.innerHTML = '<div class="loading">Loading sessions...</div>';
    
    try {
        const response = await fetch('/api/system/sessions');
        const data = await response.json();
        
        if (!data.sessions || data.sessions.length === 0) {
            list.innerHTML = '<div class="no-data">No active sessions found</div>';
            return;
        }
        
        let html = '<table class="admin-table"><thead><tr><th>User</th><th>Session ID</th><th>Actions</th></tr></thead><tbody>';
        
        data.sessions.forEach(sess => {
            html += `
                <tr>
                    <td>${sess.userEmail || 'Guest'}</td>
                    <td><small>${sess.id.substring(0, 8)}...</small></td>
                    <td>
                        <button class="action-btn delete" onclick="revokeSession('${sess.id}')">Revoke</button>
                    </td>
                </tr>
            `;
        });
        html += '</tbody></table>';
        list.innerHTML = html;
    } catch (error) {
        console.error('Error loading sessions:', error);
        list.innerHTML = '<div class="alert error">Failed to load sessions</div>';
    }
}

/**
 * Revoke session
 */
async function revokeSession(id) {
    if (!confirm('Are you sure you want to revoke this session? User will be logged out.')) return;
    
    try {
        const response = await fetch(`/api/system/sessions/${id}`, { method: 'DELETE' });
        if (response.ok) {
            loadSessions();
            showAlert('settingsAlert', 'Session revoked', 'success');
        } else {
            throw new Error('Revoke failed');
        }
    } catch (error) {
        console.error('Error revoking session:', error);
        showAlert('settingsAlert', 'Failed to revoke session', 'error');
    }
}

/**
 * Load system stats
 */
async function loadSystemStats() {
    const container = document.getElementById('systemStatsDetails');
    try {
        const response = await fetch('/api/system/stats');
        const stats = await response.json();
        
        let html = '<table class="admin-table">';
        
        // System
        html += `<tr><th colspan="2" style="background:#f0f0f0">Host System</th></tr>`;
        html += `<tr><td>Platform</td><td>${stats.system.platform} (${stats.system.arch})</td></tr>`;
        html += `<tr><td>Uptime</td><td>${(stats.system.uptime / 3600).toFixed(2)} hours</td></tr>`;
        html += `<tr><td>Memory (Free/Total)</td><td>${(stats.system.freeMem / 1024 / 1024).toFixed(0)}MB / ${(stats.system.totalMem / 1024 / 1024).toFixed(0)}MB</td></tr>`;
        html += `<tr><td>Load Avg</td><td>${stats.system.loadAvg.map(n => n.toFixed(2)).join(', ')}</td></tr>`;
        
        // Process
        html += `<tr><th colspan="2" style="background:#f0f0f0">Node Process</th></tr>`;
        html += `<tr><td>Version</td><td>${stats.process.version}</td></tr>`;
        html += `<tr><td>Uptime</td><td>${(stats.process.uptime / 3600).toFixed(2)} hours</td></tr>`;
        html += `<tr><td>Memory Usage (RSS)</td><td>${(stats.process.memory.rss / 1024 / 1024).toFixed(0)}MB</td></tr>`;
        
        // Database
        html += `<tr><th colspan="2" style="background:#f0f0f0">Database (PostgreSQL)</th></tr>`;
        html += `<tr><td>Status</td><td>${stats.database.connected ? '<span style="color:green">Connected</span>' : '<span style="color:red">Disconnected</span>'}</td></tr>`;
        html += `<tr><td>Pool Size</td><td>${stats.database.poolSize}</td></tr>`;
        html += `<tr><td>Idle Clients</td><td>${stats.database.idleCount}</td></tr>`;
        
        // Redis
        html += `<tr><th colspan="2" style="background:#f0f0f0">Redis</th></tr>`;
        html += `<tr><td>Status</td><td>${stats.redis.connected ? '<span style="color:green">Connected</span>' : '<span style="color:red">Disconnected</span>'}</td></tr>`;
        
        html += '</table>';
        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading stats:', error);
        container.innerHTML = '<div class="alert error">Failed to load stats</div>';
    }
}

async function initAdminPanel() {
    // Check admin access first
    const hasAccess = await checkAdminAccess();
    if (!hasAccess) {
        return;
    }

    // Setup navigation
    setupNavigation();

    // Setup logout button
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Load initial view
    const lastView = localStorage.getItem('adminLastView') || 'dashboard';
    switchView(lastView);

    if (window.lucide) lucide.createIcons();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initAdminPanel);
