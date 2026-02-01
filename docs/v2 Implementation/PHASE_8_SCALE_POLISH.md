# Phase 8: Scale & Polish

**Status:** ⏳ PLANNED
**Timeline:** Months 12-14
**Focus:** Production readiness and documentation
**Prerequisites:** Phase 1-7 completed

---

## Overview

Phase 8 is the final phase, focusing on performance optimization, production hardening, monitoring, and comprehensive documentation. This phase prepares GSCTracker 2.0 for production deployment at scale.

---

## Deliverables

### 8.1 Performance Optimization and Caching

**Goal:** Ensure fast response times under load

**Performance Targets:**
| Metric | Target | Current |
|--------|--------|---------|
| API response time (p50) | < 100ms | TBD |
| API response time (p99) | < 500ms | TBD |
| Page load time | < 2s | TBD |
| Database query time | < 50ms | TBD |
| Concurrent users | 100+ per troop | TBD |

**Caching Strategy:**

**Application-Level Caching:**
```javascript
const NodeCache = require('node-cache');

// In-memory cache with TTL
const cache = new NodeCache({
    stdTTL: 300,           // 5 minute default TTL
    checkperiod: 60,       // Check for expired keys every 60s
    useClones: false       // Return reference for performance
});

// Cache middleware
const cacheMiddleware = (ttl = 300) => {
    return (req, res, next) => {
        const key = `${req.method}:${req.originalUrl}:${req.session?.userId || 'anon'}`;
        const cached = cache.get(key);

        if (cached) {
            return res.json(cached);
        }

        // Store original json method
        const originalJson = res.json.bind(res);

        res.json = (data) => {
            cache.set(key, data, ttl);
            return originalJson(data);
        };

        next();
    };
};

// Usage
app.get('/api/troops/:tid/summary', cacheMiddleware(60), getTroopSummary);
```

**Redis Caching (Optional for Scale):**
```javascript
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

// Cache with Redis
async function getCached(key, fetchFn, ttl = 300) {
    const cached = await redis.get(key);
    if (cached) {
        return JSON.parse(cached);
    }

    const data = await fetchFn();
    await redis.setex(key, ttl, JSON.stringify(data));
    return data;
}

// Cache invalidation
async function invalidateCache(pattern) {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
        await redis.del(...keys);
    }
}

// Invalidate on data change
async function createSale(sale) {
    const result = await db.insert('sales', sale);

    // Invalidate related caches
    await invalidateCache(`troop:${sale.troopId}:summary:*`);
    await invalidateCache(`scout:${sale.userId}:summary:*`);

    return result;
}
```

**Response Compression:**
```javascript
const compression = require('compression');

app.use(compression({
    level: 6,              // Balance between CPU and compression
    threshold: 1024,       // Only compress responses > 1KB
    filter: (req, res) => {
        // Don't compress already compressed files
        if (req.headers['accept-encoding']?.includes('br')) {
            return false;
        }
        return compression.filter(req, res);
    }
}));
```

**Static Asset Optimization:**
```javascript
// Long cache for versioned assets
app.use('/static', express.static('public/static', {
    maxAge: '1y',
    immutable: true
}));

// Short cache for HTML
app.use(express.static('public', {
    maxAge: '1h',
    etag: true
}));
```

### 8.2 Database Optimization

**Goal:** Efficient queries and data management

**Index Optimization:**
```sql
-- Analyze existing indexes
.indices sales
.indices users
.indices booth_events

-- Add missing indexes based on query patterns
CREATE INDEX IF NOT EXISTS idx_sales_user_date ON sales(userId, date);
CREATE INDEX IF NOT EXISTS idx_sales_troop_cookie ON sales(troopId, cookieType);
CREATE INDEX IF NOT EXISTS idx_sales_date_status ON sales(date, orderStatus);

CREATE INDEX IF NOT EXISTS idx_booth_events_troop_date ON booth_events(troopId, startDateTime);
CREATE INDEX IF NOT EXISTS idx_booth_shifts_scout_date ON booth_shifts(scoutId, startTime);

CREATE INDEX IF NOT EXISTS idx_inventory_troop_cookie ON inventory_balances(troopId, cookieProductId);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON inventory_transactions(timestamp);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_sales_troop_user_date
ON sales(troopId, userId, date);
```

