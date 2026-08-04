"use client";

import { Fragment, useState, useMemo } from "react";
import Link from "next/link";
import { pickRealRunePage, groupRealItems, itemIcon, profileIcon, runeIcon, runeIconById, shardIcon, TREE_TR, SHARD_ROWS } from "@/lib/buildData";
import { gradeColor } from "@/components/champion/gradeStyle";
import ChampionTrend from "@/components/champion/ChampionTrend";
import ChampionTopPlayers from "@/components/champion/ChampionTopPlayers";
import RoleSelector, { ROLE_LABELS } from "@/components/champion/RoleSelector";

const ROLE_SHARE_LABEL = {
  TOP: "Üst Koridorda Oynanma", JUNGLE: "Ormanda Oynanma", MIDDLE: "Orta Koridorda Oynanma",
  BOTTOM: "Alt Koridorda Oynanma", UTILITY: "Destekte Oynanma", SUPPORT: "Destekte Oynanma",
};

/* İstatistik parçası satırlarının anlamı (DDragon bunları isimlendirmiyor). */
const SHARD_ROW_TR = ["Saldırı", "Esnek", "Savunma"];

const hideOnError = (e) => { e.currentTarget.style.visibility = "hidden"; };
const wrCls = (wr) => (wr >= 52 ? "text-blue-300" : wr >= 49 ? "text-gray-200" : "text-red-400");
// Derece renkleri gradeStyle.js'te (tek kaynak) — şampiyon ikonu çerçevesi de aynısını kullanır.
const SPELL_IDX = { Q: 0, W: 1, E: 2, R: 3 };
const TL_MIN_SAMPLE = 20;
/* Backend'in trend eşiği (TREND_MIN_WINDOW_GAMES) — kullanıcıya sebebi söylemek için. */
const TREND_MIN_DAILY = 7;

function Panel({ children, className = "" }) {
  return (
    <div className={`glass rounded-xl overflow-hidden divide-y divide-edge/40 ${className}`}>
      {children}
    </div>
  );
}

