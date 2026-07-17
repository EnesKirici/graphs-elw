"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Riot rate limit bildirimi — api.js bir 429 yakalayınca "elw:rate-limited"
 * event'i atar, bu toast sağ üstte kısa ve sakin bir mesaj gösterir.
 * Teknik detay yok; kullanıcıya yalnız "birazdan düzelir" hissi verilir.
 */
export default function RateLimitToast() {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);
  const lastShownRef = useRef(0);

  useEffect(() => {
    function onRateLimited() {
      // Aynı dakika içinde tekrar tekrar gösterme (istek fırtınasında spam olmasın).
      if (Date.now() - lastShownRef.current < 60000) return;
      lastShownRef.current = Date.now();
      setVisible(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setVisible(false), 6000);
    }
    window.addEventListener("elw:rate-limited", onRateLimited);
    return () => {
      window.removeEventListener("elw:rate-limited", onRateLimited);
      clearTimeout(timerRef.current);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      className="fixed top-16 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-2xl"
      style={{
        background: "var(--bg-1)",
        border: "1px solid var(--border-strong)",
        boxShadow: "0 18px 50px rgba(0,0,0,.55)",
        maxWidth: 320,
      }}
    >
      <span
        className="sf-dot shrink-0"
        style={{ background: "var(--gold)", boxShadow: "0 0 8px var(--gold)" }}
      />
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--txt)" }}>Yoğunluk var</p>
        <p style={{ fontSize: 11, color: "var(--txt-2)", marginTop: 1 }}>
          Veriler birkaç saniye içinde gelmeye devam edecek.
        </p>
      </div>
      <button
        onClick={() => setVisible(false)}
        aria-label="Kapat"
        style={{ fontSize: 14, color: "var(--txt-3)", marginLeft: 4, cursor: "pointer", alignSelf: "flex-start" }}
      >
        ×
      </button>
    </div>
  );
}
