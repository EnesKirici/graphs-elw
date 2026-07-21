"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
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

// Premade grup renkleri (WIN mavi / LOSS kırmızı'dan ayrı, belirgin tonlar)
const PREMADE_COLORS = ["#f59e0b", "#a855f7", "#ec4899", "#22d3ee", "#84cc16"];

// Takım tarafları — LoL'de teamId 100 = Mavi, 200 = Kırmızı.
const BLUE_SIDE = { label: "Mavi", textClass: "text-blue-400", dotClass: "bg-blue-400" };
const RED_SIDE = { label: "Kırmızı", textClass: "text-rose-400", dotClass: "bg-rose-400" };

/**
 * Aynı TAKIMDAKİ oyuncuların premade (duo/trio) gruplarını sezgisel bul.
 * Sinyal: enrichment.recentGames[].matchId ORTAK olanlar birlikte oynamış →
 * eşik üstü ortak maç = premade. Spectator parti vermez; ekstra API yok.
 * Union-find ile bağlı bileşenler → 2+ kişilik gruplar.
 */
function premadeGroups(players, enrichments, threshold = 2) {
  const ids = players.map((p) => p.puuid).filter(Boolean);
  if (ids.length < 2) return [];
  const sets = {};
  for (const id of ids) {
    const mids = (enrichments[id]?.recentGames || []).map((g) => g.matchId).filter(Boolean);
    sets[id] = new Set(mids);
  }
  const parent = {};
  ids.forEach((id) => (parent[id] = id));
  const find = (x) => {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  };
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i], b = ids[j];
      let shared = 0;
      for (const m of sets[a]) if (sets[b].has(m)) shared++;
      if (shared >= threshold) parent[find(a)] = find(b);
    }
  }
  const groups = {};
  ids.forEach((id) => { const r = find(id); (groups[r] = groups[r] || []).push(id); });
  return Object.values(groups).filter((g) => g.length >= 2);
}

