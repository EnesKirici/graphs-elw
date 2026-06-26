"use client";

import { useState } from "react";

/*
  Şampiyon sayfası sekme yapısı.
  tabs = [{ key, label, content }]. İlk sekme varsayılan aktif.
  İçerikler mount kalır (hidden ile gizlenir) → sekme değişince state korunur.
*/
export default function ChampionTabs({ tabs }) {
  const [active, setActive] = useState(tabs[0]?.key);

  return (
    <div>
      <div className="oncanvas-bar border-b border-edge/40">
        <div className="max-w-7xl mx-auto px-6 flex items-center gap-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={`py-3 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
                active === t.key
                  ? "border-blue-500 text-white"
                  : "border-transparent text-gray-400 hover:text-gray-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tabs.map((t) => (
        <div key={t.key} className={active === t.key ? "" : "hidden"}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
