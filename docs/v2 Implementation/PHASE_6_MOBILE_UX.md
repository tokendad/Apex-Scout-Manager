# Phase 6: Mobile & UX

**Status:** ⏳ PLANNED
**Timeline:** Months 9-11
**Focus:** Mobile experience and usability
**Prerequisites:** Phase 1-5 completed

---

## Overview

Phase 6 focuses on enhancing the mobile experience and overall usability of the application. This includes PWA improvements, mobile-optimized interfaces, onboarding, and accessibility compliance.

---

## Deliverables

### 6.1 PWA Enhancements (Offline Mode, Push Notifications)

**Goal:** Make the app work reliably offline and keep users informed

#### Offline Mode

**Offline Capabilities:**
| Feature | Offline Support | Sync Strategy |
|---------|-----------------|---------------|
| View sales | ✅ Full | Cache-first |
| Add new sale | ✅ Queue | Background sync |
| View inventory | ✅ Full | Cache-first |
| Booth check-in | ✅ Queue | Background sync |
| View reports | ✅ Cached | Stale-while-revalidate |
| Edit profile | ✅ Queue | Background sync |

**Service Worker Implementation:**
```javascript
// sw.js - Service Worker

const CACHE_NAME = 'gsctracker-v2';
const OFFLINE_QUEUE = 'offline-queue';

// Assets to cache immediately
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/login.html',
    '/styles.css',
    '/script.js',
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/offline.html'
];

// Install: cache static assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS))
    );
});

// Fetch: network-first for API, cache-first for assets
self.addEventListener('fetch', event => {
    const { request } = event;

    if (request.url.includes('/api/')) {
        // API requests: network-first with offline queue
        event.respondWith(networkFirstWithQueue(request));
    } else {
        // Static assets: cache-first
        event.respondWith(cacheFirst(request));
    }
});

// Background sync for offline mutations
self.addEventListener('sync', event => {
    if (event.tag === 'sync-sales') {
        event.waitUntil(syncOfflineSales());
    }
});
```

**Offline Queue Storage (IndexedDB):**
```javascript
// Store offline actions
const offlineDB = {
    async addToQueue(action) {
        const db = await openDB('gsctracker-offline', 1);
        await db.add('queue', {
            id: Date.now(),
            action: action.type,     // 'ADD_SALE', 'UPDATE_INVENTORY', etc.
            data: action.data,
            timestamp: new Date().toISOString(),
            synced: false
        });
    },

    async syncQueue() {
        const db = await openDB('gsctracker-offline', 1);
        const pending = await db.getAllFromIndex('queue', 'synced', false);

        for (const item of pending) {
            try {
                await sendToServer(item);
                await db.put('queue', { ...item, synced: true });
            } catch (err) {
                console.log('Sync failed, will retry:', err);
            }
        }
    }
};
```

**Offline Indicator UI:**
```html
<!-- Offline banner -->
<div id="offline-banner" class="offline-banner hidden">
    <span class="icon">📴</span>
    <span>You're offline. Changes will sync when connected.</span>
</div>

<style>
.offline-banner {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: #ff9800;
    color: white;
    padding: 8px 16px;
    text-align: center;
    z-index: 1000;
}
.offline-banner.hidden { display: none; }
</style>

<script>
window.addEventListener('online', () => {
    document.getElementById('offline-banner').classList.add('hidden');
    // Trigger sync
    navigator.serviceWorker.ready.then(reg => reg.sync.register('sync-sales'));
});

window.addEventListener('offline', () => {
    document.getElementById('offline-banner').classList.remove('hidden');
});
</script>
```

#### Push Notifications

**Notification Types:**
| Type | Trigger | Priority |
|------|---------|----------|
| Sale recorded | New sale synced | Low |
| Goal milestone | 50%, 75%, 100% of goal | High |
| Booth reminder | 24hr before shift | High |
| Shift starting | 30min before shift | High |
| Payment received | Payment collected | Medium |
| Troop announcement | Leader sends message | Medium |
| Low inventory | Below threshold | High |

