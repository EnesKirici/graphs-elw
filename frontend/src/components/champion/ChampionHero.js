import Link from "next/link";
import { gradeColor } from "@/components/champion/gradeStyle";

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
const POS_SHORT = { TOP: "Üst", JUNGLE: "Orman", MIDDLE: "Orta", BOTTOM: "ADC", UTILITY: "Destek", SUPPORT: "Destek" };

/* Kazanma oranı rengi — Genel sekmesindeki şeritle aynı eşikler. */
const wrCls = (v) => (v >= 52 ? "text-blue-300" : v >= 49 ? "text-gray-100" : "text-red-300");

/*
  Hero'nun sağındaki özet şeridi: derece · rol sırası · kazanma · seçim · yasaklanma · oyun.

  Neden burada: bu sayılar yalnız Genel sekmesinin içeriğindeydi, Detay ve Counter'a
  geçince kayboluyordu (kullanıcı "aynı standartta olmalı" dedi) — üstelik hero'nun sağ
  yarısı boş duruyordu. Hero üç sekmede de ortak olduğu için tek yere koymak hem
  tekrarı bitiriyor hem boşluğu dolduruyor.

  Sayılar BİRİNCİL (en çok oynanan) rolündür. Hero sunucuda render ediliyor, alttaki
  rol seçici ise istemci state'i — hero onu dinleyemez. Rol seçici zaten yalnız birden
  çok koridoru olan şampiyonlarda çıkıyor; hangi rol olduğu etikette yazılı.
*/
function HeroStats({ s }) {
  if (!s) return null;
  const rol = POS_SHORT[s.position] || s.position || "Rol";
  const gCol = gradeColor(s.grade) || "#6b7280";
  // Rol içindeki yüzdelik dilim: 144 şampiyonun 50.'si → ilk %35.
  const dilim = s.rank && s.total ? Math.max(1, Math.round((s.rank / s.total) * 100)) : null;

  return (
    /*
      Dört sütun, aralarında ince ayraç. Önceki hâlde orta blok flex-1 idi ve
      dilim çubuğu 400px'e yayılıyordu — şerit hem seyrek duruyor hem "rolünde
      ilk %35" alt satıra düşüp kırpılıyordu. Artık her sütun içeriği kadar,
      çubuk sabit 80px ve etiketi YANINDA.
    */
    <div className="inline-flex rounded-xl border border-white/10 bg-black/55 backdrop-blur-sm overflow-hidden divide-x divide-white/10">
      {/* 1) DERECE — tek harf, kendi rengiyle dolgulu. Şeridin çapası. */}
      {s.grade && (
        <div
          className="flex flex-col items-center justify-center px-4 py-2.5 shrink-0"
          style={{ backgroundColor: `color-mix(in srgb, ${gCol} 18%, transparent)` }}
        >
          <span className="text-[30px] font-extrabold leading-none" style={{ color: gCol }}>{s.grade}</span>
          <span className="text-[8px] text-gray-400 uppercase tracking-[0.14em] mt-1">derece</span>
        </div>
      )}

      {/* 2) KAZANMA — şeridin en büyük sayısı. */}
      <div className="px-4 py-2.5 flex flex-col justify-center shrink-0">
        <span className={`text-[22px] font-extrabold leading-none tabular-nums ${wrCls(s.winRate)}`}>%{s.winRate}</span>
        <span className="text-[9px] text-gray-400 uppercase tracking-wider mt-1.5">kazanma oranı</span>
      </div>

      {/* 3) ROL SIRASI + dilim çubuğu. "50/144" tek başına iyi mi kötü mü belli
             değil; çubuğun dolu kısmı ne kadar KISAysa o kadar üsttesin. */}
      {s.rank && (
        <div className="px-4 py-2.5 flex flex-col justify-center shrink-0">
          <span className="flex items-baseline gap-1">
            <span className="text-[19px] font-bold text-gray-100 leading-none tabular-nums">{s.rank}</span>
            <span className="text-xs text-gray-500 tabular-nums">/ {s.total}</span>
            <span className="text-[9px] text-gray-400 uppercase tracking-wider ml-1">{rol} sırası</span>
          </span>
          <span className="flex items-center gap-2 mt-2">
            <span className="h-1 w-20 rounded-full bg-white/10 overflow-hidden block">
              <span className="h-full rounded-full block" style={{ width: `${dilim}%`, backgroundColor: gCol }} />
            </span>
            <span className="text-[9px] text-gray-400">ilk %{dilim}</span>
          </span>
        </div>
      )}

      {/* 4) POPÜLERLİK — ikincil üçlü, daha sönük ve daha küçük. */}
      <div className="px-3.5 py-2 flex flex-col justify-center gap-1 shrink-0">
        <MiniStat k="seçim" v={s.pickRate != null ? `%${s.pickRate}` : "—"} />
        <MiniStat k="yasak" v={s.banRate != null ? `%${s.banRate}` : "—"} />
        <MiniStat k="oyun" v={(s.games ?? 0).toLocaleString("tr-TR")} />
      </div>
    </div>
  );
}

