import { useMemo, useRef, useState } from "react";
import { Star, Plus, Search, MoreVertical, Trash2, ArrowDown, ArrowUp } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { fmtPrice, fmtPct, fmtVol } from "../../lib/api";

const ROW = 30;
const COLS = [["symbol", "Sembol", "text-left"], ["c", "Son", "text-right"], ["P", "%", "text-right"], ["qv", "Hacim", "text-right"], ["r", "Funding", "text-right"]];

export default function Watchlist({ symbols, tickers, favorites, onFavorites, symbol, onSelect }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState({ key: "qv", dir: -1 });
  const [scroll, setScroll] = useState(0);
  const [viewH, setViewH] = useState(400);
  const [newGroup, setNewGroup] = useState(null);
  const boxRef = useRef(null);
  const prevRef = useRef({});
  const groups = favorites.groups;
  const tab = favorites.tab || "all";
  const fav = groups.find((g) => g.id === "fav");
  const tabs = [{ id: "all", name: "Tümü" }, ...groups, { id: "commodity", name: "Emtia" }];

  const rows = useMemo(() => {
    let list = symbols;
    if (tab === "commodity") list = symbols.filter((s) => s.category === "commodity");
    else if (tab !== "all") {
      const g = groups.find((x) => x.id === tab);
      const set = new Set(g?.symbols || []);
      list = symbols.filter((s) => set.has(s.symbol));
    }
    if (q) list = list.filter((s) => s.symbol.includes(q.toUpperCase()));
    const val = (s) => (sort.key === "symbol" ? s.symbol : Number(tickers[s.symbol]?.[sort.key] ?? -Infinity));
    return [...list].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir);
  }, [symbols, tickers, tab, groups, q, sort]);

  const setTab = (t) => { onFavorites({ ...favorites, tab: t }); setScroll(0); if (boxRef.current) boxRef.current.scrollTop = 0; };
  const toggleIn = (gid, sym) => onFavorites({ ...favorites, groups: groups.map((g) => (g.id === gid ? { ...g, symbols: g.symbols.includes(sym) ? g.symbols.filter((s) => s !== sym) : [...g.symbols, sym] } : g)) });
  const addGroup = () => {
    const name = (newGroup || "").trim();
    if (!name) return setNewGroup(null);
    const id = `g${Date.now()}`;
    onFavorites({ ...favorites, groups: [...groups, { id, name, symbols: [] }], tab: id });
    setNewGroup(null);
  };
  const delGroup = (id) => onFavorites({ ...favorites, groups: groups.filter((g) => g.id !== id), tab: "all" });

  const start = Math.max(0, Math.floor(scroll / ROW) - 5);
  const end = Math.min(rows.length, start + Math.ceil(viewH / ROW) + 10);

  return (
    <div className="h-full flex flex-col" data-testid="watchlist">
      <div className="flex items-center border-b border-white/[0.06] overflow-x-auto no-scrollbar shrink-0">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} data-testid={`watchlist-tab-${t.id}`}
            className={`h-8 px-2.5 text-[11px] font-semibold whitespace-nowrap border-b-2 transition-colors ${tab === t.id ? "border-white text-white" : "border-transparent text-[#787B86] hover:text-[#E0E3EB]"}`}>
            {t.id === "fav" && <Star size={10} className="inline mr-1 -mt-0.5" fill="currentColor" />}{t.name}
          </button>
        ))}
        {newGroup === null ? (
          <button onClick={() => setNewGroup("")} className="h-8 w-8 shrink-0 flex items-center justify-center text-[#787B86] hover:text-[#E0E3EB]" title="Yeni favori grubu" data-testid="watchlist-add-group-button"><Plus size={14} /></button>
        ) : (
          <input autoFocus value={newGroup} onChange={(e) => setNewGroup(e.target.value)} onKeyDown={(e) => e.key === "Enter" ? addGroup() : e.key === "Escape" && setNewGroup(null)} onBlur={addGroup}
            placeholder="Grup adı" className="h-6 w-24 mx-1 bg-[#141414] border border-white/10 px-1.5 text-[11px] text-[#E0E3EB] outline-none focus:border-white/40" data-testid="watchlist-new-group-input" />
        )}
      </div>
      <div className="flex items-center gap-2 px-2 h-8 border-b border-white/[0.06] shrink-0">
        <Search size={13} className="text-[#787B86]" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Sembol ara" className="flex-1 bg-transparent text-xs text-[#E0E3EB] outline-none placeholder:text-[#434651]" data-testid="watchlist-search-input" />
        {tab.startsWith("g") && (
          <button onClick={() => delGroup(tab)} className="text-[10px] flex items-center gap-1 text-[#787B86] hover:text-[#F23645]" data-testid="watchlist-delete-group-button"><Trash2 size={11} /> Grubu sil</button>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-auto" ref={(n) => { boxRef.current = n; if (n && n.clientHeight !== viewH) setViewH(n.clientHeight); }} onScroll={(e) => setScroll(e.currentTarget.scrollTop)} data-testid="watchlist-scroll">
        <div className="min-w-[430px]">
          <div className="sticky top-0 z-10 grid grid-cols-[28px_1.3fr_1.2fr_0.8fr_0.9fr_1.1fr_22px] h-7 items-center bg-[#0A0A0A] text-[10px] text-[#787B86] uppercase tracking-wider border-b border-white/[0.06]">
            <span />
            {COLS.map(([k, l, al]) => (
              <button key={k} onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? -s.dir : -1 }))} className={`${al} px-1 whitespace-nowrap hover:text-[#E0E3EB] flex items-center gap-0.5 ${al === "text-right" ? "justify-end" : ""}`} data-testid={`watchlist-sort-${k}`}>
                {l}{sort.key === k && (sort.dir > 0 ? <ArrowUp size={9} /> : <ArrowDown size={9} />)}
              </button>
            ))}
            <span />
          </div>
          <div style={{ height: rows.length * ROW, position: "relative" }}>
            {rows.slice(start, end).map((s, k) => {
              const t = tickers[s.symbol] || {};
              const pct = Number(t.P || 0), starred = fav?.symbols.includes(s.symbol);
              const prev = prevRef.current[s.symbol];
              let flash = "";
              if (prev && t.c && prev.c !== t.c && fmtPrice(prev.c, s.precision) !== fmtPrice(t.c, s.precision)) flash = Number(t.c) > Number(prev.c) ? "flash-up" : "flash-down";
              else if (prev && Date.now() - prev.at < 900) flash = prev.flash;
              if (t.c && (!prev || prev.c !== t.c)) prevRef.current[s.symbol] = { c: t.c, flash: prev ? flash : "", at: Date.now() };
              const custom = groups.filter((g) => g.id !== "fav");
              return (
                <div key={s.symbol} onClick={() => onSelect(s.symbol)} style={{ position: "absolute", top: (start + k) * ROW, left: 0, right: 0, height: ROW }}
                  className={`grid grid-cols-[28px_1.3fr_1.2fr_0.8fr_0.9fr_1.1fr_22px] items-center cursor-pointer text-[11px] whitespace-nowrap transition-colors ${s.symbol === symbol ? "bg-white/[0.07]" : "hover:bg-white/5"}`} data-testid={`watchlist-row-${s.symbol}`}>
                  <button onClick={(e) => { e.stopPropagation(); toggleIn("fav", s.symbol); }} className={`flex justify-center ${starred ? "text-[#F5A623]" : "text-[#434651] hover:text-[#787B86]"}`} data-testid={`watchlist-star-${s.symbol}`}>
                    <Star size={12} fill={starred ? "currentColor" : "none"} />
                  </button>
                  <span className="px-1 font-semibold text-[#E0E3EB] truncate">{s.symbol.replace(/USDT$/, "")}<span className="text-[#434651] font-normal">USDT</span></span>
                  <span className="px-1 text-right"><span key={t.c} className={`font-mono-num text-[#E0E3EB] px-0.5 rounded-[2px] ${flash}`} data-testid={`watchlist-price-${s.symbol}`}>{fmtPrice(t.c, s.precision)}</span></span>
                  <span className={`px-1 text-right font-mono-num ${pct >= 0 ? "text-[#089981]" : "text-[#F23645]"}`}>{fmtPct(t.P)}</span>
                  <span className="px-1 text-right font-mono-num text-[#787B86]">{fmtVol(t.qv)}</span>
                  <span className={`px-1 text-right font-mono-num ${Number(t.r) >= 0 ? "text-[#089981]" : "text-[#F23645]"}`}>
                    {t.r !== undefined && t.r !== null ? `${(Number(t.r) * 100).toFixed(4)}%` : "—"}<span className="text-[#787B86]"> ({s.fundingHours}s)</span>
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button onClick={(e) => e.stopPropagation()} className="flex justify-center text-[#434651] hover:text-[#E0E3EB]" data-testid={`watchlist-row-menu-${s.symbol}`}><MoreVertical size={13} /></button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent onClick={(e) => e.stopPropagation()} className="bg-[#0A0A0A] border-white/10 text-[#E0E3EB] text-xs">
                      <DropdownMenuLabel className="text-[10px] text-[#787B86]">Favori grupları</DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-white/10" />
                      {[fav, ...custom].filter(Boolean).map((g) => (
                        <DropdownMenuItem key={g.id} onSelect={() => toggleIn(g.id, s.symbol)} className="text-xs focus:bg-white/5 focus:text-white" data-testid={`watchlist-group-toggle-${g.id}-${s.symbol}`}>
                          {g.symbols.includes(s.symbol) ? "✓ " : ""}{g.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
          {!rows.length && <div className="p-4 text-xs text-[#787B86]" data-testid="watchlist-empty">{tab === "all" || tab === "commodity" ? "Sonuç yok" : "Bu grup boş. Yıldız veya ⋮ menüsünden sembol ekleyin."}</div>}
        </div>
      </div>
    </div>
  );
}
