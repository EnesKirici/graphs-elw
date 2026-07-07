"use client";

/*
  Duyuru / "Son Geliştirmeler" kartı — ana sayfada hero'nun üstünde.
  - Site geliştirme aşamasında bilgisi + son yapılan geliştirmeler (CHANGELOG).
  - GÜN-BAZLI kapatma: kullanıcı kapatınca o GÜN tekrar görünmez; ertesi gün
    (veya yeni duyurularla) yeniden açılır. localStorage'a bugünün tarihi yazılır.
  - Animasyon: girişte aşağıdan yukarı slide-in; kapatınca slide-up + fade (globals.css).
  Dismiss deseni RateLimitBanner.js'ten, localStorage deseni ThemeContext'ten uyarlandı.

  YENİ DUYURU EKLEME: CHANGELOG dizisinin BAŞINA yeni madde ekle (en yeni en üstte).
*/

import { useState, useEffect } from "react";
import Link from "next/link";
import { Megaphone, X } from "lucide-react";

// En yeni en üstte. { date: "GG Ay", text: "..." }
const CHANGELOG = [
  { date: "7 Tem", text: "Mobil tasarım baştan sona yenilendi — maç kartları, tablolar ve menü artık telefonda düzgün." },
  { date: "7 Tem", text: "Profil LP grafiği rank kademeleriyle (bant) yeniden çizildi; maç geçmişi sadeleşti." },
  { date: "6 Tem", text: "Özel 404 / hata sayfaları ve şampiyon sayfası düzeltmeleri." },
];

const LS_KEY = "elw-announce-dismissed";

// Yerel tarih (YYYY-MM-DD) — client'ta. Date.now sınırı yok; component tarayıcıda çalışır.
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AnnouncementCard() {
  // SSR/ilk render: gizli (hidrasyon uyumu). useEffect karar verir.
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    let dismissedToday = false;
    try {
      dismissedToday = localStorage.getItem(LS_KEY) === today();
    } catch { /* localStorage kapalı olabilir */ }
    if (!dismissedToday) setVisible(true);
  }, []);

  function handleClose() {
    setClosing(true);
    try { localStorage.setItem(LS_KEY, today()); } catch { /* yoksay */ }
    // slide-up animasyonu bitince DOM'dan kaldır
    setTimeout(() => setVisible(false), 320);
  }

  if (!visible) return null;

  return (
    <div className={`section ${closing ? "announce-out" : "announce-in"}`}>
      <div className="relative overflow-hidden rounded-2xl border border-edge bg-card">
        {/* accent şerit */}
        <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: "var(--accent)" }} />

        <div className="flex items-start gap-3.5 px-5 py-4 pl-6">
          <div className="flex-shrink-0 mt-0.5 w-9 h-9 rounded-xl grid place-items-center" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
            <Megaphone size={18} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-gray-100">Geliştirme aşamasındayız 🚧</h3>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                Son Geliştirmeler
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">
              Site aktif geliştiriliyor; <span className="text-gray-200">oyuncu profilleri</span> ve{" "}
              <span className="text-gray-200">canlı maç analizi</span> şu an kullanılabilir.
            </p>

            {/* changelog maddeleri */}
            <ul className="mt-2.5 space-y-1.5">
              {CHANGELOG.slice(0, 3).map((c, i) => (
                <li key={i} className="flex gap-2 text-xs text-gray-400 leading-snug">
                  <span className="flex-shrink-0 text-[10px] font-mono text-gray-600 mt-0.5 w-[42px]">{c.date}</span>
                  <span>{c.text}</span>
                </li>
              ))}
            </ul>

            <Link href="/iletisim" className="inline-flex items-center gap-1 mt-3 text-xs font-semibold" style={{ color: "var(--accent)" }}>
              LP takibi / iletişim →
            </Link>
          </div>

          <button
            onClick={handleClose}
            className="flex-shrink-0 w-7 h-7 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-hover transition-colors grid place-items-center cursor-pointer"
            aria-label="Bugünlük kapat"
            title="Bugünlük kapat"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
