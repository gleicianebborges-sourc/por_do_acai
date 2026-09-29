/**
 * ScaleIntegrationController
 * Simulates integration with serial-port continuous weight stream (Toledo Prix 3, Filizola, Balmak)
 * Provides real-time weight broadcasting via Server-Sent Events (SSE) and WebSockets.
 */

class ScaleIntegrationController {
  constructor() {
    this.grossWeight = 0.000; // in kilograms (e.g., 0.550 kg)
    this.tareWeight = 0.000;  // in kilograms (e.g., 0.020 kg for cup)
    this.isStable = true;
    this.scaleModel = 'Toledo Prix 3 Fit (RS-232 / 9600-8-N-1)';
    this.subscribers = new Set();
    this.wsClients = new Set();

    // Start background micro-jitter simulation to mimic physical load cell dynamics
    this._startScaleSimulator();
  }

  get netWeight() {
    const net = Math.max(0, this.grossWeight - this.tareWeight);
    return Math.round(net * 1000) / 1000;
  }

  getScaleStatus() {
    return {
      grossWeight: Math.round(this.grossWeight * 1000) / 1000,
      tareWeight: Math.round(this.tareWeight * 1000) / 1000,
      netWeight: this.netWeight,
      isStable: this.isStable,
      unit: 'kg',
      scaleModel: this.scaleModel,
      rawProtocolString: this._formatToledoString(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generates standard Toledo Protocol P03 continuous serial transmission frame
   * Format: [STX][STATUS][WEIGHT 5 DIGITS][ETX]
   */
  _formatToledoString() {
    const weightGrams = Math.round(this.netWeight * 1000).toString().padStart(5, '0');
    return `\x02${this.isStable ? 'S' : 'U'}${weightGrams}\x03`;
  }

  /**
   * Simulates weight placement on the scale platform
   */
  setWeight(grossKg, stable = true) {
    this.grossWeight = Math.max(0, Math.round(Number(grossKg) * 1000) / 1000);
    this.isStable = Boolean(stable);
    this.broadcast();
    return this.getScaleStatus();
  }

  /**
   * Applies Tare: deducts container weight or current gross weight
   */
  applyTare(customTareKg = null) {
    if (customTareKg !== null && !isNaN(customTareKg)) {
      this.tareWeight = Math.max(0, Math.round(Number(customTareKg) * 1000) / 1000);
    } else {
      // Standard scale tare button behavior: current gross becomes tare
      this.tareWeight = this.grossWeight;
    }
    this.isStable = true;
    this.broadcast();
    return this.getScaleStatus();
  }

  /**
   * Resets tare to zero
   */
  resetTare() {
    this.tareWeight = 0.000;
    this.broadcast();
    return this.getScaleStatus();
  }

  /**
   * Zeroes the scale completely
   */
  zeroScale() {
    this.grossWeight = 0.000;
    this.tareWeight = 0.000;
    this.isStable = true;
    this.broadcast();
    return this.getScaleStatus();
  }

  /**
   * Micro-fluctuations mimicking real load cell sensors
   */
  _startScaleSimulator() {
    setInterval(() => {
      // If there is active weight, give a realistic ±0.001kg stability settling
      if (this.grossWeight > 0.005) {
        const jitter = (Math.random() - 0.5) * 0.002;
        const previousGross = this.grossWeight;
        this.grossWeight = Math.max(0, Math.round((previousGross + jitter) * 1000) / 1000);
        this.isStable = true;
        this.broadcast();
      }
    }, 2500);
  }

  broadcast() {
    const payload = JSON.stringify(this.getScaleStatus());

    // Broadcast to SSE clients
    for (const res of this.subscribers) {
      res.write(`data: ${payload}\n\n`);
    }

    // Broadcast to WebSocket clients
    for (const ws of this.wsClients) {
      if (ws.readyState === 1 /* OPEN */) {
        ws.send(payload);
      }
    }
  }

  // HTTP Handler methods
  getCurrent(req, res) {
    res.json(this.getScaleStatus());
  }

  postSimulate(req, res) {
    const { grossWeight, isStable = true } = req.body;
    if (grossWeight === undefined) {
      return res.status(400).json({ error: 'Campo grossWeight é obrigatório (em kg).' });
    }
    const status = this.setWeight(grossWeight, isStable);
    res.json({ message: 'Peso simulado na balança atualizado', status });
  }

  postTare(req, res) {
    const { tareWeight } = req.body || {};
    const status = this.applyTare(tareWeight !== undefined ? Number(tareWeight) : null);
    res.json({ message: 'Tara aplicada com sucesso', status });
  }

  postZero(req, res) {
    const status = this.zeroScale();
    res.json({ message: 'Balança zerada', status });
  }

  streamSSE(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    res.write(`data: ${JSON.stringify(this.getScaleStatus())}\n\n`);
    this.subscribers.add(res);

    req.on('close', () => {
      this.subscribers.delete(res);
    });
  }

  registerWebSocket(ws) {
    this.wsClients.add(ws);
    ws.send(JSON.stringify(this.getScaleStatus()));

    ws.on('close', () => {
      this.wsClients.delete(ws);
    });

    ws.on('message', (msg) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data.action === 'TARE') this.applyTare(data.tareWeight);
        if (data.action === 'ZERO') this.zeroScale();
        if (data.action === 'SET_WEIGHT') this.setWeight(data.grossWeight);
      } catch (e) {
        // ignore malformed messages
      }
    });
  }
}

// Singleton instance to share state across HTTP and WebSocket
const scaleIntegrationController = new ScaleIntegrationController();
module.exports = scaleIntegrationController;
