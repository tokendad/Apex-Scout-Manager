/**
 * Authentication utilities and middleware for Apex Scout Manager v2.0
 *
 * Provides user authentication, authorization, session management,
 * and privilege-based access control.
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const logger = require('./logger');
const db = require('./database/query-helpers');
const { ROLE_PRIVILEGE_DEFAULTS, getEffectiveScope } = require('./privileges');

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
    const userId = req.session.userId;
    const userRole = req.session.userRole;

    // Admins can access everything
    if (userRole === 'admin') {
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

// ============================================================================
// Privilege Enforcement Middleware
// ============================================================================

/**
 * Middleware factory: require a specific privilege for troop-scoped endpoints.
 * Expects troopId in req.params, req.body, or req.query.
 *
 * Sets on req: effectiveScope, troopId, troopRole, memberDen,
 *              linkedParentId, linkedScoutId
 *
 * @param {string} privilegeCode - The privilege code to check
 * @returns {Function} Express middleware
 */
function requirePrivilege(privilegeCode) {
    return async (req, res, next) => {
        try {
            // 2. Admin bypass
            if (req.session.userRole === 'admin') {
                req.effectiveScope = 'T';
                req.troopRole = 'admin';
                return next();
            }

            // 3. Resolve troopId
            const troopId = req.params.troopId || (req.body && req.body.troopId) || (req.query && req.query.troopId);
            if (!troopId) {
                return res.status(400).json({ error: 'Troop context required' });
            }
            req.troopId = troopId;

            // 4. Load user's troop membership
            const member = await db.getOne(`
                SELECT role, den, "linkedParentId", "linkedScoutId"
                FROM troop_members
                WHERE "troopId" = $1 AND "userId" = $2 AND status = 'active'
            `, [troopId, req.session.userId]);

            if (!member) {
                return res.status(403).json({ error: 'Not a member of this troop' });
            }

            req.troopRole = member.role;
            req.memberDen = member.den;
            req.linkedParentId = member.linkedParentId;
            req.linkedScoutId = member.linkedScoutId;

            // 5. Load privilege overrides for this user+troop
            const overrides = await db.getAll(
                'SELECT "privilegeCode", scope FROM privilege_overrides WHERE "troopId" = $1 AND "userId" = $2',
                [troopId, req.session.userId]
            );

            // 6. Compute effective scope
            const effectiveScope = getEffectiveScope(member.role, overrides, privilegeCode);

            // 7. Block if scope is 'none'
            if (effectiveScope === 'none') {
                return res.status(403).json({ error: 'Insufficient privileges' });
            }

            // 8. D scope with null den falls back to S
            if (effectiveScope === 'D' && !member.den) {
                req.effectiveScope = 'S';
            } else {
                req.effectiveScope = effectiveScope;
            }

            next();
        } catch (error) {
            logger.error('Privilege check failed', { error: error.message, privilegeCode });
            res.status(500).json({ error: 'Authorization check failed' });
        }
    };
}

/**
 * Middleware factory: require privilege for user-targeted endpoints (e.g. /api/scouts/:userId/...).
 * Resolves troopId by finding a shared troop between the requesting user and the target user.
 *
 * @param {string} privilegeCode - The privilege code to check
 * @returns {Function} Express middleware
 */
function requirePrivilegeForUser(privilegeCode) {
    return async (req, res, next) => {
        try {
            const targetUserId = req.params.userId;

            // 2. Admin bypass
            if (req.session.userRole === 'admin') {
                req.effectiveScope = 'T';
                req.troopRole = 'admin';
                return next();
            }

            // 3. If accessing own data, find any troop membership and check privilege
            if (targetUserId === req.session.userId) {
                const membership = await db.getOne(`
                    SELECT "troopId", role, den, "linkedParentId", "linkedScoutId"
                    FROM troop_members
                    WHERE "userId" = $1 AND status = 'active'
                    LIMIT 1
                `, [req.session.userId]);

                if (!membership) {
                    return res.status(403).json({ error: 'No active troop membership' });
                }

                req.troopId = membership.troopId;
                req.troopRole = membership.role;
                req.memberDen = membership.den;
                req.linkedParentId = membership.linkedParentId;
                req.linkedScoutId = membership.linkedScoutId;

                const overrides = await db.getAll(
                    'SELECT "privilegeCode", scope FROM privilege_overrides WHERE "troopId" = $1 AND "userId" = $2',
                    [membership.troopId, req.session.userId]
                );

                const effectiveScope = getEffectiveScope(membership.role, overrides, privilegeCode);
                if (effectiveScope === 'none') {
                    return res.status(403).json({ error: 'Insufficient privileges' });
                }

                req.effectiveScope = (effectiveScope === 'D' && !membership.den) ? 'S' : effectiveScope;
                return next();
            }

            // 4. Accessing another user's data - find a shared troop
            const sharedTroop = await db.getOne(`
                SELECT tm1."troopId", tm1.role, tm1.den, tm1."linkedParentId", tm1."linkedScoutId"
                FROM troop_members tm1
                JOIN troop_members tm2 ON tm2."troopId" = tm1."troopId"
                WHERE tm1."userId" = $1 AND tm2."userId" = $2
                  AND tm1.status = 'active' AND tm2.status = 'active'
                LIMIT 1
            `, [req.session.userId, targetUserId]);

            if (!sharedTroop) {
                return res.status(403).json({ error: 'No shared troop membership with target user' });
            }

            req.troopId = sharedTroop.troopId;
            req.troopRole = sharedTroop.role;
            req.memberDen = sharedTroop.den;
            req.linkedParentId = sharedTroop.linkedParentId;
            req.linkedScoutId = sharedTroop.linkedScoutId;

            const overrides = await db.getAll(
                'SELECT "privilegeCode", scope FROM privilege_overrides WHERE "troopId" = $1 AND "userId" = $2',
                [sharedTroop.troopId, req.session.userId]
            );

            const effectiveScope = getEffectiveScope(sharedTroop.role, overrides, privilegeCode);
            if (effectiveScope === 'none') {
                return res.status(403).json({ error: 'Insufficient privileges' });
            }

            req.effectiveScope = (effectiveScope === 'D' && !sharedTroop.den) ? 'S' : effectiveScope;

            // 5. Verify target user is within scope
            const inScope = await isTargetInScope(req, targetUserId);
            if (!inScope) {
                return res.status(403).json({ error: 'Target user is outside your access scope' });
            }

            next();
        } catch (error) {
            logger.error('Privilege check failed for user endpoint', { error: error.message, privilegeCode });
            res.status(500).json({ error: 'Authorization check failed' });
        }
    };
}

