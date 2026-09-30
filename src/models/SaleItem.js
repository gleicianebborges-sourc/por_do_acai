const { db } = require('../config/database');

/**
 * SaleItem Model
 * Represents line items within a sale order
 */
class SaleItem {
  constructor({ id, sale_id, product_id, final_price, quantity = 1, product_name = null, ncm_code = null, image_emoji = null }) {
    this.id = id;
    this.sale_id = sale_id;
    this.product_id = product_id;
    this.final_price = Number(final_price || 0);
    this.calculated_price = this.final_price;
    this.quantity = Number(quantity || 1);
    this.quantity_or_weight = this.quantity;
    this.product_name = product_name;
    this.ncm_code = ncm_code;
    this.image_emoji = image_emoji;
  }

  static findBySaleId(saleId) {
    const rows = db.prepare(`
      SELECT si.*, p.name as product_name, p.ncm_code, p.image_emoji
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = ?
      ORDER BY si.id ASC
    `).all(saleId);

    return rows.map(r => new SaleItem(r));
  }

  static createMany(saleId, items) {
    const insertStmt = db.prepare(`
      INSERT INTO sale_items (sale_id, product_id, final_price, quantity)
      VALUES (?, ?, ?, ?)
    `);

    for (const item of items) {
      insertStmt.run(
        saleId,
        item.product_id,
        item.final_price,
        item.quantity || 1
      );
    }
  }
}

module.exports = SaleItem;
