"use client";

import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s önce`;
  if (diff < 3600) return `${Math.floor(diff / 60)}dk önce`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}sa önce`;
  return `${Math.floor(diff / 86400)}g önce`;
}

export default function RefreshButton({ puuid }) {
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [, setTick] = useState(0);

  const storageKey = `refresh:${puuid}`;

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) setLastRefresh(Number(saved));

    // Her 30 saniyede "X dk önce" metnini güncelle
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, [storageKey]);

  async function handleRefresh() {
    if (loading) return;
    setLoading(true);

    try {
      await fetch(`${API_BASE}/summoner/${puuid}/refresh`, { method: "POST" });
      const now = Date.now();
      localStorage.setItem(storageKey, String(now));
      setLastRefresh(now);
      window.location.reload();
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-0.5">
      <button
        onClick={handleRefresh}
        disabled={loading}
        title="Profili yenile"
        className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-gray-300 hover:text-white px-3 py-1.5 rounded-full transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        <span className="text-xs font-medium">{loading ? "Yenileniyor..." : "Güncelle"}</span>
      </button>
      {lastRefresh && (
        <span className="text-[9px] text-gray-500 pl-1">
          Son güncelleme: {timeAgo(lastRefresh)}
        </span>
      )}
    </div>
  );
}
