import { useEffect, useState } from "react";
import { http, fmtPrice, fmtCountdown } from "../../lib/api";

function Ratio({ title, d, testid }) {
  const L = d ? Number(d.longAccount) * 100 : null, S = d ? Number(d.shortAccount) * 100 : null;
  return (
    <div className="px-3 py-2" data-testid={testid}>
      <div className="flex justify-between text-[10px] uppercase tracking-wider text-[#787B86] mb-1.5">
        <span>{title}</span>
        <span className="font-mono-num text-white normal-case text-xs">{d ? Number(d.longShortRatio).toFixed(4) : "—"}</span>
      </div>
      <div className="flex h-6 w-full overflow-hidden rounded-sm">
        <div className="bg-[#089981] flex items-center pl-1.5 text-[10px] font-mono-num text-white transition-[width] duration-500" style={{ width: `${L ?? 50}%` }}>{L !== null && `${L.toFixed(2)}%`}</div>
        <div className="bg-[#F23645] flex items-center justify-end pr-1.5 text-[10px] font-mono-num text-white flex-1">{S !== null && `${S.toFixed(2)}%`}</div>
      </div>
    </div>
  );
}

export default function FuturesData({ symbol, meta, ticker }) {
  const [d, setD] = useState(null);
  const [, force] = useState(0);
  useEffect(() => {
    let alive = true;
    setD(null);
    const load = () => http.get(`/market/futures/${symbol}`, { params: { period: "5m" } }).then(({ data }) => alive && setD(data)).catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => { alive = false; clearInterval(t); };
  }, [symbol]);
  useEffect(() => { const t = setInterval(() => force((x) => x + 1), 1000); return () => clearInterval(t); }, []);
  const rate = ticker?.r ?? d?.fundingRate;
  const next = ticker?.T ?? d?.nextFundingTime;
  const prec = meta?.precision ?? 2;
  const item = (label, value, cls = "text-[#E0E3EB]", testid) => (
    <div className="flex justify-between items-baseline px-3 py-1.5" data-testid={testid}>
      <span className="text-[11px] text-[#787B86]">{label}</span>
      <span className={`font-mono-num text-xs ${cls}`}>{value}</span>
    </div>
  );
  return (
    <div className="h-full overflow-y-auto" data-testid="futures-data-panel">
      <div className="flex items-center gap-1 px-2 h-8 border-b border-white/[0.06]">
        <span className="text-[11px] font-semibold text-[#E0E3EB] flex-1">{symbol}</span>
      </div>
      {item("Funding rate", rate !== undefined && rate !== null ? `${(Number(rate) * 100).toFixed(4)}% (${meta?.fundingHours ?? 8}s)` : "—", Number(rate) >= 0 ? "text-[#089981]" : "text-[#F23645]", "futures-funding-rate")}
      {item("Sonraki funding", next ? `${fmtCountdown(Number(next) - Date.now())} · ${new Date(Number(next)).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}` : "—", "text-[#E0E3EB]", "futures-next-funding")}
      {item("Mark fiyat", fmtPrice(d?.markPrice, prec), "text-[#E0E3EB]", "futures-mark-price")}
      {item("Open interest", d?.openInterest ? `${fmtPrice(d.openInterest, 0)} ${meta?.base || ""}` : "—", "text-[#E0E3EB]", "futures-open-interest")}
      {item("OI değeri", d?.openInterestValue ? `$${fmtPrice(d.openInterestValue, 0)}` : "—", "text-[#E0E3EB]", "futures-open-interest-value")}
      <div className="h-px bg-white/[0.06] my-1" />
      <Ratio title="Long/Short Ratio (hesap)" d={d?.account} testid="futures-account-ratio" />
      <Ratio title="Top trader Long/Short (hesap)" d={d?.topAccount} testid="futures-top-account-ratio" />
      <Ratio title="Top trader Long/Short (pozisyon)" d={d?.top} testid="futures-top-position-ratio" />
      {!d && <div className="px-3 py-2 text-[11px] text-[#787B86]" data-testid="futures-loading">Veriler yükleniyor…</div>}
    </div>
  );
}
