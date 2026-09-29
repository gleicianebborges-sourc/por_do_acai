const { db } = require('../config/database');

/**
 * AuditLog Model
 * Compliant with Art. 37 LGPD (Lei Geral de Proteção de Dados - Lei 13.709/2018):
 * Registers data processing events, authentication attempts, security operations and access lifecycle.
 */
class AuditLog {
  constructor({ id, user_email, action, ip_address = null, timestamp = null }) {
    this.id = id;
    this.user_email = user_email;
    this.action = action;
    this.ip_address = ip_address;
    this.timestamp = timestamp;
  }

  /**
   * Record a security / access event into the audit trail
   * @param {Object} param0 
   * @param {string} param0.user_email
   * @param {string} param0.action (e.g. LOGIN_SUCCESS, LOGIN_FAILED, RESET_REQUESTED, PASSWORD_RESET_SUCCESS, LOGOUT)
   * @param {string} [param0.ip_address]
   * @returns {AuditLog}
   */
  static record({ user_email, action, ip_address = '127.0.0.1' }) {
    const cleanEmail = (user_email || 'anonymous').trim().toLowerCase();
    const stmt = db.prepare(`
      INSERT INTO audit_logs (user_email, action, ip_address, timestamp)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `);

    const info = stmt.run(cleanEmail, action, ip_address);
    return new AuditLog({
      id: info.lastInsertRowid,
      user_email: cleanEmail,
      action,
      ip_address,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Retrieve recent audit events
   * @param {number} limit 
   * @returns {Array<AuditLog>}
   */
  static findRecent(limit = 100) {
    const rows = db.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?').all(limit);
    return rows.map(r => new AuditLog(r));
  }

  /**
   * Retrieve audit logs by user email
   * @param {string} email 
   * @returns {Array<AuditLog>}
   */
  static findByEmail(email) {
    const rows = db.prepare('SELECT * FROM audit_logs WHERE user_email = ? ORDER BY timestamp DESC').all(email.trim().toLowerCase());
    return rows.map(r => new AuditLog(r));
  }
}

module.exports = AuditLog;
