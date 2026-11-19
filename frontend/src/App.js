import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import Terminal from "./pages/Terminal";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<Terminal />} />
      </Routes>
      <Toaster theme="dark" position="top-center" richColors />
    </BrowserRouter>
  );
}
