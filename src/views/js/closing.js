/**
 * closing.js
 * Front-end controller for the Daily Closing ("Fechamento de Caixa") & Audit dispatch.
 * Automatically uses the active authenticated login session and dynamic user recipient email.
 */

class DailyClosingModal {
  constructor() {
    this.modal = document.getElementById('closing-modal');
    this.btnOpen = document.getElementById('btn-open-closing');
    this.btnClose = document.getElementById('btn-close-closing');
    this.btnCancel = document.getElementById('btn-cancel-closing');
    this.btnConfirm = document.getElementById('btn-confirm-closing');
    this.btnDownloadCsv = document.getElementById('btn-download-csv');

    // UI Feedback fields
    this.emailDisplay = document.getElementById('closing-user-email');
    this.salesCountEl = document.getElementById('closing-sales-count');
    this.grossTotalEl = document.getElementById('closing-gross-total');
    this.pixTotalEl = document.getElementById('closing-pix-total');
    this.creditTotalEl = document.getElementById('closing-credit-total');
    this.debitTotalEl = document.getElementById('closing-debit-total');
    this.cashTotalEl = document.getElementById('closing-cash-total');

    this.successToast = document.getElementById('closing-success-toast');
    this.successMsg = document.getElementById('closing-success-msg');

    this.lastCsvBase64 = null;
    this.lastCsvFileName = null;

    this.bindEvents();
  }

  bindEvents() {
    if (this.btnOpen) {
      this.btnOpen.addEventListener('click', () => this.open());
    }
    if (this.btnClose) {
      this.btnClose.addEventListener('click', () => this.close());
    }
    if (this.btnCancel) {
      this.btnCancel.addEventListener('click', () => this.close());
    }
    if (this.btnConfirm) {
      this.btnConfirm.addEventListener('click', () => this.executeClosing());
    }
    if (this.btnDownloadCsv) {
      this.btnDownloadCsv.addEventListener('click', () => this.downloadCsvFile());
    }
  }

  getAuthToken() {
    return localStorage.getItem('pos_token');
  }

  async open() {
    const token = this.getAuthToken();
    if (!token) {
      alert('Sessão não identificada. Por favor, identifique-se novamente para realizar o fechamento.');
      window.location.href = 'login.html';
      return;
    }

    if (this.successToast) this.successToast.style.display = 'none';
    if (this.btnConfirm) {
      this.btnConfirm.disabled = false;
      this.btnConfirm.innerHTML = '<span>✓ Confirmar & Enviar Fechamento</span>';
    }

    try {
      const res = await fetch('/api/closing/preview', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401 || data.requireLogin) {
          alert('Sua sessão expirou por segurança. Por favor, reautentique-se.');
          window.location.href = 'login.html';
          return;
        }
        throw new Error(data.error || 'Erro ao carregar prévia do fechamento');
      }

      // Display dynamic recipient note from authenticated session
      if (this.emailDisplay) {
        this.emailDisplay.textContent = data.authenticatedEmail || 'seu e-mail de acesso';
      }

      // Populate financial metrics
      const s = data.summary || {};
      if (this.salesCountEl) this.salesCountEl.textContent = s.salesCount || 0;
      if (this.grossTotalEl) this.grossTotalEl.textContent = s.formattedTotal || 'R$ 0,00';

      const pm = s.byPaymentMethod || {};
      if (this.pixTotalEl) this.pixTotalEl.textContent = `R$ ${Number(pm.PIX?.total || 0).toFixed(2).replace('.', ',')}`;
      if (this.creditTotalEl) this.creditTotalEl.textContent = `R$ ${Number(pm.CREDIT_CARD?.total || 0).toFixed(2).replace('.', ',')}`;
      if (this.debitTotalEl) this.debitTotalEl.textContent = `R$ ${Number(pm.DEBIT_CARD?.total || 0).toFixed(2).replace('.', ',')}`;
      if (this.cashTotalEl) this.cashTotalEl.textContent = `R$ ${Number(pm.CASH?.total || 0).toFixed(2).replace('.', ',')}`;

      if (this.modal) this.modal.classList.add('active');
    } catch (err) {
      alert('Erro ao abrir fechamento: ' + err.message);
    }
  }

  close() {
    if (this.modal) this.modal.classList.remove('active');
  }

  async executeClosing() {
    const token = this.getAuthToken();
    if (!token) {
      alert('Sessão expirada. Por favor, faça login novamente.');
      window.location.href = 'login.html';
      return;
    }

    try {
      this.btnConfirm.disabled = true;
      this.btnConfirm.innerHTML = '<span>⏳ Processando & Despachando...</span>';

      const res = await fetch('/api/closing/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401 || data.requireLogin) {
          alert('Sessão não autorizada. Por favor, reautentique-se.');
          window.location.href = 'login.html';
          return;
        }
        throw new Error(data.error || 'Erro ao processar fechamento de caixa');
      }

      // Store CSV payload for optional local download
      this.lastCsvBase64 = data.csvBase64;
      this.lastCsvFileName = data.fileName || 'fechamento_caixa.csv';

      // Show prominent success feedback toast
      if (this.successToast) {
        this.successMsg.textContent = `O relatório consolidado e a planilha CSV foram despachados com sucesso para: ${data.recipientEmail}`;
        this.successToast.style.display = 'block';
      }

      this.btnConfirm.innerHTML = '<span>✓ Fechamento Enviado</span>';

    } catch (err) {
      alert('Erro ao confirmar fechamento: ' + err.message);
      this.btnConfirm.disabled = false;
      this.btnConfirm.innerHTML = '<span>✓ Confirmar & Enviar Fechamento</span>';
    }
  }

  downloadCsvFile() {
    if (!this.lastCsvBase64) return;
    const byteCharacters = atob(this.lastCsvBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', this.lastCsvFileName || 'fechamento_caixa.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.dailyClosingModal = new DailyClosingModal();
});
