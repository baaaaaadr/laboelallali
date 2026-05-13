"use client";
import { useEffect } from "react";

export default function SplashRemover() {
  useEffect(() => {
    const MIN_MS = 1200;
    const elapsed = performance.now();
    const remaining = Math.max(0, MIN_MS - elapsed);

    const hide = () => {
      const el = document.getElementById("splash-screen");
      if (!el) return;
      el.style.pointerEvents = "none";
      el.style.transition = "opacity 0.5s ease";
      el.style.opacity = "0";
      // Use display:none instead of remove() — React still holds a fiber ref to this node
      setTimeout(() => { el.style.display = "none"; }, 500);
    };

    const timer = setTimeout(hide, remaining);
    return () => clearTimeout(timer);
  }, []);
  return null;
}
