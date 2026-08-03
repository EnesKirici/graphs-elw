"use client";

import { useState } from "react";
import Link from "next/link";
import { champIcon } from "@/lib/buildData";
import { DD_CDN } from "@/lib/ddragon";
import { scoreColor } from "@/components/summoner/pro/scoreColor";

/*
  Counter sayfası — iki katmanlı okuma:

  1) SPLASH ŞERİDİ (üstte): tek bakışta "kim ezer / kim ezilir". Soldan sağa renk
     spektrumu akar — sol uç en mavi (bizim en rahat eşleşmemiz), sağ uç en kırmızı
     (en zorlu rakip). Yani kartın rengi ve konumu aynı bilgiyi iki kez anlatır,
     sayıyı okumadan da anlaşılır.
  2) DETAY LİSTESİ (altta): head-to-head bar + KDA/KP/hasar + @15 koridor farkı.
     Barlar okunabilirliği artırdığı için korundu (kullanıcı geri bildirimi).

  Renk mantığı profil sayfasıyla AYNI (scoreColor): kırmızı → mor (~%50) → mavi.
  İlk render (server) birincil rolü gösterir → SSR HTML'de gerçek içerik (crawlable).
*/

// WR% → renk. scoreColor 0-10 alır; WR'nin ~%42-58 bandını tüm spektruma yayarız.
const wrColor = (wr) => scoreColor(5.5 + (wr - 50) * 0.5);

// Şerit başlıklarının rengi — uç değerlerin renkleriyle birebir aynı olsun.
const COL_GOOD = wrColor(58);
const COL_BAD = wrColor(42);

const ROLE_LABELS = { TOP: "Top", JUNGLE: "Jungle", MIDDLE: "Mid", BOTTOM: "ADC", UTILITY: "Support", SUPPORT: "Support" };
const ROLE_ICON = {
  TOP: "/roles/top.svg", JUNGLE: "/roles/jungle.svg", MIDDLE: "/roles/mid.svg",
  BOTTOM: "/roles/bot.svg", UTILITY: "/roles/support.svg", SUPPORT: "/roles/support.svg",
};

// Dikey karakter görseli (loading art, 308x560) — kare ikondan çok daha "canlı" bir kart verir.
// DD_CDN kullanılır: /dd aynası büyük görselleri bilerek içermez.
const loadingArt = (id) => `${DD_CDN}/cdn/img/champion/loading/${id}_0.jpg`;
const hideOnError = (e) => { e.currentTarget.style.visibility = "hidden"; };

const STRIP = 5;   // şeritte her yönde kaç kart
const SHOWN = 10;  // detay listesinde her sütunda kaç satır

export default function ChampionCounters({ champName, champImage, champId, counters, version, duos }) {
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

  const counterList = (data.counters || []).slice(0, SHOWN);   // en zorlu önce
  const strongList = (data.strongInto || []).slice(0, SHOWN);  // en ezici önce

  // Şerit: sol = en rahat (mavi), sağ = en zorlu (kırmızı). Zorlu liste ters çevrilir ki
  // en uç değer en sağda kalsın → renk spektrumu soldan sağa kesintisiz aksın.
  const stripGood = strongList.slice(0, STRIP);
  const stripBad = counterList.slice(0, STRIP).reverse();

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

      {/* 1) Splash şeridi — tek bakışta özet */}
      {(stripGood.length > 0 || stripBad.length > 0) && (
        <MatchupStrip good={stripGood} bad={stripBad} champName={champName} />
      )}

      {/* 2) Alt koridor 2v2: karşı SUPPORT etkisi + aynı takım sinerjisi.
             Aynı koridor düellosu (ADC↔ADC) hikâyenin yarısı; bir Nautilus/Blitzcrank
             eşleşmesi karşı ADC kadar belirleyici olabiliyor. */}
      <BotLaneSection
        data={data}
        duos={duos}
        role={role}
        champName={champName}
        version={version}
      />

      {/* 2) Detaylı head-to-head */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <MatchupColumn
          title="Zorlu Rakipler"
          subtitle={`${champName} karşısında avantajlı olan şampiyonlar — en düşük kazanma oranları.`}
          rows={counterList}
          champName={champName}
          version={version}
          empty={`${champName} için zayıf eşleşme verisi henüz yok.`}
        />
        <MatchupColumn
          title="Rahat Eşleşmeler"
          subtitle={`${champName} tarafının üstün olduğu şampiyonlar — en yüksek kazanma oranları.`}
          rows={strongList}
          champName={champName}
          version={version}
          empty={`${champName} için güçlü eşleşme verisi henüz yok.`}
        />
      </div>

      <p className="text-[11px] text-gray-500 leading-relaxed">
        Yüzdeler {champName} tarafının o eşleşmedeki kazanma oranıdır (kalanı rakibin). Rakip başına en az 10 maç.
        Sıralama yalnız orana değil maç sayısına da göre ağırlıklandırılır — az örneklemli uç oranlar listeyi yanıltmaz.
        Emerald+ · Patch {(counters.patches || []).join(" + ")}.
      </p>
    </div>
  );
}

