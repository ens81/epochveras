import { useEffect, useState } from "react";
import { SignIn, SignUp } from "@clerk/react";
import { http, fmtPrice, fmtPct } from "../lib/api";

const SHOW = [["BTCUSDT", 1], ["ETHUSDT", 2], ["SOLUSDT", 3]];

const BG = "https://images.unsplash.com/photo-1585314062340-f1a5a7c9328d?crop=entropy&cs=srgb&fm=jpg&q=70&w=1600";

export default function AuthPage({ mode }) {
  const [tk, setTk] = useState({});
  useEffect(() => {
    const load = () => http.get("/market/tickers").then(({ data }) => setTk(data)).catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="min-h-dvh bg-black text-[#E0E3EB] flex" data-testid={`auth-page-${mode}`}>
      <div className="hidden lg:flex relative w-[46%] border-r border-white/[0.08] overflow-hidden flex-col justify-between p-12">
        <div className="absolute inset-0 opacity-[0.12] bg-cover bg-center" style={{ backgroundImage: `url(${BG})` }} />
        <div className="relative flex items-center gap-3">
          <img src="/logo-mark.png" alt="Epochveras" className="h-7 w-auto" data-testid="auth-logo" />
          <span className="font-bold text-lg tracking-tight">Epochveras</span>
        </div>
        <div className="relative max-w-md">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.02] tracking-tight">Perpetual<br />terminal.<br /><span className="text-[#787B86]">Hassas.</span></h1>
          <p className="mt-6 text-sm text-[#787B86] leading-relaxed">Binance USDT-M perpetual marketler için canlı grafik, 7/24 sunucu taraflı alarmlar ve cihazlar arası senkron çizimler.</p>
          <div className="mt-10 grid grid-cols-3 gap-px bg-white/[0.08] border border-white/[0.08] font-mono-num text-xs">
            {SHOW.map(([s, p]) => (
              <div key={s} className="bg-black p-3" data-testid={`auth-ticker-${s}`}>
                <div className="text-[#787B86] text-[10px]">{s}</div>
                <div className="mt-1">{fmtPrice(tk[s]?.c, p)}</div>
                <div className={Number(tk[s]?.P) >= 0 ? "text-[#089981]" : "text-[#F23645]"}>{fmtPct(tk[s]?.P)}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative text-[10px] text-[#434651] uppercase tracking-[0.2em]">USDT-M · Perpetual · PWA</div>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        {mode === "sign-in"
          ? <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" withSignUp />
          : <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />}
      </div>
    </div>
  );
}
