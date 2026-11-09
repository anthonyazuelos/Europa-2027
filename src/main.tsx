import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// O Cesium busca workers e texturas a partir deste endereço (ver vite.config.ts).
(window as unknown as { CESIUM_BASE_URL: string }).CESIUM_BASE_URL = new URL("cesium/", document.baseURI).href;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
