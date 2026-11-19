const BASE = process.env.REACT_APP_BINANCE_WS;

class MarketStream {
  constructor() {
    this.subs = new Map();
    this.ws = null;
    this.id = 1;
    this.open = false;
    this.listeners = new Set();
  }

  
  ensure() {
    if (this.ws) return;
    const ws = new WebSocket(`${BASE}/stream`);
    this.ws = ws;
    ws.onopen = () => {
      this.open = true;
      this.emitStatus();
      const params = [...this.subs.keys()];
      if (params.length) this.send("SUBSCRIBE", params);
    };
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (!m.stream) return;
      const set = this.subs.get(m.stream);
      if (set) set.forEach((cb) => cb(m.data));
    };
    ws.onclose = () => {
      this.ws = null;
      this.open = false;
      this.emitStatus();
      setTimeout(() => this.subs.size && this.ensure(), 1500);
    };
    ws.onerror = () => ws.close();
  }
  
  send(method, params) {
    if (this.ws && this.open) this.ws.send(JSON.stringify({ method, params, id: this.id++ }));
  }
  
  emitStatus() { this.listeners.forEach((l) => l(this.open)); }
  onStatus(fn) { this.listeners.add(fn);
    fn(this.open); return () => this.listeners.delete(fn); }
  
  subscribe(stream, cb) {
    this.ensure();
    let set = this.subs.get(stream);
    if (!set) {
      set = new Set();
      this.subs.set(stream, set);
      this.send("SUBSCRIBE", [stream]);
    }
    set.add(cb);
    return () => {
      set.delete(cb);
      if (!set.size) {
        this.subs.delete(stream);
        this.send("UNSUBSCRIBE", [stream]);
      }
    };
  }
}

export const market = new MarketStream();
