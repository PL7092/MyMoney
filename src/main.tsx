import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

console.log("🚀 Main.tsx loaded - React initialization starting");

const rootElement = document.getElementById("root");
console.log("📍 Root element found:", rootElement);

if (rootElement) {
  console.log("✅ Creating React root and rendering App");
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} else {
  console.error("❌ Root element not found!");
}
