import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "./index.css";

/* One global pointer listener drives the hover spotlight (.glass) and the
   3D tilt (.tilt) for every card, instead of a handler per component. */
const finePointer = window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;
const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
if (finePointer && !reduceMotion) {
  let last = null;
  document.addEventListener("pointermove", (e) => {
    const el = e.target.closest?.(".glass");
    if (last && last !== el) {
      last.style.removeProperty("--rx");
      last.style.removeProperty("--ry");
    }
    last = el;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    el.style.setProperty("--mx", `${x}px`);
    el.style.setProperty("--my", `${y}px`);
    if (el.classList.contains("tilt")) {
      el.style.setProperty("--ry", `${((x / r.width) - 0.5) * 10}deg`);
      el.style.setProperty("--rx", `${(0.5 - y / r.height) * 10}deg`);
    }
  }, { passive: true });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
