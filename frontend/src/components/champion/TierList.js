"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { TIER_ROLES, TIER_META, TIER_ORDER } from "@/lib/tierData";

const TIER_RANK = { "S+": 0, S: 1, A: 2, B: 3, C: 4, D: 5 };
const ROLE_LABEL = Object.fromEntries(TIER_ROLES.map((r) => [r.key, r.label]));
const ROLE_ICON = Object.fromEntries(TIER_ROLES.filter((r) => r.icon).map((r) => [r.key, r.icon]));

function wrColor(wr) {
  if (wr >= 53) return "text-cyan-400";
  if (wr >= 50) return "text-blue-400";
  if (wr >= 48) return "text-gray-200";
  return "text-red-400";
}

// Bir şampiyonun oynandığı koridorların dağılımı (laneShare, yüksekten düşüğe).
// ALL "rolü" gerçek koridor değil (toplam) → dağılımdan hariç.
function laneDistribution(roles) {
  return Object.entries(roles)
    .filter(([pos]) => pos !== "ALL")
    .map(([pos, r]) => ({ pos, label: ROLE_LABEL[pos] || pos, share: r.laneShare }))
    .sort((a, b) => b.share - a.share);
}

// Koridor hücresi: rol simgesi + altında %. Tümü'de baskın 2 koridor, tek rolde o koridor.
function LaneCell({ c, role }) {
  const dist = role === "ALL" ? laneDistribution(c.roles).slice(0, 2) : [{ pos: role, share: c.rs.laneShare }];
  return (
    <div className="flex items-center gap-3">
      {dist.map((d) => (
        <span key={d.pos} className="inline-flex flex-col items-center gap-0.5" title={d.label}>
          {ROLE_ICON[d.pos] && <img src={ROLE_ICON[d.pos]} alt={d.label} width={18} height={18} className="opacity-90" />}
          <span className="tabular-nums text-[10px] text-gray-500">%{d.share}</span>
        </span>
      ))}
    </div>
  );
}

// Sıralanabilir sütun başlığı. 3 durum: iyiden-kötüye → kötüden-iyiye → default.
function SortHeader({ col, label, sort, onSort, align = "right" }) {
  const active = sort.col === col;
  const arrow = active ? (sort.dir === "good" ? "▾" : "▴") : "↕";
  return (
    <th
      onClick={() => onSort(col)}
      className={`px-3 py-3 text-${align} text-[11px] font-semibold uppercase tracking-wider cursor-pointer select-none transition-colors ${
        active ? "text-blue-300" : "text-gray-500 hover:text-gray-300"
      }`}
      title="Sırala (iyiden kötüye → kötüden iyiye → varsayılan)"
    >
      <span className="inline-flex items-center gap-1">
        {align !== "left" && <span className="text-[10px] opacity-70">{arrow}</span>}
        {label}
        {align === "left" && <span className="text-[10px] opacity-70">{arrow}</span>}
      </span>
    </th>
  );
}

