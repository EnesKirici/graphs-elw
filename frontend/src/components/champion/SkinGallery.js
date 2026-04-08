"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useBackground } from "@/context/BackgroundContext";
import SplashModal from "@/components/dashboard/SplashModal";

export default function SkinGallery({ skins, championName }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const { setBg } = useBackground();
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
        <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end justify-between">
          <p className="text-lg font-bold text-white drop-shadow-lg">{active.name}</p>

          {/* Aksiyon butonları */}
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Background Yap */}
            <button
              onClick={() => setBg(active.splash)}
              className="flex items-center gap-1.5 bg-black/50 hover:bg-blue-500/80 backdrop-blur-sm text-white/80 hover:text-white text-[11px] px-3 py-1.5 rounded-lg transition-all cursor-pointer"
              title="Arkaplan olarak ayarla"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              BG Yap
            </button>

            {/* Büyüt */}
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 bg-black/50 hover:bg-white/20 backdrop-blur-sm text-white/80 hover:text-white text-[11px] px-3 py-1.5 rounded-lg transition-all cursor-pointer"
              title="Tam ekran görüntüle"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              Büyüt
            </button>
          </div>
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

      {/* Büyütme Modalı — portal ile body'ye render edilir, glass containment sorununu önler */}
      {modalOpen && createPortal(
        <SplashModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          splash={active.splash}
          championName={championName}
          skinName={active.name}
          onSetBackground={setBg}
        />,
        document.body
      )}
    </div>
  );
}
