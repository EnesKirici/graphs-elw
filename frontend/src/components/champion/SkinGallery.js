"use client";

import { useState } from "react";

export default function SkinGallery({ skins, championName }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = skins[activeIdx];

  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[#1b2230]/50 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-200">
          Kostümler <span className="text-gray-500 font-normal">({skins.length})</span>
        </h3>
        <span className="text-[11px] text-gray-500">{active.name}</span>
      </div>

      {/* Ana splash */}
      <div className="relative aspect-video overflow-hidden group">
        <img
          src={active.splash}
          alt={active.name}
          className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#060a10] via-transparent to-transparent opacity-60" />

        {/* Skin adı overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <p className="text-lg font-bold text-white drop-shadow-lg">{active.name}</p>
        </div>

        {/* Sol/sağ navigasyon */}
        {skins.length > 1 && (
          <>
            <button
              onClick={() => setActiveIdx((activeIdx - 1 + skins.length) % skins.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/70 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => setActiveIdx((activeIdx + 1) % skins.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/70 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {skins.length > 1 && (
        <div className="p-3 flex gap-2 overflow-x-auto scrollbar-thin">
          {skins.map((skin, i) => (
            <button
              key={skin.num}
              onClick={() => setActiveIdx(i)}
              className={`flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all duration-200 cursor-pointer ${
                i === activeIdx
                  ? "border-blue-500 shadow-lg shadow-blue-500/20"
                  : "border-transparent opacity-50 hover:opacity-80"
              }`}
            >
              <img
                src={skin.splash}
                alt={skin.name}
                className="w-20 h-12 object-cover object-top"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