**Push Notification Implementation:**
```javascript
// Request notification permission
async function requestNotificationPermission() {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: VAPID_PUBLIC_KEY
        });

        // Send subscription to server
        await fetch('/api/notifications/subscribe', {
            method: 'POST',
            body: JSON.stringify(subscription),
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Handle push events in service worker
self.addEventListener('push', event => {
    const data = event.data.json();

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: '/icons/icon-192.png',
            badge: '/icons/badge-72.png',
            tag: data.tag,
            data: { url: data.actionUrl }
        })
    );
});

// Handle notification click
self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});
```

**Backend Push Service:**
```javascript
const webpush = require('web-push');

webpush.setVapidDetails(
    'mailto:admin@gsctracker.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

async function sendPushNotification(userId, notification) {
    const subscriptions = await db.prepare(
        'SELECT subscription FROM push_subscriptions WHERE userId = ?'
    ).all(userId);

    for (const sub of subscriptions) {
        try {
            await webpush.sendNotification(
                JSON.parse(sub.subscription),
                JSON.stringify(notification)
            );
        } catch (err) {
            if (err.statusCode === 410) {
                // Subscription expired, remove it
                await removeSubscription(sub.id);
            }
        }
    }
}
```

**Database Schema:**
```sql
CREATE TABLE push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    subscription TEXT NOT NULL,          -- JSON subscription object
    userAgent TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    lastUsed TEXT,
    FOREIGN KEY (userId) REFERENCES users(id)
);

CREATE TABLE notification_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL UNIQUE,
    goalMilestones INTEGER DEFAULT 1,
    boothReminders INTEGER DEFAULT 1,
    salesRecorded INTEGER DEFAULT 0,
    troopAnnouncements INTEGER DEFAULT 1,
    lowInventory INTEGER DEFAULT 1,
    quietHoursStart TEXT,                -- e.g., "22:00"
    quietHoursEnd TEXT,                  -- e.g., "08:00"
    FOREIGN KEY (userId) REFERENCES users(id)
);
```

### 6.2 Mobile-Optimized Booth Tracking Interface

**Goal:** Fast, easy booth tracking on mobile devices

**Mobile Booth Interface Features:**
- Large touch targets (minimum 48px)
- Quick sale buttons (tap to add common quantities)
- Swipe gestures for common actions
- Persistent bottom navigation
- Landscape mode for booth checkout

**Quick Sale Entry:**
```html
<!-- Mobile booth sale entry -->
<div class="booth-quick-sale">
    <h3>Quick Add Sale</h3>

    <!-- Cookie quick-select -->
    <div class="cookie-grid">
        <button class="cookie-btn" data-cookie="thin-mints">
            <span class="emoji">🍫</span>
            <span class="name">Thin Mints</span>
        </button>
        <button class="cookie-btn" data-cookie="samoas">
            <span class="emoji">🥥</span>
            <span class="name">Samoas</span>
        </button>
        <!-- More cookies... -->
    </div>

    <!-- Quantity quick-select -->
    <div class="quantity-row">
        <button class="qty-btn" data-qty="1">1</button>
        <button class="qty-btn" data-qty="2">2</button>
        <button class="qty-btn" data-qty="3">3</button>
        <button class="qty-btn" data-qty="4">4</button>
        <button class="qty-btn" data-qty="5">5</button>
        <button class="qty-btn" data-qty="12">Case</button>
    </div>

    <!-- Payment type -->
    <div class="payment-row">
        <button class="pay-btn selected" data-pay="cash">💵 Cash</button>
        <button class="pay-btn" data-pay="card">💳 Card</button>
        <button class="pay-btn" data-pay="venmo">📱 Venmo</button>
    </div>

    <!-- Add button -->
    <button class="add-sale-btn">Add Sale - $12.00</button>
</div>

<style>
.booth-quick-sale {
    padding: 16px;
}

.cookie-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 16px;
}

.cookie-btn {
    padding: 16px 8px;
    font-size: 14px;
    border: 2px solid #ddd;
    border-radius: 8px;
    background: white;
    min-height: 72px;
}

.cookie-btn.selected {
    border-color: #4CAF50;
    background: #E8F5E9;
}

.qty-btn, .pay-btn {
    min-width: 48px;
    min-height: 48px;
    font-size: 18px;
}

.add-sale-btn {
    width: 100%;
    padding: 16px;
    font-size: 20px;
    background: #4CAF50;
    color: white;
    border: none;
    border-radius: 8px;
    margin-top: 16px;
}
</style>
```

