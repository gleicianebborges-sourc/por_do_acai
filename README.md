# 🍧 Pôr do Açaí - Sistema PDV (Frente de Caixa) & Emissão NFC-e

Aplicação Web Full-Stack completa para Ponto de Venda (PDV) de Açaiteria com integração de balança de pesagem em tempo real (protocolos Toledo / Filizola) e emissão automatizada de Cupom Fiscal Eletrônico (**NFC-e - Modelo 65**) integrado à SEFAZ.

---

## 🏛️ 1. Arquitetura MVC (Model-View-Controller)

O sistema segue rigorosamente o padrão arquitetural MVC:

```
c:\gbborges-açai\
├── database/
│   └── schema.sql                   # Definição DDL do SQLite / PostgreSQL
├── src/
│   ├── config/
│   │   └── database.js              # Conexão SQLite (node:sqlite) e seeding
│   ├── models/                      # MODEL: Entidades e persistência de dados
│   │   ├── Product.js               # Catálogo de produtos (por peso e unitários)
│   │   ├── Sale.js                  # Transações de venda e cabeçalho do pedido
│   │   ├── SaleItem.js              # Itens da venda com tara e preço calculado
│   │   └── TaxCoupon.js             # Cupons fiscais eletrônicos (NFC-e / SEFAZ)
│   ├── controllers/                 # CONTROLLER: Regras de negócio e integrações
│   │   ├── POSController.js         # Dedução de tara, cálculo líquido e catálogo
│   │   ├── ScaleIntegrationController.js # Emulação da balança Toledo/Filizola (SSE & WS)
│   │   ├── CheckoutController.js    # Validação do carrinho, pagamento e troco
│   │   └── TaxController.js         # Emissão de NFC-e com chave 44 dígitos e SEFAZ
│   ├── routes/
│   │   └── apiRoutes.js             # Rotas REST da aplicação
│   └── views/                       # VIEW: Interface do usuário (UI Touch)
│       ├── index.html               # Tela principal do PDV split-screen
│       ├── css/
│       │   └── style.css            # Design System responsivo Vanilla CSS e @media print
│       └── js/
│           ├── scale.js             # Cliente WebSocket/SSE da balança
│           ├── checkout.js          # Modal de checkout e calculadora de troco
│           ├── receipt.js           # Renderização e impressão do cupom NFC-e
│           └── app.js               # Orquestrador do PDV e carrinho
├── server.js                        # Servidor HTTP Express & WebSocket
└── package.json                     # Dependências e scripts
```

---

## 💾 2. Modelos do Banco de Dados (Models)

### `Product`
- `id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `name`: TEXT (ex: *Açaí Tradicional Especial*, *Água Mineral*)
- `category`: TEXT (`weight_based` | `unit_based`)
- `price_per_unit`: REAL (Preço por KG ou preço unitário)
- `ncm_code`: TEXT (Código Fiscal Mercosul, ex: `0811.90.00` para açaí)
- `tare_weight`: REAL (Tara padrão do recipiente em kg)
- `image_emoji`: TEXT (Ícone visual)

### `Sale`
- `id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `timestamp`: DATETIME (Data/hora da venda)
- `total_amount`: REAL (Valor total da compra)
- `payment_method`: TEXT (`PIX`, `CREDIT_CARD`, `DEBIT_CARD`, `CASH`)
- `amount_received`: REAL (Valor entregue pelo cliente)
- `change_due`: REAL (Troco devolvido)
- `status`: TEXT (`COMPLETED`, `CANCELLED`, `PENDING`)

### `SaleItem`
- `id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `sale_id`: INTEGER (Chave estrangeira referenciando `sales.id`)
- `product_id`: INTEGER (Chave estrangeira referenciando `products.id`)
- `quantity_or_weight`: REAL (Peso em kg ou quantidade inteira)
- `calculated_price`: REAL (Preço calculado final)
- `tare_applied`: REAL (Tara descontada da embalagem)

### `TaxCoupon`
- `id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `sale_id`: INTEGER UNIQUE (Referência à venda)
- `access_key`: TEXT UNIQUE (Chave de Acesso de 44 dígitos no padrão SEFAZ)
- `sefaz_status`: TEXT (`AUTORIZADO`)
- `protocol_number`: TEXT (Número do protocolo SEFAZ)
- `receipt_url`: TEXT (Link do QR-Code da SEFAZ para consulta)
- `xml_payload`: TEXT (XML da NFC-e assinado digitalmente)

