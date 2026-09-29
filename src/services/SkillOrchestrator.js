const EventEmitter = require('node:events');
const FiscalTaxSkill = require('../skills/FiscalTaxSkill');
const DigitalReceiptSkill = require('../skills/DigitalReceiptSkill');
const CopilotSkill = require('../skills/CopilotSkill');
const AgentLog = require('../models/AgentLog');

/**
 * SkillOrchestrator
 * Event-Driven execution engine coordinating skills, hooks, telemetry,
 * and real-time state broadcasts to POS clients.
 */
class SkillOrchestrator extends EventEmitter {
  constructor() {
    super();
    this.skills = new Map();
    this.wsClients = new Set();

    // Register built-in skills
    this.registerSkill(new FiscalTaxSkill());
    this.registerSkill(new DigitalReceiptSkill());
    this.registerSkill(new CopilotSkill());

    // Setup event hooks
    this.setupHooks();
  }

  registerSkill(skillInstance) {
    this.skills.set(skillInstance.name, skillInstance);
  }

  getSkill(name) {
    return this.skills.get(name);
  }

  registerWebSocket(ws) {
    this.wsClients.add(ws);
    ws.on('close', () => this.wsClients.delete(ws));
  }

  broadcast(event, payload) {
    const message = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
    for (const ws of this.wsClients) {
      if (ws.readyState === 1 /* OPEN */) {
        ws.send(message);
      }
    }
  }

  /**
   * Internal hook pipeline wiring
   */
  setupHooks() {
    // When a checkout transaction is completed in the Controller:
    this.on('checkout:completed', async ({ sale, items, resolve, reject }) => {
      try {
        this.broadcast('SKILL_STATUS', {
          skill: 'FiscalTaxSkill',
          state: 'RUNNING',
          message: 'Emitindo NFC-e junto à SEFAZ...'
        });

        // 1. Run FiscalTaxSkill synchronously
        const fiscalSkill = this.getSkill('FiscalTaxSkill');
        const taxResult = await fiscalSkill.execute({ sale, items }, sale.id);

        if (!taxResult.success) {
          this.broadcast('SKILL_STATUS', {
            skill: 'FiscalTaxSkill',
            state: 'FAILED',
            message: `Erro na emissão fiscal: ${taxResult.error}`
          });
          return reject(new Error(taxResult.error));
        }

        this.broadcast('SKILL_STATUS', {
          skill: 'FiscalTaxSkill',
          state: 'COMPLETED',
          message: `NFC-e Autorizada! Chave: ${taxResult.data.formattedKey}`,
          taxData: taxResult.data
        });

        // 2. Trigger DigitalReceiptSkill (asynchronous post-tax dispatch)
        this.emit('checkout:tax_approved', {
          sale,
          items,
          taxResult: taxResult.data
        });

        resolve({ taxResult });
      } catch (err) {
        reject(err);
      }
    });

    // Post-tax approval event hook
    this.on('checkout:tax_approved', async ({ sale, taxResult }) => {
      if (!sale.customer_phone) {
        return; // Customer did not opt in for digital receipt
      }

      this.broadcast('SKILL_STATUS', {
        skill: 'DigitalReceiptSkill',
        state: 'RUNNING',
        message: `Disparando comprovante para ${sale.customer_phone}...`
      });

      const receiptSkill = this.getSkill('DigitalReceiptSkill');
      const receiptOutcome = await receiptSkill.execute({ sale, taxResult }, sale.id);

      if (receiptOutcome.success && receiptOutcome.data.dispatched) {
        this.broadcast('SKILL_STATUS', {
          skill: 'DigitalReceiptSkill',
          state: 'COMPLETED',
          message: `Comprovante enviado com sucesso via WhatsApp!`,
          receiptData: receiptOutcome.data
        });
      } else {
        this.broadcast('SKILL_STATUS', {
          skill: 'DigitalReceiptSkill',
          state: 'WARNING',
          message: receiptOutcome.data?.reason || receiptOutcome.error
        });
      }
    });
  }

  /**
   * Dispatches a skill synchronously
   */
  async runSkill(skillName, context, saleId = null) {
    const skill = this.getSkill(skillName);
    if (!skill) {
      throw new Error(`Skill "${skillName}" não encontrada no orquestrador.`);
    }

    this.broadcast('SKILL_STATUS', {
      skill: skillName,
      state: 'RUNNING',
      message: `Executando ${skillName}...`
    });

    const result = await skill.execute(context, saleId);

    this.broadcast('SKILL_STATUS', {
      skill: skillName,
      state: result.success ? 'COMPLETED' : 'FAILED',
      message: result.success ? `${skillName} concluído com sucesso.` : result.error,
      result
    });

    return result;
  }

  /**
   * Triggers checkout workflow via event emission
   */
  async handleCheckout(sale, items) {
    return new Promise((resolve, reject) => {
      this.emit('checkout:completed', { sale, items, resolve, reject });
    });
  }

  getRecentLogs(limit = 20) {
    return AgentLog.findRecent(limit);
  }
}

const orchestrator = new SkillOrchestrator();
module.exports = orchestrator;
