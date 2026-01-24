// Girl Scout Cookie Tracker - JavaScript

// API base URL
const API_BASE_URL = '/api';

// Price per box (can be adjusted)
const PRICE_PER_BOX = 6;

// Boxes per case (standard Girl Scout Cookie case)
const BOXES_PER_CASE = 12;

// Maximum photo file size in bytes (5MB)
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

// Helper function to convert sale quantity to boxes
function convertToBoxes(sale) {
    return sale.unitType === 'case' ? sale.quantity * BOXES_PER_CASE : sale.quantity;
}

// Data arrays
let sales = [];
let donations = [];
let events = [];
let paymentMethods = [];
let profile = null;

// Track which event is being edited (null = adding new)
let editingEventId = null;

// DOM Elements
const saleForm = document.getElementById('saleForm');
const customerNameInput = document.getElementById('customerName');
const saleTypeInput = document.getElementById('saleType');
const customerAddressInput = document.getElementById('customerAddress');
const customerPhoneInput = document.getElementById('customerPhone');
const amountCollectedInput = document.getElementById('amountCollected');
const amountDueInput = document.getElementById('amountDue');
const paymentMethodInput = document.getElementById('paymentMethod');
const salesList = document.getElementById('salesList');
const totalBoxesElement = document.getElementById('totalBoxes');
const individualSalesElement = document.getElementById('individualSales');
const eventSalesElement = document.getElementById('eventSales');
const totalRevenueElement = document.getElementById('totalRevenue');
const cookieBreakdownElement = document.getElementById('cookieBreakdown');
const clearAllButton = document.getElementById('clearAll');

// Cookie selection table elements
const totalBoxesInputEl = document.getElementById('totalBoxesInput');
const totalCasesInputEl = document.getElementById('totalCasesInput');
const orderTotalAmountEl = document.getElementById('orderTotalAmount');

// Profile elements
const photoInput = document.getElementById('photoInput');
const uploadPhotoBtn = document.getElementById('uploadPhotoBtn');
const qrCodeUrlInput = document.getElementById('qrCodeUrl');
const updateQrBtn = document.getElementById('updateQrBtn');

// Payment Method elements
const settingsPaymentMethodsList = document.getElementById('settingsPaymentMethodsList');
const newPaymentNameInput = document.getElementById('newPaymentName');
const newPaymentUrlInput = document.getElementById('newPaymentUrl');
const addPaymentMethodBtn = document.getElementById('addPaymentMethodBtn');

// Profile display elements (for Profile tab)
const profilePhotoDisplay = document.getElementById('profilePhotoDisplay');
const profilePhotoPlaceholderDisplay = document.getElementById('profilePhotoPlaceholderDisplay');
const storeQrImageDisplay = document.getElementById('storeQrImageDisplay');
const storeQrPlaceholder = document.getElementById('storeQrPlaceholder');
const paymentMethodsDisplay = document.getElementById('paymentMethodsDisplay');
const paymentMethodsPlaceholder = document.getElementById('paymentMethodsPlaceholder');

// Goal elements
const goalBoxesInput = document.getElementById('goalBoxes');
const setGoalBtn = document.getElementById('setGoalBtn');
const goalBoxesDisplay = document.getElementById('goalBoxesDisplay');
const goalProgress = document.getElementById('goalProgress');
const goalProgressFill = document.getElementById('goalProgressFill');

// Donation elements
const donationForm = document.getElementById('donationForm');
const donationAmountInput = document.getElementById('donationAmount');
const donorNameInput = document.getElementById('donorName');
const donationsList = document.getElementById('donationsList');
const totalDonationsElement = document.getElementById('totalDonations');

// Event elements
const eventForm = document.getElementById('eventForm');
const eventNameInput = document.getElementById('eventName');
const eventDateInput = document.getElementById('eventDate');
const eventDescriptionInput = document.getElementById('eventDescription');
const initialBoxesInput = document.getElementById('initialBoxes');
const initialCasesInput = document.getElementById('initialCases');
const remainingBoxesInput = document.getElementById('remainingBoxes');
const remainingCasesInput = document.getElementById('remainingCases');
const eventDonationsInput = document.getElementById('eventDonations');
const eventsList = document.getElementById('eventsList');

// Initialize app
async function init() {
    await Promise.all([loadSales(), loadDonations(), loadEvents(), loadProfile(), loadPaymentMethods()]);
    renderSales();
    renderDonations();
    renderEvents();
    renderPaymentMethodsSettings();
    updateSummary();
    updateBreakdown();
    updateGoalDisplay();
    setupEventListeners();
}

// Setup event listeners
function setupEventListeners() {
    saleForm.addEventListener('submit', handleAddSale);
    if (clearAllButton) {
        clearAllButton.addEventListener('click', handleClearAll);
    }

    // Profile listeners
    uploadPhotoBtn.addEventListener('click', () => photoInput.click());
    photoInput.addEventListener('change', handlePhotoUpload);
    updateQrBtn.addEventListener('click', handleUpdateQrCode);
    
    // Payment Method listeners
    if (addPaymentMethodBtn) {
        addPaymentMethodBtn.addEventListener('click', handleAddPaymentMethod);
    }

    // Goal listeners
    setGoalBtn.addEventListener('click', handleSetGoal);

    // Donation listeners
    donationForm.addEventListener('submit', handleAddDonation);

    // Event listeners
    eventForm.addEventListener('submit', handleAddEvent);
}

// Load sales from API
async function loadSales() {
    try {
        const response = await fetch(`${API_BASE_URL}/sales`);
        if (!response.ok) {
            throw new Error('Failed to fetch sales');
        }
        sales = await response.json();
    } catch (error) {
        console.error('Error loading sales:', error);
        alert('Error loading sales data. Please refresh the page.');
        sales = [];
    }
}

// Load donations from API
async function loadDonations() {
    try {
        const response = await fetch(`${API_BASE_URL}/donations`);
        if (!response.ok) {
            throw new Error('Failed to fetch donations');
        }
        donations = await response.json();
    } catch (error) {
        console.error('Error loading donations:', error);
        donations = [];
    }
}

// Load events from API
async function loadEvents() {
    try {
        const response = await fetch(`${API_BASE_URL}/events`);
        if (!response.ok) {
            throw new Error('Failed to fetch events');
        }
        events = await response.json();
    } catch (error) {
        console.error('Error loading events:', error);
        events = [];
    }
}

// Load profile from API
async function loadProfile() {
    try {
        const response = await fetch(`${API_BASE_URL}/profile`);
        if (!response.ok) {
            throw new Error('Failed to fetch profile');
        }
        profile = await response.json();

        // Update Settings page UI with profile data
        if (profile.qrCodeUrl) {
            qrCodeUrlInput.value = profile.qrCodeUrl;
        }

        if (profile.goalBoxes) {
            goalBoxesInput.value = profile.goalBoxes;
        }

        // Update Profile tab display elements
        updateProfileDisplay();
    } catch (error) {
        console.error('Error loading profile:', error);
        profile = { id: 1, photoData: null, qrCodeUrl: null, paymentQrCodeUrl: null, goalBoxes: 0, goalAmount: 0 };
    }
}

