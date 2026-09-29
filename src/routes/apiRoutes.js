const express = require('express');
const router = express.Router();

const posController = require('../controllers/POSController');
const checkoutController = require('../controllers/CheckoutController');

// Product & Manual Pricing Routes
router.get('/products', (req, res) => posController.getProducts(req, res));
router.post('/pos/manual-item', (req, res) => posController.buildManualItem(req, res));

// Agent / Copilot Skill Routes
router.post('/copilot/parse', (req, res) => posController.processCopilotCommand(req, res));
router.get('/agent-logs', (req, res) => posController.getAgentLogs(req, res));

// Checkout & Sales Routes
router.post('/checkout', (req, res) => checkoutController.processCheckout(req, res));
router.get('/sales', (req, res) => checkoutController.getSalesHistory(req, res));

module.exports = router;
