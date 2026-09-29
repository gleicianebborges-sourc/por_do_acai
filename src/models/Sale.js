const { db } = require('../config/database');
const SaleItem = require('./SaleItem');

/**
 * Sale Model
 * Represents a completed POS transaction
 */
class Sale {
  constructor({ id, timestamp, total_amount, payment_method, amount_received = 0.0, change_due = 0.0, customer_phone = null, status = 'COMPLETED', items = [] }) {
    this.id = id;
    this.timestamp = timestamp;
    this.total_amount = Number(total_amount);
    this.payment_method = payment_method;
    this.amount_received = Number(amount_received);
    this.change_due = Number(change_due);
    this.customer_phone = customer_phone;
    this.status = status;
    this.items = items;
  }

  static findById(id) {
    const row = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
    if (!row) return null;

    const items = SaleItem.findBySaleId(id);
    return new Sale({ ...row, items });
  }

  static findAll(limit = 50) {
    const rows = db.prepare('SELECT * FROM sales ORDER BY id DESC LIMIT ?').all(limit);
    return rows.map(r => new Sale({ ...r, items: SaleItem.findBySaleId(r.id) }));
  }

  static create({ total_amount, payment_method, amount_received = 0.0, change_due = 0.0, customer_phone = null, items = [] }) {
    db.exec('BEGIN TRANSACTION;');
    try {
      const stmt = db.prepare(`
        INSERT INTO sales (total_amount, payment_method, amount_received, change_due, customer_phone, status)
        VALUES (?, ?, ?, ?, ?, 'COMPLETED')
      `);
      const info = stmt.run(total_amount, payment_method, amount_received, change_due, customer_phone || null);
      const saleId = Number(info.lastInsertRowid);

      SaleItem.createMany(saleId, items);

      db.exec('COMMIT;');
      return Sale.findById(saleId);
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  }
}

module.exports = Sale;
