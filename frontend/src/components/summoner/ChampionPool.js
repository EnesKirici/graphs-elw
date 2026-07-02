"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ArrowDownUp, HelpCircle } from "lucide-react";
import ReactDOM from "react-dom";
import QueueTabs from "./QueueTabs";

const VIEWS = [
  { key: "played", label: "En Çok Oynanan" },
  { key: "mastery", label: "Ustalık Puanı" },
];

const GAME_TYPES = [
  { key: "all", label: "Tümü" },
  { key: "ranked", label: "Dereceli" },
  { key: "normal", label: "Normal" },
];

function formatPoints(p) {
  if (p >= 1000000) return (p / 1000000).toFixed(1) + "M";
  if (p >= 1000) return (p / 1000).toFixed(1) + "K";
  return p.toString();
}

function getMasteryCrestUrl(level) {
  if (!level || level <= 0) return null;
  if (level <= 3) return "/masteries/level0.webp";
  if (level >= 10) return "/masteries/level10.webp";
  return `/masteries/level${level}.webp`;
}

// RENK KONVANSİYONU: ≥51 cyan (iyi), 45-50 nötr gri, <45 kırmızı. Bar = sayı rengiyle aynı.
function getWrColor(wr) {
  if (wr >= 60) return "text-cyan-400";
  if (wr >= 50) return "text-blue-400";
  if (wr >= 45) return "text-gray-300";
  return "text-red-400";
}
function getWrBar(wr) {
  if (wr >= 60) return "bg-cyan-500";
  if (wr >= 50) return "bg-blue-500";
  if (wr >= 45) return "bg-gray-400";
  return "bg-red-500";
}

// KDA: iyi cyan, orta mavi, nötr gri, kötü kırmızı.
function getKdaColor(ratio) {
  if (ratio === "Perfect" || ratio >= 4) return "text-cyan-400";
  if (ratio >= 2.5) return "text-blue-400";
  if (ratio >= 1.8) return "text-gray-300";
  return "text-red-400";
}

/* KDA değeri — Perfect ise portal tooltip ile açıklama */
function KdaValue({ ratio }) {
  const [anchor, setAnchor] = useState(null);
  const isPerfect = ratio === "Perfect";
  const color = getKdaColor(ratio);

  return (
    <>
      <p
        className={`text-[11px] font-semibold ${color} ${isPerfect ? "cursor-help" : ""}`}
        onMouseEnter={isPerfect ? (e) => setAnchor(e.currentTarget) : undefined}
        onMouseLeave={isPerfect ? () => setAnchor(null) : undefined}
      >
        {isPerfect ? "Perfect" : typeof ratio === "number" ? ratio.toFixed(2) : "0"}
      </p>
      {isPerfect && anchor && (
        <Tooltip anchorEl={anchor}>
          <div className="tip-dark bg-[#0a0e14] border border-edge rounded-lg px-3 py-2 shadow-2xl shadow-black/90 whitespace-nowrap text-center">
            <p className="text-xs text-yellow-400 font-bold">Perfect KDA</p>
            <p className="text-[11px] text-gray-400">0 ölüm — mükemmel performans</p>
          </div>
        </Tooltip>
      )}
    </>
  );
}

/* ===== Portal Tooltip ===== */
function Tooltip({ anchorEl, children }) {
  if (!anchorEl || typeof window === "undefined") return null;
  const rect = anchorEl.getBoundingClientRect();
  return ReactDOM.createPortal(
    <div
      className="fixed z-[9999] pointer-events-none"
      style={{
        top: `${rect.top - 8}px`,
        left: `${rect.left + rect.width / 2}px`,
        transform: "translate(-50%, -100%)",
      }}
    >
      {children}
    </div>,
    document.body
  );
}

/* ===== Mastery Badge + Tooltip ===== */
function MasteryBadge({ level, points, size = 28 }) {
  const [anchor, setAnchor] = useState(null);
  const url = getMasteryCrestUrl(level);
  if (!url) return null;

  return (
    <>
      <div
        className="absolute -top-2.5 -left-2.5"
        style={{ width: size }}
        onMouseEnter={(e) => setAnchor(e.currentTarget)}
        onMouseLeave={() => setAnchor(null)}
      >
        <img src={url} alt={`Mastery ${level}`} className="w-full h-auto drop-shadow-lg" />
      </div>
      {anchor && (
        <Tooltip anchorEl={anchor}>
          <div className="tip-dark bg-[#0a0e14] border border-edge rounded-lg px-3 py-2 shadow-2xl shadow-black/90 whitespace-nowrap">
            <div className="flex items-center gap-2 mb-1">
              <img src={url} alt="" width={40} height={40} />
              <p className="text-sm text-white font-bold">Mastery Level {level}</p>
            </div>
            {points > 0 && (
              <p className="text-xs text-gray-300">Points: {points.toLocaleString()}</p>
            )}
          </div>
        </Tooltip>
      )}
    </>
  );
}

