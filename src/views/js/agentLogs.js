/**
 * agentLogs.js
 * Handles WebSocket connection with SkillOrchestrator, updates real-time status banners,
 * and displays execution logs modal.
 */

class AgentLogsController {
  constructor() {
    this.ticker = document.getElementById('live-skill-ticker-text');
    this.logsModal = document.getElementById('agent-logs-modal');
    this.logsList = document.getElementById('agent-logs-list');
    this.btnOpenLogs = document.getElementById('btn-open-agent-logs');
    this.btnCloseLogs = document.getElementById('btn-close-agent-logs');

    this.initWebSocket();
    this.bindEvents();
  }

  initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/events`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleEvent(msg);
        } catch (e) {
          console.error('Error parsing WS message', e);
        }
      };

      this.ws.onclose = () => {
        console.warn('Agent WebSocket disconnected, reconnecting in 3s...');
        setTimeout(() => this.initWebSocket(), 3000);
      };
    } catch (e) {
      console.error('WebSocket connection failed', e);
    }
  }

  bindEvents() {
    if (this.btnOpenLogs) {
      this.btnOpenLogs.addEventListener('click', () => this.openLogs());
    }
    if (this.btnCloseLogs) {
      this.btnCloseLogs.addEventListener('click', () => this.closeLogs());
    }
  }

  handleEvent(msg) {
    if (msg.event === 'SKILL_STATUS') {
      const { skill, state, message } = msg.payload;
      let icon = '⚡';
      if (state === 'COMPLETED') icon = '✅';
      if (state === 'FAILED') icon = '❌';
      if (state === 'WARNING') icon = '⚠️';

      this.flashTicker(`${icon} [${skill}] ${message}`);
    }
  }

  flashTicker(text) {
    if (this.ticker) {
      this.ticker.textContent = text;
      this.ticker.style.color = '#38bdf8';
      setTimeout(() => {
        if (this.ticker) this.ticker.style.color = '#94a3b8';
      }, 4000);
    }
  }

  async openLogs() {
    try {
      const res = await fetch('/api/agent-logs');
      const logs = await res.json();
      if (!this.logsList) return;

      if (logs.length === 0) {
        this.logsList.innerHTML = `<div style="text-align: center; color: #888; padding: 2rem;">Nenhum registro de auditoria encontrado ainda.</div>`;
      } else {
        this.logsList.innerHTML = logs.map(l => {
          const statusColors = {
            'success': '#34d399',
            'pending': '#fbbf24',
            'failed': '#f43f5e'
          };
          const color = statusColors[l.status] || '#94a3b8';

          return `
            <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 0.85rem 1rem; margin-bottom: 0.65rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-weight: 800; font-size: 0.95rem; color: #c7d2fe;">${l.skill_name}</span>
                <span style="font-family: var(--font-mono); font-size: 0.75rem; font-weight: bold; color: ${color}; text-transform: uppercase;">
                  ${l.status} (${l.execution_time.toFixed(1)}ms)
                </span>
              </div>
              <div style="font-size: 0.75rem; color: #888; margin-bottom: 6px;">
                ${new Date(l.created_at).toLocaleString('pt-BR')} ${l.sale_id ? `• Venda #${l.sale_id}` : ''}
              </div>
              <pre style="background: #090312; padding: 0.5rem; border-radius: 6px; font-size: 0.7rem; color: #cbd5e1; overflow-x: auto; max-height: 120px;">${l.payload}</pre>
            </div>
          `;
        }).join('');
      }

      if (this.logsModal) this.logsModal.classList.add('active');
    } catch (e) {
      alert('Erro ao carregar logs: ' + e.message);
    }
  }

  closeLogs() {
    if (this.logsModal) this.logsModal.classList.remove('active');
  }
}

window.agentLogsController = new AgentLogsController();
