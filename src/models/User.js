const { db } = require('../config/database');
const bcrypt = require('bcryptjs');

/**
 * User Model
 * Represents authenticated users (operador, gerente) in compliance with LGPD.
 */
class User {
  constructor({
    id,
    name,
    email,
    password_hash,
    role = 'operador',
    is_active = 1,
    lgpd_consent = 1,
    lgpd_consent_timestamp = null,
    created_at = null
  }) {
    this.id = id;
    this.name = name;
    this.email = email;
    this.password_hash = password_hash;
    this.role = role;
    this.is_active = Boolean(is_active);
    this.lgpd_consent = Boolean(lgpd_consent);
    this.lgpd_consent_timestamp = lgpd_consent_timestamp;
    this.created_at = created_at;
  }

  /**
   * Verify plain password against bcrypt hash
   * @param {string} password 
   * @returns {boolean}
   */
  verifyPassword(password) {
    if (!password || !this.password_hash) return false;
    return bcrypt.compareSync(password, this.password_hash);
  }

  /**
   * Return safe representation omitting sensitive password hash
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      role: this.role,
      is_active: this.is_active,
      lgpd_consent: this.lgpd_consent,
      lgpd_consent_timestamp: this.lgpd_consent_timestamp,
      created_at: this.created_at
    };
  }

  static findByEmail(email) {
    if (!email) return null;
    const normalized = email.trim().toLowerCase();
    const row = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(normalized);
    return row ? new User(row) : null;
  }

  static findById(id) {
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    return row ? new User(row) : null;
  }

  static findAll() {
    const rows = db.prepare('SELECT * FROM users ORDER BY name ASC').all();
    return rows.map(r => new User(r));
  }

  static create({ name, email, password, role = 'operador', lgpd_consent = 1 }) {
    const normalizedEmail = email.trim().toLowerCase();
    const salt = bcrypt.genSaltSync(10);
    const password_hash = bcrypt.hashSync(password, salt);

    const stmt = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, is_active, lgpd_consent, lgpd_consent_timestamp)
      VALUES (?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP)
    `);

    const info = stmt.run(name.trim(), normalizedEmail, password_hash, role, lgpd_consent ? 1 : 0);
    return User.findById(info.lastInsertRowid);
  }

  static updatePassword(id, newPassword) {
    const salt = bcrypt.genSaltSync(10);
    const password_hash = bcrypt.hashSync(newPassword, salt);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(password_hash, id);
    return true;
  }
}

module.exports = User;
