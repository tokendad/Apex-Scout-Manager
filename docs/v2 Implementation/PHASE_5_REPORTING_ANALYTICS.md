# Phase 5: Reporting & Analytics

**Status:** ⏳ PLANNED
**Timeline:** Months 8-9
**Focus:** Enhanced reporting and insights
**Prerequisites:** Phase 1-4 completed

---

## Overview

Phase 5 implements comprehensive reporting capabilities at both the scout and troop levels. This phase delivers actionable insights through summary reports, data visualizations, and export functionality.

---

## Deliverables

### 5.1 Summary Reports (Scout and Troop Levels)

**Goal:** Comprehensive reporting for all user levels

#### Scout-Level Reports

**Personal Sales Summary:**
```
┌─────────────────────────────────────────────────────┐
│ Scout: Jane Doe                   Season: 2026     │
├─────────────────────────────────────────────────────┤
│ Total Boxes Sold:     156                          │
│ Total Revenue:        $936.00                      │
│ Goal Progress:        78% (156/200)                │
│ Ranking in Troop:     3rd of 15                    │
├─────────────────────────────────────────────────────┤
│ Sales by Channel:                                  │
│   Individual Sales:   89 boxes  (57%)              │
│   Booth Sales:        67 boxes  (43%)              │
├─────────────────────────────────────────────────────┤
│ Payment Status:                                    │
│   Collected:          $780.00  (83%)               │
│   Outstanding:        $156.00  (17%)               │
└─────────────────────────────────────────────────────┘
```

**Cookie Type Breakdown:**
```
┌──────────────────────────────────┐
│ Cookie Type          Boxes  %   │
├──────────────────────────────────┤
│ Thin Mints            45   29%  │
│ Samoas                32   21%  │
│ Tagalongs             28   18%  │
│ Trefoils              18   12%  │
│ Do-si-dos             15   10%  │
│ Other                 18   10%  │
└──────────────────────────────────┘
```

**Sales Timeline (Weekly):**
```
Week    Boxes   Cumulative   Goal Pace
─────────────────────────────────────
Week 1    12        12         20
Week 2    28        40         40
Week 3    35        75         60
Week 4    42       117         80
Week 5    39       156        100
```

#### Troop-Level Reports

**Troop Sales Summary:**
```
┌─────────────────────────────────────────────────────┐
│ Troop: 1234                       Season: 2026     │
├─────────────────────────────────────────────────────┤
│ Total Boxes Sold:     1,847                        │
│ Total Revenue:        $11,082.00                   │
│ Active Scouts:        15                           │
│ Avg per Scout:        123.1 boxes                  │
│ Troop Goal:           2,000 boxes (92% complete)   │
├─────────────────────────────────────────────────────┤
│ Top Sellers:                                       │
│   1. Emily S.         198 boxes                    │
│   2. Madison R.       187 boxes                    │
│   3. Jane D.          156 boxes                    │
├─────────────────────────────────────────────────────┤
│ Booth Events:         8 completed                  │
│ Booth Sales:          723 boxes (39%)              │
│ Individual Sales:     1,124 boxes (61%)            │
└─────────────────────────────────────────────────────┘
```

**API Endpoints - Reports:**
```
# Scout Reports
GET /api/reports/my/summary               - My sales summary
GET /api/reports/my/cookies               - My cookie breakdown
GET /api/reports/my/timeline              - My sales over time
GET /api/reports/my/customers             - My customer list

# Troop Reports
GET /api/troops/:tid/reports/summary      - Troop summary
GET /api/troops/:tid/reports/scouts       - Scout comparison
GET /api/troops/:tid/reports/cookies      - Cookie breakdown
GET /api/troops/:tid/reports/timeline     - Sales over time
GET /api/troops/:tid/reports/rankings     - Leaderboard
```

### 5.2 Booth Performance Reports

**Goal:** Analyze booth event effectiveness

**Booth Event Report:**
```
┌─────────────────────────────────────────────────────┐
│ Booth: Walmart Entrance                            │
│ Date: Jan 25, 2026  10:00 AM - 4:00 PM            │
├─────────────────────────────────────────────────────┤
│ Duration:             6 hours                      │
│ Scouts Participated:  8                            │
│ Total Shifts:         12                           │
├─────────────────────────────────────────────────────┤
│ Sales Performance:                                 │
│   Boxes Sold:         187                          │
│   Revenue:            $1,122.00                    │
│   Boxes/Hour:         31.2                         │
│   Revenue/Hour:       $187.00                      │
├─────────────────────────────────────────────────────┤
│ Payment Breakdown:                                 │
│   Cash:               $672.00  (60%)               │
│   Card (Square):      $324.00  (29%)               │
│   Venmo:              $126.00  (11%)               │
├─────────────────────────────────────────────────────┤
│ Inventory:                                         │
│   Starting:           240 boxes                    │
│   Ending:             53 boxes                     │
│   Sold:               187 boxes                    │
│   Damaged:            0 boxes                      │
├─────────────────────────────────────────────────────┤
│ Reconciliation:                                    │
│   Expected Revenue:   $1,122.00                    │
│   Actual Revenue:     $1,122.00                    │
│   Variance:           $0.00 ✓                      │
└─────────────────────────────────────────────────────┘
```

