# Phase 7: Integrations & API

**Status:** ⏳ PLANNED
**Timeline:** Months 11-12
**Focus:** External integrations and extensibility
**Prerequisites:** Phase 1-6 completed

---

## Overview

Phase 7 implements external integrations and a public API for third-party access. This includes payment processing, calendar integration, and a documented API for custom tools and automation.

---

## Deliverables

### 7.1 Troop-Level API with Authentication

**Goal:** Provide programmatic access to troop data

**API Design Principles:**
- RESTful design with JSON responses
- Versioned endpoints (`/api/v1/`)
- Consistent error responses
- Rate limiting per API key
- Pagination for list endpoints

**Authentication Methods:**
| Method | Use Case | Security |
|--------|----------|----------|
| Session Cookie | Web app users | Standard session |
| API Key | Server-to-server | Long-lived key |
| OAuth 2.0 | Third-party apps | Token-based |

**API Key Authentication:**
```javascript
// Middleware for API key auth
const apiKeyAuth = async (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;

    if (!apiKey) {
        return res.status(401).json({ error: 'API key required' });
    }

    const key = await db.prepare(
        'SELECT * FROM api_keys WHERE keyHash = ? AND isActive = 1'
    ).get(hashApiKey(apiKey));

    if (!key) {
        return res.status(401).json({ error: 'Invalid API key' });
    }

    // Check rate limit
    if (await isRateLimited(key.id)) {
        return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    // Update last used
    await db.prepare(
        'UPDATE api_keys SET lastUsed = datetime("now"), usageCount = usageCount + 1 WHERE id = ?'
    ).run(key.id);

    req.apiKey = key;
    req.troopId = key.troopId;
    next();
};
```

**Database Schema:**
```sql
CREATE TABLE api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    troopId INTEGER NOT NULL,
    userId INTEGER NOT NULL,               -- Who created the key
    name TEXT NOT NULL,                    -- Descriptive name
    keyHash TEXT UNIQUE NOT NULL,          -- Hashed API key
    keyPrefix TEXT NOT NULL,               -- First 8 chars for identification
    permissions TEXT NOT NULL,             -- JSON array of permissions
    rateLimit INTEGER DEFAULT 1000,        -- Requests per hour
    usageCount INTEGER DEFAULT 0,
    lastUsed TEXT,
    expiresAt TEXT,
    isActive INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (troopId) REFERENCES troops(id),
    FOREIGN KEY (userId) REFERENCES users(id)
);

CREATE TABLE api_key_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    apiKeyId INTEGER NOT NULL,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    statusCode INTEGER,
    responseTime INTEGER,                  -- milliseconds
    ipAddress TEXT,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (apiKeyId) REFERENCES api_keys(id)
);
```

**API Key Permissions:**
```javascript
const PERMISSIONS = {
    // Read permissions
    'sales:read': 'View sales data',
    'inventory:read': 'View inventory',
    'scouts:read': 'View scout list',
    'events:read': 'View events',
    'reports:read': 'Generate reports',

    // Write permissions
    'sales:write': 'Create/update sales',
    'inventory:write': 'Update inventory',
    'events:write': 'Create/update events',

    // Admin permissions
    'troop:admin': 'Manage troop settings'
};
```

### 7.2 API Key Management

**Goal:** Allow troop leaders to create and manage API keys

**Key Management Features:**
- Create new API keys
- Set permissions per key
- Set expiration date
- View usage statistics
- Revoke keys instantly
- Regenerate keys

**API Endpoints - Key Management:**
```
GET    /api/v1/keys                       - List my API keys
POST   /api/v1/keys                       - Create new key
GET    /api/v1/keys/:id                   - Get key details
PUT    /api/v1/keys/:id                   - Update key settings
DELETE /api/v1/keys/:id                   - Revoke key
POST   /api/v1/keys/:id/regenerate        - Regenerate key
GET    /api/v1/keys/:id/usage             - Usage statistics
```

**Key Creation Response:**
```json
{
    "id": 1,
    "name": "Inventory Sync",
    "keyPrefix": "gsc_abc12",
    "apiKey": "gsc_abc123def456ghi789jkl012mno345pqr",
    "permissions": ["inventory:read", "inventory:write"],
    "rateLimit": 1000,
    "expiresAt": "2027-01-31T00:00:00Z",
    "createdAt": "2026-01-31T10:30:00Z",
    "note": "Save this key securely. It won't be shown again."
}
```

