"use client";

import { useState } from "react";
import Tooltip from "./Tooltip";

export default function RuneTooltip({ runes, keystoneSize = 22, subTreeSize = 16 }) {
  const [anchor, setAnchor] = useState(null);

  if (!runes) return null;

  return (
    <div className="flex flex-col items-center gap-0.5">
      {runes.keystone?.icon && (
        <div
          onMouseEnter={(e) => setAnchor(e.currentTarget)}
          onMouseLeave={() => setAnchor(null)}
        >
          <img
            src={runes.keystone.icon}
            alt={runes.keystone.name}
            width={keystoneSize}
            height={keystoneSize}
            className="rounded-full cursor-help hover:ring-1 ring-blue-500/50"
          />
        </div>
      )}
      {runes.subTree?.icon && (
        <img
          src={runes.subTree.icon}
          alt={runes.subTree.name}
          width={subTreeSize}
          height={subTreeSize}
          className="rounded-full opacity-60"
        />
      )}

      {anchor && (
        <Tooltip anchorEl={anchor}>
          <div className="bg-[#0a0e14] border border-[#1b2230] rounded-lg p-5 shadow-2xl shadow-black/90 w-80">
            <div className="grid grid-cols-2 gap-6">
              {/* Primary tree */}
              <div>
                <div className="flex items-center gap-2.5 mb-3">
                  {runes.primaryTree?.icon && (
                    <img src={runes.primaryTree.icon} alt="" width={22} height={22} />
                  )}
                  <span className="text-xs font-semibold text-gray-200">
                    {runes.primaryTree?.name}
                  </span>
                </div>
                <div className="space-y-2.5">
                  {runes.primaryPerks?.map((p, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <img
                        src={p.icon}
                        alt=""
                        width={i === 0 ? 32 : 26}
                        height={i === 0 ? 32 : 26}
                        className={`rounded-md flex-shrink-0 ${i === 0 ? "ring-1 ring-yellow-500/50" : ""}`}
                      />
                      <p className={i === 0 ? "text-xs font-semibold text-white" : "text-[11px] text-gray-300"}>
                        {p.name}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Secondary tree */}
              <div>
                <div className="flex items-center gap-2.5 mb-3">
                  {runes.subTree?.icon && (
                    <img src={runes.subTree.icon} alt="" width={22} height={22} />
                  )}
                  <span className="text-xs font-semibold text-gray-200">
                    {runes.subTree?.name}
                  </span>
                </div>
                <div className="space-y-2.5">
                  {runes.secondaryPerks?.map((p, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <img
                        src={p.icon}
                        alt=""
                        width={26}
                        height={26}
                        className="rounded-md flex-shrink-0"
                      />
                      <p className="text-[11px] text-gray-300">{p.name}</p>
                    </div>
                  ))}
                </div>
                {runes.statShards?.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-[#1b2230]/50 space-y-1.5">
                    {runes.statShards.map((s, i) => (
                      <p key={i} className="text-[10px] text-gray-400 flex items-center gap-1.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            i === 0 ? "bg-red-400" : i === 1 ? "bg-purple-400" : "bg-green-400"
                          }`}
                        />
                        {s}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Tooltip>
      )}
    </div>
  );
}
