"use client";

import { useState } from "react";
import Tooltip from "@/components/shared/Tooltip";

/*
  Paylaşılan rozet chip'i. MatchCardPro içindeki BadgeChip'in yeniden
  kullanılabilir hâli (o dosyaya dokunmadan; canlı maç kartları da bunu kullanır).

  Sadece üst tier'lar (challenger/grandmaster/master) kendi renginde; diğerleri
  okunur gri. Hover'da tooltip: açıklama (desc) ve varsa "kaç maçta alındığı".
*/
const BADGE_TIER = {
  challenger: { grad: "linear-gradient(90deg,#f0e6d2,#c8aa6e,#78c8e6,#c8aa6e,#f0e6d2)", bd: "border-[#c8aa6e]/45", bg: "bg-[#c8aa6e]/12" },
  grandmaster: { grad: "linear-gradient(90deg,#cd3737,#ff6b6b,#cd3737)", bd: "border-[#cd3737]/40", bg: "bg-[#cd3737]/12" },
  master: { color: "#b072e6", bd: "border-[#9d5bd2]/40", bg: "bg-[#9d5bd2]/12" },
};

export default function BadgeChip({ badge }) {
  const [anchor, setAnchor] = useState(null);
  const t = BADGE_TIER[badge.tier];

  const labelEl = t?.grad ? (
    <span className="bg-clip-text text-transparent" style={{ backgroundImage: t.grad }}>{badge.label}</span>
  ) : t ? (
    <span style={{ color: t.color }}>{badge.label}</span>
  ) : (
    badge.label
  );

  return (
    <>
      <span
        onMouseEnter={(e) => setAnchor(e.currentTarget)}
        onMouseLeave={() => setAnchor(null)}
        className={
          t
            ? `inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-default whitespace-nowrap ${t.bg} ${t.bd}`
            : "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium text-gray-300 bg-soft border border-edge/60 cursor-default whitespace-nowrap"
        }
      >
        {labelEl}
      </span>
      {anchor && (
        <Tooltip anchorEl={anchor}>
          <div className="tip-dark bg-[#0a0e14] border border-[#2a3441] rounded-lg px-3 py-2 shadow-2xl shadow-black/90 max-w-[220px]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold">{labelEl}</span>
              {badge.tier && (
                <span className="text-[9px] text-gray-500 capitalize bg-edge px-1.5 py-0.5 rounded">{badge.tier}</span>
              )}
            </div>
            {badge.desc && <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">{badge.desc}</p>}
            {!badge.desc && badge.count != null && (
              <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                Son maçların {badge.count} tanesinde
                {badge.rate != null ? ` (%${badge.rate})` : ""} alındı.
              </p>
            )}
          </div>
        </Tooltip>
      )}
    </>
  );
}
