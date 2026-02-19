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
 * @param {Object} db - Database query helpers
 */
function configurePassport(db) {
    // Serialize user to session
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    // Deserialize user from session
    passport.deserializeUser(async (id, done) => {
        try {
            const user = await db.getOne('SELECT * FROM users WHERE id = $1', [id]);
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
            const user = await db.getOne('SELECT * FROM users WHERE email = $1', [email]);

            if (!user) {
                return done(null, false, { message: 'Invalid email or password' });
            }

            // Check if account is active
            if (!user.isActive) {
                if (user.isMinor && !user.parentConsentDate) {
                    return done(null, false, { message: 'Parental consent required. Please check your parent\'s email.' });
                }
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
            await db.run('UPDATE users SET "lastLogin" = NOW() WHERE id = $1', [user.id]);

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
                let user = await db.getOne('SELECT * FROM users WHERE "googleId" = $1', [profile.id]);

                if (user) {
                    // Update last login and photo
                    await db.run(`
                        UPDATE users
                        SET "lastLogin" = NOW(),
                            "photoUrl" = $1
                        WHERE id = $2
                    `, [profile.photos && profile.photos[0] ? profile.photos[0].value : null, user.id]);

                    logger.info(`User logged in via Google: ${user.email}`);
                    return done(null, user);
                }

                // Check if user exists with this email
                const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
                if (email) {
                    user = await db.getOne('SELECT * FROM users WHERE email = $1', [email]);

                    if (user) {
                        // Link Google account to existing user
                        await db.run(`
                            UPDATE users
                            SET "googleId" = $1,
                                "photoUrl" = $2,
                                "emailVerified" = true,
                                "lastLogin" = NOW()
                            WHERE id = $3
                        `, [
                            profile.id,
                            profile.photos && profile.photos[0] ? profile.photos[0].value : null,
                            user.id
                        ]);

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

                user = await db.getOne(`
                    INSERT INTO users (
                        email,
                        "firstName",
                        "lastName",
                        "googleId",
                        "photoUrl",
                        "emailVerified",
                        "isActive",
                        role
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    RETURNING *
                `, [
                    email,
                    firstName,
                    lastName,
                    profile.id,
                    photoUrl,
                    true, // Email verified by Google
                    true, // Active
                    'scout' // Default role
                ]);

                // Create default profile for new user
                await db.run(`
                    INSERT INTO profile ("userId", "scoutName", email)
                    VALUES ($1, $2, $3)
                `, [user.id, `${firstName} ${lastName}`.trim(), email]);

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
