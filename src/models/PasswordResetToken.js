const { db } = require('../config/database');
const crypto = require('node:crypto');

/**
 * PasswordResetToken Model
 * Manages temporary single-use security tokens with 15-minute TTL.
 */
class PasswordResetToken {
  constructor({ id, user_id, token, expires_at, is_used = 0, created_at = null }) {
    this.id = id;
    this.user_id = user_id;
    this.token = token;
    this.expires_at = expires_at;
    this.is_used = Boolean(is_used);
    this.created_at = created_at;
  }

  /**
   * Check if token is expired
   */
  isExpired() {
    const expires = new Date(this.expires_at);
    return Date.now() > expires.getTime();
  }

  /**
   * Generate a crypto-secure single-use token for a user (15 min TTL)
   * @param {number} userId 
   * @param {number} ttlMinutes 
   * @returns {PasswordResetToken}
   */
  static create(userId, ttlMinutes = 15) {
    // Invalidate prior unused tokens for this user
    db.prepare('UPDATE password_reset_tokens SET is_used = 1 WHERE user_id = ? AND is_used = 0').run(userId);

    // Generate 64-character crypto-random string
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

    const stmt = db.prepare(`
      INSERT INTO password_reset_tokens (user_id, token, expires_at, is_used)
      VALUES (?, ?, ?, 0)
    `);

    const info = stmt.run(userId, token, expiresAt);
    return new PasswordResetToken({
      id: info.lastInsertRowid,
      user_id: userId,
      token,
      expires_at: expiresAt,
      is_used: 0
    });
  }

  /**
   * Find an unused, non-expired token
   * @param {string} tokenString 
   * @returns {PasswordResetToken|null}
   */
  static findValidToken(tokenString) {
    if (!tokenString) return null;
    const row = db.prepare('SELECT * FROM password_reset_tokens WHERE token = ? AND is_used = 0').get(tokenString);
    if (!row) return null;

    const tokenObj = new PasswordResetToken(row);
    if (tokenObj.isExpired()) {
      return null;
    }
    return tokenObj;
  }

  /**
   * Mark token as consumed
   * @param {number} id 
   */
  static markAsUsed(id) {
    db.prepare('UPDATE password_reset_tokens SET is_used = 1 WHERE id = ?').run(id);
    return true;
  }
}

module.exports = PasswordResetToken;
