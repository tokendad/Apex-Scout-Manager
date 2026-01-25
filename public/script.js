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

// Helper function to check if an order is complete (counts toward totals)
function isOrderComplete(sale) {
    // Order is complete if it's Paid AND (Delivered OR Shipped)
    const isPaid = sale.paymentStatus === 'Paid';
    const isDelivered = (sale.deliveryStatus === 'Delivered' || sale.deliveryStatus === 'Shipped');
    return isPaid && isDelivered;
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

// ====================
// EXPORT MODAL FUNCTIONS
// ====================

function openExportModal() {
    const modal = document.getElementById('exportModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeExportModal() {
    const modal = document.getElementById('exportModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function getExportOptions() {
    return {
        basicSummary: document.getElementById('exportBasicSummary')?.checked || false,
        cookieBreakdown: document.getElementById('exportCookieBreakdown')?.checked || false,
        individualDetails: document.getElementById('exportIndividualDetails')?.checked || false,
        eventDetails: document.getElementById('exportEventDetails')?.checked || false,
        inventory: document.getElementById('exportInventory')?.checked || false
    };
}

// ====================
// EXPORT DATA GATHERING
// ====================

function gatherExportData() {
    // Filter for only completed orders (Paid + Delivered/Shipped)
    const completedSales = sales.filter(sale => isOrderComplete(sale));
    const pendingSales = sales.filter(sale => !isOrderComplete(sale));

    // Calculate sales totals - ONLY COMPLETED
    const salesBoxes = completedSales.reduce((sum, sale) => sum + convertToBoxes(sale), 0);
    const donationBoxes = donations.reduce((sum, donation) => sum + (donation.boxCount || 0), 0);
    const eventBoothBoxes = events.reduce((sum, event) => {
        const totalInitial = (event.initialBoxes || 0) + ((event.initialCases || 0) * BOXES_PER_CASE);
        const totalRemaining = (event.remainingBoxes || 0) + ((event.remainingCases || 0) * BOXES_PER_CASE);
        return sum + Math.max(0, totalInitial - totalRemaining);
    }, 0);
    const totalBoxes = salesBoxes + donationBoxes + eventBoothBoxes;

    const individualBoxes = completedSales.filter(s => s.saleType === 'individual').reduce((sum, sale) => sum + convertToBoxes(sale), 0);
    const eventBoxes = completedSales.filter(s => s.saleType === 'event').reduce((sum, sale) => sum + convertToBoxes(sale), 0);

    const salesRevenue = salesBoxes * PRICE_PER_BOX;
    const eventBoothRevenue = eventBoothBoxes * PRICE_PER_BOX;
    const totalDonationAmount = donations.reduce((sum, donation) => sum + donation.amount, 0);
    const eventDonationsAmount = events.reduce((sum, event) => sum + (event.donationsReceived || 0), 0);
    const totalRevenue = salesRevenue + eventBoothRevenue + totalDonationAmount + eventDonationsAmount;

    // Calculate breakdown by cookie type across all sales channels - ONLY COMPLETED
    const cookieBreakdown = {};
    const cookieTypes = ['Thin Mints', 'Samoas', 'Tagalongs', 'Trefoils', 'Do-si-dos', 'Lemon-Ups', 'Adventurefuls', 'Exploremores', 'Toffee-tastic'];

    cookieTypes.forEach(type => {
        cookieBreakdown[type] = {
            individual: 0,
            event: 0,
            eventBooth: 0,
            total: 0
        };
    });

    // Individual and manual event sales - ONLY COMPLETED
    completedSales.forEach(sale => {
        const boxes = convertToBoxes(sale);
        const type = sale.cookieType;
        if (!cookieBreakdown[type]) {
            cookieBreakdown[type] = { individual: 0, event: 0, eventBooth: 0, total: 0 };
        }
        if (sale.saleType === 'individual') {
            cookieBreakdown[type].individual += boxes;
        } else {
            cookieBreakdown[type].event += boxes;
        }
        cookieBreakdown[type].total += boxes;
    });

    // Event booth sales by variety
    events.forEach(event => {
        const varieties = ['ThinMints', 'Samoas', 'Tagalongs', 'Trefoils', 'DosiDos', 'LemonUps', 'Adventurefuls', 'Exploremores', 'Toffeetastic'];
        const varietyNames = ['Thin Mints', 'Samoas', 'Tagalongs', 'Trefoils', 'Do-si-dos', 'Lemon-Ups', 'Adventurefuls', 'Exploremores', 'Toffee-tastic'];

        varieties.forEach((variety, idx) => {
            const initial = (event[`initial${variety}`] || 0);
            const remaining = (event[`remaining${variety}`] || 0);
            const sold = Math.max(0, initial - remaining);
            const cookieName = varietyNames[idx];

            if (!cookieBreakdown[cookieName]) {
                cookieBreakdown[cookieName] = { individual: 0, event: 0, eventBooth: 0, total: 0 };
            }
            cookieBreakdown[cookieName].eventBooth += sold;
            cookieBreakdown[cookieName].total += sold;
        });
    });

    return {
        totalBoxes,
        individualBoxes,
        eventBoxes,
        eventBoothBoxes,
        totalRevenue,
        salesRevenue,
        eventBoothRevenue,
        totalDonationAmount,
        eventDonationsAmount,
        cookieBreakdown,
        sales: completedSales,  // Only export completed sales
        allSales: sales,  // Keep all sales for reference
        pendingSales,  // Export pending sales separately
        events,
        profile
    };
}

// ====================
// PDF EXPORT
// ====================

function handleExportPDF() {
    const options = getExportOptions();

    // Check if at least one option is selected
    if (!Object.values(options).some(v => v)) {
        alert('Please select at least one section to export.');
        return;
    }

    generatePDF(options);
    closeExportModal();
}

function generatePDF(options) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPos = margin;

    // Helper function to add text with automatic page break
    function addText(text, x, y, fontSize = 10, style = 'normal') {
        if (y > pageHeight - margin - 10) {
            doc.addPage();
            y = margin;
        }
        doc.setFontSize(fontSize);
        doc.setFont(undefined, style);

        // Handle long text wrapping
        const maxWidth = pageWidth - (2 * margin);
        const lines = doc.splitTextToSize(text, maxWidth);

        lines.forEach((line, idx) => {
            if (y > pageHeight - margin - 10) {
                doc.addPage();
                y = margin;
            }
            doc.text(line, x, y);
            if (idx < lines.length - 1) {
                y += fontSize * 0.5;
            }
        });

        return y;
    }

    // Helper function to add a line
    function addLine(y, padding = 3) {
        if (y + padding > pageHeight - margin) {
            doc.addPage();
            return margin + padding + 3;
        }
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, y + padding, pageWidth - margin, y + padding);
        return y + padding + 3;
    }

    // Title header
    doc.setFillColor(30, 123, 60);
    doc.rect(0, 0, pageWidth, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('Girl Scout Cookie Sales Report', pageWidth / 2, 16, { align: 'center' });

    yPos = 35;
    doc.setTextColor(0, 0, 0);

    // Date
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    const reportDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
    doc.text(`Generated: ${reportDate}`, margin, yPos);
    yPos += 12;

    const data = gatherExportData();
    const goal = (data.profile && data.profile.goalBoxes) || 0;
    const remaining = goal - data.totalBoxes;

    // Basic Summary
    if (options.basicSummary) {
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        yPos = addText('Sales Summary', margin, yPos, 14, 'bold');
        yPos += 8;

        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        yPos = addText(`Total Boxes Sold: ${data.totalBoxes}`, margin + 3, yPos);
        yPos += 6;
        yPos = addText(`Individual Sales: ${data.individualBoxes} boxes`, margin + 3, yPos);
        yPos += 6;
        yPos = addText(`Event Manual Sales: ${data.eventBoxes} boxes`, margin + 3, yPos);
        yPos += 6;
        yPos = addText(`Event Booth Sales: ${data.eventBoothBoxes} boxes`, margin + 3, yPos);
        yPos += 8;
        doc.setFont(undefined, 'bold');
        yPos = addText(`Total Revenue: $${data.totalRevenue.toFixed(2)}`, margin + 3, yPos, 10, 'bold');
        doc.setFont(undefined, 'normal');
        yPos += 6;
        yPos = addText(`  Sales Revenue: $${(data.salesRevenue + data.eventBoothRevenue).toFixed(2)}`, margin + 3, yPos);
        yPos += 6;
        yPos = addText(`  Donations: $${(data.totalDonationAmount + data.eventDonationsAmount).toFixed(2)}`, margin + 3, yPos);
        yPos += 8;
        if (goal > 0) {
            doc.setFont(undefined, 'bold');
            yPos = addText(`Goal: ${goal} boxes`, margin + 3, yPos, 10, 'bold');
            yPos += 6;
            doc.setFont(undefined, 'normal');
            yPos = addText(`Remaining: ${remaining} boxes`, margin + 3, yPos);
            yPos += 8;
        }
        yPos = addLine(yPos);
    }

    // Cookie Breakdown
    if (options.cookieBreakdown && Object.keys(data.cookieBreakdown).length > 0) {
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        yPos = addText('Cookie Breakdown by Type', margin, yPos, 14, 'bold');
        yPos += 8;

        const sortedCookies = Object.entries(data.cookieBreakdown)
            .filter(([, counts]) => counts.total > 0)
            .sort((a, b) => b[1].total - a[1].total);

        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');

        let totalIndividual = 0;
        let totalEventManual = 0;
        let totalEventBooth = 0;
        let grandTotal = 0;

        sortedCookies.forEach(([cookieType, counts]) => {
            doc.setFont(undefined, 'bold');
            yPos = addText(`${cookieType}: ${counts.total} boxes`, margin + 3, yPos, 10, 'bold');
            yPos += 5;
            doc.setFont(undefined, 'normal');
            yPos = addText(`  Individual: ${counts.individual} | Event Manual: ${counts.event} | Event Booth: ${counts.eventBooth}`, margin + 5, yPos, 9);
            yPos += 7;

            totalIndividual += counts.individual;
            totalEventManual += counts.event;
            totalEventBooth += counts.eventBooth;
            grandTotal += counts.total;
        });

        // Add totals
        yPos += 2;
        doc.setFont(undefined, 'bold');
        yPos = addText(`TOTALS: ${grandTotal} boxes`, margin + 3, yPos, 10, 'bold');
        yPos += 5;
        doc.setFont(undefined, 'normal');
        yPos = addText(`  Individual: ${totalIndividual} | Event Manual: ${totalEventManual} | Event Booth: ${totalEventBooth}`, margin + 5, yPos, 9);
        yPos += 8;
        yPos = addLine(yPos);
    }

    // Individual Sales Detail - Grouped by Customer
    if (options.individualDetails && data.sales.length > 0) {
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        yPos = addText('Individual Sales Detail', margin, yPos, 14, 'bold');
        yPos += 8;

        // Group sales by customer
        const customerOrders = {};

        data.sales.forEach(sale => {
            const key = `${sale.customerName || 'Anonymous'}_${sale.customerAddress || ''}_${sale.customerPhone || ''}`;

            if (!customerOrders[key]) {
                customerOrders[key] = {
                    customerName: sale.customerName || 'Anonymous',
                    address: sale.customerAddress || '',
                    phone: sale.customerPhone || '',
                    paymentMethod: sale.paymentMethod || '',
                    orderSource: sale.orderSource || 'Manual',
                    paymentStatus: sale.paymentStatus || 'Not Paid',
                    deliveryStatus: sale.deliveryStatus || 'Not Delivered',
                    cookies: {},
                    totalCollected: 0,
                    totalDue: 0
                };
            }

            const boxes = convertToBoxes(sale);
            const cookieName = sale.cookieType;

            customerOrders[key].cookies[cookieName] = (customerOrders[key].cookies[cookieName] || 0) + boxes;
            customerOrders[key].totalCollected += (sale.amountCollected || 0);
            customerOrders[key].totalDue += (sale.amountDue || 0);
        });

        doc.setFontSize(8);

        let orderNum = 1;
        Object.values(customerOrders).forEach(order => {
            // Calculate total amount and proper payment status
            const totalBoxes = Object.values(order.cookies).reduce((sum, qty) => sum + qty, 0);
            const totalAmount = totalBoxes * PRICE_PER_BOX;

            // Determine old payment status based on amount collected vs total amount (for backward compatibility)
            let oldPaymentStatus;
            if (order.totalCollected >= totalAmount) {
                oldPaymentStatus = 'PAID';
            } else if (order.totalCollected > 0) {
                oldPaymentStatus = 'PARTIAL';
            } else {
                oldPaymentStatus = 'UNPAID';
            }

            doc.setFont(undefined, 'bold');
            yPos = addText(`${orderNum}. ${order.customerName}`, margin + 2, yPos, 9, 'bold');
            yPos += 5;

            doc.setFont(undefined, 'normal');
            if (order.address) {
                yPos = addText(`   ${order.address}`, margin + 2, yPos, 8);
                yPos += 4;
            }
            if (order.phone) {
                yPos = addText(`   ${order.phone}`, margin + 2, yPos, 8);
                yPos += 4;
            }

            // List cookies
            const cookiesList = Object.entries(order.cookies)
                .map(([type, qty]) => `${type}: ${qty}`)
                .join(', ');

            yPos = addText(`   Cookies: ${cookiesList}`, margin + 2, yPos, 8);
            yPos += 4;

            // Determine completion status
            const isPaid = order.paymentStatus === 'Paid';
            const isDelivered = (order.deliveryStatus === 'Delivered' || order.deliveryStatus === 'Shipped');
            const completionStatus = (isPaid && isDelivered) ? 'COMPLETED' : 'PENDING';

            yPos = addText(`   Total: ${totalBoxes} boxes = $${totalAmount.toFixed(2)} | Collected: $${order.totalCollected.toFixed(2)} | Due: $${order.totalDue.toFixed(2)}`, margin + 2, yPos, 8);
            yPos += 4;
            yPos = addText(`   Source: ${order.orderSource} | Payment: ${order.paymentStatus} | Delivery: ${order.deliveryStatus} | Status: ${completionStatus}`, margin + 2, yPos, 8);
            yPos += 6;

            orderNum++;
        });

        yPos += 2;
        yPos = addLine(yPos);
    }

    // Event Sales Detail
    if (options.eventDetails && data.events.length > 0) {
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        yPos = addText('Event Sales Detail', margin, yPos, 14, 'bold');
        yPos += 8;

        doc.setFontSize(9);

        let totalEventInitial = 0;
        let totalEventRemaining = 0;
        let totalEventSold = 0;
        let totalEventRevenue = 0;

        data.events.forEach(event => {
            const totalInitial = (event.initialBoxes || 0) + ((event.initialCases || 0) * BOXES_PER_CASE);
            const totalRemaining = (event.remainingBoxes || 0) + ((event.remainingCases || 0) * BOXES_PER_CASE);
            const totalSold = Math.max(0, totalInitial - totalRemaining);
            const eventRevenue = totalSold * PRICE_PER_BOX;

            totalEventInitial += totalInitial;
            totalEventRemaining += totalRemaining;
            totalEventSold += totalSold;
            totalEventRevenue += eventRevenue;

            doc.setFont(undefined, 'bold');
            yPos = addText(`${event.eventName}`, margin + 3, yPos, 10, 'bold');
            yPos += 5;

            doc.setFont(undefined, 'normal');
            yPos = addText(`   Date: ${new Date(event.eventDate).toLocaleString()}`, margin + 3, yPos, 9);
            yPos += 5;

            if (event.description) {
                yPos = addText(`   Description: ${event.description}`, margin + 3, yPos, 9);
                yPos += 5;
            }

            yPos = addText(`   Total Boxes Sold: ${totalSold} | Revenue: $${eventRevenue.toFixed(2)}`, margin + 3, yPos, 9);
            yPos += 5;

            // Variety breakdown
            const varieties = ['ThinMints', 'Samoas', 'Tagalongs', 'Trefoils', 'DosiDos', 'LemonUps', 'Adventurefuls', 'Exploremores', 'Toffeetastic'];
            const varietyNames = ['Thin Mints', 'Samoas', 'Tagalongs', 'Trefoils', 'Do-si-dos', 'Lemon-Ups', 'Adventurefuls', 'Exploremores', 'Toffee-tastic'];

            yPos = addText(`   By Cookie Type:`, margin + 3, yPos, 9);
            yPos += 5;

            varieties.forEach((variety, idx) => {
                const initial = event[`initial${variety}`] || 0;
                const remaining = event[`remaining${variety}`] || 0;
                const sold = Math.max(0, initial - remaining);

                if (sold > 0) {
                    yPos = addText(`     ${varietyNames[idx]}: ${sold} boxes (${initial} initial - ${remaining} remaining)`, margin + 3, yPos, 8);
                    yPos += 5;
                }
            });

            if (event.donationsReceived > 0) {
                yPos = addText(`   Donations: $${event.donationsReceived.toFixed(2)}`, margin + 3, yPos, 9);
                yPos += 5;
            }

            yPos += 3;
        });

        // Add totals
        yPos += 2;
        doc.setFont(undefined, 'bold');
        yPos = addText(`TOTALS: Initial: ${totalEventInitial} | Remaining: ${totalEventRemaining} | Sold: ${totalEventSold} | Revenue: $${totalEventRevenue.toFixed(2)}`, margin + 3, yPos, 9, 'bold');
        yPos += 8;

        yPos = addLine(yPos);
    }

    // Inventory
    if (options.inventory && data.profile) {
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        yPos = addText('Current On-Hand Inventory', margin, yPos, 14, 'bold');
        yPos += 8;

        const inventoryFields = [
            { key: 'ThinMints', name: 'Thin Mints' },
            { key: 'Samoas', name: 'Samoas' },
            { key: 'Tagalongs', name: 'Tagalongs' },
            { key: 'Trefoils', name: 'Trefoils' },
            { key: 'DosiDos', name: 'Do-si-dos' },
            { key: 'LemonUps', name: 'Lemon-Ups' },
            { key: 'Adventurefuls', name: 'Adventurefuls' },
            { key: 'Exploremores', name: 'Exploremores' },
            { key: 'Toffeetastic', name: 'Toffee-tastic' }
        ];

        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');

        let totalInventory = 0;
        let hasInventory = false;

        inventoryFields.forEach(({ key, name }) => {
            const quantity = data.profile[`inventory${key}`] || 0;
            totalInventory += quantity;
            if (quantity > 0) {
                hasInventory = true;
                yPos = addText(`${name}: ${quantity} boxes`, margin + 3, yPos);
                yPos += 6;
            }
        });

        if (!hasInventory) {
            yPos = addText('No inventory currently on hand', margin + 3, yPos);
            yPos += 6;
        } else {
            yPos += 2;
            doc.setFont(undefined, 'bold');
            yPos = addText(`Total Inventory: ${totalInventory} boxes`, margin + 3, yPos, 10, 'bold');
            yPos += 6;
        }
    }

    // Save PDF
    const fileName = `GSC_Sales_Report_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
}

// ====================
// EXCEL EXPORT
// ====================

function handleExportExcel() {
    const options = getExportOptions();

    if (!Object.values(options).some(v => v)) {
        alert('Please select at least one section to export.');
        return;
    }

    generateExcel(options);
    closeExportModal();
}

function generateExcel(options) {
    const data = gatherExportData();
    const wb = XLSX.utils.book_new();

    // Get goal from profile
    const goal = (data.profile && data.profile.goalBoxes) || 0;

    // Basic Summary Sheet
    if (options.basicSummary) {
        const summaryData = [
            ['Girl Scout Cookie Sales Summary', ''],
            ['Generated', new Date().toLocaleDateString()],
            [],
            ['Total Boxes Sold', data.totalBoxes],
            ['Individual Sales', data.individualBoxes],
            ['Event Manual Sales', data.eventBoxes],
            ['Event Booth Sales', data.eventBoothBoxes],
            [],
            ['Total Revenue', data.totalRevenue.toFixed(2)],
            ['Sales Revenue', (data.salesRevenue + data.eventBoothRevenue).toFixed(2)],
            ['Donations', (data.totalDonationAmount + data.eventDonationsAmount).toFixed(2)],
            [],
            ['Goal ', goal],
            ['Remaining', { f: `B13-B4` }] // Formula: Goal - Total Boxes Sold
        ];
        const ws = XLSX.utils.aoa_to_sheet(summaryData);

        // Format currency cells        ws['B9'] = { t: 'n', v: data.totalRevenue, z: '"$"#,##0.00' };
        ws['B10'] = { t: 'n', v: data.salesRevenue + data.eventBoothRevenue, z: '"$"#,##0.00' };
        ws['B11'] = { t: 'n', v: data.totalDonationAmount + data.eventDonationsAmount, z: '"$"#,##0.00' };

        XLSX.utils.book_append_sheet(wb, ws, 'Summary');
    }

    // Cookie Breakdown Sheet
    if (options.cookieBreakdown) {
        const breakdownData = [
            ['Cookie Type', 'Individual Sales', 'Event Manual', 'Event Booth', 'Total']
        ];

        const sortedCookies = Object.entries(data.cookieBreakdown)
            .filter(([, counts]) => counts.total > 0)
            .sort((a, b) => b[1].total - a[1].total);

        sortedCookies.forEach(([cookieType, counts]) => {
            breakdownData.push([
                cookieType,
                counts.individual,
                counts.event,
                counts.eventBooth,
                counts.total
            ]);
        });

        // Add totals row with formulas
        const dataRowCount = sortedCookies.length;
        breakdownData.push([
            'Totals',
            { f: `SUM(B2:B${dataRowCount + 1})` },
            { f: `SUM(C2:C${dataRowCount + 1})` },
            { f: `SUM(D2:D${dataRowCount + 1})` },
            { f: `SUM(E2:E${dataRowCount + 1})` }
        ]);

        const ws = XLSX.utils.aoa_to_sheet(breakdownData);
        XLSX.utils.book_append_sheet(wb, ws, 'Cookie Breakdown');
    }

    // Individual Sales Detail Sheet - NEW TRANSPOSED FORMAT
    if (options.individualDetails && data.sales.length > 0) {
        // Group sales by customer
        const customerOrders = {};

        data.sales.forEach(sale => {
            const key = `${sale.customerName || 'Anonymous'}_${sale.customerAddress || ''}_${sale.customerPhone || ''}`;

            if (!customerOrders[key]) {
                customerOrders[key] = {
                    customerName: sale.customerName || 'Anonymous',
                    address: sale.customerAddress || '',
                    phone: sale.customerPhone || '',
                    paymentMethod: sale.paymentMethod || '',
                    orderSource: sale.orderSource || 'Manual',
                    paymentStatus: sale.paymentStatus || 'Not Paid',
                    deliveryStatus: sale.deliveryStatus || 'Not Delivered',
                    cookies: {},
                    totalCollected: 0,
                    totalDue: 0
                };
            }

            const boxes = convertToBoxes(sale);
            const cookieName = sale.cookieType;

            customerOrders[key].cookies[cookieName] = (customerOrders[key].cookies[cookieName] || 0) + boxes;
            customerOrders[key].totalCollected += (sale.amountCollected || 0);
            customerOrders[key].totalDue += (sale.amountDue || 0);
        });

        // Create header row with all cookie types
        const cookieTypes = ['Thin Mints', 'Samoas', 'Tagalongs', 'Trefoils', 'Do-si-dos',
                            'Lemon-Ups', 'Adventurefuls', 'Exploremores', 'Toffee-tastic', 'Donated Cookies'];

        const salesData = [
            ['Customer Name', 'Address', 'Phone', ...cookieTypes, 'Total Boxes', 'Total Amount', 'Collected', 'Due', 'Payment Method', 'Order Source', 'Payment Status', 'Delivery Status', 'Completion Status']
        ];

        // Add each customer order as a row
        Object.values(customerOrders).forEach(order => {
            const row = [
                order.customerName,
                order.address,
                order.phone
            ];

            let totalBoxes = 0;
            cookieTypes.forEach(cookieType => {
                const boxes = order.cookies[cookieType] || 0;
                row.push(boxes || '');
                totalBoxes += boxes;
            });

            const totalAmount = totalBoxes * PRICE_PER_BOX;

            // Determine old payment status based on amount collected vs total amount (for backward compatibility)
            let oldPaymentStatus;
            if (order.totalCollected >= totalAmount) {
                oldPaymentStatus = 'PAID';
            } else if (order.totalCollected > 0) {
                oldPaymentStatus = 'PARTIAL';
            } else {
                oldPaymentStatus = 'UNPAID';
            }

            // Determine completion status based on payment and delivery
            const isPaid = order.paymentStatus === 'Paid';
            const isDelivered = (order.deliveryStatus === 'Delivered' || order.deliveryStatus === 'Shipped');
            const completionStatus = (isPaid && isDelivered) ? 'COMPLETED' : 'PENDING';

            row.push(
                totalBoxes,
                totalAmount,
                order.totalCollected,
                order.totalDue,
                order.paymentMethod,
                order.orderSource,
                order.paymentStatus,
                order.deliveryStatus,
                completionStatus
            );

            salesData.push(row);
        });

        const ws = XLSX.utils.aoa_to_sheet(salesData);

        // Format currency columns (Total Amount, Collected, Due)
        const totalAmountCol = 14; // Column O (after 10 cookie types + Customer/Address/Phone + Total Boxes)
        const collectedCol = 15; // Column P
        const dueCol = 16; // Column Q

        for (let i = 2; i <= salesData.length; i++) {
            const colLetterAmount = XLSX.utils.encode_col(totalAmountCol);
            const colLetterCollected = XLSX.utils.encode_col(collectedCol);
            const colLetterDue = XLSX.utils.encode_col(dueCol);

            if (ws[`${colLetterAmount}${i}`]) ws[`${colLetterAmount}${i}`].z = '"$"#,##0.00';
            if (ws[`${colLetterCollected}${i}`]) ws[`${colLetterCollected}${i}`].z = '"$"#,##0.00';
            if (ws[`${colLetterDue}${i}`]) ws[`${colLetterDue}${i}`].z = '"$"#,##0.00';
        }

        XLSX.utils.book_append_sheet(wb, ws, 'Individual Sales');
    }

    // Event Sales Detail Sheet
    if (options.eventDetails && data.events.length > 0) {
        const eventData = [
            ['Event Name', 'Date', 'Description', 'Cookie Type', 'Initial', 'Remaining', 'Sold', 'Revenue', 'Donations']
        ];

        const varieties = ['ThinMints', 'Samoas', 'Tagalongs', 'Trefoils', 'DosiDos', 'LemonUps', 'Adventurefuls', 'Exploremores', 'Toffeetastic'];
        const varietyNames = ['Thin Mints', 'Samoas', 'Tagalongs', 'Trefoils', 'Do-si-dos', 'Lemon-Ups', 'Adventurefuls', 'Exploremores', 'Toffee-tastic'];

        let rowCount = 1;
        data.events.forEach(event => {
            varieties.forEach((variety, idx) => {
                const initial = event[`initial${variety}`] || 0;
                const remaining = event[`remaining${variety}`] || 0;
                const sold = Math.max(0, initial - remaining);

                if (sold > 0 || initial > 0) {
                    rowCount++;
                    eventData.push([
                        event.eventName,
                        new Date(event.eventDate).toLocaleString(),
                        event.description || '',
                        varietyNames[idx],
                        initial,
                        remaining,
                        sold,
                        sold * PRICE_PER_BOX,
                        idx === 0 ? (event.donationsReceived || 0) : ''
                    ]);
                }
            });
        });

        // Add totals row with formulas
        eventData.push([
            '',
            '',
            '',
            'Totals',
            { f: `SUM(E2:E${rowCount})` },
            { f: `SUM(F2:F${rowCount})` },
            { f: `SUM(G2:G${rowCount})` },
            { f: `SUM(H2:H${rowCount})` },
            ''
        ]);

        const ws = XLSX.utils.aoa_to_sheet(eventData);

        // Format revenue column as currency
        for (let i = 2; i <= rowCount; i++) {
            if (ws[`H${i}`]) ws[`H${i}`].z = '"$"#,##0.00';
            if (ws[`I${i}`]) ws[`I${i}`].z = '"$"#,##0.00';
        }
        if (ws[`H${rowCount + 1}`]) ws[`H${rowCount + 1}`].z = '"$"#,##0.00';

        XLSX.utils.book_append_sheet(wb, ws, 'Event Sales');
    }

    // Inventory Sheet
    if (options.inventory && data.profile) {
        const inventoryData = [
            ['Cookie Type', 'On-Hand Boxes']
        ];

        const inventoryFields = [
            { key: 'ThinMints', name: 'Thin Mints' },
            { key: 'Samoas', name: 'Samoas' },
            { key: 'Tagalongs', name: 'Tagalongs' },
            { key: 'Trefoils', name: 'Trefoils' },
            { key: 'DosiDos', name: 'Do-si-dos' },
            { key: 'LemonUps', name: 'Lemon-Ups' },
            { key: 'Adventurefuls', name: 'Adventurefuls' },
            { key: 'Exploremores', name: 'Exploremores' },
            { key: 'Toffeetastic', name: 'Toffee-tastic' }
        ];

        inventoryFields.forEach(({ key, name }) => {
            const quantity = data.profile[`inventory${key}`] || 0;
            inventoryData.push([name, quantity]);
        });

        // Add total row with formula
        inventoryData.push([
            'Total ',
            { f: 'SUM(B2:B10)' }
        ]);

        const ws = XLSX.utils.aoa_to_sheet(inventoryData);
        XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    }

    // Save Excel file
    const fileName = `GSC_Sales_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
}

// Initialize app
async function init() {
    await Promise.all([loadSales(), loadDonations(), loadEvents(), loadProfile(), loadPaymentMethods()]);
    renderSales();
    renderDonations();
    renderEvents();
    renderPaymentMethodsSettings();
    updateSummary();
    updateBreakdown();
    updateInventoryReconciliation();
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
    
    // Event variety table listeners
    setupVarietyTableListeners();
    
    // Export button listener - open modal instead of direct export
    const printSummaryBtn = document.getElementById('printSummaryBtn');
    if (printSummaryBtn) {
        printSummaryBtn.addEventListener('click', openExportModal);
    }

    // Export format button listeners
    const exportPdfBtn = document.getElementById('exportPdfBtn');
    const exportExcelBtn = document.getElementById('exportExcelBtn');
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', handleExportPDF);
    }
    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', handleExportExcel);
    }
}

