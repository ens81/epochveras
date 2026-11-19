import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/index.css";
import App from "@/App";

function isTransient503(reason) {
  const status = reason?.response?.status ?? reason?.status;
  const msg = String(reason?.message || reason || "");
  return status === 503 || msg.includes("status code 503") || msg.includes("Network Error");
}

function showFatal(msg) {
  if (document.getElementById("fatal-error-box")) return;
  const pre = document.createElement("pre");
  pre.id = "fatal-error-box";
  pre.style.cssText =
    "position:fixed;inset:0;margin:0;color:#ff5555;background:#000;padding:16px;white-space:pre-wrap;font-size:13px;z-index:99999;overflow:auto;";
  pre.textContent = msg;
  document.body.appendChild(pre);
}

window.addEventListener("error", (e) => {
  if (e?.message) {
    showFatal(`ERROR: ${e.message}\n${e.filename || ""}:${e.lineno || ""}`);
  }
});

window.addEventListener("unhandledrejection", (e) => {
  if (isTransient503(e?.reason)) {
    e.preventDefault();
    return;
  }
  showFatal(`PROMISE: ${e?.reason?.stack || e?.reason}`);
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 },
  },
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);
