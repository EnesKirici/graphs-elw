"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TIER_META, TIER_RANK, ROLE_ICON, ROLE_LABEL, wrTone, banTone, laneDistribution } from "@/lib/tierData";

/* Koridor hücresi: rol simgesi + altında %. Tümü'de baskın 2 koridor, tek rolde o koridor. */
function LaneCell({ c, role }) {
  const dist = role === "ALL" ? laneDistribution(c.roles).slice(0, 2) : [{ pos: role, share: c.rs.laneShare }];
  return (
    <div className="flex items-center gap-3">
      {dist.map((d) => (
        <span key={d.pos} className="inline-flex flex-col items-center gap-0.5" title={ROLE_LABEL[d.pos]}>
          {ROLE_ICON[d.pos] && <img src={ROLE_ICON[d.pos]} alt={ROLE_LABEL[d.pos]} width={18} height={18} className="opacity-90" />}
          <span className="tabular-nums text-[10px] text-gray-500">%{d.share}</span>
        </span>
      ))}
    </div>
  );
}

/* Sıralanabilir sütun başlığı. 3 durum: iyiden-kötüye → kötüden-iyiye → varsayılan. */
function SortHeader({ col, label, shortLabel, sort, onSort, align = "right", className = "" }) {
  const active = sort.col === col;
  const arrow = active ? (sort.dir === "good" ? "▾" : "▴") : "↕";
  const labelEl = shortLabel ? (
    <>
      <span className="sm:hidden">{shortLabel}</span>
      <span className="hidden sm:inline">{label}</span>
    </>
  ) : label;
  return (
    <th
      onClick={() => onSort(col)}
      className={`px-2 md:px-3 py-3 text-${align} text-[11px] font-semibold uppercase tracking-wider cursor-pointer select-none transition-colors ${
        active ? "tl-th-on" : "text-gray-500 hover:text-gray-300"
      } ${className}`}
      title="Sırala (iyiden kötüye → kötüden iyiye → varsayılan)"
    >
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        {align !== "left" && <span className="text-[10px] opacity-70">{arrow}</span>}
        {labelEl}
        {align === "left" && <span className="text-[10px] opacity-70">{arrow}</span>}
      </span>
    </th>
  );
}

export default function TierTable({ champs, role, initialSort = null }) {
  // initialSort: ana sayfadan gelen ?sort=wr|pick|ban isteği. Kullanıcı başlığa
  // tıklayınca kendi seçimi geçerli olur; buradaki yalnız açılış sırasıdır.
  const [sort, setSort] = useState({ col: initialSort, dir: "good" });

  useEffect(() => {
    if (initialSort) setSort({ col: initialSort, dir: "good" });
  }, [initialSort]);

  function toggleSort(col) {
    setSort((s) => {
      if (s.col !== col) return { col, dir: "good" };
      if (s.dir === "good") return { col, dir: "bad" };
      return { col: null, dir: "good" };
    });
  }

  const rows = useMemo(() => {
    if (!sort.col) return champs;
    const arr = [...champs];
    arr.sort((a, b) => {
      let cmp;
      if (sort.col === "tier") cmp = (TIER_RANK[a.rs.tier] ?? 9) - (TIER_RANK[b.rs.tier] ?? 9);
      else cmp = (b.rs[sort.col] ?? 0) - (a.rs[sort.col] ?? 0);
      return sort.dir === "good" ? cmp : -cmp;
    });
    return arr;
  }, [champs, sort]);

  if (rows.length === 0) {
    return <p className="text-center text-sm text-gray-600 py-8">Bu koridor için henüz yeterli maç verisi yok.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="tl-thead">
            {/* Mobilde yalnız #/Şampiyon/Derece/Kazanma — diğerleri md+ (dar ekranda isim eziliyordu) */}
            <th className="px-2 md:px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 w-9 md:w-12">#</th>
            <th className="px-2 md:px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 w-full">Şampiyon</th>
            <SortHeader col="tier" label="Derece" shortLabel="Tier" sort={sort} onSort={toggleSort} align="left" />
            <th className="hidden md:table-cell px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Koridor</th>
            <SortHeader col="wr" label="Kazanma" shortLabel="WR" sort={sort} onSort={toggleSort} />
            <SortHeader col="pick" label="Seçilme" sort={sort} onSort={toggleSort} className="hidden md:table-cell" />
            <SortHeader col="ban" label="Banlanma" sort={sort} onSort={toggleSort} className="hidden md:table-cell" />
            <SortHeader col="games" label="Maç" sort={sort} onSort={toggleSort} className="hidden md:table-cell" />
          </tr>
        </thead>
        <tbody>
          {rows.map((c, idx) => {
            const meta = TIER_META[c.rs.tier];
            return (
              <tr key={c.id} className="tl-row">
                <td className="py-2.5 pl-2 pr-1 md:pl-3 md:pr-2 text-gray-500 tabular-nums text-center" style={{ boxShadow: `inset 3px 0 0 ${meta?.bar}` }}>
                  {idx + 1}
                </td>
                <td className="px-2 md:px-3 py-2.5">
                  <Link href={`/champions/${c.id}`} className="flex items-center gap-3 group">
                    <img src={c.image} alt={c.name} width={42} height={42} className={`rounded-lg ${c.rs.lowSample ? "opacity-60" : ""}`} loading="lazy" />
                    <div className="min-w-0">
                      <span className="font-semibold text-gray-100 group-hover:text-white transition-colors block leading-tight truncate">{c.name}</span>
                      {c.rs.lowSample && <span className="text-[10px]" style={{ color: "#c9a66b" }} title={`Düşük örneklem (${c.rs.games} maç)`}>az veri</span>}
                    </div>
                  </Link>
                </td>
                <td className="px-2 md:px-3 py-2.5">
                  {/* Kutu rozet değil, bölüm başlıklarıyla aynı tipografik işaret */}
                  <span className="tl-grade" style={{ color: meta?.color, borderColor: meta?.bar }}>{c.rs.tier}</span>
                </td>
                <td className="hidden md:table-cell px-3 py-2.5 whitespace-nowrap"><LaneCell c={c} role={role} /></td>
                <td className="px-2 md:px-3 py-2.5 text-right font-bold tabular-nums" style={{ color: wrTone(c.rs.wr) }}>%{c.rs.wr}</td>
                <td className="hidden md:table-cell px-3 py-2.5 text-right text-gray-300 tabular-nums">%{c.rs.pick}</td>
                {/* Yüksek ban kırmızı vurgu alır (ana sayfa slider'ıyla aynı eşik) */}
                <td className="hidden md:table-cell px-3 py-2.5 text-right font-medium tabular-nums" style={{ color: banTone(c.rs.ban) }}>%{c.rs.ban}</td>
                <td className="hidden md:table-cell px-3 py-2.5 text-right text-gray-200 font-medium tabular-nums">{c.rs.games.toLocaleString("tr-TR")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
