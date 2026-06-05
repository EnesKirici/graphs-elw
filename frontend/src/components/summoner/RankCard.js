"use client";

import { useState } from "react";
import Tooltip from "@/components/shared/Tooltip";
import WinrateSection from "./WinrateSection";

function rankBadgeUrl(tier) {
  return `/ranks/badges/${tier.toLowerCase()}.webp`;
}

function getWrColor(wr) {
  if (wr >= 51) return "text-emerald-400";
  if (wr >= 45) return "text-yellow-400";
  return "text-red-400";
}

function tierLabel(data) {
  return data.tier.charAt(0) + data.tier.slice(1).toLowerCase();
}

/*
  PLACEHOLDER (TEST VERİSİ) — gerçek ladder sıralaması DB/worker ile gelecek.
  Bkz. PROFILE_RANKINGS_PLAN.md. Tier+rank+LP'den makul bir "Top %X" + dünya/TR
  sırası üretir (deterministik, gerçekmiş gibi görünsün diye).
*/
const TIER_BASE_TOP = { IRON: 95, BRONZE: 80, SILVER: 62, GOLD: 46, PLATINUM: 34, EMERALD: 18, DIAMOND: 7, MASTER: 1.5, GRANDMASTER: 0.4, CHALLENGER: 0.05 };
const DIV_ADJ = { IV: 3, III: 1.5, II: 0, I: -2 };

function placeholderLeagueRank(data) {
  const base = TIER_BASE_TOP[(data.tier || "").toUpperCase()] ?? 50;
  const adj = DIV_ADJ[data.rank] ?? 0;
  const topPct = Math.max(0.05, Math.round((base + adj - (data.lp || 0) / 100 * 1.4) * 10) / 10);
  const global = Math.round((topPct / 100) * 9_000_000);
  const tr = Math.round((topPct / 100) * 470_000);
  return { topPct, global, tr };
}

const trNum = (n) => n.toLocaleString("tr-TR");

/* Büyük rank bloğu — büyük ikon, op.gg tarzı sıralama (Dünya → bölge → Top %), WR%. Bar YOK. */
function RankBlock({ data, title, region }) {
  const rk = placeholderLeagueRank(data);

  return (
    <div>
      <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-3">{title}</p>
      <div className="flex items-center gap-4">
        <img
          src={rankBadgeUrl(data.tier)}
          alt={data.tier}
          width={92}
          height={92}
          className="flex-shrink-0 drop-shadow-[0_4px_14px_rgba(0,0,0,0.5)]"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-2xl font-bold text-gray-100 leading-tight">{tierLabel(data)} {data.rank}</p>
            {data.freshBlood && <span className="text-[9px] border tag-emerald px-1.5 py-0.5 rounded-full font-medium">Yeni Yükseldi</span>}
            {data.veteran && <span className="text-[9px] border tag-purple px-1.5 py-0.5 rounded-full font-medium">Deneyimli</span>}
          </div>

          {/* Sıralama — op.gg tarzı: Sıra: dünya (BÖLGE: yerel) + Top %, # YOK, mavi YOK */}
          <p className="text-xs text-gray-400 mt-1.5">
            Sıra: <span className="text-gray-200 font-semibold">{trNum(rk.global)}</span>{" "}
            <span className="text-gray-500">({region}: {trNum(rk.tr)})</span>
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">Top %{rk.topPct}</p>

          <div className="flex items-center gap-3 mt-2">
            <span className="text-sm text-gray-400">{data.lp} LP</span>
            <span className="text-sm">
              <span className="text-emerald-400 font-medium">{data.wins}G</span>
              <span className="text-gray-600 mx-1">/</span>
              <span className="text-red-400 font-medium">{data.losses}M</span>
            </span>
            <span className={`text-base font-bold ${getWrColor(data.winRate)}`}>{data.winRate}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function UnrankedBlock({ title }) {
  return (
    <div>
      <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-3">{title}</p>
      <div className="flex items-center gap-4 opacity-60">
        <div className="w-[92px] h-[92px] rounded-full bg-edge/40 border border-edge flex items-center justify-center flex-shrink-0">
          <span className="text-gray-600 text-sm">?</span>
        </div>
        <p className="text-sm text-gray-500">Unranked</p>
      </div>
    </div>
  );
}

/* Ortalama rakip seviyesi (son 10 maç) — TEST VERİSİ, DB/worker ile gelecek. */
function AvgEnemiesRating() {
  const [anchor, setAnchor] = useState(null);
  const tier = "PLATINUM";
  const label = "Platinum I";

  return (
    <div className="flex items-center gap-3">
      <img src={rankBadgeUrl(tier)} alt={tier} width={34} height={34} className="flex-shrink-0" />
      <div
        onMouseEnter={(e) => setAnchor(e.currentTarget)}
        onMouseLeave={() => setAnchor(null)}
        className="cursor-help"
      >
        <p className="text-[10px] text-gray-500 uppercase tracking-wider">Ortalama Rakip Seviyesi</p>
        <p className="text-sm text-gray-200 font-medium">
          {label} <span className="text-[10px] text-gray-500 font-normal">· son 10 maç</span>
        </p>
      </div>
      {anchor && (
        <Tooltip anchorEl={anchor}>
          <div className="tip-dark bg-[#0a0e14] border border-[#2a3441] rounded-lg px-3 py-2 shadow-2xl shadow-black/90 max-w-[220px] text-center">
            <p className="text-xs text-white font-semibold">Ortalama Rakip Seviyesi</p>
            <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">Son 10 maçta karşılaştığın rakiplerin ortalama rankı.</p>
          </div>
        </Tooltip>
      )}
    </div>
  );
}

/*
  Büyük birleşik sıralama kartı: Solo/Duo + Flex yan yana belirgin bloklar
  (büyük rank ikonu, WR%, Top %X). Altında ortalama rakip seviyesi + WR geçmişi
  grafikleri (Solo açık, Flex kapalı). Geniş ana kolonda durur.
*/
export default function RankCard({ solo, flex, winrateTimeline, region = "TR" }) {
  if (!solo && !flex) {
    return (
      <div className="glass rounded-xl p-6 text-center">
        <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">Sıralamalar</p>
        <p className="text-sm text-gray-600">Bu oyuncu derecesiz</p>
      </div>
    );
  }

  const soloTl = winrateTimeline?.solo?.timeline;
  const flexTl = winrateTimeline?.flex?.timeline;
  const hasGraph = soloTl?.length >= 2 || flexTl?.length >= 2;

  return (
    <div className="glass rounded-xl p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:pr-6">
          {solo ? <RankBlock data={solo} title="Solo/Duo" region={region} /> : <UnrankedBlock title="Solo/Duo" />}
        </div>
        <div className="md:border-l md:border-edge/50 md:pl-6">
          {flex ? <RankBlock data={flex} title="Flex 5v5" region={region} /> : <UnrankedBlock title="Flex 5v5" />}
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-edge/40">
        <AvgEnemiesRating />
      </div>

      {hasGraph && (
        <div className="mt-1">
          {soloTl?.length >= 2 && (
            <WinrateSection timeline={soloTl} defaultOpen={true} label="Solo/Duo — Win Rate Geçmişi" />
          )}
          {flexTl?.length >= 2 && (
            <WinrateSection timeline={flexTl} defaultOpen={false} label="Flex — Win Rate Geçmişi" />
          )}
        </div>
      )}
    </div>
  );
}