// Update Profile tab display
function updateProfileDisplay() {
    // Update profile photo display
    if (profile && profile.photoData && profilePhotoDisplay) {
        profilePhotoDisplay.src = profile.photoData;
        profilePhotoDisplay.style.display = 'block';
        if (profilePhotoPlaceholderDisplay) {
            profilePhotoPlaceholderDisplay.style.display = 'none';
        }
    } else if (profilePhotoDisplay) {
        profilePhotoDisplay.style.display = 'none';
        if (profilePhotoPlaceholderDisplay) {
            profilePhotoPlaceholderDisplay.style.display = 'flex';
        }
    }

    // Update store QR display
    if (profile && profile.qrCodeUrl && storeQrImageDisplay) {
        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(profile.qrCodeUrl)}`;
        storeQrImageDisplay.src = qrApiUrl;
        storeQrImageDisplay.style.display = 'block';
        if (storeQrPlaceholder) {
            storeQrPlaceholder.style.display = 'none';
        }
    } else if (storeQrImageDisplay) {
        storeQrImageDisplay.style.display = 'none';
        if (storeQrPlaceholder) {
            storeQrPlaceholder.style.display = 'block';
        }
    }

    // Update payment methods display
    renderPaymentMethodsProfile();

    // Update inventory display
    updateInventoryDisplay();
}

// Update inventory display from profile data
function updateInventoryDisplay() {
    if (!profile) return;
    
    const inventoryFields = [
        'ThinMints', 'Samoas', 'Tagalongs', 'Trefoils', 
        'DosiDos', 'LemonUps', 'Adventurefuls', 'Exploremores', 'Toffeetastic'
    ];
    
    inventoryFields.forEach(field => {
        const input = document.getElementById(`inventory${field}`);
        if (input) {
            const value = profile[`inventory${field}`] || 0;
            input.value = value;
        }
    });
}

// Increment inventory
function incrementInventory(cookieType) {
    const input = document.getElementById(`inventory${cookieType}`);
    if (input) {
        input.value = parseInt(input.value || 0) + 1;
        saveInventory();
    }
}

// Decrement inventory
function decrementInventory(cookieType) {
    const input = document.getElementById(`inventory${cookieType}`);
    if (input) {
        const currentValue = parseInt(input.value || 0);
        if (currentValue > 0) {
            input.value = currentValue - 1;
            saveInventory();
        }
    }
}

// Increment sale quantity
function incrementSaleQty(cookieName, unit) {
    const inputs = document.querySelectorAll(`.qty-input[data-cookie="${cookieName}"][data-unit="${unit}"]`);
    inputs.forEach(input => {
        input.value = parseInt(input.value || 0) + 1;
        // Trigger change event to update totals
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

// Decrement sale quantity
function decrementSaleQty(cookieName, unit) {
    const inputs = document.querySelectorAll(`.qty-input[data-cookie="${cookieName}"][data-unit="${unit}"]`);
    inputs.forEach(input => {
        const currentValue = parseInt(input.value || 0);
        if (currentValue > 0) {
            input.value = currentValue - 1;
            // Trigger change event to update totals
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
    });
}

// Save inventory to profile
async function saveInventory() {
    try {
        const inventoryFields = [
            'ThinMints', 'Samoas', 'Tagalongs', 'Trefoils', 
            'DosiDos', 'LemonUps', 'Adventurefuls', 'Exploremores', 'Toffeetastic'
        ];
        
        const inventoryData = inventoryFields.reduce((data, field) => {
            const input = document.getElementById(`inventory${field}`);
            const value = parseInt(input.value, 10);
            data[`inventory${field}`] = (isNaN(value) || value < 0) ? 0 : value;
            return data;
        }, {});

        const response = await fetch(`${API_BASE_URL}/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(inventoryData)
        });

        if (!response.ok) {
            throw new Error('Failed to save inventory');
        }

        profile = await response.json();
    } catch (error) {
        console.error('Error saving inventory:', error);
        alert('Failed to save inventory');
    }
}

// Render payment methods in Profile tab
function renderPaymentMethodsProfile() {
    if (!paymentMethodsDisplay) return;

    if (paymentMethods.length === 0) {
        paymentMethodsDisplay.innerHTML = '';
        if (paymentMethodsPlaceholder) {
            paymentMethodsPlaceholder.style.display = 'block';
        }
        return;
    }

    if (paymentMethodsPlaceholder) {
        paymentMethodsPlaceholder.style.display = 'none';
    }

    paymentMethodsDisplay.innerHTML = paymentMethods.map(method => {
        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(method.url)}`;
        return `
            <div class="qr-display-container">
                <h4 class="qr-method-title">${method.name}</h4>
                <img src="${qrApiUrl}" alt="${method.name} QR Code">
            </div>
        `;
    }).join('');
}

// Handle photo upload
async function handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check file size
    if (file.size > MAX_PHOTO_SIZE) {
        alert(`Photo size must be less than ${MAX_PHOTO_SIZE / (1024 * 1024)}MB`);
        return;
    }
    
    const reader = new FileReader();
    reader.onload = async (event) => {
        const photoData = event.target.result;
        
        try {
            const response = await fetch(`${API_BASE_URL}/profile`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ photoData })
            });
            
            if (!response.ok) {
                throw new Error('Failed to upload photo');
            }
            
            await loadProfile();
            showFeedback('Profile photo updated!');
        } catch (error) {
            console.error('Error uploading photo:', error);
            alert('Error uploading photo. Please try again.');
        }
    };
    reader.readAsDataURL(file);
}

// Handle QR code update
async function handleUpdateQrCode() {
    const qrCodeUrl = qrCodeUrlInput.value.trim();
    
    if (!qrCodeUrl) {
        alert('Please enter a QR code URL');
        return;
    }
    
    // Validate URL format
    try {
        const urlObj = new URL(qrCodeUrl);
        if (urlObj.protocol !== 'https:' && urlObj.protocol !== 'http:') {
            alert('Please enter a valid HTTP or HTTPS URL');
            return;
        }
    } catch (error) {
        alert('Please enter a valid URL');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ qrCodeUrl })
        });
        
        if (!response.ok) {
            throw new Error('Failed to update QR code');
        }
        
        await loadProfile();
        showFeedback('QR code updated!');
    } catch (error) {
        console.error('Error updating QR code:', error);
        alert('Error updating QR code. Please try again.');
    }
}

// Load payment methods
async function loadPaymentMethods() {
    try {
        const response = await fetch(`${API_BASE_URL}/payment-methods`);
        if (!response.ok) {
            throw new Error('Failed to fetch payment methods');
        }
        paymentMethods = await response.json();
        // Update profile display whenever methods change
        updateProfileDisplay();
    } catch (error) {
        console.error('Error loading payment methods:', error);
        paymentMethods = [];
    }
}

// Handle add payment method
async function handleAddPaymentMethod() {
    const name = newPaymentNameInput.value.trim();
    const url = newPaymentUrlInput.value.trim();
    
    if (!name || !url) {
        alert('Please enter both a name and a URL');
        return;
    }
    
    try {
        // Validate URL
        new URL(url);
    } catch {
        alert('Please enter a valid URL (starting with http:// or https://)');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/payment-methods`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, url })
        });
        
        if (!response.ok) {
            throw new Error('Failed to add payment method');
        }
        
        // Clear inputs
        newPaymentNameInput.value = '';
        newPaymentUrlInput.value = '';
        
        await loadPaymentMethods();
        renderPaymentMethodsSettings();
        showFeedback('Payment method added!');
    } catch (error) {
        console.error('Error adding payment method:', error);
        alert('Error adding payment method');
    }
}

// Handle delete payment method
async function handleDeletePaymentMethod(id) {
    if (!confirm('Delete this payment method?')) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/payment-methods/${id}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete payment method');
        }
        
        await loadPaymentMethods();
        renderPaymentMethodsSettings();
        showFeedback('Payment method deleted');
    } catch (error) {
        console.error('Error deleting payment method:', error);
        alert('Error deleting payment method');
    }
}

