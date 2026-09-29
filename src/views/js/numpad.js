/**
 * numpad.js
 * On-screen Touch Numpad for fast variable price entry (Açaí self-service/por quilo/manual).
 */

class NumpadController {
  constructor() {
    this.buffer = '';
    this.selectedProduct = null;

    this.initElements();
    this.bindEvents();
  }

  initElements() {
    this.display = document.getElementById('numpad-display-val');
    this.keys = document.querySelectorAll('.numpad-key');
    this.quickPriceChips = document.querySelectorAll('.quick-price-chip');
    this.btnAddManual = document.getElementById('btn-add-manual-item');
    this.varProdsGrid = document.getElementById('var-prods-grid');
  }

  bindEvents() {
    // Keypad touches
    this.keys.forEach(key => {
      key.addEventListener('click', () => {
        const val = key.getAttribute('data-key');
        const action = key.getAttribute('data-action');

        if (action === 'clear') {
          this.clear();
        } else if (action === 'backspace') {
          this.backspace();
        } else if (val) {
          this.appendDigit(val);
        }
      });
    });

    // Quick price preset chips (R$ 12, R$ 15, R$ 18, R$ 22, R$ 25)
    this.quickPriceChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const price = chip.getAttribute('data-price');
        this.setPrice(price);
      });
    });

    // Add manual item button
    if (this.btnAddManual) {
      this.btnAddManual.addEventListener('click', () => this.addManualItemToCart());
    }

    // Physical keyboard numpad listener support
    window.addEventListener('keydown', (e) => {
      // Ignore if user is typing into text inputs (like copilot or customer phone)
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      if (e.key >= '0' && e.key <= '9') {
        this.appendDigit(e.key);
      } else if (e.key === '.' || e.key === ',') {
        this.appendDigit('.');
      } else if (e.key === 'Backspace') {
        this.backspace();
      } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
        this.clear();
      } else if (e.key === 'Enter') {
        this.addManualItemToCart();
      }
    });
  }

  appendDigit(digit) {
    if (digit === '.' && this.buffer.includes('.')) return;
    if (this.buffer.includes('.') && this.buffer.split('.')[1].length >= 2) return; // Max 2 decimal digits
    if (this.buffer.length >= 7) return; // Prevent excessive number

    this.buffer += digit;
    this.updateDisplay();
  }

  backspace() {
    this.buffer = this.buffer.slice(0, -1);
    this.updateDisplay();
  }

  clear() {
    this.buffer = '';
    this.updateDisplay();
  }

  setPrice(price) {
    this.buffer = String(price);
    this.updateDisplay();
  }

  get numericValue() {
    return parseFloat(this.buffer) || 0.0;
  }

  updateDisplay() {
    if (!this.display) return;
    if (!this.buffer) {
      this.display.textContent = '0,00';
      return;
    }

    const val = parseFloat(this.buffer);
    if (isNaN(val)) {
      this.display.textContent = '0,00';
    } else {
      // If user typed dot at end, keep it visible
      if (this.buffer.endsWith('.')) {
        this.display.textContent = `${this.buffer.slice(0, -1)},`;
      } else {
        this.display.textContent = val.toLocaleString('pt-BR', { minimumFractionDigits: this.buffer.includes('.') ? this.buffer.split('.')[1].length : 0 });
      }
    }
  }

  setSelectedProduct(prod) {
    this.selectedProduct = prod;
    if (this.btnAddManual) {
      this.btnAddManual.innerHTML = `<span>➕</span> Adicionar ${prod.name} (${prod.image_emoji})`;
    }
  }

  async addManualItemToCart() {
    if (!this.selectedProduct) {
      alert('Selecione primeiro o tipo de açaí (Tradicional, Trufado, etc).');
      return;
    }

    const price = this.numericValue;
    if (price <= 0) {
      alert('Digite o valor do açaí pelo teclado numérico.');
      return;
    }

    try {
      const res = await fetch('/api/pos/manual-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: this.selectedProduct.id,
          manualPrice: price,
          quantity: 1
        })
      });

      const item = await res.json();
      if (!res.ok) throw new Error(item.error);

      window.app.addItemToCart({
        product_id: item.product_id,
        name: item.name,
        is_variable_price: true,
        image_emoji: item.image_emoji,
        quantity: 1,
        final_price: item.final_price
      });

      this.clear();
    } catch (e) {
      alert('Erro: ' + e.message);
    }
  }
}

window.numpadController = new NumpadController();