**Booth Comparison Report:**
```
┌───────────────────────────────────────────────────────────────────┐
│ Booth Performance Comparison - Season 2026                        │
├───────────────────────────────────────────────────────────────────┤
│ Location          Date      Hours  Boxes  $/Hour  Boxes/Hr  ROI  │
├───────────────────────────────────────────────────────────────────┤
│ Walmart           Jan 25    6.0    187    $187    31.2      A+   │
│ Kroger            Jan 18    4.0    98     $147    24.5      A    │
│ Library           Jan 20    3.0    45     $90     15.0      B    │
│ Soccer Field      Jan 22    2.0    23     $69     11.5      C    │
└───────────────────────────────────────────────────────────────────┘
```

**API Endpoints - Booth Reports:**
```
GET /api/troops/:tid/reports/booths                 - All booth summary
GET /api/troops/:tid/reports/booths/:bid            - Single booth detail
GET /api/troops/:tid/reports/booths/comparison      - Booth comparison
GET /api/troops/:tid/reports/booths/locations       - Best locations
```

### 5.3 Export Functionality (PDF, Excel, CSV)

**Goal:** Export reports in multiple formats

**Export Formats:**

| Format | Use Case | Features |
|--------|----------|----------|
| PDF | Printable reports, sharing | Formatted, charts included |
| Excel | Data analysis, council submission | Formulas, multiple sheets |
| CSV | Data import to other systems | Raw data, simple format |
| JSON | API integration | Structured data |

**Export Options:**
```javascript
// Export configuration
{
    format: 'pdf' | 'excel' | 'csv' | 'json',
    reportType: 'scout_summary' | 'troop_summary' | 'booth_detail' | 'inventory',
    dateRange: { start: '2026-01-01', end: '2026-03-31' },
    includeCharts: true,      // PDF only
    includeDetails: true,     // Include line-item detail
    groupBy: 'week' | 'month' | 'cookie_type' | 'scout',
    filters: {
        scoutIds: [1, 2, 3],
        cookieTypes: ['Thin Mints', 'Samoas'],
        salesTypes: ['individual', 'booth']
    }
}
```

**PDF Report Template:**
```
┌─────────────────────────────────────────────────────┐
│ [TROOP LOGO]                                       │
│                                                    │
│         GSCTracker Sales Report                    │
│         Troop 1234 - Season 2026                   │
│         Generated: Jan 31, 2026                    │
├─────────────────────────────────────────────────────┤
│                                                    │
│ Executive Summary                                  │
│ ─────────────────                                  │
│ [Summary statistics and highlights]                │
│                                                    │
│ Sales by Scout                                     │
│ ──────────────                                     │
│ [Table with scout rankings]                        │
│                                                    │
│ Cookie Type Distribution                           │
│ ────────────────────────                           │
│ [Pie chart]                                        │
│                                                    │
│ Sales Trend                                        │
│ ───────────                                        │
│ [Line chart showing weekly progress]               │
│                                                    │
│ Booth Event Summary                                │
│ ───────────────────                                │
│ [Table of booth events]                            │
│                                                    │
└─────────────────────────────────────────────────────┘
```

**API Endpoints - Export:**
```
POST /api/exports                                    - Request export
GET  /api/exports/:id                                - Check export status
GET  /api/exports/:id/download                       - Download file

# Quick exports
GET  /api/reports/my/summary/export?format=pdf      - Export my summary
GET  /api/troops/:tid/reports/summary/export?format=excel
```

**Implementation Notes:**
```javascript
// Dependencies for exports
// PDF: puppeteer or pdfkit
// Excel: exceljs or xlsx
// CSV: built-in or fast-csv

const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

async function exportTroopSummary(troopId, format, options) {
    const data = await getTroopSummaryData(troopId, options);

    switch (format) {
        case 'excel':
            return generateExcel(data);
        case 'pdf':
            return generatePDF(data);
        case 'csv':
            return generateCSV(data);
        case 'json':
            return JSON.stringify(data, null, 2);
    }
}
```

### 5.4 Data Visualizations and Charts

**Goal:** Visual representations of sales data

**Chart Types:**

**1. Sales Progress Gauge:**
```
Goal: 200 boxes
         ┌────────────────────────────────┐
Progress │████████████████░░░░░░░░░░░░░░░│ 156/200 (78%)
         └────────────────────────────────┘
```

