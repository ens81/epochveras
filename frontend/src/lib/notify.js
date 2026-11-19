import { http } from "./api";


let ctx;
export function beep() {
  try {
    ctx = ctx || new(window.AudioContext || window.webkitAudioContext)();
    [0, 0.18, 0.36].forEach((t) => {
      const o = ctx.createOscillator(),
        g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 880 + t * 600;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.16);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.17);
    });
  } catch (e) { /* audio unavailable */ }
}

const b64 = (s) => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

export const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export async function enablePush() {
  if (!pushSupported()) throw new Error("Bu tarayıcı push bildirimlerini desteklemiyor");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Bildirim izni verilmedi");
  const reg = await navigator.serviceWorker.ready;
  const { data } = await http.get("/push/vapid");
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(data.key) });
  await http.post("/push/subscribe", { subscription: sub.toJSON() });
  return true;
}

export async function refreshPushIfGranted() {
  if (pushSupported() && Notification.permission === "granted") {
    try { await enablePush(); } catch (e) { /* ignore */ }
  }
}
