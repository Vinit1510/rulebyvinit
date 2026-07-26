import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initDevToolsProtection } from "@/lib/secureStorage";

initDevToolsProtection();

createRoot(document.getElementById("root")!).render(<App />);