// Render payment methods in Settings
function renderPaymentMethodsSettings() {
    if (!settingsPaymentMethodsList) return;
    
    if (paymentMethods.length === 0) {
        settingsPaymentMethodsList.innerHTML = '<p class="empty-message">No payment methods added yet.</p>';
        return;
    }
    
    settingsPaymentMethodsList.innerHTML = paymentMethods.map(method => `
        <div class="payment-method-item">
            <div class="payment-method-info">
                <strong>${method.name}</strong>
                <div class="payment-method-url">${method.url}</div>
            </div>
            <button class="btn-delete-small" onclick="handleDeletePaymentMethod(${method.id})">Remove</button>
        </div>
    `).join('');
}

// Handle set goal
async function handleSetGoal() {
    const goalBoxes = parseInt(goalBoxesInput.value) || 0;
    const goalAmount = goalBoxes * PRICE_PER_BOX;
    
    try {
        const response = await fetch(`${API_BASE_URL}/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ goalBoxes, goalAmount })
        });
        
        if (!response.ok) {
            throw new Error('Failed to set goal');
        }
        
        await loadProfile();
        updateGoalDisplay();
        showFeedback('Goal updated!');
    } catch (error) {
        console.error('Error setting goal:', error);
        alert('Error setting goal. Please try again.');
    }
}

// Update goal display
function updateGoalDisplay() {
    if (!profile) return;
    
    const goalBoxes = profile.goalBoxes || 0;
    const goalAmount = profile.goalAmount || 0;
    
    // Calculate total boxes (sales + donations)
    const salesBoxes = sales.reduce((sum, sale) => sum + convertToBoxes(sale), 0);
    const donationBoxes = donations.reduce((sum, donation) => sum + (donation.boxCount || 0), 0);
    const totalBoxes = salesBoxes + donationBoxes;
    
    goalBoxesDisplay.textContent = `${goalBoxes} boxes ($${goalAmount})`;
    
    if (goalBoxes > 0) {
        const progress = Math.min((totalBoxes / goalBoxes) * 100, 100);
        goalProgress.textContent = `${progress.toFixed(1)}%`;
        goalProgressFill.style.width = `${progress}%`;
    } else {
        goalProgress.textContent = '0%';
        goalProgressFill.style.width = '0%';
    }
}

// Handle add sale form submission
async function handleAddSale(e) {
    e.preventDefault();

    const customerName = customerNameInput.value.trim() || 'Walk-in Customer';
    const saleType = saleTypeInput.value;
    const customerAddress = customerAddressInput.value.trim();
    const customerPhone = customerPhoneInput.value.trim();
    const amountCollected = parseFloat(amountCollectedInput.value) || 0;
    const amountDue = parseFloat(amountDueInput.value) || 0;
    const paymentMethod = paymentMethodInput.value;

    // Collect all cookie quantities from the table
    const qtyInputs = document.querySelectorAll('.qty-input');
    const cookieEntries = [];

    qtyInputs.forEach(input => {
        const qty = parseInt(input.value) || 0;
        if (qty > 0) {
            cookieEntries.push({
                cookieType: input.dataset.cookie,
                quantity: qty,
                unitType: input.dataset.unit
            });
        }
    });

    if (cookieEntries.length === 0) {
        alert('Please enter at least one cookie quantity.');
        return;
    }

    // Generate a unique order number for this batch
    const orderNumber = `MAN-${Date.now()}`;
    const saleDate = new Date().toISOString();

    try {
        // Create a sale record for each cookie entry
        const salePromises = cookieEntries.map(entry => {
            const sale = {
                cookieType: entry.cookieType,
                quantity: entry.quantity,
                customerName,
                saleType,
                customerAddress,
                customerPhone,
                unitType: entry.unitType,
                amountCollected: 0, // Will set on first entry only
                amountDue: 0,
                paymentMethod,
                orderNumber,
                orderType: 'Manual',
                date: saleDate
            };
            return sale;
        });

        // Set payment info on first entry only (to avoid duplicate counting)
        if (salePromises.length > 0) {
            salePromises[0].amountCollected = amountCollected;
            salePromises[0].amountDue = amountDue;
        }

        // Submit all sales
        for (const sale of salePromises) {
            const response = await fetch(`${API_BASE_URL}/sales`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(sale)
            });

            if (!response.ok) {
                throw new Error('Failed to add sale');
            }
        }

        await loadSales();
        renderSales();
        updateSummary();
        updateBreakdown();
        updateGoalDisplay();

        // Reset form
        saleForm.reset();
        resetCookieTable();

        // Show feedback
        showFeedback(`Order added with ${cookieEntries.length} cookie type(s)!`);
    } catch (error) {
        console.error('Error adding sale:', error);
        alert('Error adding sale. Please try again.');
    }
}

// Reset cookie selection table
function resetCookieTable() {
    const qtyInputs = document.querySelectorAll('.qty-input');
    qtyInputs.forEach(input => {
        input.value = '';
    });
    updateCookieTableTotals();
}

// Update cookie table totals
function updateCookieTableTotals() {
    const qtyInputs = document.querySelectorAll('.qty-input');
    let totalBoxes = 0;
    let totalCases = 0;

    qtyInputs.forEach(input => {
        const qty = parseInt(input.value) || 0;
        if (input.dataset.unit === 'box') {
            totalBoxes += qty;
        } else if (input.dataset.unit === 'case') {
            totalCases += qty;
        }
    });

    // Calculate total boxes (including cases converted)
    const totalBoxesAll = totalBoxes + (totalCases * BOXES_PER_CASE);
    const totalAmount = totalBoxesAll * PRICE_PER_BOX;

    if (totalBoxesInputEl) totalBoxesInputEl.textContent = totalBoxes;
    if (totalCasesInputEl) totalCasesInputEl.textContent = totalCases;
    if (orderTotalAmountEl) orderTotalAmountEl.textContent = `$${totalAmount.toFixed(2)}`;
}

// Setup cookie table event listeners
function setupCookieTableListeners() {
    const qtyInputs = document.querySelectorAll('.qty-input');
    qtyInputs.forEach(input => {
        input.addEventListener('input', updateCookieTableTotals);
        input.addEventListener('change', updateCookieTableTotals);
    });
}

// Handle delete sale
async function handleDeleteSale(id) {
    if (confirm('Are you sure you want to delete this sale?')) {
        try {
            const response = await fetch(`${API_BASE_URL}/sales/${id}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete sale');
            }
            
            await loadSales();
            renderSales();
            updateSummary();
            updateBreakdown();
            updateGoalDisplay();
            showFeedback('Sale deleted.');
        } catch (error) {
            console.error('Error deleting sale:', error);
            alert('Error deleting sale. Please try again.');
        }
    }
}

// Handle clear all sales
async function handleClearAll() {
    if (sales.length === 0) {
        alert('No sales to clear.');
        return;
    }
    
    if (confirm('Are you sure you want to clear all sales? This cannot be undone.')) {
        try {
            const response = await fetch(`${API_BASE_URL}/sales`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error('Failed to clear sales');
            }
            
            await loadSales();
            renderSales();
            updateSummary();
            updateBreakdown();
            updateGoalDisplay();
            showFeedback('All sales cleared.');
        } catch (error) {
            console.error('Error clearing sales:', error);
            alert('Error clearing sales. Please try again.');
        }
    }
}

// Handle add donation
async function handleAddDonation(e) {
    e.preventDefault();
    
    const amount = parseFloat(donationAmountInput.value);
    const donorName = donorNameInput.value.trim();
    
    if (!amount || amount <= 0) {
        alert('Please enter a valid donation amount.');
        return;
    }
    
    const donation = {
        amount,
        donorName,
        date: new Date().toISOString()
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}/donations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(donation)
        });
        
        if (!response.ok) {
            throw new Error('Failed to add donation');
        }
        
        await loadDonations();
        renderDonations();
        updateSummary();
        
        // Reset form
        donationForm.reset();
        
        showFeedback('Donation added successfully!');
    } catch (error) {
        console.error('Error adding donation:', error);
        alert('Error adding donation. Please try again.');
    }
}

