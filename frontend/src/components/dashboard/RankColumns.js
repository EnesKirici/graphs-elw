/*
  Üçlü sıralama kolonları — Popüler / En Yüksek WR / En Çok Banlanan.
  Kaynak: /meta/dashboard topPickRate, topWinRate, topBanRate (ilk 5).
*/
import Link from "next/link";
import { RankRow, pctTR } from "./primitives";

export default function RankColumns({ popular = [], topWinRate = [], topBanned = [] }) {
  const cols = [
    { key: "pop", title: "Popüler Şampiyonlar", icon: "★", color: "#4f8cff", data: popular, valueKey: "pickRate" },
    { key: "wr", title: "En Yüksek Win Rate", icon: "↗", color: "var(--win)", data: topWinRate, valueKey: "adjWr" },
    { key: "ban", title: "En Çok Banlanan", icon: "⊘", color: "var(--loss)", data: topBanned, valueKey: "banRate" },
  ];

  return (
    <div className="section" data-reveal style={{ "--d": 160 }}>
      <div className="cols-3">
        {cols.map((col) => (
          <div key={col.key} className="card rank-card glow" style={{ "--accent": col.color }}>
            <div className="rank-card-head">
              <h3>
                <span className="ico" style={{ background: `color-mix(in oklab, ${col.color} 14%, transparent)`, color: col.color }}>
                  {col.icon}
                </span>
                {col.title}
              </h3>
            </div>
            {col.data.slice(0, 5).map((c, i) => (
              <RankRow
                key={c.id}
                rank={i + 1}
                champ={c}
                value={pctTR(c[col.valueKey])}
                color={col.color}
                href={`/champions/${c.id}`}
              />
            ))}
            <Link href="/champions" className="see-all" style={{ color: col.color }}>Tümünü Gör →</Link>
          </div>
        ))}
      </div>
    </div>
  );
}