function Section({ title, extra, children, className = "", bodyClassName = "" }) {
  return (
    <div className={`p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">{title}</h3>
        {extra}
      </div>
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}

/*
  "Şu karardan hangisi?" grubu — çizme ve destek eşyası aynı kalıpta: her ikisi de
  herkesin aldığı, ama hangisini aldığı maça göre değişen tekil bir seçim.
  Eşya ADI yazılı: bu kutular ikon yığını değil, karşılaştırma listesi.
*/
function ItemChoiceGroup({ title, items, names = {}, divider }) {
  return (
    <div className={divider ? "pt-3 border-t border-edge/40" : ""}>
      <span className="text-[11px] text-gray-400 font-medium block mb-2">{title}</span>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map((it, i) => {
          const name = it.name || names[String(it.id)];
          return (
            <div
              key={i}
              className="flex items-center gap-2 rounded-lg bg-edge/20 border border-edge/40 px-2.5 py-2"
              title={`${name ? name + " — " : ""}%${it.pickRate} seçim · %${it.winRate} kazanma`}
            >
              <img src={it.icon} alt={name || ""} width={34} height={34}
                className="rounded-md border border-edge shrink-0" onError={hideOnError} />
              <div className="min-w-0 flex-1">
                {name && <div className="text-[10px] text-gray-300 leading-tight truncate">{name}</div>}
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className={`text-sm font-bold leading-none ${wrCls(it.winRate)}`}>{it.winRate}%</span>
                  <span className="text-[10px] text-gray-400 leading-none">{it.pickRate}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ComingSoon({ children }) {
  return <p className="text-[11px] text-gray-400 leading-relaxed py-2">{children}</p>;
}

/*
  Gerçek veriyle build içeriği (Genel tabı) — TEK sayfada rün + eşya + büyü + yetenek.
  build = backend /champions/{id} yanıtındaki `build`. Yalnız gerçekten oynanan
  koridorlar rol seçiminde çıkar. Veri yoksa dürüst boş durum; sahte veri YOK.
*/
export default function ChampionBuild({ champion, version, runesData = [], build, role, onRole }) {
  const positions = build?.positions || [];
  const [pageIdx, setPageIdx] = useState(0);

  // Rol değişince rün sayfası seçimi sıfırlanmalı: Top'un 3. keystone'u Mid'de yok.
  const selectRole = (p) => {
    setPageIdx(0);
    onRole(p);
  };

  const posInfo = positions.find((p) => p.position === role);
  const cats = build?.byPosition?.[role] || {};

  const keystoneOptions = (cats.keystone || []).filter((k) => runeIconById(runesData, Number(k.key)));
  const safeIdx = Math.min(pageIdx, Math.max(keystoneOptions.length - 1, 0));
  const runePage = useMemo(
    () => pickRealRunePage(runesData, keystoneOptions, cats.rune_minor, cats.shard, safeIdx, {
      minorsK: cats.rune_minor_k,
      shardsK: cats.shard_k,
    }),
    [runesData, keystoneOptions, cats, safeIdx]
  );
  const activeKeystone = keystoneOptions[safeIdx];
  const itemNames = build?.itemNames || {};
  const items = useMemo(() => groupRealItems(cats.item_full, version, itemNames), [cats, version, itemNames]);
  const samples = cats._samples || {};
  const skillOrders = ((samples.skill_order || 0) >= TL_MIN_SAMPLE && cats.skill_order) || [];
  const starters = ((samples.starter || 0) >= TL_MIN_SAMPLE && cats.starter) || [];
  const itemSlots = (samples.item_slot1 || 0) >= TL_MIN_SAMPLE
    ? [1, 2, 3, 4, 5]
        .map((n) => ({ n, list: cats[`item_slot${n}`] || [] }))
        .filter((s) => s.list.length > 0)
    : [];
  const spellPairs = cats.spell_pair || [];

  if (!positions.length) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <p className="text-sm text-gray-300 font-medium">Henüz yeterli maç verisi yok</p>
        <p className="text-xs text-gray-500 mt-2 leading-relaxed max-w-md mx-auto">
          {champion.name} için Emerald+ maç havuzumuzda yeterli örneklem birikmedi.
          Worker maç topladıkça build, rün ve item istatistikleri burada otomatik görünecek.
        </p>
      </div>
    );
  }

  const lowSample = (posInfo?.games || 0) < 30;

  return (
    <div className="space-y-4">
      {/* Üst özet kartı: rol seçici + derece/statlar + trend — TEK kart */}
      <div className="glass rounded-xl overflow-hidden">
        {/*
          ROL SEÇİCİ EN ÜSTTE. Önce stat şeridi ile trend grafiklerinin ARASINDA ince
          bir satırdı: hem gözden kaçıyor hem de altındaki grafiklerin başlığıymış gibi
          duruyordu. Oysa seçim kartın TAMAMINI (şerit + grafikler + rünler + eşyalar)
          değiştiriyor — o yüzden kartın başlığı olmalı. Yalnız birden fazla rolde
          çıkar; tek rollü şampiyonda (ör. Samira %99 ADC) satır hiç açılmaz.
        */}
        <RoleSelector positions={positions} role={role} onRole={selectRole} lowSample={lowSample} />

        <StatStrip pos={posInfo} roleLabel={ROLE_LABELS[role] || role} />

        {/*
          Son 30 günün gidişatı AYNI KARTIN İÇİNDE: üstteki şerit "şu an %46.9",
          buradaki eğriler "nasıl buraya geldi" — aynı üç sayının zaman hâli oldukları
          için ayrı kartlara bölmek bilgiyi koparıyordu.
          Seri SEÇİLİ KORİDORA ait; o rolde yeterli günlük maç yoksa tüm rollerin
          ortalamasına düşmek yerine dürüst bir not basılır (şerit MIDDLE derken
          grafiğin ALL göstermesi aynı kartta iki farklı kazanma oranı demekti).
        */}
        {cats.trend?.length >= 3 || (positions.length === 1 && build?.trend?.length >= 3) ? (
          <ChampionTrend trend={cats.trend?.length ? cats.trend : build.trend} allTrend={build?.trend} />
        ) : (
          <p className="border-t border-edge/40 px-4 py-3 text-[11px] text-gray-400">
            {ROLE_LABELS[role] || role} koridorunda günlük trend için yeterli maç yok —
            eğriler ancak günde en az {TREND_MIN_DAILY} maç birikince çizilir.
          </p>
        )}
      </div>

      {/*
        DÜZEN NOTU: eskiden 3-6-3 sütun vardı ve sağ sütun (sihirdar + başlangıç + çizme +
        1-5. item + tam build + duruma göre) tıka basa doluyken sol sütun neredeyse boştu;
        sayfanın alt yarısı da bomboş kalıyordu. Artık içerik YATAY bölümlere açıldı:
        her panel genişliğini içeriğine göre alıyor, item sırası tam genişlikte nefes alıyor.

        İKİ SÜTUN AMA TEK KART: rünler ve sağdaki üç bölüm ayrı kartlarken sütunların
        yüksekliği tutmuyordu — kısa olanın altında sayfa arka planı görünen bir DELİK
        kalıyordu ("her kart ayrı ayrı duruyor"). Tek çerçeve + dikey ayraç ile sütunlar
        birbirine kilitlenir; artan alan kartın İÇİNDE nefes payına dönüşür.
      */}
      <Panel>
        <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* SOL — Rünler (sayfanın ana içeriği, en geniş alan) */}
        <div className="lg:col-span-8 lg:border-r border-edge/40 flex flex-col divide-y divide-edge/40">
          <Section
            className="flex-1 flex flex-col"
            bodyClassName="flex-1 flex flex-col"
            title="Rünler"
            extra={
            activeKeystone && (
              <span className="text-[10px] text-gray-400">
                {safeIdx === 0 ? "En popüler" : `${safeIdx + 1}. seçenek`} · {activeKeystone.pickRate}% pick · <b className={wrCls(activeKeystone.winRate)}>{activeKeystone.winRate}% WR</b>
              </span>
            )
          }>
            {runePage ? (
              /* flex-1: sütun sağdaki üç bölüm kadar uzadığında artan alanı AĞAÇLAR
                 alsın — tab satırı yukarıda sabit kalsın (her şeyi birlikte
                 ortalayınca başlığın altında kocaman bir boşluk açılıyordu). */
              <div className="flex-1 flex flex-col">
                {/* Rün sayfası seçici — site dilindeki ALT-ÇİZGİ tab yapısı
                    (Genel/Detay/Counter ile aynı). flex-1 ile kartın TAM genişliğine
                    eşit bölünür; sola yapışıp sağda boşluk bırakmaz. */}
                {keystoneOptions.length > 1 && (
                  <div className="flex items-stretch border-b border-edge/50 mb-6 -mt-1">
                    {keystoneOptions.map((k, i) => (
                      <button key={k.key} onClick={() => setPageIdx(i)}
                        className={`flex-1 flex items-center justify-center gap-2 px-2 py-3 text-xs font-semibold border-b-2 -mb-px transition-all duration-200 cursor-pointer whitespace-nowrap ${
                          i === safeIdx
                            ? "border-blue-400 text-white bg-blue-500/[0.06]"
                            : "border-transparent text-gray-400 hover:text-gray-200 hover:bg-white/[0.03]"}`}
                        title={`${i + 1}. seçenek`}>
                        <img src={runeIconById(runesData, Number(k.key))} alt="" width={26} height={26}
                          className={`rounded-full transition-transform duration-200 ${i === safeIdx ? "scale-105" : "opacity-60"}`}
                          onError={hideOnError} />
                        <span className="text-gray-500 font-normal">{k.pickRate}%</span>
                        <span className={`font-bold ${wrCls(k.winRate)}`}>{k.winRate}%</span>
                      </button>
                    ))}
                  </div>
                )}

                {/*
                  ÜÇ EŞİT SÜTUN. Önce "birincil ağaç | (ikincil ağaç + parçalar alt alta)"
                  şeklinde iki sütundu: ikincil ağaç keystone satırı olmadığı için kısa
                  kalıyor, sağda ve altta büyük boşluk oluşuyordu. Parçaları üçüncü sütuna
                  almak yatay alanı doldurup dikey boşluğu kapatıyor.
                */}
                {/* content-center: artan alan varsa ağaç bloğu ortalanır. Satır
                    aralarına yaymak (justify-between) denendi — sütun çok uzun olunca
                    rünler birbirinden kopup seyrek duruyordu; sihirdar büyülerini bu
                    sütuna alınca zaten iki taraf aynı boya geldi. */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-3 mt-1 content-center">
                  <div className="flex justify-center">
                    <RuneTree tree={runePage.primary} selected={runePage.selected} pctOf={runePage.pctOf} />
                  </div>
                  <div className="flex justify-center md:border-x border-edge/40 md:px-2">
                    <RuneTree tree={runePage.secondary} selected={runePage.selected} pctOf={runePage.pctOf} skipKeystone />
                  </div>
                  <div className="flex flex-col items-center gap-4">
                    <span className="text-sm font-semibold text-gray-300">İstatistik Parçaları</span>
                    {/* Satır etiketleri (Saldırı/Esnek/Savunma) ve seçilenin ADI eklendi:
                        daha önce üç sıra isimsiz ikon vardı, hangi satırın ne olduğu
                        belli değildi ve sütunun yarısı boştu. */}
                    {SHARD_ROWS.map((row, ri) => (
                      <div key={ri} className="w-full flex flex-col items-center gap-1">
                        <span className="text-[10px] text-gray-400 uppercase tracking-wider">{SHARD_ROW_TR[ri]}</span>
                        <div className="flex items-center gap-3">
                          {row.map((sh, ci) => (
                            <RuneDot key={ci} src={shardIcon(sh.icon)} on={runePage.shardSel[ri] === ci} size={34} title={sh.name} />
                          ))}
                        </div>
                        <span className="text-[10px] text-blue-300/80 text-center leading-tight">
                          {row[runePage.shardSel[ri]]?.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <ComingSoon>Bu koridor için rün verisi henüz birikmedi.</ComingSoon>
            )}
          </Section>

          {/* Sihirdar büyüleri RÜNLERLE aynı sütunda: oyunda da ikisi aynı ekranda
              seçilir. Ayrıca sağ sütun soldan çok daha uzundu; bu bölüm sola geçince
              iki sütun neredeyse aynı boyda bitiyor ve geniş alanda çiftler sıkışmıyor. */}
          <Section title="Sihirdar Büyüleri" extra={<span className="text-[10px] text-gray-400">WR · Seçim</span>}>
            {spellPairs.length ? (
              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: `repeat(${Math.min(spellPairs.length, 4)}, minmax(0, 1fr))` }}
              >
                {spellPairs.slice(0, 4).map((sp) => {
                  const icons = String(sp.key).split("-").map((sid) => build?.spellMap?.[sid]).filter(Boolean);
                  if (!icons.length) return null;
                  return (
                    <div key={sp.key} className="rounded-lg bg-edge/20 border border-edge/40 p-2.5 flex items-center justify-center gap-3">
                      <div className="flex items-center gap-1.5">
                        {icons.map((s, i) => (
                          <img key={i} src={s.image} alt={s.name} title={s.name}
                            width={38} height={38} className="rounded-lg border border-edge" onError={hideOnError} />
                        ))}
                      </div>
                      <div>
                        <div className={`text-sm font-bold leading-none ${wrCls(sp.winRate)}`}>{sp.winRate}%</div>
                        <div className="text-[10px] text-gray-500 mt-1 leading-none">{sp.pickRate}% seçim</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <ComingSoon>Büyü verisi henüz yok.</ComingSoon>
            )}
          </Section>
        </div>

        {/*
          SAĞ — yetenek sırası + başlangıç/çizme. Ayrı kartlardayken her biri az
          içerikli olduğu için kart başına düşen boşluk içerikten fazlaydı; artık
          soldaki rün sütunuyla aynı çerçevede.
        */}
        <div className="lg:col-span-4 divide-y divide-edge/40 border-t lg:border-t-0 border-edge/40">
            <Section title="Yetenek Sırası" extra={<span className="text-[10px] text-gray-400">Seçim · WR</span>}>
              {skillOrders.length ? (
                <div className="space-y-3">
                  {skillOrders.slice(0, 2).map((o, idx) => (
                    <SkillOrderRow key={o.key} o={o} champion={champion} big={idx === 0} />
                  ))}
                </div>
              ) : (
                <ComingSoon>
                  Yetenek sırası istatistikleri toplanıyor — worker maç timeline&apos;larını işledikçe burada gerçek verilerle görünecek
                  {(samples.skill_order || 0) > 0 ? ` (şu ana kadar ${samples.skill_order} maç işlendi)` : ""}.
                </ComingSoon>
              )}
            </Section>

            {/* Başlık role göre: destek oynanan koridorda çizme yerine destek eşyası
                asıl karardır, ikisi de varsa ikisi de listelenir. */}
            <Section
              title={items.support.length ? "Başlangıç & Destek Eşyası" : "Başlangıç & Çizme"}
              extra={<span className="text-[10px] text-gray-400">WR · Seçim</span>}
            >
              <div className="space-y-3">
                {starters.length > 0 && (
                  <div className="space-y-2">
                    {starters.slice(0, 2).map((s) => (
                      <StarterRow key={s.key} s={s} version={version} />
                    ))}
                  </div>
                )}
                {/* DESTEK EŞYASI — destek oynayan herkes zincirin sonunda dört bitişten
                    birini seçer; asıl soru "hangisini". Efsanevi eşya sırasında
                    "1. eşya %33" diye görünmesi bu kararı gizliyordu. */}
                {items.support.length > 0 && (
                  <ItemChoiceGroup
                    title="Destek Eşyası"
                    items={items.support}
                    names={itemNames}
                    divider={starters.length > 0}
                  />
                )}
                {items.boots.length > 0 && (
                  <ItemChoiceGroup
                    title="Çizme Tercihleri"
                    items={items.boots}
                    names={itemNames}
                    divider={starters.length > 0 || items.support.length > 0}
                  />
                )}
                {!starters.length && !items.boots.length && !items.support.length && (
                  <ComingSoon>Başlangıç verisi henüz yok.</ComingSoon>
                )}
              </div>
            </Section>
        </div>
        </div>
      </Panel>

      {/*
        EŞYA SIRASI — build bir LİSTE değil bir YOL; sütunlar ok'larla bağlanıp
        okuma yönü veriliyor. Her sütunda en sık tercih büyük kartta, alternatifler
        altında küçük satırlarda → hangisinin "asıl yol" olduğu bir bakışta belli.
        Yüzdenin yanında MAÇ SAYISI da var: örneklem görünmeden orana güvenilmez.
      */}
      <Panel>
        <Section
          title="Eşya Sırası"
          extra={<span className="text-[10px] text-gray-400">Tamamlanma sırasına göre · WR · seçim · maç</span>}
        >
          {itemSlots.length > 0 ? (
            <div className="flex items-stretch gap-1.5 overflow-x-auto pb-1">
              {itemSlots.map(({ n, list }, idx) => (
                <Fragment key={n}>
                  {idx > 0 && (
                    <div className="shrink-0 flex items-center text-gray-700" aria-hidden>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-[150px]">
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 text-center">
                      {n}. Eşya
                    </div>
                    <ItemPrimary it={list[0]} version={version} names={itemNames} />
                    {list.length > 1 && (
                      <div className="mt-1.5 space-y-1">
                        {list.slice(1, 3).map((it) => (
                          <ItemAlt key={it.key} it={it} version={version} names={itemNames} />
                        ))}
                      </div>
                    )}
                  </div>
                </Fragment>
              ))}
            </div>
          ) : (
            <div>
              <span className="text-[11px] text-gray-400 font-medium block mb-1.5">Çekirdek</span>
              <ItemRow items={items.core} />
            </div>
          )}
        </Section>

        {/*
          Tam build AYNI panelde: "hangi sırayla" ile "sonuçta ne çıkıyor" aynı
          sorunun iki yarısı.
          İki bölüm ARTIK YAN YANA DEĞİL, alt alta ve tam genişlikte yayılıyor:
          yan yana konunca ikisi de dar kalıp ikonlar küçücük sıkışıyordu ve
          aralarındaki ilişki ("şu 6'lı çıkıyor, şunlar duruma göre eklenir")
          okunmuyordu. Her eşya kendi kutusunda, ADIYLA birlikte.
        */}
        <Section title="Tam Build" extra={<span className="text-[10px] text-gray-400">Seçim oranına göre · WR</span>}>
          <div className="space-y-4">
            <div>
              <span className="text-[11px] text-gray-400 font-medium block mb-2">En Sık Tamamlanan</span>
              {items.full.length ? (
                <ItemCardRow items={items.full} />
              ) : (
                <ComingSoon>Item verisi henüz birikmedi.</ComingSoon>
              )}
            </div>
            {items.situational.length > 0 && (
              <div className="pt-3 border-t border-edge/40">
                <span className="text-[11px] text-gray-400 font-medium block mb-2">
                  Duruma Göre
                  <span className="text-gray-400 font-normal ml-1.5">— maça göre çekirdek build'in yerine girer</span>
                </span>
                <ItemCardRow items={items.situational} />
              </div>
            )}
          </div>
        </Section>
      </Panel>

      {/* En iyi oyuncular — iki ayrı sıralama (ustalık / ladder), kendi kartlarında */}
      <ChampionTopPlayers players={build?.topPlayers} version={version} championName={champion.name} />

      {/* Kapsam bilgisi — üstte kendi başına bir şerit gibi durup ayrı kart izlenimi
          veriyordu; dipnot olarak burası doğru yeri. */}
      <p className="text-[11px] text-gray-400 text-center pt-1">
        Tüm veriler Emerald+ dereceli maçlardan derlenir · Patch {(build.patches || []).join(" + ")}
      </p>
    </div>
  );
}

/* Slotun ASIL tercihi — vurgulu kart (ince mavi kenar + büyük ikon + örneklem).
   Eşya ADI yazılı: ikondan hangi eşya olduğunu çıkarmak oyunu bilmeyene imkânsız. */
function ItemPrimary({ it, version, names = {} }) {
  if (!it) return null;
  const name = names[String(it.key)];
  return (
    <div className="rounded-lg bg-edge/30 border border-blue-400/25 p-2.5 text-center" title={name || undefined}>
      <img
        src={itemIcon(version, it.key)}
        alt={name || ""}
        width={46}
        height={46}
        className="rounded-lg border border-edge mx-auto"
        onError={hideOnError}
      />
      {name && (
        <div className="text-[10px] text-gray-300 mt-1.5 leading-tight line-clamp-2 min-h-[24px]">{name}</div>
      )}
      <div className={`text-base font-bold mt-1.5 leading-none ${wrCls(it.winRate)}`}>{it.winRate}%</div>
      <div className="text-[10px] text-gray-500 mt-1.5 leading-none">
        {it.pickRate}% seçim
      </div>
      <div className="text-[10px] text-gray-400 mt-1 leading-none tabular-nums">{(it.games ?? 0).toLocaleString("tr-TR")} maç</div>
    </div>
  );
}

/*
  Aynı slottaki alternatifler. Önce 24px ikon + 9px yazıyla neredeyse görünmüyorlardı;
  alternatif de bir KARAR (ör. rakip komposuna göre 3. eşya değişir), okunacak kadar
  büyük olmalı — ama asıl tercihle karışmayacak kadar da sade.
*/
function ItemAlt({ it, version, names = {} }) {
  const name = names[String(it.key)];
  return (
    <div
      className="flex items-center gap-2 rounded-md bg-edge/25 border border-edge/40 px-2 py-1.5 transition-colors hover:bg-edge/40"
      title={`${name ? name + " — " : ""}${it.games} maç · %${it.pickRate} seçim · %${it.winRate} kazanma`}
    >
      <img
        src={itemIcon(version, it.key)}
        alt={name || ""}
        width={30}
        height={30}
        className="rounded-md border border-edge shrink-0"
        onError={hideOnError}
      />
      <span className="text-[10px] text-gray-400 truncate min-w-0 flex-1">{name || "—"}</span>
      <span className={`text-xs font-bold shrink-0 ${wrCls(it.winRate)}`}>{it.winRate}%</span>
    </div>
  );
}

/* Üst özet barındaki tek istatistik hücresi — EŞİT genişlik (flex-1) + ayraç. */
function StripStat({ value, label, valueCls = "text-gray-100" }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center border-l border-edge/40 px-2 min-w-0">
      <span className={`text-lg md:text-xl font-bold leading-none ${valueCls}`}>{value}</span>
      <span className="text-[10px] text-gray-500 mt-1.5 whitespace-nowrap">{label}</span>
    </div>
  );
}

function StatStrip({ pos, roleLabel }) {
  if (!pos) return null;
  const g = pos.grade;
  return (
    <div className="px-4 md:px-6 py-3.5 flex items-stretch">
      <div className="flex items-center gap-3 pr-4 md:pr-6 shrink-0">
        <span className="text-4xl md:text-5xl font-extrabold leading-none" style={{ color: gradeColor(g) || "#6b7280" }}>{g || "—"}</span>
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">derece</span>
      </div>
      <StripStat value={pos.rank ? `${pos.rank}/${pos.total}` : "—"} label={`${roleLabel} sırası`} />
      <StripStat value={`${pos.winRate}%`} label="kazanma oranı" valueCls={wrCls(pos.winRate)} />
      <StripStat value={pos.pickRate != null ? `${pos.pickRate}%` : "—"} label="seçim oranı" />
      <StripStat value={pos.banRate != null ? `${pos.banRate}%` : "—"} label="yasaklanma oranı" />
      <StripStat value={(pos.games ?? 0).toLocaleString("tr-TR")} label="oyunlar" />
    </div>
  );
}

/*
  Yetenek sırası satırı (Q>W>E gerçek yetenek görselleriyle).
  Satır tam genişliğe yayılır ve ikonlar büyüktür: dar bir kümede sola yapışınca
  sütunun sağ yarısı boş kalıyordu.
*/
function SkillOrderRow({ o, champion, big }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-edge/20 border border-edge/40 px-3 py-2">
      <div className="flex items-center gap-2.5">
        {String(o.key).split(">").map((L, i, arr) => (
          <Fragment key={i}>
            <div className="relative">
              <img src={champion.spells?.[SPELL_IDX[L]]?.image} alt={L}
                width={big ? 46 : 38} height={big ? 46 : 38}
                className={`rounded-lg border ${big ? "border-blue-500/50" : "border-edge opacity-80"}`} onError={hideOnError} />
              <span className="absolute -bottom-1.5 -right-1.5 text-[9px] font-bold bg-[#0a0e14] border border-edge rounded px-1 text-blue-300">{L}</span>
            </div>
            {i < arr.length - 1 && <span className="text-gray-400 text-sm">›</span>}
          </Fragment>
        ))}
      </div>
      <div className="text-right shrink-0">
        <div className={`text-sm font-bold leading-none ${wrCls(o.winRate)}`}>{o.winRate}%</div>
        <div className="text-[10px] text-gray-500 mt-1 leading-none">{o.pickRate}% seçim</div>
      </div>
    </div>
  );
}

/* Başlangıç eşya satırı (aynı eşyadan çok alınmışsa ×N) — yetenek sırası
   satırlarıyla aynı kutu dili, tam genişlikte. */
function StarterRow({ s, version }) {
  const counts = {};
  String(s.key).split("-").forEach((id) => { counts[id] = (counts[id] || 0) + 1; });
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-edge/20 border border-edge/40 px-3 py-2">
      <div className="flex items-center gap-2">
        {Object.entries(counts).map(([id, n]) => (
          <div key={id} className="relative">
            <img src={itemIcon(version, id)} alt="" width={40} height={40} className="rounded-md border border-edge" onError={hideOnError} />
            {n > 1 && <span className="absolute -bottom-1 -right-1 text-[9px] font-bold bg-[#0a0e14] border border-edge rounded px-0.5 text-gray-300">×{n}</span>}
          </div>
        ))}
      </div>
      <div className="text-right shrink-0">
        <div className={`text-sm font-bold leading-none ${wrCls(s.winRate)}`}>{s.winRate}%</div>
        <div className="text-[10px] text-gray-500 mt-1 leading-none">{s.pickRate}% seçim</div>
      </div>
    </div>
  );
}

/*
  Eşya kutuları — isim + kazanma + seçim. Çıplak ikon şeridi ("ItemRow") yalnız
  yüzdeyi taşıyordu ve hangi eşya olduğu belli olmuyordu; bu kutular tam genişliğe
  eşit yayılır, dar ekranda sarar.
*/
function ItemCardRow({ items }) {
  return (
    <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((it, i) => (
        <div
          key={i}
          className="rounded-lg bg-edge/20 border border-edge/40 p-2 flex items-center gap-2.5 transition-colors hover:bg-edge/35"
          title={`${it.name || ""} — %${it.pickRate} seçim · %${it.winRate} kazanma`}
        >
          <img src={it.icon} alt={it.name || ""} width={38} height={38}
            className="rounded-md border border-edge shrink-0" onError={hideOnError} />
          <div className="min-w-0">
            <div className="text-[10px] text-gray-300 leading-tight line-clamp-2">{it.name || "—"}</div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className={`text-xs font-bold leading-none ${wrCls(it.winRate)}`}>{it.winRate}%</span>
              <span className="text-[10px] text-gray-500 leading-none">{it.pickRate}%</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ItemRow({ items, size = 36 }) {
  return (
    <div className="flex items-start gap-1.5 flex-wrap">
      {items.map((it, i) => (
        <div key={i} className="flex flex-col items-center" style={{ width: size + 6 }}>
          <img src={it.icon} alt="" width={size} height={size} className="rounded-md border border-edge" onError={hideOnError}
            title={`${it.pickRate}% pick · ${it.winRate}% WR`} />
          <span className="text-[9px] text-gray-500 mt-0.5 leading-none">{it.pickRate}%</span>
        </div>
      ))}
    </div>
  );
}

function RuneTree({ tree, selected, pctOf, skipKeystone }) {
  if (!tree) return null;
  const slots = skipKeystone ? tree.slots.slice(1) : tree.slots;
  // Seçilen keystone'un adı — ağacın altında yazılı olmasa ziyaretçi ikondan
  // hangi ana rünün önerildiğini çıkaramıyordu.
  const keyName = !skipKeystone
    ? tree.slots?.[0]?.runes?.find((r) => selected.has(r.id))?.name
    : null;

  return (
    <div className="w-full flex flex-col items-center gap-3">
      <div className="flex flex-col items-center gap-1 mb-1">
        <div className="flex items-center gap-2">
          <img src={runeIcon(tree.icon)} alt="" width={24} height={24} onError={hideOnError} />
          <span className="text-sm font-semibold text-gray-300">{TREE_TR[tree.key] || tree.key}</span>
        </div>
        {keyName && <span className="text-[10px] text-blue-300/80">{keyName}</span>}
      </div>
      {slots.map((slot, i) => {
        const isKeystoneRow = !skipKeystone && i === 0;
        return (
          <div key={i} className="flex items-start justify-center gap-2.5">
            {slot.runes.map((r) => (
              <RuneDot key={r.id} src={runeIcon(r.icon)} on={selected.has(r.id)}
                size={isKeystoneRow ? 52 : 38} title={r.name}
                pct={pctOf ? pctOf[r.id] : undefined} withLabel={!!pctOf} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function RuneDot({ src, on, size = 28, title, pct, withLabel = false }) {
  const img = (
    <img src={src} alt={title || ""} title={pct != null ? `${title} · ${pct}%` : title || ""}
      width={size} height={size} onError={hideOnError}
      // Seçili rün hafifçe büyür + halka/parıltı alır; seçilmeyen üzerine gelince
      // biraz canlanır (tamamen ölü durmasın, ama dikkati de dağıtmasın).
      className={`rounded-full transition-all duration-200 ${
        on ? "hover:scale-110" : "grayscale opacity-25 hover:opacity-50"
      }`}
      style={on ? { boxShadow: "0 0 0 2px rgba(96,165,250,.85), 0 0 14px -2px rgba(96,165,250,.55)" } : undefined} />
  );
  if (!withLabel) return img;
  return (
    <div className="flex flex-col items-center" style={{ width: size + 6 }}>
      {img}
      <span className={`text-[10px] mt-0.5 leading-none ${on ? "text-blue-300 font-semibold" : "text-gray-400"}`}>
        {pct != null ? `${pct}%` : " "}
      </span>
    </div>
  );
}
