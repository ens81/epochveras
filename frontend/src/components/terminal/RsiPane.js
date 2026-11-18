import { useEffect, useRef, useState } from "react";
import { createChart } from "lightweight-charts";
import { computeCakma } from "../../lib/cakma";
import { setupCanvas, hexA } from "../../lib/chartmath";

const pad = (n) => String(n).padStart(2, "0");
const tickFmt = (t, type) => {
  const d = new Date(t * 1000);
  if (type === 0) return String(d.getFullYear());
  if (type === 1) return d.toLocaleString("tr-TR", { month: "short" });
  if (type === 2) return String(d.getDate());
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function RsiPane({ bars, version, cfg, mainChart, prec }) {
  const divRef = useRef(null), canvasRef = useRef(null), chartRef = useRef(null), sRef = useRef({});
  const compRef = useRef(null), cfgRef = useRef(cfg), tickRef = useRef(0);
  const [height, setHeight] = useState(cfg.height || 200);
  const [atr, setAtr] = useState(null);
  const [last, setLast] = useState(null);
  cfgRef.current = cfg;

  useEffect(() => {
    const chart = createChart(divRef.current, {
      autoSize: true,
      layout: { background: { type: "solid", color: "#000000" }, textColor: "#B2B5BE", fontFamily: "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif", fontSize: 12, attributionLogo: false },
      grid: { vertLines: { color: "rgba(255,255,255,0.07)" }, horzLines: { color: "rgba(255,255,255,0.07)" } },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.08)", minimumWidth: 92, scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { visible: true, timeVisible: true, rightOffset: 12, borderColor: "rgba(255,255,255,0.1)", tickMarkFormatter: tickFmt },
      localization: { timeFormatter: (t) => new Date(t * 1000).toLocaleString("tr-TR") },
      handleScroll: false, handleScale: false,
    });
    const rsi = chart.addLineSeries({ lineWidth: 1, priceLineVisible: false, crosshairMarkerVisible: false, priceFormat: { type: "price", precision: 2, minMove: 0.01 } });
    const ema = chart.addLineSeries({ lineWidth: 1, priceLineVisible: false, crosshairMarkerVisible: false, priceFormat: { type: "price", precision: 2, minMove: 0.01 } });
    sRef.current = { rsi, ema, bands: [] };
    chartRef.current = chart;
    const fromMain = (r) => { if (r) chart.timeScale().setVisibleLogicalRange(r); };
    mainChart.timeScale().subscribeVisibleLogicalRangeChange(fromMain);
    let raf, sig = "";
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const comp = compRef.current, c = cfgRef.current, B = bars.current, el = divRef.current;
      if (!comp || !el || !B.length) return;
      const ts = chart.timeScale(), w = el.clientWidth - chart.priceScale("right").width(), h = el.clientHeight - ts.height(), range = ts.getVisibleLogicalRange();
      if (!range) return;
      const s2 = [range.from, range.to, w, h, rsi.priceToCoordinate(50), rsi.priceToCoordinate(70), tickRef.current].join("|");
      if (s2 === sig) return;
      sig = s2;
      const ctx = setupCanvas(canvasRef.current, w, h);
      const x = (l) => ts.logicalToCoordinate(l), y = (v) => rsi.priceToCoordinate(v);
      if (c.bandFill) { const y70 = y(70), y30 = y(30); ctx.fillStyle = hexA(c.bandFillColor, c.bandFillOpacity); ctx.fillRect(0, Math.min(y70, y30), w, Math.abs(y30 - y70)); }
      const a = Math.max(1, Math.floor(range.from)), b = Math.min(B.length - 1, Math.ceil(range.to));
      for (let i = a; i <= b; i++) {
        const r0 = comp.rsi[i - 1], r1 = comp.rsi[i], e0 = comp.rsiema[i - 1], e1 = comp.rsiema[i];
        if ([r0, r1, e0, e1].some(Number.isNaN)) continue;
        ctx.fillStyle = hexA(r1 > e1 ? c.fillUp : c.fillDown, c.fillOpacity);
        ctx.beginPath(); ctx.moveTo(x(i - 1), y(r0)); ctx.lineTo(x(i), y(r1)); ctx.lineTo(x(i), y(e1)); ctx.lineTo(x(i - 1), y(e0)); ctx.closePath(); ctx.fill();
      }
      comp.lines.forEach((l) => {
        ctx.strokeStyle = l.color;
        ctx.lineWidth = l.broken ? 1 : c.lineWidth;
        ctx.setLineDash(l.broken ? [1, 3] : c.lineStyle === "Dashed" ? [6, 4] : []);
        let x1 = x(l.x1), y1 = y(l.y1), x2 = x(l.x2), y2 = y(l.y2);
        if (c.extendLines && !l.broken && x2 !== x1) { const k = (y2 - y1) / (x2 - x1); y2 = y2 + k * (w - x2); x2 = w; }
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      });
      ctx.setLineDash([]);
      comp.pivots.forEach((p) => { ctx.strokeStyle = p.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x(p.x1), y(p.y)); ctx.lineTo(x(p.x2), y(p.y)); ctx.stroke(); });
    };
    loop();
    const r = mainChart.timeScale().getVisibleLogicalRange();
    if (r) chart.timeScale().setVisibleLogicalRange(r);
    return () => {
      cancelAnimationFrame(raf);
      mainChart.timeScale().unsubscribeVisibleLogicalRangeChange(fromMain);
      chart.remove();
    };
  }, [mainChart, bars]);

  useEffect(() => {
    const B = bars.current, s = sRef.current;
    if (!s.rsi) return;
    const comp = computeCakma(B, cfg);
    compRef.current = comp;
    tickRef.current++;
    if (!comp) { s.rsi.setData([]); s.ema.setData([]); return; }
    const ser = (arr) => B.map((b, i) => (Number.isNaN(arr[i]) ? { time: b.time } : { time: b.time, value: arr[i] }));
    s.rsi.applyOptions({ color: cfg.rsiColor });
    s.ema.applyOptions({ color: cfg.emaColor });
    s.rsi.setData(ser(comp.rsi));
    s.ema.setData(ser(comp.rsiema));
    s.bands.forEach((pl) => s.rsi.removePriceLine(pl));
    s.bands = [[70, cfg.band70, cfg.bandColor], [58, cfg.band58, cfg.midBandColor], [50, cfg.band50, cfg.midBandColor], [42, cfg.band42, cfg.midBandColor], [30, cfg.band30, cfg.bandColor]]
      .filter((b) => b[1]).map(([v, , col]) => s.rsi.createPriceLine({ price: v, color: col, lineWidth: 1, lineStyle: 2, axisLabelVisible: false }));
    const r = mainChart.timeScale().getVisibleLogicalRange();
    if (r) chartRef.current.timeScale().setVisibleLogicalRange(r);
    setAtr(comp.atr);
    const n = B.length - 1;
    setLast(n >= 0 && !Number.isNaN(comp.rsi[n]) ? [comp.rsi[n].toFixed(2), Number.isNaN(comp.rsiema[n]) ? "—" : comp.rsiema[n].toFixed(2)] : null);
  }, [version, cfg, bars, mainChart]);

  const startResize = (e) => {
    const y0 = e.clientY, h0 = height;
    const mv = (ev) => setHeight(Math.max(90, Math.min(480, h0 - (ev.clientY - y0))));
    const upf = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", upf); };
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", upf);
  };

  return (
    <div className="relative shrink-0 border-t border-white/10" style={{ height }} data-testid="rsi-pane">
      <div onPointerDown={startResize} className="absolute -top-1.5 left-0 right-0 h-3 z-20 cursor-row-resize" data-testid="rsi-pane-resize-handle" />
      <div ref={divRef} className="absolute inset-0 isolate" />
      <canvas ref={canvasRef} className="absolute left-0 top-0 pointer-events-none" />
      <div className="absolute left-2 top-1 z-10 flex items-center gap-2 pointer-events-none">
        <span className="text-xs text-[#B2B5BE] font-mono-num" data-testid="rsi-legend">CakmaUstad-RSI {cfg.len1} {cfg.len2}
          {last && <> <b className="font-normal" style={{ color: cfg.rsiColor }}>{last[0]}</b> <b className="font-normal" style={{ color: cfg.emaColor }}>{last[1]}</b></>}</span>
        {cfg.showAtr && atr !== null && (
          <span className="text-[10px] px-1.5 py-0.5 bg-[#434651] text-white font-mono-num" data-testid="rsi-atr-table">ATR ({cfg.atrLen}): {atr.toFixed(prec)}</span>
        )}
      </div>
    </div>
  );
}