**Mobile Navigation:**
```html
<!-- Bottom navigation for mobile -->
<nav class="mobile-nav">
    <a href="#sales" class="nav-item active">
        <span class="icon">📊</span>
        <span class="label">Sales</span>
    </a>
    <a href="#inventory" class="nav-item">
        <span class="icon">📦</span>
        <span class="label">Inventory</span>
    </a>
    <a href="#booth" class="nav-item">
        <span class="icon">🏪</span>
        <span class="label">Booth</span>
    </a>
    <a href="#profile" class="nav-item">
        <span class="icon">👤</span>
        <span class="label">Profile</span>
    </a>
</nav>

<style>
.mobile-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: space-around;
    background: white;
    border-top: 1px solid #ddd;
    padding: 8px 0;
    z-index: 100;
}

.nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-decoration: none;
    color: #666;
    min-width: 64px;
    padding: 8px;
}

.nav-item.active {
    color: #4CAF50;
}

.nav-item .icon {
    font-size: 24px;
}

.nav-item .label {
    font-size: 12px;
    margin-top: 4px;
}

/* Add padding to main content so it's not hidden behind nav */
main {
    padding-bottom: 80px;
}
</style>
```

### 6.3 Onboarding and Tutorials for All Roles

**Goal:** Help new users get started quickly

**Onboarding Flow by Role:**

**Scout Onboarding:**
```
Step 1: Welcome
  "Welcome to GSCTracker! Let's get you set up to track your cookie sales."

Step 2: Profile Setup
  - Add your photo (optional)
  - Set your sales goal
  - Link to your troop

Step 3: Quick Tour
  - Show Summary tab (your progress)
  - Show Sales tab (record sales)
  - Show Events tab (booth sales)

Step 4: First Sale
  - Guide through recording first sale
  - Celebrate with confetti animation

Step 5: Done!
  - Show tips for success
  - Link to help resources
```

**Parent Onboarding:**
```
Step 1: Welcome
  "Welcome! Let's connect you to your scout."

Step 2: Link to Scout
  - Enter scout's email or receive invitation
  - Explain what data you'll see

Step 3: Parent Dashboard Tour
  - Show scout's progress
  - Show how to help record sales
  - Show payment tracking

Step 4: Notifications Setup
  - Choose what updates you want
  - Set quiet hours
```

**Troop Leader Onboarding:**
```
Step 1: Welcome
  "Welcome, Troop Leader! Let's set up your troop."

Step 2: Troop Setup
  - Enter troop number
  - Set troop type (Brownie, Junior, etc.)
  - Set meeting info

Step 3: Add Scouts
  - Import roster or add manually
  - Send invitations

Step 4: Dashboard Tour
  - Troop overview
  - Scout management
  - Event creation
  - Reports

Step 5: First Goal
  - Set troop sales goal
  - Understand goal tracking
```

**Implementation:**
```javascript
// Onboarding state management
const onboarding = {
    steps: {
        scout: ['welcome', 'profile', 'tour', 'first-sale', 'complete'],
        parent: ['welcome', 'link-scout', 'dashboard-tour', 'notifications', 'complete'],
        troop_leader: ['welcome', 'troop-setup', 'add-scouts', 'dashboard-tour', 'first-goal', 'complete']
    },

    getCurrentStep(userId) {
        return db.prepare(
            'SELECT onboardingStep FROM users WHERE id = ?'
        ).get(userId)?.onboardingStep || 0;
    },

    async completeStep(userId, step) {
        await db.prepare(
            'UPDATE users SET onboardingStep = ? WHERE id = ?'
        ).run(step + 1, userId);
    },

    isComplete(userId, role) {
        const current = this.getCurrentStep(userId);
        return current >= this.steps[role].length;
    }
};
```

