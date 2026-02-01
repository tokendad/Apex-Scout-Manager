/**
 * Passport.js configuration for Apex Scout Manager v2.0
 *
 * Configures authentication strategies:
 * - Local (email/password)
 * - Google OAuth 2.0
 */

const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { comparePassword } = require('./auth');
const logger = require('./logger');

/**
 * Configure Passport with authentication strategies
 * @param {Object} db - Database instance
 */
function configurePassport(db) {
    // Serialize user to session
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    // Deserialize user from session
    passport.deserializeUser((id, done) => {
        try {
            const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
            if (user) {
                done(null, user);
            } else {
                done(new Error('User not found'));
            }
        } catch (error) {
            done(error);
        }
    });

    // Local Strategy (email/password)
    passport.use(new LocalStrategy({
        usernameField: 'email',
        passwordField: 'password'
    }, async (email, password, done) => {
        try {
            // Find user by email
            const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

            if (!user) {
                return done(null, false, { message: 'Invalid email or password' });
            }

            // Check if account is active
            if (!user.isActive) {
                return done(null, false, { message: 'Account is disabled' });
            }

            // Check if user has a password (might be OAuth-only)
            if (!user.password_hash) {
                return done(null, false, { message: 'Please sign in with Google' });
            }

            // Verify password
            const isValid = await comparePassword(password, user.password_hash);

            if (!isValid) {
                return done(null, false, { message: 'Invalid email or password' });
            }

            // Update last login
            db.prepare('UPDATE users SET lastLogin = datetime(\'now\') WHERE id = ?').run(user.id);

            logger.info(`User logged in: ${user.email}`);
            return done(null, user);
        } catch (error) {
            logger.error('Local authentication error:', error);
            return done(error);
        }
    }));

    // Google OAuth Strategy
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const googleCallbackURL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback';

    if (googleClientId && googleClientSecret) {
        passport.use(new GoogleStrategy({
            clientID: googleClientId,
            clientSecret: googleClientSecret,
            callbackURL: googleCallbackURL
        }, async (accessToken, refreshToken, profile, done) => {
            try {
                // Check if user exists with this Google ID
                let user = db.prepare('SELECT * FROM users WHERE googleId = ?').get(profile.id);

                if (user) {
                    // Update last login and photo
                    db.prepare(`
                        UPDATE users
                        SET lastLogin = datetime('now'),
                            photoUrl = ?
                        WHERE id = ?
                    `).run(profile.photos && profile.photos[0] ? profile.photos[0].value : null, user.id);

                    logger.info(`User logged in via Google: ${user.email}`);
                    return done(null, user);
                }

                // Check if user exists with this email
                const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
                if (email) {
                    user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

                    if (user) {
                        // Link Google account to existing user
                        db.prepare(`
                            UPDATE users
                            SET googleId = ?,
                                photoUrl = ?,
                                emailVerified = 1,
                                lastLogin = datetime('now')
                            WHERE id = ?
                        `).run(
                            profile.id,
                            profile.photos && profile.photos[0] ? profile.photos[0].value : null,
                            user.id
                        );

                        logger.info(`Linked Google account to existing user: ${email}`);
                        return done(null, user);
                    }
                }

                // Create new user
                if (!email) {
                    return done(new Error('No email provided by Google'));
                }

                const firstName = profile.name.givenName || 'User';
                const lastName = profile.name.familyName || '';
                const photoUrl = profile.photos && profile.photos[0] ? profile.photos[0].value : null;

                const insertUser = db.prepare(`
                    INSERT INTO users (
                        email,
                        firstName,
                        lastName,
                        googleId,
                        photoUrl,
                        emailVerified,
                        isActive,
                        role,
                        createdAt,
                        lastLogin
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                `);

                const result = insertUser.run(
                    email,
                    firstName,
                    lastName,
                    profile.id,
                    photoUrl,
                    1, // Email verified by Google
                    1, // Active
                    'scout' // Default role
                );

                user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);

                // Create default profile for new user
                db.prepare(`
                    INSERT INTO profile (userId, scoutName, email)
                    VALUES (?, ?, ?)
                `).run(user.id, `${firstName} ${lastName}`.trim(), email);

                logger.info(`New user registered via Google: ${email}`);
                return done(null, user);
            } catch (error) {
                logger.error('Google authentication error:', error);
                return done(error);
            }
        }));

        logger.info('Google OAuth strategy configured');
    } else {
        logger.warn('Google OAuth not configured - missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
    }

    return { google: !!(googleClientId && googleClientSecret) };
}

module.exports = { configurePassport };