**Query Optimization:**
```javascript
// Before: N+1 query problem
async function getTroopSalesOld(troopId) {
    const scouts = await db.all('SELECT * FROM troop_members WHERE troopId = ?', troopId);
    for (const scout of scouts) {
        scout.sales = await db.all('SELECT * FROM sales WHERE userId = ?', scout.userId);
    }
    return scouts;
}

// After: Single query with JOIN
async function getTroopSalesOptimized(troopId) {
    return db.all(`
        SELECT
            tm.userId,
            u.firstName,
            u.lastName,
            COUNT(s.id) as salesCount,
            COALESCE(SUM(
                CASE WHEN s.unitType = 'cases'
                THEN s.quantity * 12
                ELSE s.quantity END
            ), 0) as totalBoxes,
            COALESCE(SUM(s.amountCollected), 0) as collected
        FROM troop_members tm
        JOIN users u ON tm.userId = u.id
        LEFT JOIN sales s ON tm.userId = s.userId
        WHERE tm.troopId = ? AND tm.role = 'scout'
        GROUP BY tm.userId, u.firstName, u.lastName
        ORDER BY totalBoxes DESC
    `, troopId);
}
```

**Database Maintenance:**
```javascript
// Scheduled maintenance tasks
const schedule = require('node-schedule');

// Run VACUUM weekly (Sunday 3 AM)
schedule.scheduleJob('0 3 * * 0', async () => {
    logger.info('Running database maintenance');

    // Analyze tables for query optimizer
    db.exec('ANALYZE');

    // Compact database (be careful with large DBs)
    db.exec('VACUUM');

    logger.info('Database maintenance complete');
});

// Clean old data monthly
schedule.scheduleJob('0 4 1 * *', async () => {
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 2);

    // Archive old audit logs
    db.run(`
        DELETE FROM audit_log
        WHERE timestamp < ?
        AND action NOT IN ('consent_granted', 'data_deletion')
    `, cutoffDate.toISOString());

    // Clean expired sessions
    db.run(`DELETE FROM sessions WHERE expiresAt < datetime('now')`);

    // Clean old export files
    db.run(`DELETE FROM export_requests WHERE expiresAt < datetime('now')`);
});
```

**Connection Pooling (if migrating to PostgreSQL):**
```javascript
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,               // Maximum connections
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Query with automatic connection management
async function query(sql, params) {
    const client = await pool.connect();
    try {
        return await client.query(sql, params);
    } finally {
        client.release();
    }
}
```

### 8.3 Monitoring and Alerting Setup

**Goal:** Proactive issue detection and resolution

**Application Metrics:**
```javascript
const promClient = require('prom-client');

// Enable default metrics
promClient.collectDefaultMetrics();

// Custom metrics
const httpRequestDuration = new promClient.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});

const activeUsers = new promClient.Gauge({
    name: 'active_users_total',
    help: 'Number of active user sessions'
});

const salesTotal = new promClient.Counter({
    name: 'sales_total',
    help: 'Total number of sales recorded',
    labelNames: ['troop_id']
});

// Middleware to track request duration
app.use((req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        httpRequestDuration
            .labels(req.method, req.route?.path || 'unknown', res.statusCode)
            .observe(duration);
    });

    next();
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', promClient.register.contentType);
    res.send(await promClient.register.metrics());
});
```

