"use client";

import { useState } from "react";
import MatchList from "./MatchList";

export default function SummonerContent({ leftColumn, rightColumn, initialMatches, puuid }) {
  const [selectedMatchId, setSelectedMatchId] = useState(null);

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
        {!selectedMatchId && rightColumn}
        <MatchList
          initialMatches={initialMatches}
          puuid={puuid}
          selectedMatchId={selectedMatchId}
          onSelectMatch={setSelectedMatchId}
        />
      </div>
    </div>
  );
}
