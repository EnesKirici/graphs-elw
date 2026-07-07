"use client";

/*
  Couple profil efektleri — yalnız couple hesaplarda (coupleProfiles) render edilir.
  - Arka planda yükselen pembe kalp parçacıkları (deterministik konum → SSR-safe)
  - Sayfa boyunca kalp cursor (mount'ta uygula, unmount'ta geri al)
  Pointer-events yok; içerik etkileşimini engellemez.
*/

import { useEffect } from "react";

// Pembe kalp SVG cursor (data URI) — 28px, hotspot ortada
const HEART_CURSOR =
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 24 24'%3E%3Cpath fill='%23f472b6' stroke='%23be185d' stroke-width='1' d='M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z'/%3E%3C/svg%3E") 14 12, auto`;

// 16 kalp — index'ten türeyen deterministik dağılım (hydration mismatch yok)
const HEARTS = Array.from({ length: 16 }, (_, i) => ({
  left: (i * 61) % 100,               // %0-100 arası yayılım
  delay: -((i * 1.7) % 12).toFixed(2), // negatif → sayfa açılınca bazıları yolda
  dur: (10 + (i % 6)).toFixed(1),      // 10-15s
  size: 12 + (i % 5) * 5,              // 12-32px
  opacity: 0.28 + (i % 4) * 0.12,      // 0.28-0.64
}));

export default function CoupleFX() {
  useEffect(() => {
    const prev = document.body.style.cursor;
    document.body.style.cursor = HEART_CURSOR;
    return () => { document.body.style.cursor = prev; };
  }, []);

  return (
    <div className="couple-fx" aria-hidden="true">
      {HEARTS.map((h, i) => (
        <span
          key={i}
          className="couple-heart"
          style={{
            left: `${h.left}%`,
            fontSize: `${h.size}px`,
            opacity: h.opacity,
            animationDuration: `${h.dur}s`,
            animationDelay: `${h.delay}s`,
          }}
        >
          ♥
        </span>
      ))}
    </div>
  );
}
