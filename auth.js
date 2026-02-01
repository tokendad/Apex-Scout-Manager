/**
 * Authentication utilities and middleware for Apex Scout Manager v2.0
 *
 * Provides user authentication, authorization, and session management.
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const logger = require('./logger');

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} - Hashed password
 */
async function hashPassword(password) {
    const salt = await bcrypt.genSalt(12);
    return bcrypt.hash(password, salt);
}

/**
 * Compare a plain text password with a hashed password
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} - True if passwords match
 */
async function comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
}

/**
 * Generate a secure random session token
 * @returns {string} - Random token
 */
function generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Check if the current user is a superuser (hardcoded override)
 * @param {Object} req - Express request object
 * @returns {boolean} - True if superuser
 */
function isSuperUser(req) {
    const superUserEmail = 'welefort@gmail.com';
    return (req.session && req.session.userEmail === superUserEmail) || 
           (req.user && req.user.email === superUserEmail);
}

/**
 * Middleware to check if user is authenticated
 */
function isAuthenticated(req, res, next) {
    if (req.session && req.session.userId) {
        return next();
    }
    // Check if we have a user from passport but maybe session hasn't been fully populated
    if (req.user && req.user.id) {
        req.session.userId = req.user.id;
        req.session.userEmail = req.user.email;
        req.session.userRole = req.user.role;
        return next();
    }
    return res.status(401).json({ error: 'Authentication required' });
}

/**
 * Middleware to check if user has specific role
 * @param {...string} roles - Allowed roles
 */
function hasRole(...roles) {
    return (req, res, next) => {
        if (!req.session || !req.session.userId) {
            // Re-check req.user as fallback
            if (req.user && req.user.id) {
                req.session.userId = req.user.id;
                req.session.userEmail = req.user.email;
                req.session.userRole = req.user.role;
            } else {
                return res.status(401).json({ error: 'Authentication required' });
            }
        }

        // Superuser bypass
        if (isSuperUser(req)) {
            return next();
        }

        if (!req.session.userRole) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (roles.includes(req.session.userRole)) {
            return next();
        }

        return res.status(403).json({ error: 'Insufficient permissions' });
    };
}

/**
 * Middleware to check if user can access specific resource
 * For scouts: can only access their own data
 * For troop leaders: can access data from their troop
 * For admins: can access all data
 */
function canAccessResource(req, res, next) {
    // Superuser bypass
    if (isSuperUser(req)) {
        return next();
    }

    const userId = req.session.userId;
    const userRole = req.session.userRole;

    // Admins can access everything
    if (userRole === 'council_admin') {
        return next();
    }

    // For other roles, check resource ownership
    const resourceUserId = req.params.userId || req.body.userId || req.query.userId;

    if (resourceUserId && parseInt(resourceUserId) !== userId) {
        // Troop leaders can access their troop members' data (checked in route handler)
        if (userRole === 'troop_leader') {
            req.needsTroopCheck = true;
            return next();
        }

        return res.status(403).json({ error: 'Access denied to this resource' });
    }

    next();
}

/**
 * Log authentication event to audit log
 * @param {Object} db - Database instance
 * @param {number} userId - User ID
 * @param {string} action - Action performed
 * @param {Object} req - Express request object
 * @param {Object} details - Additional details
 */
function logAuditEvent(db, userId, action, req, details = {}) {
    try {
        const stmt = db.prepare(`
            INSERT INTO audit_log (userId, action, resourceType, resourceId, ipAddress, userAgent, details)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            userId,
            action,
            details.resourceType || 'auth',
            details.resourceId || null,
            req.ip || req.connection.remoteAddress,
            req.get('user-agent'),
            JSON.stringify(details)
        );
    } catch (error) {
        logger.error('Failed to log audit event:', error);
    }
}

/**
 * Calculate age from date of birth
 * @param {string} dateOfBirth - Date of birth (YYYY-MM-DD)
 * @returns {number} - Age in years
 */
function calculateAge(dateOfBirth) {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    return age;
}

/**
 * Check if user is a minor (under 13 for COPPA)
 * @param {string} dateOfBirth - Date of birth (YYYY-MM-DD)
 * @returns {boolean} - True if minor
 */
function isMinor(dateOfBirth) {
    return calculateAge(dateOfBirth) < 13;
}

/**
 * Validate email format
 * @param {string} email - Email address
 * @returns {boolean} - True if valid
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate password strength
 * @param {string} password - Password
 * @returns {Object} - {valid: boolean, message: string}
 */
function validatePassword(password) {
    if (password.length < 8) {
        return { valid: false, message: 'Password must be at least 8 characters' };
    }

    if (!/[a-z]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one lowercase letter' };
    }

    if (!/[A-Z]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one uppercase letter' };
    }

    if (!/[0-9]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one number' };
    }

    return { valid: true, message: 'Password is strong' };
}

/**
 * Create notification for user
 * @param {Object} db - Database instance
 * @param {number} userId - User ID
 * @param {string} type - Notification type
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} actionUrl - Optional action URL
 */
function createNotification(db, userId, type, title, message, actionUrl = null) {
    try {
        const stmt = db.prepare(`
            INSERT INTO notifications (userId, type, title, message, actionUrl)
            VALUES (?, ?, ?, ?, ?)
        `);

        stmt.run(userId, type, title, message, actionUrl);
    } catch (error) {
        logger.error('Failed to create notification:', error);
    }
}

/**
 * Clean up expired sessions
 * @param {Object} db - Database instance
 */
function cleanupExpiredSessions(db) {
    try {
        const stmt = db.prepare(`
            DELETE FROM sessions
            WHERE datetime(expiresAt) < datetime('now')
        `);

        const result = stmt.run();
        if (result.changes > 0) {
            logger.info(`Cleaned up ${result.changes} expired sessions`);
        }
    } catch (error) {
        logger.error('Failed to cleanup expired sessions:', error);
    }
}

/**
 * Role permission levels for comparison
 */
const ROLE_LEVELS = {
    'scout': 1,
    'parent': 1,
    'troop_leader': 2,
    'council_admin': 3
};

/**
 * Check if role has sufficient permission level
 * @param {string} userRole - User's role
 * @param {string} requiredRole - Required role
 * @returns {boolean} - True if user has sufficient permissions
 */
function hasPermissionLevel(userRole, requiredRole) {
    return ROLE_LEVELS[userRole] >= ROLE_LEVELS[requiredRole];
}

module.exports = {
    hashPassword,
    comparePassword,
    generateSessionToken,
    isAuthenticated,
    hasRole,
    canAccessResource,
    logAuditEvent,
    calculateAge,
    isMinor,
    isValidEmail,
    validatePassword,
    createNotification,
    cleanupExpiredSessions,
    hasPermissionLevel,
    ROLE_LEVELS
};
