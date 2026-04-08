"use client";

import { useState } from "react";
import Link from "next/link";

const tagColors = {
  Fighter: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  Tank: "bg-green-500/10 text-green-400 border-green-500/20",
  Mage: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Assassin: "bg-red-500/10 text-red-400 border-red-500/20",
  Marksman: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  Support: "bg-teal-500/10 text-teal-400 border-teal-500/20",
};

export default function ChampionGrid({ champions }) {
  const [search, setSearch] = useState("");

  const filtered = champions.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      {/* Search */}
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
            className="w-full bg-[#0d1117] border border-[#1b2230] rounded-lg pl-9 pr-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-blue-500/50 transition-colors"
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

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {filtered.map((champ, i) => (
          <Link
            key={champ.id}
            href={`/champions/${champ.id}`}
            className="group glass rounded-xl p-4 hover:border-blue-500/30 transition-all duration-300 hover:-translate-y-0.5 animate-fade-in-up"
            style={{
              opacity: 0,
              animationDelay: `${Math.min(i * 20, 500)}ms`,
              animationFillMode: "forwards",
            }}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="absolute -inset-1 bg-blue-500/0 group-hover:bg-blue-500/20 rounded-xl blur transition-all duration-300" />
                <img
                  src={champ.image}
                  alt={champ.name}
                  width={56}
                  height={56}
                  className="relative rounded-xl group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">
                  {champ.name}
                </p>
                <div className="flex flex-wrap justify-center gap-1 mt-2">
                  {champ.tags.map((tag) => (
                    <span
                      key={tag}
                      className={`text-[9px] px-1.5 py-0.5 rounded-md border ${tagColors[tag] || "bg-gray-500/10 text-gray-400 border-gray-500/20"}`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
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
