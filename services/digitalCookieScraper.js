/**
 * Digital Cookie Store Scraper Service
 * Handles authentication and order data extraction from the Girl Scouts Digital Cookie platform
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const logger = require('../logger');

// Use stealth plugin to avoid bot detection
puppeteer.use(StealthPlugin());

class DigitalCookieScraper {
    constructor() {
        this.browser = null;
        this.page = null;
        this.baseUrl = 'https://digitalcookie.girlscouts.org';
        this.loginUrl = 'https://digitalcookie.girlscouts.org/login';
    }

    /**
     * Initialize the browser instance
     */
    async init() {
        try {
            this.browser = await puppeteer.launch({
                headless: 'new',
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu',
                    '--window-size=1280,800'
                ]
            });
            this.page = await this.browser.newPage();
            await this.page.setViewport({ width: 1280, height: 800 });
            await this.page.setUserAgent(
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            );
            logger.info('Digital Cookie scraper browser initialized');
        } catch (error) {
            logger.error('Failed to initialize browser', { error: error.message });
            throw error;
        }
    }

    /**
     * Log in to the Digital Cookie platform
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {boolean} - True if login successful
     */
    async login(email, password) {
        try {
            logger.info('Attempting Digital Cookie login');

            // Navigate to login page
            await this.page.goto(this.loginUrl, { waitUntil: 'networkidle2', timeout: 30000 });

            // Log current URL in case of redirect
            const currentUrl = this.page.url();
            logger.info('Login page loaded', { url: currentUrl });

            // Give the page a moment to fully render any dynamic content
            await new Promise(r => setTimeout(r, 2000));

            // Check for and handle cookie consent / popup overlays
            await this.dismissOverlays();

            // Wait for login form with expanded selector list
            const emailSelectors = [
                '#username',
                'input[name="j_username"]',
                'input[type="email"]',
                'input[name="email"]',
                '#email',
                'input[placeholder*="email" i]',
                'input[name="username"]',
                'input[id*="email" i]',
                'input[id*="user" i]',
                'input[type="text"][name*="user" i]',
                'input[autocomplete="email"]',
                'input[autocomplete="username"]'
            ];

            // Try to find any email/username input
            let emailSelector = null;
            try {
                await this.page.waitForSelector(emailSelectors.join(', '), { timeout: 10000 });
                emailSelector = await this.findSelector(emailSelectors);
            } catch (waitError) {
                // Take a debug screenshot to see what the page looks like
                const screenshotPath = '/tmp/digitalcookie-login-debug.png';
                await this.takeScreenshot(screenshotPath);
                logger.error('Could not find email field, screenshot saved', { screenshotPath, pageUrl: this.page.url() });

                // Log page content for debugging
                const bodyText = await this.page.evaluate(() => document.body?.innerText?.substring(0, 500) || 'No body content');
                logger.error('Page content preview', { bodyText });

                throw new Error(`Could not find email input field. Page URL: ${this.page.url()}. Debug screenshot saved to ${screenshotPath}`);
            }

            // Fill email/username field (Digital Cookie uses #username)
            if (emailSelector) {
                logger.info('Filling username field', { selector: emailSelector });
                await this.page.evaluate((selector, value) => {
                    const el = document.querySelector(selector);
                    if (el) {
                        el.value = '';  // Clear first
                        el.focus();
                        el.value = value;
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }, emailSelector, email);
                await new Promise(r => setTimeout(r, 300));
            } else {
                throw new Error('Could not find username input field');
            }

            // Fill password field (Digital Cookie uses #password)
            const passwordSelectors = [
                '#password',
                'input[name="j_password"]',
                'input[type="password"]',
                'input[name="password"]',
                'input[id*="password" i]',
                'input[autocomplete="current-password"]'
            ];
            const passwordSelector = await this.findSelector(passwordSelectors);
            if (passwordSelector) {
                logger.info('Filling password field', { selector: passwordSelector });
                await this.page.evaluate((selector, value) => {
                    const el = document.querySelector(selector);
                    if (el) {
                        el.value = '';  // Clear first
                        el.focus();
                        el.value = value;
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }, passwordSelector, password);
                await new Promise(r => setTimeout(r, 300));
            } else {
                throw new Error('Could not find password input field');
            }

            // Find and click submit button (Digital Cookie uses #loginButton)
            const submitSelectors = [
                '#loginButton',
                'button[type="submit"]',
                'input[type="submit"]',
                '.login-btn',
                '#login-button',
                'button[id*="login" i]',
                'button[id*="submit" i]',
                'input[value*="Sign" i]',
                'input[value*="Log" i]'
            ];
            const submitSelector = await this.findSelector(submitSelectors);

            logger.info('Submitting login form', { selector: submitSelector || 'using Enter key' });

            try {
                if (submitSelector) {
                    // Use JS click for reliability
                    await this.page.evaluate((selector) => {
                        const el = document.querySelector(selector);
                        if (el) el.click();
                    }, submitSelector);
                } else {
                    // Try pressing Enter on the password field
                    await this.page.keyboard.press('Enter');
                }

                // Wait for navigation
                await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
            } catch (navError) {
                // Navigation might not happen if there's an error on the page
                logger.warn('Navigation after submit', { error: navError.message });
                await new Promise(r => setTimeout(r, 2000));
            }

            // Check if login was successful (should be redirected away from login page)
            const finalUrl = this.page.url();
            const loginSuccessful = !finalUrl.includes('/login');

            if (loginSuccessful) {
                logger.info('Digital Cookie login successful');
            } else {
                // Check for error messages
                const errorMessage = await this.page.evaluate(() => {
                    const errorEl = document.querySelector('.error, .alert-danger, [class*="error"]');
                    return errorEl ? errorEl.textContent.trim() : null;
                });
                logger.warn('Digital Cookie login failed', { errorMessage });
            }

            return loginSuccessful;
        } catch (error) {
            logger.error('Login failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Find the first matching selector from a list
     * @param {string[]} selectors - Array of selectors to try
     * @returns {string|null} - First matching selector or null
     */
    async findSelector(selectors) {
        for (const selector of selectors) {
            try {
                const element = await this.page.$(selector);
                if (element) {
                    return selector;
                }
            } catch {
                continue;
            }
        }
        return null;
    }

    /**
     * Dismiss cookie consent banner if present
     */
    async dismissOverlays() {
        try {
            // Digital Cookie uses this specific button ID for cookie consent
            const cookieButton = await this.page.$('#acceptAllCookieButton');
            if (cookieButton) {
                await this.page.evaluate(() => {
                    const btn = document.querySelector('#acceptAllCookieButton');
                    if (btn) btn.click();
                });
                logger.info('Cookie consent accepted');
                await new Promise(r => setTimeout(r, 1000));
            }
        } catch {
            // No cookie banner or already dismissed
        }
    }

    /**
     * Scrape orders from the orders page
     * Digital Cookie has two main tables:
     * 1. "Orders to deliver" - pending delivery orders
     * 2. "Completed Digital Cookie Online Orders" - completed/paid orders
     *
     * @param {string} storeUrl - URL to the orders page (cookieOrdersPage)
     * @returns {Object[]} - Array of order objects
     */
    async scrapeOrders(storeUrl) {
        try {
            logger.info('Navigating to orders page', { url: storeUrl });

            // Navigate to orders page
            await this.page.goto(storeUrl, { waitUntil: 'networkidle2', timeout: 30000 });

            // Wait for page content to load
            await new Promise(r => setTimeout(r, 3000));

            // Take debug screenshot
            await this.takeScreenshot('/tmp/orders-page-debug.png');

            // Extract orders from the page
            const orders = await this.page.evaluate(() => {
                const extractedOrders = [];

                // Helper to parse a date string
                const parseDate = (dateStr) => {
                    if (!dateStr) return null;
                    // Handle formats like "1/18/2026" or "12/10/2025"
                    return dateStr.trim();
                };

                // Helper to extract number from text (for box counts)
                const extractNumber = (text) => {
                    if (!text) return 0;
                    const match = text.match(/(\d+)/);
                    return match ? parseInt(match[1], 10) : 0;
                };

                // Find all tables on the page
                const tables = document.querySelectorAll('table');

                // Track which section we're in based on preceding headers
                let currentSection = 'unknown';

                // Look for section headers to understand context
                const allHeaders = document.querySelectorAll('h1, h2, h3, h4, h5, h6, .section-header, [class*="header"], [class*="title"]');
                const headerTexts = Array.from(allHeaders).map(h => ({
                    text: h.textContent.trim().toLowerCase(),
                    element: h
                }));

                tables.forEach((table, tableIndex) => {
                    // Try to determine which section this table belongs to
                    // by looking at text before the table
                    let tableSection = 'orders_to_deliver'; // default

                    // Check the page text for section indicators
                    const pageText = document.body.innerText.toLowerCase();

                    // Get table's preceding text/headers
                    let prevElement = table.previousElementSibling;
                    let attempts = 0;
                    while (prevElement && attempts < 5) {
                        const prevText = prevElement.textContent.toLowerCase();
                        if (prevText.includes('completed') || prevText.includes('online orders')) {
                            tableSection = 'completed';
                            break;
                        }
                        if (prevText.includes('orders to deliver') || prevText.includes('delivery')) {
                            tableSection = 'orders_to_deliver';
                            break;
                        }
                        if (prevText.includes('approve')) {
                            tableSection = 'orders_to_approve';
                            break;
                        }
                        prevElement = prevElement.previousElementSibling;
                        attempts++;
                    }

                    // Get headers from this table
                    const headerRow = table.querySelector('thead tr, tr:first-child');
                    const headers = [];
                    if (headerRow) {
                        const headerCells = headerRow.querySelectorAll('th, td');
                        headerCells.forEach(cell => {
                            headers.push(cell.textContent.trim().toLowerCase());
                        });
                    }

                    // Process data rows
                    const rows = table.querySelectorAll('tbody tr, tr');

                    rows.forEach((row, rowIndex) => {
                        // Skip header row
                        if (rowIndex === 0 && row.querySelector('th')) return;

                        const cells = row.querySelectorAll('td');
                        if (cells.length < 3) return; // Skip rows with too few cells

                        const rowText = row.textContent.trim();

                        // Skip empty or info rows
                        if (rowText.includes('no orders') || rowText.includes('at this time')) return;

                        const order = {
                            orderNumber: null,
                            customerName: null,
                            customerEmail: null,
                            customerPhone: null,
                            customerAddress: null,
                            orderDate: null,
                            orderType: null,        // "In-Person delivery" or "Shipped"
                            orderStatus: null,      // "Shipped", "Delivered", "Approved for Delivery"
                            paymentMethod: null,    // How it was paid
                            cookies: [],
                            totalBoxes: 0,          // "pkgs" = boxes
                            isPaid: false,
                            isCompleted: false,
                            isDonation: false,
                            isWebsiteOrder: true,   // All Digital Cookie orders are website orders
                            tableSection: tableSection
                        };

                        // Parse cells based on headers or position
                        cells.forEach((cell, cellIndex) => {
                            const cellText = cell.textContent.trim();
                            const header = headers[cellIndex] || '';

                            // Match by header name
                            if (header.includes('cookie') && header.includes('pkg')) {
                                order.totalBoxes = extractNumber(cellText);
                            } else if (header.includes('deliver to') || header.includes('name') || header.includes('customer')) {
                                if (!order.customerName) order.customerName = cellText;
                            } else if (header.includes('address') || header.includes('delivery address')) {
                                order.customerAddress = cellText;
                            } else if (header.includes('date') && !header.includes('initial')) {
                                order.orderDate = parseDate(cellText);
                            } else if (header.includes('initial order')) {
                                // This indicates if it was an initial order
                            } else if (header.includes('payment') || header.includes('paid')) {
                                order.paymentMethod = cellText;
                                if (cellText && cellText.toLowerCase() !== 'unpaid') {
                                    order.isPaid = true;
                                }
                            } else if (header.includes('status')) {
                                order.orderStatus = cellText;
                                if (cellText.toLowerCase() === 'delivered') {
                                    order.isCompleted = true;
                                }
                            } else if (header.includes('type')) {
                                order.orderType = cellText;
                            }

                            // Also check for order number in links or data attributes
                            const links = cell.querySelectorAll('a');
                            links.forEach(link => {
                                const href = link.getAttribute('href') || '';
                                const onclick = link.getAttribute('onclick') || '';

                                // Extract order ID from URLs like /order/123456
                                const orderMatch = href.match(/order[\/=](\d+)/i) || onclick.match(/order[^\d]*(\d+)/i);
                                if (orderMatch && !order.orderNumber) {
                                    order.orderNumber = orderMatch[1];
                                }
                            });

                            // Check for order number in cell text (9-digit numbers)
                            if (!order.orderNumber) {
                                const orderNumMatch = cellText.match(/^(\d{8,12})$/);
                                if (orderNumMatch) {
                                    order.orderNumber = orderNumMatch[1];
                                }
                            }
                        });

                        // If no headers, try positional parsing based on Digital Cookie structure
                        // Typical structure: [checkbox], Order#, Boxes, Name, Address, Date, [Status/Action]
                        if (headers.length === 0 || !order.customerName) {
                            const cellTexts = Array.from(cells).map(c => c.textContent.trim());

                            cellTexts.forEach((text, idx) => {
                                // Order number (8-12 digit number)
                                if (/^\d{8,12}$/.test(text) && !order.orderNumber) {
                                    order.orderNumber = text;
                                }
                                // Box count (small number, usually 1-50)
                                else if (/^\d{1,3}$/.test(text) && !order.totalBoxes) {
                                    const num = parseInt(text, 10);
                                    if (num > 0 && num < 100) {
                                        order.totalBoxes = num;
                                    }
                                }
                                // Date (contains /)
                                else if (/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(text) && !order.orderDate) {
                                    order.orderDate = text;
                                }
                                // Address (contains comma or street indicators)
                                else if ((text.includes(',') || /\d+\s+\w+\s+(rd|st|ave|dr|ln|way|blvd)/i.test(text)) && !order.customerAddress) {
                                    order.customerAddress = text;
                                }
                                // Name (text without special patterns, not too short, not "VIEW" or similar)
                                else if (text.length > 2 && text.length < 50 && /^[A-Za-z\s\-']+$/.test(text) && !order.customerName) {
                                    // Skip common action words that aren't names
                                    const skipWords = ['view', 'edit', 'delete', 'approve', 'decline', 'select', 'order', 'delivered'];
                                    if (!skipWords.includes(text.toLowerCase())) {
                                        order.customerName = text;
                                    }
                                }
                            });
                        }

                        // Determine payment status from table section
                        if (tableSection === 'completed') {
                            order.isPaid = true;
                            order.isCompleted = true;
                        }

                        // Check for donation indicators
                        if (rowText.toLowerCase().includes('donate') || rowText.toLowerCase().includes('donation')) {
                            order.isDonation = true;
                        }

                        // Determine order type from content
                        if (rowText.toLowerCase().includes('shipped') || rowText.toLowerCase().includes('ship')) {
                            order.orderType = 'Shipped';
                            if (rowText.toLowerCase().includes('shipped')) {
                                order.orderStatus = 'Shipped';
                            }
                        } else if (rowText.toLowerCase().includes('in-person') || rowText.toLowerCase().includes('delivery')) {
                            order.orderType = 'In-Person delivery';
                        }

                        // Determine order status from content
                        if (!order.orderStatus) {
                            if (rowText.toLowerCase().includes('delivered')) {
                                order.orderStatus = 'Delivered';
                                order.isCompleted = true;
                            } else if (rowText.toLowerCase().includes('approved')) {
                                order.orderStatus = 'Approved for Delivery';
                            } else if (rowText.toLowerCase().includes('pending')) {
                                order.orderStatus = 'Pending';
                            }
                        }

                        // Only add if we have meaningful data
                        if (order.orderNumber || order.customerName) {
                            // Check for duplicates
                            const exists = extractedOrders.some(o =>
                                o.orderNumber === order.orderNumber &&
                                o.customerName === order.customerName &&
                                o.orderDate === order.orderDate
                            );
                            if (!exists) {
                                extractedOrders.push(order);
                            }
                        }
                    });
                });

                // Return extracted orders with debug info
                return {
                    orders: extractedOrders,
                    debug: {
                        tablesFound: tables.length,
                        totalOrdersExtracted: extractedOrders.length
                    }
                };
            });

            // Extract orders and debug info
            const result = orders;
            const extractedOrders = result.orders || [];

            // Log detailed info about each order for debugging
            logger.info('Scraped orders from Digital Cookie', {
                tablesFound: result.debug?.tablesFound || 0,
                orderCount: extractedOrders.length,
                paidOrders: extractedOrders.filter(o => o.isPaid).length,
                completedOrders: extractedOrders.filter(o => o.isCompleted).length,
                totalBoxes: extractedOrders.reduce((sum, o) => sum + (o.totalBoxes || 0), 0),
                orderDetails: extractedOrders.map(o => ({
                    name: o.customerName,
                    boxes: o.totalBoxes,
                    date: o.orderDate,
                    section: o.tableSection,
                    orderNum: o.orderNumber
                }))
            });

            return extractedOrders;
        } catch (error) {
            logger.error('Failed to scrape orders', { error: error.message });
            throw error;
        }
    }

    /**
     * Get the page content for debugging
     * @returns {string} - HTML content
     */
    async getPageContent() {
        return await this.page.content();
    }

    /**
     * Take a screenshot for debugging
     * @param {string} path - Path to save screenshot
     */
    async takeScreenshot(path) {
        try {
            await this.page.screenshot({ path, fullPage: true });
            logger.info('Screenshot saved', { path });
        } catch (error) {
            logger.error('Failed to save screenshot', { error: error.message });
        }
    }

    /**
     * Close the browser instance
     */
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
            logger.info('Digital Cookie scraper browser closed');
        }
    }
}

module.exports = DigitalCookieScraper;
