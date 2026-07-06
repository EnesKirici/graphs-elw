"use client";

import { useState, useCallback } from "react";
import MatchListPro from "./MatchListPro";
import RankBoxPro from "./RankBoxPro";
import Last30Panel from "./Last30Panel";
import ChampPerfListPro from "./ChampPerfListPro";

// dpm-scope içinde navy kalan, doğrudan yeniden kullanılan kartlar.
import RoleRadar from "@/components/summoner/RoleRadar";
import ChallengesCard from "@/components/summoner/ChallengesCard";
import DuoPartnersCard from "@/components/summoner/DuoPartnersCard";

/*
  dpm.lol stili profil yerleşimi:
  - SOL kolon (dar): Dereceli kutu (LP grafiği) + şampiyon/rol/performans/duo
  - MERKEZ (geniş): Son N oyun paneli + tarihe gruplu maç listesi
  Maç detayı açıkken merkez tam genişliğe yayılır, sol kolon gizlenir.
*/
export default function SummonerContentPro({ data, profile, region, initialMatches, puuid }) {
  const [matches, setMatches] = useState(initialMatches || []);
  const onMatchesChange = useCallback((m) => setMatches(m), []);

  const solo = data.ranked?.solo;
  const flex = data.ranked?.flex;

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* SOL — sabit ~350px; çok yer kaplamasın */}
      <div className="w-full lg:w-[350px] lg:shrink-0 space-y-4">
        <RankBoxPro solo={solo} flex={flex} region={region} lpTimeline={data.lpTimeline} winrateTimeline={data.winrateTimeline} avgGameRank={data.avgGameRank} />
        <ChampPerfListPro seasonChampions={data.seasonChampions || {}} region={region} />
        {/* Koridorlar + Performans Metrikleri TEK kartta (kart kalabalığını azalt) */}
        <div className="glass rounded-xl overflow-hidden">
          <RoleRadar seasonRoles={data.seasonRoles} plain />
          <ChallengesCard challenges={data.challengeAverages} plain />
        </div>
        <DuoPartnersCard duoPartners={data.duoPartners} />
      </div>

      {/* MERKEZ — Son N oyun + tarihe gruplu maç listesi (inline accordion detay) */}
      <div className="flex-1 min-w-0 space-y-4">
        <Last30Panel matches={matches} />
        <MatchListPro initialMatches={initialMatches} puuid={puuid} onMatchesChange={onMatchesChange} />
      </div>
    </div>
  );
}
