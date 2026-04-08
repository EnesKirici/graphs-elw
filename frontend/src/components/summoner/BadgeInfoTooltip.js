"use client";

import { useState } from "react";
import Tooltip from "@/components/shared/Tooltip";

export default function BadgeInfoTooltip() {
  const [anchor, setAnchor] = useState(null);
  return (
    <>
      <span
        className="text-gray-500 text-[10px] cursor-help inline-flex items-center justify-center w-4 h-4 rounded-full border border-gray-600/50 hover:text-gray-300 hover:border-gray-500 transition-colors"
        onMouseEnter={e => setAnchor(e.currentTarget)}
        onMouseLeave={() => setAnchor(null)}
      >
        ?
      </span>
      {anchor && (
        <Tooltip anchorEl={anchor}>
          <div className="bg-[#0a0e14] border border-[#2a3441] rounded-lg px-3 py-2 shadow-2xl shadow-black/90 max-w-[220px]">
            <p className="text-[11px] text-gray-300 leading-relaxed">
              Son maçlarda en sık kazanılan rozetler burada listelenir.
            </p>
          </div>
        </Tooltip>
      )}
    </>
  );
}
