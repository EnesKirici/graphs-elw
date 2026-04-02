"use client";

import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import ReactDOM from "react-dom";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function formatDuration(s) {
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function formatGold(g) {
  if (g >= 1000) return (g / 1000).toFixed(1) + "K";
  return g.toString();
}

function getKdaColor(kda) {
  if (kda === "Perfect" || kda >= 5) return "text-yellow-400";
  if (kda >= 3) return "text-emerald-400";
  if (kda >= 2) return "text-blue-400";
  return "text-gray-400";
}

function rankBadgeUrl(tier) {
  if (!tier) return null;
  return `/ranks/badges/${tier.toLowerCase()}.png`;
}

function formatRankText(tier, division) {
  if (!tier) return null;
  const name = tier.charAt(0) + tier.slice(1).toLowerCase();
  const masters = ["MASTER", "GRANDMASTER", "CHALLENGER"];
  if (masters.includes(tier)) return name;
  return `${name} ${division || ""}`.trim();
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

/* ===== Eşya tooltip — detaylı (stats + passives) ===== */
function ItemIcon({ item, size = 28 }) {
  const [anchor, setAnchor] = useState(null);
  if (!item) return <div style={{ width: size, height: size }} className="rounded bg-[#1b2230]" />;

  return (
    <>
      <img
        src={item.image} alt={item.name} width={size} height={size}
        className="rounded cursor-pointer"
        onMouseEnter={(e) => setAnchor(e.currentTarget)}
        onMouseLeave={() => setAnchor(null)}
      />
      {anchor && (
        <Tooltip anchorEl={anchor}>
          <div className="bg-[#0a0e14] border border-[#1b2230] rounded-lg p-3 shadow-2xl shadow-black/90 w-60">
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-sm font-bold text-white">{item.name}</p>
              {item.gold > 0 && <span className="text-[11px] text-yellow-500 font-mono whitespace-nowrap">{item.gold}g</span>}
            </div>
            {item.desc?.stats?.length > 0 && (
              <div className="mb-2">
                {item.desc.stats.map((s, j) => (
                  <p key={j} className="text-[11px] text-blue-300">{s}</p>
                ))}
              </div>
            )}
            {item.desc?.passives?.length > 0 && (
              <div className="space-y-1.5 border-t border-[#1b2230] pt-2">
                {item.desc.passives.map((p, j) => (
                  <div key={j}>
                    <p className="text-[11px] font-semibold text-yellow-400">{p.name}</p>
                    <p className="text-[10px] text-gray-400 leading-relaxed">{p.desc}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Tooltip>
      )}
    </>
  );
}

/* ===== Rün tooltip — detaylı (tüm perks) ===== */
function RuneIcon({ runes, size = 20 }) {
  const [anchor, setAnchor] = useState(null);
  if (!runes?.keystone?.icon) return null;

  return (
    <>
      <div
        className="cursor-pointer"
        onMouseEnter={(e) => setAnchor(e.currentTarget)}
        onMouseLeave={() => setAnchor(null)}
      >
        <div className="flex flex-col items-center gap-0.5">
          <img src={runes.keystone.icon} alt="" width={size} height={size} className="rounded-full" />
          {runes.subTree?.icon && (
            <img src={runes.subTree.icon} alt="" width={size - 4} height={size - 4} className="rounded-full opacity-70" />
          )}
        </div>
      </div>
      {anchor && (
        <Tooltip anchorEl={anchor}>
          <div className="bg-[#0a0e14] border border-[#1b2230] rounded-lg p-4 shadow-2xl shadow-black/90 w-72">
            <div className="grid grid-cols-2 gap-5">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  {runes.primaryTree?.icon && <img src={runes.primaryTree.icon} alt="" width={18} height={18} />}
                  <span className="text-[11px] font-medium text-gray-300">{runes.primaryTree?.name}</span>
                </div>
                <div className="space-y-2">
                  {runes.primaryPerks?.map((pk, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <img src={pk.icon} alt="" width={i === 0 ? 22 : 18} height={i === 0 ? 22 : 18}
                        className={`rounded-full ${i === 0 ? "ring-1 ring-yellow-500/60" : "opacity-80"}`} />
                      <span className={`text-[10px] ${i === 0 ? "text-yellow-400 font-semibold" : "text-gray-400"}`}>{pk.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-3">
                  {runes.subTree?.icon && <img src={runes.subTree.icon} alt="" width={18} height={18} />}
                  <span className="text-[11px] font-medium text-gray-300">{runes.subTree?.name}</span>
                </div>
                <div className="space-y-2">
                  {runes.secondaryPerks?.map((pk, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <img src={pk.icon} alt="" width={18} height={18} className="rounded-full opacity-80" />
                      <span className="text-[10px] text-gray-400">{pk.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {runes.statShards?.length > 0 && (
              <div className="mt-3 pt-2 border-t border-[#1b2230]">
                <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                  {runes.statShards.map((s, i) => (
                    <span key={i} className="text-[10px] text-gray-500">{s}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Tooltip>
      )}
    </>
  );
}

/* ===== Spell tooltip ===== */
function SpellIcon({ spell, size = 16 }) {
  const [anchor, setAnchor] = useState(null);
  if (!spell?.image) return null;
  return (
    <>
      <img
        src={spell.image} alt="" width={size} height={size}
        className="rounded-sm cursor-pointer"
        onMouseEnter={(e) => setAnchor(e.currentTarget)}
        onMouseLeave={() => setAnchor(null)}
      />
      {anchor && (
        <Tooltip anchorEl={anchor}>
          <div className="bg-[#0a0e14] border border-[#2a3441] rounded-lg px-2.5 py-1.5 shadow-2xl shadow-black/90">
            <p className="text-xs text-white font-medium">{spell.name}</p>
          </div>
        </Tooltip>
      )}
    </>
  );
}

/* ===== ANA BİLEŞEN ===== */
export default function MatchDetail({ matchId, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/matches/${matchId}`);
        const json = await res.json();
        setData(json);
      } catch {
        setData(null);
      }
      setLoading(false);
    }
    load();
  }, [matchId]);

  if (loading) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-500">Maç detayları yükleniyor...</p>
      </div>
    );
  }

  if (!data || data.error) {
    return (
      <div className="glass rounded-xl p-6 text-center">
        <p className="text-sm text-red-400 mb-3">Maç detayı yüklenemedi</p>
        <button onClick={onBack} className="text-sm text-blue-400 hover:underline cursor-pointer">← Geri Dön</button>
      </div>
    );
  }

  const team1 = data.teams[0];
  const team2 = data.teams[1];
  const allPlayers = [...(team1?.players || []), ...(team2?.players || [])];
  const maxDmg = Math.max(...allPlayers.map((p) => p.damage), 1);
  const maxTaken = Math.max(...allPlayers.map((p) => p.damageTaken), 1);
  const totalKills = (team1?.info?.totalKills || 0) + (team2?.info?.totalKills || 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 flex items-center justify-between border-b border-[#1b2230]/50">
          <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors cursor-pointer">
            <ArrowLeft size={16} />
            <span>Geri Dön</span>
          </button>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">{data.queueType}</span>
            <span className="text-sm text-gray-500">{formatDuration(data.duration)}</span>
          </div>
        </div>

        <div className="px-5 py-3">
          <div className="flex items-center gap-4">
            <span className={`text-sm font-bold ${team1?.info?.win ? "text-emerald-400" : "text-red-400"}`}>
              {team1?.info?.win ? "Zafer" : "Yenilgi"}
            </span>
            <div className="flex-1 h-2 rounded-full overflow-hidden flex">
              <div className="h-full bg-blue-500" style={{ width: `${(team1?.info?.totalKills || 0) / Math.max(totalKills, 1) * 100}%` }} />
              <div className="h-full bg-red-500" style={{ width: `${(team2?.info?.totalKills || 0) / Math.max(totalKills, 1) * 100}%` }} />
            </div>
            <span className={`text-sm font-bold ${team2?.info?.win ? "text-emerald-400" : "text-red-400"}`}>
              {team2?.info?.win ? "Zafer" : "Yenilgi"}
            </span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <div>
              <span className="text-sm text-blue-400 font-bold">{team1?.info?.totalKills} Kill</span>
              <span className="text-xs text-gray-600 ml-2">{formatGold(team1?.info?.totalGold || 0)} gold</span>
            </div>
            <div>
              <span className="text-xs text-gray-600 mr-2">{formatGold(team2?.info?.totalGold || 0)} gold</span>
              <span className="text-sm text-red-400 font-bold">{team2?.info?.totalKills} Kill</span>
            </div>
          </div>
        </div>
      </div>

      {/* Takımlar */}
      <TeamTable team={team1} color="blue" maxDmg={maxDmg} maxTaken={maxTaken} />
      <TeamTable team={team2} color="red" maxDmg={maxDmg} maxTaken={maxTaken} />
    </div>
  );
}

/* ===== TAKIM TABLOSU ===== */
function TeamTable({ team, color, maxDmg, maxTaken }) {
  if (!team) return null;

  const isWin = team.info?.win;
  const borderColor = isWin ? "border-l-emerald-500" : "border-l-red-500";
  const headerBg = color === "blue" ? "bg-blue-500/5" : "bg-red-500/5";
  const label = isWin
    ? `Zafer (${color === "blue" ? "Mavi" : "Kırmızı"} Takım)`
    : `Yenilgi (${color === "blue" ? "Mavi" : "Kırmızı"} Takım)`;

  return (
    <div className={`glass rounded-xl border-l-2 ${borderColor} overflow-x-auto`}>
      <div className={`px-5 py-3 ${headerBg} border-b border-[#1b2230]/50 flex items-center justify-between`}>
        <span className={`text-sm font-bold ${isWin ? "text-emerald-400" : "text-red-400"}`}>{label}</span>
        <span className="text-xs text-gray-500">{formatGold(team.info?.totalGold || 0)} gold</span>
      </div>

      <div className="min-w-[820px]">
        {/* Kolon başlıkları */}
        <div className="flex items-center gap-3 px-5 py-2 text-[11px] text-gray-500 font-medium border-b border-[#1b2230]/30">
          <span className="w-[260px]">Şampiyon</span>
          <span className="w-[100px] text-center">KDA</span>
          <span className="w-[90px] text-center">Hasar</span>
          <span className="w-[90px] text-center">Alınan</span>
          <span className="w-[50px] text-center">CS</span>
          <span className="w-[55px] text-center">Gözcü</span>
          <span className="flex-1 text-center">Eşyalar</span>
        </div>

        <div className="divide-y divide-[#1b2230]/20">
          {team.players.map((p) => (
            <PlayerRow key={p.puuid} player={p} maxDmg={maxDmg} maxTaken={maxTaken} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ===== OYUNCU SATIRI ===== */
function PlayerRow({ player: p, maxDmg, maxTaken }) {
  const dmgPct = (p.damage / maxDmg) * 100;
  const takenPct = (p.damageTaken / maxTaken) * 100;
  const rankText = formatRankText(p.tier, p.rankDivision);

  return (
    <div className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.03] transition-colors">

      {/* ===== Şampiyon bölümü ===== */}
      <div className="flex items-center gap-2.5 w-[260px] flex-shrink-0">
        {/* Rank badge */}
        <div className="flex flex-col items-center flex-shrink-0 w-12">
          {p.tier ? (
            <>
              <img src={rankBadgeUrl(p.tier)} alt="" width={28} height={28} />
              <span className="text-[9px] text-gray-400 leading-none mt-0.5 whitespace-nowrap">{rankText}</span>
            </>
          ) : (
            <span className="text-[9px] text-gray-500 italic">Unranked</span>
          )}
        </div>

        {/* Şampiyon ikonu + altında spell'ler */}
        <div className="flex flex-col items-center flex-shrink-0 gap-0.5">
          <div className="relative">
            <img src={p.champion.image} alt="" width={40} height={40} className="rounded-lg" />
            <span className="absolute -bottom-0.5 -right-0.5 bg-[#0d1117] text-[9px] text-gray-300 font-bold px-1 rounded">
              {p.champLevel}
            </span>
          </div>
          <div className="flex gap-0.5">
            <SpellIcon spell={p.spells[0]} size={16} />
            <SpellIcon spell={p.spells[1]} size={16} />
          </div>
        </div>

        {/* Rünler */}
        <RuneIcon runes={p.runes} size={20} />

        {/* İsim */}
        <div className="min-w-0">
          <p className="text-sm text-gray-100 font-medium truncate">{p.summonerName}</p>
        </div>
      </div>

      {/* ===== KDA ===== */}
      <div className="w-[100px] text-center flex-shrink-0">
        <p className="text-sm text-gray-100">
          {p.kills}/<span className="text-red-400">{p.deaths}</span>/{p.assists}
          <span className="text-gray-400 text-xs ml-1">({p.killParticipation}%)</span>
        </p>
        <p className={`text-xs font-bold ${getKdaColor(p.kda)}`}>
          {p.kda === "Perfect" ? "Perfect" : `${p.kda.toFixed(2)}:1`}
        </p>
      </div>

      {/* ===== Hasar ===== */}
      <div className="w-[90px] flex-shrink-0">
        <p className="text-xs text-gray-200 text-center font-medium">{p.damage.toLocaleString()}</p>
        <div className="h-1.5 bg-[#1b2230] rounded-full overflow-hidden mt-1">
          <div className="h-full bg-red-500 rounded-full" style={{ width: `${dmgPct}%` }} />
        </div>
      </div>

      {/* ===== Alınan Hasar ===== */}
      <div className="w-[90px] flex-shrink-0">
        <p className="text-xs text-gray-200 text-center font-medium">{p.damageTaken.toLocaleString()}</p>
        <div className="h-1.5 bg-[#1b2230] rounded-full overflow-hidden mt-1">
          <div className="h-full bg-gray-500 rounded-full" style={{ width: `${takenPct}%` }} />
        </div>
      </div>

      {/* ===== CS ===== */}
      <div className="w-[50px] text-center flex-shrink-0">
        <p className="text-sm text-gray-200 font-medium">{p.cs}</p>
        <p className="text-[10px] text-gray-500">{p.csPerMin}/d</p>
      </div>

      {/* ===== Gözcü ===== */}
      <div className="w-[55px] text-center flex-shrink-0">
        <p className="text-sm text-gray-200 font-medium">{p.visionScore}</p>
        <p className="text-[10px] text-gray-500">{p.wardsPlaced}/{p.wardsKilled}</p>
      </div>

      {/* ===== Eşyalar ===== */}
      <div className="flex items-center gap-0.5 flex-1 justify-end">
        {p.items.map((item, i) => (
          <ItemIcon key={i} item={item} size={28} />
        ))}
      </div>
    </div>
  );
}
