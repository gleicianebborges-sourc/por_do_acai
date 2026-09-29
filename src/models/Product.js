const { db } = require('../config/database');

/**
 * Product Model
 * Represents catalog items:
 * - is_variable_price: 1 (requires manual price entry from numpad, e.g. Açaí)
 * - is_variable_price: 0 (fixed price, e.g. water, canned drinks, toppings)
 */
class Product {
  constructor({ id, name, is_variable_price, default_price = 0.0, ncm_code = '0811.90.00', category = 'geral', image_emoji = '🍧', active = 1, created_at = null }) {
    this.id = id;
    this.name = name;
    this.is_variable_price = Boolean(is_variable_price);
    this.default_price = Number(default_price);
    this.ncm_code = ncm_code;
    this.category = category;
    this.image_emoji = image_emoji;
    this.active = active;
    this.created_at = created_at;
  }

  static findAll() {
    const rows = db.prepare('SELECT * FROM products WHERE active = 1 ORDER BY is_variable_price DESC, name ASC').all();
    return rows.map(r => new Product(r));
  }

  static findById(id) {
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    return row ? new Product(row) : null;
  }

  static findByNameLike(query) {
    const term = `%${query.trim().toLowerCase()}%`;
    const rows = db.prepare('SELECT * FROM products WHERE LOWER(name) LIKE ? AND active = 1').all(term);
    return rows.map(r => new Product(r));
  }

  static create({ name, is_variable_price = 0, default_price = 0.0, ncm_code = '0811.90.00', category = 'geral', image_emoji = '🍧' }) {
    const stmt = db.prepare(`
      INSERT INTO products (name, is_variable_price, default_price, ncm_code, category, image_emoji)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(name, is_variable_price ? 1 : 0, default_price, ncm_code, category, image_emoji);
    return Product.findById(info.lastInsertRowid);
  }
}

module.exports = Product;
