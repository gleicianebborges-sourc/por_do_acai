const { db } = require('../config/database');

/**
 * TaxCoupon Model
 * Represents Brazilian NFC-e (Nota Fiscal de Consumidor Eletrônica - Mod 65)
 */
class TaxCoupon {
  constructor({ id, sale_id, access_key, sefaz_status, protocol_number, receipt_url, xml_payload = null, issued_at = null }) {
    this.id = id;
    this.sale_id = sale_id;
    this.access_key = access_key; // 44 numeric digits
    this.sefaz_status = sefaz_status; // 'AUTORIZADO', etc.
    this.protocol_number = protocol_number;
    this.receipt_url = receipt_url;
    this.xml_payload = xml_payload;
    this.issued_at = issued_at;
  }

  static findBySaleId(saleId) {
    const row = db.prepare('SELECT * FROM tax_coupons WHERE sale_id = ?').get(saleId);
    return row ? new TaxCoupon(row) : null;
  }

  static findByAccessKey(accessKey) {
    const row = db.prepare('SELECT * FROM tax_coupons WHERE access_key = ?').get(accessKey);
    return row ? new TaxCoupon(row) : null;
  }

  static create({ sale_id, access_key, sefaz_status = 'AUTORIZADO', protocol_number, receipt_url, xml_payload = '' }) {
    const stmt = db.prepare(`
      INSERT INTO tax_coupons (sale_id, access_key, sefaz_status, protocol_number, receipt_url, xml_payload)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(sale_id, access_key, sefaz_status, protocol_number, receipt_url, xml_payload);
    const row = db.prepare('SELECT * FROM tax_coupons WHERE id = ?').get(info.lastInsertRowid);
    return new TaxCoupon(row);
  }
}

module.exports = TaxCoupon;
