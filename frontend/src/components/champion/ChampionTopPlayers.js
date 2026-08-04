"use client";

import Link from "next/link";
import { profileIcon } from "@/lib/buildData";

/*
  Şampiyonun en iyi oyuncuları — İKİ AYRI SIRALAMA.

  Tek liste "en iyi" sorusuna tek cevap veriyordu, oysa iki farklı cevabı var:
  bir oyuncu şampiyonu en çok oynayan olabilir (ustalık), bir başkası ligde en
  yükseğe çıkmış olabilir (ladder). İkisini aynı tabloda sıralamak birini
  gizliyordu; artık yan yana iki panel, her biri kendi ölçütüyle sıralı.

  ⚠ USTALIK ve LİG DERECESİ ŞU AN ÖRNEK VERİDİR. Gerçeği Riot'un
  champion-mastery ve league uçlarından oyuncu başına 1'er istekle gelir; dev
  anahtarın kotası dar olduğu için (prod anahtar bekleniyor) şimdilik oynanan
  maçtan DETERMİNİSTİK türetiliyor ve paneller bunu görünür biçimde yazıyor —
  sahte sayıyı gerçekmiş gibi sunmak ziyaretçiyi yanıltırdı.
  Gerçeğe geçerken: mockMastery/mockRank + uyarı satırları silinir.
*/

const MEDAL = ["text-amber-300", "text-gray-300", "text-orange-400"];

const TIERS = [
  { key: "CHALLENGER", label: "Challenger", color: "text-yellow-300", min: 1200 },
  { key: "GRANDMASTER", label: "Grandmaster", color: "text-red-400", min: 900 },
  { key: "MASTER", label: "Master", color: "text-purple-400", min: 600 },
  { key: "DIAMOND", label: "Diamond", color: "text-sky-300", min: 400 },
  { key: "EMERALD", label: "Emerald", color: "text-emerald-300", min: 0 },
];

const DIVISIONS = ["I", "II", "III", "IV"];

/** Aynı oyuncu her yenilemede aynı sayıyı görsün diye isimden türeyen sabit hash. */
function hash(name) {
  let h = 0;
  for (let i = 0; i < String(name).length; i++) h = (h * 31 + String(name).charCodeAt(i)) >>> 0;
  return h;
}

function mockMastery(name, games) {
  const spread = 0.6 + ((hash(name) % 1000) / 1000) * 1.8; // 0.6x - 2.4x
  return Math.round(((games || 1) * 1500 * spread) / 100) * 100;
}

const MASTERY_LEVEL = (pts) =>
  pts >= 500000 ? 10 : pts >= 200000 ? 9 : pts >= 100000 ? 8 : pts >= 50000 ? 7 : pts >= 21600 ? 6 : 5;

/** Örnek lig verisi: Emerald+ havuzu olduğu için taban Emerald, tavan Challenger. */
function mockRank(name, games, winRate) {
  const h = hash(name + "|rank");
  // Maç sayısı ve kazanma oranı yüksek olan biraz daha yukarıda çıksın (tutarlı görünsün)
  const base = (games || 1) * 4 + (winRate - 50) * 8 + (h % 600);
  const lp = Math.max(0, Math.round(base));
  const tier = TIERS.find((t) => lp >= t.min) || TIERS[TIERS.length - 1];
  const division = tier.min >= 600 ? null : DIVISIONS[h % 4];
  // Master+ için LP doğrudan; alt tierlerde 0-100 aralığına indir
  const shownLp = tier.min >= 600 ? lp : lp % 100;
  return { tier, division, lp: shownLp, sort: lp };
}

const fmtPts = (n) => (n >= 1000 ? `${Math.round(n / 1000)}K` : String(n));
const wrCls = (wr) => (wr >= 52 ? "text-blue-300" : wr >= 49 ? "text-gray-200" : "text-red-400");

function PlayerAvatar({ p, version, size = 34 }) {
  return p.profileIconId != null ? (
    <img
      src={profileIcon(version, p.profileIconId)}
      alt=""
      width={size}
      height={size}
      className="rounded-lg border border-edge shrink-0"
      onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
    />
  ) : (
    <span className="rounded-lg bg-edge/50 border border-edge shrink-0" style={{ width: size, height: size }} />
  );
}