/* Yatay splash şeridi: sol uç en rahat (mavi) → sağ uç en zorlu (kırmızı). */
function MatchupStrip({
  good, bad, champName, heading, subtitle, footer,
  goodLabel = "Rahat eşleşmeler", badLabel = "Zorlu rakipler",
}) {
  return (
    <div className="glass rounded-xl overflow-hidden">
      {heading && (
        <div className="px-5 pt-3.5 pb-2.5">
          <h3 className="text-sm font-semibold text-gray-100">{heading}</h3>
          {subtitle && <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed max-w-2xl">{subtitle}</p>}
        </div>
      )}

      {(good.length > 0 || bad.length > 0) && (
        <>
          <div className={`flex items-center justify-between gap-3 px-5 py-3 border-b border-edge/50 ${heading ? "border-t border-edge/30" : ""}`}>
            <span className="text-[11px] font-bold tracking-wide uppercase" style={{ color: COL_GOOD }}>
              {goodLabel}
            </span>
            <span className="text-[10px] text-gray-600 hidden sm:block">{champName} kazanma oranı</span>
            <span className="text-[11px] font-bold tracking-wide uppercase" style={{ color: COL_BAD }}>
              {badLabel}
            </span>
          </div>

          <div className="flex items-stretch gap-2 px-4 py-4 overflow-x-auto">
            {good.map((m) => <StripCard key={`g-${m.id}`} m={m} />)}
            {good.length > 0 && bad.length > 0 && (
              <div className="shrink-0 self-stretch w-px bg-edge/60 mx-1.5" aria-hidden />
            )}
            {bad.map((m) => <StripCard key={`b-${m.id}`} m={m} />)}
          </div>
        </>
      )}

      {footer}
    </div>
  );
}

/*
  Alt koridor 2v2 bölümü. İki farklı ilişkiyi TEK kartta birleştirir:
   - KARŞI takımın support'u → rakiplik (champion_matchups çapraz satırları)
   - AYNI takımın support'u  → sinerji (champion_duo_stats, shrinkage WR)
  Bunlar karıştırılmamalı: biri "kime karşı zorlanır", diğeri "kiminle güçlü".
*/
function BotLaneSection({ data, duos, role, champName, version }) {
  const isBot = role === "BOTTOM" || role === "UTILITY" || role === "SUPPORT";
  if (!isBot) return null;

  const crossPos = data?.crossPosition;
  const oppLabel = crossPos === "BOTTOM" ? "ADC" : "support";
  const mateLabel = role === "BOTTOM" ? "support" : "ADC";
  const duoList = (role === "BOTTOM" ? duos?.asAdc : duos?.asSupport) || [];

  const good = (data?.crossStrong || []).slice(0, STRIP);
  const bad = (data?.crossCounters || []).slice(0, STRIP).reverse();

  if (!good.length && !bad.length && !duoList.length) return null;

  const footer = duoList.length ? (
    <div className="border-t border-edge/40 px-4 py-3.5">
      <p className="text-[11px] font-bold uppercase tracking-wide mb-2.5" style={{ color: COL_GOOD }}>
        Birlikte en iyi {mateLabel}
        <span className="font-normal normal-case tracking-normal text-gray-600"> — aynı takımdaki sinerji</span>
      </p>
      <div className="flex gap-2 overflow-x-auto">
        {duoList.map((d) => <DuoCard key={d.champion} d={d} version={version} />)}
      </div>
    </div>
  ) : null;

  return (
    <MatchupStrip
      good={good}
      bad={bad}
      champName={champName}
      heading={`Alt Koridor — ${crossPos === "BOTTOM" ? "Karşı ADC" : "Karşı Support"} Etkisi`}
      subtitle={`Alt koridor 2v2 oynanır: karşı ${oppLabel} de doğrudan rakiptir ve eşleşmeyi karşı ADC kadar belirleyebilir. Oranlar ${champName} tarafının o ${oppLabel} karşısındaki kazanma yüzdesidir.`}
      goodLabel={`Rahat karşı ${oppLabel}`}
      badLabel={`Zorlu karşı ${oppLabel}`}
      footer={footer}
    />
  );
}

/* Sinerji kartı — rakip değil, aynı takımdaki partner. */
function DuoCard({ d, version }) {
  const col = wrColor(d.adjWr);
  return (
    <Link
      href={`/champions/${d.champion}`}
      title={`${d.name} ile ${d.games} maç · gözlenen %${d.winRate} · örneklem-duyarlı %${d.adjWr}`}
      className="flex items-center gap-2 shrink-0 rounded-lg border border-edge/60 bg-black/25 pl-1.5 pr-3 py-1.5 hover:border-white/25 transition-colors"
    >
      <img
        src={champIcon(version, d.champion)}
        alt={d.name}
        width={30}
        height={30}
        className="rounded-md border border-edge"
        onError={hideOnError}
      />
      <div className="min-w-0">
        <div className="text-[11px] font-medium text-gray-200 truncate max-w-[100px]">{d.name}</div>
        <div className="text-[10px] tabular-nums" style={{ color: col }}>
          %{d.adjWr} <span className="text-gray-600">· {d.games} maç</span>
        </div>
      </div>
    </Link>
  );
}

/* Tek kart: dikey karakter görseli + kazanma oranı + maç sayısı (+ koridor etiketi). */
function StripCard({ m }) {
  const col = wrColor(m.winRate);
  const lane = laneTag(m);

  return (
    <Link
      href={`/champions/${m.id}/counter`}
      title={`${m.name} — ${m.games} maç`}
      className="group relative flex-1 min-w-[92px] max-w-[150px] shrink-0 rounded-lg overflow-hidden border border-edge/60 hover:border-white/25 transition-all duration-200 hover:-translate-y-0.5"
    >
      {/* Üstte durumu tek bakışta veren renk şeridi */}
      <div className="absolute top-0 left-0 right-0 h-[3px] z-10" style={{ backgroundColor: col }} />

      {/* Yükseklik loading art'ın dikey oranına (308x560) yakın tutulur — yatay bir
          kutuya sıkıştırılırsa karakterin yüzü kırpılıyor. */}
      <div className="relative h-[186px] overflow-hidden bg-black/40">
        <img
          src={loadingArt(m.id)}
          alt={m.name}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
          onError={hideOnError}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/25 to-transparent" />
        <span className="absolute bottom-1.5 inset-x-0 px-1.5 text-center text-[11px] font-semibold text-white/95 truncate drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
          {m.name}
        </span>
      </div>

      <div className="px-1.5 py-1.5 text-center bg-black/35">
        <div className="text-sm font-bold tabular-nums leading-none" style={{ color: col }}>%{m.winRate}</div>
        <div className="text-[9px] text-gray-500 tabular-nums mt-1">{m.games} maç</div>
        {lane && (
          <div className={`mt-1 text-[9px] font-medium rounded px-1 py-0.5 ${lane.cls}`}>{lane.text}</div>
        )}
      </div>
    </Link>
  );
}

/*
  Koridor etiketi. @15 verisi (gold farkı) varsa onu gösterir — koridor fazının kimin
  lehine geçtiği, kazanma oranından bağımsız bir bilgidir. Veri yoksa ve örneklem
  düşükse dürüst bir "az veri" uyarısı verilir; ikisi de yoksa etiket basılmaz
  (uydurma rozet yok). @15 ileriye dönük dolduğu için başlangıçta çoğu kartta boştur.
*/
function laneTag(m) {
  const n = m.lane15?.n ?? 0;
  if (n >= 5) {
    const gd = m.lane15.gd15;
    if (gd >= 150) return { text: "koridor önde", cls: "bg-blue-500/15 text-blue-300" };
    if (gd <= -150) return { text: "koridor geride", cls: "bg-red-500/15 text-red-300" };
    // "Dengeli" bilgi taşımıyor ve neredeyse her kartta çıkıp şeridi gürültüye
    // boğuyordu → etiket basılmaz, kart temiz kalır.
    return null;
  }
  if (m.games < 20) return { text: "az veri", cls: "bg-white/5 text-gray-500" };
  return null;
}

function MatchupColumn({ title, subtitle, rows, champName, version, empty }) {
  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-edge/50">
        <h3 className="text-sm font-semibold text-gray-100">{title}</h3>
        <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{subtitle}</p>
      </div>
      {rows.length ? (
        <div className="divide-y divide-edge/25">
          {rows.map((m, i) => (
            <MatchupRow key={m.id} m={m} rank={i + 1} champName={champName} version={version} />
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-gray-600 leading-relaxed px-5 py-6 text-center">{empty}</p>
      )}
    </div>
  );
}

/* Tek eşleşme — rakip portresi + kim-kime-karşı kazanma barı (head-to-head). */
function MatchupRow({ m, rank, champName, version }) {
  const champWr = m.winRate;                       // şampiyonun bu rakibe karşı WR'si
  const oppWr = Math.round((100 - champWr) * 10) / 10;
  const col = wrColor(champWr);                     // kırmızı→mor→mavi gradyan

  return (
    <Link
      href={`/champions/${m.id}/counter`}
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
