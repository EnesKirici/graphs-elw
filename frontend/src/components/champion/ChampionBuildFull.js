"use client";

import { Fragment, useMemo } from "react";
import { itemIcon, runeIconById, runeInfoById } from "@/lib/buildData";
import RoleSelector, { ROLE_LABELS } from "@/components/champion/RoleSelector";

/*
  "Build" sekmesi — GENİŞ build sayfası.

  İki farklı soruyu ayrı ayrı cevaplar:
  1) ÖNERİLEN BUILD — "en yüksek kazandıran ne?" Popülerlik değil, örneklem
     ağırlıklı kazanma oranı sıralar (aşağıdaki adjWR).
  2) TERCİHLER — "insanlar ne oynuyor?" Slot slot tüm seçenekler, seçim oranıyla.

  Bu ikisi BİLEREK ayrı: en çok tercih edilen çoğu zaman en yüksek kazandıran
  değildir (Akshan'da 1. eşya Kraken %47 seçim / %42.9 WR iken, Kibir %6.9 seçim /
  %54.5 WR). Tek listede sıralamak bu farkı gizliyordu.

  ADJWR (güven ağırlıklı kazanma oranı):
      adj = 50 + (wr − 50) × games / (games + K)
  Az maçlı uç değerleri %50'ye çeker. 8 maçta %75 kazanan bir eşya ham sıralamada
  başa geçer ama bu zar atışıdır; 300 maçta %53 kazanan gerçek bir üstünlüktür.
  K = 25: "yaklaşık 25 maç sonra veriye tam güven" demek. Aynı mantık site genelinde
  matchup sıralamasında da kullanılıyor (MATCHUP_CONF_K).
*/

const SPELL_IDX = { Q: 0, W: 1, E: 2, R: 3 };
const CONF_K = 25;
const MIN_GAMES = 8; // bunun altındaki seçenek "öneri" olamaz (tek maçlık %100'ler)
const TL_MIN_SAMPLE = 20;

const hideOnError = (e) => { e.currentTarget.style.visibility = "hidden"; };
const wrCls = (wr) => (wr >= 52 ? "text-blue-300" : wr >= 49 ? "text-gray-200" : "text-red-400");

const adjWR = (r) => 50 + ((r.winRate ?? 50) - 50) * ((r.games ?? 0) / ((r.games ?? 0) + CONF_K));

/** Listeden güven ağırlıklı en iyi seçeneği verir (yeterli örneklem yoksa null). */
function bestOf(list) {
  const ok = (list || []).filter((r) => (r.games ?? 0) >= MIN_GAMES);
  if (!ok.length) return null;
  return ok.reduce((a, b) => (adjWR(b) > adjWR(a) ? b : a));
}

