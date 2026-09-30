const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const bcrypt = require('bcryptjs');

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

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('operador', 'gerente')) DEFAULT 'operador',
      is_active INTEGER NOT NULL DEFAULT 1,
      lgpd_consent INTEGER NOT NULL DEFAULT 1,
      lgpd_consent_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      is_used INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email TEXT NOT NULL,
      action TEXT NOT NULL,
      ip_address TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
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

  // Sync requested catalog products (Base Açaí, Bebidas Rápidas, Adicionais Premium)
  const expectedItems = [
    // Variable Price Items (1. Escolha a Base do Açaí)
    { name: 'Açaí Tradicional (Manual / Quilo)', is_var: 1, price: 0.0, ncm: '0811.90.00', cat: 'acai', emoji: '🍇' },
    { name: 'Açaí Trufado Especial (Manual)', is_var: 1, price: 0.0, ncm: '0811.90.00', cat: 'acai', emoji: '🍫' },
    { name: 'Creme de Cupuaçu Puro (Manual)', is_var: 1, price: 0.0, ncm: '0811.90.00', cat: 'acai', emoji: '🥥' },
    { name: 'Sorvete Artesanal Buffet (Manual)', is_var: 1, price: 0.0, ncm: '2105.00.10', cat: 'acai', emoji: '🍨' },

    // a) Bebidas Rápidas (Fixed Price / 1-Click to Cart)
    { name: 'Água Mineral sem Gás', is_var: 0, price: 4.00, ncm: '2201.10.00', cat: 'bebidas', emoji: '💧' },
    { name: 'Água Mineral com Gás', is_var: 0, price: 5.00, ncm: '2201.10.00', cat: 'bebidas', emoji: '🫧' },
    { name: 'Coca-Cola Lata 350ml', is_var: 0, price: 6.00, ncm: '2202.10.00', cat: 'bebidas', emoji: '🥤' },
    { name: 'Guaraná Antarctica Lata', is_var: 0, price: 6.00, ncm: '2202.10.00', cat: 'bebidas', emoji: '🥤' },
    { name: 'Red Bull Energy 250ml', is_var: 0, price: 14.00, ncm: '2202.99.00', cat: 'bebidas', emoji: '⚡' },
    { name: 'Suco em Lata 350ml', is_var: 0, price: 7.00, ncm: '2009.12.00', cat: 'bebidas', emoji: '🍊' },

    // b) Adicionais Premium & Balcão (Fixed Price / 1-Click to Cart)
    { name: 'Dose Extra de Nutella', is_var: 0, price: 5.00, ncm: '1806.90.00', cat: 'adicionais', emoji: '🌰' },
    { name: 'Chocolate KitKat Unid.', is_var: 0, price: 4.50, ncm: '1806.32.10', cat: 'adicionais', emoji: '🍫' },
    { name: 'Bombom Ouro Branco Unid.', is_var: 0, price: 3.00, ncm: '1806.90.00', cat: 'adicionais', emoji: '🍬' },
    { name: 'Porção de Morango Fresco', is_var: 0, price: 4.00, ncm: '0810.10.00', cat: 'adicionais', emoji: '🍓' },
    { name: 'Creme de Ninho Extra', is_var: 0, price: 3.50, ncm: '1901.90.90', cat: 'adicionais', emoji: '🥛' },
    { name: 'Sacola Térmica Viagem', is_var: 0, price: 3.00, ncm: '3923.29.90', cat: 'adicionais', emoji: '🛍️' }
  ];

  for (const item of expectedItems) {
    const existing = db.prepare('SELECT id FROM products WHERE name = ?').get(item.name);
    if (existing) {
      db.prepare('UPDATE products SET is_variable_price = ?, default_price = ?, ncm_code = ?, category = ?, image_emoji = ?, active = 1 WHERE id = ?')
        .run(item.is_var, item.price, item.ncm, item.cat, item.emoji, existing.id);
    } else {
      db.prepare('INSERT INTO products (name, is_variable_price, default_price, ncm_code, category, image_emoji, active) VALUES (?, ?, ?, ?, ?, ?, 1)')
        .run(item.name, item.is_var, item.price, item.ncm, item.cat, item.emoji);
    }
  }

  // Deactivate any legacy items not in expected catalog
  const allProds = db.prepare('SELECT id, name FROM products').all();
  for (const p of allProds) {
    if (!expectedItems.some(i => i.name === p.name)) {
      db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(p.id);
    }
  }

  // Seed default users (Manager & Cashier) if empty
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    const insertUser = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, is_active, lgpd_consent, lgpd_consent_timestamp)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    // Passwords hashed with bcrypt (cost 10)
    const salt = bcrypt.genSaltSync(10);
    const gerenteHash = bcrypt.hashSync('Gerente@123', salt);
    const caixaHash = bcrypt.hashSync('Caixa@123', salt);

    insertUser.run('Gerência Pôr do Açaí', 'gerente@pordoacai.com.br', gerenteHash, 'gerente', 1, 1);
    insertUser.run('Operador de Caixa', 'caixa@pordoacai.com.br', caixaHash, 'operador', 1, 1);
  }
}

module.exports = {
  db,
  initializeDatabase
};
