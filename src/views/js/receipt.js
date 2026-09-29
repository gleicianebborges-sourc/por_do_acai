/**
 * receipt.js
 * Renders printable Brazilian NFC-e (Nota Fiscal de Consumidor Eletrônica) coupon
 * compliant with SEFAZ thermal printer layout.
 */

class ReceiptView {
  constructor() {
    this.modal = document.getElementById('receipt-modal');
    this.container = document.getElementById('receipt-content-area');
    this.initEvents();
  }

  initEvents() {
    const closeBtn = document.getElementById('btn-close-receipt');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }

    const printBtn = document.getElementById('btn-print-action');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        window.print();
      });
    }

    const newSaleBtn = document.getElementById('btn-new-sale-action');
    if (newSaleBtn) {
      newSaleBtn.addEventListener('click', () => {
        this.hide();
        window.app.clearCart();
      });
    }
  }

  show(receiptData) {
    this.render(receiptData);
    if (this.modal) {
      this.modal.classList.add('active');
    }
  }

  hide() {
    if (this.modal) {
      this.modal.classList.remove('active');
    }
  }

  formatCurrency(val) {
    return `R$ ${Number(val).toFixed(2).replace('.', ',')}`;
  }

  render(data) {
    const sale = data.sale;
    const company = data.companyInfo || {
      tradeName: 'PÔR DO AÇAÍ',
      legalName: 'GLEICIANE B BORGES AÇAITERIA LTDA',
      cnpj: '48.912.834/0001-90',
      ie: '109.843.912.110',
      address: 'Av. Beira Rio, 1200 - Belém - PA'
    };

    const formattedKey = data.formattedKey || (data.taxCoupon ? data.taxCoupon.access_key : '');
    const protocolNumber = data.protocolNumber || (data.taxCoupon ? data.taxCoupon.protocol_number : '');
    const dateFormatted = new Date(sale.timestamp || Date.now()).toLocaleString('pt-BR');

    let itemsRows = '';
    sale.items.forEach((item, index) => {
      const isWeight = item.quantity_or_weight < 5 && item.quantity_or_weight.toString().includes('.');
      const qtyStr = isWeight 
        ? `${Number(item.quantity_or_weight).toFixed(3)}kg`
        : `${item.quantity_or_weight} un`;

      itemsRows += `
        <tr>
          <td>${String(index + 1).padStart(3, '0')}</td>
          <td><strong>${item.product_name || item.name || 'Produto'}</strong></td>
          <td>${qtyStr}</td>
          <td style="text-align: right;">${this.formatCurrency(item.calculated_price)}</td>
        </tr>
      `;
    });

    const paymentMap = {
      'PIX': 'PIX (Pagamento Instantâneo)',
      'CREDIT_CARD': 'Cartão de Crédito',
      'DEBIT_CARD': 'Cartão de Débito',
      'CASH': 'Dinheiro em Espécie'
    };

    // Simulated QR Code SVG for SEFAZ
    const qrSvg = this.generateSimulatedQRCode();

    this.container.innerHTML = `
      <div class="receipt-wrapper" id="printable-nfc-e">
        <div class="receipt-header">
          <h4>${company.tradeName}</h4>
          <div>${company.legalName}</div>
          <div>CNPJ: ${company.cnpj} - IE: ${company.ie}</div>
          <div>${company.address}</div>
          <div style="margin-top: 6px; font-weight: bold;">
            DANFE NFC-e - Documento Auxiliar da<br>
            Nota Fiscal de Consumidor Eletrônica
          </div>
          <div style="font-size: 0.7rem; color: #555;">NÃO PERMITE APROVEITAMENTO DE CRÉDITO DE ICMS</div>
        </div>

        <table class="receipt-items-table">
          <thead>
            <tr>
              <th>#</th>
              <th>DESCRIÇÃO</th>
              <th>QTD</th>
              <th style="text-align: right;">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <div class="receipt-totals">
          <div class="receipt-line">
            <span>Qtd. Total de Itens:</span>
            <span>${sale.items.length}</span>
          </div>
          <div class="receipt-line bold">
            <span>VALOR TOTAL R$:</span>
            <span>${this.formatCurrency(sale.total_amount)}</span>
          </div>
          <div class="receipt-line">
            <span>Forma de Pagamento:</span>
            <span>${paymentMap[sale.payment_method] || sale.payment_method}</span>
          </div>
          ${sale.payment_method === 'CASH' ? `
            <div class="receipt-line">
              <span>Valor Recebido:</span>
              <span>${this.formatCurrency(sale.amount_received || sale.total_amount)}</span>
            </div>
            <div class="receipt-line">
              <span>Troco:</span>
              <span>${this.formatCurrency(sale.change_due || 0)}</span>
            </div>
          ` : ''}
        </div>

        <div style="font-size: 0.72rem; text-align: center; margin: 6px 0;">
          Tributos Totais Incidentes (Lei Federal 12.741/2012):<br>
          <strong>${this.formatCurrency(sale.total_amount * 0.2285)} (22,85% Fonte: IBPT)</strong>
        </div>

        <div class="sefaz-info-box">
          <div><strong>EMISSÃO NORMAL</strong></div>
          <div>NFC-e Nº ${String(sale.id).padStart(9, '0')} - Série 001</div>
          <div>Data/Hora: ${dateFormatted}</div>
          <div>Protocolo de Autorização: ${protocolNumber}</div>

          <div style="margin-top: 8px;"><strong>CHAVE DE ACESSO</strong></div>
          <div class="access-key-box">${formattedKey}</div>

          <div class="receipt-qr-frame">
            ${qrSvg}
            <div style="font-size: 0.65rem; color: #444; margin-top: 3px;">
              Consulte pela Chave de Acesso em:<br>
              <strong>www.sefaz.pa.gov.br/nfce/consulta</strong>
            </div>
          </div>

          <div style="margin-top: 8px; font-weight: bold;">
            CONSUMIDOR NÃO IDENTIFICADO
          </div>
        </div>
      </div>
    `;
  }

  generateSimulatedQRCode() {
    return `
      <svg width="120" height="120" viewBox="0 0 100 100" style="margin: 0 auto; display: block;">
        <rect width="100" height="100" fill="#ffffff" />
        <!-- Corner boxes -->
        <rect x="5" y="5" width="26" height="26" fill="#000000" />
        <rect x="9" y="9" width="18" height="18" fill="#ffffff" />
        <rect x="13" y="13" width="10" height="10" fill="#000000" />

        <rect x="69" y="5" width="26" height="26" fill="#000000" />
        <rect x="73" y="9" width="18" height="18" fill="#ffffff" />
        <rect x="77" y="13" width="10" height="10" fill="#000000" />

        <rect x="5" y="69" width="26" height="26" fill="#000000" />
        <rect x="9" y="73" width="18" height="18" fill="#ffffff" />
        <rect x="13" y="77" width="10" height="10" fill="#000000" />

        <!-- Simulated QR Pattern matrix -->
        <rect x="36" y="8" width="6" height="6" fill="#000000" />
        <rect x="46" y="14" width="6" height="6" fill="#000000" />
        <rect x="56" y="8" width="6" height="6" fill="#000000" />
        <rect x="36" y="24" width="6" height="6" fill="#000000" />
        <rect x="46" y="24" width="8" height="6" fill="#000000" />
        <rect x="14" y="38" width="6" height="6" fill="#000000" />
        <rect x="26" y="44" width="8" height="6" fill="#000000" />
        <rect x="38" y="38" width="12" height="12" fill="#000000" />
        <rect x="56" y="42" width="8" height="8" fill="#000000" />
        <rect x="72" y="38" width="6" height="6" fill="#000000" />
        <rect x="84" y="46" width="6" height="8" fill="#000000" />
        <rect x="12" y="54" width="8" height="6" fill="#000000" />
        <rect x="36" y="56" width="10" height="6" fill="#000000" />
        <rect x="52" y="56" width="8" height="8" fill="#000000" />
        <rect x="68" y="54" width="6" height="6" fill="#000000" />
        <rect x="82" y="60" width="8" height="6" fill="#000000" />
        <rect x="38" y="70" width="8" height="8" fill="#000000" />
        <rect x="52" y="74" width="6" height="6" fill="#000000" />
        <rect x="64" y="70" width="8" height="8" fill="#000000" />
        <rect x="80" y="74" width="6" height="6" fill="#000000" />
        <rect x="40" y="86" width="6" height="6" fill="#000000" />
        <rect x="54" y="86" width="8" height="6" fill="#000000" />
        <rect x="72" y="86" width="6" height="6" fill="#000000" />
      </svg>
    `;
  }
}

window.receiptView = new ReceiptView();
