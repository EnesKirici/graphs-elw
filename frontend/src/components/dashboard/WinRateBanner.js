"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import SplashModal from "./SplashModal";
import { useBackground } from "@/context/BackgroundContext";

/*
  Havuzdan her kategoriden 2 şampiyon rastgele seç.
*/
function selectFromPool(pool) {
  if (!pool || pool.length === 0) return [];
  const byCategory = {};
  pool.forEach((c) => {
    if (!byCategory[c.sliderCategory]) byCategory[c.sliderCategory] = [];
    byCategory[c.sliderCategory].push(c);
  });

  const selected = [];
  Object.values(byCategory).forEach((catChamps) => {
    const shuffled = [...catChamps].sort(() => Math.random() - 0.5);
    selected.push(...shuffled.slice(0, 2));
  });

  return selected.sort(() => Math.random() - 0.5);
}

function getCategoryColor(category) {
  if (category.includes("Win Rate")) return "text-emerald-400 bg-emerald-500/20 border-emerald-500/30";
  if (category.includes("Popüler")) return "text-blue-400 bg-blue-500/20 border-blue-500/30";
  if (category.includes("Banlanan")) return "text-red-400 bg-red-500/20 border-red-500/30";
  return "text-gray-400 bg-gray-500/20 border-gray-500/30";
}

function getValueColor(category) {
  if (category.includes("Win")) return "text-emerald-400";
  if (category.includes("Popüler")) return "text-blue-400";
  if (category.includes("Banlanan")) return "text-red-400";
  return "text-white";
}

export default function WinRateBanner({ sliderPool = [], version }) {
  /*
    Hydration fix:
    Sunucu ve tarayıcıda aynı başlangıç state'i olmalı.
    İlk render'da havuzun ilk 6'sını göster (deterministic).
    Sonra useEffect ile (sadece tarayıcıda) rastgele seçimi yap.
  */
  const [slides, setSlides] = useState(sliderPool.slice(0, 6));
  const [current, setCurrent] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const { setBg } = useBackground();

  // Sadece tarayıcıda rastgele seçim yap (hydration sonrası)
  useEffect(() => {
    const selected = selectFromPool(sliderPool);
    if (selected.length > 0) setSlides(selected);
  }, []);

  const total = slides.length;

  // Otomatik geçiş — resetKey değişince timer sıfırlanır
  useEffect(() => {
    if (modalOpen || total === 0) return;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % total);
    }, 5000);
    return () => clearInterval(timer);
  }, [total, modalOpen, resetKey]);

  function goTo(index) {
    if (index === current) return;
    setCurrent(index);
    // Timer'ı sıfırla — tıklamadan sonra 5sn bekle
    setResetKey((k) => k + 1);
  }

  if (total === 0) return null;

  const champ = slides[current];
  const currentSplash = champ.latestSkinSplash || champ.splash;

  return (
    <>
      <div className="relative w-full h-[240px] md:h-[280px] rounded-xl overflow-hidden">
        {/* Son kostüm splash art */}
        {slides.map((c, i) => (
          <div
            key={c.id + c.sliderCategory}
            className="absolute inset-0 transition-opacity duration-700"
            style={{ opacity: i === current ? 1 : 0 }}
          >
            <img
              src={c.latestSkinSplash || c.splash}
              alt={c.name}
              className="w-full h-full object-cover object-[center_20%]"
            />
          </div>
        ))}

        {/* Gradient — kenarlar karanlık, orta net */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e14] via-transparent to-[#0a0e14]/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0e14]/60 via-transparent to-transparent" />

        {/* Oklar */}
        <button
          onClick={() => goTo((current - 1 + total) % total)}
          className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/60 hover:text-white hover:bg-black/60 transition-all z-10 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={() => goTo((current + 1) % total)}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/60 hover:text-white hover:bg-black/60 transition-all z-10 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Sol üst: Kategori + sıra */}
        <div className="absolute top-4 left-5 flex items-center gap-2">
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border backdrop-blur-sm ${getCategoryColor(champ.sliderCategory)}`}>
            {champ.sliderCategory} #{champ.sliderRank}
          </span>
          <span className="text-[10px] text-white/40 bg-black/30 backdrop-blur-sm px-2 py-1 rounded-full">
            Patch {version}
          </span>
        </div>

        {/* Sağ üst: Büyüt butonu */}
        <div className="absolute top-4 right-5">
          <button
            onClick={() => setModalOpen(true)}
            className="w-9 h-9 rounded-lg bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/60 hover:text-white hover:bg-black/60 transition-all cursor-pointer"
            title="Büyüt"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </div>

        {/* Alt: Şampiyon bilgisi + değer */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-3">
          <div className="flex items-end justify-between mb-3">
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
              <p className={`text-3xl font-black font-mono drop-shadow-lg ${getValueColor(champ.sliderCategory)}`}>
                {champ.sliderValue}
              </p>
              <p className="text-[10px] text-white/40 uppercase tracking-wider">
                {champ.sliderCategory.includes("Win") ? "Win Rate" :
                 champ.sliderCategory.includes("Popüler") ? "Pick Rate" : "Ban Rate"}
              </p>
            </div>
          </div>

          {/* Dots */}
          <div className="flex items-center justify-center gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`rounded-full transition-all duration-300 cursor-pointer ${
                  i === current
                    ? "w-5 h-2 bg-white"
                    : "w-2 h-2 bg-white/25 hover:bg-white/50"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <SplashModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        splash={currentSplash}
        championName={champ.name}
        skinName={champ.latestSkinName}
        onSetBackground={setBg}
      />
    </>
  );
}