**Frontend - API Key Management:**
```html
<div class="api-keys-page">
    <h2>API Keys</h2>
    <p>Use API keys to integrate GSCTracker with other tools.</p>

    <button class="btn-primary" onclick="showCreateKeyModal()">
        Create New Key
    </button>

    <table class="api-keys-table">
        <thead>
            <tr>
                <th>Name</th>
                <th>Key</th>
                <th>Permissions</th>
                <th>Last Used</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Inventory Sync</td>
                <td><code>gsc_abc12...***</code></td>
                <td>inventory:read, inventory:write</td>
                <td>2 hours ago</td>
                <td>
                    <button class="btn-sm">Edit</button>
                    <button class="btn-sm btn-danger">Revoke</button>
                </td>
            </tr>
        </tbody>
    </table>
</div>
```

### 7.3 Public API Endpoints

**Goal:** Comprehensive API for all troop data

**API v1 Endpoints:**

**Sales:**
```
GET    /api/v1/sales                      - List sales (paginated)
POST   /api/v1/sales                      - Create sale
GET    /api/v1/sales/:id                  - Get sale details
PUT    /api/v1/sales/:id                  - Update sale
DELETE /api/v1/sales/:id                  - Delete sale
GET    /api/v1/sales/summary              - Sales summary stats
```

**Inventory:**
```
GET    /api/v1/inventory                  - Current inventory
PUT    /api/v1/inventory                  - Update inventory (bulk)
GET    /api/v1/inventory/history          - Transaction history
POST   /api/v1/inventory/transfer         - Transfer cookies
```

**Scouts:**
```
GET    /api/v1/scouts                     - List scouts
GET    /api/v1/scouts/:id                 - Scout details
GET    /api/v1/scouts/:id/sales           - Scout's sales
GET    /api/v1/scouts/:id/inventory       - Scout's inventory
```

**Events:**
```
GET    /api/v1/events                     - List events
POST   /api/v1/events                     - Create event
GET    /api/v1/events/:id                 - Event details
PUT    /api/v1/events/:id                 - Update event
DELETE /api/v1/events/:id                 - Delete event
```

**Reports:**
```
GET    /api/v1/reports/summary            - Troop summary
GET    /api/v1/reports/cookies            - Cookie breakdown
GET    /api/v1/reports/scouts             - Scout comparison
GET    /api/v1/reports/booths             - Booth performance
```

**API Response Format:**
```json
{
    "success": true,
    "data": { ... },
    "meta": {
        "page": 1,
        "perPage": 50,
        "total": 234,
        "totalPages": 5
    }
}
```

**Error Response Format:**
```json
{
    "success": false,
    "error": {
        "code": "VALIDATION_ERROR",
        "message": "Invalid cookie type",
        "details": {
            "field": "cookieType",
            "value": "Unknown Cookie"
        }
    }
}
```

**Pagination:**
```
GET /api/v1/sales?page=2&per_page=50&sort=-date

Query Parameters:
- page: Page number (default: 1)
- per_page: Items per page (default: 50, max: 100)
- sort: Sort field, prefix with - for descending
- filter[field]: Filter by field value
```

### 7.4 Payment Processing Integration (Stripe/Square)

**Goal:** Accept card payments directly through the app

**Supported Processors:**
| Processor | Use Case | Fees |
|-----------|----------|------|
| Stripe | Online payments | 2.9% + $0.30 |
| Square | In-person booth | 2.6% + $0.10 |
| PayPal | Alternative online | 2.9% + $0.30 |

**Stripe Integration:**
```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Create payment intent for sale
app.post('/api/v1/payments/intent', apiKeyAuth, async (req, res) => {
    const { amount, saleId, customerEmail } = req.body;

    const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // cents
        currency: 'usd',
        metadata: {
            troopId: req.troopId,
            saleId: saleId
        },
        receipt_email: customerEmail
    });

    res.json({ clientSecret: paymentIntent.client_secret });
});

// Webhook for payment confirmation
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
    );

    if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;
        await recordPayment(
            paymentIntent.metadata.saleId,
            paymentIntent.amount / 100,
            'stripe',
            paymentIntent.id
        );
    }

    res.json({ received: true });
});
```