**2. Cookie Distribution Pie Chart:**
```
        Thin Mints (29%)
           ╱╲
          ╱  ╲
    Samoas╱    ╲Tagalongs
    (21%) ╲    ╱ (18%)
           ╲  ╱
            ╲╱
         Other (32%)
```

**3. Sales Timeline Line Chart:**
```
Boxes │
  200 │                              ╱
  150 │                         ╱───╱
  100 │                    ╱───╱
   50 │              ╱────╱
    0 │─────────────╱
      └──────────────────────────────────
        Week 1  Week 2  Week 3  Week 4  Week 5
```

**4. Scout Comparison Bar Chart:**
```
Emily S.    ████████████████████ 198
Madison R.  ██████████████████░░ 187
Jane D.     ████████████████░░░░ 156
Olivia K.   ██████████████░░░░░░ 142
Sarah M.    ████████████░░░░░░░░ 128
            0   50   100  150  200
```

**5. Booth Performance Heat Map:**
```
         Mon  Tue  Wed  Thu  Fri  Sat  Sun
Morning   ░░   ░░   ░░   ░░   ██   ██   ██
Afternoon ░░   ░░   ░░   ██   ██   ██   ██
Evening   ░░   ██   ██   ██   ░░   ░░   ░░

██ = High sales    ░░ = Low sales
```

**Frontend Implementation:**
```javascript
// Using Chart.js for visualizations
import Chart from 'chart.js/auto';

// Cookie distribution pie chart
new Chart(ctx, {
    type: 'pie',
    data: {
        labels: cookieTypes,
        datasets: [{
            data: cookieQuantities,
            backgroundColor: cookieColors
        }]
    }
});

// Sales timeline
new Chart(ctx, {
    type: 'line',
    data: {
        labels: weeks,
        datasets: [{
            label: 'Boxes Sold',
            data: weeklySales,
            borderColor: '#4CAF50'
        }, {
            label: 'Goal Pace',
            data: goalPace,
            borderColor: '#FF9800',
            borderDash: [5, 5]
        }]
    }
});
```

### 5.5 Scout Participation and Shift Credit Tracking

**Goal:** Track scout contributions fairly

**Shift Credit Calculation:**
```javascript
// Option 1: Equal split among all shift workers
creditPerScout = boothTotalBoxes / numberOfScouts;

// Option 2: Proportional to shift duration
scoutCredit = boothTotalBoxes * (scoutHours / totalShiftHours);

// Option 3: Manual assignment by leader
// Leader manually assigns credit after event

// Store credit in booth_shifts.boxesCredited
```

**Participation Report:**
```
┌─────────────────────────────────────────────────────┐
│ Scout Participation Report - Season 2026           │
├─────────────────────────────────────────────────────┤
│ Scout          Booths  Hours  Credit  Individual   │
├─────────────────────────────────────────────────────┤
│ Jane D.           5     12     67       89         │
│ Emily S.          4     10     54      144         │
│ Madison R.        6     15     83      104         │
│ Sarah M.          3      6     32       96         │
├─────────────────────────────────────────────────────┤
│ Troop Average:   4.5    10.8   59       108        │
└─────────────────────────────────────────────────────┘
```

**API Endpoints - Participation:**
```
GET /api/troops/:tid/reports/participation          - Participation summary
GET /api/troops/:tid/reports/shifts                 - All shift history
GET /api/reports/my/shifts                          - My shift history
```

### 5.6 Payment Collection Status Reports

**Goal:** Track money owed and collected

**Payment Status Report:**
```
┌─────────────────────────────────────────────────────┐
│ Payment Collection Status - Troop 1234             │
│ As of: Jan 31, 2026                                │
├─────────────────────────────────────────────────────┤
│ Total Revenue:        $11,082.00                   │
│ Collected:            $9,234.00  (83.3%)           │
│ Outstanding:          $1,848.00  (16.7%)           │
├─────────────────────────────────────────────────────┤
│ Outstanding by Scout:                              │
│   Jane D.             $156.00   (5 orders)         │
│   Sarah M.            $312.00   (8 orders)         │
│   Emily S.            $78.00    (2 orders)         │
│   Others              $1,302.00 (28 orders)        │
├─────────────────────────────────────────────────────┤
│ Aging:                                             │
│   Current (0-7 days): $624.00                      │
│   8-14 days:          $468.00                      │
│   15-30 days:         $546.00                      │
│   Over 30 days:       $210.00  ⚠️                  │
└─────────────────────────────────────────────────────┘
```

**API Endpoints - Payments:**
```
GET /api/troops/:tid/reports/payments               - Payment status
GET /api/troops/:tid/reports/payments/aging         - Aging report
GET /api/troops/:tid/reports/payments/outstanding   - Outstanding list
GET /api/reports/my/payments                        - My payment status
```

---

## Database Changes

**New Tables:**