// Handle delete donation
async function handleDeleteDonation(id) {
    if (confirm('Are you sure you want to delete this donation?')) {
        try {
            const response = await fetch(`${API_BASE_URL}/donations/${id}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete donation');
            }
            
            await loadDonations();
            renderDonations();
            updateSummary();
            showFeedback('Donation deleted.');
        } catch (error) {
            console.error('Error deleting donation:', error);
            alert('Error deleting donation. Please try again.');
        }
    }
}

// Handle add/edit event
async function handleAddEvent(e) {
    e.preventDefault();
    
    const eventName = eventNameInput.value.trim();
    const eventDate = eventDateInput.value;
    const description = eventDescriptionInput.value.trim();
    const initialBoxes = parseInt(initialBoxesInput.value) || 0;
    const initialCases = parseInt(initialCasesInput.value) || 0;
    const remainingBoxes = parseInt(remainingBoxesInput.value) || 0;
    const remainingCases = parseInt(remainingCasesInput.value) || 0;
    const donationsReceived = parseFloat(eventDonationsInput.value) || 0;
    
    if (!eventName || !eventDate) {
        alert('Please enter event name and date.');
        return;
    }
    
    const event = {
        eventName,
        eventDate: new Date(eventDate).toISOString(),
        description,
        initialBoxes,
        initialCases,
        remainingBoxes,
        remainingCases,
        donationsReceived
    };
    
    try {
        let response;
        if (editingEventId) {
            // Update existing event
            response = await fetch(`${API_BASE_URL}/events/${editingEventId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(event)
            });
        } else {
            // Create new event
            response = await fetch(`${API_BASE_URL}/events`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(event)
            });
        }
        
        if (!response.ok) {
            throw new Error(editingEventId ? 'Failed to update event' : 'Failed to add event');
        }
        
        await loadEvents();
        renderEvents();
        updateSummary();
        
        // Reset form and editing state
        resetEventForm();
        
        showFeedback(editingEventId ? 'Event updated successfully!' : 'Event saved successfully!');
    } catch (error) {
        console.error('Error saving event:', error);
        alert('Error saving event. Please try again.');
    }
}

function resetEventForm() {
    eventForm.reset();
    editingEventId = null;
    const submitBtn = eventForm.querySelector('button[type="submit"]');
    submitBtn.textContent = 'Save Event';
    
    // Remove cancel button if it exists
    const cancelBtn = document.getElementById('cancelEditEventBtn');
    if (cancelBtn) {
        cancelBtn.remove();
    }
}

function handleEditEvent(id) {
    const event = events.find(e => e.id == id);
    if (!event) return;
    
    editingEventId = id;
    
    // Populate form
    eventNameInput.value = event.eventName;
    // Format date for datetime-local input (YYYY-MM-DDThh:mm)
    const date = new Date(event.eventDate);
    // Adjust for local timezone offset to ensure correct display
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date - tzOffset)).toISOString().slice(0, 16);
    eventDateInput.value = localISOTime;
    
    eventDescriptionInput.value = event.description || '';
    initialBoxesInput.value = event.initialBoxes;
    initialCasesInput.value = event.initialCases;
    remainingBoxesInput.value = event.remainingBoxes;
    remainingCasesInput.value = event.remainingCases;
    eventDonationsInput.value = event.donationsReceived;
    
    // Change submit button text
    const submitBtn = eventForm.querySelector('button[type="submit"]');
    submitBtn.textContent = 'Update Event';
    
    // Add cancel button if not exists
    if (!document.getElementById('cancelEditEventBtn')) {
        const cancelBtn = document.createElement('button');
        cancelBtn.id = 'cancelEditEventBtn';
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn btn-secondary';
        cancelBtn.style.marginLeft = '10px';
        cancelBtn.textContent = 'Cancel Edit';
        cancelBtn.addEventListener('click', resetEventForm);
        submitBtn.parentNode.insertBefore(cancelBtn, submitBtn.nextSibling);
    }
    
    // Scroll to form
    eventForm.scrollIntoView({ behavior: 'smooth' });
}