**Square Integration:**
```javascript
const { Client, Environment } = require('square');

const squareClient = new Client({
    accessToken: process.env.SQUARE_ACCESS_TOKEN,
    environment: Environment.Production
});

// Create checkout for booth sale
app.post('/api/v1/payments/square/checkout', apiKeyAuth, async (req, res) => {
    const { amount, items, boothEventId } = req.body;

    const response = await squareClient.checkoutApi.createPaymentLink({
        idempotencyKey: `booth-${boothEventId}-${Date.now()}`,
        order: {
            locationId: process.env.SQUARE_LOCATION_ID,
            lineItems: items.map(item => ({
                name: item.cookieName,
                quantity: String(item.quantity),
                basePriceMoney: {
                    amount: BigInt(item.price * 100),
                    currency: 'USD'
                }
            }))
        },
        checkoutOptions: {
            redirectUrl: `${process.env.APP_URL}/booth/${boothEventId}/payment-complete`
        }
    });

    res.json({ checkoutUrl: response.result.paymentLink.url });
});
```

**Database Schema:**
```sql
CREATE TABLE payment_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    troopId INTEGER NOT NULL,
    saleId INTEGER,
    boothEventId INTEGER,
    processor TEXT NOT NULL,              -- stripe, square, paypal
    transactionId TEXT NOT NULL,          -- External transaction ID
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT NOT NULL,                 -- pending, succeeded, failed, refunded
    customerEmail TEXT,
    metadata TEXT,                        -- JSON
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT,
    FOREIGN KEY (troopId) REFERENCES troops(id),
    FOREIGN KEY (saleId) REFERENCES sales(id),
    FOREIGN KEY (boothEventId) REFERENCES booth_events(id)
);

CREATE TABLE payment_processor_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    troopId INTEGER NOT NULL UNIQUE,
    stripeEnabled INTEGER DEFAULT 0,
    stripeAccountId TEXT,                 -- Connected account ID
    squareEnabled INTEGER DEFAULT 0,
    squareLocationId TEXT,
    paypalEnabled INTEGER DEFAULT 0,
    paypalMerchantId TEXT,
    FOREIGN KEY (troopId) REFERENCES troops(id)
);
```

**Payment Flow:**
```
1. Customer selects "Pay with Card"
2. Frontend creates payment intent via API
3. Stripe/Square payment form displayed
4. Customer enters card details
5. Payment processed by processor
6. Webhook confirms payment
7. Sale marked as paid
8. Receipt emailed to customer
```

### 7.5 Calendar Export (iCal Format)

**Goal:** Export booth events to external calendars

**iCal Export Features:**
- Export single event
- Export all troop events
- Export personal shifts
- Subscribe via URL (live updates)
- Include event details and location

**iCal Generation:**
```javascript
const ical = require('ical-generator');

// Generate calendar for troop events
app.get('/api/v1/calendar/troop/:troopId.ics', async (req, res) => {
    const events = await getBoothEvents(req.params.troopId);

    const calendar = ical({
        name: `Troop ${troopNumber} Cookie Booths`,
        timezone: 'America/New_York'
    });

    for (const event of events) {
        calendar.createEvent({
            start: new Date(event.startDateTime),
            end: new Date(event.endDateTime),
            summary: event.eventName,
            location: event.location,
            description: `Cookie booth event\n\nDetails: ${event.notes || 'None'}`,
            url: `${process.env.APP_URL}/events/${event.id}`
        });
    }

    res.set('Content-Type', 'text/calendar');
    res.set('Content-Disposition', `attachment; filename="troop-${troopNumber}-events.ics"`);
    res.send(calendar.toString());
});

// Generate calendar for scout's shifts
app.get('/api/v1/calendar/my-shifts.ics', async (req, res) => {
    const shifts = await getMyShifts(req.user.id);

    const calendar = ical({
        name: 'My Cookie Booth Shifts',
        timezone: 'America/New_York'
    });

    for (const shift of shifts) {
        calendar.createEvent({
            start: new Date(shift.startTime),
            end: new Date(shift.endTime),
            summary: `Cookie Booth: ${shift.eventName}`,
            location: shift.location,
            description: `Your shift at ${shift.eventName}`,
            alarms: [
                { type: 'display', trigger: 24 * 60 }, // 24 hours before
                { type: 'display', trigger: 60 }       // 1 hour before
            ]
        });
    }

    res.set('Content-Type', 'text/calendar');
    res.send(calendar.toString());
});
```

**Calendar Subscription URL:**
```
https://gsctracker.com/api/v1/calendar/troop/1234.ics?key=abc123

Use this URL in:
- Google Calendar: "Add by URL"
- Apple Calendar: "Subscribe to Calendar"
- Outlook: "Add calendar from Internet"
```

### 7.6 Improved Import/Export

**Goal:** Better data portability with validation

