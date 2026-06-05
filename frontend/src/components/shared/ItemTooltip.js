"use client";

import { useState } from "react";
import Tooltip from "./Tooltip";

export default function ItemTooltip({ item, size = 30 }) {
  const [anchor, setAnchor] = useState(null);

  if (!item) {
    return <div style={{ width: size, height: size }} className="rounded bg-edge" />;
  }

  return (
    <>
      <img
        src={item.image}
        alt={item.name}
        width={size}
        height={size}
        className="rounded cursor-pointer"
        onMouseEnter={(e) => setAnchor(e.currentTarget)}
        onMouseLeave={() => setAnchor(null)}
      />
      {anchor && (
        <Tooltip anchorEl={anchor}>
          <div className="tip-dark bg-[#0a0e14] border border-edge rounded-lg p-3 shadow-2xl shadow-black/90 w-60">
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="text-sm font-bold text-white">{item.name}</p>
              {item.gold > 0 && (
                <span className="text-[11px] text-yellow-500 font-mono whitespace-nowrap">{item.gold}g</span>
              )}
            </div>
            {item.desc?.stats?.length > 0 && (
              <div className="mb-1.5">
                {item.desc.stats.map((s, j) => (
                  <p key={j} className="text-[11px] text-blue-300">{s}</p>
                ))}
              </div>
            )}
            {item.desc?.passives?.length > 0 && (
              <div className="space-y-1 border-t border-edge pt-1.5">
                {item.desc.passives.map((p, j) => (
                  <div key={j}>
                    <p className="text-[11px] font-semibold text-yellow-400">{p.name}</p>
                    <p className="text-[10px] text-gray-400 leading-relaxed">{p.desc}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Tooltip>
      )}
    </>
  );
}
