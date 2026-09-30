/**
 * fiscalConfig.js
 * Centralized fiscal and tax configuration for Pôr do Açaí POS.
 * Allows full configurability via environment variables or central dictionary.
 */

const fiscalConfig = {
  tradeName: process.env.STORE_TRADE_NAME || 'Pôr do Açaí',
  legalName: process.env.STORE_LEGAL_NAME || 'PÔR DO AÇAÍ COMÉRCIO DE ALIMENTOS LTDA',
  cnpj: process.env.STORE_CNPJ || '48.912.834/0001-90',
  ie: process.env.STORE_IE || '109.843.912.110', // Inscrição Estadual
  im: process.env.STORE_IM || '87.491.203',       // Inscrição Municipal
  address: {
    street: process.env.STORE_STREET || 'Av. Beira Rio',
    number: process.env.STORE_NUMBER || '1200',
    neighborhood: process.env.STORE_NEIGHBORHOOD || 'Orla Central',
    city: process.env.STORE_CITY || 'Belém',
    state: process.env.STORE_STATE || 'PA',
    cep: process.env.STORE_CEP || '66000-000',
    full: process.env.STORE_FULL_ADDRESS || 'Av. Beira Rio, 1200 - Orla Central - Belém - PA'
  },
  ufCode: process.env.STORE_UF_CODE || '15', // Pará (15)
  serie: process.env.STORE_SERIE || '001',
  sefazPortalUrl: process.env.SEFAZ_PORTAL_URL || 'www.sefaz.pa.gov.br/nfce/consulta',
  ibptTaxRate: Number(process.env.IBPT_TAX_RATE || 22.85), // Default 22.85% (Lei Federal 12.741/2012)
  environment: process.env.FISCAL_ENVIRONMENT || 'HOMOLOGACAO',
  environmentLabel: 'AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL'
};

module.exports = fiscalConfig;
