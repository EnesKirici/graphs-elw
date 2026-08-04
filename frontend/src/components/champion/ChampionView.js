"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CHAMP_TABBAR_WRAP, CHAMP_TABBAR_INNER, CHAMP_TAB, CHAMP_TAB_ACTIVE, CHAMP_TAB_INACTIVE } from "@/components/champion/championTabStyles";
import ChampionBuild from "@/components/champion/ChampionBuild";
import ChampionDetail from "@/components/champion/ChampionDetail";

/*
  Şampiyon sayfası tab yöneticisi: Genel (tam build) · Detay + Counter (ayrı route).
  (Rünler/Eşyalar ayrı tab denendi ama verimiz az → Genel'i boşaltıyordu; geri alındı,
  hepsi Genel'de. Veri zenginleşince tekrar bölünebilir.)
  İçerikler mount kalır (hidden) → sekme değişince state korunur. Aktif sekme ?tab= ile URL'de.
*/
const TABS = [
  { key: "genel", label: "Genel" },
  { key: "detail", label: "Detay" },
];

export default function ChampionView({ id, champ, version, runesData, build, duos }) {
  const params = useSearchParams();
  const fromUrl = params.get("tab");

  // Classic (Jade) varyantı: dereceli veri yok → yalnız Detay tab'ı, Genel/Counter kapalı.
  const isClassic = !!champ.isClassic;
  const tabs = isClassic ? [{ key: "detail", label: "Detay" }] : TABS;

  const [tab, setTab] = useState(
    isClassic ? "detail" : (TABS.some((t) => t.key === fromUrl) ? fromUrl : "genel")
  );

  const select = (key) => {
    setTab(key);
    const url = new URL(window.location.href);
    if (key === "genel") url.searchParams.delete("tab");
    else url.searchParams.set("tab", key);
    window.history.replaceState(null, "", url);
  };

  return (
    <>
      {/* Alt-çizgi tab yapısı (site diliyle) */}
      <div className={CHAMP_TABBAR_WRAP}>
        <div className={CHAMP_TABBAR_INNER}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => select(t.key)}
              className={`${CHAMP_TAB} ${tab === t.key ? CHAMP_TAB_ACTIVE : CHAMP_TAB_INACTIVE}`}
            >
              {t.label}
            </button>
          ))}
          {!isClassic && (
            <Link href={`/champions/${id}/counter`} className={`${CHAMP_TAB} ${CHAMP_TAB_INACTIVE}`}>Counter</Link>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Genel — tam build (yalnız normal şampiyonlarda) */}
        {!isClassic && (
          <div className={tab === "genel" ? "" : "hidden"}>
            {/* Veriden üretilen özet metni ChampionHero'ya taşındı (hero'nun sağındaki
                boş alan) — burada içeriğin üstünde tam satır kaplıyordu. */}
            <ChampionBuild champion={champ} version={version} runesData={runesData} build={build} />
          </div>
        )}

        {/* Detay */}
        <div className={tab === "detail" ? "" : "hidden"}>
          <ChampionDetail champ={champ} version={version} duos={duos} isClassic={isClassic} />
        </div>
      </div>
    </>
  );
}