**Health Check Endpoint:**
```javascript
app.get('/health', async (req, res) => {
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks: {}
    };

    // Database check
    try {
        db.prepare('SELECT 1').get();
        health.checks.database = { status: 'healthy' };
    } catch (err) {
        health.checks.database = { status: 'unhealthy', error: err.message };
        health.status = 'unhealthy';
    }

    // Memory check
    const memUsage = process.memoryUsage();
    health.checks.memory = {
        status: memUsage.heapUsed < 500 * 1024 * 1024 ? 'healthy' : 'warning',
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
    };

    // Disk check (if applicable)
    try {
        const stats = fs.statfsSync(process.env.DATA_DIR || '/data');
        const freePercent = (stats.bavail / stats.blocks) * 100;
        health.checks.disk = {
            status: freePercent > 10 ? 'healthy' : 'warning',
            freePercent: `${freePercent.toFixed(1)}%`
        };
    } catch (err) {
        health.checks.disk = { status: 'unknown' };
    }

    res.status(health.status === 'healthy' ? 200 : 503).json(health);
});

// Detailed health for internal monitoring
app.get('/health/detailed', auth.isAuthenticated, auth.hasRole('admin'), async (req, res) => {
    // More detailed metrics for admins
});
```

**Error Tracking (Sentry):**
```javascript
const Sentry = require('@sentry/node');

Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,     // 10% of transactions
    integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
        new Sentry.Integrations.Express({ app })
    ]
});

// Request handler (first middleware)
app.use(Sentry.Handlers.requestHandler());

// Tracing handler
app.use(Sentry.Handlers.tracingHandler());

// Error handler (after all routes)
app.use(Sentry.Handlers.errorHandler());

// Custom error context
app.use((err, req, res, next) => {
    Sentry.withScope((scope) => {
        scope.setUser({ id: req.session?.userId });
        scope.setTag('troop_id', req.troopId);
        Sentry.captureException(err);
    });
    next(err);
});
```

**Alerting Rules (Prometheus/AlertManager):**
```yaml
# alerts.yml
groups:
  - name: gsctracker
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: High error rate detected

      - alert: SlowResponses
        expr: histogram_quantile(0.99, http_request_duration_seconds_bucket) > 2
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: P99 latency above 2 seconds

      - alert: DatabaseConnectionFailed
        expr: up{job="gsctracker-db"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: Database connection lost

      - alert: HighMemoryUsage
        expr: process_resident_memory_bytes > 500000000
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: Memory usage above 500MB
```

### 8.4 Cloud Deployment Options

**Goal:** Provide deployment guides for major cloud providers

**Docker Compose (Self-Hosted):**
```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=file:/data/gsctracker.db
      - SESSION_SECRET=${SESSION_SECRET}
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
    volumes:
      - ./data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./certs:/etc/nginx/certs
    depends_on:
      - app
    restart: unless-stopped
```

**AWS Deployment (ECS/Fargate):**
```yaml
# cloudformation.yml
AWSTemplateFormatVersion: '2010-09-09'
Description: GSCTracker ECS Deployment

Resources:
  ECSCluster:
    Type: AWS::ECS::Cluster
    Properties:
      ClusterName: gsctracker-cluster

  TaskDefinition:
    Type: AWS::ECS::TaskDefinition
    Properties:
      Family: gsctracker
      Cpu: '256'
      Memory: '512'
      NetworkMode: awsvpc
      RequiresCompatibilities:
        - FARGATE
      ContainerDefinitions:
        - Name: gsctracker
          Image: !Sub ${AWS::AccountId}.dkr.ecr.${AWS::Region}.amazonaws.com/gsctracker:latest
          PortMappings:
            - ContainerPort: 3000
          Environment:
            - Name: NODE_ENV
              Value: production
          Secrets:
            - Name: SESSION_SECRET
              ValueFrom: !Ref SessionSecretParam
          LogConfiguration:
            LogDriver: awslogs
            Options:
              awslogs-group: /ecs/gsctracker
              awslogs-region: !Ref AWS::Region
              awslogs-stream-prefix: ecs

  Service:
    Type: AWS::ECS::Service
    Properties:
      Cluster: !Ref ECSCluster
      TaskDefinition: !Ref TaskDefinition
      DesiredCount: 2
      LaunchType: FARGATE
      NetworkConfiguration:
        AwsvpcConfiguration:
          Subnets:
            - !Ref PrivateSubnet1
            - !Ref PrivateSubnet2
          SecurityGroups:
            - !Ref AppSecurityGroup
      LoadBalancers:
        - ContainerName: gsctracker
          ContainerPort: 3000
          TargetGroupArn: !Ref TargetGroup
```

