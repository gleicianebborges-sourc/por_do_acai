const Product = require('../models/Product');
const orchestrator = require('../services/SkillOrchestrator');

/**
 * POSController
 * Manages manual price inputs (from on-screen Numpad for variable-price items),
 * fixed-price quick items, and routes natural language requests to the CopilotSkill.
 */
class POSController {
  /**
   * Retrieves products separated into variable-price and fixed-price items
   */
  getProducts(req, res) {
    try {
      const all = Product.findAll();
      const variablePriceProducts = all.filter(p => p.is_variable_price);
      const fixedPriceProducts = all.filter(p => !p.is_variable_price);

      res.json({
        variablePriceProducts,
        fixedPriceProducts
      });
    } catch (err) {
      res.status(500).json({ error: 'Erro ao carregar catálogo', details: err.message });
    }
  }

  /**
   * Builds a cart item for manual numpad price entry (e.g. Açaí R$ 18,50)
   */
  buildManualItem(req, res) {
    try {
      const { productId, manualPrice, quantity = 1 } = req.body;

      if (!productId || manualPrice === undefined) {
        return res.status(400).json({ error: 'productId e manualPrice são obrigatórios.' });
      }

      const product = Product.findById(productId);
      if (!product) {
        return res.status(404).json({ error: 'Produto não encontrado.' });
      }

      const price = Math.round(Number(manualPrice) * 100) / 100;
      if (price <= 0) {
        return res.status(400).json({ error: 'Preço deve ser maior que zero.' });
      }

      const item = {
        product_id: product.id,
        name: product.name,
        is_variable_price: product.is_variable_price,
        image_emoji: product.image_emoji,
        quantity: Number(quantity) || 1,
        final_price: price,
        formatted_price: `R$ ${price.toFixed(2).replace('.', ',')}`,
        ncm_code: product.ncm_code
      };

      res.json(item);
    } catch (err) {
      res.status(500).json({ error: 'Erro ao processar item manual', details: err.message });
    }
  }

  /**
   * Invokes the CopilotSkill to parse natural language or short codes
   * (e.g., "açaí 18.50 + coke", "2 cocas + trufado 22")
   */
  async processCopilotCommand(req, res) {
    try {
      const { command } = req.body;
      if (!command) {
        return res.status(400).json({ error: 'Comando não fornecido.' });
      }

      const outcome = await orchestrator.runSkill('CopilotSkill', { command });
      if (!outcome.success) {
        return res.status(400).json({ error: outcome.error });
      }

      res.json({
        success: true,
        result: outcome.data,
        logId: outcome.logId,
        executionTime: outcome.executionTime
      });
    } catch (err) {
      res.status(500).json({ error: 'Erro ao executar CopilotSkill', details: err.message });
    }
  }

  /**
   * Returns recent agent execution logs
   */
  getAgentLogs(req, res) {
    try {
      const logs = orchestrator.getRecentLogs(30);
      res.json(logs);
    } catch (err) {
      res.status(500).json({ error: 'Erro ao consultar logs de agentes', details: err.message });
    }
  }
}

module.exports = new POSController();