// Cookie varieties list
const COOKIE_VARIETIES = [
    'ThinMints', 'Samoas', 'Tagalongs', 'Trefoils',
    'DosiDos', 'LemonUps', 'Adventurefuls', 'Exploremores', 'Toffeetastic'
];

// Setup event listeners for variety table inputs
function setupVarietyTableListeners() {
    const varietyInputs = document.querySelectorAll('.variety-cases-input, .variety-boxes-input');
    
    varietyInputs.forEach(input => {
        input.addEventListener('input', updateVarietyTotals);
    });
}

// Update variety totals when inputs change
function updateVarietyTotals() {
    const types = ['initial', 'remaining'];
    
    types.forEach(type => {
        let totalCases = 0;
        let totalBoxes = 0;
        let grandTotal = 0;
        
        COOKIE_VARIETIES.forEach(variety => {
            const casesInput = document.getElementById(`${type}Cases${variety}`);
            const boxesInput = document.getElementById(`${type}Boxes${variety}`);
            const totalSpan = document.getElementById(`${type}Total${variety}`);
            
            const cases = parseInt(casesInput.value) || 0;
            const boxes = parseInt(boxesInput.value) || 0;
            const varietyTotal = (cases * BOXES_PER_CASE) + boxes;
            
            totalSpan.textContent = varietyTotal;
            
            totalCases += cases;
            totalBoxes += boxes;
            grandTotal += varietyTotal;
        });
        
        document.getElementById(`${type}TotalCases`).textContent = totalCases;
        document.getElementById(`${type}TotalBoxes`).textContent = totalBoxes;
        document.getElementById(`${type}GrandTotal`).textContent = grandTotal;
    });
}