**Google Cloud Run:**
```yaml
# cloudbuild.yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/gsctracker', '.']

  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/gsctracker']

  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'gsctracker'
      - '--image=gcr.io/$PROJECT_ID/gsctracker'
      - '--platform=managed'
      - '--region=us-central1'
      - '--allow-unauthenticated'
      - '--set-env-vars=NODE_ENV=production'
      - '--set-secrets=SESSION_SECRET=session-secret:latest'
```

**Azure Container Apps:**
```bash
# Deploy to Azure Container Apps
az containerapp create \
  --name gsctracker \
  --resource-group gsctracker-rg \
  --environment gsctracker-env \
  --image gsctracker.azurecr.io/gsctracker:latest \
  --target-port 3000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 10 \
  --env-vars NODE_ENV=production \
  --secrets session-secret=secretref:session-secret
```

### 8.5 Backup and Disaster Recovery

**Goal:** Protect data and enable quick recovery

**Backup Strategy:**
```javascript
const { execSync } = require('child_process');
const path = require('path');

// Automated backup script
async function createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = process.env.BACKUP_DIR || '/backups';
    const dbPath = process.env.DATABASE_PATH || '/data/gsctracker.db';

    // Create backup filename
    const backupFile = path.join(backupDir, `gsctracker-${timestamp}.db`);

    // Use SQLite backup command (online backup)
    db.exec(`VACUUM INTO '${backupFile}'`);

    // Compress backup
    execSync(`gzip ${backupFile}`);

    // Upload to cloud storage
    await uploadToS3(`${backupFile}.gz`, `backups/daily/${timestamp}.db.gz`);

    // Cleanup old backups (keep 30 days)
    await cleanupOldBackups(30);

    logger.info(`Backup created: ${backupFile}.gz`);
}

// Schedule backups
schedule.scheduleJob('0 2 * * *', createBackup); // Daily at 2 AM
```

**Restore Procedure:**
```bash
#!/bin/bash
# restore.sh - Database restore script

BACKUP_FILE=$1
DATA_DIR=${DATA_DIR:-/data}

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: ./restore.sh <backup_file>"
    exit 1
fi

# Stop application
docker-compose down

# Backup current database (just in case)
cp $DATA_DIR/gsctracker.db $DATA_DIR/gsctracker.db.pre-restore

# Restore from backup
if [[ $BACKUP_FILE == *.gz ]]; then
    gunzip -c $BACKUP_FILE > $DATA_DIR/gsctracker.db
else
    cp $BACKUP_FILE $DATA_DIR/gsctracker.db
fi

# Verify database integrity
sqlite3 $DATA_DIR/gsctracker.db "PRAGMA integrity_check;"

# Restart application
docker-compose up -d

echo "Restore complete"
```

**Disaster Recovery Plan:**
```
1. DETECTION
   - Monitoring alerts trigger
   - Health check fails
   - User reports issue

2. ASSESSMENT
   - Identify scope of issue
   - Determine data loss (if any)
   - Estimate recovery time

3. COMMUNICATION
   - Status page update
   - Email notification to troop leaders
   - Internal team notification

4. RECOVERY
   - Switch to backup region (if multi-region)
   - Restore from latest backup
   - Verify data integrity
   - Run smoke tests

5. VERIFICATION
   - Check all critical functions
   - Verify recent data
   - Monitor for issues

6. POST-MORTEM
   - Document incident
   - Identify root cause
   - Implement preventive measures
```

### 8.6 Load Testing

**Goal:** Verify performance under expected load

