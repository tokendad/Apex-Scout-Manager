# Digital Cookie Scraper - Future Improvements

This document tracks known issues and planned improvements for the Digital Cookie scraper integration.

## Current Status (2026-01-20)

The scraper successfully:
- Logs into Digital Cookie platform
- Navigates to the orders page
- Extracts basic order data (order number, customer name, box count, date)
- Identifies paid vs unpaid orders (partial)
- Detects donations
- Imports data to the sales/donations tables

**Total boxes are accurate (56 boxes = 50 sales + 6 donations)**

## Known Issues

### 1. Payment Method Not Captured
**Problem:** Payment method shows "N/A" for all orders instead of actual values like "PAYPAL" or "Card"

**Example:** Order 209574191 (Jessica Mckee)
- Current: `paymentMethod: N/A`
- Expected: `paymentMethod: PAYPAL`

**Solution:** Need to either:
- Parse payment method from the orders table if available
- Or navigate to individual order detail pages to extract payment method from "Payment Method:" field

### 2. Balance Due Incorrect for Online Orders
**Problem:** Online orders show balance due amounts when payment has already been processed

**Examples:**
- Order 209574191 (Jessica Mckee): Shows "Balance Due: $18.00" but should be $0
- Order 209335075 (Harris Marcum): Shows "Balance Due: $24.00" but should be $0

**Solution:** All orders from the Digital Cookie website have been pre-paid online. The scraper should:
- Set `amountCollected = totalAmount` for all website orders
- Set `amountDue = 0` for all website orders
- Or verify payment status from order detail page

### 3. Phone Numbers Not Captured
**Problem:** Customer phone numbers show "N/A" even when available

**Example:** Order 209574191 (Jessica Mckee)
- Current: `customerPhone: N/A`
- Expected: `customerPhone: 805-469-2013`

**Solution:** Phone numbers may not be visible on the orders list page. Need to:
- Navigate to individual order detail pages
- Extract phone from customer information section

### 4. Cookie Type Shows "Assorted" Instead of Breakdown
**Problem:** All orders show `cookieType: Assorted` instead of the actual cookie varieties

**Expected:** Each order should have a breakdown like:
- Thin Mints: 2 boxes
- Samoas: 1 box
- Tagalongs: 1 box

**Location:** Cookie breakdown is available on order detail pages under "Cookies Selected" heading

**Solution:**
- Navigate to each order's detail page (e.g., `/cookieorderdetail/{orderNumber}`)
- Parse the "Cookies Selected" table
- Store individual cookie varieties as separate line items or as JSON in the order

### 5. Address Not Captured for Some Orders
**Problem:** Some orders show address as "N/A"

**Example:** Order 168879526 (Matthew LeFort)
- Current: `customerAddress: N/A`
- Expected: Full delivery address

**Solution:** Address may be in a different table column or on detail page. Need to:
- Improve table parsing to capture address column
- Or navigate to order detail page for full address

## Proposed Architecture Changes

### Option A: Enhanced Orders Page Parsing
- Improve table header detection
- Map more columns (payment method, phone if visible)
- Better address extraction

### Option B: Order Detail Page Scraping
For each order found on the orders page:
1. Click/navigate to order detail page
2. Extract full details:
   - Payment method
   - Customer phone
   - Customer email
   - Full address
   - Cookie breakdown (varieties and quantities)
3. Return to orders page or process next order

**Trade-offs:**
- Option A: Faster, but limited data
- Option B: Slower (more page loads), but complete data

### Recommended Approach
Implement Option B with caching:
1. First sync: Scrape all order details (slower)
2. Subsequent syncs: Only scrape new orders (faster)
3. Use order numbers in import_history to track what's been fully processed

## Data Model Changes Needed

### Current Sales Table Structure
```sql
cookieType TEXT,        -- Currently "Assorted"
quantity INTEGER,       -- Total boxes
customerName TEXT,
customerAddress TEXT,
customerPhone TEXT,
customerEmail TEXT,
...
```

### Proposed Changes
Consider adding:
```sql
-- Option 1: JSON field for cookie breakdown
cookieBreakdown TEXT,   -- JSON: {"Thin Mints": 2, "Samoas": 1}

-- Option 2: Separate line items per cookie type
-- This would require changing how orders are stored
-- Each cookie type becomes a separate sales record linked by orderNumber
```

## Testing URLs

- Orders Page: `https://digitalcookie.girlscouts.org/scout/{scoutId}/cookieOrdersPage`
- Order Detail: `https://digitalcookie.girlscouts.org/scout/{scoutId}/cookieorderdetail/{orderNumber}`
- Dashboard: `https://digitalcookie.girlscouts.org/scout/{scoutId}/girlSiteDashboardPage`
- Customers: `https://digitalcookie.girlscouts.org/scout/{scoutId}/customerListingPage`

## Reference: Working Python Scraper

See `/scraper/` folder for Python Selenium scripts that successfully:
- Login to Digital Cookie
- Navigate pages
- Extract data
- Take screenshots

These can be used as reference for the Node.js/Puppeteer implementation.

## Priority Order

1. **High:** Fix payment status (all online orders are paid)
2. **High:** Extract cookie breakdown from order details
3. **Medium:** Capture phone numbers
4. **Medium:** Capture complete addresses
5. **Low:** Extract payment method type (PAYPAL vs Card)
