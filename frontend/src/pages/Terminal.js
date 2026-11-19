import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { http, BACKEND_URL, CLIENT_ID, fmtPrice } from "../lib/api";
import { market } from "../lib/stream";
import { beep, refreshPushIfGranted } from "../lib/notify";
import { EPOCH_DEFAULTS } from "../lib/epoch";
import { CAKMA_DEFAULTS } from "../lib/cakma";
import TerminalHeader from "../components/terminal/TerminalHeader";
import RightRail from "../components/terminal/RightRail";
import DrawToolbar from "../components/terminal/DrawToolbar";
import ChartView from "../components/terminal/ChartView";
import RightPanel from "../components/terminal/RightPanel";
import Watchlist from "../components/terminal/Watchlist";
import AlarmsPanel from "../components/terminal/AlarmsPanel";
import FuturesData from "../components/terminal/FuturesData";
import IndicatorsDialog from "../components/terminal/IndicatorsDialog";

const DEFAULT_LAYOUT = { panelOpen: true, width: 440, magnet: true, modules: { watchlist: { open: true, height: 380 }, alarms: { open: true, height: 190 }, futures: { open: true } } };
const DEFAULT_FAV = { tab: "all", groups: [{ id: "fav", name: "Favoriler", symbols: ["BTCUSDT", "ETHUSDT", "SOLUSDT"] }] };

function useMedia(q) {
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => { const mq = window.matchMedia(q); const f = () => setM(mq.matches); mq.addEventListener("change", f); return () => mq.removeEventListener("change", f); }, [q]);
  return m;
}

function useTickers() {
  const ref = useRef({});
  const [tickers, setTickers] = useState({});
  useEffect(() => {
    const load = () =>
      http
        .get("/market/tickers")
        .then(({ data }) => {
          if (!data || typeof data !== "object") return;
          Object.entries(data).forEach(([s, t]) => {
            ref.current[s] = { ...ref.current[s], ...t };
          });
        })
        .catch(() => {});
    load();
    const u1 = market.subscribe("!ticker@arr", (arr) => arr.forEach((t) => { ref.current[t.s] = { ...ref.current[t.s], c: t.c, P: t.P, qv: t.q }; }));
    const u2 = market.subscribe("!markPrice@arr@1s", (arr) => arr.forEach((t) => { ref.current[t.s] = { ...ref.current[t.s], r: t.r, T: t.T }; }));
    const flush = setInterval(() => setTickers({ ...ref.current }), 1000);
    const poll = setInterval(() => !market.open && load(), 5000);
    return () => { u1(); u2(); clearInterval(flush); clearInterval(poll); };
  }, []);
  return [tickers, ref];
}

