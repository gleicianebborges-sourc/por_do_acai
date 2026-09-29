/**
 * scale.js
 * Client-side integration for Toledo/Filizola continuous serial weight stream.
 * Supports dual-transport: WebSocket with graceful fallback to Server-Sent Events (SSE).
 */

class ScaleClient {
  constructor() {
    this.grossWeight = 0.000;
    this.tareWeight = 0.000;
    this.netWeight = 0.000;
    this.isStable = true;
    this.unit = 'kg';
    this.ws = null;
    this.eventSource = null;
    this.listeners = [];

    this.initTransport();
  }

  onChange(callback) {
    this.listeners.push(callback);
  }

  notify() {
    for (const cb of this.listeners) {
      cb({
        grossWeight: this.grossWeight,
        tareWeight: this.tareWeight,
        netWeight: this.netWeight,
        isStable: this.isStable,
        unit: this.unit
      });
    }
  }

  initTransport() {
    // Attempt WebSocket connection
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/scale`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.updateState(data);
        } catch (e) {
          console.error('Error parsing scale WebSocket data', e);
        }
      };

      this.ws.onerror = () => {
        console.warn('Scale WebSocket error, fallback to SSE');
        this.fallbackSSE();
      };

      this.ws.onclose = () => {
        console.warn('Scale WebSocket closed');
      };
    } catch (e) {
      this.fallbackSSE();
    }
  }

  fallbackSSE() {
    if (this.eventSource) return;
    this.eventSource = new EventSource('/api/scale/stream');
    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.updateState(data);
      } catch (e) {
        console.error('Error parsing scale SSE data', e);
      }
    };
  }

  updateState(data) {
    this.grossWeight = Number(data.grossWeight || 0);
    this.tareWeight = Number(data.tareWeight || 0);
    this.netWeight = Number(data.netWeight || 0);
    this.isStable = Boolean(data.isStable);
    this.notify();
  }

  async sendTare(customTare = null) {
    try {
      const res = await fetch('/api/scale/tare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tareWeight: customTare })
      });
      const data = await res.json();
      if (data.status) this.updateState(data.status);
    } catch (e) {
      console.error('Failed to send tare command', e);
    }
  }

  async sendZero() {
    try {
      const res = await fetch('/api/scale/zero', { method: 'POST' });
      const data = await res.json();
      if (data.status) this.updateState(data.status);
    } catch (e) {
      console.error('Failed to zero scale', e);
    }
  }

  async setSimulatedWeight(grossKg) {
    try {
      const res = await fetch('/api/scale/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grossWeight: grossKg })
      });
      const data = await res.json();
      if (data.status) this.updateState(data.status);
    } catch (e) {
      console.error('Failed to set simulated weight', e);
    }
  }
}

// Global instance
window.scaleClient = new ScaleClient();
