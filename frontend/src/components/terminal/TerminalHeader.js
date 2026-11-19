import { useMemo, useState } from "react";
import { Search, AlarmClock, FunctionSquare } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { TIMEFRAMES, fmtPrice, fmtPct, roundTick } from "../../lib/api";

const sep = <span className="w-px h-5 bg-white/[0.08] mx-1 shrink-0" />;
const utc = () => { const o = -new Date().getTimezoneOffset() / 60; return `UTC${o >= 0 ? "+" : ""}${o}`; };

function SymbolSearch({ symbol, symbols, tickers, onSymbol }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const Q = q.toUpperCase();
    return symbols.filter((s) => !Q || s.symbol.includes(Q)).sort((a, b) => Number(tickers[b.symbol]?.qv || 0) - Number(tickers[a.symbol]?.qv || 0)).slice(0, 60);
  }, [q, symbols, tickers]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="h-8 px-2 flex items-center gap-2 rounded-sm hover:bg-white/5 transition-colors shrink-0" data-testid="symbol-search-button">
          <Search size={15} className="text-[#787B86]" />
          <span className="font-semibold text-sm text-[#E0E3EB]" data-testid="current-symbol">{symbol}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0 bg-[#0F0F0F] border-white/10 text-[#E0E3EB]" data-testid="symbol-search-popover">
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Sembol ara…" className="w-full h-10 px-3 bg-transparent border-b border-white/10 text-sm outline-none" data-testid="symbol-search-input" />
        <div className="max-h-80 overflow-y-auto py-1">
          {list.map((s) => {
            const t = tickers[s.symbol] || {};
            return (
              <button key={s.symbol} onClick={() => { onSymbol(s.symbol); setOpen(false); setQ(""); }} className="w-full flex items-center justify-between px-3 h-8 text-xs hover:bg-white/5" data-testid={`symbol-search-item-${s.symbol}`}>
                <span className="font-semibold">{s.symbol}<span className="text-[#787B86] font-normal ml-1">{s.category === "commodity" ? "Emtia" : "Perp"}</span></span>
                <span className="font-mono-num">{fmtPrice(t.c, s.precision)} <span className={Number(t.P) >= 0 ? "text-[#089981]" : "text-[#F23645]"}>{fmtPct(t.P)}</span></span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AlarmPopover({ symbol, meta, ticker, onAlarm }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  const parse = (v) => Number(v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v);
  const submit = () => {
    const p = parse(val.trim());
    if (!p || p <= 0) return;
    onAlarm(roundTick(p, meta?.tick || 0.01));
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setVal(fmtPrice(ticker?.c, meta?.precision ?? 2)); }}>
      <PopoverTrigger asChild>
        <button className="h-8 px-2 flex items-center gap-1.5 text-[13px] text-[#D1D4DC] hover:bg-white/5 rounded-sm transition-colors shrink-0" data-testid="header-alarm-button">
          <AlarmClock size={16} strokeWidth={1.6} /> <span className="hidden md:inline">Alarm</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 bg-[#0F0F0F] border-white/10 text-[#E0E3EB] p-3 space-y-2" data-testid="header-alarm-popover">
        <div className="text-xs text-[#787B86]">{symbol} · Son fiyat alarmı (tek seferlik)</div>
        <input value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} className="w-full h-9 px-2 bg-black border border-white/10 text-sm font-mono-num outline-none focus:border-white/40" data-testid="header-alarm-price-input" />
        <button onClick={submit} className="w-full h-8 bg-[#E0E3EB] text-black text-xs font-semibold hover:bg-white transition-colors" data-testid="header-alarm-submit">Alarm oluştur</button>
      </PopoverContent>
    </Popover>
  );
}

export default function TerminalHeader({ symbol, meta, ticker, tf, setTf, onIndicators, symbols, tickers, onSymbol, onAlarm, live }) {
  return (
    <header className="h-11 shrink-0 border-b border-white/[0.08] bg-black flex items-center gap-1 px-2" data-testid="top-bar">
      <div className="flex items-center gap-2 pr-2 shrink-0" data-testid="header-logo">
        <img src="/logo-mark.png" alt="Epochveras" className="h-[18px] w-auto" />
        <span className="hidden sm:inline font-semibold text-[15px] text-[#E0E3EB] tracking-tight">Epochveras</span>
      </div>
      {sep}
      <SymbolSearch symbol={symbol} symbols={symbols} tickers={tickers} onSymbol={onSymbol} />
      {sep}
      <div className="min-w-0 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-0.5 w-max" data-testid="timeframe-bar">
          {TIMEFRAMES.map((t) => (
            <button key={t.key} onClick={() => setTf(t.key)} data-testid={`tf-${t.key}`}
              className={`h-8 px-2 text-[13px] rounded-sm transition-colors ${tf === t.key ? "text-white bg-white/10 font-semibold" : "text-[#B2B5BE] hover:text-white hover:bg-white/5"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {sep}
      <button onClick={onIndicators} className="h-8 px-2 flex items-center gap-1.5 text-[13px] text-[#D1D4DC] hover:bg-white/5 rounded-sm transition-colors shrink-0" data-testid="indicators-button">
        <FunctionSquare size={16} strokeWidth={1.6} /> <span className="hidden md:inline">Göstergeler</span>
      </button>
      {sep}
      <AlarmPopover symbol={symbol} meta={meta} ticker={ticker} onAlarm={onAlarm} />
      <div className="flex-1" />
      <span className="hidden md:flex items-center gap-1.5 text-[11px] text-[#787B86] shrink-0" data-testid="stream-status" title={live ? "Canlı akış bağlı" : "Yoklama modunda"}>
        <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-[#089981]" : "bg-[#F5A623]"}`} />{live ? "Canlı" : "Yoklama"} · {utc()}
      </span>
    </header>
  );
}