function MiniStat({ k, v }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[9px] text-gray-500 uppercase tracking-wider">{k}</span>
      <span className="text-[11px] font-bold text-gray-200 tabular-nums">{v}</span>
    </div>
  );
}

export default function ChampionHero({ champ, id, activeCrumb, headingSuffix, subtitle, grade, summary, extraChips, stats }) {
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

      {/* Kimlik — ikon + isim + rozetler.
          Üst boşluk bilerek ölçülü: splash'in görünmesi için biraz pay bırakılır ama
          eskiden (pt-16/pt-24) içerik ekranın çok altına itiliyordu ve ilk ekranda
          neredeyse yalnız arka plan vardı. Sitenin diğer sayfalarında bu kadar büyük
          bir üst boşluk yok — burası tek istisnaydı. */}
      <div className="pt-6 md:pt-10 pb-4 flex items-end gap-5 flex-wrap">
        {/* İkon çerçevesi dereceyi taşır: rol sıralamasındaki tier tek bakışta okunur. */}
        <div className="relative shrink-0">
          {/* alt yalnız isim DEĞİL: Google Görseller alt metnini bağlam olarak
              okuyor ve aynı ikon sitede onlarca yerde geçiyor — sayfanın konusunu
              içeren alt, "locke ct" gibi aramalarda görselin eşleşme şansını artırır. */}
          <img
            src={champ.image}
            alt={activeCrumb ? `${champ.name} ${activeCrumb} — ${champ.name} şampiyon ikonu` : `${champ.name} şampiyon ikonu`}
            width={104}
            height={104}
            className="rounded-2xl border-2 shadow-2xl"
            style={gCol ? { borderColor: gCol, boxShadow: `0 0 22px -6px ${gCol}` } : { borderColor: "rgba(255,255,255,0.15)" }}
          />
          {grade && (
            <span
              className="absolute -bottom-2 -right-2 min-w-[26px] h-[26px] px-1 flex items-center justify-center rounded-lg bg-base/95 border text-sm font-extrabold leading-none"
              style={{ borderColor: gCol, color: gCol }}
              title={`Rol sıralamasındaki derece: ${grade}`}
            >
              {grade}
            </span>
          )}
        </div>
        <div className="pb-0.5">
          {/* İsim + unvan AYNI satırda — unvan tek başına satır kaplamasın.
              H1 sayfanın konusudur: counter sayfasında "X Counter" olmalı, yalnız "X" değil
              (aynı H1 iki farklı sayfada = arama motoru için ayırt edilemez içerik). */}
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight drop-shadow-[0_2px_14px_rgba(0,0,0,0.85)]">
              {champ.name}
              {headingSuffix && <span className="text-gray-300"> {headingSuffix}</span>}
            </h1>
            {/* Açık splash'lerde (ör. Kai'Sa) soluk gri okunmuyordu → daha güçlü gölge.
                "md:text-base" YOK: bu projede --color-base (bg-base/text-base) sayfa
                zemin rengi için tanımlı — Tailwind'in yerleşik "base" boyut adıyla
                çakışıyor, "text-base" boyut değil DOĞRUDAN o zemin rengini uyguluyor
                (2026-08-04: Shyvana'da unvan yazısı bu yüzden görünmez oldu). Boyut için
                keyfi değer (text-[1rem]) kullanılmalı. */}
            <p className="text-white italic text-sm md:text-[1rem] drop-shadow-[0_2px_8px_rgba(0,0,0,1)]">
              {subtitle || champ.title}
            </p>
          </div>

          {/* Sınıf/rol rozetleri — yeteneklerin ÜSTÜNDE (kimlik bilgisi önce, kit sonra) */}
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
            {/* Sayfaya özel ek bağlam (ör. counter sayfasında patch + takma adlar).
                Çip olarak basılır çünkü H1'in YANINA italik metin sıkıştırmak
                hizasız duruyordu (kullanıcı bildirdi): başlık 5xl, metin sm →
                aynı satırda ortak bir taban çizgisi tutturamıyorlar. */}
            {extraChips?.map((c) => (
              <span key={c} className={CLASS_CHIP}>{c}</span>
            ))}
          </div>

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
        </div>

        {/*
          Veriden üretilen özet — hero'nun sağındaki boş splash alanında.
          Önce içeriğin üstünde tam satır kaplıyordu; oysa burası hem H1'e komşu
          (arama motoru için sayfanın konusu hemen başlığın yanında) hem de zaten
          boş duran alanı dolduruyor. Mobilde alt satıra düşer, gizlenmez —
          CSS ile saklanan metin mobile-first indekslemede zayıf sayılır.
        */}
        {/* İkisi de varsa ALT ALTA: özet metni sayfanın SEO gövdesi, silinmemeli. */}
        {(stats || summary) && (
          <div className="w-full lg:w-auto lg:ml-auto mb-1 space-y-2">
            {stats && <HeroStats s={stats} />}
            {summary && (
              <p className="text-[11px] md:text-xs leading-relaxed text-gray-200/95 rounded-lg border border-white/10 bg-black/40 backdrop-blur-sm px-3.5 py-2.5">
                {summary}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
