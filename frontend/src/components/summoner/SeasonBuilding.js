"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

/**
 * Soğuk profil şeridi: sezon verileri worker'da arka planda kurulurken gösterilir.
 * season-status ucunu periyodik yoklar (0 Riot çağrısı); hazır olunca sayfayı
 * tazeler (router.refresh) → paneller KENDİLİĞİNDEN dolar, manuel yenileme yok.
 *
 * router.refresh() fetch cache'ini (60sn) geçersiz kılmaz; build zaten 60sn'den
 * uzun sürdüğü için cache tazelenmiş olur. Kısa build'de hâlâ pending gelirse
 * bileşen tekrar mount olup yoklamaya devam eder → kendini düzeltir.
 */
export default function SeasonBuilding({ puuid, initial = null }) {
  const router = useRouter();
  const [status, setStatus] = useState(initial);

  useEffect(() => {
    if (!puuid) return;
    let alive = true;

    const tick = async () => {
      try {
        const res = await fetch(`${API_BASE}/summoner/${puuid}/season-status`, {
          cache: "no-store",
        });
        if (!res.ok || !alive) return;
        const s = await res.json();
        if (!alive) return;
        setStatus(s);
        if (s.ready) {
          alive = false;
          router.refresh();
        }
      } catch {
        /* geçici ağ hatası — bir sonraki yoklamada tekrar dener */
      }
    };

    tick();
    const id = setInterval(tick, 4000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [puuid, router]);

  const have = status?.have ?? 0;
  const total = status?.total ?? 0;
  const pct = total > 0 ? Math.min(100, Math.round((have / total) * 100)) : null;

  return (
    <div className="mb-4 rounded-xl border border-edge bg-card/60 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-medium text-gray-200">
          <svg className="h-4 w-4 animate-spin text-blue-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-90" fill="currentColor" d="M12 2a10 10 0 0 1 10 10h-3a7 7 0 0 0-7-7V2z" />
          </svg>
          Sezon verileri hesaplanıyor
          {pct !== null && <span className="text-blue-300"> — %{pct}</span>}
        </span>
        <span className="hidden text-xs text-gray-500 sm:inline">
          hazır olunca kendiliğinden dolacak
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-edge/40">
        <div
          className="h-full rounded-full bg-blue-500 transition-all duration-700"
          style={{ width: pct !== null ? `${pct}%` : "12%" }}
        />
      </div>
    </div>
  );
}
