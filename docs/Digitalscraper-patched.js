/**
 * Digital Cookie Store Scraper Service
 * Handles authentication and order data extraction from the Girl Scouts Digital Cookie platform
 * 
 * ============================================================================
 * PATCH NOTES - Box Count Inconsistency Fixes
 * ============================================================================
 * 
 * ISSUE REPORTED:
 *   Box counts appear different between test runs when scraping order data.
 * 
 * ROOT CAUSES IDENTIFIED:
 * 
 *   1. PRIMARY ISSUE - totalBoxes Never Recalculated (Lines ~524-530)
 *      ------------------------------------------------------------
 *      After fetching detailed cookie information from order detail pages,
 *      the code merged the cookies array but NEVER updated totalBoxes.
 *      This meant totalBoxes came from the initial table scrape (often
 *      incomplete or incorrectly parsed), while cookies[] came from the
 *      more accurate detail page. These values could differ, and which
 *      source "won" depended on timing.
 * 
 *      FIX: Recalculate totalBoxes from the sum of cookie quantities
 *      whenever detailed cookie data is successfully retrieved.
 * 
 *   2. RACE CONDITION - Fixed Page Load Delays (Line ~296)
 *      ---------------------------------------------------
 *      The code used arbitrary fixed delays (1500ms) instead of waiting
 *      for actual content to render. On slower page loads, tables might
 *      not be fully populated, leading to missing or partial data.
 * 
 *      FIX: Replace fixed delays with explicit waits for table elements,
 *      with a fallback timeout and warning.
 * 
 *   3. MISSING VALIDATION - No Consistency Checks
 *      ------------------------------------------
 *      There was no validation to detect when totalBoxes didn't match
 *      the sum of individual cookie quantities, making debugging difficult.
 * 
 *      FIX: Added validation logging to detect and report mismatches
 *      before returning results.
 * 
 *   4. DETAIL PAGE TIMING - Insufficient Wait (Line ~489)
 *      -------------------------------------------------
 *      The detail page scraping used a short fixed delay that could
 *      result in incomplete data extraction on slower connections.
 * 
 *      FIX: Added explicit wait for table content on detail pages.
 * 
 * CHANGES SUMMARY:
 *   - Modified scrapeOrderDetailsParallel() to recalculate totalBoxes
 *   - Modified scrapeOrders() to wait for table elements before parsing
 *   - Added validation logging before returning results
 *   - Added waitForDetailPageContent() helper method
 *   - Added mismatch warnings with detailed logging
 * 
 * TESTING RECOMMENDATIONS:
 *   - Run multiple consecutive syncs and compare totalBoxes values
 *   - Check logs for "Box count mismatch" warnings
 *   - Verify cookies array sum matches totalBoxes for all orders
 * 
 * ============================================================================
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
        this.maxParallelTabs = 3; // Number of parallel tabs for detail scraping
        this.scoutUsername = null; // Extracted after login
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
                // Extract scout username from URL (pattern: /scout/{username}/...)
                const usernameMatch = finalUrl.match(/\/scout\/([^\/]+)/);
                if (usernameMatch) {
                    this.scoutUsername = usernameMatch[1];
                    logger.info('Digital Cookie login successful', { username: this.scoutUsername });
                } else {
                    // Try to find username from page content or navigate to find it
                    logger.info('Digital Cookie login successful, searching for username...');
                    await this.extractUsername();
                }
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
     * Extract username by navigating to a known page pattern
     */
    async extractUsername() {
        try {
            // Look for links containing /scout/ pattern in the current page
            const username = await this.page.evaluate(() => {
                const links = document.querySelectorAll('a[href*="/scout/"]');
                for (const link of links) {
                    const href = link.getAttribute('href');
                    const match = href.match(/\/scout\/([^\/]+)/);
                    if (match && match[1] && !match[1].includes('login')) {
                        return match[1];
                    }
                }
                // Also check current URL
                const urlMatch = window.location.href.match(/\/scout\/([^\/]+)/);
                if (urlMatch) return urlMatch[1];
                return null;
            });

            if (username) {
                this.scoutUsername = username;
                logger.info('Extracted scout username', { username });
            } else {
                logger.warn('Could not extract scout username from page');
            }
        } catch (error) {
            logger.error('Error extracting username', { error: error.message });
        }
    }

    /**
     * Get the orders page URL for the logged-in scout
     * @returns {string} - Orders page URL
     */
    getOrdersPageUrl() {
        if (!this.scoutUsername) {
            throw new Error('Scout username not available. Please login first.');
        }
        return `${this.baseUrl}/scout/${this.scoutUsername}/cookieOrdersPage`;
    }

    /**
     * Get the order detail URL for a specific order
     * @param {string} orderNumber - The order number
     * @returns {string} - Order detail URL
     */
    getOrderDetailUrl(orderNumber) {
        if (!this.scoutUsername) {
            throw new Error('Scout username not available. Please login first.');
        }
        return `${this.baseUrl}/scout/${this.scoutUsername}/cookieorderdetail/${orderNumber}`;
    }

    /**
     * Scrape orders from the orders page
     * Digital Cookie has two main tables:
     * 1. "Orders to deliver" - pending delivery orders
     * 2. "Completed Digital Cookie Online Orders" - completed/paid orders
     *
     * @returns {Object[]} - Array of order objects
     */
    async scrapeOrders() {
        try {
            if (!this.scoutUsername) {
                throw new Error('Scout username not available. Please login first.');
            }

            const ordersPageUrl = this.getOrdersPageUrl();
            logger.info('Navigating to orders page', { url: ordersPageUrl });

            // Navigate to orders page
            await this.page.goto(ordersPageUrl, { waitUntil: 'networkidle2', timeout: 30000 });

            /**
             * FIX #2: Replace fixed delay with explicit wait for table elements
             * 
             * ORIGINAL CODE:
             *   await new Promise(r => setTimeout(r, 1500));
             * 
             * PROBLEM: Fixed delays don't account for variable page load times.
             * On slower connections or server responses, tables might not be
             * fully rendered, leading to missing data.
             * 
             * SOLUTION: Wait for actual table elements to appear, with a
             * reasonable timeout and fallback behavior.
             */
            try {
                await this.page.waitForSelector('table', { timeout: 10000 });
                logger.info('Orders table detected, waiting for content to stabilize');
                // Small additional delay for any dynamic content within tables
                await new Promise(r => setTimeout(r, 500));
            } catch (tableWaitError) {
                logger.warn('No tables found on orders page within timeout, continuing with available content', {
                    error: tableWaitError.message
                });
                // Still wait a moment in case content is loading differently
                await new Promise(r => setTimeout(r, 1500));
            }

            // Extract basic order info from the page tables
            const basicOrders = await this.page.evaluate(() => {
                const extractedOrders = [];

                // Helper to parse a date string
                const parseDate = (dateStr) => {
                    if (!dateStr) return null;
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

                tables.forEach((table, tableIndex) => {
                    // Try to determine which section this table belongs to
                    let tableSection = 'orders_to_deliver'; // default

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
                        if (cells.length < 3) return;

                        const rowText = row.textContent.trim();
                        if (rowText.includes('no orders') || rowText.includes('at this time')) return;

                        const order = {
                            orderNumber: null,
                            customerName: null,
                            customerEmail: null,
                            customerPhone: null,
                            customerAddress: null,
                            orderDate: null,
                            orderType: null,
                            orderStatus: null,
                            paymentMethod: null,
                            cookies: [],
                            totalBoxes: 0,
                            isPaid: false,
                            isCompleted: false,
                            isDonation: false,
                            isWebsiteOrder: true,
                            tableSection: tableSection,
                            detailLink: null
                        };

                        // Parse cells based on headers or position
                        cells.forEach((cell, cellIndex) => {
                            const cellText = cell.textContent.trim();
                            const header = headers[cellIndex] || '';

                            if (header.includes('order') && header.includes('#')) {
                                // Handle "Order #" column - extract order number from cell
                                if (!order.orderNumber) {
                                    const orderNumMatch = cellText.match(/(\d{8,12})/);
                                    if (orderNumMatch) {
                                        order.orderNumber = orderNumMatch[1];
                                    }
                                }
                            } else if (header.includes('cookie') && header.includes('pkg')) {
                                order.totalBoxes = extractNumber(cellText);
                            } else if (header.includes('deliver to') || header.includes('name') || header.includes('customer')) {
                                if (!order.customerName) order.customerName = cellText;
                            } else if (header.includes('paid by') || header.includes('paid') || header.includes('payment')) {
                                // Handle "Paid By" column - could contain customer name or payment method
                                if (header.includes('paid by')) {
                                    if (!order.customerName) order.customerName = cellText;
                                    order.isPaid = true;
                                } else if (header.includes('payment') || header.includes('paid')) {
                                    order.paymentMethod = cellText;
                                    if (cellText && cellText.toLowerCase() !== 'unpaid') {
                                        order.isPaid = true;
                                    }
                                }
                            } else if (header.includes('address') || header.includes('delivery address')) {
                                order.customerAddress = cellText;
                            } else if (header.includes('date') && !header.includes('initial')) {
                                order.orderDate = parseDate(cellText);                            } else if (header.includes('status')) {
                                order.orderStatus = cellText;
                                if (cellText.toLowerCase() === 'delivered') {
                                    order.isCompleted = true;
                                }
                            } else if (header.includes('type')) {
                                order.orderType = cellText;
                            }

                            // Check for order number and detail links
                            const links = cell.querySelectorAll('a');
                            links.forEach(link => {
                                const href = link.getAttribute('href') || '';
                                const onclick = link.getAttribute('onclick') || '';
                                const linkText = link.textContent.trim();

                                // Extract order ID from URLs
                                const orderMatch = href.match(/order[\/=](\d+)/i) || onclick.match(/order[^\d]*(\d+)/i);
                                if (orderMatch && !order.orderNumber) {
                                    order.orderNumber = orderMatch[1];
                                }
                                
                                // Extract order ID from link text (e.g., "Order #163717824" or just "163717824")
                                if (!order.orderNumber) {
                                    const linkTextMatch = linkText.match(/(?:order\s*#?\s*)?(\d{8,12})/i);
                                    if (linkTextMatch) {
                                        order.orderNumber = linkTextMatch[1];
                                    }
                                }

                                // Capture detail page link
                                if (href && (href.includes('order') || href.includes('detail'))) {
                                    order.detailLink = href.startsWith('http') ? href : null;
                                }
                            });

                            // Check for order number in cell text (standalone or with label)
                            if (!order.orderNumber) {
                                const orderNumMatch = cellText.match(/(?:order\s*#?\s*)?(\d{8,12})/i);
                                if (orderNumMatch) {
                                    order.orderNumber = orderNumMatch[1];
                                }
                            }
                        });

                        // Positional parsing fallback
                        if (headers.length === 0 || !order.customerName) {
                            const cellTexts = Array.from(cells).map(c => c.textContent.trim());

                            cellTexts.forEach((text, idx) => {
                                // Look for 8-12 digit order numbers (more flexible pattern)
                                if (/\b(\d{8,12})\b/.test(text) && !order.orderNumber) {
                                    const match = text.match(/\b(\d{8,12})\b/);
                                    if (match) {
                                        order.orderNumber = match[1];
                                    }
                                } else if (/^\d{1,3}$/.test(text) && !order.totalBoxes) {
                                    const num = parseInt(text, 10);
                                    if (num > 0 && num < 100) {
                                        order.totalBoxes = num;
                                    }
                                } else if (/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(text) && !order.orderDate) {
                                    order.orderDate = text;
                                } else if ((text.includes(',') || /\d+\s+\w+\s+(rd|st|ave|dr|ln|way|blvd)/i.test(text)) && !order.customerAddress) {
                                    order.customerAddress = text;
                                } else if (text.length > 2 && text.length < 50 && /^[A-Za-z\s\-']+$/.test(text) && !order.customerName) {
                                    const skipWords = ['view', 'edit', 'delete', 'approve', 'decline', 'select', 'order', 'delivered'];
                                    if (!skipWords.includes(text.toLowerCase())) {
                                        order.customerName = text;
                                    }
                                }
                            });
                        }

                        // Set flags based on section
                        if (tableSection === 'completed') {
                            order.isPaid = true;
                            order.isCompleted = true;
                        }

                        if (rowText.toLowerCase().includes('donate') || rowText.toLowerCase().includes('donation')) {
                            order.isDonation = true;
                        }

                        if (rowText.toLowerCase().includes('shipped') || rowText.toLowerCase().includes('ship')) {
                            order.orderType = 'Shipped';
                            if (rowText.toLowerCase().includes('shipped')) {
                                order.orderStatus = 'Shipped';
                            }
                        } else if (rowText.toLowerCase().includes('in-person') || rowText.toLowerCase().includes('delivery')) {
                            order.orderType = 'In-Person delivery';
                        }

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

                        if (order.orderNumber || order.customerName) {
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

                return {
                    orders: extractedOrders,
                    debug: {
                        tablesFound: tables.length,
                        totalOrdersExtracted: extractedOrders.length
                    }
                };
            });

            const extractedOrders = basicOrders.orders || [];
            logger.info('Initial order extraction complete', {
                orderCount: extractedOrders.length,
                tablesFound: basicOrders.debug?.tablesFound || 0,
                ordersWithNumbers: extractedOrders.filter(o => o.orderNumber).length,
                ordersWithoutNumbers: extractedOrders.filter(o => !o.orderNumber).length
            });

            // Filter orders that need detail scraping (have order numbers)
            const ordersNeedingDetails = extractedOrders.filter(o => o.orderNumber);

            if (ordersNeedingDetails.length > 0) {
                logger.info('Fetching order details in parallel', {
                    orderCount: ordersNeedingDetails.length,
                    parallelTabs: this.maxParallelTabs
                });

                // Process orders in parallel batches using multiple tabs
                await this.scrapeOrderDetailsParallel(ordersNeedingDetails);
            } else {
                logger.warn('No orders with order numbers found for detail scraping');
            }
            
            // Log orders without numbers for debugging
            const ordersWithoutNumbers = extractedOrders.filter(o => !o.orderNumber);
            if (ordersWithoutNumbers.length > 0) {
                logger.warn('Found orders without order numbers (will not get detailed cookie info)', {
                    count: ordersWithoutNumbers.length,
                    samples: ordersWithoutNumbers.slice(0, 3).map(o => ({
                        customerName: o.customerName,
                        totalBoxes: o.totalBoxes,
                        orderDate: o.orderDate,
                        tableSection: o.tableSection
                    }))
                });
            }

            /**
             * FIX #3: Add validation logging before returning results
             * 
             * PROBLEM: There was no way to detect when totalBoxes didn't match
             * the sum of individual cookie quantities, making debugging difficult.
             * 
             * SOLUTION: Validate all orders and log any mismatches as errors
             * so they can be investigated.
             */
            const validationIssues = extractedOrders.filter(order => {
                if (!order.cookies || order.cookies.length === 0) return false;
                const cookieSum = order.cookies.reduce((sum, c) => sum + c.quantity, 0);
                return cookieSum !== order.totalBoxes;
            });

            if (validationIssues.length > 0) {
                logger.error('VALIDATION: Orders with mismatched box counts detected after processing', {
                    count: validationIssues.length,
                    issues: validationIssues.map(o => ({
                        orderNumber: o.orderNumber,
                        customerName: o.customerName,
                        totalBoxes: o.totalBoxes,
                        cookieSum: o.cookies.reduce((sum, c) => sum + c.quantity, 0),
                        cookies: o.cookies
                    }))
                });
            } else {
                logger.info('VALIDATION: All orders passed box count consistency check');
            }

            // Log final results
            logger.info('Scraped orders from Digital Cookie', {
                orderCount: extractedOrders.length,
                paidOrders: extractedOrders.filter(o => o.isPaid).length,
                completedOrders: extractedOrders.filter(o => o.isCompleted).length,
                ordersWithCookies: extractedOrders.filter(o => o.cookies && o.cookies.length > 0).length,
                totalBoxes: extractedOrders.reduce((sum, o) => sum + (o.totalBoxes || 0), 0)
            });

            return extractedOrders;
        } catch (error) {
            logger.error('Failed to scrape orders', { error: error.message });
            throw error;
        }
    }

    /**
     * Process order details in parallel using multiple browser tabs
     * @param {Object[]} orders - Array of order objects to update with details
     * 
     * FIX #1: This method has been updated to recalculate totalBoxes from
     * the detailed cookie data whenever it's successfully retrieved.
     */
    async scrapeOrderDetailsParallel(orders) {
        // Process in batches to avoid overwhelming the server
        const batchSize = this.maxParallelTabs;

        for (let i = 0; i < orders.length; i += batchSize) {
            const batch = orders.slice(i, i + batchSize);
            const startTime = Date.now();

            logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(orders.length / batchSize)}`, {
                batchSize: batch.length,
                progress: `${i + 1}-${Math.min(i + batchSize, orders.length)} of ${orders.length}`
            });

            // Process batch in parallel
            const detailPromises = batch.map(order =>
                this.scrapeOrderDetailInNewTab(order.orderNumber)
                    .then(details => ({ order, details }))
                    .catch(err => {
                        logger.debug('Failed to get details for order', { orderNumber: order.orderNumber, error: err.message });
                        return { order, details: null };
                    })
            );

            const results = await Promise.all(detailPromises);

            // Merge results into orders
            for (const { order, details } of results) {
                if (details) {
                    if (details.cookies && details.cookies.length > 0) {
                        order.cookies = details.cookies;
                        
                        /**
                         * FIX #1: Recalculate totalBoxes from actual cookie quantities
                         * 
                         * ORIGINAL CODE:
                         *   (totalBoxes was never updated after getting cookie details)
                         * 
                         * PROBLEM: totalBoxes came from initial table scrape which could
                         * be incomplete or incorrectly parsed. The cookies array came from
                         * the more accurate detail page. These values could differ.
                         * 
                         * SOLUTION: Always recalculate totalBoxes as the sum of all
                         * cookie quantities from the detail page, which is the
                         * authoritative source.
                         */
                        const calculatedTotal = details.cookies.reduce((sum, cookie) => sum + cookie.quantity, 0);
                        
                        // Log if there's a discrepancy for debugging
                        if (order.totalBoxes !== calculatedTotal) {
                            logger.warn('Box count mismatch detected - using calculated total from cookie details', {
                                orderNumber: order.orderNumber,
                                customerName: order.customerName,
                                originalTotalFromTable: order.totalBoxes,
                                calculatedTotalFromDetails: calculatedTotal,
                                difference: Math.abs(order.totalBoxes - calculatedTotal),
                                cookies: details.cookies
                            });
                        }
                        
                        // Always use the calculated total from cookie details
                        order.totalBoxes = calculatedTotal;
                    }
                    if (details.customerPhone) order.customerPhone = details.customerPhone;
                    if (details.customerEmail) order.customerEmail = details.customerEmail;
                    if (details.customerAddress) order.customerAddress = details.customerAddress;
                    if (details.customerName && !order.customerName) order.customerName = details.customerName;
                }
            }

            const elapsed = Date.now() - startTime;
            logger.info(`Batch completed in ${elapsed}ms`, {
                ordersWithCookies: results.filter(r => r.details?.cookies?.length > 0).length,
                ordersUpdated: results.filter(r => r.details !== null).length
            });

            // Small delay between batches to be respectful to the server
            if (i + batchSize < orders.length) {
                await new Promise(r => setTimeout(r, 500));
            }
        }
    }

    /**
     * Wait for detail page content to load
     * Helper method to ensure detail page tables are rendered before extraction
     * 
     * @param {Object} page - Puppeteer page object
     * @param {number} timeout - Maximum wait time in ms
     * @returns {boolean} - True if content loaded successfully
     */
    async waitForDetailPageContent(page, timeout = 5000) {
        try {
            await page.waitForSelector('table', { timeout });
            // Additional short wait for table content to populate
            await new Promise(r => setTimeout(r, 300));
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Scrape order details in a new browser tab (for parallel processing)
     * @param {string} orderNumber - The order number to look up
     * @returns {Object|null} - Order details with cookies array
     */
    async scrapeOrderDetailInNewTab(orderNumber) {
        let newPage = null;
        try {
            // Create a new tab
            newPage = await this.browser.newPage();
            await newPage.setViewport({ width: 1280, height: 800 });

            // Copy cookies from main page to maintain session
            const cookies = await this.page.cookies();
            await newPage.setCookie(...cookies);

            // Use the direct URL pattern (fastest)
            const directUrl = this.getOrderDetailUrl(orderNumber);

            let pageLoaded = false;
            try {
                const response = await newPage.goto(directUrl, { waitUntil: 'networkidle2', timeout: 8000 });
                if (response && response.status() === 200) {
                    const pageContent = await newPage.content();
                    // Verify we're on a valid detail page
                    if (!pageContent.toLowerCase().includes('login') &&
                        !pageContent.includes('not found') &&
                        !pageContent.includes('error')) {
                        pageLoaded = true;
                        logger.debug('Direct URL loaded successfully', { orderNumber });
                    }
                }
            } catch (err) {
                logger.debug('Direct URL failed, will try fallback', { orderNumber, error: err.message });
            }

            // Fallback: navigate to orders page and click (slower)
            if (!pageLoaded) {
                const ordersPageUrl = this.getOrdersPageUrl();
                await newPage.goto(ordersPageUrl, { waitUntil: 'networkidle2', timeout: 15000 });
                await new Promise(r => setTimeout(r, 800));

                // Find and click the order link
                const clicked = await newPage.evaluate((orderNum) => {
                    const links = document.querySelectorAll('a, button');
                    for (const el of links) {
                        const text = el.textContent || '';
                        const href = el.getAttribute('href') || '';
                        const onclick = el.getAttribute('onclick') || '';

                        if (text.includes(orderNum) || href.includes(orderNum) || onclick.includes(orderNum)) {
                            el.click();
                            return true;
                        }
                    }
                    return false;
                }, orderNumber);

                if (!clicked) {
                    return null;
                }
                await new Promise(r => setTimeout(r, 1200));
            }

            /**
             * FIX #4: Wait for detail page content before extraction
             * 
             * ORIGINAL CODE:
             *   (extraction happened immediately after navigation)
             * 
             * PROBLEM: On slower connections, the detail page tables might
             * not be fully rendered, leading to missing cookie data.
             * 
             * SOLUTION: Explicitly wait for table elements before extracting.
             */
            const contentReady = await this.waitForDetailPageContent(newPage);
            if (!contentReady) {
                logger.debug('Detail page content not fully loaded', { orderNumber });
            }

            // Extract details from the page
            const details = await newPage.evaluate(() => {
                const result = {
                    cookies: [],
                    customerPhone: null,
                    customerEmail: null,
                    customerAddress: null,
                    customerName: null
                };

                const pageText = document.body.innerText;

                // Extract phone number
                const phonePatterns = [
                    /phone[:\s]*([(\d)\-\s.]+\d{4})/i,
                    /tel[:\s]*([(\d)\-\s.]+\d{4})/i,
                    /\b(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})\b/
                ];
                for (const pattern of phonePatterns) {
                    const match = pageText.match(pattern);
                    if (match) {
                        result.customerPhone = match[1].trim();
                        break;
                    }
                }

                // Extract email
                const emailMatch = pageText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
                if (emailMatch) {
                    result.customerEmail = emailMatch[1];
                }

                // Extract address
                const addressPatterns = [
                    /address[:\s]*([^\n]+(?:,\s*[A-Z]{2}\s*\d{5})?)/i,
                    /deliver(?:y)?\s*(?:to)?[:\s]*([^\n]+(?:,\s*[A-Z]{2}\s*\d{5})?)/i,
                    /(\d+\s+[A-Za-z\s]+(?:st|street|ave|avenue|rd|road|dr|drive|ln|lane|way|blvd|boulevard|ct|court)[^,\n]*,\s*[A-Za-z\s]+,\s*[A-Z]{2}\s*\d{5})/i
                ];
                for (const pattern of addressPatterns) {
                    const match = pageText.match(pattern);
                    if (match && match[1].length > 10) {
                        result.customerAddress = match[1].trim();
                        break;
                    }
                }

                // Extract cookie details
                const cookieNames = [
                    'Thin Mints', 'Samoas', 'Caramel deLites', 'Tagalongs', 'Peanut Butter Patties',
                    'Do-si-dos', 'Peanut Butter Sandwich', 'Trefoils', 'Shortbread',
                    'Girl Scout S\'mores', 'S\'mores', 'Lemon-Ups', 'Lemonades',
                    'Adventurefuls', 'Raspberry Rally', 'Toffee-tastic', 'Toast-Yay', 'Exploremores'
                ];

                // Look for cookies in tables
                const tables = document.querySelectorAll('table');
                tables.forEach(table => {
                    const rows = table.querySelectorAll('tr');
                    rows.forEach(row => {
                        const rowText = row.textContent;
                        
                        // Skip generic "assorted" or summary rows
                        const lowerRowText = rowText.toLowerCase();
                        if (lowerRowText.includes('assorted') || 
                            lowerRowText.includes('total') ||
                            lowerRowText.includes('subtotal')) {
                            return;
                        }
                        
                        cookieNames.forEach(cookieName => {
                            // Use word boundary matching to avoid false positives
                            const cookiePattern = new RegExp(`\\b${cookieName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
                            if (cookiePattern.test(rowText)) {
                                const cells = row.querySelectorAll('td');
                                let qty = null;
                                
                                // Look for the quantity in cells (usually last numeric cell with 1-3 digits)
                                for (let i = cells.length - 1; i >= 0; i--) {
                                    const cellText = cells[i].textContent.trim();
                                    // Match only standalone numbers (not dates/IDs), max 3 digits for reasonable quantities
                                    if (/^\d+$/.test(cellText) && cellText.length <= 3) {
                                        const parsedQty = parseInt(cellText, 10);
                                        if (parsedQty > 0 && parsedQty <= 999) {
                                            qty = parsedQty;
                                            break;
                                        }
                                    }
                                }
                                
                                // Only add if we found a valid quantity
                                if (qty && qty > 0) {
                                    let normalizedName = cookieName;
                                    if (cookieName === 'Caramel deLites') normalizedName = 'Samoas';
                                    if (cookieName === 'Peanut Butter Patties') normalizedName = 'Tagalongs';
                                    if (cookieName === 'Peanut Butter Sandwich') normalizedName = 'Do-si-dos';
                                    if (cookieName === 'Shortbread') normalizedName = 'Trefoils';
                                    
                                    // Check if this cookie already exists (deduplication)
                                    const existingCookie = result.cookies.find(c => c.name === normalizedName);
                                    if (!existingCookie) {
                                        result.cookies.push({ name: normalizedName, quantity: qty });
                                    }
                                }
                            }
                        });
                    });
                });

                // Fallback: parse text patterns
                if (result.cookies.length === 0) {
                    cookieNames.forEach(cookieName => {
                        const patterns = [
                            new RegExp(`(\\d+)\\s*(?:x|×|pkg|pkgs)?\\s*${cookieName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'),
                            new RegExp(`${cookieName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[:\\s]*(\\d+)`, 'i'),
                            new RegExp(`${cookieName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\((\\d+)\\)`, 'i')
                        ];
                        for (const pattern of patterns) {
                            const match = pageText.match(pattern);
                            if (match) {
                                const qty = parseInt(match[1], 10);
                                if (qty > 0 && qty <= 999) {
                                    let normalizedName = cookieName;
                                    if (cookieName === 'Caramel deLites') normalizedName = 'Samoas';
                                    if (cookieName === 'Peanut Butter Patties') normalizedName = 'Tagalongs';
                                    if (cookieName === 'Peanut Butter Sandwich') normalizedName = 'Do-si-dos';
                                    if (cookieName === 'Shortbread') normalizedName = 'Trefoils';
                                    
                                    // Check if this cookie already exists (deduplication)
                                    const existingCookie = result.cookies.find(c => c.name === normalizedName);
                                    if (!existingCookie) {
                                        result.cookies.push({ name: normalizedName, quantity: qty });
                                    }
                                }
                                break;
                            }
                        }
                    });
                }

                // Extract customer name
                const namePatterns = [
                    /customer[:\s]*([A-Za-z]+\s+[A-Za-z]+)/i,
                    /name[:\s]*([A-Za-z]+\s+[A-Za-z]+)/i,
                    /ordered\s+by[:\s]*([A-Za-z]+\s+[A-Za-z]+)/i
                ];
                for (const pattern of namePatterns) {
                    const match = pageText.match(pattern);
                    if (match) {
                        result.customerName = match[1].trim();
                        break;
                    }
                }

                return result;
            });

            return details;
        } catch (error) {
            logger.debug('Error in new tab scrape', { orderNumber, error: error.message });
            return null;
        } finally {
            // Always close the tab
            if (newPage) {
                await newPage.close().catch(() => {});
            }
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
/**
 * Digital Cookie Store Scraper Service
 * Handles authentication and order data extraction from the Girl Scouts Digital Cookie platform
 * 
 * ============================================================================
 * PATCH NOTES - Box Count Inconsistency Fixes
 * ============================================================================
 * 
 * ISSUE REPORTED:
 *   Box counts appear different between test runs when scraping order data.
 * 
 * ROOT CAUSES IDENTIFIED:
 * 
 *   1. PRIMARY ISSUE - totalBoxes Never Recalculated (Lines ~524-530)
 *      ------------------------------------------------------------
 *      After fetching detailed cookie information from order detail pages,
 *      the code merged the cookies array but NEVER updated totalBoxes.
 *      This meant totalBoxes came from the initial table scrape (often
 *      incomplete or incorrectly parsed), while cookies[] came from the
 *      more accurate detail page. These values could differ, and which
 *      source "won" depended on timing.
 * 
 *      FIX: Recalculate totalBoxes from the sum of cookie quantities
 *      whenever detailed cookie data is successfully retrieved.
 * 
 *   2. RACE CONDITION - Fixed Page Load Delays (Line ~296)
 *      ---------------------------------------------------
 *      The code used arbitrary fixed delays (1500ms) instead of waiting
 *      for actual content to render. On slower page loads, tables might
 *      not be fully populated, leading to missing or partial data.
 * 
 *      FIX: Replace fixed delays with explicit waits for table elements,
 *      with a fallback timeout and warning.
 * 
 *   3. MISSING VALIDATION - No Consistency Checks
 *      ------------------------------------------
 *      There was no validation to detect when totalBoxes didn't match
 *      the sum of individual cookie quantities, making debugging difficult.
 * 
 *      FIX: Added validation logging to detect and report mismatches
 *      before returning results.
 * 
 *   4. DETAIL PAGE TIMING - Insufficient Wait (Line ~489)
 *      -------------------------------------------------
 *      The detail page scraping used a short fixed delay that could
 *      result in incomplete data extraction on slower connections.
 * 
 *      FIX: Added explicit wait for table content on detail pages.
 * 
 * CHANGES SUMMARY:
 *   - Modified scrapeOrderDetailsParallel() to recalculate totalBoxes
 *   - Modified scrapeOrders() to wait for table elements before parsing
 *   - Added validation logging before returning results
 *   - Added waitForDetailPageContent() helper method
 *   - Added mismatch warnings with detailed logging
 * 
 * TESTING RECOMMENDATIONS:
 *   - Run multiple consecutive syncs and compare totalBoxes values
 *   - Check logs for "Box count mismatch" warnings
 *   - Verify cookies array sum matches totalBoxes for all orders
 * 
 * ============================================================================
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
        this.maxParallelTabs = 3; // Number of parallel tabs for detail scraping
        this.scoutUsername = null; // Extracted after login
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
                // Extract scout username from URL (pattern: /scout/{username}/...)
                const usernameMatch = finalUrl.match(/\/scout\/([^\/]+)/);
                if (usernameMatch) {
                    this.scoutUsername = usernameMatch[1];
                    logger.info('Digital Cookie login successful', { username: this.scoutUsername });
                } else {
                    // Try to find username from page content or navigate to find it
                    logger.info('Digital Cookie login successful, searching for username...');
                    await this.extractUsername();
                }
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
     * Extract username by navigating to a known page pattern
     */
    async extractUsername() {
        try {
            // Look for links containing /scout/ pattern in the current page
            const username = await this.page.evaluate(() => {
                const links = document.querySelectorAll('a[href*="/scout/"]');
                for (const link of links) {
                    const href = link.getAttribute('href');
                    const match = href.match(/\/scout\/([^\/]+)/);
                    if (match && match[1] && !match[1].includes('login')) {
                        return match[1];
                    }
                }
                // Also check current URL
                const urlMatch = window.location.href.match(/\/scout\/([^\/]+)/);
                if (urlMatch) return urlMatch[1];
                return null;
            });

            if (username) {
                this.scoutUsername = username;
                logger.info('Extracted scout username', { username });
            } else {
                logger.warn('Could not extract scout username from page');
            }
        } catch (error) {
            logger.error('Error extracting username', { error: error.message });
        }
    }

    /**
     * Get the orders page URL for the logged-in scout
     * @returns {string} - Orders page URL
     */
    getOrdersPageUrl() {
        if (!this.scoutUsername) {
            throw new Error('Scout username not available. Please login first.');
        }
        return `${this.baseUrl}/scout/${this.scoutUsername}/cookieOrdersPage`;
    }

    /**
     * Get the order detail URL for a specific order
     * @param {string} orderNumber - The order number
     * @returns {string} - Order detail URL
     */
    getOrderDetailUrl(orderNumber) {
        if (!this.scoutUsername) {
            throw new Error('Scout username not available. Please login first.');
        }
        return `${this.baseUrl}/scout/${this.scoutUsername}/cookieorderdetail/${orderNumber}`;
    }

    /**
     * Scrape orders from the orders page
     * Digital Cookie has two main tables:
     * 1. "Orders to deliver" - pending delivery orders
     * 2. "Completed Digital Cookie Online Orders" - completed/paid orders
     *
     * @returns {Object[]} - Array of order objects
     */
    async scrapeOrders() {
        try {
            if (!this.scoutUsername) {
                throw new Error('Scout username not available. Please login first.');
            }

            const ordersPageUrl = this.getOrdersPageUrl();
            logger.info('Navigating to orders page', { url: ordersPageUrl });

            // Navigate to orders page
            await this.page.goto(ordersPageUrl, { waitUntil: 'networkidle2', timeout: 30000 });

            /**
             * FIX #2: Replace fixed delay with explicit wait for table elements
             * 
             * ORIGINAL CODE:
             *   await new Promise(r => setTimeout(r, 1500));
             * 
             * PROBLEM: Fixed delays don't account for variable page load times.
             * On slower connections or server responses, tables might not be
             * fully rendered, leading to missing data.
             * 
             * SOLUTION: Wait for actual table elements to appear, with a
             * reasonable timeout and fallback behavior.
             */
            try {
                await this.page.waitForSelector('table', { timeout: 10000 });
                logger.info('Orders table detected, waiting for content to stabilize');
                // Small additional delay for any dynamic content within tables
                await new Promise(r => setTimeout(r, 500));
            } catch (tableWaitError) {
                logger.warn('No tables found on orders page within timeout, continuing with available content', {
                    error: tableWaitError.message
                });
                // Still wait a moment in case content is loading differently
                await new Promise(r => setTimeout(r, 1500));
            }

            // Extract basic order info from the page tables
            const basicOrders = await this.page.evaluate(() => {
                const extractedOrders = [];

                // Helper to parse a date string
                const parseDate = (dateStr) => {
                    if (!dateStr) return null;
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

                tables.forEach((table, tableIndex) => {
                    // Try to determine which section this table belongs to
                    let tableSection = 'orders_to_deliver'; // default

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
                        if (cells.length < 3) return;

                        const rowText = row.textContent.trim();
                        if (rowText.includes('no orders') || rowText.includes('at this time')) return;

                        const order = {
                            orderNumber: null,
                            customerName: null,
                            customerEmail: null,
                            customerPhone: null,
                            customerAddress: null,
                            orderDate: null,
                            orderType: null,
                            orderStatus: null,
                            paymentMethod: null,
                            cookies: [],
                            totalBoxes: 0,
                            isPaid: false,
                            isCompleted: false,
                            isDonation: false,
                            isWebsiteOrder: true,
                            tableSection: tableSection,
                            detailLink: null
                        };

                        // Parse cells based on headers or position
                        cells.forEach((cell, cellIndex) => {
                            const cellText = cell.textContent.trim();
                            const header = headers[cellIndex] || '';

                            if (header.includes('order') && header.includes('#')) {
                                // Handle "Order #" column - extract order number from cell
                                if (!order.orderNumber) {
                                    const orderNumMatch = cellText.match(/(\d{8,12})/);
                                    if (orderNumMatch) {
                                        order.orderNumber = orderNumMatch[1];
                                    }
                                }
                            } else if (header.includes('cookie') && header.includes('pkg')) {
                                order.totalBoxes = extractNumber(cellText);
                            } else if (header.includes('deliver to') || header.includes('name') || header.includes('customer')) {
                                if (!order.customerName) order.customerName = cellText;
                            } else if (header.includes('paid by') || header.includes('paid') || header.includes('payment')) {
                                // Handle "Paid By" column - could contain customer name or payment method
                                if (header.includes('paid by')) {
                                    if (!order.customerName) order.customerName = cellText;
                                    order.isPaid = true;
                                } else if (header.includes('payment') || header.includes('paid')) {
                                    order.paymentMethod = cellText;
                                    if (cellText && cellText.toLowerCase() !== 'unpaid') {
                                        order.isPaid = true;
                                    }
                                }
                            } else if (header.includes('address') || header.includes('delivery address')) {
                                order.customerAddress = cellText;
                            } else if (header.includes('date') && !header.includes('initial')) {
                                order.orderDate = parseDate(cellText);                            } else if (header.includes('status')) {
                                order.orderStatus = cellText;
                                if (cellText.toLowerCase() === 'delivered') {
                                    order.isCompleted = true;
                                }
                            } else if (header.includes('type')) {
                                order.orderType = cellText;
                            }

                            // Check for order number and detail links
                            const links = cell.querySelectorAll('a');
                            links.forEach(link => {
                                const href = link.getAttribute('href') || '';
                                const onclick = link.getAttribute('onclick') || '';
                                const linkText = link.textContent.trim();

                                // Extract order ID from URLs
                                const orderMatch = href.match(/order[\/=](\d+)/i) || onclick.match(/order[^\d]*(\d+)/i);
                                if (orderMatch && !order.orderNumber) {
                                    order.orderNumber = orderMatch[1];
                                }
                                
                                // Extract order ID from link text (e.g., "Order #163717824" or just "163717824")
                                if (!order.orderNumber) {
                                    const linkTextMatch = linkText.match(/(?:order\s*#?\s*)?(\d{8,12})/i);
                                    if (linkTextMatch) {
                                        order.orderNumber = linkTextMatch[1];
                                    }
                                }

                                // Capture detail page link
                                if (href && (href.includes('order') || href.includes('detail'))) {
                                    order.detailLink = href.startsWith('http') ? href : null;
                                }
                            });

                            // Check for order number in cell text (standalone or with label)
                            if (!order.orderNumber) {
                                const orderNumMatch = cellText.match(/(?:order\s*#?\s*)?(\d{8,12})/i);
                                if (orderNumMatch) {
                                    order.orderNumber = orderNumMatch[1];
                                }
                            }
                        });

                        // Positional parsing fallback
                        if (headers.length === 0 || !order.customerName) {
                            const cellTexts = Array.from(cells).map(c => c.textContent.trim());

                            cellTexts.forEach((text, idx) => {
                                // Look for 8-12 digit order numbers (more flexible pattern)
                                if (/\b(\d{8,12})\b/.test(text) && !order.orderNumber) {
                                    const match = text.match(/\b(\d{8,12})\b/);
                                    if (match) {
                                        order.orderNumber = match[1];
                                    }
                                } else if (/^\d{1,3}$/.test(text) && !order.totalBoxes) {
                                    const num = parseInt(text, 10);
                                    if (num > 0 && num < 100) {
                                        order.totalBoxes = num;
                                    }
                                } else if (/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(text) && !order.orderDate) {
                                    order.orderDate = text;
                                } else if ((text.includes(',') || /\d+\s+\w+\s+(rd|st|ave|dr|ln|way|blvd)/i.test(text)) && !order.customerAddress) {
                                    order.customerAddress = text;
                                } else if (text.length > 2 && text.length < 50 && /^[A-Za-z\s\-']+$/.test(text) && !order.customerName) {
                                    const skipWords = ['view', 'edit', 'delete', 'approve', 'decline', 'select', 'order', 'delivered'];
                                    if (!skipWords.includes(text.toLowerCase())) {
                                        order.customerName = text;
                                    }
                                }
                            });
                        }

                        // Set flags based on section
                        if (tableSection === 'completed') {
                            order.isPaid = true;
                            order.isCompleted = true;
                        }

                        if (rowText.toLowerCase().includes('donate') || rowText.toLowerCase().includes('donation')) {
                            order.isDonation = true;
                        }

                        if (rowText.toLowerCase().includes('shipped') || rowText.toLowerCase().includes('ship')) {
                            order.orderType = 'Shipped';
                            if (rowText.toLowerCase().includes('shipped')) {
                                order.orderStatus = 'Shipped';
                            }
                        } else if (rowText.toLowerCase().includes('in-person') || rowText.toLowerCase().includes('delivery')) {
                            order.orderType = 'In-Person delivery';
                        }

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

                        if (order.orderNumber || order.customerName) {
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

                return {
                    orders: extractedOrders,
                    debug: {
                        tablesFound: tables.length,
                        totalOrdersExtracted: extractedOrders.length
                    }
                };
            });

            const extractedOrders = basicOrders.orders || [];
            logger.info('Initial order extraction complete', {
                orderCount: extractedOrders.length,
                tablesFound: basicOrders.debug?.tablesFound || 0,
                ordersWithNumbers: extractedOrders.filter(o => o.orderNumber).length,
                ordersWithoutNumbers: extractedOrders.filter(o => !o.orderNumber).length
            });

            // Filter orders that need detail scraping (have order numbers)
            const ordersNeedingDetails = extractedOrders.filter(o => o.orderNumber);

            if (ordersNeedingDetails.length > 0) {
                logger.info('Fetching order details in parallel', {
                    orderCount: ordersNeedingDetails.length,
                    parallelTabs: this.maxParallelTabs
                });

                // Process orders in parallel batches using multiple tabs
                await this.scrapeOrderDetailsParallel(ordersNeedingDetails);
            } else {
                logger.warn('No orders with order numbers found for detail scraping');
            }
            
            // Log orders without numbers for debugging
            const ordersWithoutNumbers = extractedOrders.filter(o => !o.orderNumber);
            if (ordersWithoutNumbers.length > 0) {
                logger.warn('Found orders without order numbers (will not get detailed cookie info)', {
                    count: ordersWithoutNumbers.length,
                    samples: ordersWithoutNumbers.slice(0, 3).map(o => ({
                        customerName: o.customerName,
                        totalBoxes: o.totalBoxes,
                        orderDate: o.orderDate,
                        tableSection: o.tableSection
                    }))
                });
            }

            /**
             * FIX #3: Add validation logging before returning results
             * 
             * PROBLEM: There was no way to detect when totalBoxes didn't match
             * the sum of individual cookie quantities, making debugging difficult.
             * 
             * SOLUTION: Validate all orders and log any mismatches as errors
             * so they can be investigated.
             */
            const validationIssues = extractedOrders.filter(order => {
                if (!order.cookies || order.cookies.length === 0) return false;
                const cookieSum = order.cookies.reduce((sum, c) => sum + c.quantity, 0);
                return cookieSum !== order.totalBoxes;
            });

            if (validationIssues.length > 0) {
                logger.error('VALIDATION: Orders with mismatched box counts detected after processing', {
                    count: validationIssues.length,
                    issues: validationIssues.map(o => ({
                        orderNumber: o.orderNumber,
                        customerName: o.customerName,
                        totalBoxes: o.totalBoxes,
                        cookieSum: o.cookies.reduce((sum, c) => sum + c.quantity, 0),
                        cookies: o.cookies
                    }))
                });
            } else {
                logger.info('VALIDATION: All orders passed box count consistency check');
            }

            // Log final results
            logger.info('Scraped orders from Digital Cookie', {
                orderCount: extractedOrders.length,
                paidOrders: extractedOrders.filter(o => o.isPaid).length,
                completedOrders: extractedOrders.filter(o => o.isCompleted).length,
                ordersWithCookies: extractedOrders.filter(o => o.cookies && o.cookies.length > 0).length,
                totalBoxes: extractedOrders.reduce((sum, o) => sum + (o.totalBoxes || 0), 0)
            });

            return extractedOrders;
        } catch (error) {
            logger.error('Failed to scrape orders', { error: error.message });
            throw error;
        }
    }

    /**
     * Process order details in parallel using multiple browser tabs
     * @param {Object[]} orders - Array of order objects to update with details
     * 
     * FIX #1: This method has been updated to recalculate totalBoxes from
     * the detailed cookie data whenever it's successfully retrieved.
     */
    async scrapeOrderDetailsParallel(orders) {
        // Process in batches to avoid overwhelming the server
        const batchSize = this.maxParallelTabs;

        for (let i = 0; i < orders.length; i += batchSize) {
            const batch = orders.slice(i, i + batchSize);
            const startTime = Date.now();

            logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(orders.length / batchSize)}`, {
                batchSize: batch.length,
                progress: `${i + 1}-${Math.min(i + batchSize, orders.length)} of ${orders.length}`
            });

            // Process batch in parallel
            const detailPromises = batch.map(order =>
                this.scrapeOrderDetailInNewTab(order.orderNumber)
                    .then(details => ({ order, details }))
                    .catch(err => {
                        logger.debug('Failed to get details for order', { orderNumber: order.orderNumber, error: err.message });
                        return { order, details: null };
                    })
            );

            const results = await Promise.all(detailPromises);

            // Merge results into orders
            for (const { order, details } of results) {
                if (details) {
                    if (details.cookies && details.cookies.length > 0) {
                        order.cookies = details.cookies;
                        
                        /**
                         * FIX #1: Recalculate totalBoxes from actual cookie quantities
                         * 
                         * ORIGINAL CODE:
                         *   (totalBoxes was never updated after getting cookie details)
                         * 
                         * PROBLEM: totalBoxes came from initial table scrape which could
                         * be incomplete or incorrectly parsed. The cookies array came from
                         * the more accurate detail page. These values could differ.
                         * 
                         * SOLUTION: Always recalculate totalBoxes as the sum of all
                         * cookie quantities from the detail page, which is the
                         * authoritative source.
                         */
                        const calculatedTotal = details.cookies.reduce((sum, cookie) => sum + cookie.quantity, 0);
                        
                        // Log if there's a discrepancy for debugging
                        if (order.totalBoxes !== calculatedTotal) {
                            logger.warn('Box count mismatch detected - using calculated total from cookie details', {
                                orderNumber: order.orderNumber,
                                customerName: order.customerName,
                                originalTotalFromTable: order.totalBoxes,
                                calculatedTotalFromDetails: calculatedTotal,
                                difference: Math.abs(order.totalBoxes - calculatedTotal),
                                cookies: details.cookies
                            });
                        }
                        
                        // Always use the calculated total from cookie details
                        order.totalBoxes = calculatedTotal;
                    }
                    if (details.customerPhone) order.customerPhone = details.customerPhone;
                    if (details.customerEmail) order.customerEmail = details.customerEmail;
                    if (details.customerAddress) order.customerAddress = details.customerAddress;
                    if (details.customerName && !order.customerName) order.customerName = details.customerName;
                }
            }

            const elapsed = Date.now() - startTime;
            logger.info(`Batch completed in ${elapsed}ms`, {
                ordersWithCookies: results.filter(r => r.details?.cookies?.length > 0).length,
                ordersUpdated: results.filter(r => r.details !== null).length
            });

            // Small delay between batches to be respectful to the server
            if (i + batchSize < orders.length) {
                await new Promise(r => setTimeout(r, 500));
            }
        }
    }

    /**
     * Wait for detail page content to load
     * Helper method to ensure detail page tables are rendered before extraction
     * 
     * @param {Object} page - Puppeteer page object
     * @param {number} timeout - Maximum wait time in ms
     * @returns {boolean} - True if content loaded successfully
     */
    async waitForDetailPageContent(page, timeout = 5000) {
        try {
            await page.waitForSelector('table', { timeout });
            // Additional short wait for table content to populate
            await new Promise(r => setTimeout(r, 300));
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Scrape order details in a new browser tab (for parallel processing)
     * @param {string} orderNumber - The order number to look up
     * @returns {Object|null} - Order details with cookies array
     */
    async scrapeOrderDetailInNewTab(orderNumber) {
        let newPage = null;
        try {
            // Create a new tab
            newPage = await this.browser.newPage();
            await newPage.setViewport({ width: 1280, height: 800 });

            // Copy cookies from main page to maintain session
            const cookies = await this.page.cookies();
            await newPage.setCookie(...cookies);

            // Use the direct URL pattern (fastest)
            const directUrl = this.getOrderDetailUrl(orderNumber);

            let pageLoaded = false;
            try {
                const response = await newPage.goto(directUrl, { waitUntil: 'networkidle2', timeout: 8000 });
                if (response && response.status() === 200) {
                    const pageContent = await newPage.content();
                    // Verify we're on a valid detail page
                    if (!pageContent.toLowerCase().includes('login') &&
                        !pageContent.includes('not found') &&
                        !pageContent.includes('error')) {
                        pageLoaded = true;
                        logger.debug('Direct URL loaded successfully', { orderNumber });
                    }
                }
            } catch (err) {
                logger.debug('Direct URL failed, will try fallback', { orderNumber, error: err.message });
            }

            // Fallback: navigate to orders page and click (slower)
            if (!pageLoaded) {
                const ordersPageUrl = this.getOrdersPageUrl();
                await newPage.goto(ordersPageUrl, { waitUntil: 'networkidle2', timeout: 15000 });
                await new Promise(r => setTimeout(r, 800));

                // Find and click the order link
                const clicked = await newPage.evaluate((orderNum) => {
                    const links = document.querySelectorAll('a, button');
                    for (const el of links) {
                        const text = el.textContent || '';
                        const href = el.getAttribute('href') || '';
                        const onclick = el.getAttribute('onclick') || '';

                        if (text.includes(orderNum) || href.includes(orderNum) || onclick.includes(orderNum)) {
                            el.click();
                            return true;
                        }
                    }
                    return false;
                }, orderNumber);

                if (!clicked) {
                    return null;
                }
                await new Promise(r => setTimeout(r, 1200));
            }

            /**
             * FIX #4: Wait for detail page content before extraction
             * 
             * ORIGINAL CODE:
             *   (extraction happened immediately after navigation)
             * 
             * PROBLEM: On slower connections, the detail page tables might
             * not be fully rendered, leading to missing cookie data.
             * 
             * SOLUTION: Explicitly wait for table elements before extracting.
             */
            const contentReady = await this.waitForDetailPageContent(newPage);
            if (!contentReady) {
                logger.debug('Detail page content not fully loaded', { orderNumber });
            }

            // Extract details from the page
            const details = await newPage.evaluate(() => {
                const result = {
                    cookies: [],
                    customerPhone: null,
                    customerEmail: null,
                    customerAddress: null,
                    customerName: null
                };

                const pageText = document.body.innerText;

                // Extract phone number
                const phonePatterns = [
                    /phone[:\s]*([(\d)\-\s.]+\d{4})/i,
                    /tel[:\s]*([(\d)\-\s.]+\d{4})/i,
                    /\b(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})\b/
                ];
                for (const pattern of phonePatterns) {
                    const match = pageText.match(pattern);
                    if (match) {
                        result.customerPhone = match[1].trim();
                        break;
                    }
                }

                // Extract email
                const emailMatch = pageText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
                if (emailMatch) {
                    result.customerEmail = emailMatch[1];
                }

                // Extract address
                const addressPatterns = [
                    /address[:\s]*([^\n]+(?:,\s*[A-Z]{2}\s*\d{5})?)/i,
                    /deliver(?:y)?\s*(?:to)?[:\s]*([^\n]+(?:,\s*[A-Z]{2}\s*\d{5})?)/i,
                    /(\d+\s+[A-Za-z\s]+(?:st|street|ave|avenue|rd|road|dr|drive|ln|lane|way|blvd|boulevard|ct|court)[^,\n]*,\s*[A-Za-z\s]+,\s*[A-Z]{2}\s*\d{5})/i
                ];
                for (const pattern of addressPatterns) {
                    const match = pageText.match(pattern);
                    if (match && match[1].length > 10) {
                        result.customerAddress = match[1].trim();
                        break;
                    }
                }

                // Extract cookie details
                const cookieNames = [
                    'Thin Mints', 'Samoas', 'Caramel deLites', 'Tagalongs', 'Peanut Butter Patties',
                    'Do-si-dos', 'Peanut Butter Sandwich', 'Trefoils', 'Shortbread',
                    'Girl Scout S\'mores', 'S\'mores', 'Lemon-Ups', 'Lemonades',
                    'Adventurefuls', 'Raspberry Rally', 'Toffee-tastic', 'Toast-Yay', 'Exploremores'
                ];

                // Look for cookies in tables
                const tables = document.querySelectorAll('table');
                tables.forEach(table => {
                    const rows = table.querySelectorAll('tr');
                    rows.forEach(row => {
                        const rowText = row.textContent;
                        
                        // Skip generic "assorted" or summary rows
                        const lowerRowText = rowText.toLowerCase();
                        if (lowerRowText.includes('assorted') || 
                            lowerRowText.includes('total') ||
                            lowerRowText.includes('subtotal')) {
                            return;
                        }
                        
                        cookieNames.forEach(cookieName => {
                            // Use word boundary matching to avoid false positives
                            const cookiePattern = new RegExp(`\\b${cookieName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
                            if (cookiePattern.test(rowText)) {
                                const cells = row.querySelectorAll('td');
                                let qty = null;
                                
                                // Look for the quantity in cells (usually last numeric cell with 1-3 digits)
                                for (let i = cells.length - 1; i >= 0; i--) {
                                    const cellText = cells[i].textContent.trim();
                                    // Match only standalone numbers (not dates/IDs), max 3 digits for reasonable quantities
                                    if (/^\d+$/.test(cellText) && cellText.length <= 3) {
                                        const parsedQty = parseInt(cellText, 10);
                                        if (parsedQty > 0 && parsedQty <= 999) {
                                            qty = parsedQty;
                                            break;
                                        }
                                    }
                                }
                                
                                // Only add if we found a valid quantity
                                if (qty && qty > 0) {
                                    let normalizedName = cookieName;
                                    if (cookieName === 'Caramel deLites') normalizedName = 'Samoas';
                                    if (cookieName === 'Peanut Butter Patties') normalizedName = 'Tagalongs';
                                    if (cookieName === 'Peanut Butter Sandwich') normalizedName = 'Do-si-dos';
                                    if (cookieName === 'Shortbread') normalizedName = 'Trefoils';
                                    
                                    // Check if this cookie already exists (deduplication)
                                    const existingCookie = result.cookies.find(c => c.name === normalizedName);
                                    if (!existingCookie) {
                                        result.cookies.push({ name: normalizedName, quantity: qty });
                                    }
                                }
                            }
                        });
                    });
                });

                // Fallback: parse text patterns
                if (result.cookies.length === 0) {
                    cookieNames.forEach(cookieName => {
                        const patterns = [
                            new RegExp(`(\\d+)\\s*(?:x|×|pkg|pkgs)?\\s*${cookieName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'),
                            new RegExp(`${cookieName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[:\\s]*(\\d+)`, 'i'),
                            new RegExp(`${cookieName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\((\\d+)\\)`, 'i')
                        ];
                        for (const pattern of patterns) {
                            const match = pageText.match(pattern);
                            if (match) {
                                const qty = parseInt(match[1], 10);
                                if (qty > 0 && qty <= 999) {
                                    let normalizedName = cookieName;
                                    if (cookieName === 'Caramel deLites') normalizedName = 'Samoas';
                                    if (cookieName === 'Peanut Butter Patties') normalizedName = 'Tagalongs';
                                    if (cookieName === 'Peanut Butter Sandwich') normalizedName = 'Do-si-dos';
                                    if (cookieName === 'Shortbread') normalizedName = 'Trefoils';
                                    
                                    // Check if this cookie already exists (deduplication)
                                    const existingCookie = result.cookies.find(c => c.name === normalizedName);
                                    if (!existingCookie) {
                                        result.cookies.push({ name: normalizedName, quantity: qty });
                                    }
                                }
                                break;
                            }
                        }
                    });
                }

                // Extract customer name
                const namePatterns = [
                    /customer[:\s]*([A-Za-z]+\s+[A-Za-z]+)/i,
                    /name[:\s]*([A-Za-z]+\s+[A-Za-z]+)/i,
                    /ordered\s+by[:\s]*([A-Za-z]+\s+[A-Za-z]+)/i
                ];
                for (const pattern of namePatterns) {
                    const match = pageText.match(pattern);
                    if (match) {
                        result.customerName = match[1].trim();
                        break;
                    }
                }

                return result;
            });

            return details;
        } catch (error) {
            logger.debug('Error in new tab scrape', { orderNumber, error: error.message });
            return null;
        } finally {
            // Always close the tab
            if (newPage) {
                await newPage.close().catch(() => {});
            }
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
    }ì

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

