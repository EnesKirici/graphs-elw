"use client";

import { useState } from "react";
import MatchList from "./MatchList";
import StatsCard from "./StatsCard";
import RecentChampionsCard from "./RecentChampionsCard";

export default function SummonerContent({
  leftColumn,
  initialMatches,
  puuid,
  totalSeasonMatches,
  seasonChampionsAll,
  solo,
}) {
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [matches, setMatches] = useState(initialMatches || []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Sol kolon — maç detayı açıkken gizle */}
      {!selectedMatchId && (
        <div className="lg:col-span-4 space-y-4">
          {leftColumn}
        </div>
      )}

      {/* Sağ kolon — maç detayı açıkken tam genişlik */}
      <div className={`${selectedMatchId ? "lg:col-span-12" : "lg:col-span-8"} space-y-4`}>
        {!selectedMatchId && (
          <>
            <StatsCard
              totalSeasonMatches={totalSeasonMatches}
              seasonChampionsAll={seasonChampionsAll}
              matches={matches}
              solo={solo}
            />
            <RecentChampionsCard matches={matches} />
          </>
        )}
        <MatchList
          initialMatches={initialMatches}
          puuid={puuid}
          selectedMatchId={selectedMatchId}
          onSelectMatch={setSelectedMatchId}
          onMatchesChange={setMatches}
        />
      </div>
    </div>
  );
}