**Contextual Help Tooltips:**
```html
<!-- Tooltip component -->
<div class="help-tooltip" data-tip="sales-form">
    <button class="help-btn">?</button>
    <div class="tooltip-content">
        <h4>Recording a Sale</h4>
        <p>Enter the cookie type, quantity, and customer info.
           Don't forget to mark if payment was collected!</p>
        <a href="/help/sales">Learn more</a>
    </div>
</div>

<style>
.help-tooltip {
    position: relative;
    display: inline-block;
}

.help-btn {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #2196F3;
    color: white;
    border: none;
    cursor: pointer;
}

.tooltip-content {
    display: none;
    position: absolute;
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 12px;
    width: 250px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    z-index: 100;
}

.help-tooltip:hover .tooltip-content,
.help-tooltip:focus-within .tooltip-content {
    display: block;
}
</style>
```

### 6.4 Accessibility Improvements (WCAG 2.1 AA)

**Goal:** Make the app usable for all users

**WCAG 2.1 AA Requirements:**

| Criterion | Requirement | Implementation |
|-----------|-------------|----------------|
| 1.1.1 | Non-text content | Alt text for all images |
| 1.3.1 | Info and relationships | Semantic HTML, ARIA labels |
| 1.4.1 | Use of color | Don't rely solely on color |
| 1.4.3 | Contrast | 4.5:1 for normal text |
| 1.4.4 | Resize text | Support 200% zoom |
| 2.1.1 | Keyboard | All functions via keyboard |
| 2.4.1 | Skip links | Skip to main content |
| 2.4.4 | Link purpose | Clear link text |
| 2.4.7 | Focus visible | Visible focus indicators |
| 3.1.1 | Language | `lang` attribute |
| 4.1.2 | Name, role, value | ARIA for custom controls |

**Skip Link:**
```html
<a href="#main-content" class="skip-link">Skip to main content</a>

<style>
.skip-link {
    position: absolute;
    top: -40px;
    left: 0;
    background: #000;
    color: #fff;
    padding: 8px;
    z-index: 1000;
}

.skip-link:focus {
    top: 0;
}
</style>
```

**ARIA Labels:**
```html
<!-- Button with icon only -->
<button aria-label="Add new sale" class="add-btn">
    <span aria-hidden="true">+</span>
</button>

<!-- Form with proper labels -->
<form>
    <label for="cookie-type">Cookie Type</label>
    <select id="cookie-type" aria-describedby="cookie-help">
        <option value="">Select a cookie</option>
        <!-- options -->
    </select>
    <span id="cookie-help" class="help-text">Choose the type of cookie sold</span>
</form>

<!-- Progress indicator -->
<div role="progressbar"
     aria-valuenow="78"
     aria-valuemin="0"
     aria-valuemax="100"
     aria-label="Goal progress: 78%">
    <div class="progress-fill" style="width: 78%"></div>
</div>

<!-- Data table -->
<table aria-label="Sales history">
    <thead>
        <tr>
            <th scope="col">Date</th>
            <th scope="col">Cookie</th>
            <th scope="col">Quantity</th>
        </tr>
    </thead>
    <!-- tbody -->
</table>
```

**Keyboard Navigation:**
```javascript
// Custom dropdown with keyboard support
class AccessibleDropdown {
    constructor(element) {
        this.element = element;
        this.button = element.querySelector('.dropdown-btn');
        this.menu = element.querySelector('.dropdown-menu');
        this.items = element.querySelectorAll('.dropdown-item');
        this.currentIndex = -1;

        this.button.addEventListener('keydown', this.handleButtonKeydown.bind(this));
        this.menu.addEventListener('keydown', this.handleMenuKeydown.bind(this));
    }

    handleButtonKeydown(e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
            e.preventDefault();
            this.openMenu();
            this.focusItem(0);
        }
    }

    handleMenuKeydown(e) {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.focusItem(this.currentIndex + 1);
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.focusItem(this.currentIndex - 1);
                break;
            case 'Escape':
                this.closeMenu();
                this.button.focus();
                break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                this.selectItem(this.currentIndex);
                break;
        }
    }

    focusItem(index) {
        if (index < 0) index = this.items.length - 1;
        if (index >= this.items.length) index = 0;
        this.currentIndex = index;
        this.items[index].focus();
    }
}
```

