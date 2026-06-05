"use client";

import { useState, useMemo } from "react";
import { buildChampionData, buildMatchups, pickRunePage, runeIcon, shardIcon, TREE_TR, SHARD_ROWS } from "@/lib/buildData";

const ROLE_LABELS = { TOP: "Top", JUNGLE: "Jungle", MIDDLE: "Mid", BOTTOM: "ADC", SUPPORT: "Support" };
const ROLE_ICON = { TOP: "/roles/top.svg", JUNGLE: "/roles/jungle.svg", MIDDLE: "/roles/mid.svg", BOTTOM: "/roles/bot.svg", SUPPORT: "/roles/support.svg" };

const hideOnError = (e) => { e.currentTarget.style.visibility = "hidden"; };
const wrCls = (wr) => (wr >= 52 ? "text-emerald-400" : wr >= 49 ? "text-gray-200" : "text-red-400");

function ItemRow({ items, size = 32 }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {items.map((it, i) => (
        <img key={i} src={it.icon || it} alt={it.name || ""} width={size} height={size}
          className="rounded-md border border-edge" onError={hideOnError} title={it.name || ""} />
      ))}
    </div>
  );
}

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

export default function ChampionBuild({ champion, version, championList = [], runesData = [] }) {
  const positions = champion.positions?.length ? champion.positions : ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "SUPPORT"];
  const [role, setRole] = useState(positions[0]);

  const data = useMemo(() => buildChampionData(champion, role, version, championList), [champion, role, version, championList]);
  const matchups = useMemo(() => buildMatchups(champion, role, championList, version), [champion, role, championList, version]);
  const runePage = useMemo(() => pickRunePage(champion, role, runesData), [champion, role, runesData]);

  const phases = [
    { label: "Başlangıç", items: data.starter, time: "@ 0:00" },
    { label: "Ayakkabı", items: data.boots, time: "@ 4:00" },
    { label: "Çekirdek", items: data.core, time: "@ 21:00" },
  ];

  return (
    <div className="space-y-4">
      {/* Filtre çubuğu */}
      <div className="glass rounded-xl px-4 py-3 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          {positions.map((p) => (
            <button key={p} onClick={() => setRole(p)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                role === p ? "bg-blue-500/15 text-blue-300" : "text-gray-400 hover:text-gray-200 hover:bg-white/5"}`}>
              <img src={ROLE_ICON[p]} alt={ROLE_LABELS[p]} width={16} height={16} className={role === p ? "" : "opacity-70"} />
              {ROLE_LABELS[p]}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 text-[11px]">
          <span className="px-2.5 py-1 rounded-md bg-edge/60 text-gray-400">Emerald +</span>
          <span className="px-2.5 py-1 rounded-md bg-edge/60 text-gray-400">Patch {version}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* SOL — Önerilen buildler + Top players + Matchup (tek kart) */}
        <Panel className="lg:col-span-3">
          <Section title="Önerilen Buildler" extra={<span className="text-[10px] text-gray-600">WR</span>}>
            <div className="space-y-2">
              {data.builds.map((b, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/[0.03]">
                  <ItemRow items={b.items} size={24} />
                  <div className="ml-auto text-right">
                    <p className="text-[11px] text-gray-300 leading-tight">{b.name}</p>
                    <p className={`text-xs font-bold ${wrCls(b.wr)}`}>{b.wr}%</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="En İyi Oyuncular">
            <div className="space-y-2">
              {data.topPlayers.map((p, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <span className="text-[11px] text-gray-600 w-3">{i + 1}</span>
                  <img src={p.icon} alt="" width={28} height={28} className="rounded-md" onError={hideOnError} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-200 truncate">{p.name}</p>
                    <p className="text-[10px] text-gray-500">{p.games} maç</p>
                  </div>
                  <span className={`text-xs font-bold ${wrCls(p.wr)}`}>{p.wr}%</span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Eşleşmeler (Matchup)">
            <MatchupCol label="İyi Eşleşmeler" rows={matchups.easy} good />
            <div className="my-3 border-t border-edge/40" />
            <MatchupCol label="Zor Eşleşmeler" rows={matchups.hard} />
          </Section>
        </Panel>

        {/* ORTA — Rünler + Yetenek sırası (tek kart) */}
        <Panel className="lg:col-span-5">
          <Section title="Rünler" extra={<span className="text-[10px] text-gray-600">En popüler · {data.builds[0]?.wr}% WR</span>}>
            {runePage ? (
              <div className="flex gap-6 justify-center">
                <RuneTree tree={runePage.primary} selected={runePage.selected} />
                <div className="border-l border-edge/40 pl-6 flex flex-col items-center gap-3">
                  <RuneTree tree={runePage.secondary} selected={runePage.selected} skipKeystone />
                  <div className="flex flex-col items-center gap-2 pt-3 mt-1 border-t border-edge/40">
                    {SHARD_ROWS.map((row, ri) => (
                      <div key={ri} className="flex items-center gap-2">
                        {row.map((sh, ci) => (
                          <RuneDot key={ci} src={shardIcon(sh.icon)} on={runePage.shardSel[ri] === ci} size={20} title={sh.name} />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-600 text-center py-6">Rün verisi yüklenemedi</p>
            )}
          </Section>

          <Section title="Yetenek Sırası" extra={
            <span className="text-[11px] text-gray-400">
              Max: {data.abilityOrder.maxFirst.map((k, i) => (
                <span key={i}>{i > 0 && <span className="text-gray-600 mx-0.5">›</span>}<b className="text-gray-200">{k}</b></span>
              ))}
            </span>
          }>
            <AbilityGrid order={data.abilityOrder.order} spells={champion.spells} />
          </Section>
        </Panel>

        {/* SAĞ — Sihirdar büyüleri + Itemler (tek kart) */}
        <Panel className="lg:col-span-4">
          <Section title="Sihirdar Büyüleri">
            <div className="flex items-center gap-2">
              {data.spells.map((s, i) => (
                <img key={i} src={s} alt="" width={40} height={40} className="rounded-lg border border-edge" onError={hideOnError} />
              ))}
            </div>
          </Section>

          <Section title="Itemler">
            <div className="space-y-4">
              {phases.map((ph) => (
                <div key={ph.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] text-gray-400 font-medium">{ph.label}</span>
                    <span className="text-[10px] text-gray-600">{ph.time}</span>
                  </div>
                  <ItemRow items={ph.items} />
                </div>
              ))}
              <div className="pt-3 border-t border-edge/40">
                <span className="text-[11px] text-gray-400 font-medium block mb-1.5">Tam Build</span>
                <ItemRow items={data.full} />
              </div>
              <div>
                <span className="text-[11px] text-gray-400 font-medium block mb-1.5">Duruma Göre</span>
                <ItemRow items={data.situational} size={28} />
              </div>
            </div>
          </Section>
        </Panel>
      </div>
    </div>
  );
}

function MatchupCol({ label, rows, good }) {
  return (
    <div>
      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">{label}</p>
      <div className="space-y-1.5">
        {rows.map((m, i) => (
          <div key={i} className="flex items-center gap-2">
            <img src={m.icon} alt={m.name} width={26} height={26} className="rounded-md" onError={hideOnError} />
            <span className="text-xs text-gray-300 flex-1 truncate">{m.name}</span>
            <span className={`text-xs font-bold ${good ? "text-emerald-400" : "text-red-400"}`}>{m.wr}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AbilityGrid({ order, spells = [] }) {
  const rows = ["Q", "W", "E", "R"];
  const keyColor = {
    Q: "bg-blue-500/25 text-blue-300", W: "bg-green-500/25 text-green-300",
    E: "bg-purple-500/25 text-purple-300", R: "bg-red-500/25 text-red-300",
  };
  return (
    <div className="overflow-x-auto">
      <div className="inline-block">
        {/* Seviye başlıkları */}
        <div className="flex gap-0.5 mb-1" style={{ paddingLeft: 36 }}>
          {order.map((_, i) => (
            <span key={i} className="w-5 text-center text-[8px] text-gray-600">{i + 1}</span>
          ))}
        </div>
        {rows.map((r, ri) => (
          <div key={r} className="flex gap-0.5 items-center mb-1">
            {/* Yetenek görseli (Q/W/E/R harfi yerine gerçek skill ikonu) */}
            <div className="relative w-7 h-7 flex-shrink-0">
              {spells[ri]?.image ? (
                <img src={spells[ri].image} alt={r} width={28} height={28}
                  className="rounded border border-edge" onError={hideOnError} />
              ) : (
                <span className={`w-7 h-7 flex items-center justify-center text-[11px] font-bold rounded ${keyColor[r]}`}>{r}</span>
              )}
              <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 flex items-center justify-center text-[8px] font-bold rounded ${keyColor[r]}`}>{r}</span>
            </div>
            <span className="w-1.5" />
            {order.map((lvl, i) => (
              <span key={i}
                className={`w-5 h-5 rounded text-center text-[9px] flex items-center justify-center ${
                  lvl === r ? `${keyColor[r]} font-bold` : "bg-edge/40"}`}>
                {lvl === r ? r : ""}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* Tam rün ağacı — tüm rünler gösterilir, seçili (önerilen) olanlar vurgulu. */
function RuneTree({ tree, selected, skipKeystone }) {
  if (!tree) return null;
  const slots = skipKeystone ? tree.slots.slice(1) : tree.slots;
  return (
    <div className="flex flex-col items-center gap-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <img src={runeIcon(tree.icon)} alt="" width={20} height={20} onError={hideOnError} />
        <span className="text-xs font-semibold text-gray-300">{TREE_TR[tree.key] || tree.key}</span>
      </div>
      {slots.map((slot, i) => {
        const isKeystoneRow = !skipKeystone && i === 0;
        return (
          <div key={i} className="flex items-center justify-center gap-2">
            {slot.runes.map((r) => (
              <RuneDot key={r.id} src={runeIcon(r.icon)} on={selected.has(r.id)} size={isKeystoneRow ? 36 : 28} title={r.name} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function RuneDot({ src, on, size = 28, title }) {
  return (
    <img
      src={src}
      alt={title || ""}
      title={title || ""}
      width={size}
      height={size}
      onError={hideOnError}
      className={`rounded-full transition ${on ? "" : "grayscale opacity-25"}`}
      style={on ? { boxShadow: "0 0 0 2px rgba(96,165,250,.85)" } : undefined}
    />
  );
}
