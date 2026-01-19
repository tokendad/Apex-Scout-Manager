# Logging Documentation

GSCTracker includes comprehensive error logging using Winston with daily rotation and colored console output.

## Features

- **Colored Console Output**: Easy-to-read colored logs in the terminal
  - 🟢 **INFO** (Green): Normal operations and successful actions
  - 🟡 **WARN** (Yellow): Warnings and 4xx HTTP errors
  - 🔴 **ERROR** (Red): Errors and 5xx HTTP errors

- **File Logging**: All logs are written to JSON files in `/data/logs/`
  - `gsctracker-YYYY-MM-DD.log`: All application logs
  - `error-YYYY-MM-DD.log`: Error-only logs for quick troubleshooting

- **Automatic Rotation**: Logs rotate daily at midnight
- **Retention Policy**: Old logs are kept for 7 days, then automatically deleted
- **Request Logging**: All HTTP requests are logged with method, path, status code, duration, and IP

## Log Location

When running with Docker:
- Logs are stored in `/data/logs/` inside the container
- The `/data` directory is mounted as a volume (default: `./data`)
- Access logs on the host at `./data/logs/`

When running directly with Node.js:
- Logs are stored in `$DATA_DIR/logs/` (default: `/data/logs/`)
- Set `DATA_DIR` environment variable to change the location

## Log Format

Console output:
```
2026-01-19 00:20:47 [INFO]: GSCTracker server running on port 3000
2026-01-19 00:20:59 [WARN]: Invalid sale data received | {"quantity":-1}
2026-01-19 00:21:12 [ERROR]: Failed to initialize database | {"error":"..."}
```

File output (JSON):
```json
{
  "level": "info",
  "message": "GSCTracker server running on port 3000",
  "timestamp": "2026-01-19 00:20:47"
}
```

## Configuration

Environment variables:
- `LOG_LEVEL`: Set minimum log level (default: `info`)
  - Options: `error`, `warn`, `info`, `debug`
- `DATA_DIR`: Base directory for data and logs (default: `/data`)
- `LOG_DIR`: Override log directory (default: `$DATA_DIR/logs`)

Example:
```bash
LOG_LEVEL=debug DATA_DIR=/app/data node server.js
```

## Docker Integration

The Docker configuration is pre-configured for logging:
- Logs appear in container terminal output with colors
- Logs are persisted in the mounted `/data/logs` directory
- Log directory permissions are automatically set by the entrypoint script

## Viewing Logs

View live logs from Docker:
```bash
docker logs -f gsctracker
```

View log files directly:
```bash
# All logs
cat data/logs/gsctracker-$(date +%Y-%m-%d).log

# Errors only
cat data/logs/error-$(date +%Y-%m-%d).log
```

## For Developers

When adding new features, use the logger module:

```javascript
const logger = require('./logger');

// Info: successful operations
logger.info('Operation completed', { userId: 123 });

// Warn: recoverable issues
logger.warn('Deprecated endpoint used', { endpoint: '/old-api' });

// Error: failures requiring attention
logger.error('Database query failed', { error: err.message, stack: err.stack });
```

Always include relevant context in the metadata object for better debugging.
