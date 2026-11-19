import { ema, rsi, maByType, pivotHigh, pivotLow, pivotTrendlines, atr } from "./ta";

export const EPOCH_DEFAULTS = {
  enabled: true,
  showEma3: true, ema1Len: 100, ema2Len: 200, ema3Len: 300, ema1Color: "#FFEB3B", ema2Color: "#2962FF", ema3Color: "#9E9E9E",
  pivotBarColor: true, pivLeft: 10, pivRight: 10, bullBarColor: "#4CAF50", bearBarColor: "#FF5252",
  emaFast: 38, emaSlow: 62, showEmaCloud: true, cloudColor: "#B2B5BE", cloudOpacity: 0.5, emaUpColor: "#4CAF50", emaDownColor: "#FF5252",
  showYellow: true, yellowColor: "#FFEB3B", showAqua: true, aquaColor: "#00BCD4",
  showTriangles: true, triUpColor: "#4CAF50", triDownColor: "#FF5252",
  showArrows: true, arrowUpColor: "#00E676", arrowDownColor: "#FF5252",
  showTrendlines: true, tl1Period: 30, tl1Num: 5, tl2Period: 20, tl2Num: 3,
  tl1UpColor: "#00E676", tl1DownColor: "#FF5252", tl2UpColor: "#2962FF", tl2DownColor: "#FF9800",
  showSfp: true, sfpLen: 5, sfpRight: 1, sfpBull: true, sfpBear: true, sfpSwingLine: true, sfpConfLine: true, sfpWick: true, sfpLabel: true,
  sfpBullColor: "#089981", sfpBearColor: "#F23645",
  showMtf: true, freshBars: 5,
  showDivergence: true, rsiLen: 14, maType: "sma", maLen: 200, zigzagLen: 13, showPivotLabels: false,
};


export const EPOCH_SCHEMA = [
  ["EMA 100/200/300", [["showEma3", "Göster", "bool"], ["ema1Len", "EMA 1", "int"], ["ema1Color", "", "color"], ["ema2Len", "EMA 2", "int"], ["ema2Color", "", "color"], ["ema3Len", "EMA 3", "int"], ["ema3Color", "", "color"]]],
  ["EMA Bulutu", [["emaFast", "Hızlı EMA", "int"], ["emaSlow", "Yavaş EMA", "int"], ["showEmaCloud", "Bulut", "bool"], ["cloudColor", "Bulut rengi", "color"], ["cloudOpacity", "Bulut opaklık", "float"], ["emaUpColor", "Yükseliş", "color"], ["emaDownColor", "Düşüş", "color"]]],
  ["Mum Renkleri", [["showYellow", "Sarı mum (agresif)", "bool"], ["yellowColor", "", "color"], ["showAqua", "Mavi mum (konservatif)", "bool"], ["aquaColor", "", "color"]]],
  ["Pivot Kırılımı", [["pivotBarColor", "Bar rengi", "bool"], ["pivLeft", "Sol bar", "int"], ["pivRight", "Sağ bar", "int"], ["bullBarColor", "Long", "color"], ["bearBarColor", "Short", "color"]]],
  ["İşaretler", [["showTriangles", "Alt/üst üçgenler", "bool"], ["triUpColor", "", "color"], ["triDownColor", "", "color"], ["showArrows", "Giriş okları", "bool"], ["arrowUpColor", "", "color"], ["arrowDownColor", "", "color"]]],
  ["Trendline", [["showTrendlines", "Göster", "bool"], ["tl1Period", "Pivot periyot 1", "int"], ["tl1Num", "Pivot sayısı 1", "int"], ["tl1UpColor", "Yükselen 1", "color"], ["tl1DownColor", "Düşen 1", "color"], ["tl2Period", "Pivot periyot 2", "int"], ["tl2Num", "Pivot sayısı 2", "int"], ["tl2UpColor", "Yükselen 2", "color"], ["tl2DownColor", "Düşen 2", "color"]]],
  ["SFP", [["showSfp", "Göster", "bool"], ["sfpLen", "Swings", "int"], ["sfpRight", "Right Bars", "int"], ["sfpBull", "Bullish SFP", "bool"], ["sfpBear", "Bearish SFP", "bool"], ["sfpSwingLine", "Swing çizgisi", "bool"], ["sfpConfLine", "Onay çizgisi", "bool"], ["sfpWick", "Fitil", "bool"], ["sfpLabel", "Etiket", "bool"], ["sfpBullColor", "Bullish", "color"], ["sfpBearColor", "Bearish", "color"], ["showMtf", "MTF tabloları", "bool"], ["freshBars", "SFP taze bar", "int"]]],
  ["RSI Divergence", [["showDivergence", "Göster", "bool"], ["rsiLen", "RSI uzunluk", "int"], ["maType", "MA tipi", "select", ["sma", "ema", "rma", "hma", "wma", "vwma"]], ["maLen", "MA uzunluk", "int"], ["zigzagLen", "Zigzag uzunluk", "int"], ["showPivotLabels", "Pivot etiketleri", "bool"]]],
];

