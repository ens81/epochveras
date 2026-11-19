import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/index.css";
import App from "@/App";

function showFatal(msg) {
  document.body.innerHTML = `<pre style="color:#ff5555;background:#000;padding:16px;white-space:pre-wrap;font-size:13px;">${msg}</pre>`;
}

window.addEventListener("error", (e) => showFatal(`ERROR: ${e.message}\n${e.filename}:${e.lineno}`));
window.addEventListener("unhandledrejection", (e) => showFatal(`PROMISE: ${e.reason?.stack || e.reason}`));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, refetchOnWindowFocus: false },
  },
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);
