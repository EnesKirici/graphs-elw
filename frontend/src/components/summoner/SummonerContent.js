"use client";

import { useState } from "react";
import MatchList from "./MatchList";

/*
  Profil içerik yerleşimi:
  - ANA kolon (geniş): büyük Rank kartı + Son Maçlar
  - SIDEBAR (dar): İstatistikler + En Çok Oynanan + Koridorlar + Challenges + Duo
  Maç detayı açıkken ana kolon tam genişliğe yayılır, sidebar gizlenir.
*/
export default function SummonerContent({ rankCard, sideColumn, initialMatches, puuid }) {
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [, setMatches] = useState(initialMatches || []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Ana kolon — Rank + Son Maçlar */}
      <div className={`${selectedMatchId ? "lg:col-span-12" : "lg:col-span-8"} space-y-5`}>
        {!selectedMatchId && rankCard}
        <MatchList
          initialMatches={initialMatches}
          puuid={puuid}
          selectedMatchId={selectedMatchId}
          onSelectMatch={setSelectedMatchId}
          onMatchesChange={setMatches}
        />
      </div>

      {/* Sidebar — maç detayı açıkken gizle */}
      {!selectedMatchId && (
        <div className="lg:col-span-4 space-y-5">
          {sideColumn}
        </div>
      )}
    </div>
  );
}
