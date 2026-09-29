const BaseSkill = require('./BaseSkill');
const Product = require('../models/Product');

/**
 * CopilotSkill
 * Parses natural language and short-codes entered by the cashier
 * (e.g., "açaí 18.50 + coke", "2 aguas + acai 22,00", "trufado 19.90 + red bull")
 * into structured cart items with matching product IDs, quantities, and calculated prices.
 */
class CopilotSkill extends BaseSkill {
  constructor() {
    super('CopilotSkill', 'Assistente de comando rápido em linguagem natural para o caixa');
  }

  async run(context) {
    const { command } = context;
    if (!command || typeof command !== 'string' || !command.trim()) {
      throw new Error('Comando vazio fornecido ao Copilot.');
    }

    const products = Product.findAll();
    const rawSegments = command.split(/[\+\,\;]|\s+e\s+|\s+and\s+/i);
    const parsedItems = [];
    const unrecognized = [];

    for (let segment of rawSegments) {
      segment = segment.trim();
      if (!segment) continue;

      const itemParsed = this._parseSegment(segment, products);
      if (itemParsed) {
        parsedItems.push(itemParsed);
      } else {
        unrecognized.push(segment);
      }
    }

    if (parsedItems.length === 0 && unrecognized.length > 0) {
      throw new Error(`Não foi possível interpretar o comando: "${command}". Tente ex: "açaí 18.50 + coca"`);
    }

    return {
      originalCommand: command,
      parsedItems,
      unrecognized,
      itemsCount: parsedItems.length,
      estimatedTotal: Math.round(parsedItems.reduce((sum, i) => sum + i.final_price, 0) * 100) / 100
    };
  }

  _parseSegment(text, products) {
    const cleanText = text.toLowerCase().trim();

    // Check for quantity prefix, e.g., "2 aguas", "3 cocas"
    const qtyMatch = cleanText.match(/^(\d+)\s*x?\s+(.+)$/);
    let qty = 1;
    let desc = cleanText;

    if (qtyMatch) {
      qty = parseInt(qtyMatch[1], 10);
      desc = qtyMatch[2].trim();
    }

    // Check for price pattern (e.g., "18.50", "18,50", "22", "R$ 15,00")
    const priceMatch = desc.match(/(?:r\$)?\s*(\d+(?:[.,]\d{1,2})?)$/i);
    let manualPrice = null;
    let namePart = desc;

    if (priceMatch) {
      manualPrice = parseFloat(priceMatch[1].replace(',', '.'));
      namePart = desc.replace(priceMatch[0], '').trim();
    }

    // Attempt to match product in catalog
    let matchedProduct = null;

    // Direct alias mappings
    const aliases = {
      'acai': 'Açaí Tradicional',
      'açaí': 'Açaí Tradicional',
      'trufado': 'Açaí Trufado Especial',
      'cupuacu': 'Creme de Cupuaçu Puro',
      'cupuaçu': 'Creme de Cupuaçu Puro',
      'sorvete': 'Sorvete Artesanal Buffet',
      'coke': 'Coca-Cola Lata 350ml',
      'coca': 'Coca-Cola Lata 350ml',
      'coca-cola': 'Coca-Cola Lata 350ml',
      'guarana': 'Guaraná Antarctica 350ml',
      'guaraná': 'Guaraná Antarctica 350ml',
      'agua': 'Água Mineral sem Gás 500ml',
      'água': 'Água Mineral sem Gás 500ml',
      'agua gas': 'Água Mineral com Gás 500ml',
      'água com gás': 'Água Mineral com Gás 500ml',
      'red bull': 'Red Bull Energy 250ml',
      'energetico': 'Red Bull Energy 250ml',
      'nutella': 'Nutella Pura Dose Extra',
      'waffle': 'Casquinha Waffle Crocante',
      'casquinha': 'Casquinha Waffle Crocante',
      'pacoca': 'Paçoca Rolha Dose',
      'paçoca': 'Paçoca Rolha Dose',
      'suco': 'Suco Natural Laranja 300ml',
      'laranja': 'Suco Natural Laranja 300ml'
    };

    // If only a price was typed (e.g., "18.50" or "R$ 20"), default to Açaí Tradicional variable
    if (!namePart && manualPrice !== null) {
      matchedProduct = products.find(p => p.is_variable_price);
    } else {
      // Find by alias or name inclusion
      const targetName = aliases[namePart] || namePart;
      matchedProduct = products.find(p =>
        p.name.toLowerCase().includes(targetName.toLowerCase()) ||
        targetName.toLowerCase().includes(p.name.toLowerCase().slice(0, 5))
      );
    }

    if (!matchedProduct) return null;

    let finalPrice = 0.0;
    if (matchedProduct.is_variable_price) {
      finalPrice = manualPrice !== null ? manualPrice : (matchedProduct.default_price || 15.00);
    } else {
      finalPrice = Math.round((matchedProduct.default_price * qty) * 100) / 100;
    }

    return {
      product_id: matchedProduct.id,
      name: matchedProduct.name,
      is_variable_price: matchedProduct.is_variable_price,
      quantity: qty,
      unit_price: matchedProduct.is_variable_price ? finalPrice : matchedProduct.default_price,
      final_price: finalPrice,
      image_emoji: matchedProduct.image_emoji
    };
  }
}

module.exports = CopilotSkill;
