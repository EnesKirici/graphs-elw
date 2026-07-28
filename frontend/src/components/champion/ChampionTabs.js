"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CHAMP_TABBAR_WRAP, CHAMP_TABBAR_INNER, CHAMP_TAB, CHAMP_TAB_ACTIVE, CHAMP_TAB_INACTIVE } from "@/components/champion/championTabStyles";

/*
  Şampiyon sayfası sekme yapısı.
  tabs = [{ key, label, content }]. İlk sekme varsayılan aktif.
  İçerikler mount kalır (hidden ile gizlenir) → sekme değişince state korunur.
  Aktif sekme ?tab= ile URL'de tutulur → refresh/paylaşımda aynı sekme açılır.
  (history.replaceState: router.replace gibi RSC yeniden yüklemesi tetiklemez.)

  extraTabs = [{ key, label, href }]: içeriği bu sayfada olmayan, AYRI route'a
  giden sekmeler (ör. Counter → /champions/[id]/counter). Gerçek <Link> = kendi
  URL'i + SSR'ı olan crawlable sayfa (SEO). Bu sayfada hep pasif görünür.
*/
export default function ChampionTabs({ tabs, extraTabs = [] }) {
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
      {/* Alt-çizgi tab yapısı (site diliyle tutarlı) — splash üstünde */}
      <div className={CHAMP_TABBAR_WRAP}>
        <div className={CHAMP_TABBAR_INNER}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => select(t.key)}
              className={`${CHAMP_TAB} ${active === t.key ? CHAMP_TAB_ACTIVE : CHAMP_TAB_INACTIVE}`}
            >
              {t.label}
            </button>
          ))}
          {extraTabs.map((t) => (
            <Link key={t.key} href={t.href} className={`${CHAMP_TAB} ${CHAMP_TAB_INACTIVE}`}>
              {t.label}
            </Link>
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
