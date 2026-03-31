"use client";

/*
  WinRateBanner - Otomatik kayan slider (carousel).

  "use client" çünkü:
  - useState: Hangi slide'da olduğumuzu tutuyoruz
  - useEffect: Otomatik geçiş zamanlayıcısı (setInterval)

  Laravel'deki karşılığı:
  - Livewire'da $currentSlide property + wire:click
  - Alpine.js'te x-data="{ current: 0 }" + setInterval

  React'te state (durum) yönetimi:
  - const [slide, setSlide] = useState(0)
  - slide = şu anki değer (okuma)
  - setSlide = değeri değiştirme fonksiyonu (yazma)
  - useState(0) = başlangıç değeri 0
*/

import { useState, useEffect } from "react";
import Link from "next/link";

export default function WinRateBanner({ champions }) {
  const top5 = champions.slice(0, 5);
  const [current, setCurrent] = useState(0);

  // Otomatik geçiş - her 4 saniyede bir sonraki slide'a geç
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % top5.length);
    }, 4000);

    // Cleanup: component kaldırılınca timer'ı temizle
    return () => clearInterval(timer);
  }, [top5.length]);

  const champ = top5[current];

  return (
    <div className="relative w-full h-56 md:h-72 rounded-2xl overflow-hidden animate-fade-in-up">
      {/* Arka plan splash art - geçiş animasyonlu */}
      {top5.map((c, i) => (
        <div
          key={c.id}
          className="absolute inset-0 transition-opacity duration-1000 ease-in-out"
          style={{ opacity: i === current ? 1 : 0 }}
        >
          <img
            src={c.splash}
            alt={c.name}
            className="w-full h-full object-cover object-top"
          />
        </div>
      ))}

      {/* Gradient overlay'ler */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#060a10] via-[#060a10]/30 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#060a10]/70 via-transparent to-[#060a10]/70" />

      {/* Sol üst: Etiket */}
      <div className="absolute top-5 left-6">
        <span className="text-[10px] uppercase tracking-[0.2em] text-blue-400/80 font-medium bg-blue-500/10 backdrop-blur-sm px-3 py-1 rounded-full border border-blue-500/20">
          En Yüksek Win Rate
        </span>
      </div>

      {/* Sağ üst: Slide sayacı */}
      <div className="absolute top-5 right-6 flex items-center gap-1.5">
        {top5.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === current
                ? "w-6 bg-blue-400"
                : "w-1.5 bg-white/20 hover:bg-white/40"
            }`}
          />
        ))}
      </div>

      {/* Alt: Şampiyon bilgisi */}
      <div className="absolute bottom-0 left-0 right-0 p-6">
        <div className="flex items-end justify-between">
          <Link
            href={`/champions/${champ.id}`}
            className="flex items-end gap-4 group"
          >
            <img
              src={champ.image}
              alt={champ.name}
              width={56}
              height={56}
              className="rounded-xl border-2 border-white/10 group-hover:border-blue-400/50 transition-all duration-300 shadow-lg"
            />
            <div>
              <p className="text-2xl md:text-3xl font-extrabold text-white group-hover:text-blue-200 transition-colors">
                {champ.name}
              </p>
              <p className="text-sm text-gray-400">{champ.title}</p>
            </div>
          </Link>

          {/* Win rate badge */}
          <div className="text-right">
            <p className="text-3xl font-extrabold text-emerald-400 font-mono">
              {champ.winRate}%
            </p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">
              Win Rate
            </p>
          </div>
        </div>

        {/* Alt sıra: Diğer şampiyonlar küçük ikonlarla */}
        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/5">
          {top5.map((c, i) => (
            <button
              key={c.id}
              onClick={() => setCurrent(i)}
              className={`flex items-center gap-2 px-2 py-1 rounded-lg transition-all duration-300 ${
                i === current
                  ? "bg-white/10"
                  : "opacity-50 hover:opacity-80"
              }`}
            >
              <img
                src={c.image}
                alt={c.name}
                width={20}
                height={20}
                className="rounded-sm"
              />
              <span className="text-[11px] text-gray-300 font-mono hidden sm:inline">
                {c.winRate}%
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