// Handle delete event
async function handleDeleteEvent(id) {
    if (confirm('Are you sure you want to delete this event?')) {
        try {
            const response = await fetch(`${API_BASE_URL}/events/${id}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete event');
            }
            
            await loadEvents();
            renderEvents();
            updateSummary();
            showFeedback('Event deleted.');
        } catch (error) {
            console.error('Error deleting event:', error);
            alert('Error deleting event. Please try again.');
        }
    }
}

// Render events list
function renderEvents() {
    if (events.length === 0) {
        eventsList.innerHTML = '<p class="empty-message">No events recorded yet.</p>';
        return;
    }
    
    eventsList.innerHTML = events.map(event => {
        const date = new Date(event.eventDate);
        const formattedDate = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Calculate total initial and remaining inventory in boxes
        const totalInitial = event.initialBoxes + (event.initialCases * BOXES_PER_CASE);
        const totalRemaining = event.remainingBoxes + (event.remainingCases * BOXES_PER_CASE);
        const totalSold = Math.max(0, totalInitial - totalRemaining); // Prevent negative values
        const revenue = totalSold * PRICE_PER_BOX;
        
        return `
            <div class="event-item">
                <div class="event-header">
                    <div class="event-name">${event.eventName}</div>
                    <div class="event-date">${formattedDate}</div>
                </div>
                ${event.description ? `<div class="event-description">${event.description}</div>` : ''}
                <div class="event-stats">
                    <div class="event-stat">
                        <span class="stat-label">Initial:</span>
                        <span class="stat-value">${totalInitial} boxes (${event.initialCases} cases, ${event.initialBoxes} boxes)</span>
                    </div>
                    <div class="event-stat">
                        <span class="stat-label">Remaining:</span>
                        <span class="stat-value">${totalRemaining} boxes (${event.remainingCases} cases, ${event.remainingBoxes} boxes)</span>
                    </div>
                    <div class="event-stat highlight">
                        <span class="stat-label">Total Sold:</span>
                        <span class="stat-value">${totalSold} boxes ($${revenue})</span>
                    </div>
                    ${event.donationsReceived > 0 ? `
                    <div class="event-stat">
                        <span class="stat-label">Donations:</span>
                        <span class="stat-value">$${event.donationsReceived.toFixed(2)}</span>
                    </div>
                    ` : ''}
                </div>
                <div class="event-actions">
                    <button class="btn-secondary btn-edit" data-event-id="${event.id}" style="margin-right: 8px;">Edit</button>
                    <button class="btn-delete" data-event-id="${event.id}">Delete</button>
                </div>
            </div>
        `;
    }).join('');
    
    // Add event listeners for edit buttons
    document.querySelectorAll('.events-list .btn-edit').forEach(button => {
        button.addEventListener('click', () => {
            const eventId = button.getAttribute('data-event-id');
            handleEditEvent(eventId);
        });
    });
    
    // Add event listeners for delete buttons
    document.querySelectorAll('.events-list .btn-delete').forEach(button => {
        button.addEventListener('click', () => {
            const eventId = button.getAttribute('data-event-id');
            handleDeleteEvent(eventId);
        });
    });
}

// Helper to generate a unique key for grouping sales into an order
function getOrderKey(sale) {
    // Use orderNumber if available, otherwise group by customer name + date
    if (sale.orderNumber) {
        return `order_${sale.orderNumber}`;
    }
    // Fallback: group by customer name and date (same day)
    const dateStr = new Date(sale.date).toISOString().split('T')[0];
    return `manual_${sale.customerName}_${dateStr}`;
}

// Render sales list grouped by customer/order
function renderSales() {
    // Filter to individual sales only
    const individualSales = sales.filter(s => s.saleType === 'individual');

    if (individualSales.length === 0) {
        salesList.innerHTML = '<p class="empty-message">No sales recorded yet. Add your first sale above!</p>';
        return;
    }

    // Group sales by order
    const orders = {};
    individualSales.forEach(sale => {
        const key = getOrderKey(sale);
        if (!orders[key]) {
            orders[key] = {
                key: key,
                customerName: sale.customerName || 'Walk-in Customer',
                date: sale.date,
                orderType: sale.orderType || 'Manual',
                orderStatus: sale.orderStatus || 'Pending',
                items: [],
                totalBoxes: 0,
                totalDue: 0,
                totalCollected: 0
            };
        }
        orders[key].items.push(sale);
        orders[key].totalBoxes += convertToBoxes(sale);
        orders[key].totalDue += sale.amountDue || 0;
        orders[key].totalCollected += sale.amountCollected || 0;

        // If any item has Shipped status, mark the whole order as shipped
        if (sale.orderType && sale.orderType.toLowerCase().includes('shipped')) {
            orders[key].orderStatus = 'Shipped';
        }
        if (sale.orderStatus === 'Shipped' || sale.orderStatus === 'Delivered') {
            orders[key].orderStatus = sale.orderStatus;
        }
    });

    // Sort orders by date (newest first)
    const sortedOrders = Object.values(orders).sort((a, b) => new Date(b.date) - new Date(a.date));

    // Build table HTML
    let html = `
        <div class="sales-table-container">
            <table class="sales-table">
                <thead>
                    <tr>
                        <th>Customer Name</th>
                        <th>Total Boxes</th>
                        <th>Order Date</th>
                        <th>Order Type</th>
                        <th>Order Complete</th>
                    </tr>
                </thead>
                <tbody>
    `;

    sortedOrders.forEach(order => {
        const date = new Date(order.date);
        const formattedDate = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

        // Check if order is shipped or delivered
        const isShipped = order.orderType && order.orderType.toLowerCase().includes('shipped');
        const isInPerson = order.orderType && order.orderType.toLowerCase().includes('in-person');
        const isComplete = order.orderStatus === 'Shipped' || order.orderStatus === 'Delivered' || isShipped;
        const hasOutstandingPayment = order.totalDue > 0;

        // Determine status class for row coloring
        // Priority: Awaiting Payment (red) > Complete (green) > Shipped (yellow) > In-Person (blue)
        let statusClass = '';
        if (hasOutstandingPayment && !isComplete) {
            statusClass = 'status-awaiting-payment';
        } else if (isComplete) {
            statusClass = 'status-complete';
        } else if (isShipped) {
            statusClass = 'status-shipped';
        } else if (isInPerson) {
            statusClass = 'status-in-person';
        }

        // Determine button text and state
        const buttonText = isComplete ? 'Completed' : 'Mark Complete';
        const buttonClass = isComplete ? 'btn-complete-done' : 'btn-complete';
        const buttonDisabled = isShipped ? 'disabled title="Shipped orders are automatically complete"' : '';

        html += `
            <tr class="${statusClass}" data-order-key="${order.key}">
                <td class="customer-name">
                    <a href="#" onclick="showOrderDetails('${order.key}'); return false;">${order.customerName}</a>
                </td>
                <td>${order.totalBoxes}</td>
                <td>${formattedDate}</td>
                <td>${order.orderType}</td>
                <td>
                    <button class="btn-order-status ${buttonClass}"
                        ${buttonDisabled}
                        onclick="handleOrderComplete('${order.key}', ${!isComplete})">
                        ${buttonText}
                    </button>
                </td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
        <div class="status-legend">
            <span class="legend-item"><span class="legend-color status-complete"></span> Complete</span>
            <span class="legend-item"><span class="legend-color status-shipped"></span> Shipped</span>
            <span class="legend-item"><span class="legend-color status-in-person"></span> In-Person</span>
            <span class="legend-item"><span class="legend-color status-awaiting-payment"></span> Awaiting Payment</span>
        </div>
    `;

    salesList.innerHTML = html;
}

// Show order details when clicking on customer name
function showOrderDetails(orderKey) {
    // Find all sales for this order
    const orderSales = sales.filter(s => getOrderKey(s) === orderKey);

    if (orderSales.length === 0) return;

    const firstSale = orderSales[0];
    const totalBoxes = orderSales.reduce((sum, s) => sum + convertToBoxes(s), 0);

    // Calculate payment totals
    const totalCollected = orderSales.reduce((sum, s) => sum + (s.amountCollected || 0), 0);
    const totalDue = orderSales.reduce((sum, s) => sum + (s.amountDue || 0), 0);
    const orderTotal = totalBoxes * PRICE_PER_BOX;
    const remainingBalance = orderTotal - totalCollected;

    // Group cookies by type
    const cookieBreakdown = {};
    orderSales.forEach(sale => {
        const boxes = convertToBoxes(sale);
        if (cookieBreakdown[sale.cookieType]) {
            cookieBreakdown[sale.cookieType] += boxes;
        } else {
            cookieBreakdown[sale.cookieType] = boxes;
        }
    });

    // Build cookie list HTML
    let cookieListHtml = '';
    Object.entries(cookieBreakdown).forEach(([cookieType, qty]) => {
        cookieListHtml += `<tr><td>${cookieType}</td><td>${qty}</td></tr>`;
    });

    // Show details in a modal-like section
    const detailsHtml = `
        <div class="order-details-overlay" onclick="closeOrderDetails()">
            <div class="order-details-modal" onclick="event.stopPropagation()">
                <div class="order-details-header">
                    <h3>Order Details</h3>
                    <button class="btn-close" onclick="closeOrderDetails()">&times;</button>
                </div>
                <div class="order-details-content">
                    <div class="detail-section">
                        <h4>Customer Information</h4>
                        <p><strong>Name:</strong> ${firstSale.customerName || 'N/A'}</p>
                        <p><strong>Address:</strong> ${firstSale.customerAddress || 'N/A'}</p>
                        <p><strong>Phone:</strong> ${firstSale.customerPhone || 'N/A'}</p>
                        ${firstSale.customerEmail ? `<p><strong>Email:</strong> ${firstSale.customerEmail}</p>` : ''}
                    </div>
                    <div class="detail-section">
                        <h4>Order Information</h4>
                        <p><strong>Order Type:</strong> ${firstSale.orderType || 'Manual'}</p>
                        <p><strong>Status:</strong> ${firstSale.orderStatus || 'Pending'}</p>
                        <p><strong>Payment Method:</strong> ${firstSale.paymentMethod || 'N/A'}</p>
                        ${firstSale.orderNumber ? `<p><strong>Order #:</strong> ${firstSale.orderNumber}</p>` : ''}
                    </div>
                    <div class="detail-section">
                        <h4>Cookies Ordered (${totalBoxes} boxes total)</h4>
                        <table class="cookie-detail-table">
                            <thead>
                                <tr><th>Cookie Type</th><th>Boxes</th></tr>
                            </thead>
                            <tbody>
                                ${cookieListHtml}
                            </tbody>
                        </table>
                    </div>
                    <div class="detail-section">
                        <h4>Payment</h4>
                        <div class="payment-summary">
                            <div class="payment-row">
                                <span>Order Total:</span>
                                <span class="payment-value">$${orderTotal.toFixed(2)}</span>
                            </div>
                            <div class="payment-row">
                                <span>Payment Received:</span>
                                <span class="payment-value payment-received">$${totalCollected.toFixed(2)}</span>
                            </div>
                            <div class="payment-row ${remainingBalance > 0 ? 'payment-due-highlight' : ''}">
                                <span>Balance Due:</span>
                                <span class="payment-value payment-due">$${remainingBalance.toFixed(2)}</span>
                            </div>
                        </div>
                        <div class="additional-payment-section">
                            <label for="additionalPayment">Add Payment Collected:</label>
                            <div class="additional-payment-input">
                                <span class="currency-prefix">$</span>
                                <input type="number" id="additionalPayment" min="0" step="0.01" value="0" placeholder="0.00">
                            </div>
                        </div>
                    </div>
                    <div class="detail-actions">
                        ${isManualOrder(firstSale) ? `<button class="btn btn-secondary" onclick="showEditOrderForm('${orderKey}')">Edit Order</button>` : ''}
                        <button class="btn btn-secondary btn-danger-text" onclick="deleteOrder('${orderKey}')">Delete Order</button>
                        <button class="btn btn-primary" onclick="saveOrderPayment('${orderKey}')">Save Changes</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Append to body
    const detailsDiv = document.createElement('div');
    detailsDiv.id = 'orderDetailsContainer';
    detailsDiv.innerHTML = detailsHtml;
    document.body.appendChild(detailsDiv);
}

// Check if order is a manual order (not from Digital Cookie scrape)
function isManualOrder(sale) {
    // Scraped orders have orderType like "Website", "Shipped", "In-Person delivery"
    // and typically have an orderNumber from Digital Cookie
    const scrapedOrderTypes = ['website', 'shipped', 'in-person delivery', 'in-person'];
    const orderType = (sale.orderType || '').toLowerCase();

    // If it has a Digital Cookie style order number (8+ digits), it's scraped
    const hasScrapedOrderNumber = sale.orderNumber && /^\d{8,}$/.test(sale.orderNumber);

    // It's manual if: no orderType, orderType is 'Manual', or doesn't match scraped patterns
    const isManual = !orderType || orderType === 'manual' ||
        (!scrapedOrderTypes.some(t => orderType.includes(t)) && !hasScrapedOrderNumber);

    return isManual;
}

// Show edit order form
function showEditOrderForm(orderKey) {
    const orderSales = sales.filter(s => getOrderKey(s) === orderKey);
    if (orderSales.length === 0) return;

    const firstSale = orderSales[0];

    // Build cookie entries for editing
    const cookieEntries = {};
    orderSales.forEach(sale => {
        const boxes = convertToBoxes(sale);
        cookieEntries[sale.cookieType] = {
            quantity: boxes,
            saleId: sale.id
        };
    });

    // Build cookie edit rows
    let cookieEditHtml = '';
    Object.entries(cookieEntries).forEach(([cookieType, data]) => {
        cookieEditHtml += `
            <div class="edit-cookie-row" data-sale-id="${data.saleId}">
                <span class="edit-cookie-name">${cookieType}</span>
                <input type="number" class="edit-cookie-qty" value="${data.quantity}" min="0" data-original="${data.quantity}">
                <button class="btn-remove-cookie" onclick="markCookieForRemoval(this)" title="Remove">&times;</button>
            </div>
        `;
    });

    const editFormHtml = `
        <div class="order-details-overlay" onclick="closeEditOrderForm()">
            <div class="order-details-modal edit-order-modal" onclick="event.stopPropagation()">
                <div class="order-details-header">
                    <h3>Edit Order</h3>
                    <button class="btn-close" onclick="closeEditOrderForm()">&times;</button>
                </div>
                <div class="order-details-content">
                    <div class="detail-section">
                        <h4>Customer Information</h4>
                        <div class="form-group">
                            <label>Name</label>
                            <input type="text" id="editCustomerName" value="${firstSale.customerName || ''}" placeholder="Customer Name">
                        </div>
                        <div class="form-group">
                            <label>Address</label>
                            <input type="text" id="editCustomerAddress" value="${firstSale.customerAddress || ''}" placeholder="Address">
                        </div>
                        <div class="form-group">
                            <label>Phone</label>
                            <input type="tel" id="editCustomerPhone" value="${firstSale.customerPhone || ''}" placeholder="Phone">
                        </div>
                        <div class="form-group">
                            <label>Email</label>
                            <input type="email" id="editCustomerEmail" value="${firstSale.customerEmail || ''}" placeholder="Email">
                        </div>
                    </div>
                    <div class="detail-section">
                        <h4>Order Information</h4>
                        <div class="form-group">
                            <label>Order Status</label>
                            <select id="editOrderStatus">
                                <option value="Pending" ${firstSale.orderStatus === 'Pending' ? 'selected' : ''}>Pending</option>
                                <option value="Delivered" ${firstSale.orderStatus === 'Delivered' ? 'selected' : ''}>Delivered</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Payment Method</label>
                            <select id="editPaymentMethod">
                                <option value="" ${!firstSale.paymentMethod ? 'selected' : ''}>Not specified</option>
                                <option value="cash" ${firstSale.paymentMethod === 'cash' ? 'selected' : ''}>Cash</option>
                                <option value="check" ${firstSale.paymentMethod === 'check' ? 'selected' : ''}>Check</option>
                                <option value="venmo" ${firstSale.paymentMethod === 'venmo' ? 'selected' : ''}>Venmo</option>
                                <option value="paypal" ${firstSale.paymentMethod === 'paypal' ? 'selected' : ''}>PayPal</option>
                                <option value="online" ${firstSale.paymentMethod === 'online' ? 'selected' : ''}>Online</option>
                                <option value="other" ${firstSale.paymentMethod === 'other' ? 'selected' : ''}>Other</option>
                            </select>
                        </div>
                    </div>
                    <div class="detail-section">
                        <h4>Cookies</h4>
                        <div class="edit-cookies-list" id="editCookiesList">
                            ${cookieEditHtml}
                        </div>
                        <p class="edit-note">Set quantity to 0 or click &times; to remove a cookie type.</p>
                    </div>
                    <div class="detail-section">
                        <h4>Payment</h4>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Amount Collected</label>
                                <input type="number" id="editAmountCollected" value="${orderSales.reduce((sum, s) => sum + (s.amountCollected || 0), 0).toFixed(2)}" min="0" step="0.01">
                            </div>
                            <div class="form-group">
                                <label>Amount Due</label>
                                <input type="number" id="editAmountDue" value="${orderSales.reduce((sum, s) => sum + (s.amountDue || 0), 0).toFixed(2)}" min="0" step="0.01">
                            </div>
                        </div>
                    </div>
                    <div class="detail-actions">
                        <button class="btn btn-secondary" onclick="closeEditOrderForm()">Cancel</button>
                        <button class="btn btn-primary" onclick="saveOrderEdits('${orderKey}')">Save Changes</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Close current order details and show edit form
    closeOrderDetails();

    const editDiv = document.createElement('div');
    editDiv.id = 'editOrderContainer';
    editDiv.innerHTML = editFormHtml;
    document.body.appendChild(editDiv);
}

// Mark cookie row for removal
function markCookieForRemoval(button) {
    const row = button.closest('.edit-cookie-row');
    row.classList.toggle('marked-for-removal');
    if (row.classList.contains('marked-for-removal')) {
        row.querySelector('.edit-cookie-qty').value = 0;
    }
}

// Close edit order form
function closeEditOrderForm() {
    const container = document.getElementById('editOrderContainer');
    if (container) {
        container.remove();
    }
}

// Save order edits
async function saveOrderEdits(orderKey) {
    const orderSales = sales.filter(s => getOrderKey(s) === orderKey);
    if (orderSales.length === 0) return;

    // Gather form values
    const customerName = document.getElementById('editCustomerName').value.trim();
    const customerAddress = document.getElementById('editCustomerAddress').value.trim();
    const customerPhone = document.getElementById('editCustomerPhone').value.trim();
    const customerEmail = document.getElementById('editCustomerEmail').value.trim();
    const orderStatus = document.getElementById('editOrderStatus').value;
    const paymentMethod = document.getElementById('editPaymentMethod').value;
    const amountCollected = parseFloat(document.getElementById('editAmountCollected').value) || 0;
    const amountDue = parseFloat(document.getElementById('editAmountDue').value) || 0;

    // Get cookie quantities
    const cookieRows = document.querySelectorAll('.edit-cookie-row');
    const cookieUpdates = [];
    cookieRows.forEach(row => {
        const saleId = row.dataset.saleId;
        const qty = parseInt(row.querySelector('.edit-cookie-qty').value) || 0;
        const isRemoved = row.classList.contains('marked-for-removal') || qty === 0;
        cookieUpdates.push({ saleId, qty, isRemoved });
    });

    try {
        // Update each sale in the order
        const updatePromises = [];

        // First sale gets the payment amounts
        const firstSaleId = orderSales[0].id;

        for (let i = 0; i < orderSales.length; i++) {
            const sale = orderSales[i];
            const cookieUpdate = cookieUpdates.find(u => u.saleId == sale.id);

            if (cookieUpdate && cookieUpdate.isRemoved) {
                // Delete this sale entry
                updatePromises.push(
                    fetch(`${API_BASE_URL}/sales/${sale.id}`, { method: 'DELETE' })
                );
            } else {
                // Update this sale entry
                const updateData = {
                    customerName,
                    customerAddress,
                    customerPhone,
                    customerEmail,
                    orderStatus,
                    paymentMethod: paymentMethod || null
                };

                // Update quantity if changed
                if (cookieUpdate) {
                    updateData.quantity = cookieUpdate.qty;
                }

                // First sale gets payment amounts
                if (sale.id === firstSaleId) {
                    updateData.amountCollected = amountCollected;
                    updateData.amountDue = amountDue;
                }

                updatePromises.push(
                    fetch(`${API_BASE_URL}/sales/${sale.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updateData)
                    })
                );
            }
        }

        await Promise.all(updatePromises);

        // Reload and re-render
        await loadSales();
        renderSales();
        closeEditOrderForm();
        showFeedback('Order updated successfully!');
    } catch (error) {
        console.error('Error saving order edits:', error);
        alert('Failed to save changes. Please try again.');
    }
}