export default function Terminal() {
  const [symbols, setSymbols] = useState([]);
  const [settings, setSettings] = useState(null);
  const [drawings, setDrawings] = useState([]);
  const [alarms, setAlarms] = useState([]);
  const [tool, setTool] = useState("cursor");
  const [selectedId, setSelectedId] = useState(null);
  const [indOpen, setIndOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [mobileMod, setMobileMod] = useState("watchlist");
  const [live, setLive] = useState(false);
  const [tickers, tickersRef] = useTickers();
  const isMobile = useMedia("(max-width: 767px)");
  const pending = useRef({}), timer = useRef(null), symRef = useRef(null), soundRef = useRef(true);

  const symMap = useMemo(() => Object.fromEntries(symbols.map((s) => [s.symbol, s])), [symbols]);
  const symbol = settings?.last_symbol || "BTCUSDT";
  const tf = settings?.last_tf || "15m";
  const layout = { ...DEFAULT_LAYOUT, ...(settings?.layout || {}) };
  const favorites = useMemo(() => {
    const f = settings?.favorites || DEFAULT_FAV;
    const groups = (f.groups || []).filter((g) => g && g.id && Array.isArray(g.symbols));
    if (!groups.some((g) => g.id === "fav")) groups.unshift(DEFAULT_FAV.groups[0]);
    return { tab: f.tab || "all", groups };
  }, [settings?.favorites]);
  const epochCfg = useMemo(() => ({ ...EPOCH_DEFAULTS, ...(settings?.indicators?.epoch || {}) }), [settings?.indicators?.epoch]);
  const cakmaCfg = useMemo(() => ({ ...CAKMA_DEFAULTS, ...(settings?.indicators?.cakma || {}) }), [settings?.indicators?.cakma]);
  symRef.current = symbol;
  const symMapRef = useRef({});
  symMapRef.current = symMap;
  soundRef.current = settings?.sound !== false;

  const loadSettings = useCallback(
    () => http.get("/settings").then(({ data }) => setSettings(data && typeof data === "object" ? data : {})),
    []
  );
  const loadAlarms = useCallback(
    () =>
      http
        .get("/alarms")
        .then(({ data }) => {
          if (Array.isArray(data)) setAlarms(data);
        })
        .catch(() => {}),
    []
  );

  const patch = useCallback((p) => {
    setSettings((s) => ({ ...s, ...p }));
    Object.assign(pending.current, p);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { const body = pending.current; pending.current = {}; http.patch("/settings", body).catch(() => toast.error("Ayarlar kaydedilemedi")); }, 400);
  }, []);

  useEffect(() => {
    loadSettings().catch(() => setSettings({}));
    http
      .get("/market/symbols")
      .then(({ data }) => {
        if (Array.isArray(data)) setSymbols(data);
      })
      .catch(() => {});
    loadAlarms();
    refreshPushIfGranted();
    return market.onStatus(setLive);
  }, [loadSettings, loadAlarms]);

  useEffect(() => {
    if (!settings) return;
    http
      .get("/drawings", { params: { symbol } })
      .then(({ data }) => {
        if (Array.isArray(data)) setDrawings(data);
      })
      .catch(() => {});
  }, [symbol, !!settings]); // eslint-disable-line

  // cross-device sync socket
  useEffect(() => {
    let ws, closed = false, retry;
    const connect = () => {
      if (closed || !BACKEND_URL) return;
      ws = new WebSocket(`${BACKEND_URL.replace(/^http/, "ws")}/api/ws?client_id=${CLIENT_ID}`);
      ws.onmessage = (ev) => {
        const m = JSON.parse(ev.data);
        if (m.type === "settings") loadSettings().catch(() => {});
        if (m.type === "alarms") loadAlarms();
        if (m.type === "drawing_upsert" && m.drawing.symbol === symRef.current) setDrawings((l) => [...l.filter((d) => d.id !== m.drawing.id), m.drawing]);
        if (m.type === "drawing_delete") setDrawings((l) => l.filter((d) => d.id !== m.id));
        if (m.type === "alarm_triggered") {
          const a = m.alarm;
          if (soundRef.current) beep();
          toast.warning(`${a.symbol} alarmı tetiklendi`, { description: `Fiyat ${a.price_str} seviyesine ulaştı (son: ${fmtPrice(a.trigger_price, symMapRef.current[a.symbol]?.precision ?? 2)})`, duration: 12000 });
          loadAlarms();
        }
      };
      ws.onclose = () => { if (!closed) retry = setTimeout(connect, 3000); };
    };
    connect();
    const ping = setInterval(() => ws && ws.readyState === 1 && ws.send("ping"), 25000);
    return () => { closed = true; clearTimeout(retry); clearInterval(ping); ws && ws.close(); };
  }, [loadSettings, loadAlarms]);

  useEffect(() => { setSelectedId(null); setTool("cursor"); }, [symbol, tf]);
  const t = tickers[symbol];
  useEffect(() => { if (t?.c) document.title = `${symbol} ${fmtPrice(t.c, symMap[symbol]?.precision ?? 2)} · Epochveras`; }, [t?.c, symbol, symMap]);

  const saveDrawing = useCallback((d) => {
    setDrawings((l) => [...l.filter((x) => x.id !== d.id), d]);
    const { id, symbol: s, type, points, style } = d;
    http.put(`/drawings/${id}`, { id, symbol: s, type, points, style }).catch(() => toast.error("Çizim kaydedilemedi"));
  }, []);
  const deleteDrawing = useCallback((id) => { setDrawings((l) => l.filter((x) => x.id !== id)); http.delete(`/drawings/${id}`).catch(() => {}); }, []);
  const clearDrawings = () => {
    if (!drawings.length || !window.confirm(`${symbol} üzerindeki ${drawings.length} çizim silinsin mi?`)) return;
    drawings.forEach((d) => deleteDrawing(d.id));
  };
  const settingsRef = useRef(null);
  settingsRef.current = settings;
  const styleUsed = useCallback((type, style) => {
    patch({ drawing_styles: { ...(settingsRef.current?.drawing_styles || {}), [type]: { color: style.color, width: style.width } } });
  }, [patch]);
  const addAlarm = useCallback(async (price) => {
    const prec = symMap[symRef.current]?.precision ?? 2;
    try {
      const { data } = await http.post("/alarms", { symbol: symRef.current, price, price_str: fmtPrice(price, prec) });
      if (data && data.id) {
        setAlarms((l) => [data, ...l]);
        toast.success(`Alarm kuruldu: ${data.symbol} ${data.price_str}`);
      } else {
        toast.error("Alarm kurulamadı");
      }
    } catch (e) { toast.error("Alarm kurulamadı"); }
  }, [symMap]);
  const deleteAlarm = useCallback((id) => { setAlarms((l) => l.filter((a) => a.id !== id)); http.delete(`/alarms/${id}`).catch(() => {}); }, []);
  const clearTriggered = () => { setAlarms((l) => l.filter((a) => a.status === "active")); http.delete("/alarms").catch(() => {}); };

  const selectSymbol = (s) => { patch({ last_symbol: s }); if (isMobile) setSheet(false); };
  const setInd = (k, v) => patch({ indicators: { ...(settings?.indicators || {}), [k]: v } });
  const setLayout = (p) => patch({ layout: { ...layout, ...p } });

  const mods = layout.modules || {};
  const anyOpen = Object.values(mods).some((m) => m?.open);
  const railToggle = (k) => {
    if (isMobile) {
      if (sheet && mobileMod === k) return setSheet(false);
      setMobileMod(k);
      return setSheet(true);
    }
    setLayout({ modules: { ...mods, [k]: { ...mods[k], open: !mods[k]?.open, collapsed: false } } });
  };
  const renderModule = (k) => {
    if (k === "watchlist") return <Watchlist symbols={symbols} tickers={tickers} favorites={favorites} onFavorites={(f) => patch({ favorites: f })} symbol={symbol} onSelect={selectSymbol} />;
    if (k === "alarms") return <AlarmsPanel alarms={alarms} symMap={symMap} onDelete={deleteAlarm} onClear={clearTriggered} sound={settings?.sound !== false} setSound={(v) => patch({ sound: v })} onSelect={selectSymbol} />;
    return <FuturesData symbol={symbol} meta={symMap[symbol]} ticker={t} />;
  };

  if (!settings) return <div className="h-dvh bg-black flex items-center justify-center text-[#787B86] text-xs" data-testid="terminal-loading">Terminal yükleniyor…</div>;
  void tickersRef;

  return (
    <div className="h-dvh flex flex-col bg-black text-[#E0E3EB] overflow-hidden" data-testid="terminal">
      <TerminalHeader symbol={symbol} meta={symMap[symbol]} ticker={t} tf={tf} setTf={(v) => patch({ last_tf: v })} onIndicators={() => setIndOpen(true)}
        symbols={symbols} tickers={tickers} onSymbol={selectSymbol} onAlarm={addAlarm} live={live} />
      <div className="flex flex-1 min-h-0">
        <DrawToolbar tool={tool} setTool={setTool} magnet={layout.magnet} setMagnet={(v) => setLayout({ magnet: v })} onClear={clearDrawings} />
        <main className="flex-1 min-w-0 min-h-0">
          <ChartView symbol={symbol} tf={tf} meta={symMap[symbol]} epochCfg={epochCfg} cakmaCfg={cakmaCfg} drawings={drawings} tool={tool} setTool={setTool}
            magnet={layout.magnet} styles={settings.drawing_styles || {}} selectedId={selectedId} setSelectedId={setSelectedId}
            onSaveDrawing={saveDrawing} onDeleteDrawing={deleteDrawing} onStyleUsed={styleUsed} alarms={alarms} onAddAlarm={addAlarm} onDeleteAlarm={deleteAlarm} />
        </main>
        {!isMobile && anyOpen && <RightPanel layout={layout} onLayout={setLayout} render={renderModule} />}
        <RightRail isOpen={(k) => (isMobile ? sheet && mobileMod === k : anyOpen && mods[k]?.open)} onToggle={railToggle} alarmCount={alarms.filter((a) => a.status === "active").length} />
      </div>
      {isMobile && sheet && (
        <div className="fixed inset-x-0 bottom-0 z-40 h-[68vh] bg-black border-t border-white/10 flex flex-col sheet-in" data-testid="mobile-panel-sheet">
          <div className="h-7 shrink-0 flex items-center justify-between px-3">
            <div className="mx-auto h-1 w-10 rounded-full bg-white/20" />
            <button onClick={() => setSheet(false)} className="absolute right-2 h-7 w-7 flex items-center justify-center text-[#787B86]" data-testid="mobile-panel-close"><X size={16} /></button>
          </div>
          <div className="flex-1 min-h-0" data-testid={`mobile-sheet-${mobileMod}`}>{renderModule(mobileMod)}</div>
        </div>
      )}
      <IndicatorsDialog open={indOpen} onOpenChange={setIndOpen} epoch={epochCfg} cakma={cakmaCfg} setEpoch={(v) => setInd("epoch", v)} setCakma={(v) => setInd("cakma", v)} />
    </div>
  );
}
