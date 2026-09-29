const TaxCoupon = require('../models/TaxCoupon');
const crypto = require('node:crypto');

/**
 * TaxController
 * Simulates integration with Brazilian Tax Authority (SEFAZ) for issuing NFC-e
 * (Nota Fiscal de Consumidor Eletrônica - Modelo 65) with full 44-digit key generation,
 * checksum calculation (Módulo 11), QR Code payload, and printable format.
 */
class TaxController {
  constructor() {
    this.companyInfo = {
      tradeName: 'PÔR DO AÇAÍ - AÇAITERIA & SORVETES ARTESANAIS',
      legalName: 'GLEICIANE B BORGES AÇAITERIA LTDA',
      cnpj: '48.912.834/0001-90',
      ie: '109.843.912.110', // Inscrição Estadual
      im: '87.491.203',       // Inscrição Municipal
      address: 'Av. Beira Rio, 1200 - Orla Central',
      city: 'Belém - PA',
      cep: '66000-000',
      ufCode: '15' // Pará
    };
  }

  /**
   * Calculates Modulo 11 check digit for Brazilian Tax Access Key (44 digits)
   */
  _calculateDV44(key43) {
    let multiplier = 2;
    let sum = 0;
    for (let i = key43.length - 1; i >= 0; i--) {
      sum += parseInt(key43[i], 10) * multiplier;
      multiplier = multiplier === 9 ? 2 : multiplier + 1;
    }
    const remainder = sum % 11;
    const dv = 11 - remainder;
    return (dv === 0 || dv >= 10) ? '0' : dv.toString();
  }

  /**
   * Generates a 44-digit NFC-e access key following SEFAZ technical specification
   * [UF 2d][AAMM 4d][CNPJ 14d][Mod 2d][Serie 3d][Numero 9d][TipoEmis 1d][CodNum 8d][DV 1d]
   */
  generateAccessKey(saleId) {
    const uf = this.companyInfo.ufCode;
    const now = new Date();
    const yy = now.getFullYear().toString().slice(-2);
    const mm = (now.getMonth() + 1).toString().padStart(2, '0');
    const aamm = `${yy}${mm}`;
    const cleanCnpj = this.companyInfo.cnpj.replace(/\D/g, '').padEnd(14, '0');
    const modelo = '65'; // 65 = NFC-e
    const serie = '001';
    const numeroDoc = saleId.toString().padStart(9, '0');
    const tipoEmissao = '1'; // 1 = Normal
    const codigoAleatorio = Math.floor(10000000 + Math.random() * 90000000).toString();

    const key43 = `${uf}${aamm}${cleanCnpj}${modelo}${serie}${numeroDoc}${tipoEmissao}${codigoAleatorio}`;
    const dv = this._calculateDV44(key43);
    return `${key43}${dv}`;
  }

  /**
   * Generates simulated SEFAZ authorization protocol
   */
  generateProtocol() {
    const yearPrefix = new Date().getFullYear().toString().slice(-2);
    const randomDigits = Math.floor(10000000000 + Math.random() * 90000000000).toString();
    return `1${this.companyInfo.ufCode}${yearPrefix}${randomDigits}`;
  }

  /**
   * Automatically triggered post-checkout: communicates with SEFAZ and creates TaxCoupon
   */
  async issueNFCe(sale) {
    // Simulate network delay to SEFAZ server (100ms - 250ms)
    await new Promise(resolve => setTimeout(resolve, 150));

    const accessKey = this.generateAccessKey(sale.id);
    const protocolNumber = this.generateProtocol();
    const formattedKey = accessKey.replace(/(\d{4})/g, '$1 ').trim();

    // SEFAZ QR-Code verification link (Padrão Nacional NFC-e)
    const qrCodeParam = Buffer.from(`${accessKey}|2|1|1|${sale.total_amount.toFixed(2)}`).toString('base64');
    const sefazQrUrl = `https://www.sefaz.pa.gov.br/nfce/qrcode?p=${qrCodeParam}`;

    // Approximate tax calculation (Lei 12.741/2012 - IBPT)
    const totalTaxes = Math.round((sale.total_amount * 0.2285) * 100) / 100;
    const fedTaxes = Math.round((sale.total_amount * 0.0485) * 100) / 100;
    const estTaxes = Math.round((sale.total_amount * 0.1800) * 100) / 100;

    // Simulated XML NFC-e payload
    const xmlPayload = `
      <nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
        <NFe>
          <infNFe Id="NFe${accessKey}" versao="4.00">
            <ide><cUF>${this.companyInfo.ufCode}</cUF><mod>65</mod><serie>1</serie><nNF>${sale.id}</nNF><tpEmis>1</tpEmis></ide>
            <emit><CNPJ>${this.companyInfo.cnpj.replace(/\D/g, '')}</CNPJ><xNome>${this.companyInfo.legalName}</xNome><xFant>${this.companyInfo.tradeName}</xFant></emit>
            <total><vNF>${sale.total_amount.toFixed(2)}</vNF><vTotTrib>${totalTaxes.toFixed(2)}</vTotTrib></total>
          </infNFe>
        </NFe>
        <protNFe versao="4.00">
          <infProt><cStat>100</cStat><xMotivo>Autorizado o uso da NFC-e</xMotivo><chNFe>${accessKey}</chNFe><nProt>${protocolNumber}</nProt></infProt>
        </protNFe>
      </nfeProc>
    `.trim();

    // Persist TaxCoupon to database
    const taxCoupon = TaxCoupon.create({
      sale_id: sale.id,
      access_key: accessKey,
      sefaz_status: 'AUTORIZADO',
      protocol_number: protocolNumber,
      receipt_url: sefazQrUrl,
      xml_payload: xmlPayload
    });

    return {
      taxCoupon,
      formattedKey,
      protocolNumber,
      sefazQrUrl,
      companyInfo: this.companyInfo,
      taxes: {
        total: totalTaxes,
        federal: fedTaxes,
        state: estTaxes,
        ratePercent: '22,85%'
      }
    };
  }

  /**
   * Endpoint to retrieve printable tax coupon view data for a given sale
   */
  async getReceiptData(req, res) {
    try {
      const saleId = Number(req.params.saleId);
      const Sale = require('../models/Sale');
      const sale = Sale.findById(saleId);

      if (!sale) {
        return res.status(404).json({ error: 'Venda não encontrada' });
      }

      let coupon = TaxCoupon.findBySaleId(saleId);
      let receiptData;

      if (!coupon) {
        // If not issued yet, auto-issue
        receiptData = await this.issueNFCe(sale);
      } else {
        const formattedKey = coupon.access_key.replace(/(\d{4})/g, '$1 ').trim();
        const totalTaxes = Math.round((sale.total_amount * 0.2285) * 100) / 100;
        receiptData = {
          taxCoupon: coupon,
          formattedKey,
          protocolNumber: coupon.protocol_number,
          sefazQrUrl: coupon.receipt_url,
          companyInfo: this.companyInfo,
          taxes: {
            total: totalTaxes,
            federal: Math.round((sale.total_amount * 0.0485) * 100) / 100,
            state: Math.round((sale.total_amount * 0.1800) * 100) / 100,
            ratePercent: '22,85%'
          }
        };
      }

      res.json({
        sale,
        ...receiptData
      });
    } catch (err) {
      res.status(500).json({ error: 'Erro ao gerar cupom fiscal', details: err.message });
    }
  }
}

module.exports = new TaxController();
