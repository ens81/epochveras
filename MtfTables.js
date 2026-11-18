import { useEffect, useState } from "react";
import { http } from "../../lib/api";
import { sfpState, pivotState } from "../../lib/epoch";

const SFP_TFS = [["30m", "30M"], ["1h", "1H"], ["2h", "2H"], ["4h", "4H"], ["1d", "1D"]];
const PIV_TFS = [["1m", "1M"], ["3m", "3M"], ["5m", "5M"], ["15m", "15M"], ["30m", "30M"], ["1h", "60M"]];
const col = (s) => (s === 1 ? "#00C853" : s === -1 ? "#D50000" : "#5D606B");

export default function MtfTables({ symbol, cfg, bottom }) {
  const [st, setSt] = useState({});
  const { sfpLen, sfpRight, freshBars, pivLeft, pivRight } = cfg;
  useEffect(() => {
    let alive = true;
    const run = async () => {
      const tfs = [...new Set([...SFP_TFS, ...PIV_TFS].map((t) => t[0]))];
      const res = await Promise.allSettled(tfs.map((tf) => http.get("/market/klines", { params: { symbol, interval: tf, limit: 500 } })));
      const out = {};
      res.forEach((r, i) => {
        if (r.status !== "fulfilled") return;
        const bars = r.value.data.map((k) => ({ time: k[0] / 1000, open: +k[1], high: +k[2], low: +k[3], close: +k[4] }));
        const ps = pivotState(bars, pivLeft, pivRight);
        out[tfs[i]] = { sfp: sfpState(bars, sfpLen, sfpRight, freshBars), piv: ps[ps.length - 1] };
      });
      if (alive) setSt(out);
    };
    run();
    const t = setInterval(run, 60000);
    return () => { alive = false; clearInterval(t); };
  }, [symbol, sfpLen, sfpRight, freshBars, pivLeft, pivRight]);

  return (
    <>
      <div className="absolute top-[84px] md:top-2 right-[100px] md:right-auto md:left-1/2 md:-translate-x-1/2 z-10 flex flex-col gap-[2px] pointer-events-none" data-testid="mtf-sfp-table">
        {SFP_TFS.map(([k, l]) => (
          <div key={k} className="w-[30px] text-center text-[7px] leading-[11px] font-semibold text-white rounded-[1px]" style={{ background: col(st[k]?.sfp) }}>{l}</div>
        ))}
      </div>
      <div className="absolute z-10 flex gap-[2px] pointer-events-none" style={{ right: 104, bottom }} data-testid="mtf-pivot-table">
        {PIV_TFS.map(([k, l]) => (
          <div key={k} className="w-[30px] text-center text-[7px] leading-[11px] font-semibold text-white rounded-[1px]" style={{ background: col(st[k]?.piv) }}>{l}</div>
        ))}
      </div>
    </>
  );
}
