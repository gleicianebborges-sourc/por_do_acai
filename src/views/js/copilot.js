/**
 * copilot.js
 * Front-end controller for the CopilotSkill natural language bar.
 */

class CopilotController {
  constructor() {
    this.input = document.getElementById('copilot-cmd-input');
    this.btnRun = document.getElementById('btn-run-copilot');
    this.chips = document.querySelectorAll('.copilot-chip');

    this.bindEvents();
  }

  bindEvents() {
    if (this.btnRun) {
      this.btnRun.addEventListener('click', () => this.runCommand());
    }

    if (this.input) {
      this.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.runCommand();
        }
      });
    }

    // Quick suggestion chips
    this.chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const text = chip.getAttribute('data-cmd');
        if (this.input) {
          this.input.value = text;
          this.runCommand();
        }
      });
    });
  }

  async runCommand() {
    const command = this.input ? this.input.value.trim() : '';
    if (!command) return;

    try {
      this.btnRun.disabled = true;
      this.btnRun.innerHTML = '<span>⚡ Analisando...</span>';

      const response = await fetch('/api/copilot/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Falha ao processar comando.');
      }

      const { parsedItems, executionTime } = data.result;

      // Add all parsed items into active order cart
      for (const item of parsedItems) {
        window.app.addItemToCart({
          product_id: item.product_id,
          name: item.name,
          is_variable_price: item.is_variable_price,
          image_emoji: item.image_emoji,
          quantity: item.quantity,
          final_price: item.final_price
        });
      }

      // Clear input
      if (this.input) this.input.value = '';

      // Flash success in the ticker
      window.agentLogsController.flashTicker(
        `🤖 CopilotSkill processou ${parsedItems.length} item(ns) em ${data.executionTime}ms!`
      );
    } catch (err) {
      alert(`Erro ao lançar itens: ${err.message}`);
    } finally {
      this.btnRun.disabled = false;
      this.btnRun.innerHTML = '<span>⚡ Lançar</span>';
    }
  }
}

window.copilotController = new CopilotController();
