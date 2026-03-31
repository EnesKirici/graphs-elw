"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function WinRateBanner({ champions, version }) {
  const top5 = champions.slice(0, 5);
  const [current, setCurrent] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrent((prev) => (prev + 1) % top5.length);
        setIsTransitioning(false);
      }, 400);
    }, 5000);
    return () => clearInterval(timer);
  }, [top5.length]);

  function goTo(index) {
    if (index === current) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrent(index);
      setIsTransitioning(false);
    }, 300);
  }

  const champ = top5[current];

  return (
    <div className="relative w-full h-[240px] md:h-[280px] rounded-xl overflow-hidden">
      {/* Son kostüm splash art — her şampiyon için en yeni skin */}
      {top5.map((c, i) => (
        <div
          key={c.id}
          className="absolute inset-0 transition-opacity duration-700"
          style={{ opacity: i === current && !isTransitioning ? 1 : 0 }}
        >
          <img
            src={c.latestSkinSplash || c.splash}
            alt={c.name}
            className="w-full h-full object-cover object-[center_20%]"
          />
        </div>
      ))}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e14] via-transparent to-[#0a0e14]/40" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0a0e14]/70 via-transparent to-transparent" />

      {/* Oklar */}
      <button
        onClick={() => goTo((current - 1 + top5.length) % top5.length)}
        className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/60 hover:text-white hover:bg-black/60 transition-all z-10"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        onClick={() => goTo((current + 1) % top5.length)}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/60 hover:text-white hover:bg-black/60 transition-all z-10"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Sol üst: Sadece patch bilgisi */}
      <div className="absolute top-4 left-5">
        <span className="text-[10px] text-white/50 bg-black/30 backdrop-blur-sm px-2.5 py-1 rounded-full">
          Patch {version}
        </span>
      </div>

      {/* Sağ üst: Dots */}
      <div className="absolute top-4 right-5 flex items-center gap-1.5">
        {top5.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`rounded-full transition-all duration-300 ${
              i === current
                ? "w-5 h-1.5 bg-white"
                : "w-1.5 h-1.5 bg-white/30 hover:bg-white/60"
            }`}
          />
        ))}
      </div>

      {/* Alt: Şampiyon bilgisi */}
      <div className="absolute bottom-0 left-0 right-0 p-5">
        <div className="flex items-end justify-between">
          <Link href={`/champions/${champ.id}`} className="group flex items-end gap-3">
            <img
              src={champ.image}
              alt={champ.name}
              width={52}
              height={52}
              className="rounded-xl border-2 border-white/20 shadow-xl group-hover:border-blue-400/60 transition-all"
            />
            <div>
              <p className="text-2xl font-extrabold text-white drop-shadow-lg">
                {champ.name}
              </p>
              <p className="text-xs text-white/50">{champ.title}</p>
            </div>
          </Link>

          <div className="text-right">
            <p className="text-3xl font-black text-emerald-400 font-mono drop-shadow-lg">
              {champ.winRate}%
            </p>
            <p className="text-[10px] text-white/40 uppercase tracking-wider">Win Rate</p>
          </div>
        </div>
      </div>
    </div>
  );
}
