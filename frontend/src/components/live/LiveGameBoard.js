"use client";

import { useEffect, useState } from "react";
import { getLivePlayer } from "@/lib/api";
import LiveGameTimer from "@/components/live/LiveGameTimer";
import LivePlayerCard from "@/components/live/LivePlayerCard";

/** Sınırlı eşzamanlılıkla işle (rate-limit dostu). */
async function runThrottled(items, worker, limit = 3) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      await worker(item);
    }
  });
  await Promise.all(runners);
}

function TeamColumn({ title, dotClass, players, enrichments, loadingSet, isEnemy }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <span className={`w-2 h-2 rounded-full ${dotClass}`} />
        <h2 className="text-sm font-bold text-gray-200">{title}</h2>
        <span className="text-xs text-gray-500">({players.length})</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        {players.map((p, i) => (
          <LivePlayerCard
            key={p.puuid || `${title}-${i}`}
            participant={p}
            enrichment={enrichments[p.puuid] || null}
            loading={!enrichments[p.puuid] && !p.isBot && loadingSet}
            isEnemy={isEnemy}
          />
        ))}
      </div>
    </div>
  );
}

export default function LiveGameBoard({ game }) {
  // Mock modda enrichment fixture'a gömülü gelir → client fetch yapma.
  const [enrichments, setEnrichments] = useState(game.players || {});
  const [loading, setLoading] = useState(!game.mock);

  const ally = game.allyTeam || [];
  const enemy = game.enemyTeam || [];

  useEffect(() => {
    if (game.mock) return;
    let alive = true;
    const all = [...ally, ...enemy].filter((p) => p.puuid && !p.isBot);
    if (all.length === 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    runThrottled(
      all,
      async (p) => {
        const data = await getLivePlayer(p.puuid, p.champion?.name);
        if (alive && data) {
          setEnrichments((prev) => ({ ...prev, [p.puuid]: data }));
        }
      },
      3
    ).finally(() => {
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.gameId]);

  return (
    <div className="max-w-[1480px] mx-auto px-4 py-5">
      {/* İnce ortalı durum satırı (DPM tarzı) */}
      <div className="flex items-center justify-center gap-2.5 mb-6 text-sm">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
        </span>
        <span className="font-bold text-emerald-400">CANLI</span>
        <span className="text-gray-600">·</span>
        <span className="text-gray-300 font-medium">{game.queueName}</span>
        <span className="text-gray-600">·</span>
        <span className="font-bold text-gray-100 tabular-nums">
          <LiveGameTimer gameStartTime={game.gameStartTime} gameLength={game.gameLength} />
        </span>
      </div>

      {game.rateLimited && (
        <div className="mb-4 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
          Riot API yoğunluğu nedeniyle bazı oyuncu verileri eksik/gecikmeli gelebilir.
        </div>
      )}

      <div className="space-y-6">
        <TeamColumn
          title="Senin Takımın"
          dotClass="bg-emerald-400"
          players={ally}
          enrichments={enrichments}
          loadingSet={loading}
          isEnemy={false}
        />
        <TeamColumn
          title="Rakip Takım"
          dotClass="bg-rose-400"
          players={enemy}
          enrichments={enrichments}
          loadingSet={loading}
          isEnemy={true}
        />
      </div>

      <p className="mt-6 text-center text-[11px] text-gray-600">
        Karta tıkla → build, rün ve detaylar. Veriler oyuncunun son maçlarından türetilir.
      </p>
    </div>
  );
}
