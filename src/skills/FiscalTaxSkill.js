const BaseSkill = require('./BaseSkill');

/**
 * FiscalTaxSkill
 * Triggered on checkout. Builds the tax payload (NFC-e Modelo 65),
 * simulates communication with the Brazilian SEFAZ tax gateway,
 * calculates the 44-digit access key (with Modulo 11 check digit),
 * generates authorization protocol and stores the signed XML representation.
 */
class FiscalTaxSkill extends BaseSkill {
  constructor() {
    super('FiscalTaxSkill', 'Emissão automática de Cupom Fiscal Eletrônico (NFC-e) na SEFAZ');
    this.company = {
      tradeName: 'PÔR DO AÇAÍ',
      legalName: 'GLEICIANE B BORGES AÇAITERIA LTDA',
      cnpj: '48.912.834/0001-90',
      ie: '109.843.912.110',
      ufCode: '15', // Pará
      serie: '001'
    };
  }

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

  generateAccessKey(saleId) {
    const uf = this.company.ufCode;
    const now = new Date();
    const yy = now.getFullYear().toString().slice(-2);
    const mm = (now.getMonth() + 1).toString().padStart(2, '0');
    const aamm = `${yy}${mm}`;
    const cleanCnpj = this.company.cnpj.replace(/\D/g, '').padEnd(14, '0');
    const modelo = '65'; // NFC-e
    const serie = this.company.serie;
    const numeroDoc = String(saleId).padStart(9, '0');
    const tipoEmissao = '1'; // Normal
    const codigoAleatorio = Math.floor(10000000 + Math.random() * 90000000).toString();

    const key43 = `${uf}${aamm}${cleanCnpj}${modelo}${serie}${numeroDoc}${tipoEmissao}${codigoAleatorio}`;
    const dv = this._calculateDV44(key43);
    return `${key43}${dv}`;
  }

  async run(context, saleId) {
    const { sale, items } = context;

    // Simulate SEFAZ gateway network processing delay (80ms - 150ms)
    await new Promise(resolve => setTimeout(resolve, 100));

    const accessKey = this.generateAccessKey(sale.id);
    const protocolNumber = `1${this.company.ufCode}${new Date().getFullYear().toString().slice(-2)}${Math.floor(10000000000 + Math.random() * 90000000000)}`;
    const formattedKey = accessKey.replace(/(\d{4})/g, '$1 ').trim();

    // Approximate taxes (Lei 12.741/2012)
    const totalTaxes = Math.round((sale.total_amount * 0.2285) * 100) / 100;

    // Simulated signed XML NFC-e
    const xmlAccessKey = accessKey;
    const xmlPayload = `
      <nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
        <NFe>
          <infNFe Id="NFe${accessKey}" versao="4.00">
            <ide><cUF>${this.company.ufCode}</cUF><mod>65</mod><serie>1</serie><nNF>${sale.id}</nNF></ide>
            <emit><CNPJ>${this.company.cnpj.replace(/\D/g, '')}</CNPJ><xNome>${this.company.legalName}</xNome></emit>
            <total><vNF>${sale.total_amount.toFixed(2)}</vNF><vTotTrib>${totalTaxes.toFixed(2)}</vTotTrib></total>
          </infNFe>
        </NFe>
        <protNFe versao="4.00">
          <infProt><cStat>100</cStat><xMotivo>Autorizado o uso da NFC-e</xMotivo><chNFe>${accessKey}</chNFe><nProt>${protocolNumber}</nProt></infProt>
        </protNFe>
      </nfeProc>
    `.trim();

    const qrCodeUrl = `https://www.sefaz.pa.gov.br/nfce/qrcode?p=${Buffer.from(`${accessKey}|2|1|1|${sale.total_amount.toFixed(2)}`).toString('base64')}`;

    return {
      status: 'AUTORIZADO',
      accessKey,
      formattedKey,
      protocolNumber,
      xmlAccessKey,
      xmlPayload,
      qrCodeUrl,
      taxes: {
        total: totalTaxes,
        percent: '22,85%'
      },
      authorizedAt: new Date().toISOString()
    };
  }
}

module.exports = FiscalTaxSkill;
