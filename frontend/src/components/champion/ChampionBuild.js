"use client";

import { Fragment, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { pickRealRunePage, groupRealItems, itemIcon, profileIcon, runeIcon, runeIconById, shardIcon, TREE_TR, SHARD_ROWS } from "@/lib/buildData";
import { gradeCls } from "@/components/champion/gradeStyle";

const ROLE_LABELS = { TOP: "Top", JUNGLE: "Jungle", MIDDLE: "Mid", BOTTOM: "ADC", UTILITY: "Support", SUPPORT: "Support" };
const ROLE_SHARE_LABEL = {
  TOP: "Üst Koridorda Oynanma", JUNGLE: "Ormanda Oynanma", MIDDLE: "Orta Koridorda Oynanma",
  BOTTOM: "Alt Koridorda Oynanma", UTILITY: "Destekte Oynanma", SUPPORT: "Destekte Oynanma",
};
const ROLE_ICON = {
  TOP: "/roles/top.svg", JUNGLE: "/roles/jungle.svg", MIDDLE: "/roles/mid.svg",
  BOTTOM: "/roles/bot.svg", UTILITY: "/roles/support.svg", SUPPORT: "/roles/support.svg",
};

const hideOnError = (e) => { e.currentTarget.style.visibility = "hidden"; };
const wrCls = (wr) => (wr >= 52 ? "text-blue-300" : wr >= 49 ? "text-gray-200" : "text-red-400");
// Derece renkleri gradeStyle.js'te (tek kaynak) — şampiyon ikonu çerçevesi de aynısını kullanır.
const SPELL_IDX = { Q: 0, W: 1, E: 2, R: 3 };
const TL_MIN_SAMPLE = 20;

function Panel({ children, className = "" }) {
  return (
    <div className={`glass rounded-xl overflow-hidden divide-y divide-edge/40 ${className}`}>
      {children}
    </div>
  );
}

function Section({ title, extra, children }) {
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">{title}</h3>
        {extra}
      </div>
      {children}
    </div>
  );
}

function ComingSoon({ children }) {
  return <p className="text-[11px] text-gray-600 leading-relaxed py-2">{children}</p>;
}