/** Ortak satır iskeleti: sıra + avatar + isim + sağda ölçüte özel blok. */
function Row({ p, i, version, right, sub }) {
  return (
    <Link
      href={`/summoner/${encodeURIComponent(p.name)}/${encodeURIComponent(p.tag || "")}`}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-hover transition-colors group"
      title={`${p.name}#${p.tag}`}
    >
      <span className={`w-5 text-center text-sm font-extrabold tabular-nums shrink-0 ${MEDAL[i] || "text-gray-600"}`}>
        {i + 1}
      </span>
      <PlayerAvatar p={p} version={version} />
      <div className="min-w-0 flex-1">
        <div className="text-sm text-gray-200 truncate group-hover:text-white transition-colors">{p.name}</div>
        <div className="text-[10px] text-gray-500 mt-0.5">{sub}</div>
      </div>
      {right}
    </Link>
  );
}

export default function ChampionTopPlayers({ players, version, championName }) {
  if (!players?.length) {
    return (
      <div className="glass rounded-xl p-6 text-center">
        <p className="text-[11px] text-gray-600">Bu şampiyon için henüz yeterli oyuncu verisi toplanmadı.</p>
      </div>
    );
  }

  const rows = players.map((p) => ({
    ...p,
    mastery: mockMastery(p.name, p.games),
    ladder: mockRank(p.name, p.games, p.winRate),
  }));

  const byMastery = [...rows].sort((a, b) => b.mastery - a.mastery).slice(0, 8);
  const byLadder = [...rows].sort((a, b) => b.ladder.sort - a.ladder.sort).slice(0, 8);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* USTALIK — şampiyonu en çok işleyenler */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-edge/40 flex items-center justify-between gap-3">
          <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Ustalık Sıralaması</h3>
          <span className="text-[10px] text-gray-600">Ustalık puanı · maç</span>
        </div>
        <div className="p-2 divide-y divide-edge/20">
          {byMastery.map((p, i) => (
            <Row
              key={`m-${p.name}-${p.tag}`}
              p={p}
              i={i}
              version={version}
              sub={`${p.games} maç · %${p.winRate} kazanma`}
              right={
                <div className="flex items-center gap-2.5 shrink-0">
                  <img
                    src={`/masteries/level${Math.min(MASTERY_LEVEL(p.mastery), 10)}.webp`}
                    alt=""
                    width={28}
                    height={28}
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                  <div className="text-right">
                    <div className="text-sm font-bold text-violet-300 tabular-nums leading-none">{fmtPts(p.mastery)}</div>
                    <div className="text-[10px] text-gray-600 mt-1 leading-none">seviye {MASTERY_LEVEL(p.mastery)}</div>
                  </div>
                </div>
              }
            />
          ))}
        </div>
        <p className="px-4 py-2.5 border-t border-edge/30 text-[10px] text-gray-600">
          Maç sayıları gerçek · <span className="text-amber-400/80">ustalık puanları örnek veri</span>
        </p>
      </div>

      {/* LADDER — aynı havuzun ligdeki en yüksekleri */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-edge/40 flex items-center justify-between gap-3">
          <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">TR Sıralaması</h3>
          <span className="text-[10px] text-gray-600">Lig derecesi · LP</span>
        </div>
        <div className="p-2 divide-y divide-edge/20">
          {byLadder.map((p, i) => (
            <Row
              key={`l-${p.name}-${p.tag}`}
              p={p}
              i={i}
              version={version}
              sub={`${championName || "Bu şampiyon"} ile ${p.games} maç`}
              right={
                <div className="flex items-center gap-2.5 shrink-0">
                  <img
                    src={`/ranks/badges/${p.ladder.tier.key.toLowerCase()}.webp`}
                    alt=""
                    width={30}
                    height={30}
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                  <div className="text-right">
                    <div className={`text-xs font-bold leading-none ${p.ladder.tier.color}`}>
                      {p.ladder.tier.label}
                      {p.ladder.division ? ` ${p.ladder.division}` : ""}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-1 leading-none tabular-nums">{p.ladder.lp} LP</div>
                  </div>
                  <span className={`text-xs font-bold tabular-nums w-11 text-right ${wrCls(p.winRate)}`}>
                    {p.winRate}%
                  </span>
                </div>
              }
            />
          ))}
        </div>
        <p className="px-4 py-2.5 border-t border-edge/30 text-[10px] text-gray-600">
          Oyuncular gerçek · <span className="text-amber-400/80">lig dereceleri örnek veri</span>
        </p>
      </div>
    </div>
  );
}