**High Contrast Mode:**
```css
/* Respect user's high contrast preference */
@media (prefers-contrast: high) {
    :root {
        --text-color: #000;
        --bg-color: #fff;
        --border-color: #000;
        --focus-color: #000;
    }

    button, input, select {
        border: 2px solid #000;
    }

    a {
        text-decoration: underline;
    }
}

/* Forced colors mode (Windows High Contrast) */
@media (forced-colors: active) {
    .btn {
        border: 2px solid ButtonText;
    }

    .progress-fill {
        background: Highlight;
    }
}
```

**Focus Indicators:**
```css
/* Visible focus for all interactive elements */
:focus {
    outline: 3px solid #2196F3;
    outline-offset: 2px;
}

/* Remove default outline only when using mouse */
:focus:not(:focus-visible) {
    outline: none;
}

/* Ensure focus visible for keyboard users */
:focus-visible {
    outline: 3px solid #2196F3;
    outline-offset: 2px;
}
```

### 6.5 Performance Optimization

**Goal:** Fast load times and smooth interactions

**Performance Targets:**
| Metric | Target | Measurement |
|--------|--------|-------------|
| First Contentful Paint | < 1.5s | Lighthouse |
| Largest Contentful Paint | < 2.5s | Lighthouse |
| Time to Interactive | < 3.5s | Lighthouse |
| Cumulative Layout Shift | < 0.1 | Lighthouse |
| First Input Delay | < 100ms | Real User Monitoring |

**Optimization Techniques:**

**Code Splitting:**
```javascript
// Lazy load non-critical modules
const ReportsModule = () => import('./reports.js');
const ChartsModule = () => import('./charts.js');

// Load on demand
document.getElementById('reports-tab').addEventListener('click', async () => {
    const { initReports } = await ReportsModule();
    initReports();
});
```

**Image Optimization:**
```html
<!-- Responsive images -->
<img srcset="cookie-200.jpg 200w,
             cookie-400.jpg 400w,
             cookie-800.jpg 800w"
     sizes="(max-width: 600px) 200px,
            (max-width: 900px) 400px,
            800px"
     src="cookie-400.jpg"
     alt="Thin Mints cookies"
     loading="lazy">

<!-- WebP with fallback -->
<picture>
    <source type="image/webp" srcset="cookie.webp">
    <img src="cookie.jpg" alt="Cookie">
</picture>
```

**Critical CSS:**
```html
<head>
    <!-- Inline critical CSS -->
    <style>
        /* Above-the-fold styles */
        body { margin: 0; font-family: system-ui; }
        .header { background: #4CAF50; color: white; padding: 16px; }
        .loading { display: flex; justify-content: center; padding: 48px; }
    </style>

    <!-- Load full CSS async -->
    <link rel="preload" href="/styles.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
    <noscript><link rel="stylesheet" href="/styles.css"></noscript>
</head>
```

**API Response Caching:**
```javascript
// Cache API responses
const apiCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function cachedFetch(url, options = {}) {
    const cacheKey = url;
    const cached = apiCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    const response = await fetch(url, options);
    const data = await response.json();

    apiCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
}
```

---

## Database Changes

```sql
-- Push notification subscriptions
CREATE TABLE push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    subscription TEXT NOT NULL,
    userAgent TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    lastUsed TEXT,
    FOREIGN KEY (userId) REFERENCES users(id)
);

-- Notification preferences
CREATE TABLE notification_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL UNIQUE,
    goalMilestones INTEGER DEFAULT 1,
    boothReminders INTEGER DEFAULT 1,
    salesRecorded INTEGER DEFAULT 0,
    troopAnnouncements INTEGER DEFAULT 1,
    lowInventory INTEGER DEFAULT 1,
    quietHoursStart TEXT,
    quietHoursEnd TEXT,
    FOREIGN KEY (userId) REFERENCES users(id)
);

-- Onboarding progress
ALTER TABLE users ADD COLUMN onboardingStep INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN onboardingCompletedAt TEXT;
```