/*
  Gerçek veriyle build içeriği (Genel tabı) — TEK sayfada rün + eşya + büyü + yetenek.
  build = backend /champions/{id} yanıtındaki `build`. Yalnız gerçekten oynanan
  koridorlar rol seçiminde çıkar. Veri yoksa dürüst boş durum; sahte veri YOK.
*/
export default function ChampionBuild({ champion, version, runesData = [], build }) {
  const positions = build?.positions || [];
  const params = useSearchParams();
  const urlRole = params.get("role");
  const [role, setRole] = useState(
    positions.some((p) => p.position === urlRole) ? urlRole : positions[0]?.position
  );
  const [pageIdx, setPageIdx] = useState(0);

  const selectRole = (p) => {
    setRole(p);
    setPageIdx(0);
    const url = new URL(window.location.href);
    if (p === positions[0]?.position) url.searchParams.delete("role");
    else url.searchParams.set("role", p);
    window.history.replaceState(null, "", url);
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
  const items = useMemo(() => groupRealItems(cats.item_full, version), [cats, version]);
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
      {/* Üst özet kartı: derece + statlar (eşit bölünmüş) + rol/patch — TEK kart */}
      <div className="glass rounded-xl overflow-hidden">
        <StatStrip pos={posInfo} roleLabel={ROLE_LABELS[role] || role} />
        {/*
          Bağlam satırı — bilerek İNCE. Rol seçici YALNIZ birden fazla rolde çıkar:
          tek rollü şampiyonda (ör. Samira %99 ADC) o buton yeni bilgi taşımıyor —
          rol zaten hero rozetinde ve stat şeridinin etiketinde yazıyor — ama koca
          bir satır harcıyordu.
        */}
        <div className="border-t border-edge/40 px-4 py-1.5 flex items-center gap-2 flex-wrap">
          {positions.length > 1 && (
            <div className="flex items-center gap-1">
              {positions.map((p) => (
                <button key={p.position} onClick={() => selectRole(p.position)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                    role === p.position ? "bg-blue-500/15 text-blue-300" : "text-gray-400 hover:text-gray-200 hover:bg-hover"}`}>
                  <img src={ROLE_ICON[p.position]} alt="" width={14} height={14} className={role === p.position ? "" : "opacity-70"} />
                  {ROLE_LABELS[p.position] || p.position}
                  <span className="text-[10px] text-gray-500">{p.share}%</span>
                </button>
              ))}
            </div>
          )}
          <div className="ml-auto flex items-center gap-1.5 text-[10px] text-gray-500">
            {lowSample && (
              <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">Düşük örneklem</span>
            )}
            <span>Emerald +</span>
            <span className="text-gray-700">·</span>
            <span>Patch {(build.patches || []).join(" + ")}</span>
          </div>
        </div>
      </div>

      {/*
        DÜZEN NOTU: eskiden 3-6-3 sütun vardı ve sağ sütun (sihirdar + başlangıç + çizme +
        1-5. item + tam build + duruma göre) tıka basa doluyken sol sütun neredeyse boştu;
        sayfanın alt yarısı da bomboş kalıyordu. Artık içerik YATAY bölümlere açıldı:
        her panel genişliğini içeriğine göre alıyor, item sırası tam genişlikte nefes alıyor.
      */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* SOL — Rünler (sayfanın ana içeriği, en geniş alan) */}
        <Panel className="lg:col-span-8">
          <Section title="Rünler" extra={
            activeKeystone && (
              <span className="text-[10px] text-gray-600">
                {safeIdx === 0 ? "En popüler" : `${safeIdx + 1}. seçenek`} · {activeKeystone.pickRate}% pick · <b className={wrCls(activeKeystone.winRate)}>{activeKeystone.winRate}% WR</b>
              </span>
            )
          }>
            {runePage ? (
              <>
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-3">
                  <div className="flex justify-center">
                    <RuneTree tree={runePage.primary} selected={runePage.selected} pctOf={runePage.pctOf} />
                  </div>
                  <div className="flex justify-center md:border-x border-edge/40 md:px-2">
                    <RuneTree tree={runePage.secondary} selected={runePage.selected} pctOf={runePage.pctOf} skipKeystone />
                  </div>
                  <div className="flex flex-col items-center gap-3">
                    <span className="text-sm font-semibold text-gray-300 mb-1.5">İstatistik Parçaları</span>
                    {SHARD_ROWS.map((row, ri) => (
                      <div key={ri} className="flex items-center gap-3">
                        {row.map((sh, ci) => (
                          <RuneDot key={ci} src={shardIcon(sh.icon)} on={runePage.shardSel[ri] === ci} size={30} title={sh.name} />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <ComingSoon>Bu koridor için rün verisi henüz birikmedi.</ComingSoon>
            )}
          </Section>

        </Panel>

        {/*
          SAĞ — TEK panel, üç bölüm. Önce ayrı kartlardaydılar ama her biri az içerikli
          olduğu için (2 sihirdar çifti, 2 yetenek sırası) kart başına düşen boşluk
          içerikten fazlaydı. Panel'in divide-y'ı bölümleri zaten ayırıyor; tek çerçeve
          hem daha derli toplu hem soldaki rün paneliyle yükseklik dengesi kuruyor.
        */}
        <Panel className="lg:col-span-4">
            <Section title="Sihirdar Büyüleri" extra={<span className="text-[10px] text-gray-600">WR · Seçim</span>}>
              {spellPairs.length ? (
                <div className="grid grid-cols-2 gap-2">
                  {spellPairs.slice(0, 4).map((sp) => {
                    const icons = String(sp.key).split("-").map((sid) => build?.spellMap?.[sid]).filter(Boolean);
                    if (!icons.length) return null;
                    return (
                      <div key={sp.key} className="rounded-lg bg-edge/30 border border-edge/50 p-2.5 text-center">
                        <div className="flex items-center justify-center gap-1.5 mb-2">
                          {icons.map((s, i) => (
                            <img key={i} src={s.image} alt={s.name} title={s.name}
                              width={36} height={36} className="rounded-lg border border-edge" onError={hideOnError} />
                          ))}
                        </div>
                        <div className={`text-sm font-bold leading-none ${wrCls(sp.winRate)}`}>{sp.winRate}%</div>
                        <div className="text-[10px] text-gray-500 mt-1">{sp.pickRate}% seçim</div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <ComingSoon>Büyü verisi henüz yok.</ComingSoon>
              )}
            </Section>

            <Section title="Yetenek Sırası" extra={<span className="text-[10px] text-gray-600">Seçim · WR</span>}>
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

            <Section title="Başlangıç & Çizme" extra={<span className="text-[10px] text-gray-600">WR · Seçim</span>}>
              <div className="space-y-3">
                {starters.length > 0 && (
                  <div className="space-y-2">
                    {starters.slice(0, 2).map((s) => (
                      <StarterRow key={s.key} s={s} version={version} />
                    ))}
                  </div>
                )}
                {items.boots.length > 0 && (
                  <div className={starters.length ? "pt-3 border-t border-edge/40" : ""}>
                    <span className="text-[11px] text-gray-400 font-medium block mb-2">Çizme Tercihleri</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {items.boots.map((b, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-md bg-edge/25 border border-edge/40 px-2 py-1.5"
                          title={`%${b.pickRate} seçim · %${b.winRate} kazanma`}>
                          <img src={b.icon} alt="" width={30} height={30}
                            className="rounded-md border border-edge shrink-0" onError={hideOnError} />
                          <div className="min-w-0">
                            <div className={`text-xs font-bold leading-none ${wrCls(b.winRate)}`}>{b.winRate}%</div>
                            <div className="text-[10px] text-gray-500 mt-1 leading-none">{b.pickRate}%</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {!starters.length && !items.boots.length && <ComingSoon>Başlangıç verisi henüz yok.</ComingSoon>}
              </div>
            </Section>
        </Panel>
      </div>

      {/*
        EŞYA SIRASI — build bir LİSTE değil bir YOL; sütunlar ok'larla bağlanıp
        okuma yönü veriliyor. Her sütunda en sık tercih büyük kartta, alternatifler
        altında küçük satırlarda → hangisinin "asıl yol" olduğu bir bakışta belli.
        Yüzdenin yanında MAÇ SAYISI da var: örneklem görünmeden orana güvenilmez.
      */}
      <Panel>
        <Section
          title="Eşya Sırası"
          extra={<span className="text-[10px] text-gray-600">Tamamlanma sırasına göre · WR · seçim · maç</span>}
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
                  <div className="flex-1 min-w-[138px]">
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 text-center">
                      {n}. Eşya
                    </div>
                    <ItemPrimary it={list[0]} version={version} />
                    {list.length > 1 && (
                      <div className="mt-1.5 space-y-1">
                        {list.slice(1, 4).map((it) => (
                          <ItemAlt key={it.key} it={it} version={version} />
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
      </Panel>

      {/* En iyi oyuncular + tam build + duruma göre */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <Panel className="lg:col-span-5">
          <Section title={`En İyi ${champion.name} Oyuncuları`} extra={<span className="text-[10px] text-gray-600">Maç · WR</span>}>
            <TopPlayers players={build?.topPlayers} version={version} />
          </Section>
        </Panel>

        <Panel className="lg:col-span-7">
          <Section title="Tam Build" extra={<span className="text-[10px] text-gray-600">En sık tamamlanan</span>}>
            <div className="space-y-4">
              <ItemRow items={items.full} />
              {items.situational.length > 0 && (
                <div className="pt-3 border-t border-edge/40">
                  <span className="text-[11px] text-gray-400 font-medium block mb-1.5">Duruma Göre</span>
                  <ItemRow items={items.situational} size={28} />
                </div>
              )}
              {!items.full.length && <ComingSoon>Item verisi henüz birikmedi.</ComingSoon>}
            </div>
          </Section>
        </Panel>
      </div>
    </div>
  );
}

/* Slotun ASIL tercihi — vurgulu kart (ince mavi kenar + büyük ikon + örneklem). */
function ItemPrimary({ it, version }) {
  if (!it) return null;
  return (
    <div className="rounded-lg bg-edge/30 border border-blue-400/25 p-2.5 text-center">
      <img
        src={itemIcon(version, it.key)}
        alt=""
        width={46}
        height={46}
        className="rounded-lg border border-edge mx-auto"
        onError={hideOnError}
      />
      <div className={`text-base font-bold mt-2 leading-none ${wrCls(it.winRate)}`}>{it.winRate}%</div>
      <div className="text-[10px] text-gray-500 mt-1.5 leading-none">
        {it.pickRate}% seçim
      </div>
      <div className="text-[10px] text-gray-600 mt-1 leading-none tabular-nums">{(it.games ?? 0).toLocaleString("tr-TR")} maç</div>
    </div>
  );
}

/*
  Aynı slottaki alternatifler. Önce 24px ikon + 9px yazıyla neredeyse görünmüyorlardı;
  alternatif de bir KARAR (ör. rakip komposuna göre 3. eşya değişir), okunacak kadar
  büyük olmalı — ama asıl tercihle karışmayacak kadar da sade.
*/
function ItemAlt({ it, version }) {
  return (
    <div
      className="flex items-center gap-2 rounded-md bg-edge/25 border border-edge/40 px-2 py-1.5 transition-colors hover:bg-edge/40"
      title={`${it.games} maç · %${it.pickRate} seçim · %${it.winRate} kazanma`}
    >
      <img
        src={itemIcon(version, it.key)}
        alt=""
        width={32}
        height={32}
        className="rounded-md border border-edge shrink-0"
        onError={hideOnError}
      />
      <span className={`text-xs font-bold ${wrCls(it.winRate)}`}>{it.winRate}%</span>
      <span className="text-[10px] text-gray-500 ml-auto tabular-nums">{it.pickRate}%</span>
    </div>
  );
}

/*
  Şampiyonun en çok oynayan oyuncuları (champion_top_players). Profil sayfalarına
  iç link verir — hem kullanıcı için gezinme hem site içi bağlantı değeri.
*/
function TopPlayers({ players, version }) {
  if (!players?.length) {
    return <ComingSoon>Bu şampiyon için henüz yeterli oyuncu verisi toplanmadı.</ComingSoon>;
  }
  return (
    <div className="space-y-1.5">
      {players.map((p, i) => (
        <Link
          key={`${p.name}-${p.tag}`}
          href={`/summoner/${encodeURIComponent(p.name)}/${encodeURIComponent(p.tag || "")}`}
          className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-hover transition-colors"
          title={`${p.name}#${p.tag} — ${p.games} maç`}
        >
          <span className="text-[10px] font-bold text-gray-600 w-3 text-center shrink-0">{i + 1}</span>
          {p.profileIconId != null ? (
            <img src={profileIcon(version, p.profileIconId)} alt="" width={26} height={26}
              className="rounded-md border border-edge shrink-0" onError={hideOnError} />
          ) : (
            <span className="w-[26px] h-[26px] rounded-md bg-edge/50 border border-edge shrink-0" />
          )}
          <span className="text-xs text-gray-200 truncate flex-1 min-w-0">{p.name}</span>
          {p.tier && (
            <span className="text-[10px] text-gray-500 shrink-0 hidden sm:inline">
              {p.tier.charAt(0) + p.tier.slice(1).toLowerCase()}{p.rank ? ` ${p.rank}` : ""}
            </span>
          )}
          <span className="text-[10px] text-gray-500 tabular-nums shrink-0">{p.games}</span>
          <span className={`text-xs font-bold tabular-nums w-11 text-right shrink-0 ${wrCls(p.winRate)}`}>{p.winRate}%</span>
        </Link>
      ))}
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
        <span className={`text-4xl md:text-5xl font-extrabold leading-none ${gradeCls(g)}`}>{g || "—"}</span>
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

/* Yetenek sırası satırı (Q>W>E gerçek yetenek görselleriyle). */
function SkillOrderRow({ o, champion, big }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        {String(o.key).split(">").map((L, i, arr) => (
          <Fragment key={i}>
            <div className="relative">
              <img src={champion.spells?.[SPELL_IDX[L]]?.image} alt={L}
                width={big ? 40 : 32} height={big ? 40 : 32}
                className={`rounded-lg border ${big ? "border-blue-500/50" : "border-edge opacity-80"}`} onError={hideOnError} />
              <span className="absolute -bottom-1.5 -right-1.5 text-[9px] font-bold bg-[#0a0e14] border border-edge rounded px-1 text-blue-300">{L}</span>
            </div>
            {i < arr.length - 1 && <span className="text-gray-600 text-sm">›</span>}
          </Fragment>
        ))}
      </div>
      <span className="text-xs text-gray-400 ml-auto">{o.pickRate}%</span>
      <span className={`text-sm font-bold ${wrCls(o.winRate)}`}>{o.winRate}%</span>
    </div>
  );
}

/* Başlangıç eşya satırı (aynı eşyadan çok alınmışsa ×N). */
function StarterRow({ s, version }) {
  const counts = {};
  String(s.key).split("-").forEach((id) => { counts[id] = (counts[id] || 0) + 1; });
  return (
    <div className="flex items-center gap-2">
      {Object.entries(counts).map(([id, n]) => (
        <div key={id} className="relative">
          <img src={itemIcon(version, id)} alt="" width={32} height={32} className="rounded-md border border-edge" onError={hideOnError} />
          {n > 1 && <span className="absolute -bottom-1 -right-1 text-[9px] font-bold bg-[#0a0e14] border border-edge rounded px-0.5 text-gray-300">×{n}</span>}
        </div>
      ))}
      <span className="text-xs text-gray-400 ml-auto">{s.pickRate}%</span>
      <span className={`text-xs font-bold ${wrCls(s.winRate)}`}>{s.winRate}%</span>
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
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-2 mb-1.5">
        <img src={runeIcon(tree.icon)} alt="" width={22} height={22} onError={hideOnError} />
        <span className="text-sm font-semibold text-gray-300">{TREE_TR[tree.key] || tree.key}</span>
      </div>
      {slots.map((slot, i) => {
        const isKeystoneRow = !skipKeystone && i === 0;
        return (
          <div key={i} className="flex items-start justify-center gap-2.5">
            {slot.runes.map((r) => (
              <RuneDot key={r.id} src={runeIcon(r.icon)} on={selected.has(r.id)}
                size={isKeystoneRow ? 44 : 33} title={r.name}
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
      <span className={`text-[10px] mt-0.5 leading-none ${on ? "text-blue-300 font-semibold" : "text-gray-600"}`}>
        {pct != null ? `${pct}%` : " "}
      </span>
    </div>
  );
}
