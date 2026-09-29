const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const dbDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'acai_pos.sqlite');
const db = new DatabaseSync(dbPath);

// Enable foreign keys
db.exec('PRAGMA foreign_keys = ON;');

function initializeDatabase() {
  // Re-create or migrate tables to match the Agentic POS schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      is_variable_price INTEGER NOT NULL DEFAULT 0,
      default_price REAL NOT NULL DEFAULT 0.0,
      ncm_code TEXT NOT NULL DEFAULT '0811.90.00',
      category TEXT DEFAULT 'geral',
      image_emoji TEXT DEFAULT '🍧',
      active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_amount REAL NOT NULL,
      payment_method TEXT NOT NULL CHECK(payment_method IN ('PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH')),
      amount_received REAL DEFAULT 0.0,
      change_due REAL DEFAULT 0.0,
      customer_phone TEXT,
      status TEXT NOT NULL CHECK(status IN ('COMPLETED', 'CANCELLED', 'PENDING')) DEFAULT 'COMPLETED'
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      final_price REAL NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products (id)
    );

    CREATE TABLE IF NOT EXISTS agent_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER,
      skill_name TEXT NOT NULL,
      payload TEXT,
      status TEXT NOT NULL CHECK(status IN ('pending', 'success', 'failed')) DEFAULT 'pending',
      execution_time REAL DEFAULT 0.0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE SET NULL
    );
  `);

  // Check if products have the new columns or need re-seeding
  const tableInfo = db.prepare("PRAGMA table_info(products)").all();
  const hasIsVariablePrice = tableInfo.some(col => col.name === 'is_variable_price');

  if (!hasIsVariablePrice) {
    db.exec(`
      DROP TABLE IF EXISTS sale_items;
      DROP TABLE IF EXISTS sales;
      DROP TABLE IF EXISTS products;
      DROP TABLE IF EXISTS agent_logs;
    `);
    // Recreate
    return initializeDatabase();
  }

  // Seed default products if empty
  const count = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
  if (count === 0) {
    const insertProduct = db.prepare(`
      INSERT INTO products (name, is_variable_price, default_price, ncm_code, category, image_emoji)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const seedItems = [
      // Variable Price Items (Numpad input / Açaí montado)
      { name: 'Açaí Tradicional (Manual / Quilo)', is_var: 1, price: 0.0, ncm: '0811.90.00', cat: 'acai', emoji: '🍇' },
      { name: 'Açaí Trufado Especial (Manual)', is_var: 1, price: 0.0, ncm: '0811.90.00', cat: 'acai', emoji: '🍫' },
      { name: 'Creme de Cupuaçu Puro (Manual)', is_var: 1, price: 0.0, ncm: '0811.90.00', cat: 'acai', emoji: '🥥' },
      { name: 'Sorvete Artesanal Buffet (Manual)', is_var: 1, price: 0.0, ncm: '2105.00.10', cat: 'acai', emoji: '🍨' },

      // Fixed Price Quick-Add Items
      { name: 'Água Mineral sem Gás 500ml', is_var: 0, price: 4.50, ncm: '2201.10.00', cat: 'bebidas', emoji: '💧' },
      { name: 'Água Mineral com Gás 500ml', is_var: 0, price: 5.00, ncm: '2201.10.00', cat: 'bebidas', emoji: '🫧' },
      { name: 'Coca-Cola Lata 350ml', is_var: 0, price: 6.50, ncm: '2202.10.00', cat: 'bebidas', emoji: '🥤' },
      { name: 'Guaraná Antarctica 350ml', is_var: 0, price: 6.00, ncm: '2202.10.00', cat: 'bebidas', emoji: '🥤' },
      { name: 'Suco Natural Laranja 300ml', is_var: 0, price: 8.50, ncm: '2009.12.00', cat: 'bebidas', emoji: '🍊' },
      { name: 'Red Bull Energy 250ml', is_var: 0, price: 12.00, ncm: '2202.99.00', cat: 'bebidas', emoji: '⚡' },
      { name: 'Nutella Pura Dose Extra', is_var: 0, price: 7.00, ncm: '1806.90.00', cat: 'toppings', emoji: '🌰' },
      { name: 'Casquinha Waffle Crocante', is_var: 0, price: 3.50, ncm: '1905.32.00', cat: 'toppings', emoji: '🧇' },
      { name: 'Paçoca Rolha Dose', is_var: 0, price: 2.00, ncm: '2008.11.00', cat: 'toppings', emoji: '🥜' }
    ];

    for (const item of seedItems) {
      insertProduct.run(item.name, item.is_var, item.price, item.ncm, item.cat, item.emoji);
    }
  }
}

module.exports = {
  db,
  initializeDatabase
};
