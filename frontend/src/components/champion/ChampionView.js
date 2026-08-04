"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CHAMP_TABBAR_WRAP, CHAMP_TABBAR_INNER, CHAMP_TAB, CHAMP_TAB_ACTIVE, CHAMP_TAB_INACTIVE } from "@/components/champion/championTabStyles";
import ChampionBuild from "@/components/champion/ChampionBuild";
import ChampionDetail from "@/components/champion/ChampionDetail";

/*
  Şampiyon sayfası tab yöneticisi: Genel (tam build) · Detay + Counter (ayrı route).
  (Ayrı bir "Build" sekmesi denendi — tüm alternatifleri tablo tablo listeliyordu —
  ama Genel zaten build sayfası olduğu için ikisi birbirini tekrar ediyordu; geri
  alındı. Veri zenginleşince tekrar bölünebilir.)
  İçerikler mount kalır (hidden) → sekme değişince state korunur. Aktif sekme ?tab= ile URL'de.

  ROL SEÇİMİ BURADA: sekmeler arası korunsun diye (RoleSelector ortak bileşen).
*/
const TABS = [
  { key: "genel", label: "Genel" },
  { key: "detail", label: "Detay" },
];

export default function ChampionView({ id, champ, version, runesData, build, duos }) {
  const params = useSearchParams();
  const fromUrl = params.get("tab");

  // Classic (Jade) varyantı: dereceli veri yok → yalnız Detay tab'ı, Genel/Build/Counter kapalı.
  const isClassic = !!champ.isClassic;
  const tabs = isClassic ? [{ key: "detail", label: "Detay" }] : TABS;

  const [tab, setTab] = useState(
    isClassic ? "detail" : (TABS.some((t) => t.key === fromUrl) ? fromUrl : "genel")
  );

  const positions = build?.positions || [];
  const urlRole = params.get("role");
  const [role, setRole] = useState(
    positions.some((p) => p.position === urlRole) ? urlRole : positions[0]?.position
  );

  const writeUrl = (nextTab, nextRole) => {
    const url = new URL(window.location.href);
    if (nextTab === "genel") url.searchParams.delete("tab");
    else url.searchParams.set("tab", nextTab);
    if (nextRole === positions[0]?.position || !nextRole) url.searchParams.delete("role");
    else url.searchParams.set("role", nextRole);
    window.history.replaceState(null, "", url);
  };

  const select = (key) => {
    setTab(key);
    writeUrl(key, role);
  };

  const selectRole = (p) => {
    setRole(p);
    writeUrl(tab, p);
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
        {/* Genel — özet build (yalnız normal şampiyonlarda) */}
        {!isClassic && (
          <div className={tab === "genel" ? "" : "hidden"}>
              <ChampionBuild
                champion={champ}
                version={version}
                runesData={runesData}
                build={build}
                role={role}
                onRole={selectRole}
            />
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
