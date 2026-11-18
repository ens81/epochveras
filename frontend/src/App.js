import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Show } from "@clerk/react";
import { Toaster } from "./components/ui/sonner";
import ClerkAuthProvider from "./components/auth/ClerkAuthProvider";
import AuthPage from "./pages/AuthPage";
import Terminal from "./pages/Terminal";

function Protected() {
  return (
    <>
      <Show when="signed-in"><Terminal /></Show>
      <Show when="signed-out"><Navigate to="/sign-in" replace /></Show>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ClerkAuthProvider>
        <Routes>
          <Route path="/sign-in/*" element={<AuthPage mode="sign-in" />} />
          <Route path="/sign-up/*" element={<AuthPage mode="sign-up" />} />
          <Route path="/*" element={<Protected />} />
        </Routes>
      </ClerkAuthProvider>
      <Toaster theme="dark" position="top-center" richColors />
    </BrowserRouter>
  );
}