---

## Frontend Changes

### PWA Manifest
```json
{
    "name": "GSCTracker",
    "short_name": "GSCTracker",
    "description": "Girl Scout Cookie Sales Tracker",
    "start_url": "/",
    "display": "standalone",
    "background_color": "#ffffff",
    "theme_color": "#4CAF50",
    "icons": [
        { "src": "/icons/icon-72.png", "sizes": "72x72", "type": "image/png" },
        { "src": "/icons/icon-96.png", "sizes": "96x96", "type": "image/png" },
        { "src": "/icons/icon-128.png", "sizes": "128x128", "type": "image/png" },
        { "src": "/icons/icon-144.png", "sizes": "144x144", "type": "image/png" },
        { "src": "/icons/icon-152.png", "sizes": "152x152", "type": "image/png" },
        { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
        { "src": "/icons/icon-384.png", "sizes": "384x384", "type": "image/png" },
        { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
    ],
    "shortcuts": [
        {
            "name": "Add Sale",
            "url": "/?action=add-sale",
            "icons": [{ "src": "/icons/add-sale.png", "sizes": "96x96" }]
        },
        {
            "name": "View Reports",
            "url": "/reports",
            "icons": [{ "src": "/icons/reports.png", "sizes": "96x96" }]
        }
    ]
}
```

### New Files
```
/public/
├── sw.js                     - Service worker
├── manifest.json             - PWA manifest
├── offline.html              - Offline fallback page
├── onboarding/
│   ├── scout.html            - Scout onboarding
│   ├── parent.html           - Parent onboarding
│   └── leader.html           - Leader onboarding
├── icons/
│   ├── icon-72.png
│   ├── icon-96.png
│   └── ...
└── js/
    ├── offline.js            - Offline functionality
    ├── notifications.js      - Push notifications
    └── onboarding.js         - Onboarding logic
```

---

## API Endpoints

### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/notifications/subscribe` | Subscribe to push |
| DELETE | `/api/notifications/unsubscribe` | Unsubscribe |
| GET | `/api/notifications/preferences` | Get preferences |
| PUT | `/api/notifications/preferences` | Update preferences |

### Onboarding
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/onboarding/status` | Get onboarding status |
| POST | `/api/onboarding/complete/:step` | Complete step |
| POST | `/api/onboarding/skip` | Skip onboarding |

---

## Testing Checklist

### PWA
- [ ] App installable on mobile
- [ ] Works offline (cached pages)
- [ ] Offline actions queue and sync
- [ ] Push notifications received
- [ ] Notification preferences respected

### Mobile UX
- [ ] Touch targets minimum 48px
- [ ] Quick sale entry works smoothly
- [ ] Bottom navigation functional
- [ ] Landscape mode usable
- [ ] No horizontal scroll

### Accessibility
- [ ] Lighthouse accessibility score > 90
- [ ] Screen reader navigation works
- [ ] Keyboard-only navigation works
- [ ] Color contrast meets WCAG AA
- [ ] Focus indicators visible

### Performance
- [ ] Lighthouse performance score > 80
- [ ] LCP < 2.5s
- [ ] FID < 100ms
- [ ] CLS < 0.1

---

## Dependencies to Add

```json
{
  "web-push": "^3.6.6",
  "idb": "^7.1.1",
  "workbox-webpack-plugin": "^7.0.0"
}
```

---

## Acceptance Criteria

1. **App works offline with queued sync**
2. **Push notifications delivered reliably**
3. **Mobile booth tracking is fast and easy**
4. **Onboarding guides new users effectively**
5. **WCAG 2.1 AA compliance achieved**
6. **Performance meets target metrics**

---

## Next Phase

**Phase 7: Integrations & API** will implement:
- Troop-level API with authentication
- API key management
- Payment processing integration
- Calendar export
- Improved import/export