function TeamColumn({ title, side, players, enrichments, loadingSet, isEnemy, premadeMap, flipSignal }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <span className={`w-2 h-2 rounded-full ${side.dotClass}`} />
        <h2 className="text-sm font-bold text-gray-200">{title}</h2>
        <span className={`text-[11px] font-semibold ${side.textClass}`}>· {side.label} Takım</span>
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
            premade={premadeMap?.[p.puuid] || null}
            flipSignal={flipSignal}
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

  // Aranan oyuncunun (senin takımının) tarafı — API'den teamId (100=Mavi, 200=Kırmızı).
  const allyBlue = (game.searchedTeamId ?? 100) === 100;
  const allySide = allyBlue ? BLUE_SIDE : RED_SIDE;
  const enemySide = allyBlue ? RED_SIDE : BLUE_SIDE;

  // Premade (duo/trio) grupları — takım bazında, ortak son maçlardan. Renk ata.
  const premadeMap = useMemo(() => {
    const map = {};
    let ci = 0;
    for (const team of [ally, enemy]) {
      for (const g of premadeGroups(team, enrichments)) {
        const color = PREMADE_COLORS[ci % PREMADE_COLORS.length];
        ci++;
        for (const id of g) map[id] = { color, size: g.length };
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.gameId, enrichments]);

  // TÜM kartları çevirme SİNYALİ — VS butonu / çift tık tetikler. Her sinyalde v artar,
  // target alternatif olur; kartlar bu sinyali görünce hedefe SNAP eder (XOR yok → tuhaflık yok).
  const [flipSignal, setFlipSignal] = useState({ v: 0, target: false });
  const toggleFlipAll = () => setFlipSignal((s) => ({ v: s.v + 1, target: !s.target }));

  useEffect(() => {
    if (game.mock) return;
    let alive = true;
    const allyChamps = ally.map((p) => p.champion?.name).filter(Boolean);
    const enemyChamps = enemy.map((p) => p.champion?.name).filter(Boolean);
    const allyPuuids = new Set(ally.map((p) => p.puuid));
    // fetchPriority sırası (bana en yakın matchup önce) — rate-limit stratejisi.
    const byPriority = (a, b) => (a.fetchPriority ?? 9) - (b.fetchPriority ?? 9);
    const all = [...ally, ...enemy].filter((p) => p.puuid && !p.isBot).sort(byPriority);
    if (all.length === 0) {
      setLoading(false);
      return;
    }

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    // Tek oyuncuyu çek. Başarılı (error'suz veri) → kaydet + true. Düştü
    // (rate_limit / failed / null) → false (saklamayız, retry'a kalır).
    async function fetchOne(p) {
      const opp = allyPuuids.has(p.puuid) ? enemyChamps : allyChamps;
      const data = await getLivePlayer(p.puuid, p.champion?.name, {
        role: p.role,
        autofilled: p.autofilled,
        enemyChamps: opp,
      });
      if (!alive) return true;
      if (data && !data.error) {
        setEnrichments((prev) => ({ ...prev, [p.puuid]: data }));
        return true;
      }
      return false;
    }

    // Öncelik sırasıyla çek; rate-limit'e takılıp DÜŞENLERİ, limit yenilensin diye
    // bekleyip TEKRAR DENE (priority-deferral). Başarılı olunca backend DB'ye de yazar.
    async function run() {
      setLoading(true);
      let pending = all;
      const MAX_ROUNDS = 4;       // ilk tur + 3 retry
      const RETRY_DELAY = 15000;  // ~15sn — rate-limit penceresi yenilensin
      for (let round = 0; round < MAX_ROUNDS && pending.length && alive; round++) {
        if (round > 0) {
          await sleep(RETRY_DELAY);
          if (!alive) return;
          pending = [...pending].sort(byPriority); // retry'da da öncelik korunsun
        }
        const failed = [];
        await runThrottled(
          pending,
          async (p) => {
            const ok = await fetchOne(p);
            if (!ok) failed.push(p);
          },
          3
        );
        pending = failed;
      }
      if (alive) setLoading(false);
    }
    run();

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
          Yoğunluk nedeniyle bazı oyuncu verileri eksik ya da gecikmeli gelebilir.
        </div>
      )}

      <div className="space-y-5">
        <TeamColumn
          title="Senin Takımın"
          side={allySide}
          players={ally}
          enrichments={enrichments}
          loadingSet={loading}
          isEnemy={false}
          premadeMap={premadeMap}
          flipSignal={flipSignal}
        />

        {/* Takımlar arası ayraç — taraf renkleriyle (Mavi/Kırmızı); ortadaki buton TÜM kartları çevirir */}
        <div className="flex items-center gap-4 px-1 py-0.5">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-edge to-edge" />
          <span className="flex items-center gap-2.5 text-[11px] font-bold tracking-[0.25em] whitespace-nowrap">
            <span className={allySide.textClass}>{allySide.label.toUpperCase()} TAKIM <span className="text-gray-500 tracking-normal">(Sen)</span></span>
            <button
              type="button"
              onClick={toggleFlipAll}
              title="Tüm kartları çevir (ön ↔ arka)"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-soft border border-edge text-gray-300 tracking-[0.15em] hover:bg-hover hover:text-white hover:border-blue-500/50 transition-colors cursor-pointer"
            >
              <RefreshCw size={11} strokeWidth={2.4} className="tracking-normal" />
              VS
            </button>
            <span className={enemySide.textClass}>{enemySide.label.toUpperCase()} TAKIM</span>
          </span>
          <div className="flex-1 h-px bg-gradient-to-l from-transparent via-edge to-edge" />
        </div>

        <TeamColumn
          title="Rakip Takım"
          side={enemySide}
          players={enemy}
          enrichments={enrichments}
          loadingSet={loading}
          isEnemy={true}
          premadeMap={premadeMap}
          flipSignal={flipSignal}
        />
      </div>

      <p className="mt-6 text-center text-[11px] text-gray-600">
        Karta tıkla → build, rün ve detaylar. <span className="text-gray-500">Ortadaki <span className="text-gray-400 font-semibold">VS</span> butonu → tüm kartları çevirir.</span> Veriler oyuncunun son maçlarından türetilir.
      </p>
    </div>
  );
}