/**
 * Middleware factory: require privilege in any active troop membership.
 * For self-only endpoints without troopId (e.g. GET /api/sales).
 *
 * @param {string} privilegeCode - The privilege code to check
 * @returns {Function} Express middleware
 */
function requirePrivilegeAnyTroop(privilegeCode) {
    return async (req, res, next) => {
        try {
            // 2. Admin bypass
            if (req.session.userRole === 'admin') {
                req.effectiveScope = 'T';
                return next();
            }

            // 3. Check all active troop memberships
            const memberships = await db.getAll(
                'SELECT "troopId", role FROM troop_members WHERE "userId" = $1 AND status = \'active\'',
                [req.session.userId]
            );

            for (const m of memberships) {
                const overrides = await db.getAll(
                    'SELECT "privilegeCode", scope FROM privilege_overrides WHERE "troopId" = $1 AND "userId" = $2',
                    [m.troopId, req.session.userId]
                );

                const effectiveScope = getEffectiveScope(m.role, overrides, privilegeCode);
                if (effectiveScope !== 'none') {
                    req.effectiveScope = effectiveScope;
                    req.troopId = m.troopId;
                    req.troopRole = m.role;
                    return next();
                }
            }

            // No troop grants this privilege
            return res.status(403).json({ error: 'Insufficient privileges' });
        } catch (error) {
            logger.error('Privilege check failed (any troop)', { error: error.message, privilegeCode });
            res.status(500).json({ error: 'Authorization check failed' });
        }
    };
}

// ============================================================================
// Scope Filtering Helpers
// ============================================================================

/**
 * Get all user IDs in the same household within a troop.
 * Uses linkedParentId bidirectional links in troop_members.
 *
 * @param {string} troopId - Troop ID
 * @param {string} userId - Current user ID
 * @returns {Promise<string[]>} Array of user IDs in the household
 */
async function getHouseholdUserIds(troopId, userId) {
    const results = await db.getAll(`
        SELECT DISTINCT tm2."userId"
        FROM troop_members tm1
        JOIN troop_members tm2 ON tm2."troopId" = tm1."troopId"
        WHERE tm1."troopId" = $1
          AND tm1."userId" = $2
          AND tm1.status = 'active'
          AND tm2.status = 'active'
          AND (
              tm2."userId" = $2
              OR tm2."linkedParentId" = $2
              OR tm2."userId" = tm1."linkedParentId"
              OR tm2."userId" = tm1."linkedScoutId"
              OR tm2."linkedScoutId" = $2
          )
    `, [troopId, userId]);
    return results.map(r => r.userId);
}

/**
 * Check if a target user falls within the requesting user's effective scope.
 *
 * @param {Object} req - Express request with effectiveScope, troopId, session.userId, memberDen
 * @param {string} targetUserId - The user ID being accessed
 * @returns {Promise<boolean>} True if target is in scope
 */
async function isTargetInScope(req, targetUserId) {
    switch (req.effectiveScope) {
        case 'T':
            return true;
        case 'S':
            return targetUserId === req.session.userId;
        case 'H': {
            const householdIds = await getHouseholdUserIds(req.troopId, req.session.userId);
            return householdIds.includes(targetUserId);
        }
        case 'D': {
            const target = await db.getOne(
                'SELECT den FROM troop_members WHERE "troopId" = $1 AND "userId" = $2 AND status = \'active\'',
                [req.troopId, targetUserId]
            );
            return target && target.den && target.den === req.memberDen;
        }
        default:
            return false;
    }
}

