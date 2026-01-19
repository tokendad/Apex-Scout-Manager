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
let profile = null;

// DOM Elements
const saleForm = document.getElementById('saleForm');
const cookieTypeInput = document.getElementById('cookieType');
const quantityInput = document.getElementById('quantity');
const customerNameInput = document.getElementById('customerName');
const saleTypeInput = document.getElementById('saleType');
const customerAddressInput = document.getElementById('customerAddress');
const customerPhoneInput = document.getElementById('customerPhone');
const unitTypeInput = document.getElementById('unitType');
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

// Profile elements
const photoInput = document.getElementById('photoInput');
const uploadPhotoBtn = document.getElementById('uploadPhotoBtn');
const profilePhoto = document.getElementById('profilePhoto');
const profilePhotoPlaceholder = document.getElementById('profilePhotoPlaceholder');
const qrCodeUrlInput = document.getElementById('qrCodeUrl');
const updateQrBtn = document.getElementById('updateQrBtn');
const qrCodeDisplay = document.getElementById('qrCodeDisplay');
const qrCodeImage = document.getElementById('qrCodeImage');

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

// Initialize app
async function init() {
    await Promise.all([loadSales(), loadDonations(), loadProfile()]);
    renderSales();
    renderDonations();
    updateSummary();
    updateBreakdown();
    updateGoalDisplay();
    setupEventListeners();
}