export function pivotState(bars, L, R) {
  const close = bars.map((b) => b.close);
  const ph = pivotHigh(bars.map((b) => b.high), L, R), pl = pivotLow(bars.map((b) => b.low), L, R);
  const states = new Array(bars.length).fill(0);
  let h = 0, l = 0, ph1 = 0, pl1 = 0, st = 0;
  for (let i = 0; i < bars.length; i++) {
    ph1 = h; pl1 = l;
    if (!Number.isNaN(ph[i])) h = ph[i];
    if (!Number.isNaN(pl[i])) l = pl[i];
    if (i > 0 && close[i] > h && close[i - 1] <= ph1) st = 1;
    if (i > 0 && close[i] < l && close[i - 1] >= pl1) st = -1;
    states[i] = st;
  }
  return states;
}

export function sfpState(bars, len, right, fresh) {
  const ph = pivotHigh(bars.map((b) => b.high), len, right), pl = pivotLow(bars.map((b) => b.low), len, right);
  let sh = NaN, sl = NaN, lastBar = null, state = 0;
  for (let i = 0; i < bars.length; i++) {
    if (!Number.isNaN(ph[i])) sh = ph[i];
    if (!Number.isNaN(pl[i])) sl = pl[i];
    const b = bars[i];
    if (b.high > sh && b.open < sh && b.close < sh) { lastBar = i; state = -1; }
    if (b.low < sl && b.open > sl && b.close > sl) { lastBar = i; state = 1; }
  }
  return lastBar !== null && bars.length - 1 - lastBar <= fresh ? state : 0;
}

function computeSfp(bars, c) {
  const n = bars.length, out = [];
  const run = (bear) => {
    const src = bars.map((b) => (bear ? b.high : b.low));
    const piv = bear ? pivotHigh(src, c.sfpLen, c.sfpRight) : pivotLow(src, c.sfpLen, c.sfpRight);
    let swing = { bix: 0, prc: NaN }, cur = null;
    for (let i = 0; i < n; i++) {
      const b = bars[i];
      if (!Number.isNaN(piv[i])) swing = { bix: i - c.sfpRight, prc: piv[i] };
      const sw = swing.prc, bx = swing.bix;
      const hit = bear ? b.high > sw && b.open < sw && b.close < sw : b.low < sw && b.open > sw && b.close > sw;
      if (hit) {
        let opp = sw, oppB = i;
        for (let k = 1; k <= i - bx - 1; k++) {
          const v = bear ? bars[i - k].low : bars[i - k].high;
          if (bear ? v < opp : v > opp) { opp = v; oppB = i - k; }
        }
        if (cur && !cur.confirmed) out.splice(out.indexOf(cur), 1);
        cur = { bear, sw, bx, opp, oppB, x2: i, wickX: i, wickY: bear ? b.high : b.low, label: "SFP", extra: [], active: true, confirmed: false };
        out.push(cur);
      }
      if (cur && cur.active && !cur.confirmed) {
        cur.x2 = i;
        if (bear ? b.close < cur.opp : b.close > cur.opp) {
          cur.confirmed = true;
          if (cur.wickX === i) cur.label = bear ? "SFP ▼" : "▲ SFP";
          else cur.extra.push({ x: i, y: bear ? b.high : b.low, text: bear ? "▼" : "▲" });
        }
      }
      if (cur && cur.active && (i - cur.bx > 500 || (bear ? b.close > cur.sw : b.close < cur.sw))) {
        cur.active = false;
        if (!cur.confirmed) { out.splice(out.indexOf(cur), 1); cur = null; }
      }
    }
  };
  if (c.sfpBear) run(true);
  if (c.sfpBull) run(false);
  return out.slice(-120);
}

