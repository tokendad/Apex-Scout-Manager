const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');

// Get log directory from environment or default to /data/logs
const LOG_DIR = process.env.LOG_DIR || path.join(process.env.DATA_DIR || '/data', 'logs');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Custom format for colorized console output
const consoleFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    let coloredLevel;
    switch (level) {
        case 'error':
            coloredLevel = chalk.red.bold(level.toUpperCase());
            break;
        case 'warn':
            coloredLevel = chalk.yellow.bold(level.toUpperCase());
            break;
        case 'info':
            coloredLevel = chalk.green(level.toUpperCase());
            break;
        default:
            coloredLevel = chalk.blue(level.toUpperCase());
    }
    
    const time = chalk.gray(timestamp);
    let metaStr = '';
    if (Object.keys(metadata).length > 0) {
        metaStr = chalk.gray(` | ${JSON.stringify(metadata)}`);
    }
    
    return `${time} [${coloredLevel}]: ${message}${metaStr}`;
});

// File transport with daily rotation
const fileRotateTransport = new DailyRotateFile({
    filename: path.join(LOG_DIR, 'asm-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxFiles: '7d', // Keep logs for 7 days
    maxSize: '20m', // Rotate if file exceeds 20MB
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    auditFile: path.join(LOG_DIR, '.audit.json')
});

// Error-only file transport with daily rotation
const errorFileRotateTransport = new DailyRotateFile({
    level: 'error',
    filename: path.join(LOG_DIR, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxFiles: '7d',
    maxSize: '20m',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    auditFile: path.join(LOG_DIR, '.audit-error.json')
});

// Create the logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    defaultMeta: { service: 'asm-backend' },
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true })
    ),
    transports: [
        // Console transport with colors
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                consoleFormat
            )
        }),
        // All logs file with rotation
        fileRotateTransport,
        // Error-only logs file with rotation
        errorFileRotateTransport
    ],
    exitOnError: false
});

// Log initialization (wrapped in try-catch for safety)
try {
    logger.info('Logger initialized', { logDirectory: LOG_DIR });
} catch (err) {
    // Fallback to console if logger fails
    console.error('Logger initialization failed:', err);
}

module.exports = logger;
