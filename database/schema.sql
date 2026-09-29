-- ========================================================
-- SISTEMA PDV PÔR DO AÇAÍ COM AGENTIC SKILL EXECUTION LAYER
-- SCHEMA DO BANCO DE DADOS
-- ========================================================

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  is_variable_price INTEGER NOT NULL DEFAULT 0, -- 1 = true (pesagem/valor manual), 0 = false (preço fixo)
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
  customer_phone TEXT, -- Telefone opcional para DigitalReceiptSkill (WhatsApp / SMS)
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
  execution_time REAL DEFAULT 0.0, -- em milissegundos
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sales_timestamp ON sales(timestamp);
CREATE INDEX IF NOT EXISTS idx_agent_logs_sale_id ON agent_logs(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