**Bulk Sales Import:**
```javascript
// Import sales from CSV/Excel
app.post('/api/v1/import/sales', upload.single('file'), async (req, res) => {
    const file = req.file;
    const rows = await parseFile(file);

    const results = {
        total: rows.length,
        imported: 0,
        errors: []
    };

    const transaction = db.transaction((rows) => {
        for (const [index, row] of rows.entries()) {
            try {
                // Validate row
                const validated = validateSaleRow(row);

                // Insert sale
                db.prepare(`
                    INSERT INTO sales (cookieType, quantity, customerName, date, userId, troopId)
                    VALUES (?, ?, ?, ?, ?, ?)
                `).run(
                    validated.cookieType,
                    validated.quantity,
                    validated.customerName,
                    validated.date,
                    req.user.id,
                    req.troopId
                );

                results.imported++;
            } catch (err) {
                results.errors.push({
                    row: index + 2, // Account for header
                    error: err.message,
                    data: row
                });
            }
        }
    });

    transaction(rows);

    res.json(results);
});
```

**Import Template Download:**
```
GET /api/v1/import/template/sales.csv
GET /api/v1/import/template/scouts.csv
GET /api/v1/import/template/inventory.csv
```

**Sales Import Template (CSV):**
```csv
Date,Cookie Type,Quantity,Customer Name,Customer Email,Customer Phone,Payment Status,Payment Method,Notes
2026-01-15,Thin Mints,2,John Smith,john@email.com,555-1234,Paid,Cash,
2026-01-15,Samoas,3,Jane Doe,jane@email.com,,Pending,Credit Card,Will pay on delivery
```

**Import Validation Rules:**
```javascript
const validateSaleRow = (row) => {
    const errors = [];

    // Required fields
    if (!row.date) errors.push('Date is required');
    if (!row.cookieType) errors.push('Cookie type is required');
    if (!row.quantity) errors.push('Quantity is required');

    // Date format
    if (row.date && !isValidDate(row.date)) {
        errors.push('Invalid date format. Use YYYY-MM-DD');
    }

    // Cookie type validation
    if (row.cookieType && !VALID_COOKIES.includes(row.cookieType)) {
        errors.push(`Invalid cookie type: ${row.cookieType}`);
    }

    // Quantity validation
    const qty = parseInt(row.quantity);
    if (isNaN(qty) || qty <= 0) {
        errors.push('Quantity must be a positive number');
    }

    if (errors.length > 0) {
        throw new Error(errors.join('; '));
    }

    return {
        date: row.date,
        cookieType: row.cookieType,
        quantity: qty,
        customerName: row.customerName || null,
        customerEmail: row.customerEmail || null,
        customerPhone: row.customerPhone || null,
        paymentStatus: row.paymentStatus || 'Pending',
        paymentMethod: row.paymentMethod || null,
        notes: row.notes || null
    };
};
```

### 7.7 Webhooks

**Goal:** Allow external systems to receive real-time updates

**Webhook Events:**
```javascript
const WEBHOOK_EVENTS = {
    'sale.created': 'New sale recorded',
    'sale.updated': 'Sale updated',
    'sale.deleted': 'Sale deleted',
    'inventory.updated': 'Inventory changed',
    'event.created': 'Booth event created',
    'event.started': 'Booth event started',
    'event.ended': 'Booth event ended',
    'payment.received': 'Payment received',
    'goal.achieved': 'Goal milestone reached'
};
```

**Database Schema:**
```sql
CREATE TABLE webhooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    troopId INTEGER NOT NULL,
    url TEXT NOT NULL,
    events TEXT NOT NULL,                 -- JSON array of event types
    secret TEXT NOT NULL,                 -- For signing payloads
    isActive INTEGER DEFAULT 1,
    failureCount INTEGER DEFAULT 0,
    lastDelivery TEXT,
    lastStatus INTEGER,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (troopId) REFERENCES troops(id)
);

CREATE TABLE webhook_deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    webhookId INTEGER NOT NULL,
    eventType TEXT NOT NULL,
    payload TEXT NOT NULL,
    responseStatus INTEGER,
    responseBody TEXT,
    deliveredAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (webhookId) REFERENCES webhooks(id)
);
```

