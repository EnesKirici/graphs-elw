"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

// positions alanı backend'de Meraki/DB kaynaklı — UTILITY değil SUPPORT kullanır
// (bkz. ChampionController::index, DataDragonService::getChampionPositions).
const LANES = [
  { key: "TOP", icon: "/roles/top.svg", label: "Top" },
  { key: "JUNGLE", icon: "/roles/jungle.svg", label: "Jungle" },
  { key: "MIDDLE", icon: "/roles/mid.svg", label: "Mid" },
  { key: "BOTTOM", icon: "/roles/bot.svg", label: "ADC" },
  { key: "SUPPORT", icon: "/roles/support.svg", label: "Support" },
];

export default function ChampionGrid({ champions, showSearch = true }) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("meta"); // "meta" = normal şampiyonlar · "classic" = Jade varyantları
  const [lane, setLane] = useState(null); // null = Tümü

  // isClassic backend'den gelir ("Jade_*"). Alan yoksa (eski/cache response) hepsi normal
  // sayılır → Classic sekmesi gizlenir, davranış eskisi gibi kalır.
  const normal = useMemo(() => champions.filter((c) => !c.isClassic), [champions]);
  const classic = useMemo(() => champions.filter((c) => c.isClassic), [champions]);

  const hasClassic = classic.length > 0;
  const isClassic = hasClassic && tab === "classic";
  const source = isClassic ? classic : normal;

  // Classic varyantların koridor verisi yok (özel mod, dereceli maç yok) → o sekmede
  // filtre anlamsız kalırdı; sekme değişince de sıfırlanır ki "takılı kalmış görünmez
  // filtre" durumu oluşmasın (tier list'te yaşadığımız hatanın aynısı burada da olabilirdi).
  useEffect(() => { setLane(null); }, [tab]);

  const laned = useMemo(
    () => (lane ? source.filter((c) => c.positions?.includes(lane)) : source),
    [source, lane]
  );
  const filtered = laned.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="cg-panel glass">
      {/* 2026-07-31: tier list'le BİREBİR aynı düzen — sol grup koridor filtresi +
          arama, sağ grup sekmeler. Önceki hâlde sekmeler (metin, alt-çizgi) arama
          kutusuna (pill) bitişik duruyordu — iki farklı görsel dil yan yana
          "kötü duruyordu" (kullanıcı bildirdi). Artık sol taraf tier list'teki
          gibi TAMAMEN pill ailesinden (ikonlar + arama), sekmeler ayrı sağda. */}
      {/* 2026-07-31: arama ÖNCE, koridor ikonları sonra — tier list'teki
          .tl-toolbar-left ile birebir aynı sıra (kullanıcı: "arama inputunu en
          sola yapıştırsak koridor filtrelerini onun sağına alsak"). Classic'te
          koridor filtresi artık DOM'dan tamamen kalkıyor (visibility:hidden
          değil) — arama artık aynı yükseklikte olduğu için (42px, .tl-role ile
          eşit) satırın toplam yüksekliği değişmiyor, sekmeler kaymıyor; kalkınca
          da arama gerçekten sola yapışıyor (görünmez-ama-yer-kaplayan ikonların
          arkasında "ortada" kalmıyor — kullanıcı bildirdi). */}
      <div className="cg-head">
        <div className="cg-head-left">
          {showSearch && (
            <label className="tl-search cg-search-wide">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.6-3.6" />
              </svg>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Şampiyon ara..."
                aria-label="Şampiyon ara"
              />
            </label>
          )}

          {/* Koridor filtresi — tier list'teki .tl-role ile AYNI sınıf (ayrı kopya
              yok). Classic'in koridor verisi yok, o sekmede tamamen kalkar. */}
          {hasClassic && !isClassic && (
            <div className="tl-roles cg-lanes" role="group" aria-label="Koridor filtresi">
              <button type="button" className="tl-role" data-on={lane === null ? "1" : "0"} onClick={() => setLane(null)}>
                Tümü
              </button>
              {LANES.map((l) => (
                <button
                  key={l.key}
                  type="button"
                  className="tl-role"
                  data-on={lane === l.key ? "1" : "0"}
                  onClick={() => setLane((prev) => (prev === l.key ? null : l.key))}
                  title={l.label}
                >
                  <img src={l.icon} alt={l.label} width={24} height={24} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sekmeler — yalnız Classic varyant varsa görünür. Artık SAĞDA (koridor +
            aramadan ayrı) — farklı görsel dilin (alt-çizgi metin) pill grubuna
            bitişmesi önleniyor. */}
        <div className="cg-tabs">
          <button type="button" className="cg-tab" data-on={!isClassic ? "1" : "0"} onClick={() => setTab("meta")}>
            Şampiyonlar <i>{normal.length}</i>
          </button>
          {hasClassic && (
            <button type="button" className="cg-tab" data-on={isClassic ? "1" : "0"} onClick={() => setTab("classic")}>
              Classic <i>{classic.length}</i>
            </button>
          )}
        </div>
      </div>

      {(search || lane) && <p className="cg-result-count">{filtered.length} sonuç</p>}

      {/* Classic bilgi notu */}
      {isClassic && (
        <div className="cg-note">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>
            <b>Classic</b> şampiyonlar özel bir mod varyantıdır — dereceli maç verisi (build/tier) yoktur.
            <span>Detay sayfasında yetenekler ve "ne değişti?" bilgisi bulunur.</span>
          </p>
        </div>
      )}

      {/* Grid — her iki sekme de tıklanabilir (Classic detay sayfası SEO için açık) */}
      <div className="cg-grid">
        {filtered.map((champ, i) => (
          <Link
            key={champ.id}
            href={`/champions/${champ.id}`}
            className="cg-item animate-fade-in-up"
            style={{ opacity: 0, animationDelay: `${Math.min(i * 10, 300)}ms`, animationFillMode: "forwards" }}
          >
            <img src={champ.image} alt={champ.name} width={44} height={44} />
            <span>{champ.name}</span>
          </Link>
        ))}
        {filtered.length === 0 && <div className="cg-empty">Şampiyon bulunamadı</div>}
      </div>
    </div>
  );
}