// Save order payment changes
async function saveOrderPayment(orderKey) {
    const additionalPaymentInput = document.getElementById('additionalPayment');
    const additionalPayment = parseFloat(additionalPaymentInput.value) || 0;

    if (additionalPayment <= 0) {
        showFeedback('No additional payment to save');
        closeOrderDetails();
        return;
    }

    const orderSales = sales.filter(s => getOrderKey(s) === orderKey);
    if (orderSales.length === 0) return;

    // Add the additional payment to the first sale in the order
    const firstSale = orderSales[0];
    const newAmountCollected = (firstSale.amountCollected || 0) + additionalPayment;

    try {
        const response = await fetch(`${API_BASE_URL}/sales/${firstSale.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amountCollected: newAmountCollected })
        });

        if (!response.ok) {
            throw new Error('Failed to update payment');
        }

        // Reload and re-render
        await loadSales();
        renderSales();
        closeOrderDetails();
        showFeedback(`Payment of $${additionalPayment.toFixed(2)} recorded!`);
    } catch (error) {
        console.error('Error saving payment:', error);
        alert('Failed to save payment. Please try again.');
    }
}

// Close order details modal
function closeOrderDetails() {
    const container = document.getElementById('orderDetailsContainer');
    if (container) {
        container.remove();
    }
}

// Handle order complete checkbox change
async function handleOrderComplete(orderKey, markAsComplete) {
    const orderSales = sales.filter(s => getOrderKey(s) === orderKey);
    const newStatus = markAsComplete ? 'Delivered' : 'Pending';

    // Calculate payment totals
    const totalBoxes = orderSales.reduce((sum, s) => sum + convertToBoxes(s), 0);
    const orderTotal = totalBoxes * PRICE_PER_BOX;
    const totalCollected = orderSales.reduce((sum, s) => sum + (s.amountCollected || 0), 0);
    const remainingBalance = orderTotal - totalCollected;

    // If marking as complete and there's still payment due, show confirmation
    if (markAsComplete && remainingBalance > 0) {
        const shouldUpdatePayment = confirm(
            `There is payment still due on this order ($${remainingBalance.toFixed(2)}). Do you want to update total due to $0, and payment received to $${orderTotal.toFixed(2)}?`
        );

        if (!shouldUpdatePayment) {
            // User clicked "No" - return to sales page without marking complete
            return;
        }

        // User clicked "Yes" - update payment first
        try {
            const firstSale = orderSales[0];
            const response = await fetch(`${API_BASE_URL}/sales/${firstSale.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amountCollected: orderTotal })
            });

            if (!response.ok) {
                throw new Error('Failed to update payment');
            }

            // Reload sales to get updated payment data
            await loadSales();
        } catch (error) {
            console.error('Error updating payment:', error);
            alert('Failed to update payment. Please try again.');
            return;
        }
    }

    // Find and disable the button while processing
    const row = document.querySelector(`tr[data-order-key="${orderKey}"]`);
    const button = row?.querySelector('.btn-order-status');
    if (button) {
        button.disabled = true;
        button.textContent = 'Updating...';
    }

    try {
        // Update all sales in this order
        const updatePromises = orderSales.map(sale =>
            fetch(`${API_BASE_URL}/sales/${sale.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderStatus: newStatus })
            })
        );

        await Promise.all(updatePromises);

        // Reload and re-render
        await loadSales();
        renderSales();
        showFeedback(`Order marked as ${newStatus}`);
    } catch (error) {
        console.error('Error updating order status:', error);
        alert('Failed to update order status. Please try again.');
        // Reload to reset button state
        await loadSales();
        renderSales();
    }
}

// Delete an entire order
async function deleteOrder(orderKey) {
    if (!confirm('Are you sure you want to delete this entire order?')) {
        return;
    }

    const orderSales = sales.filter(s => getOrderKey(s) === orderKey);

    try {
        const deletePromises = orderSales.map(sale =>
            fetch(`${API_BASE_URL}/sales/${sale.id}`, {
                method: 'DELETE'
            })
        );

        await Promise.all(deletePromises);

        closeOrderDetails();
        await loadSales();
        renderSales();
        updateSummary();
        updateBreakdown();
        updateGoalDisplay();
        showFeedback('Order deleted successfully');
    } catch (error) {
        console.error('Error deleting order:', error);
        alert('Failed to delete order. Please try again.');
    }
}

// Render donations list
function renderDonations() {
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
                    <div class="donation-amount">$${donation.amount.toFixed(2)}</div>
                    <div class="donation-details">
                        ${donation.donorName} • ${formattedDate}
                    </div>
                </div>
                <div class="donation-actions">
                    <button class="btn-delete" onclick="handleDeleteDonation(${donation.id})">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

// Update summary statistics
function updateSummary() {
    // Calculate sales boxes (converting cases to boxes where needed)
    const salesBoxes = sales.reduce((sum, sale) => sum + convertToBoxes(sale), 0);
    
    // Calculate donation boxes (Cookie Share)
    const donationBoxes = donations.reduce((sum, donation) => sum + (donation.boxCount || 0), 0);
    
    const totalBoxes = salesBoxes + donationBoxes;
    
    const individualBoxes = sales.filter(s => s.saleType === 'individual').reduce((sum, sale) => sum + convertToBoxes(sale), 0);
    const eventBoxes = sales.filter(s => s.saleType === 'event').reduce((sum, sale) => sum + convertToBoxes(sale), 0);
    
    const salesRevenue = salesBoxes * PRICE_PER_BOX;
    const totalDonationAmount = donations.reduce((sum, donation) => sum + donation.amount, 0);
    
    const totalRevenue = salesRevenue + totalDonationAmount;
    
    totalBoxesElement.textContent = totalBoxes;
    // Update labels to be more clear if needed, or just keep as is
    individualSalesElement.textContent = `${individualBoxes} boxes`;
    eventSalesElement.textContent = `${eventBoxes} boxes`;
    
    totalRevenueElement.textContent = `$${totalRevenue.toFixed(2)}`;
    totalDonationsElement.textContent = `$${totalDonationAmount.toFixed(2)}`;
}

// Update cookie breakdown
function updateBreakdown() {
    if (sales.length === 0) {
        cookieBreakdownElement.innerHTML = '<p class="empty-message">No data to display yet.</p>';
        return;
    }
    
    // Calculate totals by cookie type (converting cases to boxes)
    const breakdown = {};
    sales.forEach(sale => {
        const boxes = convertToBoxes(sale);
        if (breakdown[sale.cookieType]) {
            breakdown[sale.cookieType] += boxes;
        } else {
            breakdown[sale.cookieType] = boxes;
        }
    });
    
    // Sort by quantity (descending)
    const sortedBreakdown = Object.entries(breakdown)
        .sort((a, b) => b[1] - a[1]);
    
    cookieBreakdownElement.innerHTML = sortedBreakdown.map(([cookieType, quantity]) => `
        <div class="breakdown-item">
            <span class="breakdown-cookie">${cookieType}</span>
            <span class="breakdown-quantity">${quantity} box${quantity > 1 ? 'es' : ''}</span>
        </div>
    `).join('');
}

// Show feedback message (simple toast-like notification)
function showFeedback(message) {
    // Create a simple temporary feedback element
    const feedback = document.createElement('div');
    feedback.textContent = message;
    feedback.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background-color: #1e7b3c;
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        z-index: 1000;
        animation: slideDown 0.3s ease-out;
        font-weight: 500;
    `;
    
    document.body.appendChild(feedback);
    
    // Remove after 2 seconds
    setTimeout(() => {
        feedback.style.animation = 'slideUp 0.3s ease-out';
        setTimeout(() => {
            if (document.body.contains(feedback)) {
                feedback.remove();
            }
        }, 300);
    }, 2000);
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideDown {
        from {
            transform: translateX(-50%) translateY(-100%);
            opacity: 0;
        }
        to {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
    }
    
    @keyframes slideUp {
        from {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
        to {
            transform: translateX(-50%) translateY(-100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Switch View (Global)
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
    localStorage.setItem('lastView', viewId);
}

// Navigation Logic
function setupNavigation() {
    const tabButtons = document.querySelectorAll('.tab-btn');

    // Add event listeners
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            switchView(btn.dataset.view);
        });
    });

    // Load last view or default to profile
    let lastView = localStorage.getItem('lastView') || 'profile';
    switchView(lastView);
}

// Theme Management
function setupTheme() {
    const themeButtons = document.querySelectorAll('.theme-btn');
    const savedTheme = localStorage.getItem('theme') || 'system';

    // Apply saved theme on load
    applyTheme(savedTheme);
    updateThemeButtons(savedTheme);

    // Listen for system preference changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        const currentTheme = localStorage.getItem('theme') || 'system';
        if (currentTheme === 'system') {
            applyTheme('system');
        }
    });

    // Add event listeners for theme buttons
    themeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.dataset.theme;
            localStorage.setItem('theme', theme);
            applyTheme(theme);
            updateThemeButtons(theme);
            showFeedback(`Theme changed to ${theme}`);
        });
    });
}

