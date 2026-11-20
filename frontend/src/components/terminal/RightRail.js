import { List, AlarmClock, Activity } from "lucide-react";

const ITEMS = [["watchlist", List, "Watchlist"], ["alarms", AlarmClock, "Alarmlar"], ["futures", Activity, "Futures Data"]];

export default function RightRail({ isOpen, onToggle, alarmCount }) {
  return (
    <nav className="w-11 shrink-0 border-l border-white/[0.08] bg-black flex flex-col items-center gap-1 py-2" data-testid="right-rail">
      {ITEMS.map(([k, Icon, label]) => (
        <button key={k} onClick={() => onToggle(k)} title={label} data-testid={`panel-toggle-${k}`}
          className={`relative h-9 w-9 flex items-center justify-center rounded-sm transition-colors ${isOpen(k) ? "bg-white/10 text-white" : "text-[#787B86] hover:text-white hover:bg-white/5"}`}>
          <Icon size={18} strokeWidth={1.6} />
          {k === "alarms" && alarmCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-0.5 rounded-full bg-[#F5A623] text-black text-[9px] font-bold flex items-center justify-center" data-testid="rail-alarm-badge">{alarmCount}</span>
          )}
        </button>
      ))}
    </nav>
  );
}

