/**
 * checkout.js
 * Handles checkout payment options (PIX, Cash with exact change calculator, Cards)
 * and optional customer phone number for the DigitalReceiptSkill (WhatsApp dispatch).
 */

class CheckoutModal {
  constructor() {
    this.modal = document.getElementById('checkout-modal');
    this.currentTotal = 0.0;
    this.selectedMethod = 'PIX';
    this.amountReceived = 0.0;
    this.cartItems = [];

    this.initElements();
    this.initEvents();
  }

  initElements() {
    this.totalDisplays = document.querySelectorAll('.checkout-total-display');
    this.tabs = document.querySelectorAll('.tab-btn');
    this.panels = {
      PIX: document.getElementById('panel-pix'),
      CREDIT_CARD: document.getElementById('panel-credit'),
      DEBIT_CARD: document.getElementById('panel-debit'),
      CASH: document.getElementById('panel-cash')
    };

    this.customerPhoneInput = document.getElementById('checkout-customer-phone');
    this.cashInput = document.getElementById('cash-received-input');
    this.changeDisplay = document.getElementById('cash-change-display');
    this.finalizeBtn = document.getElementById('btn-confirm-checkout');
    this.closeBtn = document.getElementById('btn-close-checkout');
    this.cancelBtn = document.getElementById('btn-cancel-checkout');
  }

  initEvents() {
    if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.hide());
    if (this.cancelBtn) this.cancelBtn.addEventListener('click', () => this.hide());

    this.tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const method = tab.getAttribute('data-method');
        this.selectMethod(method);
      });
    });

    const cashChips = document.querySelectorAll('.cash-chip');
    cashChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const val = Number(chip.getAttribute('data-val'));
        if (this.cashInput) {
          this.cashInput.value = val.toFixed(2);
          this.handleCashChange();
        }
      });
    });

    if (this.cashInput) {
      this.cashInput.addEventListener('input', () => this.handleCashChange());
    }

    if (this.finalizeBtn) {
      this.finalizeBtn.addEventListener('click', () => this.processCheckout());
    }
  }

  show(cartItems, total) {
    this.cartItems = cartItems;
    this.currentTotal = Number(total);
    this.amountReceived = this.currentTotal;

    this.totalDisplays.forEach(el => {
      el.textContent = `R$ ${this.currentTotal.toFixed(2).replace('.', ',')}`;
    });

    if (this.cashInput) {
      this.cashInput.value = this.currentTotal.toFixed(2);
    }
    this.handleCashChange();

    this.selectMethod('PIX');
    if (this.modal) this.modal.classList.add('active');
  }

  hide() {
    if (this.modal) this.modal.classList.remove('active');
  }

  selectMethod(method) {
    this.selectedMethod = method;

    this.tabs.forEach(tab => {
      if (tab.getAttribute('data-method') === method) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    for (const [key, panel] of Object.entries(this.panels)) {
      if (panel) {
        panel.style.display = key === method ? 'block' : 'none';
      }
    }
  }

  handleCashChange() {
    const received = parseFloat(this.cashInput ? this.cashInput.value : '0') || 0;
    this.amountReceived = received;

    const change = Math.max(0, received - this.currentTotal);
    if (this.changeDisplay) {
      this.changeDisplay.textContent = `R$ ${change.toFixed(2).replace('.', ',')}`;
      if (received < this.currentTotal) {
        this.changeDisplay.style.color = '#f43f5e';
      } else {
        this.changeDisplay.style.color = '#34d399';
      }
    }
  }

  async processCheckout() {
    if (this.cartItems.length === 0) {
      alert('O carrinho está vazio.');
      return;
    }

    if (this.selectedMethod === 'CASH' && this.amountReceived < this.currentTotal) {
      alert(`Valor em dinheiro insuficiente. Faltam R$ ${(this.currentTotal - this.amountReceived).toFixed(2)}`);
      return;
    }

    const customerPhone = this.customerPhoneInput ? this.customerPhoneInput.value.trim() : null;

    try {
      this.finalizeBtn.disabled = true;
      this.finalizeBtn.innerHTML = `<span>⏳ Finalizando Venda...</span>`;

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: this.cartItems.map(item => ({
            product_id: item.product_id,
            final_price: item.final_price,
            quantity: item.quantity || 1
          })),
          paymentMethod: this.selectedMethod,
          amountReceived: this.amountReceived,
          customerPhone: customerPhone || null
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao finalizar venda');
      }

      this.hide();

      // Show printable receipt view with live status
      if (window.receiptView) {
        window.receiptView.show({
          sale: data.sale,
          taxResult: data.taxResult,
          formattedKey: data.taxResult.formattedKey,
          protocolNumber: data.taxResult.protocolNumber,
          customerPhone
        });
      }

      // Clear cart
      window.app.clearCart();
    } catch (err) {
      alert(`Erro no checkout: ${err.message}`);
    } finally {
      this.finalizeBtn.disabled = false;
      this.finalizeBtn.innerHTML = `<span>✓ Confirmar & Emitir NFC-e</span>`;
    }
  }
}

window.checkoutModal = new CheckoutModal();