function computeDivergence(bars, c) {
  const close = bars.map((b) => b.close), vol = bars.map((b) => b.volume);
  const r = rsi(close, c.rsiLen), ma = maByType(c.maType, close, vol, c.maLen);
  const L = c.zigzagLen, piv = [];
  for (let i = L - 1; i < r.length; i++) {
    let hi = -Infinity, lo = Infinity, bad = false;
    for (let k = i - L + 1; k <= i; k++) { if (Number.isNaN(r[k])) { bad = true; break; } hi = Math.max(hi, r[k]); lo = Math.min(lo, r[k]); }
    if (bad) continue;
    const last = piv[piv.length - 1];
    if (r[i] === hi && r[i] !== lo) {
      if (last && last.dir > 0) { if (r[i] > last.rsi) Object.assign(last, { i, rsi: r[i] }); }
      else piv.push({ i, rsi: r[i], dir: 1 });
    } else if (r[i] === lo && r[i] !== hi) {
      if (last && last.dir < 0) { if (r[i] < last.rsi) Object.assign(last, { i, rsi: r[i] }); }
      else piv.push({ i, rsi: r[i], dir: -1 });
    }
  }
  const lines = [], labels = [];
  const txt = (dir, ratio) => (dir > 0 ? (ratio > 1 ? "HH" : "LH") : ratio > 1 ? "LL" : "HL");
  for (let k = 2; k < piv.length; k++) {
    const p = piv[k], o = piv[k - 1], lp = piv[k - 2];
    const pr = (close[p.i] - close[o.i]) / (close[lp.i] - close[o.i] || 1e-12);
    const rr = (p.rsi - o.rsi) / (lp.rsi - o.rsi || 1e-12);
    let div = 0;
    if (pr > 1 !== rr > 1 && !Number.isNaN(ma[p.i]) && !Number.isNaN(ma[lp.i])) {
      const trend = Math.sign(ma[p.i] - ma[lp.i]), dir = Math.sign(lp.dir), sent = Math.sign(rr - pr);
      div = trend === dir && sent < 0 ? 1 : trend !== dir && sent > 0 ? -1 : 0;
      if (div !== 0) {
        const col = dir > 0 ? "#F23645" : "#089981";
        lines.push({ i1: lp.i, p1: close[lp.i], i2: p.i, p2: close[p.i], color: col });
        labels.push({ i: p.i, price: p.dir > 0 ? bars[p.i].high : bars[p.i].low, dir: p.dir, text: div > 0 ? "D" : "H", color: div > 0 ? (dir > 0 ? "#FF9800" : "#00E676") : col });
      }
    }
    if (c.showPivotLabels && div === 0) labels.push({ i: p.i, price: p.dir > 0 ? bars[p.i].high : bars[p.i].low, dir: p.dir, text: txt(p.dir, pr), color: "#787B86", small: true });
  }
  return { lines, labels };
}

export function computeEpoch(bars, c) {
  const n = bars.length;
  if (n < 5) return null;
  const close = bars.map((b) => b.close);
  const fast = ema(close, c.emaFast), slow = ema(close, c.emaSlow);
  const colors = new Array(n).fill(null);
  if (c.pivotBarColor) {
    const st = pivotState(bars, c.pivLeft, c.pivRight);
    st.forEach((s, i) => { if (s === 1) colors[i] = c.bullBarColor; else if (s === -1) colors[i] = c.bearBarColor; });
  }
  const tri = new Array(n).fill(0), markers = [];
  for (let i = 0; i < n; i++) {
    const f = fast[i], s = slow[i];
    if (Number.isNaN(f) || Number.isNaN(s)) continue;
    if (c.showYellow && ((f > s && close[i] < f) || (f < s && close[i] > f))) colors[i] = c.yellowColor;
    const pc = i > 0 ? close[i - 1] : NaN;
    const eUp = f > s && pc < s, eDn = f < s && pc > s;
    if (c.showAqua && (eUp || eDn)) colors[i] = c.aquaColor;
    if (c.showTriangles) tri[i] = f >= s ? 1 : -1;
    if (c.showArrows && eUp) markers.push({ time: bars[i].time, position: "belowBar", shape: "arrowUp", color: c.arrowUpColor, size: 0.5 });
    if (c.showArrows && eDn) markers.push({ time: bars[i].time, position: "aboveBar", shape: "arrowDown", color: c.arrowDownColor, size: 0.5 });
  }
  let tls = [];
  if (c.showTrendlines) {
    const hi = bars.map((b) => b.high), lo = bars.map((b) => b.low);
    [[c.tl1Period, c.tl1Num, c.tl1UpColor, c.tl1DownColor], [c.tl2Period, c.tl2Num, c.tl2UpColor, c.tl2DownColor]].forEach(([prd, num, up, dn]) => {
      const lines = pivotTrendlines({ ph: pivotHigh(hi, prd, prd), pl: pivotLow(lo, prd, prd), check: close, prd, ppnum: num, maxline: 5 });
      tls = tls.concat(lines.map((l) => ({ ...l, color: l.kind === "low" ? up : dn })));
    });
  }
  return {
    colors, fast, slow, tri, markers, tls,
    fastColor: fast.map((f, i) => (f > slow[i] ? c.emaUpColor : f < slow[i] ? c.emaDownColor : "#FFEB3B")),
    ema3: c.showEma3 ? [ema(close, c.ema1Len), ema(close, c.ema2Len), ema(close, c.ema3Len)] : null,
    sfp: c.showSfp ? computeSfp(bars, c) : [],
    div: c.showDivergence ? computeDivergence(bars, c) : { lines: [], labels: [] },
  };
}

export { atr };
