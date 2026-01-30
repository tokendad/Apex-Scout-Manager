const logger = require('./logger');

/**
 * Authentication Middleware
 * Protects routes by checking if user is authenticated via session
 */
function requireAuth(req, res, next) {
    if (req.session && req.session.userId) {
        // User is authenticated
        return next();
    }
    
    // User is not authenticated
    logger.warn('Unauthorized access attempt', { 
        ip: req.ip, 
        path: req.path,
        method: req.method 
    });
    
    return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Please log in to access this resource'
    });
}

/**
 * Check if user is already logged in
 * Used to redirect from login page if already authenticated
 */
function redirectIfAuthenticated(req, res, next) {
    if (req.session && req.session.userId) {
        return res.redirect('/');
    }
    next();
}

/**
 * Rate limiting middleware for authentication endpoints
 * Prevents brute force attacks
 */
const authRateLimiter = require('express-rate-limit')({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: 'Too many login attempts, please try again after 15 minutes',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn('Rate limit exceeded for auth endpoint', {
            ip: req.ip,
            path: req.path
        });
        res.status(429).json({
            error: 'Too many attempts',
            message: 'Too many login attempts, please try again after 15 minutes'
        });
    }
});

/**
 * Track failed login attempts and implement account lockout
 */
const failedLoginAttempts = new Map();
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

function checkAccountLockout(identifier) {
    const attempts = failedLoginAttempts.get(identifier);
    
    if (!attempts) return false;
    
    if (attempts.count >= LOCKOUT_THRESHOLD) {
        const lockoutExpiry = attempts.firstAttempt + LOCKOUT_DURATION;
        if (Date.now() < lockoutExpiry) {
            return true; // Account is locked
        } else {
            // Lockout period expired, reset
            failedLoginAttempts.delete(identifier);
            return false;
        }
    }
    
    return false;
}

function recordFailedLogin(identifier) {
    const attempts = failedLoginAttempts.get(identifier);
    
    if (!attempts) {
        failedLoginAttempts.set(identifier, {
            count: 1,
            firstAttempt: Date.now()
        });
    } else {
        // Reset if outside lockout window
        if (Date.now() - attempts.firstAttempt > LOCKOUT_DURATION) {
            failedLoginAttempts.set(identifier, {
                count: 1,
                firstAttempt: Date.now()
            });
        } else {
            attempts.count++;
        }
    }
}

function clearFailedLogins(identifier) {
    failedLoginAttempts.delete(identifier);
}

module.exports = {
    requireAuth,
    redirectIfAuthenticated,
    authRateLimiter,
    checkAccountLockout,
    recordFailedLogin,
    clearFailedLogins
};
