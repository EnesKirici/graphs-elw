"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import LpRiseChart from "./LpRiseChart";
import {
  rankBadgeUrl, placeholderLeagueRank, rankToAbsolute, absoluteToDisplay, tierLabel, tierColor, TIER_TR,
} from "./rankUtils";

const trNum = (n) => n.toLocaleString("tr-TR");

// Tier adı + LP TEK renkte, rank rengine göre (Challenger mavi vb.).
function TierHeading({ data, className }) {
  return (
    <p className={className} style={{ color: tierColor(data.tier) }}>
      {tierLabel(data)} {data.lp} LP
    </p>
  );
}

function lpWindowChange(timeline, days) {
  if (!timeline || timeline.length < 2) return null;
  const cutoff = Date.now() - days * 86400000;
  const win = timeline.filter((t) => !t.timestamp || t.timestamp >= cutoff);
  if (win.length < 2) return null;
  return win[win.length - 1].lp - win[0].lp;
}

function ChangeBadge({ label, value }) {
  if (value == null) return null;
  const up = value >= 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400">{label}</span>
      <span className={`text-sm font-bold ${up ? "text-blue-400" : "text-red-400"}`}>
        {up ? "▲" : "▼"} {Math.abs(value)} LP
      </span>
    </div>
  );
}

function MiniRank({ label, tier, rank, lp, title }) {
  return (
    <div className="flex items-center gap-1.5" title={title}>
      <img src={rankBadgeUrl(tier)} alt="" width={24} height={24} className="flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-[9px] text-gray-400 uppercase tracking-wide leading-none">{label}</p>
        <p className="text-[12px] text-gray-100 font-semibold leading-tight mt-0.5">
          {TIER_TR[tier] || tier}{rank ? ` ${rank}` : ""} · {lp} LP
        </p>
      </div>
    </div>
  );
}

// LP Gelişimi / WR grafiği toggle'lı görünüm
function RankCharts({ lpTl, wrTl, tier }) {
  const [mode, setMode] = useState("lp"); // default LP
  const hasLp = lpTl?.timeline?.length >= 2;
  const hasWr = wrTl?.length >= 2;
  if (!hasLp && !hasWr) return null;

  return (
    <div className="mt-4">
      <div className="flex items-center gap-1.5 mb-2">
        {hasLp && (
          <button onClick={() => setMode("lp")}
            className={`text-xs px-2.5 py-1 rounded-full transition-colors cursor-pointer ${mode === "lp" ? "text-cyan-300 bg-cyan-500/15 font-semibold" : "text-gray-400 hover:text-gray-200"}`}>
            LP Gelişimi
          </button>
        )}
        {hasWr && (
          <button onClick={() => setMode("wr")}
            className={`text-xs px-2.5 py-1 rounded-full transition-colors cursor-pointer ${mode === "wr" ? "text-sky-300 bg-sky-500/15 font-semibold" : "text-gray-400 hover:text-gray-200"}`}>
            WR
          </button>
        )}
      </div>
      {mode === "lp" && hasLp && (
        <LpRiseChart timeline={lpTl.timeline} peak={lpTl.peak} estimated={lpTl.estimated} tracked={lpTl.tracked} tier={tier} showHeaderLabel={false} />
      )}
      {mode === "wr" && hasWr && (
        <LpRiseChart timeline={wrTl} variant="wr" showHeaderLabel={false} />
      )}
    </div>
  );
}