// Gerçek şampiyon sırası (championRank) worker'dan gelirse Dünya + TR sırasını göster;
// gelmediyse test verisi yerine "yapım aşamasında" ipucu (bkz. PROFILE_RANKINGS_PLAN.md).
function ChampRank({ rank, region = "TR" }) {
  const [anchor, setAnchor] = useState(null);
  const fmt = (n) => n.toLocaleString("tr-TR");

  if (rank?.global != null) {
    return (
      <div className="mt-1 leading-tight">
        <p className="text-[10px] text-gray-400">
          Sıra: <span className="text-gray-200 font-semibold">{fmt(rank.global)}</span>
        </p>
        <p className="text-[10px] text-gray-500">({region}: {fmt(rank.tr)})</p>
      </div>
    );
  }

  return (
    <div className="mt-1 leading-tight">
      <span
        className="inline-flex items-center gap-1 text-[10px] text-gray-500 cursor-help"
        onMouseEnter={(e) => setAnchor(e.currentTarget)}
        onMouseLeave={() => setAnchor(null)}
      >
        Sıra: <span className="text-gray-400 font-medium">—</span>
        <HelpCircle size={10} className="text-gray-600" />
      </span>
      {anchor && (
        <Tooltip anchorEl={anchor}>
          <div className="tip-dark bg-[#0a0e14] border border-edge rounded-lg px-3 py-2 shadow-2xl shadow-black/90 max-w-[200px]">
            <p className="text-[11px] text-gray-300 leading-relaxed">
              Dünya ve TR şampiyon sıralaması <b className="text-gray-100">yapım aşamasında</b> — yakında.
            </p>
          </div>
        </Tooltip>
      )}
    </div>
  );
}

