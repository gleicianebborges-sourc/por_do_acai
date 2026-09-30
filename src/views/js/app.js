/**
 * app.js
 * Main frontend application controller orchestrating POS operations,
 * catalog rendering, numpad integration, and cart state.
 */

class POSApp {
  constructor() {
    this.cart = [];
    this.variableProducts = [];
    this.beverages = [];
    this.additions = [];
    this.fixedProducts = [];
    this.fiscalConfig = window.posFiscalConfig || null;

    this.initDOMElements();
    this.bindEvents();
    this.loadCatalog();
  }

  initDOMElements() {
    // Variable Products Grid (Açaí bases)
    this.varProdsGrid = document.getElementById('var-prods-grid');

    // Quick Categories
    this.beveragesGrid = document.getElementById('beverages-grid');
    this.additionsGrid = document.getElementById('additions-grid');
    this.fixedProductsGrid = document.getElementById('fixed-products-grid');

    // Cart Elements
    this.cartItemsList = document.getElementById('cart-items-container');
    this.cartEmptyState = document.getElementById('cart-empty-view');
    this.cartCountBadge = document.getElementById('cart-items-badge');
    this.cartSubtotal = document.getElementById('cart-subtotal-val');
    this.cartTaxEstimate = document.getElementById('cart-tax-estimate');
    this.cartGrandTotal = document.getElementById('cart-grand-total');
    this.btnCheckout = document.getElementById('btn-start-checkout');
    this.btnClearCart = document.getElementById('btn-clear-cart');

    // History Modal
    this.btnHistory = document.getElementById('btn-open-history');
    this.historyModal = document.getElementById('history-modal');
    this.historyList = document.getElementById('sales-history-list');
    this.btnCloseHistory = document.getElementById('btn-close-history');
  }