// Collect variety data from form
function collectVarietyData() {
    const varietyData = {};
    
    COOKIE_VARIETIES.forEach(variety => {
        // Initial inventory
        const initialCases = parseInt(document.getElementById(`initialCases${variety}`).value) || 0;
        const initialBoxes = parseInt(document.getElementById(`initialBoxes${variety}`).value) || 0;
        varietyData[`initial${variety}`] = (initialCases * BOXES_PER_CASE) + initialBoxes;
        
        // Remaining inventory
        const remainingCases = parseInt(document.getElementById(`remainingCases${variety}`).value) || 0;
        const remainingBoxes = parseInt(document.getElementById(`remainingBoxes${variety}`).value) || 0;
        varietyData[`remaining${variety}`] = (remainingCases * BOXES_PER_CASE) + remainingBoxes;
    });
    
    return varietyData;
}

// Populate variety inputs from event data
function populateVarietyInputs(event) {
    COOKIE_VARIETIES.forEach(variety => {
        // Initial inventory
        const initialTotal = event[`initial${variety}`] || 0;
        const initialCases = Math.floor(initialTotal / BOXES_PER_CASE);
        const initialBoxes = initialTotal % BOXES_PER_CASE;
        
        document.getElementById(`initialCases${variety}`).value = initialCases;
        document.getElementById(`initialBoxes${variety}`).value = initialBoxes;
        
        // Remaining inventory
        const remainingTotal = event[`remaining${variety}`] || 0;
        const remainingCases = Math.floor(remainingTotal / BOXES_PER_CASE);
        const remainingBoxes = remainingTotal % BOXES_PER_CASE;
        
        document.getElementById(`remainingCases${variety}`).value = remainingCases;
        document.getElementById(`remainingBoxes${variety}`).value = remainingBoxes;
    });
    
    updateVarietyTotals();
}