export default function ChampionPool({ seasonChampions, masteries, gameName, tagLine, region = "TR" }) {
  const [view, setView] = useState("played");
  const [open, setOpen] = useState(false);
  const [gameType, setGameType] = useState("all");
  const [sortKey, setSortKey] = useState("games");
  const [sortAsc, setSortAsc] = useState(false);

  const currentLabel = VIEWS.find((v) => v.key === view)?.label;

  const rawList = Array.isArray(seasonChampions)
    ? seasonChampions
    : (seasonChampions?.[gameType] || seasonChampions?.all || []);

  const champList = [...rawList].sort((a, b) => {
    let va, vb;
    if (sortKey === "avgKda") {
      va = typeof a.avgKda?.ratio === "number" ? a.avgKda.ratio : 999;
      vb = typeof b.avgKda?.ratio === "number" ? b.avgKda.ratio : 999;
    } else {
      va = a[sortKey] ?? 0;
      vb = b[sortKey] ?? 0;
    }
    return sortAsc ? va - vb : vb - va;
  });

  function toggleSort(key) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  }

  return (
    <div className="glass rounded-xl overflow-hidden">
      {/* Başlık + Filtreler */}
      <div className="px-4 py-3 border-b border-edge/50 flex items-center justify-between">
        <div className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-200 hover:text-gray-100 transition-colors cursor-pointer"
          >
            {currentLabel}
            <ChevronDown size={14} className={`text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>

          {open && (
            <div className="absolute top-full left-0 mt-1 w-44 bg-edge border border-[#2a3441] rounded-lg shadow-xl z-20 overflow-hidden">
              {VIEWS.map((v) => (
                <button
                  key={v.key}
                  onClick={() => { setView(v.key); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors cursor-pointer ${
                    view === v.key ? "bg-blue-500/15 text-blue-400" : "text-gray-400 hover:bg-hover hover:text-gray-200"
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Filtre — En Çok Oynanan görünümünde */}
        {view === "played" && (
          <QueueTabs value={gameType} onChange={setGameType} options={GAME_TYPES} />
        )}
      </div>

      {/* İçerik */}
      {view === "played" ? (
        <ChampionList champions={champList} sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} region={region} championsLink={gameName && tagLine ? `/summoner/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}/champions` : null} />
      ) : (
        <ChampionList champions={masteriesToChampList(masteries, seasonChampions)} sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} isMastery championsLink={gameName && tagLine ? `/summoner/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}/champions` : null} />
      )}
    </div>
  );
}

/* Mastery verisini aynı formata çevir — sezon verisiyle merge et */
function masteriesToChampList(masteries, seasonChampions) {
  if (!masteries) return [];

  // seasonChampions.all'dan lookup oluştur
  const seasonMap = {};
  const allChamps = Array.isArray(seasonChampions) ? seasonChampions : (seasonChampions?.all || []);
  allChamps.forEach((c) => {
    // Normalize: hem DDragon name hem match API name eşleşsin
    seasonMap[c.championName] = c;
    seasonMap[c.championName.replace(/[^a-zA-Z]/g, "")] = c;
  });

  return masteries.map((m) => {
    const key = m.championName.replace(/[^a-zA-Z]/g, "");
    const season = seasonMap[m.championName] || seasonMap[key];
    return {
      championName: m.championName,
      championImage: m.championImage,
      masteryLevel: m.championLevel,
      masteryPoints: m.championPoints,
      games: season?.games || 0,
      wins: season?.wins || 0,
      losses: season?.losses || 0,
      winRate: season?.winRate || 0,
      avgKda: season?.avgKda || { kills: 0, deaths: 0, assists: 0, ratio: 0 },
      _isMasteryOnly: !season,
    };
  });
}

/* ===== ORTAK LİSTE ===== */
function ChampionList({ champions, sortKey, sortAsc, onSort, isMastery, championsLink, region = "TR" }) {
  if (!champions || champions.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-sm text-gray-500">Veri bulunamadı</p>
      </div>
    );
  }

  const SortBtn = ({ label, field, width, align }) => {
    const active = sortKey === field;
    return (
      <button
        onClick={(e) => { e.preventDefault(); onSort(field); }}
        className={`${width} text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors ${
          align === "right" ? "justify-end" : align === "center" ? "justify-center" : ""
        } ${active ? "text-blue-400" : "text-gray-400 hover:text-gray-200"}`}
      >
        {label}
        <ArrowDownUp size={10} className={active ? "text-blue-400" : "text-gray-600"} />
        {active && <span className="text-[8px]">{sortAsc ? "▲" : "▼"}</span>}
      </button>
    );
  };

  return (
    <>
      {/* Kolon başlıkları */}
      <div className="flex items-center px-4 pt-3 pb-2 gap-2">
        <span className="w-[40px]" />
        <span className="flex-1 text-[11px] text-gray-400 font-medium">Şampiyon</span>
        <SortBtn label="Oyun" field="games" width="w-12" align="center" />
        <SortBtn label="KDA" field="avgKda" width="w-[72px]" align="center" />
        <SortBtn label="WR" field="winRate" width="w-14" align="right" />
      </div>

      <div className="divide-y divide-edge/20">
        {champions.slice(0, 8).map((c, i) => {
          const kdaRatio = c.avgKda?.ratio ?? 0;
          const noGames = !c.games || c.games === 0;

          return (
            <Link
              key={c.championName + i}
              href={`/champions/${c.championName.replace(/[^a-zA-Z]/g, "") || c.championName}`}
              className="flex items-center gap-2 px-4 py-2.5 hover:bg-hover transition-colors group"
            >
              <span className="text-xs text-gray-500 font-mono w-5 text-right">{i + 1}</span>

              {/* Şampiyon resmi + mastery badge */}
              <div className="relative flex-shrink-0 w-[52px]">
                <img src={c.championImage} alt={c.championName} width={48} height={48} className="rounded-lg" />
                <MasteryBadge level={c.masteryLevel} points={c.masteryPoints} size={34} />
              </div>

              {/* İsim */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-100 font-medium group-hover:text-gray-100 transition-colors truncate">
                  {c.championName}
                </p>
                {isMastery ? (
                  <p className="text-[10px] text-gray-500">{formatPoints(c.masteryPoints)} puan</p>
                ) : (
                  !noGames && <ChampRank rank={c.championRank} region={region} />
                )}
              </div>

              {/* Oyun */}
              <span className={`w-12 text-center text-sm font-bold ${noGames ? "text-gray-600" : "text-gray-100"}`}>
                {noGames ? "—" : c.games}
              </span>

              {/* KDA */}
              <div className="w-[72px] text-center">
                {noGames ? (
                  <p className="text-xs text-gray-600">—</p>
                ) : (
                  <>
                    <p className="text-xs text-gray-300">
                      {c.avgKda.kills}/{c.avgKda.deaths}/{c.avgKda.assists}
                    </p>
                    <KdaValue ratio={kdaRatio} />
                  </>
                )}
              </div>

              {/* WR */}
              <div className="w-14 text-right">
                {noGames ? (
                  <span className="text-xs text-gray-600">—</span>
                ) : (
                  <>
                    <span className={`text-xs font-bold font-mono ${getWrColor(c.winRate)}`}>
                      {c.winRate}%
                    </span>
                    <div className="mt-1 h-2 bg-edge rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${getWrBar(c.winRate)}`}
                        style={{ width: `${c.winRate}%` }}
                      />
                    </div>
                  </>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {champions.length > 8 && championsLink && (
        <div className="px-4 py-2 text-center border-t border-edge/20">
          <Link
            href={championsLink}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            +{champions.length - 8} şampiyon daha — Tümünü Gör
          </Link>
        </div>
      )}
    </>
  );
}

