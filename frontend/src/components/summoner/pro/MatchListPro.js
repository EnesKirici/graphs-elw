"use client";

import { useState, useEffect, useMemo } from "react";
import MatchCardPro from "./MatchCardPro";
import MatchDetailPro from "./MatchDetailPro";

const MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

function dayInfo(ts) {
  const d = new Date(ts);
  const now = new Date();
  const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  let label;
  if (sameDay(d, now)) label = "Bugün";
  else if (sameDay(d, yest)) label = "Dün";
  else label = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return { key, label };
}

function groupByDay(matches) {
  const groups = [];
  const index = {};
  for (const m of matches) {
    const { key, label } = dayInfo(m.gameCreation);
    if (index[key] == null) {
      index[key] = groups.length;
      groups.push({ key, label, matches: [], wins: 0, losses: 0, scoreSum: 0, scoreCount: 0 });
    }
    const g = groups[index[key]];
    g.matches.push(m);
    if (m.duration >= 300) {
      if (m.win) g.wins++; else g.losses++;
      if (m.ranking?.elwScore != null) { g.scoreSum += m.ranking.elwScore; g.scoreCount++; }
    }
  }
  return groups;
}

export default function MatchListPro({ initialMatches, puuid, onMatchesChange }) {
  const [matches, setMatches] = useState(initialMatches || []);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState((initialMatches || []).length >= 10);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    onMatchesChange?.(matches);
  }, [matches, onMatchesChange]);

  const groups = useMemo(() => groupByDay(matches), [matches]);

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
    } catch {
      setHasMore(false);
    }
    setLoading(false);
  }

  if (matches.length === 0) return null;

  return (
    <div className="space-y-3">
      {groups.map((g) => {
        const avg = g.scoreCount > 0 ? (g.scoreSum / g.scoreCount).toFixed(1) : null;
        return (
          <div key={g.key} className="glass rounded-xl overflow-hidden">
            {/* Gün başlığı + günlük özet */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-edge/50 bg-soft/40">
              <span className="text-[13px] font-bold text-gray-200" suppressHydrationWarning>{g.label}</span>
              <div className="flex items-center gap-3 text-[11px]">
                {avg != null && (
                  <span className="text-gray-400">
                    ELW Skor <span className="font-bold" style={{ color: "var(--dpm-accent)" }}>{avg}</span>
                  </span>
                )}
                <span className="text-emerald-400 font-medium">{g.wins}G</span>
                <span className="text-gray-600">·</span>
                <span className="text-red-400 font-medium">{g.losses}M</span>
              </div>
            </div>

            <div className="divide-y divide-edge/20">
              {g.matches.map((match) => {
                const isOpen = expandedId === match.matchId;
                return (
                  <div key={match.matchId}>
                    {/* Satıra tıklayınca accordion açılır; cursor default kalır */}
                    <div onClick={() => setExpandedId(isOpen ? null : match.matchId)} className="cursor-default">
                      <MatchCardPro match={match} expanded={isOpen} />
                    </div>
                    {/* Inline maç detayı (ayrı sekme yerine accordion) — Pro kompakt */}
                    {isOpen && (
                      <div className="border-t border-edge/40 bg-base/40 px-2 py-2.5">
                        <MatchDetailPro matchId={match.matchId} puuid={puuid} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {hasMore && (
        <button
          onClick={loadMore}
          disabled={loading}
          className="w-full py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer bg-soft text-gray-400 hover:bg-hover hover:text-gray-200 disabled:opacity-50 disabled:cursor-wait"
        >
          {loading ? "Yükleniyor..." : "Daha Fazla Göster"}
        </button>
      )}
    </div>
  );
}
