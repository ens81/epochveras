export function timeToLogical(bars, t, iv) {
  const n = bars.length;
  if (!n) return null;
  const last = bars[n - 1].time;
  if (t >= last) return n - 1 + (t - last) / iv;
  if (t <= bars[0].time) return (t - bars[0].time) / iv;
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (bars[mid].time <= t) lo = mid; else hi = mid;
  }
  return lo + (t - bars[lo].time) / (bars[hi].time - bars[lo].time);
}

export function logicalToTime(bars, l, iv) {
  const n = bars.length;
  if (l >= n - 1) return bars[n - 1].time + (l - (n - 1)) * iv;
  if (l <= 0) return bars[0].time + l * iv;
  const i = Math.floor(l);
  return bars[i].time + (l - i) * (bars[i + 1].time - bars[i].time);
}

export function setupCanvas(canvas, w, h) {
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return ctx;
}

export function hexA(hex, a) {
  if (!hex || hex[0] !== "#") return hex;
  const h = hex.length === 4 ? hex.slice(1).split("").map((c) => c + c).join("") : hex.slice(1, 7);
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function distToSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy;
  let t = L ? ((px - x1) * dx + (py - y1) * dy) / L : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
