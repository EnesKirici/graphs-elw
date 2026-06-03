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

  useEffect(() => {
    const saved = localStorage.getItem("elw-accent");
    if (saved && saved !== DEFAULT) {
      setAccentState(saved);
      document.documentElement.style.setProperty("--accent", saved);
    }
  }, []);

  function setAccent(value) {
    setAccentState(value);
    document.documentElement.style.setProperty("--accent", value);
    localStorage.setItem("elw-accent", value);
  }

  return (
    <ThemeContext.Provider value={{ accent, setAccent, accents: ACCENTS }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
