import { useRef, useState } from "react";
import { List, Bell, Activity, X, ChevronDown, ChevronUp, ChevronsLeft, ChevronsRight } from "lucide-react";

export const MODS = { watchlist: { title: "Watchlist", icon: List }, alarms: { title: "Alarmlar", icon: Bell }, futures: { title: "Futures Data", icon: Activity } };
const ORDER = ["watchlist", "alarms", "futures"];

function Module({ k, cfg, last, onPatch, children }) {
  const ref = useRef(null);
  const [drag, setDrag] = useState(null);
  const h = drag ?? cfg.height ?? 260;
  const startResize = (e) => {
    const y0 = e.clientY, h0 = h;
    let cur = h0;
    const mv = (ev) => { cur = Math.max(80, Math.min(900, h0 + ev.clientY - y0)); setDrag(cur); };
    const upf = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", upf); setDrag(null); onPatch({ height: cur }); };
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", upf);
  };
  const M = MODS[k];
  const style = cfg.collapsed ? {} : last ? { flex: "1 1 0", minHeight: 80 } : { height: h };
  return (
    <section ref={ref} className="relative flex flex-col min-h-0 border-b border-white/[0.08] shrink-0" style={style} data-testid={`module-${k}`}>
      <div className="h-8 shrink-0 flex items-center gap-2 px-2 bg-[#0A0A0A] border-b border-white/[0.06]">
        <M.icon size={13} className="text-[#787B86]" />
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#E0E3EB] flex-1">{M.title}</span>
        <button onClick={() => onPatch({ collapsed: !cfg.collapsed })} className="h-6 w-6 flex items-center justify-center text-[#787B86] hover:text-[#E0E3EB] rounded-sm" data-testid={`module-${k}-collapse`}>
          {cfg.collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
        <button onClick={() => onPatch({ open: false })} className="h-6 w-6 flex items-center justify-center text-[#787B86] hover:text-[#F23645] rounded-sm" data-testid={`module-${k}-close`}><X size={14} /></button>
      </div>
      {!cfg.collapsed && <div className="flex-1 min-h-0 overflow-hidden">{children}</div>}
      {!cfg.collapsed && !last && (
        <div onPointerDown={startResize} className="absolute -bottom-1.5 left-0 right-0 h-3 cursor-row-resize z-10 group" data-testid={`module-${k}-resize`}>
          <div className="mx-auto mt-1 h-0.5 w-10 bg-white/0 group-hover:bg-white/50 transition-colors" />
        </div>
      )}
    </section>
  );
}

export default function RightPanel({ layout, onLayout, render, mobile }) {
  const [dragW, setDragW] = useState(null);
  const width = dragW ?? layout.width ?? 340;
  const mods = layout.modules || {};
  const patchMod = (k, p) => onLayout({ modules: { ...mods, [k]: { ...mods[k], ...p } } });
  const open = ORDER.filter((k) => mods[k]?.open);
  const lastExpanded = [...open].reverse().find((k) => !mods[k]?.collapsed);
  const setW = (w) => onLayout({ width: Math.max(260, Math.min(760, w)) });
  const startResize = (e) => {
    const x0 = e.clientX, w0 = width;
    let cur = w0;
    const mv = (ev) => { cur = Math.max(260, Math.min(760, w0 - (ev.clientX - x0))); setDragW(cur); };
    const upf = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", upf); setDragW(null); setW(cur); };
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", upf);
  };
  return (
    <aside className="relative shrink-0 flex flex-col bg-black border-l border-white/[0.08] min-h-0 h-full" style={mobile ? { width: "100%" } : { width }} data-testid="right-panel">
      {!mobile && <div onPointerDown={startResize} className="absolute -left-1.5 top-0 bottom-0 w-3 cursor-col-resize z-20 hover:bg-white/20 transition-colors" data-testid="right-panel-resize-handle" />}
      <div className="h-9 shrink-0 flex items-center gap-1 px-2 border-b border-white/[0.08] bg-[#0A0A0A]">
        <span className="text-[11px] text-[#787B86]">Panel</span>
        <div className="flex-1" />
        {!mobile && (
          <>
            <button onClick={() => setW(width + 80)} className="h-7 w-7 flex items-center justify-center text-[#787B86] hover:text-[#E0E3EB] rounded-sm" title="Genişlet" data-testid="right-panel-widen"><ChevronsLeft size={15} /></button>
            <button onClick={() => setW(width - 80)} className="h-7 w-7 flex items-center justify-center text-[#787B86] hover:text-[#E0E3EB] rounded-sm" title="Daralt" data-testid="right-panel-narrow"><ChevronsRight size={15} /></button>
          </>
        )}
      </div>
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
        {open.map((k) => (
          <Module key={k} k={k} cfg={mods[k]} last={k === lastExpanded} onPatch={(p) => patchMod(k, p)}>{render(k)}</Module>
        ))}
        {!open.length && <div className="p-6 text-xs text-[#787B86]" data-testid="right-panel-empty">Tüm modüller kapalı. Üstteki simgelerden açabilirsiniz.</div>}
      </div>
    </aside>
  );
}
