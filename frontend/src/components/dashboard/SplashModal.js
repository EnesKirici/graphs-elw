"use client";

import { useEffect } from "react";

export default function SplashModal({ isOpen, onClose, splash, championName, skinName, onSetBackground }) {
  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      onClick={onClose}
    >
      {/* Karartılmış arka plan */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" />

      {/* Modal içerik */}
      <div
        className="relative max-w-6xl w-full mx-4 animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Splash art */}
        <img
          src={splash}
          alt={skinName || championName}
          className="w-full rounded-xl shadow-2xl"
        />

        {/* Üst bar */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          {/* Karakter adı + kostüm adı */}
          <div className="bg-black/50 backdrop-blur-sm px-4 py-2 rounded-lg">
            <p className="text-white font-bold text-lg leading-tight">{championName}</p>
            {skinName && skinName !== championName && (
              <p className="text-white/60 text-sm">{skinName}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Background yap butonu */}
            <button
              onClick={() => {
                onSetBackground(splash);
                onClose();
              }}
              className="flex items-center gap-2 bg-blue-500/80 hover:bg-blue-500 backdrop-blur-sm text-white text-sm px-4 py-2 rounded-lg transition-all cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Background Yap
            </button>

            {/* Kapat */}
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white rounded-lg transition-all cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
