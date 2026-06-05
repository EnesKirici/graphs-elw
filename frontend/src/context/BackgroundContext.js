"use client";

import { createContext, useContext, useState, useEffect } from "react";

const BackgroundContext = createContext(null);

export function BackgroundProvider({ children }) {
  const [background, setBackground] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("site-background");
    if (saved) setBackground(saved);
    setReady(true);
  }, []);

  function setBg(url) {
    setBackground(url);
    if (url) {
      localStorage.setItem("site-background", url);
    } else {
      localStorage.removeItem("site-background");
    }
  }

  function removeBg() {
    setBackground(null);
    localStorage.removeItem("site-background");
  }

  return (
    <BackgroundContext.Provider value={{ background, setBg, removeBg, ready }}>
      {background && (
        <div className="fixed inset-0 z-0">
          <img src={background} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-base/75" />
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
