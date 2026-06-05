"use client";

import { createContext, useContext, useState, useEffect } from "react";

/*
  Site accent (tema) rengi. --accent CSS değişkenini documentElement'e set eder;
  --accent-soft / --accent-dim color-mix ile otomatik türer. localStorage'da saklanır.
*/
export const ACCENTS = [
  { id: "emerald", value: "#00e5a0", label: "Zümrüt" },
  { id: "blue", value: "#4f8cff", label: "Mavi" },
  { id: "gold", value: "#e8b44a", label: "Altın" },
  { id: "purple", value: "#b06cff", label: "Mor" },
  { id: "red", value: "#ff5470", label: "Kırmızı" },
  { id: "cyan", value: "#22d3ee", label: "Camgöbeği" },
];

const DEFAULT = ACCENTS[0].value;
const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [accent, setAccentState] = useState(DEFAULT);
  // Açık/koyu mod. Varsayılan koyu (site dark-first). localStorage "elw-mode".
  // Gerçek class layout'taki no-flash script ile paint öncesi set edilir;
  // burada yalnız React state'i senkronlarız.
  const [mode, setModeState] = useState("dark");

  useEffect(() => {
    const saved = localStorage.getItem("elw-accent");
    if (saved && saved !== DEFAULT) {
      setAccentState(saved);
      document.documentElement.style.setProperty("--accent", saved);
    }
    const savedMode = document.documentElement.classList.contains("light") ? "light" : "dark";
    setModeState(savedMode);
  }, []);

  function setAccent(value) {
    setAccentState(value);
    document.documentElement.style.setProperty("--accent", value);
    localStorage.setItem("elw-accent", value);
  }

  function applyMode(next) {
    setModeState(next);
    document.documentElement.classList.toggle("light", next === "light");
    localStorage.setItem("elw-mode", next);
  }

  function toggleMode() {
    applyMode(mode === "light" ? "dark" : "light");
  }

  return (
    <ThemeContext.Provider value={{ accent, setAccent, accents: ACCENTS, mode, setMode: applyMode, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
