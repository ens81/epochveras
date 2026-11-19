import axios from "axios";

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;
export const CLIENT_ID = (window.crypto?.randomUUID?.() || String(Math.random())).slice(0, 36);

export const http = axios.create({ baseURL: API });

http.interceptors.request.use((cfg) => {
  cfg.headers["X-Client-Id"] = CLIENT_ID;
  return cfg;
});

export const TIMEFRAMES = [
  { key: "1m", label: "1m", sec: 60 },
  { key: "3m", label: "3m", sec: 180 },
  { key: "5m", label: "5m", sec: 300 },
  { key: "15m", label: "15m", sec: 900 },
  { key: "30m", label: "30m", sec: 1800 },
  { key: "1h", label: "1s", sec: 3600 },
  { key: "4h", label: "4s", sec: 14400 },
  { key: "1d", label: "1G", sec: 86400 },
  { key: "1w", label: "1H", sec: 604800 },
];
export const tfSec = (tf) => TIMEFRAMES.find((t) => t.key === tf)?.sec || 60;

const nf = {};
export function fmtPrice(v, p = 2) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "—";
  nf[p] = nf[p] || new Intl.NumberFormat("tr-TR", { minimumFractionDigits: p, maximumFractionDigits: p });
  return nf[p].format(Number(v));
}
export const fmtPct = (v, d = 2) => (v === null || v === undefined || v === "" ? "—" : `${Number(v) >= 0 ? "+" : ""}${fmtPrice(v, d)}%`);
export function fmtVol(v) {
  const x = Number(v);
  if (!x) return "—";
  if (x >= 1e9) return `${fmtPrice(x / 1e9, 2)} Mr`;
  if (x >= 1e6) return `${fmtPrice(x / 1e6, 2)} Mn`;
  if (x >= 1e3) return `${fmtPrice(x / 1e3, 1)} B`;
  return fmtPrice(x, 0);
}
export function fmtCountdown(ms) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const pad = (x) => String(x).padStart(2, "0");
  if (d > 0) return `${d}g ${pad(h)}:${pad(m)}`;
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(sec)}`;
  return `${pad(m)}:${pad(sec)}`;
}
export const roundTick = (p, tick) => {
  const t = Number(tick) || 0.01;
  const dec = (String(tick).split(".")[1] || "").replace(/0+$/, "").length;
  return Number((Math.round(p / t) * t).toFixed(dec));
};
