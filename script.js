// Girl Scout Cookie Tracker - JavaScript

// API base URL
const API_BASE_URL = '/api';

// Price per box (can be adjusted)
const PRICE_PER_BOX = 6;

// Sales data array
let sales = [];

// DOM Elements
const saleForm = document.getElementById('saleForm');
const cookieTypeInput = document.getElementById('cookieType');
const quantityInput = document.getElementById('quantity');
const customerNameInput = document.getElementById('customerName');
const salesList = document.getElementById('salesList');
const totalBoxesElement = document.getElementById('totalBoxes');
const totalSalesElement = document.getElementById('totalSales');
const totalRevenueElement = document.getElementById('totalRevenue');
const cookieBreakdownElement = document.getElementById('cookieBreakdown');
const clearAllButton = document.getElementById('clearAll');

// Initialize app
async function init() {
    await loadSales();
    renderSales();
    updateSummary();
    updateBreakdown();
    setupEventListeners();
}

// Setup event listeners
function setupEventListeners() {
    saleForm.addEventListener('submit', handleAddSale);
    clearAllButton.addEventListener('click', handleClearAll);
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

// Handle add sale form submission
async function handleAddSale(e) {
    e.preventDefault();
    
    const cookieType = cookieTypeInput.value;
    const quantity = parseInt(quantityInput.value);
    const customerName = customerNameInput.value.trim();
    
    if (!cookieType || quantity < 1) {
        alert('Please fill in all required fields.');
        return;
    }
    
    const sale = {
        cookieType,
        quantity,
        customerName,
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
            showFeedback('All sales cleared.');
        } catch (error) {
            console.error('Error clearing sales:', error);
            alert('Error clearing sales. Please try again.');
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
        
        return `
            <div class="sale-item">
                <div class="sale-info">
                    <div class="sale-cookie">${sale.cookieType}</div>
                    <div class="sale-details">
                        ${sale.quantity} box${sale.quantity > 1 ? 'es' : ''} • ${sale.customerName} • ${formattedDate}
                    </div>
                </div>
                <div class="sale-actions">
                    <button class="btn-delete" onclick="handleDeleteSale(${sale.id})">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

// Update summary statistics
function updateSummary() {
    const totalBoxes = sales.reduce((sum, sale) => sum + sale.quantity, 0);
    const totalSalesCount = sales.length;
    const totalRevenue = totalBoxes * PRICE_PER_BOX;
    
    totalBoxesElement.textContent = totalBoxes;
    totalSalesElement.textContent = totalSalesCount;
    totalRevenueElement.textContent = `$${totalRevenue}`;
}

// Update cookie breakdown
function updateBreakdown() {
    if (sales.length === 0) {
        cookieBreakdownElement.innerHTML = '<p class="empty-message">No data to display yet.</p>';
        return;
    }
    
    // Calculate totals by cookie type
    const breakdown = {};
    sales.forEach(sale => {
        if (breakdown[sale.cookieType]) {
            breakdown[sale.cookieType] += sale.quantity;
        } else {
            breakdown[sale.cookieType] = sale.quantity;
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