**Load Test Scenarios:**
```javascript
// k6 load test script
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    stages: [
        { duration: '2m', target: 50 },   // Ramp up to 50 users
        { duration: '5m', target: 50 },   // Stay at 50 users
        { duration: '2m', target: 100 },  // Ramp up to 100 users
        { duration: '5m', target: 100 },  // Stay at 100 users
        { duration: '2m', target: 0 },    // Ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<500'],  // 95% of requests under 500ms
        http_req_failed: ['rate<0.01'],    // Less than 1% errors
    },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
    // Login
    const loginRes = http.post(`${BASE_URL}/api/auth/login`, {
        email: 'test@example.com',
        password: 'testpass123',
    });
    check(loginRes, { 'login successful': (r) => r.status === 200 });

    // Get sales
    const salesRes = http.get(`${BASE_URL}/api/sales`);
    check(salesRes, { 'sales loaded': (r) => r.status === 200 });

    // Get troop summary
    const summaryRes = http.get(`${BASE_URL}/api/troops/1/reports/summary`);
    check(summaryRes, { 'summary loaded': (r) => r.status === 200 });

    // Create sale
    const createRes = http.post(`${BASE_URL}/api/sales`, JSON.stringify({
        cookieType: 'Thin Mints',
        quantity: 2,
        customerName: 'Test Customer',
    }), {
        headers: { 'Content-Type': 'application/json' },
    });
    check(createRes, { 'sale created': (r) => r.status === 201 });

    sleep(1);
}
```

**Performance Benchmarks:**
| Scenario | Users | RPS | P95 Latency | Error Rate |
|----------|-------|-----|-------------|------------|
| Read-heavy | 100 | 500 | < 200ms | < 0.1% |
| Write-heavy | 50 | 100 | < 500ms | < 0.1% |
| Mixed | 100 | 300 | < 300ms | < 0.1% |
| Peak (booth events) | 200 | 800 | < 500ms | < 0.5% |

### 8.7 Production Deployment Guide

**Goal:** Step-by-step production setup guide

**Pre-Deployment Checklist:**
```markdown
## Pre-Deployment Checklist

### Security
- [ ] SESSION_SECRET is unique and secure (32+ characters)
- [ ] ENCRYPTION_KEY is properly generated
- [ ] All API keys and secrets in environment variables
- [ ] HTTPS configured with valid certificate
- [ ] Security headers enabled
- [ ] Rate limiting configured
- [ ] CORS origins restricted

### Database
- [ ] Database backed up
- [ ] Migrations run successfully
- [ ] Indexes created
- [ ] Connection pooling configured (if PostgreSQL)

### Application
- [ ] NODE_ENV=production
- [ ] Debug logging disabled
- [ ] Error tracking configured (Sentry)
- [ ] Health check endpoint working
- [ ] Static assets optimized

### Infrastructure
- [ ] Firewall rules configured
- [ ] Load balancer healthy
- [ ] Auto-scaling configured
- [ ] Backup schedule set
- [ ] Monitoring alerts configured

### DNS & SSL
- [ ] DNS records configured
- [ ] SSL certificate valid
- [ ] HSTS enabled
- [ ] Domain verified

### Testing
- [ ] Smoke tests pass
- [ ] Load tests pass
- [ ] Security scan completed
- [ ] COPPA compliance verified
```

### 8.8 User Documentation and Training Materials

**Goal:** Comprehensive documentation for all user types

**Documentation Structure:**
```
docs/
├── user-guide/
│   ├── getting-started.md
│   ├── scout-guide.md
│   ├── parent-guide.md
│   ├── leader-guide.md
│   └── cookie-leader-guide.md
├── admin-guide/
│   ├── installation.md
│   ├── configuration.md
│   ├── backup-restore.md
│   ├── troubleshooting.md
│   └── security.md
├── api/
│   ├── authentication.md
│   ├── endpoints.md
│   ├── webhooks.md
│   └── examples.md
└── tutorials/
    ├── recording-first-sale.md
    ├── setting-up-booth.md
    ├── managing-inventory.md
    └── generating-reports.md
```

