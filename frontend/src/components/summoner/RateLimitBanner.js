"use client";

import { useState } from "react";
import { useAdmin } from "@/context/AdminContext";

export default function RateLimitBanner() {
  const { isAdmin } = useAdmin();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  // Metin renkleri tema-duyarlı --tag-amber-text token'ından gelir:
  // dark'ta açık sarı, light'ta koyu amber — sabit amber-200 light'ta okunmuyordu.
  return (
    <div className="max-w-7xl mx-auto px-6 pt-4">
      <div className="flex items-center gap-3 bg-amber-500/10 border border-[var(--tag-amber-bd)] rounded-xl px-4 py-3">
        <svg className="w-5 h-5 text-[var(--tag-amber-text)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="flex-1 min-w-0">
          {isAdmin ? (
            <>
              <p className="text-sm text-[var(--tag-amber-text)]">
                <span className="text-[10px] font-bold bg-amber-500/20 text-[var(--tag-amber-text)] px-1.5 py-0.5 rounded mr-2 align-middle">ADMIN</span>
                Bazı veriler yüklenemedi — Riot API istek limiti aşıldı.
              </p>
              <p className="text-xs text-[var(--tag-amber-text)] opacity-70 mt-0.5">Mevcut veriler gösteriliyor. Tam veri için 5 dakika sonra sayfayı yenileyin.</p>
            </>
          ) : (
            <>
              <p className="text-sm text-[var(--tag-amber-text)]">Bazı veriler şu anda yüklenemedi.</p>
              <p className="text-xs text-[var(--tag-amber-text)] opacity-70 mt-0.5">Mevcut veriler gösteriliyor. Kısa süre sonra sayfayı yenileyerek eksik verileri getirebilirsiniz.</p>
            </>
          )}
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 w-7 h-7 rounded-lg text-[var(--tag-amber-text)] opacity-70 hover:opacity-100 hover:bg-amber-500/10 transition-all cursor-pointer flex items-center justify-center"
          aria-label="Kapat"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
