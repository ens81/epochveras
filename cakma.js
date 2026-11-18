import { ema, rsi, atr, pivotHigh, pivotLow, pivotTrendlines } from "./ta";

export const CAKMA_DEFAULTS = {
  enabled: true, len1: 22, len2: 66, prd: 10, ppnum: 10, lineStyle: "Solid", lineWidth: 1,
  topColor: "#FF5252", bottomColor: "#2962FF", showBroken: true, extendLines: false, showPivot: false,
  rsiColor: "#8E1599", emaColor: "#FF2CFF", fillUp: "#4CAF50", fillDown: "#FF5252", fillOpacity: 0.15,
  band70: true, band58: true, band50: true, band42: true, band30: true, bandColor: "#787B86", midBandColor: "#434651",
  bandFill: true, bandFillColor: "#9598A1", bandFillOpacity: 0.12, atrLen: 14, showAtr: true, height: 200,
};

export const CAKMA_SCHEMA = [
  ["RSI", [["len1", "RSI uzunluk", "int"], ["len2", "RSI-EMA uzunluk", "int"], ["rsiColor", "RSI rengi", "color"], ["emaColor", "EMA rengi", "color"], ["fillUp", "Dolgu yukarı", "color"], ["fillDown", "Dolgu aşağı", "color"], ["fillOpacity", "Dolgu opaklık", "float"]]],
  ["Bant Çizgileri", [["band70", "Üst bant 70", "bool"], ["band58", "Çizgi 58", "bool"], ["band50", "Orta çizgi 50", "bool"], ["band42", "Çizgi 42", "bool"], ["band30", "Alt bant 30", "bool"], ["bandColor", "70/30 bant rengi", "color"], ["midBandColor", "58/50/42 çizgi rengi", "color"], ["bandFill", "70-30 arka plan dolgusu", "bool"], ["bandFillColor", "Dolgu rengi", "color"], ["bandFillOpacity", "Dolgu opaklık", "float"]]],
  ["Pivot Trendline", [["prd", "Pivot periyot", "int"], ["ppnum", "Pivot sayısı", "int"], ["lineStyle", "Çizgi stili", "select", ["Solid", "Dashed"]], ["lineWidth", "Kalınlık", "int"], ["topColor", "Üst çizgi", "color"], ["bottomColor", "Alt çizgi", "color"], ["showBroken", "Kırılan çizgiler", "bool"], ["extendLines", "Çizgileri uzat", "bool"], ["showPivot", "Pivot noktaları", "bool"]]],
  ["ATR", [["showAtr", "ATR tablosu", "bool"], ["atrLen", "ATR uzunluk", "int"]]],
];

export function computeCakma(bars, c) {
  if (bars.length < 5) return null;
  const close = bars.map((b) => b.close);
  const r = rsi(close, c.len1), re = ema(r, c.len2);
  const ph = pivotHigh(r, c.prd, c.prd), pl = pivotLow(r, c.prd, c.prd);
  const lines = pivotTrendlines({ ph, pl, check: r.map((v) => (Number.isNaN(v) ? 0 : v)), prd: c.prd, ppnum: c.ppnum, maxline: 20, broken: c.showBroken, extraStep: true })
    .map((l) => ({ ...l, color: l.kind === "low" ? c.bottomColor : c.topColor }));
  const pivots = [];
  if (c.showPivot) {
    ph.forEach((v, i) => { if (!Number.isNaN(v)) pivots.push({ x1: i - c.prd, x2: i - c.prd + 50, y: v, color: "#4CAF50" }); });
    pl.forEach((v, i) => { if (!Number.isNaN(v)) pivots.push({ x1: i - c.prd, x2: i - c.prd + 50, y: v, color: "#FF5252" }); });
  }
  const a = atr(bars, c.atrLen);
  return { rsi: r, rsiema: re, lines, pivots, atr: a[a.length - 1] };
}