/* Öne çıkan satır — S tier şampiyonları arasında otomatik döner (panelin iç bölümü). */
function FeaturedSlider({ pool, role, version, patch }) {
  const [fi, setFi] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = pool.length;

  useEffect(() => { setFi(0); }, [role, total]);
  useEffect(() => {
    if (paused || total <= 1) return;
    const id = setInterval(() => setFi((p) => (p + 1) % total), 4000);
    return () => clearInterval(id);
  }, [paused, total]);

  const f = pool[fi];
  if (!f) return null;
  const roleLabel = ROLE_LABEL[role];
  const meta = TIER_META[f.rs.tier];

  return (
    <div
      className="p-5 flex items-start gap-5 relative border-b border-edge/60"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: meta?.color }} />
      <Link href={`/champions/${f.id}`} className="relative flex-shrink-0">
        <img src={f.image} alt={f.name} width={76} height={76} className="rounded-xl" key={f.id} />
        <span className="absolute -top-2 -right-2 px-1.5 h-6 min-w-6 rounded-full text-[#0a0e14] text-xs font-extrabold flex items-center justify-center shadow-lg" style={{ background: meta?.color }}>
          {f.rs.tier}
        </span>
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-lg font-bold text-white">{f.name}</h2>
          <span className="text-xs text-gray-500">· {roleLabel} · Patch {version || patch}</span>
        </div>
        <p className="text-sm text-gray-400 leading-relaxed">
          <span className="text-gray-200 font-semibold">{f.name}</span>, topladığımız maçlarda {role === "ALL" ? "tüm koridorlarda" : `${roleLabel} koridorunun`}
          {" "}en güçlü seçimlerinden. %{f.rs.wr} kazanma ve %{f.rs.pick} seçilme oranıyla bu yamada öne çıkıyor
          {f.rs.lowSample ? " (henüz düşük örneklem)" : ""}.
        </p>
        {total > 1 && (
          <div className="flex items-center gap-1.5 mt-3">
            {pool.map((p, idx) => (
              <button
                key={p.id}
                onClick={() => setFi(idx)}
                aria-label={p.name}
                title={p.name}
                className="h-1.5 rounded-full transition-all"
                style={{ width: idx === fi ? 22 : 8, background: idx === fi ? meta?.color : "var(--edge, #2a3441)" }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TierList({ data }) {
  const champions = data?.champions || [];
  const version = data?.version;
  const patch = data?.patch;
  const totalGames = data?.totalGames || 0;

  const [role, setRole] = useState("ALL");
  const [sort, setSort] = useState({ col: null, dir: "good" });

  function toggleSort(col) {
    setSort((s) => {
      if (s.col !== col) return { col, dir: "good" };
      if (s.dir === "good") return { col, dir: "bad" };
      return { col: null, dir: "good" };
    });
  }

  const inRole = useMemo(() => {
    return champions
      .filter((c) => c.roles && c.roles[role])
      .map((c) => ({ ...c, rs: c.roles[role] }))
      .sort((a, b) => {
        const t = (TIER_RANK[a.rs.tier] ?? 9) - (TIER_RANK[b.rs.tier] ?? 9);
        return t !== 0 ? t : (b.rs.adjWr ?? b.rs.wr) - (a.rs.adjWr ?? a.rs.wr);
      });
  }, [champions, role]);

  const sTierPool = useMemo(() => {
    const s = inRole.filter((c) => c.rs.tier === "S+" || c.rs.tier === "S");
    return s.length ? s : inRole.slice(0, 5);
  }, [inRole]);

  const rows = useMemo(() => {
    if (!sort.col) return inRole;
    const arr = [...inRole];
    arr.sort((a, b) => {
      let cmp;
      if (sort.col === "tier") cmp = (TIER_RANK[a.rs.tier] ?? 9) - (TIER_RANK[b.rs.tier] ?? 9);
      else cmp = (b.rs[sort.col] ?? 0) - (a.rs[sort.col] ?? 0);
      return sort.dir === "good" ? cmp : -cmp;
    });
    return arr;
  }, [inRole, sort]);

  return (
    <div className="glass rounded-xl overflow-hidden">
      {/* Filtre çubuğu */}
      <div className="px-4 py-3 flex items-center gap-2 flex-wrap border-b border-edge/60 bg-edge/10">
        <div className="flex items-center gap-1.5">
          {TIER_ROLES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRole(r.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                role === r.key ? "bg-blue-500/15 text-blue-300" : "text-gray-400 hover:text-gray-200 hover:bg-hover"
              }`}
            >
              {r.icon && <img src={r.icon} alt={r.label} width={16} height={16} className={role === r.key ? "" : "opacity-70"} />}
              {r.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 text-[11px]">
          <span className="px-2.5 py-1 rounded-md bg-edge/60 text-gray-400" title="Topladığımız maçlardan. Production key + ladder crawler ile Emerald+ filtresi gelecek.">
            {totalGames.toLocaleString("tr-TR")} maç
          </span>
          <span className="px-2.5 py-1 rounded-md bg-edge/60 text-gray-400">Ranked Solo/Flex</span>
          <span className="px-2.5 py-1 rounded-md bg-edge/60 text-gray-400">Patch {version || patch}</span>
        </div>
      </div>

      {/* Öne çıkan slider (S tier'lar arası) */}
      {sTierPool.length > 0 && <FeaturedSlider pool={sTierPool} role={role} version={version} patch={patch} />}

      {/* Tier tablosu */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-edge/60 bg-edge/15">
              <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 w-12">#</th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Şampiyon</th>
              <SortHeader col="tier" label="Derece" sort={sort} onSort={toggleSort} align="left" />
              <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Koridor</th>
              <SortHeader col="wr" label="Kazanma" sort={sort} onSort={toggleSort} />
              <SortHeader col="pick" label="Seçilme" sort={sort} onSort={toggleSort} />
              <SortHeader col="ban" label="Banlanma" sort={sort} onSort={toggleSort} />
              <SortHeader col="games" label="Maç" sort={sort} onSort={toggleSort} />
            </tr>
          </thead>
          <tbody>
            {rows.map((c, idx) => {
              const meta = TIER_META[c.rs.tier];
              return (
                <tr key={c.id} className="border-b border-edge/30 last:border-0 hover:bg-hover/60 transition-colors">
                  <td className="py-2.5 pl-3 pr-2 text-gray-500 tabular-nums text-center" style={{ boxShadow: `inset 3px 0 0 ${meta?.color}` }}>
                    {idx + 1}
                  </td>
                  <td className="px-3 py-2.5">
                    <Link href={`/champions/${c.id}`} className="flex items-center gap-3 group">
                      <img src={c.image} alt={c.name} width={46} height={46} className={`rounded-lg ${c.rs.lowSample ? "opacity-60" : ""}`} />
                      <div className="min-w-0">
                        <span className="font-semibold text-gray-100 group-hover:text-white transition-colors block leading-tight">{c.name}</span>
                        {c.rs.lowSample && <span className="text-[10px] text-amber-500/70" title={`Düşük örneklem (${c.rs.games} maç)`}>az veri</span>}
                      </div>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-extrabold text-base" style={{ color: meta?.color }}>{c.rs.tier}</span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap"><LaneCell c={c} role={role} /></td>
                  <td className={`px-3 py-2.5 text-right font-bold tabular-nums ${wrColor(c.rs.wr)}`}>%{c.rs.wr}</td>
                  <td className="px-3 py-2.5 text-right text-gray-300 tabular-nums">%{c.rs.pick}</td>
                  <td className="px-3 py-2.5 text-right text-gray-300 tabular-nums">%{c.rs.ban}</td>
                  <td className="px-3 py-2.5 text-right text-gray-200 font-medium tabular-nums">{c.rs.games.toLocaleString("tr-TR")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <p className="text-center text-sm text-gray-600 py-6">Bu koridor için henüz yeterli maç verisi yok.</p>
      )}
    </div>
  );
}
