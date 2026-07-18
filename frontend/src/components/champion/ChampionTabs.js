"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

/*
  Şampiyon sayfası sekme yapısı.
  tabs = [{ key, label, content }]. İlk sekme varsayılan aktif.
  İçerikler mount kalır (hidden ile gizlenir) → sekme değişince state korunur.
  Aktif sekme ?tab= ile URL'de tutulur → refresh/paylaşımda aynı sekme açılır.
  (history.replaceState: router.replace gibi RSC yeniden yüklemesi tetiklemez.)
*/
export default function ChampionTabs({ tabs }) {
  const params = useSearchParams();
  const fromUrl = params.get("tab");
  const [active, setActive] = useState(
    tabs.some((t) => t.key === fromUrl) ? fromUrl : tabs[0]?.key
  );

  const select = (key) => {
    setActive(key);
    const url = new URL(window.location.href);
    if (key === tabs[0]?.key) {
      url.searchParams.delete("tab"); // varsayılan sekme → temiz URL
    } else {
      url.searchParams.set("tab", key);
    }
    window.history.replaceState(null, "", url);
  };

  return (
    <div>
      <div className="oncanvas-bar border-b border-edge/40">
        <div className="max-w-7xl mx-auto px-6 flex items-center gap-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => select(t.key)}
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