function SoloBlock({ data, region, lpTl, wrTl, avgGameRank }) {
  const rk = placeholderLeagueRank(data);
  const peak = lpTl?.peak;
  // Tahmini MMR — son 20 maç rakip rank ortalaması (backend). Yoksa rank+WR'dan kabataslak.
  const mmr = avgGameRank
    ? { tier: avgGameRank.tier, rank: avgGameRank.rank, lp: avgGameRank.lp, sample: avgGameRank.sampleSize }
    : absoluteToDisplay(rankToAbsolute(data.tier, data.rank, data.lp) + Math.round(((data.winRate ?? 50) - 50) * 3));
  const d30 = lpWindowChange(lpTl?.timeline, 30);
  const d7 = lpWindowChange(lpTl?.timeline, 7);

  return (
    <div>
      <div className="flex items-center gap-3.5">
        <img src={rankBadgeUrl(data.tier)} alt={data.tier} width={72} height={72} className="flex-shrink-0 drop-shadow-[0_4px_14px_rgba(0,0,0,0.5)]" />
        <div className="min-w-0 flex-1">
          <TierHeading data={data} className="text-xl font-extrabold leading-tight" />
          <p className="text-[13px] mt-1">
            <span className="text-blue-400 font-semibold">{data.wins}G</span>{" "}
            <span className="text-red-400 font-semibold">{data.losses}M</span>{" "}
            <span className="text-gray-400">({data.winRate}%)</span>
          </p>
          <p className="text-[11px] text-gray-400 mt-1">
            Ladder: <span className="text-gray-100 font-semibold">{trNum(rk.tr)}.</span>{" "}
            <span className="text-gray-500">({region} · Top %{rk.topPct})</span>
          </p>
        </div>
      </div>

      {(d30 != null || d7 != null) && (
        <div className="flex items-center justify-between mt-3 px-1">
          <ChangeBadge label="Son 30g" value={d30} />
          <ChangeBadge label="Son 7g" value={d7} />
        </div>
      )}

      <RankCharts lpTl={lpTl} wrTl={wrTl} tier={data.tier} />

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-edge/50">
        {peak && <MiniRank label="Peak" tier={peak.tier} rank={peak.rank} lp={peak.divLp} />}
        <MiniRank
          label="Tahmini MMR"
          tier={mmr.tier} rank={mmr.rank} lp={mmr.lp}
          title={avgGameRank ? `Son maçlardaki ${mmr.sample} rakibin ortalama rankı` : "Riot MMR vermez; mevcut rank + son performanstan tahmin."}
        />
      </div>
    </div>
  );
}

// Flex — accordion: LP grafiği butona basınca açılır (default kapalı).
function FlexBlock({ data, region, lpTl }) {
  const [open, setOpen] = useState(false);
  const rk = placeholderLeagueRank(data);
  const hasChart = lpTl?.timeline?.length >= 2;

  return (
    <div>
      <button
        onClick={() => hasChart && setOpen(!open)}
        className={`w-full flex items-center gap-3 text-left ${hasChart ? "cursor-pointer group" : "cursor-default"}`}
      >
        <img src={rankBadgeUrl(data.tier)} alt={data.tier} width={44} height={44} className="flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <TierHeading data={data} className="text-base font-bold leading-tight" />
          <p className="text-xs mt-1">
            <span className="text-blue-400 font-semibold">{data.wins}G</span>{" "}
            <span className="text-red-400 font-semibold">{data.losses}M</span>{" "}
            <span className="text-gray-400">({data.winRate}%)</span>
            <span className="text-gray-500"> · Top %{rk.topPct}</span>
          </p>
        </div>
        {hasChart && (
          <ChevronDown size={18} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
        )}
      </button>
      {open && hasChart && (
        <div className="mt-3">
          <LpRiseChart timeline={lpTl.timeline} peak={lpTl.peak} estimated={lpTl.estimated} tracked={lpTl.tracked} tier={data.tier} />
        </div>
      )}
    </div>
  );
}

function UnrankedRow({ title }) {
  return (
    <div className="flex items-center gap-3 opacity-60">
      <div className="w-14 h-14 rounded-full bg-edge/40 border border-edge flex items-center justify-center flex-shrink-0">
        <span className="text-gray-500 text-base">?</span>
      </div>
      <p className="text-sm text-gray-400">{title} — Derecesiz</p>
    </div>
  );
}

/*
  dpm.lol stili "Dereceli" kutusu (profil sol kolon).
  Solo/Duo (LP/WR grafik toggle ile) belirgin + altında accordion Flex.
*/
export default function RankBoxPro({ solo, flex, region = "TR", lpTimeline, winrateTimeline, avgGameRank }) {
  if (!solo && !flex) {
    return (
      <div className="glass rounded-xl p-6 text-center">
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Sıralamalar</p>
        <p className="text-sm text-gray-500">Bu oyuncu derecesiz</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-4">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Dereceli Solo/Duo</p>
      {solo
        ? <SoloBlock data={solo} region={region} lpTl={lpTimeline?.solo} wrTl={winrateTimeline?.solo?.timeline} avgGameRank={avgGameRank} />
        : <UnrankedRow title="Solo/Duo" />}

      <div className="mt-3 pt-3 border-t border-edge/50">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Dereceli Esnek</p>
        {flex
          ? <FlexBlock data={flex} region={region} lpTl={lpTimeline?.flex} />
          : <UnrankedRow title="Esnek" />}
      </div>
    </div>
  );
}
