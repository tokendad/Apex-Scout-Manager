const crypto = require('crypto');
const logger = require('./logger');

// COPPA Compliance: Encryption at rest for sensitive data
// This module provides field-level encryption for sensitive user information
// such as phone numbers, addresses, and email addresses

// Encryption key should be stored in environment variable
// For development, generate a key with: crypto.randomBytes(32).toString('hex')
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Log warning if using default key (development mode)
if (!process.env.ENCRYPTION_KEY) {
    logger.warn('Using auto-generated encryption key. Set ENCRYPTION_KEY environment variable for production.');
}

/**
 * Encrypts sensitive data using AES-256-GCM
 * @param {string} text - Plain text to encrypt
 * @returns {string} Encrypted text in format: iv:authTag:encrypted
 */
function encrypt(text) {
    if (!text) return null;
    
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
        
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag();
        
        // Return format: iv:authTag:encrypted
        return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
        logger.error('Encryption failed', { error: error.message });
        throw new Error('Failed to encrypt data');
    }
}

/**
 * Decrypts data encrypted with the encrypt function
 * @param {string} encrypted - Encrypted text in format: iv:authTag:encrypted
 * @returns {string} Decrypted plain text
 */
function decrypt(encrypted) {
    if (!encrypted) return null;
    
    try {
        const parts = encrypted.split(':');
        if (parts.length !== 3) {
            throw new Error('Invalid encrypted data format');
        }
        
        const iv = Buffer.from(parts[0], 'hex');
        const authTag = Buffer.from(parts[1], 'hex');
        const encryptedText = parts[2];
        
        const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        logger.error('Decryption failed', { error: error.message });
        throw new Error('Failed to decrypt data');
    }
}

/**
 * Hash password using bcrypt (12 rounds minimum per COPPA requirements)
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
async function hashPassword(password) {
    const bcrypt = require('bcrypt');
    const SALT_ROUNDS = 12; // Minimum 12 rounds per COPPA compliance requirements
    return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare password with hashed password
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} True if password matches
 */
async function comparePassword(password, hash) {
    const bcrypt = require('bcrypt');
    return await bcrypt.compare(password, hash);
}

module.exports = {
    encrypt,
    decrypt,
    hashPassword,
    comparePassword
};
