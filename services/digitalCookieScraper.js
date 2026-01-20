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

            // Wait for login form
            await this.page.waitForSelector('input[type="email"], input[name="email"], #email', { timeout: 10000 });

            // Find and fill email field
            const emailSelector = await this.findSelector([
                'input[type="email"]',
                'input[name="email"]',
                '#email',
                'input[placeholder*="email" i]'
            ]);
            if (emailSelector) {
                await this.page.type(emailSelector, email, { delay: 50 });
            } else {
                throw new Error('Could not find email input field');
            }

            // Find and fill password field
            const passwordSelector = await this.findSelector([
                'input[type="password"]',
                'input[name="password"]',
                '#password'
            ]);
            if (passwordSelector) {
                await this.page.type(passwordSelector, password, { delay: 50 });
            } else {
                throw new Error('Could not find password input field');
            }

            // Find and click submit button
            const submitSelector = await this.findSelector([
                'button[type="submit"]',
                'input[type="submit"]',
                'button:contains("Sign In")',
                'button:contains("Login")',
                '.login-btn',
                '#login-button'
            ]);
            if (submitSelector) {
                await Promise.all([
                    this.page.click(submitSelector),
                    this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })
                ]);
            } else {
                // Try pressing Enter if no button found
                await Promise.all([
                    this.page.keyboard.press('Enter'),
                    this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })
                ]);
            }

            // Check if login was successful (should be redirected away from login page)
            const currentUrl = this.page.url();
            const loginSuccessful = !currentUrl.includes('/login');

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
     * Scrape orders from the orders page
     * @param {string} storeUrl - URL to the orders page
     * @returns {Object[]} - Array of order objects
     */
    async scrapeOrders(storeUrl) {
        try {
            logger.info('Navigating to orders page', { url: storeUrl });

            // Navigate to orders page
            await this.page.goto(storeUrl, { waitUntil: 'networkidle2', timeout: 30000 });

            // Wait for page content to load
            await this.page.waitForTimeout(2000);

            // Try to find and extract order data
            const orders = await this.page.evaluate(() => {
                const extractedOrders = [];

                // Look for order containers/rows
                const orderContainers = document.querySelectorAll(
                    '[class*="order"], .order-row, .order-item, tr[data-order], .cookie-order'
                );

                // If we find specific order containers, parse them
                if (orderContainers.length > 0) {
                    orderContainers.forEach((container, index) => {
                        const order = {
                            orderNumber: null,
                            customerName: null,
                            customerEmail: null,
                            customerPhone: null,
                            customerAddress: null,
                            orderDate: null,
                            orderType: null,
                            orderStatus: null,
                            cookies: [],
                            totalBoxes: 0,
                            isDonation: false,
                            isWebsiteOrder: false
                        };

                        // Try to extract order number
                        const orderNumEl = container.querySelector('[class*="order-num"], [class*="orderNumber"]');
                        if (orderNumEl) order.orderNumber = orderNumEl.textContent.trim();

                        // Try to extract customer name
                        const nameEl = container.querySelector('[class*="customer"], [class*="name"], [class*="deliver"]');
                        if (nameEl) order.customerName = nameEl.textContent.trim();

                        // Check for donation indicator
                        const containerText = container.textContent || '';
                        order.isDonation = containerText.toLowerCase().includes('donate order') ||
                            containerText.toLowerCase().includes('secondary delivery option:donate');
                        order.isWebsiteOrder = containerText.includes('My Cookie Website') ||
                            containerText.includes('Ordered From:');

                        // Extract date if available
                        const dateEl = container.querySelector('[class*="date"]');
                        if (dateEl) order.orderDate = dateEl.textContent.trim();

                        // Extract status
                        const statusEl = container.querySelector('[class*="status"]');
                        if (statusEl) order.orderStatus = statusEl.textContent.trim();

                        // Only add if we have some meaningful data
                        if (order.orderNumber || order.customerName) {
                            extractedOrders.push(order);
                        }
                    });
                }

                // Also try parsing any visible tables
                const tables = document.querySelectorAll('table');
                tables.forEach(table => {
                    const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim().toLowerCase());
                    const rows = table.querySelectorAll('tbody tr');

                    rows.forEach(row => {
                        const cells = row.querySelectorAll('td');
                        if (cells.length > 0) {
                            const order = {
                                orderNumber: null,
                                customerName: null,
                                customerEmail: null,
                                customerPhone: null,
                                customerAddress: null,
                                orderDate: null,
                                orderType: null,
                                orderStatus: null,
                                cookies: [],
                                totalBoxes: 0,
                                isDonation: false,
                                isWebsiteOrder: false
                            };

                            cells.forEach((cell, idx) => {
                                const header = headers[idx] || '';
                                const value = cell.textContent.trim();

                                if (header.includes('order') && header.includes('num')) {
                                    order.orderNumber = value;
                                } else if (header.includes('name') || header.includes('customer') || header.includes('deliver')) {
                                    order.customerName = value;
                                } else if (header.includes('date')) {
                                    order.orderDate = value;
                                } else if (header.includes('status')) {
                                    order.orderStatus = value;
                                } else if (header.includes('email')) {
                                    order.customerEmail = value;
                                } else if (header.includes('phone')) {
                                    order.customerPhone = value;
                                } else if (header.includes('address')) {
                                    order.customerAddress = value;
                                }
                            });

                            const rowText = row.textContent || '';
                            order.isDonation = rowText.toLowerCase().includes('donate order');
                            order.isWebsiteOrder = rowText.includes('My Cookie Website');

                            if (order.orderNumber || order.customerName) {
                                // Check for duplicates
                                const exists = extractedOrders.some(o =>
                                    o.orderNumber === order.orderNumber && o.customerName === order.customerName
                                );
                                if (!exists) {
                                    extractedOrders.push(order);
                                }
                            }
                        }
                    });
                });

                return extractedOrders;
            });

            logger.info('Scraped orders from Digital Cookie', { orderCount: orders.length });

            // Try to get additional details for each order by parsing the full page content
            const pageContent = await this.page.content();

            return orders;
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