/**
 * Build a SQL WHERE clause fragment for scope-based data filtering.
 * Returns { clause: string, params: array } where clause starts with " AND ...".
 *
 * @param {string} scope - T/D/H/S
 * @param {string} userIdColumn - SQL column reference for the user ID (e.g. 'u.id', 's."userId"')
 * @param {Object} req - Express request with troopId, session.userId, memberDen
 * @param {number} paramOffset - Number of existing query params (for $N numbering)
 * @returns {Promise<{clause: string, params: Array}>}
 */
async function buildScopeFilter(scope, userIdColumn, req, paramOffset = 0) {
    switch (scope) {
        case 'T':
            return { clause: '', params: [] };
        case 'S':
            return {
                clause: ` AND ${userIdColumn} = $${paramOffset + 1}`,
                params: [req.session.userId]
            };
        case 'H': {
            const householdIds = await getHouseholdUserIds(req.troopId, req.session.userId);
            return {
                clause: ` AND ${userIdColumn} = ANY($${paramOffset + 1}::uuid[])`,
                params: [householdIds]
            };
        }
        case 'D': {
            return {
                clause: ` AND ${userIdColumn} IN (
                    SELECT "userId" FROM troop_members
                    WHERE "troopId" = $${paramOffset + 1} AND den = $${paramOffset + 2} AND status = 'active'
                )`,
                params: [req.troopId, req.memberDen]
            };
        }
        default:
            // Should never reach here (middleware blocks 'none')
            return { clause: ' AND 1 = 0', params: [] };
    }
}

/**
 * Log authentication event to audit log
 * @param {Object} dbInstance - Database query helpers
 * @param {string} userId - User ID (UUID)
 * @param {string} action - Action performed
 * @param {Object} req - Express request object
 * @param {Object} details - Additional details
 */
async function logAuditEvent(dbInstance, userId, action, req, details = {}) {
    try {
        await dbInstance.run(`
            INSERT INTO audit_log ("userId", action, "resourceType", "resourceId", "ipAddress", "userAgent", details)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
            userId,
            action,
            details.resourceType || 'auth',
            details.resourceId || null,
            req.ip || req.connection.remoteAddress,
            req.get('user-agent'),
            JSON.stringify(details)
        ]);
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
 * @param {Object} dbInstance - Database query helpers
 * @param {string} userId - User ID (UUID)
 * @param {string} type - Notification type
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} actionUrl - Optional action URL
 */
async function createNotification(dbInstance, userId, type, title, message, actionUrl = null) {
    try {
        await dbInstance.run(`
            INSERT INTO notifications ("userId", type, title, message, "actionUrl")
            VALUES ($1, $2, $3, $4, $5)
        `, [userId, type, title, message, actionUrl]);
    } catch (error) {
        logger.error('Failed to create notification:', error);
    }
}

/**
 * Clean up expired sessions
 * @param {Object} dbInstance - Database query helpers
 * @returns {Promise<void>}
 */
async function cleanupExpiredSessions(dbInstance) {
    try {
        const rowCount = await dbInstance.run(`
            DELETE FROM sessions
            WHERE "expiresAt" < NOW()
        `);

        if (rowCount > 0) {
            logger.info(`Cleaned up ${rowCount} expired sessions`);
        }
    } catch (error) {
        logger.error('Failed to cleanup expired sessions:', error);
    }
}

/**
 * Middleware to require system admin access
 * Checks if user has an active admin record in the admins table
 */
function requireAdmin(req, res, next) {
    return (async () => {
        try {
            // 1. Check authentication
            if (!req.session || !req.session.userId) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            // 2. Check if user has admin status
            const adminRecord = await db.getOne(
                'SELECT * FROM admins WHERE "userId" = $1 AND "revokedAt" IS NULL',
                [req.session.userId]
            );

            if (!adminRecord) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            // 3. Store admin role in request for logging/auditing
            req.adminRole = adminRecord.role;
            req.adminId = adminRecord.id;

            next();
        } catch (error) {
            logger.error('Admin access check failed', { error: error.message, userId: req.session.userId });
            res.status(500).json({ error: 'Authorization check failed' });
        }
    })();
}

/**
 * Role permission levels for comparison
 */
const ROLE_LEVELS = {
    'scout': 1,
    'parent': 1,
    'troop_leader': 2
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

/**
 * Check if user is an active system admin
 * @param {Object} dbInstance - Database query helpers
 * @param {string} userId - User ID to check
 * @returns {Promise<boolean>} True if active admin
 */
async function isAdmin(dbInstance, userId) {
    try {
        const adminRecord = await dbInstance.getOne(
            'SELECT 1 FROM admins WHERE "userId" = $1 AND "revokedAt" IS NULL',
            [userId]
        );
        return !!adminRecord;
    } catch (error) {
        logger.error('isAdmin check failed', { error: error.message, userId });
        return false;
    }
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
    ROLE_LEVELS,
    // Privilege enforcement
    requirePrivilege,
    requirePrivilegeForUser,
    requirePrivilegeAnyTroop,
    getHouseholdUserIds,
    isTargetInScope,
    buildScopeFilter,
    // Admin access
    requireAdmin,
    isAdmin
};
