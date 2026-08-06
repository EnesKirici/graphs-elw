"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

/* "Sonraki güncelleme" geri sayımı.

   Sıralama sürekli taranmıyor: backend `leaderboard:warm` ile 4 saatte bir
   tazeleniyor (config: elwgraphs.leaderboard.refresh_cron). Bu sayaç o takvimi
   görünür kılar — "LP neden değişmedi" sorusunu sorulmadan cevaplar.

   nextUpdateAt yanıtta her seferinde TAZE hesaplanır (cache'e gömülmez), yani
   burada gösterilen an gerçek zamanlanmış turdur. Worker kapalıysa tur koşmaz;
   o yüzden sayaç bir plandır, garanti değil. */

function formatLeft(ms) {
  if (ms <= 0) return "birazdan";

  const totalMin = Math.ceil(ms / 60000);
  if (totalMin < 60) return `${totalMin} dk`;

  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return mins ? `${hours} sa ${mins} dk` : `${hours} sa`;
}

function formatClock(iso) {
  try {
    return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return null;
  }
}

export default function RefreshCountdown({ nextUpdateAt, updatedAt, className = "" }) {
  // İlk render'da null: sunucu ile istemcinin saati farklı olduğundan doğrudan
  // hesaplamak hydration uyuşmazlığı üretir. Değer mount sonrası dolar.
  const [left, setLeft] = useState(null);

  useEffect(() => {
    if (!nextUpdateAt) return;

    const target = new Date(nextUpdateAt).getTime();
    if (Number.isNaN(target)) return;

    const tick = () => setLeft(target - Date.now());
    tick();

    // Dakika hassasiyeti yeterli — 4 saatlik periyotta saniye saymak gürültü.
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [nextUpdateAt]);

  if (left === null) return null;

  const updated = updatedAt ? formatClock(updatedAt) : null;
  const next = formatClock(nextUpdateAt);

  return (
    <div
      className={`lb-refresh ${className}`}
      title={
        (updated ? `Son güncelleme: ${updated}` : "") +
        (updated && next ? " · " : "") +
        (next ? `Sonraki: ${next}` : "")
      }
    >
      <RefreshCw size={12} aria-hidden="true" />
      <span>
        Sonraki güncelleme <strong>{formatLeft(left)}</strong>
      </span>
    </div>
  );
}
