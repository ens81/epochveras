import { hexA, timeToLogical } from "./chartmath";
import { fmtPrice } from "./api";

const seg = (ctx, x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
const valid = (...v) => v.every((x) => x !== null && x !== undefined && !Number.isNaN(x));

function label(ctx, text, x, y, color, above, size = 10) {
  ctx.font = `600 ${size}px -apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = above ? "bottom" : "top";
  text.split("\n").forEach((t, k, arr) => ctx.fillText(t, x, above ? y - 4 - (arr.length - 1 - k) * (size + 2) : y + 4 + k * (size + 2)));
}

// Pine label.style_label_down / style_label_up: filled box with a pointer towards the bar
function pinLabel(ctx, text, x, y, color, above, size = 10) {
  ctx.font = `600 ${size}px -apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif`;
  const w = Math.max(size + 6, ctx.measureText(text).width + 8), hh = size + 6, tip = 5;
  const top = above ? y - tip - hh - 2 : y + tip + 2;
  ctx.fillStyle = color;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x - w / 2, top, w, hh, 2); else ctx.rect(x - w / 2, top, w, hh);
  ctx.fill();
  ctx.beginPath();
  if (above) { ctx.moveTo(x - tip, top + hh); ctx.lineTo(x + tip, top + hh); ctx.lineTo(x, top + hh + tip); }
  else { ctx.moveTo(x - tip, top); ctx.lineTo(x + tip, top); ctx.lineTo(x, top - tip); }
  ctx.fill();
  ctx.fillStyle = "#000";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, x, top + hh / 2 + 0.5);
}

export function drawCloud(ctx, H, ind, c) {
  const { x, y, from, to } = H;
  const a = Math.max(0, Math.floor(from) - 1), b = Math.min(H.n - 1, Math.ceil(to) + 1);
  if (c.showEmaCloud && b > a) {
    ctx.beginPath();
    let started = false, back = [];
    for (let i = a; i <= b; i++) {
      const f = ind.fast[i], s = ind.slow[i];
      if (!valid(f, s)) continue;
      const xi = x(i);
      if (!started) { ctx.moveTo(xi, y(f)); started = true; } else ctx.lineTo(xi, y(f));
      back.push([xi, y(s)]);
    }
    for (let k = back.length - 1; k >= 0; k--) ctx.lineTo(back[k][0], back[k][1]);
    ctx.closePath();
    ctx.fillStyle = hexA(c.cloudColor, c.cloudOpacity);
    if (started) ctx.fill();
  }
}

export function drawEpoch(ctx, H, ind, c) {
  if (!ind) return;
  const { x, y, from, to, w, h } = H;
  const a = Math.max(0, Math.floor(from) - 1), b = Math.min(H.n - 1, Math.ceil(to) + 1);
  if (c.showTriangles) {
    for (let i = a; i <= b; i++) {
      const t = ind.tri[i];
      if (!t) continue;
      const xi = x(i), yy = t > 0 ? h - 6 : 6, s = 3.5;
      ctx.fillStyle = t > 0 ? c.triUpColor : c.triDownColor;
      ctx.beginPath();
      if (t > 0) { ctx.moveTo(xi, yy - s); ctx.lineTo(xi - s, yy + s * 0.6); ctx.lineTo(xi + s, yy + s * 0.6); }
      else { ctx.moveTo(xi, yy + s); ctx.lineTo(xi - s, yy - s * 0.6); ctx.lineTo(xi + s, yy - s * 0.6); }
      ctx.fill();
    }
  }
  ctx.lineWidth = 1;
  ind.tls.forEach((l) => { ctx.strokeStyle = l.color; seg(ctx, x(l.x1), y(l.y1), x(l.x2), y(l.y2)); });
  ind.sfp.forEach((s) => {
    const col = s.bear ? c.sfpBearColor : c.sfpBullColor;
    if (s.x2 < from - 600 || s.bx > to + 5) return;
    ctx.strokeStyle = col; ctx.lineWidth = 1;
    if (c.sfpSwingLine) seg(ctx, x(s.bx), y(s.sw), x(s.x2), y(s.sw));
    if (c.sfpConfLine) { ctx.setLineDash([2, 3]); seg(ctx, x(s.oppB), y(s.opp), x(s.x2), y(s.opp)); ctx.setLineDash([]); }
    if (c.sfpWick) { ctx.strokeStyle = hexA(col, 0.5); ctx.lineWidth = 3; seg(ctx, x(s.wickX), y(s.wickY), x(s.wickX), y(s.sw)); ctx.lineWidth = 1; }
    if (c.sfpLabel) label(ctx, s.label.replace(" ", "\n"), x(s.wickX), y(s.wickY), col, s.bear);
    s.extra.forEach((e) => label(ctx, e.text, x(e.x), y(e.y), col, s.bear, 11));
  });
  ind.div.lines.forEach((l) => { ctx.strokeStyle = l.color; ctx.lineWidth = 1.5; seg(ctx, x(l.i1), y(l.p1), x(l.i2), y(l.p2)); });
  ind.div.labels.forEach((l) => {
    if (l.i < from - 2 || l.i > to + 2) return;
    pinLabel(ctx, l.text, x(l.i), y(l.price), l.color, l.dir > 0, l.small ? 9 : 10);
  });
  ctx.lineWidth = 1;
  void w;
}

export function positionStats(d, bars, iv) {
  const [p0, p1, p2] = d.points;
  const long = d.type === "long";
  const i0 = Math.ceil(timeToLogical(bars, p0.time, iv)), i1 = Math.floor(timeToLogical(bars, p1.time, iv));
  let hit = 0, cur = null, lastI = null;
  for (let i = Math.max(0, i0); i <= Math.min(i1, bars.length - 1); i++) {
    const b = bars[i];
    lastI = i;
    cur = b.close;
    if (!hit) {
      const tgt = long ? b.high >= p1.price : b.low <= p1.price;
      const stp = long ? b.low <= p2.price : b.high >= p2.price;
      if (stp) { hit = -1; cur = p2.price; break; }
      if (tgt) { hit = 1; cur = p1.price; break; }
    }
  }
  return { hit, cur, lastI };
}

export function drawDrawings(ctx, H, list, selectedId, prec) {
  const { y, w, px } = H;
  list.forEach((d) => {
    const sel = d.id === selectedId;
    const st = d.style || {};
    if (d.type === "trendline") {
      const a = px(d.points[0]), b = px(d.points[1]);
      ctx.strokeStyle = st.color || "#D1D4DC"; ctx.lineWidth = st.width || 2;
      seg(ctx, a.x, a.y, b.x, b.y);
      if (sel) [a, b].forEach((p) => handle(ctx, p));
    } else if (d.type === "hray") {
      const a = px(d.points[0]);
      ctx.strokeStyle = st.color || "#F5A623"; ctx.lineWidth = st.width || 1;
      seg(ctx, a.x, a.y, w, a.y);
      if (sel) handle(ctx, a);
    } else if (d.type === "long" || d.type === "short") {
      drawPosition(ctx, H, d, sel, prec);
    }
  });
  void y;
}

function handle(ctx, p) {
  ctx.fillStyle = "#000"; ctx.strokeStyle = "#D1D4DC"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
}

function drawPosition(ctx, H, d, sel, prec) {
  const { px, x, y, bars, iv } = H;
  const [p0, p1, p2] = d.points;
  const a = px(p0), x1 = px(p1).x, yT = y(p1.price), yS = y(p2.price), yE = a.y;
  const long = d.type === "long";
  const { hit, cur, lastI } = positionStats(d, bars, iv);
  const W = x1 - a.x;
  ctx.fillStyle = hexA("#089981", hit === 1 ? 0.32 : 0.16); ctx.fillRect(a.x, Math.min(yE, yT), W, Math.abs(yT - yE));
  ctx.fillStyle = hexA("#F23645", hit === -1 ? 0.32 : 0.16); ctx.fillRect(a.x, Math.min(yE, yS), W, Math.abs(yS - yE));
  if (cur !== null && lastI !== null) {
    const yc = y(cur), xe = Math.min(x(lastI), x1);
    const good = long ? cur >= p0.price : cur <= p0.price;
    ctx.fillStyle = hexA(good ? "#089981" : "#F23645", 0.45);
    ctx.fillRect(a.x, Math.min(yE, yc), xe - a.x, Math.abs(yc - yE));
    ctx.strokeStyle = good ? "#089981" : "#F23645"; ctx.setLineDash([3, 3]);
    seg(ctx, a.x, yE, xe, yc); ctx.setLineDash([]);
  }
  ctx.strokeStyle = "#787B86"; ctx.lineWidth = 1; seg(ctx, a.x, yE, x1, yE);
  const pct = (v) => ((v - p0.price) / p0.price) * 100;
  const rr = Math.abs(p1.price - p0.price) / Math.max(1e-12, Math.abs(p0.price - p2.price));
  const box = (t, yy, col) => {
    ctx.font = "600 10px -apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif";
    const tw = ctx.measureText(t).width + 10, cx = a.x + W / 2;
    ctx.fillStyle = col; ctx.fillRect(cx - tw / 2, yy - 8, tw, 16);
    ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(t, cx, yy);
  };
  box(`Hedef ${fmtPrice(p1.price, prec)} (${pct(p1.price).toFixed(2)}%)`, yT + (yT < yE ? -10 : 10), "#089981");
  box(`Stop ${fmtPrice(p2.price, prec)} (${pct(p2.price).toFixed(2)}%)`, yS + (yS > yE ? 10 : -10), "#F23645");
  if (sel) {
    box(`${long ? "LONG" : "SHORT"} ${fmtPrice(p0.price, prec)} · R/R ${rr.toFixed(2)}`, yE, "#1C1C1E");
    [a, { x: x1, y: yT }, { x: x1, y: yS }].forEach((p) => handle(ctx, p));
  }
}

export function drawRuler(ctx, H, r, prec, iv) {
  const a = H.px(r.a), b = H.px(r.b);
  const up = r.b.price >= r.a.price;
  ctx.fillStyle = hexA(up ? "#089981" : "#F23645", 0.18);
  ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  ctx.strokeStyle = up ? "#089981" : "#F23645"; ctx.lineWidth = 1;
  seg(ctx, a.x, a.y, b.x, b.y);
  const dp = r.b.price - r.a.price, pct = (dp / r.a.price) * 100;
  const bars = Math.round((r.b.time - r.a.time) / iv);
  const secs = Math.abs(r.b.time - r.a.time);
  const dur = secs >= 86400 ? `${(secs / 86400).toFixed(1)}g` : secs >= 3600 ? `${(secs / 3600).toFixed(1)}sa` : `${Math.round(secs / 60)}dk`;
  const t = `${fmtPrice(dp, prec)} (${pct.toFixed(2)}%) · ${bars} bar · ${dur}`;
  ctx.font = "600 11px -apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif";
  const tw = ctx.measureText(t).width + 14, cx = (a.x + b.x) / 2, cy = Math.max(a.y, b.y) + 16;
  ctx.fillStyle = up ? "#089981" : "#F23645"; ctx.fillRect(cx - tw / 2, cy - 10, tw, 20);
  ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(t, cx, cy);
}