// Setup event listeners
function setupEventListeners() {
    saleForm.addEventListener('submit', handleAddSale);
    clearAllButton.addEventListener('click', handleClearAll);
    
    // Profile listeners
    uploadPhotoBtn.addEventListener('click', () => photoInput.click());
    photoInput.addEventListener('change', handlePhotoUpload);
    updateQrBtn.addEventListener('click', handleUpdateQrCode);
    
    // Goal listeners
    setGoalBtn.addEventListener('click', handleSetGoal);
    
    // Donation listeners
    donationForm.addEventListener('submit', handleAddDonation);
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

// Load profile from API
async function loadProfile() {
    try {
        const response = await fetch(`${API_BASE_URL}/profile`);
        if (!response.ok) {
            throw new Error('Failed to fetch profile');
        }
        profile = await response.json();
        
        // Update UI with profile data
        if (profile.photoData) {
            profilePhoto.src = profile.photoData;
            profilePhoto.style.display = 'block';
            profilePhotoPlaceholder.style.display = 'none';
        }
        
        if (profile.qrCodeUrl) {
            qrCodeUrlInput.value = profile.qrCodeUrl;
            generateQrCode(profile.qrCodeUrl);
        }
        
        if (profile.goalBoxes) {
            goalBoxesInput.value = profile.goalBoxes;
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        profile = { id: 1, photoData: null, qrCodeUrl: null, goalBoxes: 0, goalAmount: 0 };
    }
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

// Generate QR code using external service
function generateQrCode(url) {
    // Validate URL before generating QR code
    try {
        new URL(url);
        // Use a QR code API service with proper encoding
        const qrCodeApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
        
        // Add error handling for image loading
        qrCodeImage.onerror = () => {
            qrCodeDisplay.style.display = 'none';
            console.error('Failed to generate QR code');
        };
        
        qrCodeImage.onload = () => {
            qrCodeDisplay.style.display = 'block';
        };
        
        qrCodeImage.src = qrCodeApiUrl;
    } catch (error) {
        console.error('Invalid URL for QR code:', error);
        qrCodeDisplay.style.display = 'none';
    }
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
    // Calculate total boxes (converting cases to boxes where needed)
    const totalBoxes = sales.reduce((sum, sale) => sum + convertToBoxes(sale), 0);
    
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
    
    const cookieType = cookieTypeInput.value;
    const quantity = parseInt(quantityInput.value);
    const customerName = customerNameInput.value.trim();
    const saleType = saleTypeInput.value;
    const customerAddress = customerAddressInput.value.trim();
    const customerPhone = customerPhoneInput.value.trim();
    const unitType = unitTypeInput.value;
    const amountCollected = parseFloat(amountCollectedInput.value) || 0;
    const amountDue = parseFloat(amountDueInput.value) || 0;
    const paymentMethod = paymentMethodInput.value;
    
    if (!cookieType || quantity < 1) {
        alert('Please fill in all required fields.');
        return;
    }
    
    const sale = {
        cookieType,
        quantity,
        customerName,
        saleType,
        customerAddress,
        customerPhone,
        unitType,
        amountCollected,
        amountDue,
        paymentMethod,
        date: new Date().toISOString()
    };
    
    try {
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
        
        await loadSales();
        renderSales();
        updateSummary();
        updateBreakdown();
        updateGoalDisplay();
        
        // Reset form
        saleForm.reset();
        
        // Show feedback
        showFeedback('Sale added successfully!');
    } catch (error) {
        console.error('Error adding sale:', error);
        alert('Error adding sale. Please try again.');
    }
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

// Render sales list
function renderSales() {
    if (sales.length === 0) {
        salesList.innerHTML = '<p class="empty-message">No sales recorded yet. Add your first sale above!</p>';
        return;
    }
    
    salesList.innerHTML = sales.map(sale => {
        const date = new Date(sale.date);
        const formattedDate = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const saleTypeBadge = sale.saleType === 'event' ? '<span class="sale-type-badge">Event</span>' : '';
        
        // Format unit type display
        const unitDisplay = sale.unitType === 'case' ? `${sale.quantity} case${sale.quantity > 1 ? 's' : ''} (${sale.quantity * BOXES_PER_CASE} boxes)` : `${sale.quantity} box${sale.quantity > 1 ? 'es' : ''}`;
        
        // Build additional details
        let additionalDetails = [];
        if (sale.customerAddress) {
            additionalDetails.push(`📍 ${sale.customerAddress}`);
        }
        if (sale.customerPhone) {
            additionalDetails.push(`📞 ${sale.customerPhone}`);
        }
        if (sale.amountCollected > 0 || sale.amountDue > 0) {
            const collectedDisplay = sale.amountCollected > 0 ? `Collected: $${sale.amountCollected.toFixed(2)}` : '';
            const dueDisplay = sale.amountDue > 0 ? `Due: $${sale.amountDue.toFixed(2)}` : '';
            const paymentInfo = [collectedDisplay, dueDisplay].filter(x => x).join(' • ');
            if (paymentInfo) {
                additionalDetails.push(`💵 ${paymentInfo}`);
            }
        }
        if (sale.paymentMethod) {
            additionalDetails.push(`Payment: ${sale.paymentMethod}`);
        }
        
        const additionalDetailsHtml = additionalDetails.length > 0 
            ? `<div class="sale-additional-details">${additionalDetails.join(' • ')}</div>` 
            : '';
        
        return `
            <div class="sale-item">
                <div class="sale-info">
                    <div class="sale-cookie">${sale.cookieType} ${saleTypeBadge}</div>
                    <div class="sale-details">
                        ${unitDisplay} • ${sale.customerName} • ${formattedDate}
                    </div>
                    ${additionalDetailsHtml}
                </div>
                <div class="sale-actions">
                    <button class="btn-delete" onclick="handleDeleteSale(${sale.id})">Delete</button>
                </div>
            </div>
        `;
    }).join('');
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
    // Calculate total boxes (converting cases to boxes where needed)
    const totalBoxes = sales.reduce((sum, sale) => sum + convertToBoxes(sale), 0);
    
    const individualBoxes = sales.filter(s => s.saleType === 'individual').reduce((sum, sale) => sum + convertToBoxes(sale), 0);
    
    const eventBoxes = sales.filter(s => s.saleType === 'event').reduce((sum, sale) => sum + convertToBoxes(sale), 0);
    
    const totalRevenue = totalBoxes * PRICE_PER_BOX;
    const totalDonationAmount = donations.reduce((sum, donation) => sum + donation.amount, 0);
    
    totalBoxesElement.textContent = totalBoxes;
    individualSalesElement.textContent = `${individualBoxes} boxes`;
    eventSalesElement.textContent = `${eventBoxes} boxes`;
    totalRevenueElement.textContent = `$${totalRevenue}`;
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

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
