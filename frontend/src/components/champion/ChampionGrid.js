"use client";

import { useState } from "react";
import Link from "next/link";

export default function ChampionGrid({ champions, showSearch = true }) {
  const [search, setSearch] = useState("");

  const filtered = champions.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      {/* Search */}
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

      {/* Grid */}
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