---

## ⚖️ 3. Controladores e Regras de Negócio (Controllers)

1. **`POSController`**:
   - Dedução de tara do peso bruto para obtenção do peso líquido:
     $$\text{Peso Líquido} = \max(0, \text{Peso Bruto} - \text{Tara})$$
   - Cálculo do preço por quilo:
     $$\text{Preço Final} = \text{Peso Líquido} \times \text{Preço por KG}$$
   - Suporte a taras rápidas de recipientes comerciais (Copos 300ml, 500ml, 700ml, Tigelas).

2. **`ScaleIntegrationController`**:
   - Emulação de comunicação serial RS-232 contínua padrão **Toledo Prix 3 / Filizola Platina** (`STX [Status] [Peso] ETX`).
   - Transmissão em tempo real bidirecional via **WebSocket (`/ws/scale`)** com fallback resiliente para **Server-Sent Events (`/api/scale/stream`)**.
   - Comandos de Tara (`/api/scale/tare`) e Zerar (`/api/scale/zero`).

3. **`CheckoutController`**:
   - Validação dos itens e recálculo com integridade no servidor.
   - Cálculo automático de troco em pagamentos em dinheiro vivo.
   - Persistência atômica da venda e dos itens em transação no SQLite.

4. **`TaxController`**:
   - Disparo automático pós-checkout.
   - Geração de Chave de Acesso de **44 dígitos numéricos** com cálculo de Dígito Verificador por **Módulo 11**:
     - *UF (15) + AAMM + CNPJ (14d) + Modelo (65) + Série (001) + Número + Tipo Emissão + Código Numérico + DV*
   - Protocolo de autorização da SEFAZ e montagem do payload XML de NFC-e.
   - Cálculo de tributos aproximados incidentes (Lei Federal 12.741/2012 - IBPT).

---

## 🖥️ 4. Telas e Interface do Usuário (Views)

- **Frente de Caixa (PDV) Split-Screen**:
  - **Lado Esquerdo**: Visor digital de balança fluorescente em fonte grande (estilo Toledo VFD), alertas de estabilidade/tara, botões de tara de copo (300ml, 500ml, 700ml, tigela), seletor de base de açaí (Tradicional, Zero, Trufado, Cupuaçu) e grade rápida de produtos unitários (bebidas, coberturas, casquinhas).
  - **Lado Direito**: Carrinho dinâmico de compras com resumo de itens, cálculo de tributos, valor total em destaque e botão de finalização rápida.
- **Modal de Checkout**:
  - Seleção de formas de pagamento: **PIX** (com QR Code dinâmico e Copia e Cola), **Cartão de Crédito**, **Cartão de Débito** e **Dinheiro** (com calculadora de troco e atalhos de cédulas: R$ 10, R$ 20, R$ 50, R$ 100, R$ 200).
- **Visualizador e Impressão de Cupom (NFC-e)**:
  - Formato padrão DANFE NFC-e brasileiro com dados fiscais completos, itens, chave de acesso de 44 dígitos, QR Code de consulta e folha de estilo `@media print` otimizada para bobinas térmicas de 58mm/80mm ou A4.
- **Histórico de Vendas**:
  - Consulta de pedidos anteriores e reimpressão de qualquer cupom fiscal emitido.

---

## 🚀 5. Como Executar

### Pré-requisitos
- Node.js versão 18+ (recomendado Node.js 20 ou 22+)

### Instalação e Execução
```bash
# Instalar dependências
npm install

# Iniciar servidor em modo de produção
npm start

# Ou iniciar em modo de desenvolvimento com recarregamento automático
npm run dev
```

Acesse o sistema no navegador:
👉 **`http://localhost:3000`**
