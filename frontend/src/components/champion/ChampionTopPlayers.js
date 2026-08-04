"use client";

import Link from "next/link";
import { profileIcon } from "@/lib/buildData";

/*
  Şampiyonun en iyi oyuncuları — İKİ AYRI SIRALAMA.

  Tek liste "en iyi" sorusuna tek cevap veriyordu, oysa iki farklı cevabı var:
  bir oyuncu şampiyonu en çok işlemiş olabilir (ustalık), bir başkası ligde daha
  yükseğe çıkmış olabilir (ladder). Yan yana iki panel, her biri kendi ölçütüyle.

  ⚠ USTALIK PUANI ve LİG DERECESİ ŞU AN ÖRNEK VERİDİR. Gerçeği Riot'un
  champion-mastery ve league uçlarından oyuncu başına 1'er istekle gelir; dev
  anahtarın kotası dar olduğu için şimdilik oynanan maçtan DETERMİNİSTİK
  türetiliyor. Uyarı panel dibinde bir cümle yerine başlıktaki "?" ipucunda:
  her satırın altında duran uyarı metni listeyi boğuyordu, ama uyarının kendisi
  kalmalı — sahte sayıyı sessizce gerçekmiş gibi sunmak yanıltıcı olur.
  Gerçeğe geçerken: mockMastery/mockRank + ipuçları silinir.
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

/** Örnek lig verisi: havuz Emerald+ olduğu için taban Emerald, tavan Challenger. */
function mockRank(name, games, winRate) {
  const h = hash(name + "|rank");
  const base = (games || 1) * 4 + (winRate - 50) * 8 + (h % 600);
  const lp = Math.max(0, Math.round(base));
  const tier = TIERS.find((t) => lp >= t.min) || TIERS[TIERS.length - 1];
  const division = tier.min >= 600 ? null : DIVISIONS[h % 4];
  return { tier, division, lp: tier.min >= 600 ? lp : lp % 100, sort: lp };
}

const wrCls = (wr) => (wr >= 52 ? "text-blue-300" : wr >= 49 ? "text-gray-200" : "text-red-400");

/* Profil ikonu olmayan oyuncular (cached_players'ta kaydı yok) boş gri kutu olarak
   duruyordu — listede delik gibi görünüyordu. Adın baş harfi, isimden türeyen sabit
   bir renkle: yer tutucu belli olsun ama "eksik" gibi durmasın. */
const AVATAR_TONES = [
  "from-blue-500/30 to-blue-500/5 text-blue-200",
  "from-violet-500/30 to-violet-500/5 text-violet-200",
  "from-emerald-500/30 to-emerald-500/5 text-emerald-200",
  "from-amber-500/30 to-amber-500/5 text-amber-200",
  "from-rose-500/30 to-rose-500/5 text-rose-200",
];