  bindEvents() {
    if (this.btnClearCart) {
      this.btnClearCart.addEventListener('click', () => this.clearCart());
    }

    if (this.btnCheckout) {
      this.btnCheckout.addEventListener('click', () => {
        if (this.cart.length > 0) {
          const grandTotal = this.calculateGrandTotal();
          window.checkoutModal.show(this.cart, grandTotal);
        }
      });
    }

    if (this.btnHistory) {
      this.btnHistory.addEventListener('click', () => this.openHistory());
    }
    if (this.btnCloseHistory) {
      this.btnCloseHistory.addEventListener('click', () => this.closeHistory());
    }

    // Keyboard shortcut F2 to checkout
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        if (this.cart.length > 0 && this.btnCheckout) {
          this.btnCheckout.click();
        }
      }
    });
  }

  async loadCatalog() {
    try {
      // Load centralized fiscal configuration
      try {
        const fiscalRes = await fetch('/api/config/fiscal');
        if (fiscalRes.ok) {
          this.fiscalConfig = await fiscalRes.json();
          window.posFiscalConfig = this.fiscalConfig;
        }
      } catch (err) {
        console.warn('Could not load fiscal configuration, using fallback defaults', err);
      }

      const res = await fetch('/api/products');
      const data = await res.json();

      this.variableProducts = data.variablePriceProducts || [];
      this.beverages = data.beverages || (data.fixedPriceProducts || []).filter(p => p.category === 'bebidas');
      this.additions = data.additions || (data.fixedPriceProducts || []).filter(p => p.category === 'adicionais' || p.category === 'toppings');
      this.fixedProducts = data.fixedPriceProducts || [];

      this.renderVariableProducts();
      this.renderBeverages();
      this.renderAdditions();

      // Default select first variable product for Numpad
      if (this.variableProducts.length > 0) {
        this.selectVariableProduct(this.variableProducts[0]);
      }
    } catch (e) {
      console.error('Failed to load catalog', e);
    }
  }

  renderVariableProducts() {
    if (!this.varProdsGrid) return;
    this.varProdsGrid.innerHTML = this.variableProducts.map(prod => `
      <div class="var-prod-btn ${window.numpadController?.selectedProduct?.id === prod.id ? 'active' : ''}" data-id="${prod.id}">
        <span class="var-emoji">${prod.image_emoji}</span>
        <span class="var-name">${prod.name}</span>
      </div>
    `).join('');

    this.varProdsGrid.querySelectorAll('.var-prod-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.getAttribute('data-id'));
        const product = this.variableProducts.find(p => p.id === id);
        if (product) this.selectVariableProduct(product);
      });
    });
  }

  selectVariableProduct(product) {
    if (window.numpadController) {
      window.numpadController.setSelectedProduct(product);
    }
    this.renderVariableProducts();
  }

  renderBeverages() {
    if (!this.beveragesGrid) return;
    this.beveragesGrid.innerHTML = this.beverages.map(prod => `
      <div class="quick-card" data-id="${prod.id}" title="Adicionar 1 un ao carrinho">
        <div class="quick-card-top">
          <span class="quick-card-emoji">${prod.image_emoji}</span>
          <span class="quick-card-title">${prod.name}</span>
        </div>
        <div class="quick-card-bottom">
          <span class="quick-card-price">R$ ${Number(prod.default_price).toFixed(2).replace('.', ',')}</span>
          <span class="quick-card-action">➕ 1 un</span>
        </div>
      </div>
    `).join('');

    this.beveragesGrid.querySelectorAll('.quick-card').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.getAttribute('data-id'));
        const product = this.beverages.find(p => p.id === id);
        if (product) {
          this.addItemToCart({
            product_id: product.id,
            name: product.name,
            is_variable_price: false,
            image_emoji: product.image_emoji,
            quantity: 1,
            final_price: Number(product.default_price)
          });
        }
      });
    });
  }

  renderAdditions() {
    if (!this.additionsGrid) return;
    this.additionsGrid.innerHTML = this.additions.map(prod => `
      <div class="quick-card" data-id="${prod.id}" title="Adicionar 1 un ao carrinho">
        <div class="quick-card-top">
          <span class="quick-card-emoji">${prod.image_emoji}</span>
          <span class="quick-card-title">${prod.name}</span>
        </div>
        <div class="quick-card-bottom">
          <span class="quick-card-price">R$ ${Number(prod.default_price).toFixed(2).replace('.', ',')}</span>
          <span class="quick-card-action">➕ 1 un</span>
        </div>
      </div>
    `).join('');

    this.additionsGrid.querySelectorAll('.quick-card').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.getAttribute('data-id'));
        const product = this.additions.find(p => p.id === id);
        if (product) {
          this.addItemToCart({
            product_id: product.id,
            name: product.name,
            is_variable_price: false,
            image_emoji: product.image_emoji,
            quantity: 1,
            final_price: Number(product.default_price)
          });
        }
      });
    });
  }

  addItemToCart(item) {
    const qty = Number(item.quantity) || 1;
    const finalPrice = Math.round(Number(item.final_price || 0) * 100) / 100;
    const unitPrice = item.is_variable_price ? finalPrice : (finalPrice / qty);

    // If fixed product already in cart, increment quantity
    if (!item.is_variable_price) {
      const existing = this.cart.find(i => i.product_id === item.product_id && !i.is_variable_price);
      if (existing) {
        existing.quantity += qty;
        existing.final_price = Math.round(existing.quantity * unitPrice * 100) / 100;
        this.renderCart();
        return;
      }
    }

    this.cart.push({
      product_id: item.product_id,
      name: item.name,
      is_variable_price: Boolean(item.is_variable_price),
      image_emoji: item.image_emoji || '🍧',
      quantity: qty,
      final_price: finalPrice
    });

    this.renderCart();
  }

  removeCartItem(index) {
    this.cart.splice(index, 1);
    this.renderCart();
  }

  clearCart() {
    this.cart = [];
    this.renderCart();
  }

  calculateGrandTotal() {
    return Math.round(this.cart.reduce((sum, item) => sum + Number(item.final_price || 0), 0) * 100) / 100;
  }

  renderCart() {
    const total = this.calculateGrandTotal();
    const count = this.cart.reduce((sum, i) => sum + (Number(i.quantity) || 1), 0);
    const taxRate = Number(this.fiscalConfig?.ibptTaxRate || 22.85);
    const taxVal = Math.round(total * (taxRate / 100) * 100) / 100;

    if (this.cartCountBadge) this.cartCountBadge.textContent = count;
    if (this.cartSubtotal) this.cartSubtotal.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
    if (this.cartGrandTotal) this.cartGrandTotal.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
    if (this.cartTaxEstimate) this.cartTaxEstimate.textContent = `R$ ${taxVal.toFixed(2).replace('.', ',')}`;

    if (this.btnCheckout) {
      this.btnCheckout.disabled = this.cart.length === 0;
    }

    if (this.cart.length === 0) {
      if (this.cartEmptyState) this.cartEmptyState.style.display = 'flex';
      if (this.cartItemsList) this.cartItemsList.innerHTML = '';
      return;
    }

    if (this.cartEmptyState) this.cartEmptyState.style.display = 'none';

    this.cartItemsList.innerHTML = this.cart.map((item, index) => {
      const itemQty = Number(item.quantity) || 1;
      const itemFinalPrice = Number(item.final_price) || 0;
      const unitPrice = itemFinalPrice / itemQty;

      const detailStr = item.is_variable_price
        ? `1 un × R$ ${itemFinalPrice.toFixed(2).replace('.', ',')} (Preço Manual / Balança)`
        : `${itemQty} un × R$ ${unitPrice.toFixed(2).replace('.', ',')}`;

      return `
        <div class="cart-item-row">
          <div class="item-info">
            <span class="item-emoji">${item.image_emoji}</span>
            <div class="item-details">
              <span class="item-name">${item.name}</span>
              <span class="item-subtext">${detailStr}</span>
            </div>
          </div>
          <div class="item-price-actions">
            <span class="item-total-price">R$ ${itemFinalPrice.toFixed(2).replace('.', ',')}</span>
            <button class="btn-remove-item" onclick="window.app.removeCartItem(${index})" title="Remover item">✕</button>
          </div>
        </div>
      `;
    }).join('');
  }

  async openHistory() {
    try {
      const res = await fetch('/api/sales');
      const sales = await res.json();
      if (!this.historyList) return;

      if (sales.length === 0) {
        this.historyList.innerHTML = `<div style="text-align: center; color: #888; padding: 2rem;">Nenhuma venda registrada ainda.</div>`;
      } else {
        this.historyList.innerHTML = sales.map(s => `
          <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 0.85rem 1rem; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-weight: bold; font-size: 0.95rem;">Venda #${String(s.id).padStart(6, '0')} - R$ ${Number(s.total_amount).toFixed(2).replace('.', ',')}</div>
              <div style="font-size: 0.75rem; color: #888;">${new Date(s.timestamp).toLocaleString('pt-BR')} • ${s.payment_method} ${s.customer_phone ? `• Tel: ${s.customer_phone}` : ''}</div>
            </div>
            <button class="header-btn" onclick="window.app.reprintReceipt(${s.id})">
              🖨️ Ver Cupom
            </button>
          </div>
        `).join('');
      }

      if (this.historyModal) this.historyModal.classList.add('active');
    } catch (e) {
      alert('Erro ao carregar histórico: ' + e.message);
    }
  }

  closeHistory() {
    if (this.historyModal) this.historyModal.classList.remove('active');
  }

  async reprintReceipt(saleId) {
    try {
      const res = await fetch('/api/sales');
      const sales = await res.json();
      const sale = sales.find(s => s.id === saleId);
      if (!sale) throw new Error('Venda não encontrada');

      const taxRate = Number(this.fiscalConfig?.ibptTaxRate || 22.85);
      const approxTax = Math.round(Number(sale.total_amount) * (taxRate / 100) * 100) / 100;

      this.closeHistory();
      if (window.receiptView) {
        window.receiptView.show({
          sale,
          companyInfo: this.fiscalConfig || window.posFiscalConfig,
          approxTax,
          ibptTaxRate: taxRate,
          taxResult: {
            formattedKey: '1526094891283400019065001' + String(sale.id).padStart(9, '0') + '100000000',
            protocolNumber: '11526' + Date.now().toString().slice(-10)
          },
          customerPhone: sale.customer_phone
        });
      }
    } catch (e) {
      alert('Erro: ' + e.message);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new POSApp();
});