function applyTheme(theme) {
    const html = document.documentElement;

    if (theme === 'system') {
        // Use system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        html.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
        html.setAttribute('data-theme', theme);
    }
}

function updateThemeButtons(activeTheme) {
    const themeButtons = document.querySelectorAll('.theme-btn');
    themeButtons.forEach(btn => {
        if (btn.dataset.theme === activeTheme) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// Import Management
function setupImport() {
    const importFileInput = document.getElementById('importFile');
    const selectFileBtn = document.getElementById('selectFileBtn');
    const importBtn = document.getElementById('importBtn');
    const selectedFileName = document.getElementById('selectedFileName');
    const importStatus = document.getElementById('importStatus');

    if (!importFileInput || !selectFileBtn || !importBtn) return;

    selectFileBtn.addEventListener('click', () => {
        importFileInput.click();
    });

    importFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            selectedFileName.textContent = file.name;
            importBtn.disabled = false;
            importStatus.className = 'import-status';
            importStatus.textContent = '';
        } else {
            selectedFileName.textContent = '';
            importBtn.disabled = true;
        }
    });

    importBtn.addEventListener('click', async () => {
        const file = importFileInput.files[0];
        if (!file) {
            showFeedback('Please select a file first');
            return;
        }

        // Show loading state
        importBtn.disabled = true;
        importStatus.className = 'import-status loading';
        importStatus.textContent = 'Importing...';

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${API_BASE_URL}/import`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Import failed');
            }

            // Show success
            importStatus.className = 'import-status success';
            importStatus.textContent = `Successfully imported ${result.salesImported} sales from ${result.ordersProcessed} orders`;

            // Reload sales data
            await loadSales();
            renderSales();
            updateSummary();
            updateBreakdown();
            updateGoalDisplay();

            showFeedback('Import successful!');

            // Reset file input
            importFileInput.value = '';
            selectedFileName.textContent = '';
            importBtn.disabled = true;

        } catch (error) {
            console.error('Import error:', error);
            importStatus.className = 'import-status error';
            importStatus.textContent = `Error: ${error.message}`;
            importBtn.disabled = false;
        }
    });
}

// Setup Danger Zone buttons
function setupDangerZone() {
    const deleteAllDataBtn = document.getElementById('deleteAllDataBtn');

    if (deleteAllDataBtn) {
        deleteAllDataBtn.addEventListener('click', async () => {
            const confirmed = confirm(
                '⚠️ WARNING: Delete All Data?\n\n' +
                'This will permanently delete ALL sales and donation records.\n' +
                'This action cannot be undone.\n\n' +
                'Are you sure you want to continue?'
            );

            if (!confirmed) return;

            // Double confirmation for safety
            const doubleConfirm = confirm(
                '🚨 FINAL WARNING 🚨\n\n' +
                'You are about to delete ALL data.\n' +
                'Click OK to permanently wipe the database.'
            );

            if (!doubleConfirm) return;

            try {
                const response = await fetch(`${API_BASE_URL}/data`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    const result = await response.json();
                    showFeedback(`Deleted ${result.salesDeleted} sales and ${result.donationsDeleted} donations`);
                    await loadSales();
                    await loadDonations();
                    updateSummary();
                    updateBreakdown();
                    updateGoalDisplay();
                } else {
                    showFeedback('Failed to delete data', true);
                }
            } catch (error) {
                console.error('Delete data error:', error);
                showFeedback('Error deleting data: ' + error.message, true);
            }
        });
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        init();
        setupNavigation();
        setupTheme();
        setupImport();
        setupCookieTableListeners();
        setupDangerZone();
    });
} else {
    init();
    setupNavigation();
    setupTheme();
    setupImport();
    setupCookieTableListeners();
    setupDangerZone();
}
