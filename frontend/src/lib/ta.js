export const nanArr = (n) => new Array(n).fill(NaN);

export function ema(src, len, alpha = 2 / (len + 1)) {
  const out = nanArr(src.length);
  let prev = NaN, sum = 0, cnt = 0;
  for (let i = 0; i < src.length; i++) {
    const v = src[i];
    if (Number.isNaN(v)) continue;
    if (Number.isNaN(prev)) {
      sum += v; cnt++;
      if (cnt === len) { prev = sum / len; out[i] = prev; }
    } else {
      prev = alpha * v + (1 - alpha) * prev;
      out[i] = prev;
    }
  }
  return out;
}

export const rma = (src, len) => ema(src, len, 1 / len);


export function sma(src, len) {
  const out = nanArr(src.length);
  let sum = 0, cnt = 0;
  for (let i = 0; i < src.length; i++) {
    const v = src[i];
    if (Number.isNaN(v)) { sum = 0; cnt = 0; continue; }
    sum += v; cnt++;
    if (cnt > len) { sum -= src[i - len]; cnt = len; }
    if (cnt === len) out[i] = sum / len;
  }
  return out;
}

export function wma(src, len) {
  const out = nanArr(src.length);
  const den = (len * (len + 1)) / 2;
  for (let i = len - 1; i < src.length; i++) {
    let s = 0;
    for (let k = 0; k < len; k++) s += src[i - k] * (len - k);
    out[i] = s / den;
  }
  return out;
}

export function hma(src, len) {
  const a = wma(src, Math.max(1, Math.floor(len / 2)));
  const b = wma(src, len);
  return wma(a.map((v, i) => 2 * v - b[i]), Math.max(1, Math.floor(Math.sqrt(len))));
}

export function maByType(type, close, vol, len) {
  if (type === "ema") return ema(close, len);
  if (type === "rma") return rma(close, len);
  if (type === "wma") return wma(close, len);
  if (type === "hma") return hma(close, len);
  if (type === "vwma") {
    const a = sma(close.map((c, i) => c * vol[i]), len), b = sma(vol, len);
    return a.map((v, i) => v / b[i]);
  }
  return sma(close, len);
}

export function rsi(src, len) {
  const n = src.length;
  const up = nanArr(n), dn = nanArr(n);
  for (let i = 1; i < n; i++) {
    const ch = src[i] - src[i - 1];
    up[i] = Math.max(ch, 0);
    dn[i] = -Math.min(ch, 0);
  }
  const u = rma(up, len), d = rma(dn, len);
  return u.map((uv, i) => (Number.isNaN(uv) ? NaN : d[i] === 0 ? 100 : uv === 0 ? 0 : 100 - 100 / (1 + uv / d[i])));
}

export function atr(bars, len) {
  const tr = bars.map((b, i) => (i === 0 ? b.high - b.low : Math.max(b.high - b.low, Math.abs(b.high - bars[i - 1].close), Math.abs(b.low - bars[i - 1].close))));
  return rma(tr, len);
}

// Pine-style pivots: value is placed at the detection bar (pivot bar + right)
export function pivotHigh(src, left, right) {
  const out = nanArr(src.length);
  for (let i = left + right; i < src.length; i++) {
    const p = i - right, v = src[p];
    if (Number.isNaN(v)) continue;
    let ok = true;
    for (let j = p - left; j < p && ok; j++) if (!(src[j] <= v)) ok = false;
    for (let j = p + 1; j <= i && ok; j++) if (!(src[j] < v)) ok = false;
    if (ok) out[i] = v;
  }
  return out;
}

export function pivotLow(src, left, right) {
  const out = nanArr(src.length);
  for (let i = left + right; i < src.length; i++) {
    const p = i - right, v = src[p];
    if (Number.isNaN(v)) continue;
    let ok = true;
    for (let j = p - left; j < p && ok; j++) if (!(src[j] >= v)) ok = false;
    for (let j = p + 1; j <= i && ok; j++) if (!(src[j] > v)) ok = false;
    if (ok) out[i] = v;
  }
  return out;
}

// Pivot-based auto trendlines (LonesomeTheBlue style) evaluated on the last bar
export function pivotTrendlines({ ph, pl, check, prd, ppnum, maxline, broken = false, extraStep = false }) {
  const n = check.length, last = n - 1;
  const collect = (arr) => {
    const out = [];
    for (let i = last; i >= 0 && out.length < ppnum; i--) if (!Number.isNaN(arr[i])) out.push({ val: arr[i], pos: i });
    return out;
  };
  const tops = collect(ph), bots = collect(pl);
  const lines = [];
  let lo = 0, hi = 0;
  const scan = (piv, p1, isLow) => {
    for (let p2 = piv.length - 1; p2 > p1; p2--) {
      const { val: val1, pos: pos1 } = piv[p1];
      const { val: val2, pos: pos2 } = piv[p2];
      if (isLow ? !(val1 > val2) : !(val1 < val2)) continue;
      const diff = isLow ? (val1 - val2) / (pos1 - pos2) : (val2 - val1) / (pos1 - pos2);
      let hline = isLow ? val2 + diff : val2 - diff;
      let lloc = last, lval = check[last], valid = true, brk = false;
      for (let x = Math.max(0, pos2 + 1 - prd); x <= last; x++) {
        const v = check[x];
        if (isLow ? v < hline : v > hline) {
          valid = false;
          if (x + prd >= pos1) brk = true;
          break;
        }
        lloc = x; lval = hline;
        hline = isLow ? hline + diff : hline - diff;
      }
      if (valid) {
        const end = extraStep ? hline : isLow ? hline - diff : hline + diff;
        return { found: { x1: pos2 - prd, y1: val2, x2: lloc, y2: end } };
      }
      if (broken && brk) lines.push({ x1: pos2 - prd, y1: val2, x2: lloc, y2: lval, kind: isLow ? "low" : "high", broken: true });
    }
    return {};
  };
  for (let p1 = 0; p1 < ppnum - 1; p1++) {
    if (bots.length > p1 + 1 && lo <= maxline) {
      const r = scan(bots, p1, true);
      if (r.found && lo < maxline) { lo++; lines.push({ ...r.found, kind: "low", broken: false }); }
    }
    if (tops.length > p1 + 1 && hi <= maxline) {
      const r = scan(tops, p1, false);
      if (r.found && hi < maxline) { hi++; lines.push({ ...r.found, kind: "high", broken: false }); }
    }
  }
  return lines;
}
