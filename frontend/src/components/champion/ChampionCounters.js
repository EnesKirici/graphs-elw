"use client";

import { useState } from "react";
import Link from "next/link";
import { champIcon } from "@/lib/buildData";
import { scoreColor } from "@/components/summoner/pro/scoreColor";

// WR% → renk (profil sayfasıyla AYNI gradyan: kırmızı→mor→mavi/cyan). 50% ≈ mor.
// scoreColor 0-10 alır; WR'yi ~42-58 bandını tüm spektruma yayacak şekilde eşliyoruz.
const wrColor = (wr) => scoreColor(5.5 + (wr - 50) * 0.5);

const ROLE_LABELS = { TOP: "Top", JUNGLE: "Jungle", MIDDLE: "Mid", BOTTOM: "ADC", UTILITY: "Support", SUPPORT: "Support" };
const ROLE_ICON = {
  TOP: "/roles/top.svg", JUNGLE: "/roles/jungle.svg", MIDDLE: "/roles/mid.svg",
  BOTTOM: "/roles/bot.svg", UTILITY: "/roles/support.svg", SUPPORT: "/roles/support.svg",
};
const hideOnError = (e) => { e.currentTarget.style.visibility = "hidden"; };

const SHOWN = 10;

/*
  Counter sayfası — GÖRSEL head-to-head (düz tablo değil). Her eşleşme için rakip
  portresi + kim-kime-karşı kazanma barı (şampiyon% | rakip%). counters = şampiyonu
  yenenler (WR düşük), strongInto = şampiyonun ezdiği (WR yüksek). İlk render (server)
  birincil rolü gösterir → SSR HTML'de gerçek içerik (crawlable).
*/
export default function ChampionCounters({ champName, champImage, counters, version }) {
  const positions = counters?.positions || [];
  const [role, setRole] = useState(counters?.primaryPosition || positions[0]?.position);
  const data = counters?.byPosition?.[role];

  if (!positions.length || !data) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <p className="text-sm text-gray-200 font-medium">Henüz yeterli matchup verisi yok</p>
        <p className="text-xs text-gray-500 mt-2 leading-relaxed max-w-md mx-auto">
          {champName} için karşı koridor eşleşmeleri (rakip başına en az 10 maç) birikince
          buradaki counter listeleri otomatik dolacak. <span className="text-gray-600">Düşük örneklem — veriler toplanma aşamasında.</span>
        </p>
      </div>
    );
  }

  const counterList = (data.counters || []).slice(0, SHOWN);
  const strongList = (data.strongInto || []).slice(0, SHOWN);

  return (
    <div className="space-y-4">
      {/* Rol filtresi */}
      {positions.length > 1 && (
        <div className="glass rounded-xl px-4 py-3 flex items-center gap-1.5 flex-wrap">
          {positions.map((p) => (
            <button
              key={p.position}
              onClick={() => setRole(p.position)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                role === p.position ? "bg-blue-500/15 text-blue-300" : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
              }`}
            >
              <img src={ROLE_ICON[p.position]} alt={ROLE_LABELS[p.position]} width={16} height={16} className={role === p.position ? "" : "opacity-70"} />
              {ROLE_LABELS[p.position] || p.position}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <MatchupColumn
          title={`${champName}'yı Zorlayan Şampiyonlar`}
          subtitle="Karşısında en düşük kazanma oranı — bu şampiyonlar avantajlı."
          rows={counterList}
          champName={champName}
          champImage={champImage}
          version={version}
          empty={`${champName} için zayıf eşleşme verisi henüz yok.`}
        />
        <MatchupColumn
          title={`${champName}'nın Güçlü Olduğu Eşleşmeler`}
          subtitle="Karşısında en yüksek kazanma oranı — bu şampiyonlara üstün."
          rows={strongList}
          champName={champName}
          champImage={champImage}
          version={version}
          empty={`${champName} için güçlü eşleşme verisi henüz yok.`}
        />
      </div>

      <p className="text-[11px] text-gray-500 leading-relaxed">
        Bar {champName}&apos;nın o rakibe karşı kazanma oranını gösterir (kalanı rakibin). Rakip başına en az 10 maç.
        Örneklem düşükse oranlar zamanla oturur. Emerald+ · Patch {(counters.patches || []).join(" + ")}.
      </p>
    </div>
  );
}

function MatchupColumn({ title, subtitle, rows, champName, champImage, version, empty }) {
  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-edge/50">
        <h3 className="text-sm font-semibold text-gray-100">{title}</h3>
        <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{subtitle}</p>
      </div>
      {rows.length ? (
        <div className="divide-y divide-edge/25">
          {rows.map((m, i) => (
            <MatchupRow key={m.id} m={m} rank={i + 1} champName={champName} champImage={champImage} version={version} />
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-gray-600 leading-relaxed px-5 py-6 text-center">{empty}</p>
      )}
    </div>
  );
}

/* Tek eşleşme — rakip portresi + kim-kime-karşı kazanma barı (head-to-head). */
function MatchupRow({ m, rank, champName, champImage, version }) {
  const champWr = m.winRate;                       // şampiyonun bu rakibe karşı WR'si
  const oppWr = Math.round((100 - champWr) * 10) / 10;
  const col = wrColor(champWr);                     // kırmızı→mor→mavi gradyan

  return (
    <Link
      href={`/champions/${m.id}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors group"
      title={`${champName} vs ${m.name} — ${m.games} maç`}
    >
      <span className="text-[11px] font-bold text-gray-600 w-4 text-center shrink-0">{rank}</span>
      <img
        src={champIcon(version, m.id)}
        alt={m.name}
        width={40}
        height={40}
        className="rounded-lg border border-edge shrink-0"
        onError={hideOnError}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-gray-100 truncate group-hover:text-white transition-colors">{m.name}</span>
          <span className="text-[10px] text-gray-500 shrink-0 tabular-nums">{m.games} maç</span>
        </div>
        {/* Head-to-head WR barı: şampiyon% (gradyan renk) | rakip% */}
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-xs font-bold tabular-nums w-9 shrink-0" style={{ color: col }}>{champWr}%</span>
          <div className="flex-1 h-1.5 rounded-full bg-edge/70 overflow-hidden">
            <div className="h-full" style={{ width: `${Math.max(2, Math.min(98, champWr))}%`, backgroundColor: col }} />
          </div>
          <span className="text-xs font-medium tabular-nums text-gray-500 w-9 text-right shrink-0">{oppWr}%</span>
        </div>

        {/* Head-to-head detay: bu eşleşmedeki KDA / KP / hasar (+ @15 koridor avantajı) */}
        {m.stats && (
          <div className="mt-1.5 flex items-center gap-x-3 gap-y-0.5 flex-wrap text-[10px] text-gray-500">
            <span>KDA <b className="text-gray-300 tabular-nums">{m.stats.kda.k}/{m.stats.kda.d}/{m.stats.kda.a}</b></span>
            <span>KP <b className="text-gray-300 tabular-nums">%{m.stats.kp}</b></span>
            <span><b className="text-gray-300 tabular-nums">{(m.stats.dmg / 1000).toFixed(1)}k</b> hasar</span>
            {m.lane15 && (
              <span>15dk <b className={`tabular-nums ${m.lane15.gd15 >= 0 ? "text-blue-300" : "text-red-400"}`}>{m.lane15.gd15 >= 0 ? "+" : ""}{m.lane15.gd15}</b> <span className="text-gray-600">gold</span></span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
