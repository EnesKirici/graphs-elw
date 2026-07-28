import Link from "next/link";

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
export default function ChampionHero({ champ, id, activeCrumb }) {
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
        <img
          src={champ.image}
          alt={champ.name}
          width={104}
          height={104}
          className="rounded-2xl border-2 border-white/15 shadow-2xl shrink-0"
        />
        <div className="pb-0.5">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight drop-shadow-[0_2px_14px_rgba(0,0,0,0.85)]">
            {champ.name}
          </h1>
          <p className="text-gray-200 mt-1 italic drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)]">{champ.title}</p>
          <div className="flex flex-wrap items-center gap-2 mt-2.5">
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
