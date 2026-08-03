import Link from "next/link";
import { gradeCls, gradeColor } from "@/components/champion/gradeStyle";

// Riot sınıf tag'i → TR. Pozisyon → TR ("Bot" YOK: BOTTOM = ADC).
const TAG_TR = { Fighter: "Dövüşçü", Tank: "Tank", Mage: "Büyücü", Assassin: "Suikastçi", Marksman: "Nişancı", Support: "Destek" };
const POS_TR = { TOP: "Üst Koridor", JUNGLE: "Orman", MIDDLE: "Orta Koridor", BOTTOM: "ADC", UTILITY: "Destek", SUPPORT: "Destek" };

// Neon değil — subtle/uniform chip'ler. Sınıf gri, pozisyon hafif mavi (rol vurgusu).
const CLASS_CHIP = "text-xs font-medium px-2.5 py-1 rounded-md bg-black/35 text-gray-200 border border-white/10 backdrop-blur-sm";
const POS_CHIP = "text-xs font-semibold px-2.5 py-1 rounded-md bg-blue-500/15 text-blue-200 border border-blue-400/25 backdrop-blur-sm";

/*
  Şampiyon sayfası kompakt kimlik başlığı — ikon + isim + title + tag/pozisyon.
  Arka plan görseli ayrı (ChampionBg), bu blok onun ÜstÜnde (relative z-10).
  Yalnız BİRİNCİL sınıf gösterilir (Riot'un ikincil tag'i kafa karıştırıyordu:
  MissFortune "Büyücü" gibi). activeCrumb → breadcrumb'a ek kırıntı (ör. "Counter").
*/
export default function ChampionHero({ champ, id, activeCrumb, headingSuffix, subtitle, grade }) {
  // Yetenekler: pasif + Q/W/E/R. DDragon spells sırası zaten Q,W,E,R.
  const keys = ["Q", "W", "E", "R"];
  const abilities = [
    champ.passive ? { ...champ.passive, label: "P" } : null,
    ...(champ.spells || []).slice(0, 4).map((s, i) => ({ ...s, label: keys[i] })),
  ].filter(Boolean);
  const gCol = gradeColor(grade);

  return (
    <div className="max-w-7xl mx-auto px-6">
      {/* Breadcrumb — üstte, ince */}
      <div className="pt-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-300/90">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span className="text-gray-500">›</span>
          <Link href="/champions" className="hover:text-white transition-colors">Şampiyonlar</Link>
          <span className="text-gray-500">›</span>
          {activeCrumb ? (
            <>
              <Link href={`/champions/${id}`} className="hover:text-white transition-colors">{champ.name}</Link>
              <span className="text-gray-500">›</span>
              <span className="text-white">{activeCrumb}</span>
            </>
          ) : (
            <span className="text-white">{champ.name}</span>
          )}
        </div>
        <Link
          href="/champions"
          className="hidden sm:flex items-center gap-1.5 text-xs text-gray-300/80 hover:text-white transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Şampiyonlara Dön
        </Link>
      </div>

      {/* Kimlik — ikon + isim + rozetler */}
      <div className="pt-16 md:pt-24 pb-4 flex items-end gap-5">
        {/* İkon çerçevesi dereceyi taşır: rol sıralamasındaki tier tek bakışta okunur. */}
        <div className="relative shrink-0">
          <img
            src={champ.image}
            alt={champ.name}
            width={104}
            height={104}
            className="rounded-2xl border-2 shadow-2xl"
            style={gCol ? { borderColor: gCol, boxShadow: `0 0 22px -6px ${gCol}` } : { borderColor: "rgba(255,255,255,0.15)" }}
          />
          {grade && (
            <span
              className={`absolute -bottom-2 -right-2 min-w-[26px] h-[26px] px-1 flex items-center justify-center rounded-lg bg-base/95 border text-sm font-extrabold leading-none ${gradeCls(grade)}`}
              style={{ borderColor: gCol }}
              title={`Rol sıralamasındaki derece: ${grade}`}
            >
              {grade}
            </span>
          )}
        </div>
        <div className="pb-0.5">
          {/* H1 sayfanın konusudur: counter sayfasında "X Counter" olmalı, yalnız "X" değil
              (aynı H1 iki farklı sayfada = arama motoru için ayırt edilemez içerik). */}
          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight drop-shadow-[0_2px_14px_rgba(0,0,0,0.85)]">
            {champ.name}
            {headingSuffix && <span className="text-gray-300"> {headingSuffix}</span>}
          </h1>
          <p className="text-gray-200 mt-1 italic drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)]">{subtitle || champ.title}</p>

          {/* Yetenekler — tanıtım amaçlı (P/Q/W/E/R). Detay tab'ındaki tam açıklamanın
              kısa hâli: şampiyonu tanımayan ziyaretçi ilk bakışta kitini görsün. */}
          {abilities.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2.5">
              {abilities.map((a) => (
                <span key={a.label} className="relative" title={`${a.label} — ${a.name}`}>
                  <img
                    src={a.image}
                    alt={a.name}
                    width={30}
                    height={30}
                    className="rounded-md border border-white/15 bg-black/40"
                  />
                  <span className="absolute -bottom-1 -right-1 text-[8px] font-bold text-gray-300 bg-black/85 rounded px-[3px] leading-[11px] border border-white/10">
                    {a.label}
                  </span>
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-3">
            {champ.tags?.slice(0, 1).map((tag) => (
              <span key={tag} className={CLASS_CHIP}>{TAG_TR[tag] || tag}</span>
            ))}
            {champ.positions?.map((pos) => {
              const rate = champ.positionRates?.[pos];
              return (
                <span key={pos} className={POS_CHIP}>{POS_TR[pos] || pos}{rate != null && ` ${rate}%`}</span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
