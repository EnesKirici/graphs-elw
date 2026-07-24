"use client";

import { Fragment, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { pickRealRunePage, groupRealItems, itemIcon, runeIcon, runeIconById, shardIcon, TREE_TR, SHARD_ROWS } from "@/lib/buildData";

const ROLE_LABELS = { TOP: "Top", JUNGLE: "Jungle", MIDDLE: "Mid", BOTTOM: "ADC", UTILITY: "Support", SUPPORT: "Support" };
// "Koridor Payı" yerine role özgü, okunur etiket (TR ekleri yüzünden hazır map).
const ROLE_SHARE_LABEL = {
  TOP: "Üst Koridorda Oynanma", JUNGLE: "Ormanda Oynanma", MIDDLE: "Orta Koridorda Oynanma",
  BOTTOM: "Alt Koridorda Oynanma", UTILITY: "Destekte Oynanma", SUPPORT: "Destekte Oynanma",
};
const ROLE_ICON = {
  TOP: "/roles/top.svg", JUNGLE: "/roles/jungle.svg", MIDDLE: "/roles/mid.svg",
  BOTTOM: "/roles/bot.svg", UTILITY: "/roles/support.svg", SUPPORT: "/roles/support.svg",
};

const hideOnError = (e) => { e.currentTarget.style.visibility = "hidden"; };
// Site paleti: yeşil kullanmıyoruz — iyi WR mavi (profil sayfasıyla aynı dil), kötü kırmızı.
const wrCls = (wr) => (wr >= 52 ? "text-blue-300" : wr >= 49 ? "text-gray-200" : "text-red-400");
// "Q>E>W" harfleri → şampiyonun gerçek yetenek görselleri (champion.spells sırası Q,W,E,R)
const SPELL_IDX = { Q: 0, W: 1, E: 2, R: 3 };
// Timeline istatistikleri bu örneklemin altındayken gösterilmez (yanıltıcı olur)
const TL_MIN_SAMPLE = 20;

// Birleşik kart (tek glass kutu) — içine birden çok Section gelir, divide-y ile ayrılır.
function Panel({ children, className = "" }) {
  return (
    <div className={`glass rounded-xl overflow-hidden divide-y divide-edge/40 ${className}`}>
      {children}
    </div>
  );
}

// Kart içi bölüm (alt başlık + içerik).
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
  Gerçek veriyle build sayfası. build = backend /champions/{id} yanıtındaki `build`:
  { patches, totalGames, positions:[{position,games,winRate,share}], byPosition:{POS:{
    keystone,rune_minor,shard,spell_pair,item_full: [{key,games,wins,winRate,pickRate}]}},
    spellMap:{id:{name,image}}, topPlayers:[{name,tag,games,winRate}] }
  Yalnız gerçekten oynanan koridorlar sekme olur (backend eşiği) — ör. Locke'ta
  Support görünmez. Veri yoksa dürüst boş durum gösterilir; sahte veri YOK.
*/
export default function ChampionBuild({ champion, version, runesData = [], build }) {
  const positions = build?.positions || [];
  const params = useSearchParams();
  const urlRole = params.get("role");
  const [role, setRole] = useState(
    positions.some((p) => p.position === urlRole) ? urlRole : positions[0]?.position
  );
  const [pageIdx, setPageIdx] = useState(0); // seçili rün sayfası (0 = en popüler keystone)

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

  // Rün sayfası seçenekleri (1. / 2. / 3.) — yalnız ağaçta karşılığı olan keystone'lar.
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

  // Hiç oynanma verisi yok → dürüst boş durum (sahte build göstermeyiz).
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
      {/* Filtre çubuğu — yalnız GERÇEKTEN oynanan koridorlar */}
      <div className="glass rounded-xl px-4 py-3 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          {positions.map((p) => (
            <button key={p.position} onClick={() => selectRole(p.position)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                role === p.position ? "bg-blue-500/15 text-blue-300" : "text-gray-400 hover:text-gray-200 hover:bg-hover"}`}>
              <img src={ROLE_ICON[p.position]} alt={ROLE_LABELS[p.position]} width={16} height={16} className={role === p.position ? "" : "opacity-70"} />
              {ROLE_LABELS[p.position] || p.position}
              <span className="text-[10px] text-gray-500">{p.share}%</span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 text-[11px]">
          {lowSample && (
            <span className="px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Düşük örneklem
            </span>
          )}
          <span className="px-2.5 py-1 rounded-md bg-edge/60 text-gray-400">Emerald +</span>
          <span className="px-2.5 py-1 rounded-md bg-edge/60 text-gray-400">
            Patch {(build.patches || []).join(" + ")}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* SOL — Koridor özeti + popüler itemler + top players (tek kart) */}
        <Panel className="lg:col-span-3">
          <Section title={`${ROLE_LABELS[role] || role} Performansı`}>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg bg-edge/40 py-2.5">
                <p className={`text-lg font-bold ${wrCls(posInfo?.winRate || 0)}`}>{posInfo?.winRate}%</p>
                <p className="text-[10px] text-gray-500 mt-0.5">Win Rate</p>
              </div>
              <div className="rounded-lg bg-edge/40 py-2.5">
                <p className="text-lg font-bold text-gray-200">{posInfo?.share}%</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{ROLE_SHARE_LABEL[role] || "Rolde Oynanma"}</p>
              </div>
            </div>
            {build.overview && (
              <div className="grid grid-cols-3 gap-2 text-center mt-2">
                <div className="rounded-lg bg-edge/25 py-2">
                  <p className="text-[13px] font-bold text-gray-200">{build.overview.pickRate}%</p>
                  <p className="text-[9px] text-gray-500 mt-0.5">Pick</p>
                </div>
                <div className="rounded-lg bg-edge/25 py-2">
                  <p className="text-[13px] font-bold text-gray-200">{build.overview.banRate}%</p>
                  <p className="text-[9px] text-gray-500 mt-0.5">Ban</p>
                </div>
                <div className="rounded-lg bg-edge/25 py-2">
                  <p className="text-[13px] font-bold text-gray-200">{posInfo?.games}</p>
                  <p className="text-[9px] text-gray-500 mt-0.5">Maç</p>
                </div>
              </div>
            )}
          </Section>

          <Section title="En Popüler Itemler" extra={<span className="text-[10px] text-gray-600">Pick · WR</span>}>
            <div className="space-y-2">
              {(cats.item_full || []).slice(0, 5).map((it) => (
                <div key={it.key} className="flex items-center gap-2.5 p-1 rounded-lg hover:bg-hover">
                  <img src={itemIcon(version, it.key)}
                    alt="" width={28} height={28} className="rounded-md border border-edge" onError={hideOnError} />
                  <span className="text-[11px] text-gray-400 flex-1">{it.pickRate}%</span>
                  <span className={`text-xs font-bold ${wrCls(it.winRate)}`}>{it.winRate}%</span>
                </div>
              ))}
              {!(cats.item_full || []).length && <ComingSoon>Bu koridor için item verisi henüz yok.</ComingSoon>}
            </div>
          </Section>

          {/* "En İyi Oyuncular" ŞİMDİLİK gizli — WR yerine gerçek sıralama sistemi
              (championRank, PROFILE_RANKINGS_PLAN) bağlanınca geri gelecek.
              Backend topPlayers alanı (profileIconId/tier/rank dahil) hazır bekliyor. */}
        </Panel>

        {/* ORTA — Rünler (tek kart) */}
        <Panel className="lg:col-span-6">
          <Section title="Rünler" extra={
            activeKeystone && (
              <span className="text-[10px] text-gray-600">
                {safeIdx === 0 ? "En popüler" : `${safeIdx + 1}. seçenek`} · {activeKeystone.pickRate}% pick · <b className={wrCls(activeKeystone.winRate)}>{activeKeystone.winRate}% WR</b>
              </span>
            )
          }>
            {runePage ? (
              <>
                {/* Rün sayfası seçenekleri: 1. en popüler + 2./3. alternatif keystone'lar */}
                {keystoneOptions.length > 1 && (
                  <div className="flex items-center justify-center gap-2 mb-4">
                    {keystoneOptions.map((k, i) => (
                      <button
                        key={k.key}
                        onClick={() => setPageIdx(i)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] transition-colors cursor-pointer ${
                          i === safeIdx
                            ? "border-blue-500/60 bg-blue-500/10 text-blue-200"
                            : "border-edge/60 text-gray-400 hover:text-gray-200 hover:bg-hover"
                        }`}
                        title={`${i + 1}. seçenek`}
                      >
                        <span className="text-gray-500">{i + 1}.</span>
                        <img src={runeIconById(runesData, Number(k.key))} alt="" width={22} height={22} className="rounded-full" onError={hideOnError} />
                        <span>{k.pickRate}%</span>
                        <span className={`font-bold ${wrCls(k.winRate)}`}>{k.winRate}%</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex gap-8 justify-center">
                  <RuneTree tree={runePage.primary} selected={runePage.selected} pctOf={runePage.pctOf} />
                  <div className="border-l border-edge/40 pl-8 flex flex-col items-center gap-4">
                    <RuneTree tree={runePage.secondary} selected={runePage.selected} pctOf={runePage.pctOf} skipKeystone />
                    <div className="flex flex-col items-center gap-2.5 pt-4 mt-1 border-t border-edge/40">
                      {SHARD_ROWS.map((row, ri) => (
                        <div key={ri} className="flex items-center gap-2.5">
                          {row.map((sh, ci) => (
                            <RuneDot key={ci} src={shardIcon(sh.icon)} on={runePage.shardSel[ri] === ci} size={24} title={sh.name} />
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <ComingSoon>Bu koridor için rün verisi henüz birikmedi.</ComingSoon>
            )}
          </Section>

          <Section title="Yetenek Sırası" extra={<span className="text-[10px] text-gray-600">Pick · WR</span>}>
            {skillOrders.length ? (
              <div className="space-y-3">
                {skillOrders.slice(0, 2).map((o, idx) => (
                  <div key={o.key} className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      {String(o.key).split(">").map((L, i, arr) => (
                        <Fragment key={i}>
                          <div className="relative">
                            <img src={champion.spells?.[SPELL_IDX[L]]?.image} alt={L}
                              width={idx === 0 ? 40 : 32} height={idx === 0 ? 40 : 32}
                              className={`rounded-lg border ${idx === 0 ? "border-blue-500/50" : "border-edge"} ${idx === 0 ? "" : "opacity-80"}`}
                              onError={hideOnError} />
                            <span className="absolute -bottom-1.5 -right-1.5 text-[9px] font-bold bg-[#0a0e14] border border-edge rounded px-1 text-blue-300">
                              {L}
                            </span>
                          </div>
                          {i < arr.length - 1 && <span className="text-gray-600 text-sm">›</span>}
                        </Fragment>
                      ))}
                    </div>
                    <span className="text-xs text-gray-400 ml-auto">{o.pickRate}%</span>
                    <span className={`text-sm font-bold ${wrCls(o.winRate)}`}>{o.winRate}%</span>
                  </div>
                ))}
              </div>
            ) : (
              <ComingSoon>
                Yetenek sırası istatistikleri toplanıyor — worker maç timeline&apos;larını
                işledikçe burada gerçek verilerle görünecek
                {(samples.skill_order || 0) > 0 ? ` (şu ana kadar ${samples.skill_order} maç işlendi)` : ""}.
              </ComingSoon>
            )}
          </Section>
        </Panel>

        {/* SAĞ — Sihirdar büyüleri + Itemler (tek kart) */}
        <Panel className="lg:col-span-3">
          <Section title="Sihirdar Büyüleri" extra={<span className="text-[10px] text-gray-600">Pick · WR</span>}>
            <div className="space-y-2.5">
              {spellPairs.map((sp, idx) => {
                const icons = String(sp.key).split("-").map((id) => build?.spellMap?.[id]).filter(Boolean);
                if (!icons.length) return null;
                return (
                  <div key={sp.key} className="flex items-center gap-2">
                    {icons.map((s, i) => (
                      <img key={i} src={s.image} alt={s.name} title={s.name}
                        width={idx === 0 ? 38 : 30} height={idx === 0 ? 38 : 30}
                        className={`rounded-lg border ${idx === 0 ? "border-edge" : "border-edge opacity-80"}`}
                        onError={hideOnError} />
                    ))}
                    <span className="text-xs text-gray-400 ml-auto">{sp.pickRate}%</span>
                    <span className={`text-sm font-bold ${wrCls(sp.winRate)}`}>{sp.winRate}%</span>
                  </div>
                );
              })}
              {!spellPairs.length && <ComingSoon>Büyü verisi henüz yok.</ComingSoon>}
            </div>
          </Section>

          <Section title="Itemler">
            <div className="space-y-4">
              {starters.length > 0 && (
                <div>
                  <span className="text-[11px] text-gray-400 font-medium block mb-1.5">Başlangıç</span>
                  <div className="space-y-2">
                    {starters.slice(0, 2).map((s) => {
                      // Aynı eşyadan birden çok alınmışsa (2× iksir gibi) tek ikon + ×N
                      const counts = {};
                      String(s.key).split("-").forEach((id) => { counts[id] = (counts[id] || 0) + 1; });
                      return (
                        <div key={s.key} className="flex items-center gap-2">
                          {Object.entries(counts).map(([id, n]) => (
                            <div key={id} className="relative">
                              <img src={itemIcon(version, id)} alt="" width={32} height={32}
                                className="rounded-md border border-edge" onError={hideOnError} />
                              {n > 1 && (
                                <span className="absolute -bottom-1 -right-1 text-[9px] font-bold bg-[#0a0e14] border border-edge rounded px-0.5 text-gray-300">
                                  ×{n}
                                </span>
                              )}
                            </div>
                          ))}
                          <span className="text-xs text-gray-400 ml-auto">{s.pickRate}%</span>
                          <span className={`text-xs font-bold ${wrCls(s.winRate)}`}>{s.winRate}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {items.boots.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] text-gray-400 font-medium">Ayakkabı</span>
                    <span className={`text-[10px] font-bold ${wrCls(items.boots[0].winRate)}`}>{items.boots[0].winRate}% WR</span>
                  </div>
                  <ItemRow items={items.boots} />
                </div>
              )}
              {itemSlots.length > 0 ? (
                /* Satın alma SIRASINA göre slot alternatifleri (timeline verisi) */
                <div className="space-y-3.5 pt-3 border-t border-edge/40">
                  {itemSlots.map(({ n, list }) => (
                    <div key={n} className="flex items-start gap-2.5">
                      <span className="text-[10px] text-gray-500 font-semibold w-10 shrink-0 mt-3">{n}. Item</span>
                      <div className="flex items-start gap-2 flex-wrap">
                        {list.slice(0, 4).map((it) => (
                          <div key={it.key} className="flex flex-col items-center w-[46px]">
                            <img src={itemIcon(version, it.key)} alt="" width={38} height={38}
                              className="rounded-md border border-edge" onError={hideOnError}
                              title={`${it.games} maç`} />
                            <span className={`text-[10px] font-bold mt-1 leading-none ${wrCls(it.winRate)}`}>{it.winRate}%</span>
                            <span className="text-[9px] text-gray-500 leading-tight mt-0.5">{it.pickRate}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  <span className="text-[11px] text-gray-400 font-medium block mb-1.5">Çekirdek</span>
                  <ItemRow items={items.core} />
                </div>
              )}
              <div className="pt-3 border-t border-edge/40">
                <span className="text-[11px] text-gray-400 font-medium block mb-1.5">Tam Build</span>
                <ItemRow items={items.full} />
              </div>
              {items.situational.length > 0 && (
                <div>
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

function ItemRow({ items, size = 36 }) {
  return (
    <div className="flex items-start gap-1.5 flex-wrap">
      {items.map((it, i) => (
        <div key={i} className="flex flex-col items-center" style={{ width: size + 6 }}>
          <img src={it.icon} alt="" width={size} height={size}
            className="rounded-md border border-edge" onError={hideOnError}
            title={`${it.pickRate}% pick · ${it.winRate}% WR`} />
          <span className="text-[9px] text-gray-500 mt-0.5 leading-none">{it.pickRate}%</span>
        </div>
      ))}
    </div>
  );
}

/* Tam rün ağacı — tüm rünler gösterilir, gerçek maçlarda en çok seçilenler vurgulu.
   pctOf verilirse oynanmış her rünün altında pick %'si yazar (dpm.lol tarzı). */
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

/* withLabel: ikon altında % satırı ayrılır (veri yoksa boş tutulur ki satır hizası bozulmasın). */
function RuneDot({ src, on, size = 28, title, pct, withLabel = false }) {
  const img = (
    <img
      src={src}
      alt={title || ""}
      title={pct != null ? `${title} · ${pct}%` : title || ""}
      width={size}
      height={size}
      onError={hideOnError}
      className={`rounded-full transition ${on ? "" : "grayscale opacity-25"}`}
      style={on ? { boxShadow: "0 0 0 2px rgba(96,165,250,.85)" } : undefined}
    />
  );
  if (!withLabel) return img;
  return (
    <div className="flex flex-col items-center" style={{ width: size + 6 }}>
      {img}
      <span className={`text-[10px] mt-0.5 leading-none ${on ? "text-blue-300 font-semibold" : "text-gray-600"}`}>
        {pct != null ? `${pct}%` : " "}
      </span>
    </div>
  );
}
