"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getLiveStatus } from "@/lib/api";

/**
 * Profil banner'ındaki "Canlı Maç" butonu.
 * Her zaman görünür; mount'ta hafif bir durum kontrolü yapar (30sn cache backend'de).
 * Oyuncu oyundaysa yanında yanıp sönen yeşil nokta + vurgulu stil.
 */
export default function LiveGameButton({ puuid, name, tag, className = "" }) {
  const [inGame, setInGame] = useState(false);

  useEffect(() => {
    if (!puuid) return;
    let alive = true;
    getLiveStatus(puuid).then((r) => {
      if (alive) setInGame(!!r?.inGame);
    });
    return () => {
      alive = false;
    };
  }, [puuid]);

  // Şimdilik test verisi (fixture) göster — production key gelince `?mock=1`
  // kaldırılıp gerçek canlı maç verisine (Spectator-V5) döndürülecek.
  const href = `/live-game/${encodeURIComponent(name)}/${encodeURIComponent(tag)}?mock=1`;

  return (
    <Link
      href={href}
      title={inGame ? "Oyuncu şu an bir maçta — canlı analizi gör" : "Canlı maç analizi"}
      className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
        inGame
          ? "text-emerald-300 bg-emerald-500/15 border border-emerald-500/40 hover:bg-emerald-500/25"
          : "text-gray-300 bg-soft border border-edge hover:bg-hover hover:text-gray-100"
      } ${className}`}
    >
      {inGame && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
        </span>
      )}
      Canlı Maç
    </Link>
  );
}
