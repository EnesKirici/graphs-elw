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
  // Arka plan bulanıklığı (px, 0=kapalı) + saydam kartlar. Kullanıcı tercihi,
  // tarayıcıya özel (localStorage). Gerçek uygulama no-flash script'te;
  // burada React state senkronu + canlı değişiklik.
  const [bgBlur, setBgBlurState] = useState(0);
  // Saydam kart bulanıklığı (backdrop-filter blur px). Kart içinden görünen arka
  // plan görselinin netliğini ayarlar. Default 18 (globals.css fallback'iyle aynı).
  const [cardBlur, setCardBlurState] = useState(18);
  const [glassCards, setGlassCardsState] = useState(false);
  // Zemin perdesi (arka plan görseli üstündeki örtü). Varsayılan AÇIK.
  const [bgVeil, setBgVeilState] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("elw-accent");
    if (saved && saved !== DEFAULT) {
      setAccentState(saved);
      document.documentElement.style.setProperty("--accent", saved);
    }
    const savedMode = document.documentElement.classList.contains("light") ? "light" : "dark";
    setModeState(savedMode);
    const savedBlur = parseInt(localStorage.getItem("elw-bg-blur") || "0", 10);
    if (savedBlur > 0) setBgBlurState(savedBlur);
    if (localStorage.getItem("elw-glass-cards") === "1") setGlassCardsState(true);
    const savedCardBlur = localStorage.getItem("elw-card-blur");
    if (savedCardBlur !== null) setCardBlurState(parseInt(savedCardBlur, 10));
    if (localStorage.getItem("elw-bg-veil") === "0") setBgVeilState(false);
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

  function setBgBlur(px) {
    setBgBlurState(px);
    if (px > 0) {
      document.documentElement.style.setProperty("--bg-blur", `${px}px`);
      localStorage.setItem("elw-bg-blur", String(px));
    } else {
      document.documentElement.style.removeProperty("--bg-blur");
      localStorage.removeItem("elw-bg-blur");
    }
  }

  function setCardBlur(px) {
    setCardBlurState(px);
    document.documentElement.style.setProperty("--card-blur", `${px}px`);
    localStorage.setItem("elw-card-blur", String(px));
  }

  function setGlassCards(on) {
    setGlassCardsState(on);
    document.documentElement.classList.toggle("glass-cards", on);
    if (on) localStorage.setItem("elw-glass-cards", "1");
    else localStorage.removeItem("elw-glass-cards");
  }

  function setBgVeil(on) {
    setBgVeilState(on);
    document.documentElement.classList.toggle("no-veil", !on);
    if (on) localStorage.removeItem("elw-bg-veil");
    else localStorage.setItem("elw-bg-veil", "0");
  }

  return (
    <ThemeContext.Provider
      value={{
        accent, setAccent, accents: ACCENTS,
        mode, setMode: applyMode, toggleMode,
        bgBlur, setBgBlur,
        cardBlur, setCardBlur,
        glassCards, setGlassCards,
        bgVeil, setBgVeil,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
