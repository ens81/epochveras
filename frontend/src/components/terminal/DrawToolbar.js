import { Crosshair, Slash, MoveRight, Ruler, Magnet, Trash2 } from "lucide-react";

const Template = (top, bottom) => function TemplateIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <rect x="2.5" y="3" width="13" height="5.5" fill={top} opacity="0.9" />
      <rect x="2.5" y="9.5" width="13" height="5.5" fill={bottom} opacity="0.9" />
      <line x1="2.5" y1="9" x2="15.5" y2="9" stroke="#D1D4DC" strokeWidth="1" />
    </svg>
  );
};
const LongIcon = Template("#089981", "#F23645");
const ShortIcon = Template("#F23645", "#089981");
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "../ui/tooltip";


const TOOLS = [
  ["cursor", Crosshair, "İmleç"],
  ["trendline", Slash, "Trendline"],
  ["hray", MoveRight, "Yatay ışın"],
  ["long", LongIcon, "Long pozisyon (alım şablonu)"],
  ["short", ShortIcon, "Short pozisyon (satım şablonu)"],
  ["ruler", Ruler, "Cetvel / ölçüm"],
];

const Btn = ({ active, onClick, icon: Icon, label, testid, danger }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button onClick={onClick} data-testid={testid}
        className={`h-10 w-10 md:h-9 md:w-9 flex items-center justify-center rounded-sm transition-colors ${active ? "bg-white/10 text-white" : danger ? "text-[#787B86] hover:text-[#F23645] hover:bg-white/5" : "text-[#787B86] hover:text-[#E0E3EB] hover:bg-white/5"}`}>
        <Icon size={18} strokeWidth={1.5} />
      </button>
    </TooltipTrigger>
    <TooltipContent side="right" className="bg-[#1C1C1E] text-[#E0E3EB] border-white/10 text-xs">{label}</TooltipContent>
  </Tooltip>
);

export default function DrawToolbar({ tool, setTool, magnet, setMagnet, onClear }) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="w-11 md:w-12 shrink-0 border-r border-white/[0.08] bg-black flex flex-col items-center gap-1 py-2 overflow-y-auto" data-testid="draw-toolbar">
        {TOOLS.map(([k, icon, label]) => (
          <Btn key={k} active={tool === k} onClick={() => setTool(k)} icon={icon} label={label} testid={`tool-${k}`} />
        ))}
        <div className="w-6 h-px bg-white/10 my-1" />
        <Btn active={magnet} onClick={() => setMagnet(!magnet)} icon={Magnet} label={magnet ? "Yumuşak mıknatıs: açık" : "Yumuşak mıknatıs: kapalı"} testid="tool-magnet" />
        <Btn onClick={onClear} icon={Trash2} label="Bu semboldeki tüm çizimleri sil" testid="tool-clear-drawings" danger />
      </div>
    </TooltipProvider>
  );
}