**Video Tutorial Topics:**
1. Scout: Recording Your First Sale
2. Scout: Setting Your Cookie Goal
3. Parent: Linking to Your Scout
4. Parent: Viewing Progress Reports
5. Leader: Setting Up Your Troop
6. Leader: Managing Booth Events
7. Leader: Generating Troop Reports
8. Cookie Leader: Managing Inventory
9. Cookie Leader: Placing Fulfillment Orders

---

## Final Release Checklist

```markdown
## GSCTracker 2.0 Release Checklist

### Code Quality
- [ ] All tests passing
- [ ] No critical security vulnerabilities
- [ ] Code review completed
- [ ] TypeScript/linting errors resolved

### Documentation
- [ ] README updated
- [ ] CHANGELOG updated
- [ ] API documentation complete
- [ ] User guides complete
- [ ] Deployment guide complete

### Testing
- [ ] Unit tests: >80% coverage
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] Load tests passing
- [ ] Security audit completed
- [ ] COPPA compliance verified

### Infrastructure
- [ ] Production environment ready
- [ ] Monitoring configured
- [ ] Alerting configured
- [ ] Backup system tested
- [ ] Disaster recovery tested

### Release
- [ ] Version tagged in git
- [ ] Docker image built and pushed
- [ ] Release notes written
- [ ] Announcement prepared

### Post-Release
- [ ] Smoke tests on production
- [ ] Monitor error rates
- [ ] Monitor performance
- [ ] Support team briefed
```

---

## Dependencies to Add

```json
{
  "prom-client": "^15.1.0",
  "@sentry/node": "^7.91.0",
  "node-cache": "^5.1.2",
  "node-schedule": "^2.1.1",
  "k6": "dev dependency for load testing"
}
```

---

## Environment Variables (Complete List)

```env
# Application
NODE_ENV=production
PORT=3000
APP_URL=https://gsctracker.example.com

# Database
DATABASE_PATH=/data/gsctracker.db
# DATABASE_URL=postgresql://user:pass@host/db  # If using PostgreSQL

# Security
SESSION_SECRET=your-32+-character-secret
ENCRYPTION_KEY=your-64-character-hex-key

# Authentication
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=https://gsctracker.example.com/api/auth/google/callback

# Email
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASS=your-smtp-password
SMTP_FROM=GSCTracker <noreply@example.com>

# Push Notifications
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key

# Payment Processing
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
SQUARE_ACCESS_TOKEN=...
SQUARE_LOCATION_ID=...

# Monitoring
SENTRY_DSN=https://...@sentry.io/...

# Backup
BACKUP_DIR=/backups
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BACKUP_BUCKET=gsctracker-backups

# Redis (optional)
REDIS_URL=redis://localhost:6379
```

---

## Testing Checklist

### Performance
- [ ] Page load < 2s
- [ ] API p95 < 500ms
- [ ] Load test passes at 100 users
- [ ] No memory leaks detected

### Monitoring
- [ ] Health endpoint returns status
- [ ] Metrics endpoint returns Prometheus format
- [ ] Sentry captures errors
- [ ] Alerts fire correctly

### Backup/Recovery
- [ ] Automated backup runs
- [ ] Backup uploads to cloud storage
- [ ] Restore process works
- [ ] Data integrity verified after restore

### Documentation
- [ ] All user guides complete
- [ ] API documentation accurate
- [ ] Deployment guide tested
- [ ] Video tutorials recorded

---

## Acceptance Criteria

1. **Application handles 100+ concurrent users per troop**
2. **API response times meet targets**
3. **Monitoring provides full visibility**
4. **Backups run automatically and can be restored**
5. **Documentation covers all features and user types**
6. **Production deployment is repeatable and documented**

---

## Project Completion

With Phase 8 complete, GSCTracker 2.0 is ready for production deployment with:

- Multi-user authentication and authorization
- COPPA compliance for minors
- Troop and scout management
- Booth event tracking
- Multi-level inventory management
- Comprehensive reporting
- Mobile-optimized PWA
- Public API for integrations
- Payment processing
- Production-grade monitoring and reliability

**Congratulations on completing the GSCTracker 2.0 implementation!**