```sql
-- Report templates (for custom reports)
CREATE TABLE report_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    troopId INTEGER,                      -- NULL for system templates
    name TEXT NOT NULL,
    reportType TEXT NOT NULL,
    configuration TEXT NOT NULL,          -- JSON config
    isDefault INTEGER DEFAULT 0,
    createdBy INTEGER,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (troopId) REFERENCES troops(id),
    FOREIGN KEY (createdBy) REFERENCES users(id)
);

-- Scheduled reports
CREATE TABLE scheduled_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    troopId INTEGER NOT NULL,
    templateId INTEGER NOT NULL,
    frequency TEXT NOT NULL,              -- daily, weekly, monthly
    dayOfWeek INTEGER,                    -- 0-6 for weekly
    dayOfMonth INTEGER,                   -- 1-31 for monthly
    recipients TEXT NOT NULL,             -- JSON array of emails
    lastRun TEXT,
    nextRun TEXT,
    isActive INTEGER DEFAULT 1,
    FOREIGN KEY (troopId) REFERENCES troops(id),
    FOREIGN KEY (templateId) REFERENCES report_templates(id)
);

-- Export requests
CREATE TABLE export_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    troopId INTEGER,
    reportType TEXT NOT NULL,
    format TEXT NOT NULL,
    configuration TEXT,                   -- JSON options
    status TEXT DEFAULT 'pending',        -- pending, processing, completed, failed
    filePath TEXT,
    fileSize INTEGER,
    errorMessage TEXT,
    requestedAt TEXT DEFAULT CURRENT_TIMESTAMP,
    completedAt TEXT,
    expiresAt TEXT,                       -- Auto-delete after X days
    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (troopId) REFERENCES troops(id)
);
```

---

## Frontend Changes

### New Pages
```
/public/
├── reports/
│   ├── dashboard.html        - Report home/quick stats
│   ├── scout-summary.html    - My sales summary
│   ├── troop-summary.html    - Troop overview
│   ├── booth-reports.html    - Booth performance
│   ├── payment-status.html   - Payment tracking
│   └── export.html           - Export configuration
```

### New Components
- Report card widget
- Chart components (pie, bar, line, gauge)
- Data table with sorting/filtering
- Export modal
- Date range picker
- Report filters panel

### Chart Library
```html
<!-- Add Chart.js -->
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

<!-- Or install via npm -->
npm install chart.js
```

---

## API Endpoints Summary

### Scout Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports/my/summary` | Personal summary |
| GET | `/api/reports/my/cookies` | Cookie breakdown |
| GET | `/api/reports/my/timeline` | Sales over time |
| GET | `/api/reports/my/payments` | Payment status |
| GET | `/api/reports/my/shifts` | Shift history |

### Troop Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/troops/:tid/reports/summary` | Troop overview |
| GET | `/api/troops/:tid/reports/scouts` | Scout comparison |
| GET | `/api/troops/:tid/reports/rankings` | Leaderboard |
| GET | `/api/troops/:tid/reports/booths` | Booth summary |
| GET | `/api/troops/:tid/reports/payments` | Payment status |
| GET | `/api/troops/:tid/reports/participation` | Participation |

### Export
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/exports` | Request export |
| GET | `/api/exports/:id` | Check status |
| GET | `/api/exports/:id/download` | Download file |

---

## Testing Checklist

### Scout Reports
- [ ] Summary shows correct totals
- [ ] Cookie breakdown percentages sum to 100%
- [ ] Timeline reflects actual sales dates
- [ ] Goal progress calculated correctly

### Troop Reports
- [ ] All scouts included in summary
- [ ] Rankings ordered correctly
- [ ] Booth totals match event records
- [ ] Payment aging calculated correctly

### Charts
- [ ] Pie chart renders with correct data
- [ ] Bar chart scales appropriately
- [ ] Line chart shows trends correctly
- [ ] Charts responsive on mobile

### Export
- [ ] PDF generates with all sections
- [ ] Excel has proper formatting
- [ ] CSV downloads correctly
- [ ] Large exports don't timeout

---

## Acceptance Criteria

1. **Scouts can view their personal sales summary**
2. **Leaders can view troop-wide reports**
3. **Booth performance is analyzed with key metrics**
4. **Reports can be exported in PDF, Excel, and CSV**
5. **Charts provide visual insights**
6. **Payment status is tracked with aging**

---

## Dependencies to Add

```json
{
  "chart.js": "^4.4.1",
  "exceljs": "^4.4.0",
  "pdfkit": "^0.14.0",
  "fast-csv": "^4.3.6"
}
```

---

## Next Phase

**Phase 6: Mobile & UX** will implement:
- PWA enhancements (offline mode, push notifications)
- Mobile-optimized interfaces
- Quick sale entry for booth events
- Onboarding tutorials
- Accessibility improvements