function Avatar({ p, version, size = 40 }) {
  if (p.profileIconId != null) {
    return (
      <img
        src={profileIcon(version, p.profileIconId)}
        alt=""
        width={size}
        height={size}
        className="rounded-lg border border-edge shrink-0"
        onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
      />
    );
  }
  const tone = AVATAR_TONES[hash(p.name) % AVATAR_TONES.length];
  return (
    <span
      className={`rounded-lg border border-edge shrink-0 flex items-center justify-center font-bold bg-gradient-to-br ${tone}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      title={p.name}
    >
      {String(p.name).trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** Başlık yanındaki "?" — örnek veri uyarısı satır kaplamadan burada durur. */
function InfoDot({ text }) {
  return (
    <span
      title={text}
      className="w-4 h-4 rounded-full border border-amber-400/40 bg-amber-500/10 text-amber-300/90 text-[10px] font-bold flex items-center justify-center cursor-help shrink-0"
      aria-label={text}
    >
      ?
    </span>
  );
}

function Rank({ i }) {
  return (
    <span className={`w-6 text-center text-base font-extrabold tabular-nums shrink-0 ${MEDAL[i] || "text-gray-600"}`}>
      {i + 1}
    </span>
  );
}

function TierBadge({ ladder, size = 28 }) {
  return (
    <img
      src={`/ranks/badges/${ladder.tier.key.toLowerCase()}.webp`}
      alt=""
      width={size}
      height={size}
      className="shrink-0"
      onError={(e) => { e.currentTarget.style.display = "none"; }}
    />
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

  const byMastery = [...rows].sort((a, b) => b.mastery - a.mastery).slice(0, 10);
  const byLadder = [...rows].sort((a, b) => b.ladder.sort - a.ladder.sort).slice(0, 10);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      {/* USTALIK — şampiyonu en çok işleyenler. Yanında oyuncunun güncel ligi
          (ustalık tek başına "ne kadar oynadı" der, "ne kadar iyi" demez). */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-edge/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Ustalık Sıralaması</h3>
            <InfoDot text="Oyuncular ve sıralama gerçek maç verisinden gelir. Ustalık puanları şimdilik örnek veridir — Riot ustalık ucu prod anahtarla bağlanınca gerçek değerlerle değişecek." />
          </div>
          <span className="text-[10px] text-gray-600">Ustalık puanı</span>
        </div>
        <div className="p-2 divide-y divide-edge/20">
          {byMastery.map((p, i) => (
            <Link
              key={`m-${p.name}-${p.tag}`}
              href={`/summoner/${encodeURIComponent(p.name)}/${encodeURIComponent(p.tag || "")}`}
              className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-hover transition-colors group"
              title={`${p.name}#${p.tag}`}
            >
              <Rank i={i} />
              <Avatar p={p} version={version} />
              <span className="text-sm text-gray-200 truncate flex-1 min-w-0 group-hover:text-white transition-colors">
                {p.name}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <TierBadge ladder={p.ladder} size={24} />
                <span className={`text-[11px] font-semibold hidden sm:inline ${p.ladder.tier.color}`}>
                  {p.ladder.tier.label}
                  {p.ladder.division ? ` ${p.ladder.division}` : ""}
                </span>
              </div>
              <span className="text-sm font-bold text-violet-300 tabular-nums w-[74px] text-right shrink-0">
                {p.mastery.toLocaleString("tr-TR")}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* LADDER — aynı havuzun ligdeki en yüksekleri, sütunlara ayrılmış */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-edge/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">TR Sıralaması</h3>
            <InfoDot text="Oyuncular, maç sayıları ve kazanma oranları gerçektir. Lig dereceleri (tier/LP) şimdilik örnek veridir — Riot league ucu prod anahtarla bağlanınca gerçek değerlerle değişecek." />
          </div>
          <span className="text-[10px] text-gray-600">{championName} ile</span>
        </div>
        <div className="p-2">
          <table className="w-full">
            <thead>
              <tr className="text-[10px] text-gray-600 uppercase tracking-wider">
                <th className="font-medium text-left pb-2 pl-3 w-8">#</th>
                <th className="font-medium text-left pb-2">Oyuncu</th>
                <th className="font-medium text-left pb-2 w-32 hidden sm:table-cell">Derece</th>
                <th className="font-medium text-right pb-2 w-14">LP</th>
                <th className="font-medium text-right pb-2 w-14">Maç</th>
                <th className="font-medium text-right pb-2 pr-3 w-16">Kazanma</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/20">
              {byLadder.map((p, i) => (
                <tr key={`l-${p.name}-${p.tag}`} className="group hover:bg-hover transition-colors">
                  <td className="py-2.5 pl-3">
                    <Rank i={i} />
                  </td>
                  <td className="py-2.5">
                    <Link
                      href={`/summoner/${encodeURIComponent(p.name)}/${encodeURIComponent(p.tag || "")}`}
                      className="flex items-center gap-2.5 min-w-0"
                      title={`${p.name}#${p.tag}`}
                    >
                      <Avatar p={p} version={version} size={34} />
                      <span className="text-sm text-gray-200 truncate group-hover:text-white transition-colors">
                        {p.name}
                      </span>
                    </Link>
                  </td>
                  <td className="py-2.5 hidden sm:table-cell">
                    <div className="flex items-center gap-1.5">
                      <TierBadge ladder={p.ladder} />
                      <span className={`text-[11px] font-semibold ${p.ladder.tier.color}`}>
                        {p.ladder.tier.label}
                        {p.ladder.division ? ` ${p.ladder.division}` : ""}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 text-right text-xs text-gray-400 tabular-nums">{p.ladder.lp}</td>
                  <td className="py-2.5 text-right text-xs text-gray-400 tabular-nums">{p.games}</td>
                  <td className={`py-2.5 pr-3 text-right text-sm font-bold tabular-nums ${wrCls(p.winRate)}`}>
                    {p.winRate}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