function Panel({ title, extra, children, className = "" }) {
  return (
    <div className={`glass rounded-xl overflow-hidden ${className}`}>
      <div className="px-5 py-3.5 border-b border-edge/40 flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">{title}</h3>
        {extra}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

/*
  Tek eşya/seçenek kartı — BÜYÜK. Önce tablo satırlarıydı ve 28px ikonlarla
  okunmuyordu; build sayfasının işi tam da bunları göstermek.
*/
function OptionCard({ icon, name, sub, winRate, pickRate, games, highlight, badge }) {
  return (
    <div
      className={`relative rounded-xl border p-3 transition-colors ${
        highlight ? "bg-blue-500/[0.07] border-blue-400/30" : "bg-edge/20 border-edge/40 hover:bg-edge/35"
      }`}
      title={name}
    >
      {badge && (
        <span className="absolute -top-2 left-3 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/90 text-white">
          {badge}
        </span>
      )}
      <div className="flex items-center gap-3">
        {icon}
        <div className="min-w-0 flex-1">
          <div className="text-xs text-gray-200 leading-tight line-clamp-2">{name}</div>
          {sub && <div className="text-[10px] text-gray-600 mt-0.5 truncate">{sub}</div>}
        </div>
      </div>
      <div className="flex items-end justify-between mt-2.5 pt-2.5 border-t border-edge/30">
        <div>
          <div className={`text-lg font-bold leading-none ${wrCls(winRate)}`}>{winRate}%</div>
          <div className="text-[10px] text-gray-600 mt-1 leading-none">kazanma</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-300 tabular-nums leading-none">{pickRate}%</div>
          <div className="text-[10px] text-gray-600 mt-1 leading-none tabular-nums">
            {(games ?? 0).toLocaleString("tr-TR")} maç
          </div>
        </div>
      </div>
      {/* Seçim oranı barı — sayıya bakmadan baskınlık okunsun */}
      <div className="h-1 rounded-full bg-edge/60 overflow-hidden mt-2">
        <div className="h-full bg-blue-400/50" style={{ width: `${Math.min(pickRate, 100)}%` }} />
      </div>
    </div>
  );
}

const ItemIcon = ({ id, version, names, size = 44 }) => (
  <img
    src={itemIcon(version, id)}
    alt={names[String(id)] || ""}
    width={size}
    height={size}
    className="rounded-lg border border-edge shrink-0"
    onError={hideOnError}
  />
);

export default function ChampionBuildFull({ champion, version, runesData = [], build, role, onRole }) {
  const positions = build?.positions || [];
  const posInfo = positions.find((p) => p.position === role);
  const cats = build?.byPosition?.[role] || {};
  const names = build?.itemNames || {};
  const samples = cats._samples || {};

  const keystones = (cats.keystone || []).filter((k) => runeIconById(runesData, Number(k.key)));
  const spellPairs = cats.spell_pair || [];
  const skillOrders = ((samples.skill_order || 0) >= TL_MIN_SAMPLE && cats.skill_order) || [];
  const starters = ((samples.starter || 0) >= TL_MIN_SAMPLE && cats.starter) || [];
  const slots = (samples.item_slot1 || 0) >= TL_MIN_SAMPLE
    ? [1, 2, 3, 4, 5].map((n) => ({ n, list: cats[`item_slot${n}`] || [] })).filter((s) => s.list.length)
    : [];
  const fullItems = cats.item_full || [];

  // Önerilen build — her karar için güven ağırlıklı en iyi seçenek.
  const best = useMemo(() => ({
    keystone: bestOf(keystones),
    spell: bestOf(spellPairs),
    skill: bestOf(skillOrders),
    starter: bestOf(starters),
    slots: slots.map(({ n, list }) => ({ n, pick: bestOf(list) })).filter((s) => s.pick),
  }), [keystones, spellPairs, skillOrders, starters, slots]);

  const bestWR = useMemo(() => {
    const picks = [best.keystone, best.spell, best.skill, best.starter, ...best.slots.map((s) => s.pick)].filter(Boolean);
    if (!picks.length) return null;
    // Ağırlıklı ortalama: çok maçlı kararlar ortalamayı daha çok belirlesin.
    const g = picks.reduce((s, p) => s + (p.games || 0), 0);
    if (!g) return null;
    return Math.round((picks.reduce((s, p) => s + p.winRate * (p.games || 0), 0) / g) * 10) / 10;
  }, [best]);

  if (!positions.length) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <p className="text-sm text-gray-300 font-medium">Henüz yeterli maç verisi yok</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Başlık kartı — rol seçici + sayfanın ne olduğu */}
      <div className="glass rounded-xl overflow-hidden">
        <RoleSelector positions={positions} role={role} onRole={onRole} />
        <div className="px-5 py-3.5 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-[11px] text-gray-500 leading-relaxed max-w-3xl">
            <b className="text-gray-300">{champion.name}</b> · {ROLE_LABELS[role] || role} koridorunun tam build verisi.
            Üstte <b className="text-gray-300">önerilen</b> (en yüksek kazandıran) dizilim, altta
            <b className="text-gray-300"> tercihler</b> (insanların gerçekte ne oynadığı) ayrı ayrı duruyor —
            en popüler seçenek çoğu zaman en yüksek kazandıran değildir.
          </p>
          {posInfo && (
            <span className="text-[11px] text-gray-500 tabular-nums shrink-0">
              {(posInfo.games ?? 0).toLocaleString("tr-TR")} maç · %{posInfo.winRate} kazanma
            </span>
          )}
        </div>
      </div>

      {/* ÖNERİLEN BUILD */}
      {(best.keystone || best.slots.length > 0) && (
        <Panel
          title="Önerilen Build"
          extra={
            bestWR != null && (
              <span className="text-[10px] text-gray-500">
                Seçilen kararların ağırlıklı kazanma oranı <b className={wrCls(bestWR)}>%{bestWR}</b>
              </span>
            )
          }
        >
          <div className="space-y-4">
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Bu dizilim <b className="text-gray-300">popülerliğe değil kazanma oranına</b> göre seçildi; az maçlı uç
              değerlerin başa geçmemesi için örneklem ağırlığı uygulanır (en az {MIN_GAMES} maç şartı + güven katsayısı).
              Bu yüzden aşağıdaki &quot;en çok tercih edilen&quot; listesinden farklı olabilir.
            </p>

            {/* Eşya yolu */}
            {best.slots.length > 0 && (
              <div>
                <span className="text-[11px] text-gray-400 font-medium block mb-2">Eşya Yolu</span>
                <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
                  {best.starter && (
                    <>
                      <div className="min-w-[150px] flex-1">
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 text-center">
                          Başlangıç
                        </div>
                        <OptionCard
                          icon={
                            <div className="flex items-center gap-1 shrink-0">
                              {[...new Set(String(best.starter.key).split("-"))].map((id) => (
                                <ItemIcon key={id} id={id} version={version} names={names} size={34} />
                              ))}
                            </div>
                          }
                          name={String(best.starter.key).split("-").map((id) => names[id]).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(" + ")}
                          winRate={best.starter.winRate}
                          pickRate={best.starter.pickRate}
                          games={best.starter.games}
                          highlight
                        />
                      </div>
                      <Arrow />
                    </>
                  )}
                  {best.slots.map((s, i) => (
                    <Fragment key={s.n}>
                      {i > 0 && <Arrow />}
                      <div className="min-w-[150px] flex-1">
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 text-center">
                          {s.n}. Eşya
                        </div>
                        <OptionCard
                          icon={<ItemIcon id={s.pick.key} version={version} names={names} />}
                          name={names[String(s.pick.key)] || `#${s.pick.key}`}
                          winRate={s.pick.winRate}
                          pickRate={s.pick.pickRate}
                          games={s.pick.games}
                          highlight
                        />
                      </div>
                    </Fragment>
                  ))}
                </div>
              </div>
            )}

            {/* Rün + büyü + yetenek */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-edge/30">
              {best.keystone && (
                <div>
                  <span className="text-[11px] text-gray-400 font-medium block mb-2">Ana Rün</span>
                  <OptionCard
                    icon={
                      <img src={runeIconById(runesData, Number(best.keystone.key))} alt="" width={44} height={44}
                        className="rounded-full shrink-0" onError={hideOnError} />
                    }
                    name={runeInfoById(runesData, Number(best.keystone.key))?.name || `#${best.keystone.key}`}
                    sub={runeInfoById(runesData, Number(best.keystone.key))?.tree}
                    winRate={best.keystone.winRate}
                    pickRate={best.keystone.pickRate}
                    games={best.keystone.games}
                    highlight
                  />
                </div>
              )}
              {best.spell && (
                <div>
                  <span className="text-[11px] text-gray-400 font-medium block mb-2">Sihirdar Büyüsü</span>
                  <OptionCard
                    icon={
                      <div className="flex items-center gap-1 shrink-0">
                        {String(best.spell.key).split("-").map((sid) => build?.spellMap?.[sid]).filter(Boolean).map((s, i) => (
                          <img key={i} src={s.image} alt={s.name} width={34} height={34}
                            className="rounded-lg border border-edge" onError={hideOnError} />
                        ))}
                      </div>
                    }
                    name={String(best.spell.key).split("-").map((sid) => build?.spellMap?.[sid]?.name).filter(Boolean).join(" + ")}
                    winRate={best.spell.winRate}
                    pickRate={best.spell.pickRate}
                    games={best.spell.games}
                    highlight
                  />
                </div>
              )}
              {best.skill && (
                <div>
                  <span className="text-[11px] text-gray-400 font-medium block mb-2">Yetenek Önceliği</span>
                  <OptionCard
                    icon={
                      <div className="flex items-center gap-1 shrink-0">
                        {String(best.skill.key).split(">").map((L, i) => (
                          <div key={i} className="relative">
                            <img src={champion.spells?.[SPELL_IDX[L]]?.image} alt={L} width={30} height={30}
                              className="rounded-lg border border-edge" onError={hideOnError} />
                            <span className="absolute -bottom-1 -right-1 text-[8px] font-bold bg-[#0a0e14] border border-edge rounded px-0.5 text-blue-300">{L}</span>
                          </div>
                        ))}
                      </div>
                    }
                    name={String(best.skill.key).split(">").join(" › ")}
                    winRate={best.skill.winRate}
                    pickRate={best.skill.pickRate}
                    games={best.skill.games}
                    highlight
                  />
                </div>
              )}
            </div>
          </div>
        </Panel>
      )}

      {/* SLOT SLOT TERCİHLER */}
      {slots.map(({ n, list }) => (
        <Panel
          key={n}
          title={`${n}. Eşya Tercihleri`}
          extra={<span className="text-[10px] text-gray-600">{list.length} seçenek · kazanma · seçim · maç</span>}
        >
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {list.map((it, i) => (
              <OptionCard
                key={it.key}
                icon={<ItemIcon id={it.key} version={version} names={names} />}
                name={names[String(it.key)] || `#${it.key}`}
                winRate={it.winRate}
                pickRate={it.pickRate}
                games={it.games}
                badge={i === 0 ? "En popüler" : best.slots.find((s) => s.n === n)?.pick?.key === it.key ? "Önerilen" : null}
                highlight={best.slots.find((s) => s.n === n)?.pick?.key === it.key}
              />
            ))}
          </div>
        </Panel>
      ))}

      {/* RÜN / BÜYÜ / YETENEK / BAŞLANGIÇ — hepsi aynı kart dilinde */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Panel title="Ana Rün Tercihleri" extra={<span className="text-[10px] text-gray-600">Tüm oynanan keystone&apos;lar</span>}>
          {keystones.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {keystones.map((k, i) => {
                const info = runeInfoById(runesData, Number(k.key));
                return (
                  <OptionCard
                    key={k.key}
                    icon={<img src={runeIconById(runesData, Number(k.key))} alt="" width={44} height={44}
                      className="rounded-full shrink-0" onError={hideOnError} />}
                    name={info?.name || `#${k.key}`}
                    sub={info?.tree}
                    winRate={k.winRate}
                    pickRate={k.pickRate}
                    games={k.games}
                    badge={i === 0 ? "En popüler" : best.keystone?.key === k.key ? "Önerilen" : null}
                    highlight={best.keystone?.key === k.key}
                  />
                );
              })}
            </div>
          ) : (
            <p className="text-[11px] text-gray-600">Rün verisi yok.</p>
          )}
        </Panel>

        <Panel title="Sihirdar Büyüsü Tercihleri" extra={<span className="text-[10px] text-gray-600">Tüm kombinasyonlar</span>}>
          {spellPairs.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {spellPairs.map((sp, i) => {
                const icons = String(sp.key).split("-").map((sid) => build?.spellMap?.[sid]).filter(Boolean);
                return (
                  <OptionCard
                    key={sp.key}
                    icon={
                      <div className="flex items-center gap-1 shrink-0">
                        {icons.map((s, j) => (
                          <img key={j} src={s.image} alt={s.name} width={34} height={34}
                            className="rounded-lg border border-edge" onError={hideOnError} />
                        ))}
                      </div>
                    }
                    name={icons.map((s) => s.name).join(" + ")}
                    winRate={sp.winRate}
                    pickRate={sp.pickRate}
                    games={sp.games}
                    badge={i === 0 ? "En popüler" : best.spell?.key === sp.key ? "Önerilen" : null}
                    highlight={best.spell?.key === sp.key}
                  />
                );
              })}
            </div>
          ) : (
            <p className="text-[11px] text-gray-600">Büyü verisi yok.</p>
          )}
        </Panel>

        <Panel title="Yetenek Sırası Tercihleri" extra={<span className="text-[10px] text-gray-600">Maks öncelik</span>}>
          {skillOrders.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {skillOrders.map((o, i) => (
                <OptionCard
                  key={o.key}
                  icon={
                    <div className="flex items-center gap-1 shrink-0">
                      {String(o.key).split(">").map((L, j) => (
                        <div key={j} className="relative">
                          <img src={champion.spells?.[SPELL_IDX[L]]?.image} alt={L} width={30} height={30}
                            className="rounded-lg border border-edge" onError={hideOnError} />
                          <span className="absolute -bottom-1 -right-1 text-[8px] font-bold bg-[#0a0e14] border border-edge rounded px-0.5 text-blue-300">{L}</span>
                        </div>
                      ))}
                    </div>
                  }
                  name={String(o.key).split(">").join(" › ")}
                  winRate={o.winRate}
                  pickRate={o.pickRate}
                  games={o.games}
                  badge={i === 0 ? "En popüler" : best.skill?.key === o.key ? "Önerilen" : null}
                  highlight={best.skill?.key === o.key}
                />
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-gray-600">Yetenek sırası verisi toplanıyor.</p>
          )}
        </Panel>

        <Panel title="Başlangıç Eşyası Tercihleri" extra={<span className="text-[10px] text-gray-600">İlk satın alma</span>}>
          {starters.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {starters.map((s, i) => {
                const counts = {};
                String(s.key).split("-").forEach((id) => { counts[id] = (counts[id] || 0) + 1; });
                return (
                  <OptionCard
                    key={s.key}
                    icon={
                      <div className="flex items-center gap-1 shrink-0">
                        {Object.entries(counts).map(([id, c]) => (
                          <div key={id} className="relative">
                            <ItemIcon id={id} version={version} names={names} size={34} />
                            {c > 1 && (
                              <span className="absolute -bottom-1 -right-1 text-[8px] font-bold bg-[#0a0e14] border border-edge rounded px-0.5 text-gray-300">×{c}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    }
                    name={Object.keys(counts).map((id) => names[id]).filter(Boolean).join(" + ")}
                    winRate={s.winRate}
                    pickRate={s.pickRate}
                    games={s.games}
                    badge={i === 0 ? "En popüler" : best.starter?.key === s.key ? "Önerilen" : null}
                    highlight={best.starter?.key === s.key}
                  />
                );
              })}
            </div>
          ) : (
            <p className="text-[11px] text-gray-600">Başlangıç verisi toplanıyor.</p>
          )}
        </Panel>
      </div>

      <Panel title="Maç Sonu Envanteri" extra={<span className="text-[10px] text-gray-600">Maç bittiğinde çantada en sık bulunanlar</span>}>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3">
          {fullItems.map((it) => (
            <OptionCard
              key={it.key}
              icon={<ItemIcon id={it.key} version={version} names={names} size={38} />}
              name={names[String(it.key)] || `#${it.key}`}
              winRate={it.winRate}
              pickRate={it.pickRate}
              games={it.games}
            />
          ))}
        </div>
      </Panel>

      <p className="text-[11px] text-gray-600 text-center pt-1">
        Tüm veriler Emerald+ dereceli maçlardan derlenir · Patch {(build.patches || []).join(" + ")}
      </p>
    </div>
  );
}

function Arrow() {
  return (
    <div className="shrink-0 flex items-center text-gray-700 self-center" aria-hidden>
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
      </svg>
    </div>
  );
}
