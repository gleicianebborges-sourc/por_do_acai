const BaseSkill = require('./BaseSkill');

/**
 * DigitalReceiptSkill
 * Triggered post-tax approval.
 * Formats a clean customer receipt summary and dispatches it via an external
 * messaging webhook (WhatsApp Business / SMS Mock) if customer_phone was provided.
 */
class DigitalReceiptSkill extends BaseSkill {
  constructor() {
    super('DigitalReceiptSkill', 'Disparo de comprovante digital e NFC-e via WhatsApp/SMS');
  }

  async run(context, saleId) {
    const { sale, taxResult } = context;
    const phone = sale.customer_phone ? sale.customer_phone.trim() : null;

    if (!phone) {
      return {
        dispatched: false,
        reason: 'Nenhum número de telefone informado pelo cliente no checkout.',
        timestamp: new Date().toISOString()
      };
    }

    // Format formatted WhatsApp receipt text message
    const itemsText = sale.items
      .map(i => `• ${i.product_name || 'Item'} (${i.quantity || 1}x) - R$ ${i.final_price.toFixed(2).replace('.', ',')}`)
      .join('\n');

    const messageBody = `
🍧 *PÔR DO AÇAÍ - Comprovante Digital* 🍧
Obrigado pela preferência! Segue o resumo da sua compra:

*Venda:* #${String(sale.id).padStart(6, '0')}
*Data:* ${new Date(sale.timestamp || Date.now()).toLocaleString('pt-BR')}
*Pagamento:* ${sale.payment_method}

*Itens:*
${itemsText}

*Total Pago:* R$ ${sale.total_amount.toFixed(2).replace('.', ',')}
${sale.change_due > 0 ? `*Troco:* R$ ${sale.change_due.toFixed(2).replace('.', ',')}\n` : ''}
*NFC-e Autorizada (SEFAZ)*
*Chave de Acesso:*
${taxResult.formattedKey || taxResult.accessKey}

Consulte seu cupom oficial em:
${taxResult.qrCodeUrl || 'https://www.sefaz.pa.gov.br/nfce'}
    `.trim();

    // Mock outgoing HTTP webhook to WhatsApp Cloud API / Twilio
    await new Promise(resolve => setTimeout(resolve, 80));

    const simulatedWebhookResponse = {
      provider: 'WhatsApp-Cloud-API-Mock',
      status: 'DELIVERED',
      recipientPhone: phone,
      messageId: `wamid.HBgM${Date.now()}${Math.floor(Math.random() * 1000)}`,
      dispatchedAt: new Date().toISOString()
    };

    return {
      dispatched: true,
      recipient: phone,
      messageBody,
      webhookResult: simulatedWebhookResponse
    };
  }
}

module.exports = DigitalReceiptSkill;
