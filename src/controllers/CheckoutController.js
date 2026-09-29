const Sale = require('../models/Sale');
const Product = require('../models/Product');
const orchestrator = require('../services/SkillOrchestrator');

/**
 * CheckoutController
 * Persists the finalized transaction, validates payments, calculates change,
 * and broadcasts events to the Skill Orchestrator (triggering FiscalTaxSkill and DigitalReceiptSkill).
 */
class CheckoutController {
  async processCheckout(req, res) {
    try {
      const { items, paymentMethod, amountReceived = 0.0, customerPhone = null } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'O carrinho está vazio.' });
      }

      const validPaymentMethods = ['PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH'];
      if (!paymentMethod || !validPaymentMethods.includes(paymentMethod)) {
        return res.status(400).json({
          error: `Forma de pagamento inválida. Aceitas: ${validPaymentMethods.join(', ')}`
        });
      }

      // Re-verify items and calculate total amount
      let calculatedTotal = 0.0;
      const verifiedItems = [];

      for (const item of items) {
        const product = Product.findById(item.product_id);
        if (!product) {
          return res.status(400).json({ error: `Produto ID ${item.product_id} não existe no catálogo.` });
        }

        const finalPrice = Math.round(Number(item.final_price) * 100) / 100;
        if (finalPrice <= 0) {
          return res.status(400).json({ error: `Preço inválido para o produto ${product.name}` });
        }

        const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
        calculatedTotal += finalPrice;

        verifiedItems.push({
          product_id: product.id,
          product_name: product.name,
          final_price: finalPrice,
          quantity: qty
        });
      }

      calculatedTotal = Math.round(calculatedTotal * 100) / 100;

      // Validate cash payment & change calculation
      let changeDue = 0.0;
      let finalAmountReceived = Number(amountReceived || calculatedTotal);

      if (paymentMethod === 'CASH') {
        if (finalAmountReceived < calculatedTotal) {
          return res.status(400).json({
            error: `Valor recebido em dinheiro (R$ ${finalAmountReceived.toFixed(2)}) é inferior ao total (R$ ${calculatedTotal.toFixed(2)}).`
          });
        }
        changeDue = Math.round((finalAmountReceived - calculatedTotal) * 100) / 100;
      } else {
        finalAmountReceived = calculatedTotal;
      }

      // Persist Sale in relational database
      const sale = Sale.create({
        total_amount: calculatedTotal,
        payment_method: paymentMethod,
        amount_received: finalAmountReceived,
        change_due: changeDue,
        customer_phone: customerPhone,
        items: verifiedItems
      });

      // Broadcast event to Skill Orchestrator (triggers FiscalTaxSkill + DigitalReceiptSkill hooks)
      const orchestratorResult = await orchestrator.handleCheckout(sale, verifiedItems);

      res.status(201).json({
        success: true,
        message: 'Venda finalizada e habilidades de inteligência executadas com sucesso!',
        sale,
        changeDue,
        taxResult: orchestratorResult.taxResult.data,
        agentLogId: orchestratorResult.taxResult.logId
      });
    } catch (err) {
      console.error('CheckoutController execution error:', err);
      res.status(500).json({ error: 'Erro ao processar checkout', details: err.message });
    }
  }

  getSalesHistory(req, res) {
    try {
      const sales = Sale.findAll(50);
      res.json(sales);
    } catch (err) {
      res.status(500).json({ error: 'Erro ao carregar histórico de vendas', details: err.message });
    }
  }
}

module.exports = new CheckoutController();