// Reset variety inputs
function resetVarietyInputs() {
    COOKIE_VARIETIES.forEach(variety => {
        document.getElementById(`initialCases${variety}`).value = 0;
        document.getElementById(`initialBoxes${variety}`).value = 0;
        document.getElementById(`remainingCases${variety}`).value = 0;
        document.getElementById(`remainingBoxes${variety}`).value = 0;
    });
    
    updateVarietyTotals();
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

// Increment event quantity
function incrementEventQty(inputId) {
    const input = document.getElementById(inputId);
    if (input) {
        input.value = parseInt(input.value || 0) + 1;
        // Trigger change event to update any calculations
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

// Decrement event quantity
function decrementEventQty(inputId) {
    const input = document.getElementById(inputId);
    if (input) {
        const currentValue = parseInt(input.value || 0);
        if (currentValue > 0) {
            input.value = currentValue - 1;
            // Trigger change event to update any calculations
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }
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

    // Filter for only completed orders
    const completedSales = sales.filter(sale => isOrderComplete(sale));

    // Calculate total boxes (completed sales + donations + event booth boxes)
    const salesBoxes = completedSales.reduce((sum, sale) => sum + convertToBoxes(sale), 0);
    const donationBoxes = donations.reduce((sum, donation) => sum + (donation.boxCount || 0), 0);

    // Calculate boxes sold from booth events (initial - remaining)
    const eventBoothBoxes = events.reduce((sum, event) => {
        const totalInitial = (event.initialBoxes || 0) + ((event.initialCases || 0) * BOXES_PER_CASE);
        const totalRemaining = (event.remainingBoxes || 0) + ((event.remainingCases || 0) * BOXES_PER_CASE);
        const totalSold = Math.max(0, totalInitial - totalRemaining);
        return sum + totalSold;
    }, 0);

    const totalBoxes = salesBoxes + donationBoxes + eventBoothBoxes;

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

    // Get order status fields
    const orderSource = document.getElementById('orderSource').value;
    const paymentStatus = document.getElementById('paymentStatus').value;
    const deliveryStatus = document.getElementById('deliveryStatus').value;
    const orderStatus = document.getElementById('orderStatusInput').value;

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
    const orderNumberPrefix = orderSource === 'Online' ? 'ONL' : 'MAN';
    const orderNumber = `${orderNumberPrefix}-${Date.now()}`;
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
                orderSource,
                paymentStatus,
                deliveryStatus,
                orderStatus,
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
    const donationsReceived = parseFloat(eventDonationsInput.value) || 0;
    
    if (!eventName || !eventDate) {
        alert('Please enter event name and date.');
        return;
    }
    
    // Collect variety data
    const varietyData = collectVarietyData();
    
    // Calculate totals from variety data
    let initialTotal = 0;
    let remainingTotal = 0;
    COOKIE_VARIETIES.forEach(variety => {
        initialTotal += varietyData[`initial${variety}`];
        remainingTotal += varietyData[`remaining${variety}`];
    });
    
    const event = {
        eventName,
        eventDate: new Date(eventDate).toISOString(),
        description,
        initialBoxes: initialTotal % BOXES_PER_CASE,
        initialCases: Math.floor(initialTotal / BOXES_PER_CASE),
        remainingBoxes: remainingTotal % BOXES_PER_CASE,
        remainingCases: Math.floor(remainingTotal / BOXES_PER_CASE),
        donationsReceived,
        ...varietyData
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
    resetVarietyInputs();
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
    eventDonationsInput.value = event.donationsReceived;
    
    // Populate variety inputs
    populateVarietyInputs(event);
    
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
        const totalInitial = (event.initialBoxes || 0) + ((event.initialCases || 0) * BOXES_PER_CASE);
        const totalRemaining = (event.remainingBoxes || 0) + ((event.remainingCases || 0) * BOXES_PER_CASE);
        const totalSold = Math.max(0, totalInitial - totalRemaining); // Prevent negative values
        const revenue = totalSold * PRICE_PER_BOX;
        
        // Generate variety breakdown
        const varietyBreakdown = generateVarietyBreakdown(event);
        
        return `
            <div class="event-item">
                <div class="event-header">
                    <div class="event-name">${event.eventName}</div>
                    <div class="event-date">${formattedDate}</div>
                </div>
                ${event.description ? `<div class="event-description">${event.description}</div>` : ''}
                <div class="event-stats">
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
                ${varietyBreakdown}
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

// Generate variety breakdown HTML for event display
function generateVarietyBreakdown(event) {
    const varietyNames = {
        'ThinMints': 'Thin Mints®',
        'Samoas': 'Samoas®',
        'Tagalongs': 'Tagalongs®',
        'Trefoils': 'Trefoils®',
        'DosiDos': 'Do-si-dos®',
        'LemonUps': 'Lemon-Ups®',
        'Adventurefuls': 'Adventurefuls®',
        'Exploremores': 'Exploremores™',
        'Toffeetastic': 'Toffee-tastic®'
    };
    
    let initialTotalBoxes = 0;
    let remainingTotalBoxes = 0;
    
    let initialRows = '';
    let remainingRows = '';
    
    COOKIE_VARIETIES.forEach(variety => {
        const initialBoxes = event[`initial${variety}`] || 0;
        const remainingBoxes = event[`remaining${variety}`] || 0;
        
        initialTotalBoxes += initialBoxes;
        remainingTotalBoxes += remainingBoxes;
        
        // Only show rows with non-zero values
        if (initialBoxes > 0) {
            const cases = Math.floor(initialBoxes / BOXES_PER_CASE);
            const boxes = initialBoxes % BOXES_PER_CASE;
            initialRows += `
                <div class="event-variety-display-row">
                    <span class="variety-name">${varietyNames[variety]}</span>
                    <span class="variety-cases">${cases}</span>
                    <span class="variety-boxes">${boxes}</span>
                    <span class="variety-total">${initialBoxes}</span>
                </div>
            `;
        }
        
        if (remainingBoxes > 0) {
            const cases = Math.floor(remainingBoxes / BOXES_PER_CASE);
            const boxes = remainingBoxes % BOXES_PER_CASE;
            remainingRows += `
                <div class="event-variety-display-row">
                    <span class="variety-name">${varietyNames[variety]}</span>
                    <span class="variety-cases">${cases}</span>
                    <span class="variety-boxes">${boxes}</span>
                    <span class="variety-total">${remainingBoxes}</span>
                </div>
            `;
        }
    });
    
    // If no variety data, return empty string
    if (initialTotalBoxes === 0 && remainingTotalBoxes === 0) {
        return '';
    }
    
    const initialCases = Math.floor(initialTotalBoxes / BOXES_PER_CASE);
    const initialRemBoxes = initialTotalBoxes % BOXES_PER_CASE;
    const remainingCases = Math.floor(remainingTotalBoxes / BOXES_PER_CASE);
    const remainingRemBoxes = remainingTotalBoxes % BOXES_PER_CASE;
    
    return `
        <div class="event-variety-breakdown">
            ${initialRows ? `
            <div class="variety-section">
                <h4>Initial Inventory</h4>
                <div class="event-variety-display-table">
                    <div class="event-variety-display-header">
                        <span class="variety-name-col">Variety</span>
                        <span class="variety-cases-col">Cases</span>
                        <span class="variety-boxes-col">Boxes</span>
                        <span class="variety-total-col">Total Boxes</span>
                    </div>
                    ${initialRows}
                    <div class="event-variety-display-footer">
                        <span class="variety-name-col">Total</span>
                        <span class="variety-cases-col">${initialCases}</span>
                        <span class="variety-boxes-col">${initialRemBoxes}</span>
                        <span class="variety-total-col">${initialTotalBoxes}</span>
                    </div>
                </div>
            </div>
            ` : ''}
            ${remainingRows ? `
            <div class="variety-section">
                <h4>Remaining Inventory</h4>
                <div class="event-variety-display-table">
                    <div class="event-variety-display-header">
                        <span class="variety-name-col">Variety</span>
                        <span class="variety-cases-col">Cases</span>
                        <span class="variety-boxes-col">Boxes</span>
                        <span class="variety-total-col">Total Boxes</span>
                    </div>
                    ${remainingRows}
                    <div class="event-variety-display-footer">
                        <span class="variety-name-col">Total</span>
                        <span class="variety-cases-col">${remainingCases}</span>
                        <span class="variety-boxes-col">${remainingRemBoxes}</span>
                        <span class="variety-total-col">${remainingTotalBoxes}</span>
                    </div>
                </div>
            </div>
            ` : ''}
        </div>
    `;
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
                orderSource: sale.orderSource || 'Manual',
                paymentStatus: sale.paymentStatus || 'Not Paid',
                deliveryStatus: sale.deliveryStatus || (sale.orderSource === 'Online' ? 'Not Shipped' : 'Not Delivered'),
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
                        <th>Source</th>
                        <th>Payment</th>
                        <th>Delivery</th>
                        <th>Status</th>
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

        // Determine actual status based on business logic
        // Check if order is truly complete (paid AND delivered)
        const isOnline = order.orderSource === 'Online';

        // Payment is considered complete when there's no balance due
        // If amounts haven't been entered yet (both 0), default to not paid
        const hasFinancialData = order.totalDue > 0 || order.totalCollected > 0;
        const actuallyPaid = hasFinancialData && order.totalDue === 0;

        const actuallyDelivered = order.deliveryStatus === 'Delivered' || order.deliveryStatus === 'Shipped';

        // Derive display values from orderStatus and actual data
        let displayPaymentStatus, displayDeliveryStatus, displayOrderStatus;

        if (order.orderStatus === 'Delivered') {
            // If marked as Delivered, assume everything is complete
            displayPaymentStatus = 'Paid';
            displayDeliveryStatus = 'Delivered';
            displayOrderStatus = 'Complete';
        } else if (order.orderStatus === 'Shipped') {
            // If shipped, payment must be done, delivery in progress
            displayPaymentStatus = 'Paid';
            displayDeliveryStatus = isOnline ? 'Shipped' : 'Delivered';
            displayOrderStatus = 'Shipped';
        } else {
            // For Pending status, use actual financial data as source of truth
            displayPaymentStatus = actuallyPaid ? 'Paid' : 'Not Paid';
            displayDeliveryStatus = order.deliveryStatus || (isOnline ? 'Not Shipped' : 'Not Delivered');

            // Determine overall status from actual data
            if (actuallyPaid && actuallyDelivered) {
                displayOrderStatus = 'Complete';
            } else if (actuallyPaid && !actuallyDelivered) {
                displayOrderStatus = 'Paid - Awaiting Delivery';
            } else if (!actuallyPaid && actuallyDelivered) {
                displayOrderStatus = 'Delivered - Awaiting Payment';
            } else {
                displayOrderStatus = 'Pending';
            }
        }

        // Create status badges (payment and delivery are clickable)
        const sourceBadge = `<span class="status-badge badge-source badge-${order.orderSource.toLowerCase()}">${order.orderSource}</span>`;
        const paymentBadge = `<span class="status-badge badge-payment badge-${displayPaymentStatus === 'Paid' ? 'paid' : 'unpaid'} clickable-badge" onclick="togglePaymentStatus('${order.key}'); event.stopPropagation();" title="Click to toggle payment status">${displayPaymentStatus}</span>`;
        const deliveryBadge = `<span class="status-badge badge-delivery badge-${displayDeliveryStatus.toLowerCase().replace(/\s+/g, '-')} clickable-badge" onclick="toggleDeliveryStatus('${order.key}'); event.stopPropagation();" title="Click to toggle delivery status">${displayDeliveryStatus}</span>`;

        // Status badge with appropriate icon
        const statusBadgeClass = displayOrderStatus.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
        const statusIcons = {
            'Complete': '✓ ',
            'Delivered': '✓ ',
            'Shipped': '✓ ',
            'Pending': '⧖ '
        };
        const statusIcon = statusIcons[displayOrderStatus] || (displayOrderStatus.includes('Paid') ? '💰 ' : (displayOrderStatus.includes('Delivered') ? '📦 ' : '⧖ '));

        const statusBadge = `<span class="status-badge badge-status badge-${statusBadgeClass}">${statusIcon}${displayOrderStatus}</span>`;

        // Determine status class for row coloring based on display status
        let statusClass = '';
        if (displayOrderStatus === 'Complete') {
            statusClass = 'status-complete';
        } else if (displayOrderStatus.includes('Paid') && displayOrderStatus.includes('Awaiting Delivery')) {
            statusClass = 'status-paid-pending-delivery';
        } else if (displayOrderStatus.includes('Delivered') && displayOrderStatus.includes('Awaiting Payment')) {
            statusClass = 'status-delivered-pending-payment';
        } else {
            statusClass = 'status-pending';
        }

        html += `
            <tr class="${statusClass}" data-order-key="${order.key}">
                <td class="customer-name">
                    <a href="#" onclick="showOrderDetails('${order.key}'); return false;">${order.customerName}</a>
                </td>
                <td>${order.totalBoxes}</td>
                <td>${formattedDate}</td>
                <td>${sourceBadge}</td>
                <td>${paymentBadge}</td>
                <td>${deliveryBadge}</td>
                <td>${statusBadge}</td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
        <div class="status-legend">
            <span class="legend-item"><span class="legend-color status-complete"></span> Completed</span>
            <span class="legend-item"><span class="legend-color status-paid-pending-delivery"></span> Paid, Awaiting Delivery</span>
            <span class="legend-item"><span class="legend-color status-delivered-pending-payment"></span> Delivered, Awaiting Payment</span>
            <span class="legend-item"><span class="legend-color status-pending"></span> Pending</span>
        </div>
    `;

    salesList.innerHTML = html;
}

// Toggle payment status for an order
async function togglePaymentStatus(orderKey) {
    const orderSales = sales.filter(s => getOrderKey(s) === orderKey);
    if (orderSales.length === 0) return;

    const firstSale = orderSales[0];
    const currentPaymentStatus = firstSale.paymentStatus || 'Not Paid';
    const newPaymentStatus = currentPaymentStatus === 'Paid' ? 'Not Paid' : 'Paid';

    // Also update financial data based on new payment status
    let updateData = {
        paymentStatus: newPaymentStatus
    };

    // If marking as paid, set amountDue to 0 on first sale
    if (newPaymentStatus === 'Paid') {
        updateData.amountDue = 0;
    }

    // Check if order should be marked as complete
    const currentDeliveryStatus = firstSale.deliveryStatus || 'Not Delivered';
    const isDelivered = currentDeliveryStatus === 'Delivered' || currentDeliveryStatus === 'Shipped';

    // If both paid and delivered, mark orderStatus as Delivered (shows as Complete)
    if (newPaymentStatus === 'Paid' && isDelivered) {
        updateData.orderStatus = 'Delivered';
    } else if (firstSale.orderStatus === 'Delivered') {
        // If unmarking paid or delivered, revert to Pending
        updateData.orderStatus = 'Pending';
    }

    try {
        // Update all sales in the order
        const updatePromises = orderSales.map(sale =>
            fetch(`${API_BASE_URL}/sales/${sale.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            })
        );

        await Promise.all(updatePromises);

        // Reload and re-render
        await loadSales();
        renderSales();
        updateSummary();
        showFeedback(`Payment status updated to: ${newPaymentStatus}`);
    } catch (error) {
        console.error('Error updating payment status:', error);
        alert('Failed to update payment status. Please try again.');
    }
}

// Toggle delivery status for an order
async function toggleDeliveryStatus(orderKey) {
    const orderSales = sales.filter(s => getOrderKey(s) === orderKey);
    if (orderSales.length === 0) return;

    const firstSale = orderSales[0];
    const currentDeliveryStatus = firstSale.deliveryStatus || 'Not Delivered';
    const orderSource = firstSale.orderSource || 'Manual';

    // Toggle between delivered/not delivered states based on order source
    let newDeliveryStatus;
    if (orderSource === 'Online') {
        newDeliveryStatus = currentDeliveryStatus === 'Shipped' ? 'Not Shipped' : 'Shipped';
    } else {
        newDeliveryStatus = currentDeliveryStatus === 'Delivered' ? 'Not Delivered' : 'Delivered';
    }

    let updateData = {
        deliveryStatus: newDeliveryStatus
    };

    // Check if order should be marked as complete
    const currentPaymentStatus = firstSale.paymentStatus || 'Not Paid';
    const isPaid = currentPaymentStatus === 'Paid' || (firstSale.amountDue === 0 && firstSale.amountCollected > 0);
    const isDelivered = newDeliveryStatus === 'Delivered' || newDeliveryStatus === 'Shipped';

    // If both paid and delivered, mark orderStatus as Delivered (shows as Complete)
    if (isPaid && isDelivered) {
        updateData.orderStatus = 'Delivered';
    } else if (firstSale.orderStatus === 'Delivered') {
        // If unmarking paid or delivered, revert to Pending
        updateData.orderStatus = 'Pending';
    }

    try {
        // Update all sales in the order
        const updatePromises = orderSales.map(sale =>
            fetch(`${API_BASE_URL}/sales/${sale.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            })
        );

        await Promise.all(updatePromises);

        // Reload and re-render
        await loadSales();
        renderSales();
        updateSummary();
        showFeedback(`Delivery status updated to: ${newDeliveryStatus}`);
    } catch (error) {
        console.error('Error updating delivery status:', error);
        alert('Failed to update delivery status. Please try again.');
    }
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
                                <option value="Shipped" ${firstSale.orderStatus === 'Shipped' ? 'selected' : ''}>Shipped</option>
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
    // Filter for only completed orders (Paid + Delivered/Shipped)
    const completedSales = sales.filter(sale => isOrderComplete(sale));

    // Calculate sales boxes (converting cases to boxes where needed) - ONLY COMPLETED
    const salesBoxes = completedSales.reduce((sum, sale) => sum + convertToBoxes(sale), 0);

    // Calculate donation boxes (Cookie Share) - donations always count
    const donationBoxes = donations.reduce((sum, donation) => sum + (donation.boxCount || 0), 0);

    // Calculate boxes sold from booth events (initial - remaining) - events always count
    const eventBoothBoxes = events.reduce((sum, event) => {
        const totalInitial = (event.initialBoxes || 0) + ((event.initialCases || 0) * BOXES_PER_CASE);
        const totalRemaining = (event.remainingBoxes || 0) + ((event.remainingCases || 0) * BOXES_PER_CASE);
        const totalSold = Math.max(0, totalInitial - totalRemaining);
        return sum + totalSold;
    }, 0);

    const totalBoxes = salesBoxes + donationBoxes + eventBoothBoxes;

    const individualBoxes = completedSales.filter(s => s.saleType === 'individual').reduce((sum, sale) => sum + convertToBoxes(sale), 0);
    const eventBoxes = completedSales.filter(s => s.saleType === 'event').reduce((sum, sale) => sum + convertToBoxes(sale), 0);

    const salesRevenue = salesBoxes * PRICE_PER_BOX;
    const eventBoothRevenue = eventBoothBoxes * PRICE_PER_BOX;
    const totalDonationAmount = donations.reduce((sum, donation) => sum + donation.amount, 0);
    const eventDonationsAmount = events.reduce((sum, event) => sum + (event.donationsReceived || 0), 0);

    const totalRevenue = salesRevenue + eventBoothRevenue + totalDonationAmount + eventDonationsAmount;

    totalBoxesElement.textContent = totalBoxes;
    // Update labels to be more clear if needed, or just keep as is
    individualSalesElement.textContent = `${individualBoxes} boxes`;
    eventSalesElement.textContent = `${eventBoxes + eventBoothBoxes} boxes`;

    totalRevenueElement.textContent = `$${totalRevenue.toFixed(2)}`;
    totalDonationsElement.textContent = `$${(totalDonationAmount + eventDonationsAmount).toFixed(2)}`;
}

// Update cookie breakdown
function updateBreakdown() {
    // Filter for only completed orders
    const completedSales = sales.filter(sale => isOrderComplete(sale));

    if (completedSales.length === 0) {
        cookieBreakdownElement.innerHTML = '<p class="empty-message">No completed orders yet.</p>';
        return;
    }

    // Calculate totals by cookie type (converting cases to boxes) - ONLY COMPLETED
    const breakdown = {};
    completedSales.forEach(sale => {
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

// Update inventory reconciliation view
function updateInventoryReconciliation() {
    const reconciliationElement = document.getElementById('inventoryReconciliation');
    if (!reconciliationElement) return;

    // Get pending sales (not completed)
    const pendingSales = sales.filter(sale => !isOrderComplete(sale));

    if (pendingSales.length === 0) {
        reconciliationElement.innerHTML = '<p class="empty-message">✓ No pending orders. All orders are completed!</p>';
        return;
    }

    // Calculate boxes needed per cookie type for pending orders
    const pendingNeeds = {};
    pendingSales.forEach(sale => {
        const boxes = convertToBoxes(sale);
        const type = sale.cookieType;
        if (!pendingNeeds[type]) {
            pendingNeeds[type] = 0;
        }
        pendingNeeds[type] += boxes;
    });

    // Get current inventory from profile
    const currentInventory = {
        'Thin Mints': (profile && profile.inventoryThinMints) || 0,
        'Samoas': (profile && profile.inventorySamoas) || 0,
        'Tagalongs': (profile && profile.inventoryTagalongs) || 0,
        'Trefoils': (profile && profile.inventoryTrefoils) || 0,
        'Do-si-dos': (profile && profile.inventoryDosiDos) || 0,
        'Lemon-Ups': (profile && profile.inventoryLemonUps) || 0,
        'Adventurefuls': (profile && profile.inventoryAdventurefuls) || 0,
        'Exploremores': (profile && profile.inventoryExploremores) || 0,
        'Toffee-tastic': (profile && profile.inventoryToffeetastic) || 0
    };

    // Calculate shortage/surplus for each cookie type
    const reconciliation = [];
    Object.keys(pendingNeeds).forEach(cookieType => {
        const needed = pendingNeeds[cookieType];
        const onHand = currentInventory[cookieType] || 0;
        const shortage = needed - onHand;

        reconciliation.push({
            cookieType,
            needed,
            onHand,
            shortage,
            status: shortage > 0 ? 'short' : 'ok'
        });
    });

    // Sort by shortage (most critical first)
    reconciliation.sort((a, b) => b.shortage - a.shortage);

    // Build HTML
    let html = `
        <div class="reconciliation-summary">
            <div class="summary-stat">
                <span class="stat-label">Pending Orders</span>
                <span class="stat-value">${pendingSales.length}</span>
            </div>
            <div class="summary-stat">
                <span class="stat-label">Cookie Types Needed</span>
                <span class="stat-value">${Object.keys(pendingNeeds).length}</span>
            </div>
            <div class="summary-stat alert">
                <span class="stat-label">Shortages</span>
                <span class="stat-value">${reconciliation.filter(r => r.status === 'short').length}</span>
            </div>
        </div>
        <div class="reconciliation-table-container">
            <table class="reconciliation-table">
                <thead>
                    <tr>
                        <th>Cookie Type</th>
                        <th>Needed</th>
                        <th>On Hand</th>
                        <th>Shortage</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
    `;

    reconciliation.forEach(item => {
        const statusBadge = item.status === 'short'
            ? `<span class="recon-badge badge-shortage">⚠ Order ${item.shortage} boxes</span>`
            : `<span class="recon-badge badge-ok">✓ Sufficient</span>`;

        const rowClass = item.status === 'short' ? 'recon-row-shortage' : '';

        html += `
            <tr class="${rowClass}">
                <td class="cookie-name-col">${item.cookieType}</td>
                <td>${item.needed}</td>
                <td>${item.onHand}</td>
                <td>${item.shortage > 0 ? item.shortage : '—'}</td>
                <td>${statusBadge}</td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
    `;

    reconciliationElement.innerHTML = html;
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

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const modal = document.getElementById('exportModal');
    if (event.target === modal) {
        closeExportModal();
    }
});

// Update delivery status options based on order source
function updateDeliveryStatusOptions() {
    const orderSource = document.getElementById('orderSource').value;
    const deliveryStatusSelect = document.getElementById('deliveryStatus');

    // Clear existing options
    deliveryStatusSelect.innerHTML = '';

    if (orderSource === 'Online') {
        deliveryStatusSelect.innerHTML = `
            <option value="Not Shipped">Not Shipped</option>
            <option value="Shipped">Shipped</option>
        `;
    } else {
        deliveryStatusSelect.innerHTML = `
            <option value="Not Delivered">Not Delivered</option>
            <option value="Delivered">Delivered</option>
        `;
    }
}
