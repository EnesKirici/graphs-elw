"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useBackground } from "@/context/BackgroundContext";

export default function Navbar() {
  const router = useRouter();
  const { background, removeBg } = useBackground();
  const [navQuery, setNavQuery] = useState("");

  return (
    <nav className="sticky top-0 z-30 glass h-14 flex items-center px-4 gap-4">
      {/* Sol boşluk — mobil hamburger butonuna yer */}
      <div className="w-10 lg:w-0" />

      {/* Arama kutusu — ortalanmış */}
      <form
        className="flex-1 max-w-lg mx-auto"
        onSubmit={(e) => {
          e.preventDefault();
          if (navQuery.includes("#")) {
            const [n, t] = navQuery.split("#");
            if (n && t) {
              router.push(`/summoner/${encodeURIComponent(n)}/${encodeURIComponent(t)}`);
              setNavQuery("");
            }
          }
        }}
      >
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={navQuery}
            onChange={(e) => setNavQuery(e.target.value)}
            placeholder="Oyuncu ara... (isim#tag)"
            className="w-full bg-white/5 border border-[#1b2230] rounded-lg pl-9 pr-4 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.07] transition-all duration-300"
          />
        </div>
      </form>

      {/* Sağ taraf */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {background && (
          <button
            onClick={removeBg}
            className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-white bg-white/5 hover:bg-red-500/20 border border-[#1b2230] hover:border-red-500/30 px-2.5 py-1.5 rounded-lg transition-all duration-200 cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            BG Kaldır
          </button>
        )}
        <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-xs text-gray-500">TR1</span>
      </div>
    </nav>
  );
}
