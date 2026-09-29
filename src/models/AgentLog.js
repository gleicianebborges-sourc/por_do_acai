const { db } = require('../config/database');

/**
 * AgentLog Model
 * Records execution lifecycle, payloads, metrics, and outcomes of Agentic Skills
 */
class AgentLog {
  constructor({ id, sale_id = null, skill_name, payload, status = 'pending', execution_time = 0.0, created_at = null }) {
    this.id = id;
    this.sale_id = sale_id;
    this.skill_name = skill_name;
    this.payload = typeof payload === 'string' ? payload : JSON.stringify(payload);
    this.status = status; // 'pending' | 'success' | 'failed'
    this.execution_time = Number(execution_time);
    this.created_at = created_at;
  }

  static create({ sale_id = null, skill_name, payload = {}, status = 'pending', execution_time = 0.0 }) {
    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const stmt = db.prepare(`
      INSERT INTO agent_logs (sale_id, skill_name, payload, status, execution_time)
      VALUES (?, ?, ?, ?, ?)
    `);
    const info = stmt.run(sale_id, skill_name, payloadStr, status, execution_time);
    return AgentLog.findById(info.lastInsertRowid);
  }

  static update(id, { status, payload, execution_time }) {
    const fields = [];
    const values = [];

    if (status !== undefined) {
      fields.push('status = ?');
      values.push(status);
    }
    if (payload !== undefined) {
      fields.push('payload = ?');
      values.push(typeof payload === 'string' ? payload : JSON.stringify(payload));
    }
    if (execution_time !== undefined) {
      fields.push('execution_time = ?');
      values.push(execution_time);
    }

    if (fields.length === 0) return AgentLog.findById(id);

    values.push(id);
    const sql = `UPDATE agent_logs SET ${fields.join(', ')} WHERE id = ?`;
    db.prepare(sql).run(...values);
    return AgentLog.findById(id);
  }

  static findById(id) {
    const row = db.prepare('SELECT * FROM agent_logs WHERE id = ?').get(id);
    return row ? new AgentLog(row) : null;
  }

  static findBySaleId(saleId) {
    const rows = db.prepare('SELECT * FROM agent_logs WHERE sale_id = ? ORDER BY id ASC').all(saleId);
    return rows.map(r => new AgentLog(r));
  }

  static findRecent(limit = 20) {
    const rows = db.prepare('SELECT * FROM agent_logs ORDER BY id DESC LIMIT ?').all(limit);
    return rows.map(r => new AgentLog(r));
  }
}

module.exports = AgentLog;
