"use client";

import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import Tooltip from "@/components/shared/Tooltip";

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
  const [anchor, setAnchor] = useState(null);
  const [, setTick] = useState(0);

  const storageKey = `refresh:${puuid}`;

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) setLastRefresh(Number(saved));

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
    <>
      <button
        onClick={handleRefresh}
        disabled={loading}
        onMouseEnter={(e) => setAnchor(e.currentTarget)}
        onMouseLeave={() => setAnchor(null)}
        className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white/90 hover:text-white px-3 py-1.5 rounded-full transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        <span className="text-xs font-medium">{loading ? "Yenileniyor..." : "Güncelle"}</span>
      </button>
      {anchor && lastRefresh && (
        <Tooltip anchorEl={anchor}>
          <div className="bg-[#0a0e14] border border-[#2a3441] rounded-lg px-3 py-1.5 shadow-2xl shadow-black/90 whitespace-nowrap">
            <p className="text-[11px] text-gray-400">Son güncelleme: {timeAgo(lastRefresh)}</p>
          </div>
        </Tooltip>
      )}
    </>
  );
}
