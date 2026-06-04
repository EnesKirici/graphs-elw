"use client";

import { useState } from "react";
import Tooltip from "@/components/shared/Tooltip";

/*
  Sezon kişilik rozetleri (op.gg "Personal Ratings" tarzı).
  Pozitif eğilimler yeşil, negatif eğilimler amber. Hover → açıklama tooltip'i.
  Veri backend'den (personalityBadges): [{ key, label, desc, positive }].
*/
export default function PersonalityBadges({ badges = [] }) {
  if (!badges || badges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((b) => (
        <Chip key={b.key} badge={b} />
      ))}
    </div>
  );
}

function Chip({ badge }) {
  const [anchor, setAnchor] = useState(null);
  const pos = badge.positive;

  return (
    <>
      <span
        onMouseEnter={(e) => setAnchor(e.currentTarget)}
        onMouseLeave={() => setAnchor(null)}
        className={`text-[11px] font-medium px-2.5 py-1 rounded-md border cursor-help transition-colors ${
          pos
            ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/[0.06] hover:bg-emerald-500/[0.12]"
            : "border-amber-500/40 text-amber-300 bg-amber-500/[0.06] hover:bg-amber-500/[0.12]"
        }`}
      >
        {badge.label}
      </span>
      {anchor && (
        <Tooltip anchorEl={anchor}>
          <div className="bg-[#0a0e14] border border-[#2a3441] rounded-lg px-3 py-2 shadow-2xl shadow-black/90 max-w-[230px] text-center">
            <p className={`text-xs font-bold ${pos ? "text-emerald-400" : "text-amber-400"}`}>{badge.label}</p>
            <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{badge.desc}</p>
          </div>
        </Tooltip>
      )}
    </>
  );
}