**Webhook Delivery:**
```javascript
const crypto = require('crypto');

async function deliverWebhook(troopId, eventType, data) {
    const webhooks = await db.prepare(
        `SELECT * FROM webhooks
         WHERE troopId = ? AND isActive = 1
         AND events LIKE ?`
    ).all(troopId, `%"${eventType}"%`);

    for (const webhook of webhooks) {
        const payload = JSON.stringify({
            event: eventType,
            timestamp: new Date().toISOString(),
            data: data
        });

        const signature = crypto
            .createHmac('sha256', webhook.secret)
            .update(payload)
            .digest('hex');

        try {
            const response = await fetch(webhook.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-GSCTracker-Signature': `sha256=${signature}`,
                    'X-GSCTracker-Event': eventType
                },
                body: payload,
                timeout: 30000
            });

            await logDelivery(webhook.id, eventType, payload, response.status);

            if (!response.ok) {
                await incrementFailureCount(webhook.id);
            } else {
                await resetFailureCount(webhook.id);
            }
        } catch (err) {
            await logDelivery(webhook.id, eventType, payload, 0, err.message);
            await incrementFailureCount(webhook.id);
        }
    }
}
```

**Webhook API Endpoints:**
```
GET    /api/v1/webhooks                   - List webhooks
POST   /api/v1/webhooks                   - Create webhook
GET    /api/v1/webhooks/:id               - Get webhook details
PUT    /api/v1/webhooks/:id               - Update webhook
DELETE /api/v1/webhooks/:id               - Delete webhook
GET    /api/v1/webhooks/:id/deliveries    - Delivery history
POST   /api/v1/webhooks/:id/test          - Send test event
```

---

## API Documentation

**OpenAPI/Swagger Documentation:**
```yaml
openapi: 3.0.0
info:
  title: GSCTracker API
  version: 1.0.0
  description: API for Girl Scout Cookie Sales Tracking

servers:
  - url: https://gsctracker.com/api/v1
    description: Production

security:
  - ApiKeyAuth: []

paths:
  /sales:
    get:
      summary: List sales
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: per_page
          in: query
          schema:
            type: integer
            default: 50
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SalesListResponse'

components:
  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      in: header
      name: X-API-Key

  schemas:
    Sale:
      type: object
      properties:
        id:
          type: integer
        cookieType:
          type: string
        quantity:
          type: integer
        # ...
```

**Documentation Site:**
- Interactive API explorer
- Code samples (cURL, JavaScript, Python)
- Authentication guide
- Webhook setup guide
- Rate limiting info

---

## Frontend Changes

### New Pages
```
/public/
├── developer/
│   ├── api-keys.html         - API key management
│   ├── webhooks.html         - Webhook management
│   └── docs.html             - API documentation
├── settings/
│   ├── payments.html         - Payment processor setup
│   └── integrations.html     - Third-party integrations
```

---

## Testing Checklist

### API Keys
- [ ] Create API key with permissions
- [ ] Use API key to authenticate
- [ ] Rate limiting enforced
- [ ] Key revocation works
- [ ] Key regeneration works

### API Endpoints
- [ ] All endpoints return correct data
- [ ] Pagination works correctly
- [ ] Filtering works
- [ ] Error responses are consistent
- [ ] Rate limits respected

### Payment Integration
- [ ] Stripe payment flow works
- [ ] Webhooks received and processed
- [ ] Refunds work
- [ ] Payment recorded in system

### Calendar Export
- [ ] iCal file downloads
- [ ] Events appear in Google Calendar
- [ ] Subscription URL updates

### Import/Export
- [ ] CSV import validates data
- [ ] Errors reported clearly
- [ ] Template download works
- [ ] Bulk import handles large files

### Webhooks
- [ ] Webhooks created successfully
- [ ] Events delivered to endpoint
- [ ] Signature verification works
- [ ] Failed deliveries logged

---

## Dependencies to Add

```json
{
  "stripe": "^14.10.0",
  "square": "^35.0.0",
  "ical-generator": "^6.0.1",
  "swagger-ui-express": "^5.0.0",
  "yaml": "^2.3.4"
}
```

---

## Environment Variables

```env
# API
API_RATE_LIMIT=1000              # Requests per hour per key

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Square
SQUARE_ACCESS_TOKEN=...
SQUARE_LOCATION_ID=...

# PayPal
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
```

---

## Acceptance Criteria

1. **API keys can be created and managed**
2. **All troop data accessible via API**
3. **Payment processing works end-to-end**
4. **Calendar export integrates with major apps**
5. **Bulk import handles validation gracefully**
6. **Webhooks deliver events reliably**

---

## Next Phase

**Phase 8: Scale & Polish** will implement:
- Performance optimization
- Database optimization
- Monitoring and alerting
- Cloud deployment guides
- Production documentation
