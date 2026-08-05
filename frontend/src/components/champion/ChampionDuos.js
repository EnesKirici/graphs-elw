"use client";

import Link from "next/link";
import { champIcon } from "@/lib/buildData";
import { DD_ASSETS, DD_CDN } from "@/lib/ddragon";
import { scoreColor } from "@/components/summoner/pro/scoreColor";

/*
  UYUMLULUK (DUO) BÖLÜMÜ — /champions/[id]/duos sayfasının gövdesi.

  Counter sayfasının içinde bir sekmeydi; kendi URL'i olmadığı için arama motoru
  görmüyordu ("yuumi duo" ayrı bir arama niyeti). Kendi route'una taşındı.

  İki katman: üstte 10 kartlık splash şeridi (tanıma), altında tam tablo (karar).
*/

const wrColor = (wr) => scoreColor(5.5 + (wr - 50) * 0.5);
const COL_GOOD = wrColor(58);

const loadingArt = (id) => `${DD_ASSETS}/cdn/img/champion/loading/${id}_0.jpg`;
const hideOnError = (e) => { e.currentTarget.style.visibility = "hidden"; };
const artFallback = (id) => (e) => {
  const el = e.currentTarget;
  if (el.dataset.fellBack) { el.style.visibility = "hidden"; return; }
  el.dataset.fellBack = "1";
  el.src = `${DD_CDN}/cdn/img/champion/loading/${id}_0.jpg`;
};

// Şeritte 12 kart sığıyordu ama sıkışık duruyordu (kullanıcı bildirdi).
// Tam liste zaten hemen altındaki tabloda.
const STRIP = 10;

export default function ChampionDuos({ champName, duos, role, version }) {
  const list = (role === "BOTTOM" ? duos?.asAdc : duos?.asSupport) || [];
  const mateLabel = role === "BOTTOM" ? "Support" : "ADC";

  if (!list.length) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <p className="text-sm text-gray-200 font-medium">Henüz yeterli uyumluluk verisi yok</p>
        <p className="text-xs text-gray-500 mt-2 leading-relaxed max-w-md mx-auto">
          {champName} ile birlikte oynanan ikililer (eş başına en az 5 maç) birikince
          bu liste otomatik dolacak.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="glass rounded-xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-edge/50">
          <span className="text-sm md:text-[1rem] font-bold tracking-wide uppercase" style={{ color: COL_GOOD }}>
            En iyi {mateLabel} eşleri
          </span>
          <span className="text-[11px] text-gray-500 hidden sm:block">aynı takımda kazanma oranı</span>
        </div>
        <div className="flex items-stretch gap-2 px-4 py-4 overflow-x-auto">
          {list.slice(0, STRIP).map((d) => <DuoCard key={d.champion} d={d} version={version} />)}
        </div>
      </div>

      <DuoTable duos={list} champName={champName} mateLabel={mateLabel} version={version} />
    </>
  );
}

/* Splash kartı — counter şeridiyle aynı görsel dil. */
function DuoCard({ d, version }) {
  const col = wrColor(d.adjWr);

  return (
    <Link
      href={`/champions/${d.champion}`}
      title={`${d.name} ile ${d.games} maç · gözlenen %${d.winRate} · örneklem-duyarlı %${d.adjWr}`}
      className="group relative flex flex-col flex-1 min-w-[92px] max-w-[150px] shrink-0 rounded-lg overflow-hidden border border-edge/60 bg-black transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-[var(--m)] hover:shadow-[0_10px_28px_-10px_var(--m)]"
      style={{ "--m": col }}
    >
      <div className="absolute top-0 left-0 right-0 h-[3px] z-20 transition-all duration-300 group-hover:h-[5px]" style={{ backgroundColor: col }} />
      <div className="relative h-[186px] overflow-hidden bg-black">
        <img
          src={loadingArt(d.champion)}
          alt={`${d.name} — ${d.name} ile uyum`}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.12]"
          onError={artFallback(d.champion)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/25 to-transparent" />
        <span className="absolute bottom-1.5 inset-x-0 px-1.5 text-center text-[11px] font-semibold text-white/95 truncate drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
          {d.name}
        </span>
      </div>
      <div className="flex-1 flex flex-col justify-center px-1.5 py-1.5 text-center bg-black">
        <div className="text-sm font-bold tabular-nums leading-none" style={{ color: col }}>%{d.adjWr}</div>
        <div className="text-[11px] font-medium text-gray-300 tabular-nums mt-1">{d.games} maç</div>
      </div>
    </Link>
  );
}

