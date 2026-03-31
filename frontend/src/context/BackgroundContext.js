"use client";

/*
  BackgroundContext - Site arka plan resmini yöneten global state.

  React Context nedir?
  Laravel'deki global middleware veya service container gibi düşün.
  Bir değeri tüm component'lere iletmek istediğinde kullanırsın.

  Normalde React'te veri yukarıdan aşağıya (parent→child) akar.
  Ama background bilgisi hem Navbar'da (kaldır butonu) hem page'de lazım.
  Context ile bu veriyi "global" yapıyoruz.

  Laravel karşılığı:
    // Service Container'a kaydet
    app()->bind('background', fn() => 'url...');
    // Herhangi bir yerden oku
    app('background');

  React Context:
    // Provider ile sar (layout.js'te)
    <BackgroundProvider> ... </BackgroundProvider>
    // Herhangi bir component'ten oku
    const { background } = useBackground();
*/

import { createContext, useContext, useState, useEffect } from "react";

const BackgroundContext = createContext(null);

export function BackgroundProvider({ children }) {
  const [background, setBackground] = useState(null);

  // Sayfa yüklenince localStorage'dan oku
  useEffect(() => {
    const saved = localStorage.getItem("site-background");
    if (saved) setBackground(saved);
  }, []);

  // Background ayarla ve localStorage'a kaydet
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
    <BackgroundContext.Provider value={{ background, setBg, removeBg }}>
      {/* Background resmi varsa göster */}
      {background && (
        <div className="fixed inset-0 z-0">
          <img
            src={background}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-[#060a10]/75" />
        </div>
      )}
      {children}
    </BackgroundContext.Provider>
  );
}

// Custom hook — herhangi bir component'ten kullan
export function useBackground() {
  const ctx = useContext(BackgroundContext);
  if (!ctx) throw new Error("useBackground must be used within BackgroundProvider");
  return ctx;
}
