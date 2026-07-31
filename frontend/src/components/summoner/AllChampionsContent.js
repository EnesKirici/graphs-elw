"use client";

import { useState } from "react";

/* 2026-07-31 yeniden yazıldı — ham Tailwind flex-tablo yerine site geneliyle
   (tier-list/leaderboard) AYNI dil: .cp-panel (tek glass panel), .tl-view
   (oyun tipi, ayrı kopya yok), .cp-grid (CSS grid tablo). Kullanıcı: "burası
   kötü, aynı diğer sayfa standartlarında olacak."

   WR renk eşiği — SİTENİN PROFİL KONVANSİYONU (Last30Panel/ChampPerfListPro/
   leaderboard ile birebir aynı: cyan≥60/mavi≥50/mor≥44/kırmızı<44). Eskiden bu
   dosyada ayrı bir eşik (emerald/yellow, 51/45) vardı — birleştirildi. */
function wrTone(wr) {
  if (wr >= 60) return "#22d3ee";
  if (wr >= 50) return "#60a5fa";
  if (wr >= 44) return "#c084fc";
  return "#f87171";
}

function kdaTone(ratio) {
  if (ratio === "Perfect" || ratio >= 4) return "#22d3ee";
  if (ratio >= 2.5) return "#60a5fa";
  if (ratio >= 1.8) return "#c9d1de";
  return "#f87171";
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

const MULTI_KILL_SLOTS = [
  { key: "doubleKills", label: "D" },
  { key: "tripleKills", label: "T" },
  { key: "quadraKills", label: "Q" },
  { key: "pentaKills", label: "P" },
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

  const totalGames = rawList.reduce((sum, c) => sum + (c.games || 0), 0);
  const totalWins = rawList.reduce((sum, c) => sum + (c.wins || 0), 0);
  const overallWr = totalGames > 0 ? Math.round(totalWins / totalGames * 100) : 0;
  const totalPenta = rawList.reduce((sum, c) => sum + (c.pentaKills || 0), 0);
  const totalQuadra = rawList.reduce((sum, c) => sum + (c.quadraKills || 0), 0);

  return (
    <div>
      <div className="cp-summary">
        <div className="cp-tile"><b>{totalGames}</b><span>Toplam Maç</span></div>
        <div className="cp-tile"><b style={{ color: wrTone(overallWr) }}>%{overallWr}</b><span>Kazanma Oranı</span></div>
        <div className="cp-tile"><b>{rawList.length}</b><span>Şampiyon Sayısı</span></div>
        <div className="cp-tile">
          <b style={{ color: totalPenta > 0 ? "#e6b968" : totalQuadra > 0 ? "#b79df5" : "#dfe4ee" }}>
            {totalPenta > 0 ? `${totalPenta} Penta` : totalQuadra > 0 ? `${totalQuadra} Quadra` : "—"}
          </b>
          <span>Multi Kill</span>
        </div>
      </div>

      <div className="cp-panel glass">
        <div className="cp-toolbar">
          <div className="tl-view" role="group" aria-label="Oyun tipi">
            {GAME_TYPES.map((g) => (
              <button key={g.key} type="button" data-on={gameType === g.key ? "1" : "0"} onClick={() => setGameType(g.key)}>
                {g.label}
              </button>
            ))}
          </div>
          <div className="cp-sort" role="group" aria-label="Sıralama">
            {SORT_OPTIONS.map((s) => (
              <button key={s.key} type="button" data-on={sortKey === s.key ? "1" : "0"} onClick={() => toggleSort(s.key)}>
                {s.label}
                {sortKey === s.key && <i>{sortAsc ? "▲" : "▼"}</i>}
              </button>
            ))}
          </div>
        </div>

        {champions.length > 0 && (
          <div className="cp-thead">
            <span />
            <span>Şampiyon</span>
            <span style={{ textAlign: "center" }}>Oyun</span>
            <span className="cp-col-wl" style={{ textAlign: "center" }}>W/L</span>
            <span style={{ textAlign: "center" }}>WR</span>
            <span className="cp-col-kda" style={{ textAlign: "center" }}>KDA</span>
            <span className="cp-col-cs" style={{ textAlign: "center" }}>CS/dk</span>
            <span className="cp-col-gold" style={{ textAlign: "center" }}>Gold/dk</span>
            <span className="cp-col-dur" style={{ textAlign: "center" }}>Süre</span>
            <span className="cp-col-mk" style={{ textAlign: "center" }}>Multi Kill</span>
          </div>
        )}

        {champions.length === 0 ? (
          <div className="cp-empty">Bu sezon henüz maç verisi bulunamadı</div>
        ) : (
          champions.map((c, i) => <ChampionRow key={c.championName + i} champ={c} index={i} region={region} />)
        )}

        <div className="cp-foot">
          <span>Toplam {champions.length} şampiyon · {totalGames} maç</span>
          <span>Bu sezon · {gameType === "all" ? "Tümü" : gameType === "ranked" ? "Dereceli" : "Normal"}</span>
        </div>
      </div>
    </div>
  );
}

/* Şampiyon isminin altında "TR Sırası" için HER ZAMAN yer ayrılır (championRank
   backend'den henüz gelmiyor — bkz. PROFILE_RANKINGS_PLAN.md — gelene kadar
   tire gösterilir ki veri bağlanınca satır yüksekliği SIÇRAMASIN). */
function ChampionRow({ champ: c, index, region }) {
  const kdaRatio = c.avgKda?.ratio ?? 0;
  const noGames = !c.games || c.games === 0;
  const rankPos = c.championRank?.position > 0 ? c.championRank.position : null;

  return (
    <div className="cp-row cp-grid">
      <span className="cp-rank">{index + 1}</span>

      <div className="cp-champ">
        <img src={c.championImage} alt={c.championName} />
        <div className="cp-champ-id">
          <p className="cp-champ-name">{c.championName}</p>
          <span className="cp-champ-rank">
            {region} Sırası {rankPos ? <b>#{rankPos.toLocaleString("tr-TR")}</b> : "—"}
          </span>
        </div>
      </div>

      <span className={`cp-games ${noGames ? "empty" : ""}`}>{noGames ? "—" : c.games}</span>

      <div className="cp-wl cp-col-wl">
        {noGames ? "—" : (
          <><b className="w">{c.wins}</b><span style={{ color: "#4d5461" }}> / </span><b className="l">{c.losses}</b></>
        )}
      </div>

      <div className="cp-wr-cell">
        {noGames ? (
          <span className="cp-wr" style={{ color: "#545b68" }}>—</span>
        ) : (
          <>
            <span className="cp-wr" style={{ color: wrTone(c.winRate) }}>%{c.winRate}</span>
            <div className="cp-wr-bar"><i style={{ width: `${c.winRate}%`, color: wrTone(c.winRate) }} /></div>
          </>
        )}
      </div>

      <div className="cp-kda cp-col-kda">
        {noGames ? "—" : (
          <>
            <p><span className="k">{c.avgKda.kills}</span> / <span className="d">{c.avgKda.deaths}</span> / <span className="a">{c.avgKda.assists}</span></p>
            <p className="cp-kda-ratio" style={{ color: kdaTone(kdaRatio) }}>
              {kdaRatio === "Perfect" ? "Perfect" : typeof kdaRatio === "number" ? kdaRatio.toFixed(2) : "0"}
            </p>
          </>
        )}
      </div>

      <span className="cp-num cp-col-cs">{noGames ? "—" : (c.csPerMin ?? 0).toFixed(1)}</span>
      <span className="cp-num gold cp-col-gold">{noGames ? "—" : (c.goldPerMin ?? 0)}</span>
      <span className="cp-num cp-col-dur">{noGames ? "—" : `${c.avgDuration ?? 0}dk`}</span>

      <div className="cp-mk cp-col-mk">
        {MULTI_KILL_SLOTS.map((slot) => {
          const count = c[slot.key] || 0;
          return count > 0 ? (
            <span key={slot.key} className="cp-mk-slot">{slot.label}×{count}</span>
          ) : (
            <span key={slot.key} className="cp-mk-slot empty">·</span>
          );
        })}
      </div>
    </div>
  );
}
