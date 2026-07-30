"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export default function ChampionGrid({ champions, showSearch = true }) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("meta"); // "meta" = normal şampiyonlar · "classic" = Jade varyantları

  // isClassic backend'den gelir ("Jade_*"). Alan yoksa (eski/cache response) hepsi normal
  // sayılır → Classic sekmesi gizlenir, davranış eskisi gibi kalır.
  const normal = useMemo(() => champions.filter((c) => !c.isClassic), [champions]);
  const classic = useMemo(() => champions.filter((c) => c.isClassic), [champions]);

  const hasClassic = classic.length > 0;
  const isClassic = hasClassic && tab === "classic";
  const source = isClassic ? classic : normal;
  const filtered = source.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      {/* Sekmeler — yalnız Classic varyant varsa görünür */}
      {hasClassic && (
        <div className="flex items-center gap-1 mb-4 border-b border-edge">
          <TabButton active={!isClassic} onClick={() => setTab("meta")} count={normal.length}>
            Şampiyonlar
          </TabButton>
          <TabButton active={isClassic} onClick={() => setTab("classic")} count={classic.length}>
            Classic
          </TabButton>
        </div>
      )}

      {/* Classic bilgi notu */}
      {isClassic && (
        <div className="mb-4 rounded-lg border border-edge bg-card/60 px-4 py-3 flex items-start gap-2.5">
          <svg className="w-4 h-4 mt-0.5 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-[13px] text-gray-400 leading-relaxed">
            <span className="text-gray-200 font-medium">Classic</span> şampiyonlar özel bir mod varyantıdır — dereceli maç verisi (build/tier) yoktur.
            <span className="block text-gray-600 text-xs mt-0.5">
              Detay sayfasında yetenekler ve “ne değişti?” bilgisi bulunur.
            </span>
          </p>
        </div>
      )}

      {/* Arama */}
      {showSearch && (
        <div className="mb-5">
          <div className="relative max-w-xs">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Şampiyon ara..."
              className="w-full bg-card border border-edge rounded-lg pl-9 pr-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-blue-500/50 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-300 transition-colors cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {search && (
            <p className="text-[11px] text-gray-600 mt-1.5">{filtered.length} sonuç</p>
          )}
        </div>
      )}

      {/* Grid — her iki sekme de tıklanabilir (Classic detay sayfası SEO için açık) */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
        {filtered.map((champ, i) => (
          <Link
            key={champ.id}
            href={`/champions/${champ.id}`}
            className="group rounded-lg p-2 hover:bg-hover transition-all duration-200 animate-fade-in-up"
            style={{
              opacity: 0,
              animationDelay: `${Math.min(i * 10, 300)}ms`,
              animationFillMode: "forwards",
            }}
          >
            <div className="flex flex-col items-center gap-1.5">
              <img
                src={champ.image}
                alt={champ.name}
                width={40}
                height={40}
                className="rounded-lg group-hover:scale-105 transition-transform duration-200"
              />
              <div className="text-center">
                <p className="text-xs font-medium text-gray-300 group-hover:text-gray-100 transition-colors truncate w-full">
                  {champ.name}
                </p>
              </div>
            </div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-600 text-sm">
            Şampiyon bulunamadı
          </div>
        )}
      </div>
    </>
  );
}

// Alt çizgili sekme düğmesi (aktifte mavi vurgu + sayı rozeti).
function TabButton({ active, onClick, count, children }) {
  return (
    <button
      onClick={onClick}
      className={`relative px-3.5 py-2 text-sm font-medium transition-colors cursor-pointer ${
        active ? "text-gray-100" : "text-gray-500 hover:text-gray-300"
      }`}
    >
      {children}
      <span className={`ml-1.5 text-[11px] tabular-nums ${active ? "text-gray-400" : "text-gray-600"}`}>
        {count}
      </span>
      {active && <span className="absolute left-0 right-0 -bottom-px h-0.5 rounded-full bg-blue-500" />}
    </button>
  );
}
