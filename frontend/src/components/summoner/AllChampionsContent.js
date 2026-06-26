"use client";

import { useState } from "react";
import { ArrowDownUp } from "lucide-react";
import Card from "@/components/ui/Card";

/* ===== Yardımcı fonksiyonlar ===== */
function getWrColor(wr) {
    if (wr >= 60) return "text-cyan-400";
    if (wr >= 50) return "text-blue-400";
    if (wr >= 45) return "text-gray-300";
    return "text-red-400";
}

function getKdaColor(ratio) {
    if (ratio === "Perfect" || ratio >= 4) return "text-cyan-400";
    if (ratio >= 2.5) return "text-blue-400";
    if (ratio >= 1.8) return "text-gray-300";
    return "text-red-400";
}

const GAME_TYPES = [
    { key: "all", label: "Tümü" },
    { key: "ranked", label: "Dereceli" },
    { key: "normal", label: "Normal" },
];

const SORT_OPTIONS = [
    { key: "games", label: "Oyun" },
    { key: "winRate", label: "WR" },
    { key: "avgKda", label: "KDA" },
    { key: "csPerMin", label: "CS/dk" },
    { key: "goldPerMin", label: "Gold/dk" },
];

export default function AllChampionsContent({ seasonChampions, region = "TR" }) {
    const [gameType, setGameType] = useState("all");
    const [sortKey, setSortKey] = useState("games");
    const [sortAsc, setSortAsc] = useState(false);

    const rawList = Array.isArray(seasonChampions)
        ? seasonChampions
        : (seasonChampions?.[gameType] || seasonChampions?.all || []);

    const champions = [...rawList].sort((a, b) => {
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

    // Toplam istatistikler
    const totalGames = rawList.reduce((sum, c) => sum + (c.games || 0), 0);
    const totalWins = rawList.reduce((sum, c) => sum + (c.wins || 0), 0);
    const overallWr = totalGames > 0 ? Math.round(totalWins / totalGames * 100) : 0;
    const totalPenta = rawList.reduce((sum, c) => sum + (c.pentaKills || 0), 0);
    const totalQuadra = rawList.reduce((sum, c) => sum + (c.quadraKills || 0), 0);

    return (
        <div className="space-y-5">
            {/* Özet kartları */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <SummaryCard label="Toplam Maç" value={totalGames} />
                <SummaryCard
                    label="Kazanma Oranı"
                    value={`${overallWr}%`}
                    valueColor={overallWr >= 51 ? "text-emerald-400" : overallWr >= 45 ? "text-yellow-400" : "text-red-400"}
                />
                <SummaryCard label="Şampiyon Sayısı" value={rawList.length} />
                <SummaryCard
                    label="Multi Kill"
                    value={totalPenta > 0 ? `${totalPenta} Penta` : totalQuadra > 0 ? `${totalQuadra} Quadra` : "—"}
                    valueColor={totalPenta > 0 ? "text-yellow-400" : totalQuadra > 0 ? "text-purple-400" : "text-gray-500"}
                />
            </div>

            {/* Filtre + Sıralama */}
            <Card className="overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-edge/50">
                    <div className="flex items-center gap-1">
                        {GAME_TYPES.map((g) => (
                            <button
                                key={g.key}
                                onClick={() => setGameType(g.key)}
                                className={`text-[11px] px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                                    gameType === g.key ? "bg-blue-500/15 text-blue-400" : "text-gray-500 hover:text-gray-300 hover:bg-hover"
                                }`}
                            >
                                {g.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-1">
                        {SORT_OPTIONS.map((s) => (
                            <button
                                key={s.key}
                                onClick={() => toggleSort(s.key)}
                                className={`text-[10px] px-2 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                                    sortKey === s.key ? "bg-blue-500/15 text-blue-400" : "text-gray-500 hover:text-gray-300 hover:bg-hover"
                                }`}
                            >
                                {s.label}
                                {sortKey === s.key && (
                                    <span className="text-[8px]">{sortAsc ? "▲" : "▼"}</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tablo başlığı */}
                <div className="hidden md:flex items-center px-5 py-2.5 gap-3 border-b border-edge/20 bg-base/40">
                    <span className="w-6" />
                    <span className="w-12" />
                    <span className="flex-1 text-[11px] text-gray-500 font-medium">Şampiyon</span>
                    <span className="w-16 text-center text-[11px] text-gray-500 font-medium">Oyun</span>
                    <span className="w-20 text-center text-[11px] text-gray-500 font-medium">W/L</span>
                    <span className="w-24 text-center text-[11px] text-gray-500 font-medium">WR</span>
                    <span className="w-36 text-center text-[11px] text-gray-500 font-medium">KDA</span>
                    <span className="w-16 text-center text-[11px] text-gray-500 font-medium">CS/dk</span>
                    <span className="w-16 text-center text-[11px] text-gray-500 font-medium">Gold/dk</span>
                    <span className="w-16 text-center text-[11px] text-gray-500 font-medium">Süre</span>
                    <span className="w-52 text-center text-[11px] text-gray-500 font-medium">Multi Kill</span>
                </div>

                {/* Şampiyon listesi */}
                {champions.length === 0 ? (
                    <div className="px-5 py-12 text-center">
                        <p className="text-sm text-gray-500">Bu sezon henüz maç verisi bulunamadı</p>
                    </div>
                ) : (
                    <div className="divide-y divide-edge/15">
                        {champions.map((c, i) => (
                            <ChampionRow key={c.championName + i} champ={c} index={i} region={region} />
                        ))}
                    </div>
                )}

                {/* Alt bilgi */}
                <div className="px-5 py-3 border-t border-edge/30 flex items-center justify-between">
                    <span className="text-[11px] text-gray-500">
                        Toplam {champions.length} şampiyon · {totalGames} maç
                    </span>
                    <span className="text-[10px] text-gray-600">
                        Bu sezon · {gameType === "all" ? "Tümü" : gameType === "ranked" ? "Dereceli" : "Normal"}
                    </span>
                </div>
            </Card>
        </div>
    );
}

/* ===== Özet kartı ===== */
function SummaryCard({ label, value, valueColor = "text-gray-100" }) {
    return (
        <div className="glass rounded-xl p-4 text-center">
            <p className={`text-xl font-bold ${valueColor}`}>{value}</p>
            <p className="text-[11px] text-gray-500 mt-1">{label}</p>
        </div>
    );
}

/* ===== Multi kill sabit slotları =====
   Her tip kendi mini kolonunda → satırlar arası hizalı, hiçbiri gizlenmez.
   Soldan sağa yükselen nadirlik: D → T → Q → P (penta en sağda parlar). */
const MULTI_KILL_SLOTS = [
    { key: "doubleKills", label: "D", color: "text-gray-300 bg-gray-500/15" },
    { key: "tripleKills", label: "T", color: "text-blue-400 bg-blue-500/15" },
    { key: "quadraKills", label: "Q", color: "text-purple-400 bg-purple-500/15" },
    { key: "pentaKills", label: "P", color: "text-yellow-400 bg-yellow-500/15" },
];

/* ===== Tek şampiyon satırı ===== */
function ChampionRow({ champ: c, index, region }) {
    const kdaRatio = c.avgKda?.ratio ?? 0;
    const noGames = !c.games || c.games === 0;

    return (
        <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-hover transition-colors group">
            {/* Sıra */}
            <span className="text-xs text-gray-600 font-mono w-6 text-right flex-shrink-0">{index + 1}</span>

            {/* Şampiyon resmi */}
            <div className="flex-shrink-0 w-12 h-12">
                <img src={c.championImage} alt={c.championName} className="w-12 h-12 rounded-xl" />
            </div>

            {/* İsim + (varsa) bölgesel şampiyon sıralaması */}
            <div className="flex-1 min-w-0">
                <p className="text-[15px] text-gray-100 font-semibold group-hover:text-blue-400 transition-colors truncate">
                    {c.championName}
                </p>
                {/* Backend bu şampiyonda 10+ maçı olan oyuncular arasında sıra hesaplayıp
                    championRank: { position } gönderirse otomatik görünür (henüz gelmiyor). */}
                {c.championRank?.position > 0 && (
                    <p className="text-[10px] text-gray-500 mt-0.5">
                        {region} Sırası{" "}
                        <span className="text-gray-300 font-semibold">
                            #{c.championRank.position.toLocaleString("tr-TR")}
                        </span>
                    </p>
                )}
            </div>

            {/* Oyun sayısı */}
            <span className={`w-16 text-center text-[15px] font-bold ${noGames ? "text-gray-600" : "text-gray-100"}`}>
                {noGames ? "—" : c.games}
            </span>

            {/* W/L */}
            <div className="w-20 text-center">
                {noGames ? (
                    <span className="text-xs text-gray-600">—</span>
                ) : (
                    <span className="text-xs font-medium">
                        <span className="text-emerald-400">{c.wins}</span>
                        <span className="text-gray-600 mx-0.5">/</span>
                        <span className="text-red-400">{c.losses}</span>
                    </span>
                )}
            </div>

            {/* WR */}
            <div className="w-24">
                {noGames ? (
                    <span className="block text-center text-xs text-gray-600">—</span>
                ) : (
                    <div className="px-1.5">
                        <span className={`block text-center text-sm font-bold font-mono ${getWrColor(c.winRate)}`}>
                            {c.winRate}%
                        </span>
                        <div className="mt-1 h-1 bg-edge rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full ${c.winRate >= 50 ? "bg-emerald-500" : "bg-red-500"}`}
                                style={{ width: `${c.winRate}%` }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* KDA — kills yeşil, deaths kırmızı, assists sarı */}
            <div className="w-36 text-center">
                {noGames ? (
                    <span className="text-xs text-gray-600">—</span>
                ) : (
                    <>
                        <p className="text-xs">
                            <span className="text-emerald-400 font-medium">{c.avgKda.kills}</span>
                            <span className="text-gray-600"> / </span>
                            <span className="text-red-400 font-medium">{c.avgKda.deaths}</span>
                            <span className="text-gray-600"> / </span>
                            <span className="text-yellow-400 font-medium">{c.avgKda.assists}</span>
                        </p>
                        <p className={`text-[11px] font-semibold mt-0.5 ${getKdaColor(kdaRatio)}`}>
                            {kdaRatio === "Perfect" ? "Perfect" : typeof kdaRatio === "number" ? kdaRatio.toFixed(2) : "0"}
                        </p>
                    </>
                )}
            </div>

            {/* CS/dk */}
            <span className="hidden md:block w-16 text-center text-xs text-gray-300">
                {noGames ? "—" : (c.csPerMin ?? 0).toFixed(1)}
            </span>

            {/* Gold/dk */}
            <span className="hidden md:block w-16 text-center text-xs text-amber-400/80">
                {noGames ? "—" : (c.goldPerMin ?? 0)}
            </span>

            {/* Ort. Süre */}
            <span className="hidden md:block w-16 text-center text-xs text-gray-500">
                {noGames ? "—" : `${c.avgDuration ?? 0}dk`}
            </span>

            {/* Multi Kill — 4 sabit slot (D/T/Q/P), hepsi her zaman görünür */}
            <div className="hidden md:grid w-52 grid-cols-4 gap-1.5 flex-shrink-0 items-center">
                {MULTI_KILL_SLOTS.map((slot) => {
                    const count = c[slot.key] || 0;
                    return count > 0 ? (
                        <span
                            key={slot.key}
                            className={`text-[10px] font-bold px-1 py-1 rounded-md text-center ${slot.color}`}
                        >
                            {slot.label}×{count}
                        </span>
                    ) : (
                        <span key={slot.key} className="text-[10px] text-center text-gray-600/50 py-1">
                            ·
                        </span>
                    );
                })}
            </div>
        </div>
    );
}
