"use client";

import { createContext, useContext, useState, useEffect } from "react";

const BackgroundContext = createContext(null);

export function BackgroundProvider({ children }) {
  const [background, setBackground] = useState(null);
  // Arka planı SİLMEDEN gizle/göster (kullanıcı tercihi, localStorage: elw-bg-enabled).
  const [enabled, setEnabled] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("site-background");
    if (saved) setBackground(saved);
    if (localStorage.getItem("elw-bg-enabled") === "0") setEnabled(false);
    setReady(true);
  }, []);

  function setBg(url) {
    setBackground(url);
    if (url) {
      localStorage.setItem("site-background", url);
      // Yeni arka plan seçildi → otomatik aç (kapalıyken seçilirse görünmezdi).
      setEnabled(true);
      localStorage.setItem("elw-bg-enabled", "1");
    } else {
      localStorage.removeItem("site-background");
    }
  }

  function removeBg() {
    setBackground(null);
    localStorage.removeItem("site-background");
  }

  // Arka plan görselini gizle/göster (silmez — tercih korunur).
  function toggleEnabled() {
    setEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("elw-bg-enabled", next ? "1" : "0");
      return next;
    });
  }

  return (
    <BackgroundContext.Provider value={{ background, setBg, removeBg, enabled, toggleEnabled, ready }}>
      {background && enabled && (
        <div className="fixed inset-0 z-0">
          <img src={background} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 page-veil" />
        </div>
      )}
      {children}
    </BackgroundContext.Provider>
  );
}

export function useBackground() {
  const ctx = useContext(BackgroundContext);
  if (!ctx) throw new Error("useBackground must be used within BackgroundProvider");
  return ctx;
}