/*
  TAM LİSTE.

  İKİ ORAN AYNI SATIRDA: gözlenen (ham) ve örneklem-duyarlı. 10 maçlık %80 ile
  465 maçlık %53 aynı şey değil; sıralama ve çubuk İKİNCİSİNE göredir, ham oran
  yanında küçük durur ki "veriyi sakladık" izlenimi olmasın.

  @15 sütunları timeline'dan İLERİYE DÖNÜK doluyor (eski maçların zaman çizelgesi
  saklanmıyor). Hiçbir satırda yoksa sütunlar hiç çizilmez — boş sütun tabloyu
  genişletip okumayı zorlaştırıyordu.
*/
function DuoTable({ duos, champName, mateLabel, version }) {
  const lane15Var = duos.some((d) => d.lane15?.n > 0);

  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="flex items-baseline justify-between gap-3 px-5 py-4 border-b border-edge/50">
        <h2 className="text-[15px] md:text-lg font-bold tracking-wide uppercase" style={{ color: COL_GOOD }}>
          {champName} ile en iyi {mateLabel} eşleri
        </h2>
        <span className="text-xs text-gray-500">{duos.length} eş</span>
      </div>

      <div className="max-h-[620px] overflow-y-auto overflow-x-auto">
        <table className="w-full min-w-[680px]">
          <thead className="sticky top-0 bg-black/85 backdrop-blur-sm z-10">
            <tr className="text-[11px] uppercase tracking-wider text-gray-400">
              <th className="text-left font-semibold pl-4 pr-2 py-2.5 w-10">#</th>
              <th className="text-left font-semibold py-2.5">{mateLabel}</th>
              <th className="text-left font-semibold px-3 py-2.5 w-[24%]">kazanma oranı</th>
              {lane15Var && (
                <>
                  <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">gold @15</th>
                  <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">tecrübe @15</th>
                  <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">öldürme @15</th>
                  <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">minyon @15</th>
                </>
              )}
              <th className="text-right font-semibold px-4 py-2.5 whitespace-nowrap">maç</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge/25">
            {duos.map((d, i) => {
              const col = wrColor(d.adjWr);
              // Çubuk %42-58 bandını tüm genişliğe yayar — WR'ler dar bir aralıkta
              // toplandığı için 0-100 ölçeğinde hepsi aynı uzunlukta görünürdü.
              const dolu = Math.max(4, Math.min(100, ((d.adjWr - 42) / 16) * 100));
              const l = d.lane15;
              return (
                <tr key={d.champion} className="hover:bg-hover transition-colors">
                  <td className="pl-4 pr-2 py-2.5 text-xs text-gray-500 tabular-nums">{i + 1}</td>
                  <td className="py-2.5">
                    <Link href={`/champions/${d.champion}`} className="flex items-center gap-3 group">
                      <img
                        src={champIcon(version, d.champion)}
                        alt={d.name}
                        width={36}
                        height={36}
                        className="rounded-md border border-edge/60 shrink-0"
                        onError={hideOnError}
                      />
                      <span className="text-sm font-semibold text-gray-100 group-hover:text-white truncate">{d.name}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex-1 h-2 rounded-full bg-white/[0.07] overflow-hidden min-w-[52px]">
                        <div className="h-full rounded-full" style={{ width: `${dolu}%`, backgroundColor: col }} />
                      </div>
                      <span className="text-[15px] font-bold tabular-nums w-14 text-right" style={{ color: col }}>%{d.adjWr}</span>
                      <span
                        className="text-[11px] text-gray-500 tabular-nums w-11 text-right hidden lg:block"
                        title={`Gözlenen oran %${d.winRate} · örneklem-duyarlı %${d.adjWr}`}
                      >
                        %{d.winRate}
                      </span>
                    </div>
                  </td>
                  {lane15Var && (
                    <>
                      <Lane15 v={l?.gd15} />
                      <Lane15 v={l?.xpd15} />
                      <Lane15 v={l?.kd15} ondalik={2} />
                      <Lane15 v={l?.csd15} ondalik={1} />
                    </>
                  )}
                  <td className="px-4 py-2.5 text-right text-xs text-gray-400 tabular-nums whitespace-nowrap">{d.games}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!lane15Var && (
        <p className="px-5 py-3 text-[11px] text-gray-500 border-t border-edge/30 leading-relaxed">
          Koridor farkları (gold / tecrübe / öldürme / minyon @15) maç zaman çizelgesinden
          derleniyor ve <span className="text-gray-400">ileriye dönük</span> birikiyor — eski
          maçların zaman çizelgesi saklanmadığı için geriye dönük doldurulamıyor.
        </p>
      )}
    </div>
  );
}

/* @15 farkı hücresi: işaretli; sıfıra yakınsa sönük kalır (gürültü vurgulanmasın). */
function Lane15({ v, ondalik = 0 }) {
  if (v == null) {
    return <td className="px-3 py-2.5 text-right text-xs text-gray-600 tabular-nums">—</td>;
  }
  const s = v > 0 ? `+${v.toFixed(ondalik)}` : v.toFixed(ondalik);
  const cls = Math.abs(v) < (ondalik ? 0.05 : 15) ? "text-gray-500" : v > 0 ? "text-blue-300" : "text-red-300";
  return <td className={`px-3 py-2.5 text-right text-[13px] font-semibold tabular-nums ${cls}`}>{s}</td>;
}
