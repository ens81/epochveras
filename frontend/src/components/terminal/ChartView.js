import { useEffect, useMemo, useRef, useState } from "react";
import { createChart, CrosshairMode } from "lightweight-charts";
import { Plus, Bell, X, Trash2 } from "lucide-react";
import { http, fmtPrice, fmtCountdown, roundTick, tfSec, TIMEFRAMES } from "../../lib/api";
import { market } from "../../lib/stream";
import { computeEpoch } from "../../lib/epoch";
import { timeToLogical, logicalToTime, setupCanvas, distToSeg } from "../../lib/chartmath";
import { drawEpoch, drawCloud, drawDrawings, drawRuler } from "../../lib/overlay";
import RsiPane from "./RsiPane";
import MtfTables from "./MtfTables";


const SWATCHES = ["#E0E3EB", "#787B86", "#2962FF", "#089981", "#F23645", "#F5A623", "#AB47BC", "#00BCD4", "#FFEB3B"];
const pad = (n) => String(n).padStart(2, "0");
const fmtTime = (t) => { const d = new Date(t * 1000); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const tickFmt = (t, type) => {
  const d = new Date(t * 1000);
  if (type === 0) return String(d.getFullYear());
  if (type === 1) return d.toLocaleString("tr-TR", { month: "short" });
  if (type === 2) return String(d.getDate());
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const uid = () => window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;

export default function ChartView(props) {
  const { symbol, tf, meta, epochCfg, cakmaCfg, drawings, tool, selectedId, setSelectedId, alarms, onAddAlarm, onDeleteAlarm, onSaveDrawing, onDeleteDrawing, onStyleUsed } = props;
  const mainRef = useRef(null), canvasRef = useRef(null), chartRef = useRef(null), candleRef = useRef(null), linesRef = useRef({});
  const backRef = useRef(null), legendRef = useRef(null), plusRef = useRef(null), cdRef = useRef(null), alarmEls = useRef({});
  const barsRef = useRef([]);
  const fitRef = useRef(0);
  const S = useRef({ tick: 0, hoverY: null, hideAt: 0 });
  const [version, setVersion] = useState(0);
  const [chartReady, setChartReady] = useState(null);
  const [loading, setLoading] = useState(true);
  const iv = tfSec(tf);
  const prec = meta?.precision ?? 2;

  const ind = useMemo(() => (epochCfg?.enabled ? computeEpoch(barsRef.current, epochCfg) : null), [version, epochCfg]); // eslint-disable-line
  const live = useRef({});
  live.current = { ...props, ind, iv, prec };
  S.current.tick++;

  useEffect(() => {
    const chart = createChart(mainRef.current, {
      autoSize: true,
      layout: { background: { type: "solid", color: "transparent" }, textColor: "#B2B5BE", fontFamily: "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif", fontSize: 12, attributionLogo: false },
      grid: { vertLines: { color: "rgba(255,255,255,0.07)" }, horzLines: { color: "rgba(255,255,255,0.07)" } },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { color: "#434651", labelBackgroundColor: "#1C1C1E" }, horzLine: { color: "#434651", labelBackgroundColor: "#1C1C1E" } },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.08)", minimumWidth: 92, scaleMargins: { top: 0.08, bottom: 0.08 } },
      timeScale: { borderColor: "rgba(255,255,255,0.08)", timeVisible: true, rightOffset: 12, barSpacing: 7, tickMarkFormatter: tickFmt },
      localization: { priceFormatter: (p) => fmtPrice(p, live.current.prec), timeFormatter: fmtTime },
    });
    const mk = (o) => chart.addLineSeries({ priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, ...o });
    linesRef.current = { e1: mk({ lineWidth: 2 }), e2: mk({ lineWidth: 2 }), e3: mk({ lineWidth: 2 }), slow: mk({ lineWidth: 2 }), fast: mk({ lineWidth: 2 }) };
    candleRef.current = chart.addCandlestickSeries({ upColor: "#089981", downColor: "#F23645", borderVisible: false, wickUpColor: "#089981", wickDownColor: "#F23645" });
    chartRef.current = chart;
    chart.subscribeCrosshairMove((p) => {
      S.current.hoverIdx = p.point ? p.logical : null;
      if (p.point && p.point.y >= 0) { S.current.hoverY = p.point.y; S.current.hideAt = Date.now() + 2500; }
    });
    setChartReady(chart);
    return () => { chart.remove(); chartRef.current = null; };
  }, []);

  useEffect(() => {
    if (chartReady) chartReady.timeScale().applyOptions({ visible: !cakmaCfg?.enabled });
  }, [chartReady, cakmaCfg?.enabled]);

  useEffect(() => {
    if (!meta || !candleRef.current || !chartRef.current) return;
    const fmt = (p) => fmtPrice(p, meta.precision);
    candleRef.current.applyOptions({ priceFormat: { type: "custom", minMove: Number(meta.tick), formatter: fmt } });
    Object.values(linesRef.current).forEach((sr) => sr.applyOptions({ priceFormat: { type: "custom", minMove: Number(meta.tick), formatter: fmt } }));
    chartRef.current.applyOptions({ localization: { priceFormatter: fmt, timeFormatter: fmtTime } });
  }, [meta]);

  // history + live stream
  useEffect(() => {
    if (!chartReady) return;
    let alive = true, bump = null;
    setLoading(true);
    barsRef.current = [];
    candleRef.current.setData([]);
    candleRef.current.setMarkers([]);
    Object.values(linesRef.current).forEach((sr) => sr.setData([]));
    setVersion((v) => v + 1);
    const toBar = (r) => ({ time: r[0] / 1000, open: +r[1], high: +r[2], low: +r[3], close: +r[4], volume: +r[5] });
    const merge = (bar) => {
      const bars = barsRef.current, n = bars.length;
      if (!n) return;
      if (bar.time === bars[n - 1].time) bars[n - 1] = bar;
      else if (bar.time > bars[n - 1].time) { bars.push(bar); setVersion((v) => v + 1); }
      else return;
      const c = live.current.ind?.colors?.[bars.length - 1];
      candleRef.current.update(c ? { ...bar, color: c, wickColor: c } : bar);
      if (!bump) bump = setTimeout(() => { bump = null; alive && setVersion((v) => v + 1); }, 1000);
    };
    http.get("/market/klines", { params: { symbol, interval: tf, limit: 1500 } }).then(({ data }) => {
      if (!alive) return;
      barsRef.current = data.map(toBar);
      const n = barsRef.current.length;
      candleRef.current.setData(barsRef.current);
      fitRef.current = n;
      setVersion((v) => v + 1);
      setLoading(false);
    }).catch(() => setLoading(false));
    const unsub = market.subscribe(`${symbol.toLowerCase()}@kline_${tf}`, (d) => {
      const k = d.k;
      merge({ time: k.t / 1000, open: +k.o, high: +k.h, low: +k.l, close: +k.c, volume: +k.v });
    });
    const poll = setInterval(() => {
      if (market.open || !barsRef.current.length) return;
      http.get("/market/klines", { params: { symbol, interval: tf, limit: 2 } }).then(({ data }) => alive && data.map(toBar).forEach(merge)).catch(() => {});
    }, 2500);
    return () => { alive = false; unsub(); clearInterval(poll); clearTimeout(bump); };
  }, [symbol, tf, chartReady]);

  // apply indicator series
  useEffect(() => {
    const bars = barsRef.current, L = linesRef.current;
    if (!candleRef.current) return;
    if (!bars.length) { Object.values(L).forEach((sr) => sr.setData([])); return; }
    candleRef.current.setData(ind ? bars.map((b, i) => (ind.colors[i] ? { ...b, color: ind.colors[i], wickColor: ind.colors[i] } : b)) : bars);
    const ser = (arr, colors) => bars.map((b, i) => (Number.isNaN(arr[i]) ? { time: b.time } : colors ? { time: b.time, value: arr[i], color: colors[i] } : { time: b.time, value: arr[i] }));
    const c = epochCfg;
    if (ind) {
      L.fast.setData(ser(ind.fast, ind.fastColor)); L.slow.setData(ser(ind.slow, ind.fastColor));
      if (ind.ema3) {
        L.e1.applyOptions({ color: c.ema1Color }); L.e2.applyOptions({ color: c.ema2Color }); L.e3.applyOptions({ color: c.ema3Color });
        L.e1.setData(ser(ind.ema3[0])); L.e2.setData(ser(ind.ema3[1])); L.e3.setData(ser(ind.ema3[2]));
      } else ["e1", "e2", "e3"].forEach((k) => L[k].setData([]));
      candleRef.current.setMarkers(ind.markers);
    } else {
      Object.values(L).forEach((s) => s.setData([]));
      candleRef.current.setMarkers([]);
    }
    if (fitRef.current) {
      const n = fitRef.current;
      fitRef.current = 0;
      chartRef.current.timeScale().setVisibleLogicalRange({ from: n - 150, to: n + 12 });
    }
  }, [ind, version]); // eslint-disable-line

  // overlay render loop
  useEffect(() => {
    if (!chartReady) return;
    let raf, sig = "";
    const chart = chartReady, candle = candleRef.current;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const Lc = live.current, bars = barsRef.current, ts = chart.timeScale(), el = mainRef.current;
      if (!el) return;
      const w = el.clientWidth - chart.priceScale("right").width(), h = el.clientHeight - ts.height(), n = bars.length;
      const range = ts.getVisibleLogicalRange();
      const lastBar = bars[n - 1];
      const yLast = lastBar ? candle.priceToCoordinate(lastBar.close) : null;
      // DOM overlays
      const sw = chart.priceScale("right").width();
      if (cdRef.current) {
        if (lastBar && yLast !== null && yLast > 0 && yLast < h) {
          cdRef.current.style.display = "block";
          cdRef.current.style.top = `${yLast + 10}px`;
          cdRef.current.style.width = `${sw}px`;
          const txt = fmtCountdown(lastBar.time * 1000 + Lc.iv * 1000 - Date.now());
          if (cdRef.current.textContent !== txt) cdRef.current.textContent = txt;
          cdRef.current.style.background = lastBar.close >= lastBar.open ? "#089981" : "#F23645";
        } else cdRef.current.style.display = "none";
      }
      if (plusRef.current) {
        const show = S.current.hoverY !== null && Date.now() < S.current.hideAt && S.current.hoverY < h;
        plusRef.current.style.display = show ? "flex" : "none";
        if (show) { plusRef.current.style.top = `${S.current.hoverY - 10}px`; plusRef.current.style.left = `${w + 2}px`; }
      }
      Object.entries(alarmEls.current).forEach(([id, node]) => {
        if (!node) return;
        const a = (Lc.alarms || []).find((x) => x.id === id);
        const yy = a ? candle.priceToCoordinate(a.price) : null;
        if (yy === null || yy < 0 || yy > h) { node.style.display = "none"; return; }
        node.style.display = "flex"; node.style.top = `${yy - 9}px`; node.style.left = `${w + 2}px`;
      });
      if (legendRef.current && n) {
        const hi = S.current.hoverIdx, i = hi !== null && hi >= 0 && hi < n ? Math.round(hi) : n - 1;
        const b = bars[i], pb = bars[i - 1] || b, f = (v) => fmtPrice(v, Lc.prec);
        const ch = b.close - pb.close, col = b.close >= b.open ? "#089981" : "#F23645";
        const e = Lc.ind && Lc.epochCfg;
        const html = `<div class="lg-title">${Lc.symbol} · ${TIMEFRAMES.find((t) => t.key === Lc.tf)?.label} · Binance</div>`
          + `<div>A <b style="color:${col}">${f(b.open)}</b> Y <b style="color:${col}">${f(b.high)}</b> D <b style="color:${col}">${f(b.low)}</b> K <b style="color:${col}">${f(b.close)}</b> <b style="color:${ch >= 0 ? "#089981" : "#F23645"}">${ch >= 0 ? "+" : ""}${f(ch)} (${pb.close ? ((ch / pb.close) * 100).toFixed(2) : "0.00"}%)</b></div>`
          + (e ? `<div>Epoch <b style="color:${Lc.ind.fastColor[i]}">${f(Lc.ind.fast[i])}</b> <b style="color:${Lc.ind.fastColor[i]}">${f(Lc.ind.slow[i])}</b></div>` : "");
        if (legendRef.current.innerHTML !== html) legendRef.current.innerHTML = html;
      }
      if (!range || !n) return;
      const s2 = [range.from, range.to, yLast, candle.priceToCoordinate(lastBar.close * 0.95), w, h, S.current.tick, sw].join("|");
      if (s2 === sig) return;
      sig = s2;
      const bctx = setupCanvas(backRef.current, w, h);
      const ctx = setupCanvas(canvasRef.current, w, h);
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
      const x = (l) => ts.logicalToCoordinate(l);
      const y = (p) => candle.priceToCoordinate(p);
      const px = (p) => ({ x: x(timeToLogical(bars, p.time, Lc.iv)), y: y(p.price) });
      const H = { x, y, px, w, h, n, from: range.from, to: range.to, bars, iv: Lc.iv };
      if (Lc.ind) { drawCloud(bctx, H, Lc.ind, Lc.epochCfg); drawEpoch(ctx, H, Lc.ind, Lc.epochCfg); }
      const st = S.current;
      let list = Lc.drawings || [];
      if (st.dragged) list = list.map((d) => (d.id === st.dragged.id ? st.dragged : d));
      if (st.temp) list = [...list, st.temp];
      drawDrawings(ctx, H, list, Lc.selectedId, Lc.prec);
      if (st.ruler) drawRuler(ctx, H, st.ruler, Lc.prec, Lc.iv);
      ctx.restore();
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [chartReady]);

  // drawing interactions
  useEffect(() => {
    if (!chartReady) return;
    const chart = chartReady, candle = candleRef.current, el = mainRef.current;
    const st = S.current;
    const lock = (v) => chart.applyOptions({ handleScroll: !v, handleScale: !v });
    const xy = (e) => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const toPt = (x, y, snap) => {
      const Lc = live.current, bars = barsRef.current;
      let l = chart.timeScale().coordinateToLogical(x), price = candle.coordinateToPrice(y);
      if (l === null || price === null || !bars.length) return null;
      l = Math.round(l);
      if (snap && Lc.magnet && l >= 0 && l < bars.length) {
        const b = bars[l];
        let best = null, bd = 1e9;
        [b.open, b.high, b.low, b.close].forEach((v) => { const d = Math.abs(candle.priceToCoordinate(v) - y); if (d < bd) { bd = d; best = v; } });
        if (bd < 18) price = best;
      }
      return { time: logicalToTime(bars, l, Lc.iv), price };
    };
    const px = (p) => ({ x: chart.timeScale().logicalToCoordinate(timeToLogical(barsRef.current, p.time, live.current.iv)), y: candle.priceToCoordinate(p.price) });
    const hit = (x, y, touch) => {
      const R = touch ? 14 : 8, list = live.current.drawings || [];
      for (let k = list.length - 1; k >= 0; k--) {
        const d = list[k], P = d.points.map(px);
        if (d.type === "trendline") {
          for (let i = 0; i < 2; i++) if (Math.hypot(P[i].x - x, P[i].y - y) < R) return { d, h: i };
          if (distToSeg(x, y, P[0].x, P[0].y, P[1].x, P[1].y) < R - 2) return { d, h: -1 };
        } else if (d.type === "hray") {
          if (Math.hypot(P[0].x - x, P[0].y - y) < R) return { d, h: 0 };
          if (x >= P[0].x - 4 && Math.abs(y - P[0].y) < R - 2) return { d, h: -1 };
        } else {
          const H = [P[0], { x: P[1].x, y: P[1].y }, { x: P[1].x, y: P[2].y }];
          for (let i = 0; i < 3; i++) if (Math.hypot(H[i].x - x, H[i].y - y) < R) return { d, h: i };
          if (x >= P[0].x && x <= P[1].x && y >= Math.min(P[1].y, P[2].y) && y <= Math.max(P[1].y, P[2].y)) return { d, h: -1 };
        }
      }
      return null;
    };
    const finish = (d) => { live.current.onSaveDrawing(d); live.current.setTool("cursor"); };
    const down = (e) => {
      if (e.button > 0) return;
      const { x, y } = xy(e);
      if (x > el.clientWidth - chart.priceScale("right").width()) return;
      const Lc = live.current, tool = Lc.tool, touch = e.pointerType === "touch";
      st.ruler = tool === "ruler" ? st.ruler : null;
      const pt = toPt(x, y, true);
      if (!pt) return;
      const stop = () => { e.stopPropagation(); lock(true); try { el.setPointerCapture(e.pointerId); } catch (er) { /* noop */ } };
      if (tool === "cursor") {
        const hh = hit(x, y, touch);
        if (hh) {
          Lc.setSelectedId(hh.d.id);
          st.drag = { orig: JSON.parse(JSON.stringify(hh.d)), h: hh.h, start: toPt(x, y, false) };
          stop();
        } else if (Lc.selectedId) Lc.setSelectedId(null);
        st.tick++;
        return;
      }
      stop();
      const style = Lc.styles || {};
      if (tool === "trendline") {
        if (st.temp && st.temp.await) { st.temp.points[1] = pt; const d = st.temp; st.temp = null; finish(d); Lc.setSelectedId(d.id); lock(false); return; }
        st.temp = { id: uid(), symbol: Lc.symbol, type: "trendline", points: [pt, { ...pt }], style: { color: "#D1D4DC", width: 2, ...style.trendline }, sx: x, sy: y };
      } else if (tool === "hray") {
        const d = { id: uid(), symbol: Lc.symbol, type: "hray", points: [pt], style: { color: "#F5A623", width: 1, ...style.hray } };
        finish(d); Lc.setSelectedId(d.id);
      } else if (tool === "long" || tool === "short") {
        const span = Math.abs(candle.coordinateToPrice(0) - candle.coordinateToPrice(el.clientHeight - 30));
        const sgn = tool === "long" ? 1 : -1;
        const l = timeToLogical(barsRef.current, pt.time, Lc.iv);
        const t1 = logicalToTime(barsRef.current, l + 30, Lc.iv);
        const d = { id: uid(), symbol: Lc.symbol, type: tool, style: {}, points: [pt, { time: t1, price: pt.price + sgn * span * 0.1 }, { time: t1, price: pt.price - sgn * span * 0.05 }] };
        finish(d); Lc.setSelectedId(d.id);
      } else if (tool === "ruler") {
        st.ruler = { a: pt, b: { ...pt }, active: true };
      }
      st.tick++;
    };
    const move = (e) => {
      const { x, y } = xy(e);
      if (st.drag) {
        const d = st.drag, o = d.orig, bars = barsRef.current, iv = live.current.iv;
        const pt = toPt(x, y, d.h >= 0);
        if (!pt || !d.start) return;
        let pts = o.points.map((p) => ({ ...p }));
        if (d.h >= 0) {
          if (o.type === "long" || o.type === "short") {
            if (d.h === 0) pts[0] = pt; else { pts[d.h] = pt; pts[d.h === 1 ? 2 : 1].time = pt.time; }
          } else pts[d.h] = pt;
        } else {
          const dl = timeToLogical(bars, pt.time, iv) - timeToLogical(bars, d.start.time, iv), dp = pt.price - d.start.price;
          pts = o.points.map((p) => ({ time: logicalToTime(bars, Math.round(timeToLogical(bars, p.time, iv) + dl), iv), price: p.price + dp }));
        }
        st.dragged = { ...o, points: pts };
        st.tick++;
      } else if (st.temp) {
        const pt = toPt(x, y, true);
        if (pt) { st.temp.points[1] = pt; st.tick++; }
      } else if (st.ruler && st.ruler.active) {
        const pt = toPt(x, y, true);
        if (pt) { st.ruler.b = pt; st.tick++; }
      }
    };
    const up = (e) => {
      const { x, y } = xy(e);
      if (st.drag) {
        if (st.dragged) live.current.onSaveDrawing(st.dragged);
        st.drag = null;
        setTimeout(() => { st.dragged = null; st.tick++; }, 0);
        lock(false);
      } else if (st.temp) {
        if (Math.hypot(x - st.temp.sx, y - st.temp.sy) > 6) { const d = st.temp; st.temp = null; finish(d); live.current.setSelectedId(d.id); lock(false); }
        else st.temp.await = true;
      } else if (st.ruler && st.ruler.active) {
        st.ruler.active = false;
        live.current.setTool("cursor");
        lock(false);
      }
      st.tick++;
    };
    el.addEventListener("pointerdown", down, true);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    const key = (e) => {
      if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
      const Lc = live.current;
      if ((e.key === "Delete" || e.key === "Backspace") && Lc.selectedId) { Lc.onDeleteDrawing(Lc.selectedId); Lc.setSelectedId(null); }
      if (e.key === "Escape") { st.temp = null; st.ruler = null; Lc.setTool("cursor"); Lc.setSelectedId(null); lock(false); st.tick++; }
    };
    window.addEventListener("keydown", key);
    return () => {
      el.removeEventListener("pointerdown", down, true); el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up);
      window.removeEventListener("keydown", key);
    };
  }, [chartReady]);

  useEffect(() => { if (tool !== "trendline") S.current.temp = null; }, [tool]);

  const addAlarmHere = () => {
    const y = S.current.hoverY;
    if (y === null || !candleRef.current) return;
    const p = candleRef.current.coordinateToPrice(y);
    if (p) onAddAlarm(roundTick(p, meta?.tick || 0.01));
  };

  const sel = (drawings || []).find((d) => d.id === selectedId);
  const setStyle = (patch) => {
    const d = { ...sel, style: { ...sel.style, ...patch } };
    onSaveDrawing(d);
    onStyleUsed(d.type, d.style);
  };
  const symAlarms = (alarms || []).filter((a) => a.symbol === symbol && a.status === "active");

  return (
    <div className="flex flex-col h-full w-full min-w-0" data-testid="chart-area">
      <div className="relative flex-1 min-h-0 bg-black">
        <canvas ref={backRef} className="absolute left-0 top-0 pointer-events-none" />
        <div ref={mainRef} className="absolute inset-0 isolate chart-surface" style={{ touchAction: "none", cursor: tool === "cursor" ? "default" : "crosshair" }} data-testid="main-chart" />
        <div ref={legendRef} className="chart-legend absolute left-3 top-2 z-10 pointer-events-none max-w-[calc(100%-120px)]" data-testid="chart-legend" />
        <canvas ref={canvasRef} className="absolute left-0 top-0 pointer-events-none" />
        <div ref={cdRef} className="absolute right-0 pointer-events-none text-center text-[10px] leading-[16px] font-mono-num text-white" style={{ display: "none" }} data-testid="candle-countdown" />
        <button ref={plusRef} onClick={addAlarmHere} onMouseEnter={() => { S.current.hideAt = Date.now() + 60000; }} onMouseLeave={() => { S.current.hideAt = Date.now() + 800; }}
          className="absolute z-20 h-5 w-5 items-center justify-center rounded-sm bg-[#D1D4DC] text-black hover:bg-white transition-colors" style={{ display: "none" }} title="Alarm ekle" data-testid="price-scale-add-alarm-button">
          <Plus size={13} strokeWidth={3} />
        </button>
        {symAlarms.map((a) => (
          <div key={a.id} ref={(n) => { if (n) alarmEls.current[a.id] = n; else delete alarmEls.current[a.id]; }}
            className="alarm-tag absolute z-10 items-center gap-1 h-[18px] pl-1 pr-0.5 rounded-sm bg-[#F5A623] text-black text-[10px] font-mono-num" style={{ display: "none" }} data-testid={`alarm-tag-${a.id}`}>
            <Bell size={10} strokeWidth={2.5} />
            <span>{fmtPrice(a.price, prec)}</span>
            <button onClick={() => onDeleteAlarm(a.id)} className="ml-0.5 hover:bg-black/20 rounded-sm p-px" data-testid={`alarm-tag-delete-${a.id}`}><X size={10} /></button>
          </div>
        ))}
        {sel && (sel.type === "trendline" || sel.type === "hray") && (
          <div className="absolute top-[150px] md:top-[84px] left-1/2 -translate-x-1/2 z-30 flex flex-wrap max-w-[92vw] items-center gap-1 bg-[#0A0A0A] border border-white/10 px-2 py-1 rounded-sm" data-testid="drawing-style-toolbar">
            {SWATCHES.map((c) => (
              <button key={c} onClick={() => setStyle({ color: c })} className={`h-5 w-5 rounded-sm border ${sel.style?.color === c ? "border-white" : "border-transparent"}`} style={{ background: c }} data-testid={`style-color-${c.slice(1)}`} />
            ))}
            <span className="w-px h-4 bg-white/10 mx-1" />
            {[1, 2, 3, 4].map((wd) => (
              <button key={wd} onClick={() => setStyle({ width: wd })} className={`h-6 w-7 flex items-center justify-center rounded-sm hover:bg-white/5 ${sel.style?.width === wd ? "bg-white/10" : ""}`} data-testid={`style-width-${wd}`}>
                <span className="block w-4 bg-[#E0E3EB]" style={{ height: wd }} />
              </button>
            ))}
            <span className="w-px h-4 bg-white/10 mx-1" />
            <button onClick={() => { onDeleteDrawing(sel.id); setSelectedId(null); }} className="h-6 w-6 flex items-center justify-center text-[#F23645] hover:bg-white/5 rounded-sm" data-testid="style-delete-drawing"><Trash2 size={14} /></button>
          </div>
        )}
        {sel && (sel.type === "long" || sel.type === "short") && (
          <div className="absolute top-[150px] md:top-[84px] left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-[#0A0A0A] border border-white/10 px-2 py-1 rounded-sm text-xs" data-testid="position-toolbar">
            <span className={sel.type === "long" ? "text-[#089981]" : "text-[#F23645]"}>{sel.type === "long" ? "Long pozisyon" : "Short pozisyon"}</span>
            <button onClick={() => { onDeleteDrawing(sel.id); setSelectedId(null); }} className="h-6 w-6 flex items-center justify-center text-[#F23645] hover:bg-white/5 rounded-sm" data-testid="position-delete-drawing"><Trash2 size={14} /></button>
          </div>
        )}
        {epochCfg?.enabled && epochCfg.showMtf && <MtfTables symbol={symbol} cfg={epochCfg} bottom={cakmaCfg?.enabled ? 8 : 36} />}
        {loading && <div className="absolute inset-0 flex items-center justify-center text-[#787B86] text-xs pointer-events-none" data-testid="chart-loading">Yükleniyor…</div>}
      </div>
      {cakmaCfg?.enabled && chartReady && <RsiPane bars={barsRef} version={version} cfg={cakmaCfg} mainChart={chartReady} prec={prec} />}
    </div>
  );
}
