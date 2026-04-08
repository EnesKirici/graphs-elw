"use client";

import { useState } from "react";
import MatchCard from "./MatchCard";
import MatchDetail from "./MatchDetail";

export default function MatchList({ initialMatches, puuid, selectedMatchId, onSelectMatch }) {
  const [matches, setMatches] = useState(initialMatches || []);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState((initialMatches || []).length >= 10);

  async function loadMore() {
    setLoading(true);
    try {
      const nextPage = page + 1;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
      const res = await fetch(`${apiUrl}/summoner/${puuid}/matches?page=${nextPage}`);
      const data = await res.json();

      if (data.matches?.length > 0) {
        setMatches((prev) => [...prev, ...data.matches]);
        setPage(nextPage);
        setHasMore(data.hasMore);
      } else {
        setHasMore(false);
      }
    } catch (e) {
      setHasMore(false);
    }
    setLoading(false);
  }

  if (matches.length === 0) return null;

  // Detay görünümü — tam genişlik
  if (selectedMatchId) {
    return <MatchDetail matchId={selectedMatchId} puuid={puuid} onBack={() => onSelectMatch(null)} />;
  }

  // Liste görünümü
  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[#1b2230]/50 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-200">Son Maçlar</h3>
        <span className="text-[11px] text-gray-500">{matches.length} maç</span>
      </div>

      <div className="divide-y divide-[#1b2230]/20">
        {matches.map((match) => (
          <div
            key={match.matchId}
            onClick={() => onSelectMatch(match.matchId)}
            className="cursor-pointer"
          >
            <MatchCard match={match} />
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="p-3">
          <button
            onClick={loadMore}
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200 disabled:opacity-50 disabled:cursor-wait"
          >
            {loading ? "Yükleniyor..." : "Daha Fazla Göster"}
          </button>
        </div>
      )}
    </div>
  );
}
