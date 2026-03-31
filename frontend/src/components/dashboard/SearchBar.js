"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SearchBar({ champions }) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);
  const router = useRouter();

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // # içeriyorsa oyuncu arama, yoksa şampiyon filtreleme
  const isPlayerSearch = query.includes("#");

  const filteredChamps = !isPlayerSearch && query.length > 0
    ? champions.filter((c) =>
        c.name.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 5)
    : [];

  function handleSubmit(e) {
    e.preventDefault();

    if (isPlayerSearch) {
      // Oyuncu arama: "elw#0000" → /summoner/elw/0000
      const [name, tag] = query.split("#");
      if (name && tag) {
        router.push(`/summoner/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`);
        setQuery("");
        setIsOpen(false);
      }
    } else if (filteredChamps.length === 1) {
      router.push(`/champions/${filteredChamps[0].id}`);
      setQuery("");
      setIsOpen(false);
    }
  }

  function handleSelectChamp(champ) {
    router.push(`/champions/${champ.id}`);
    setQuery("");
    setIsOpen(false);
  }

  return (
    <div ref={ref} className="relative max-w-2xl mx-auto">
      <form onSubmit={handleSubmit}>
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-xl blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
          <div className="relative">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-blue-400 transition-colors"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setIsOpen(e.target.value.length > 0);
              }}
              onFocus={() => query.length > 0 && setIsOpen(true)}
              placeholder="Şampiyon veya oyuncu ara... (isim#tag)"
              className="w-full bg-[#0d1117] border border-[#1b2230] rounded-xl pl-12 pr-4 py-4 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 transition-all duration-300"
            />
          </div>
        </div>
      </form>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#0d1117] border border-[#1b2230] rounded-xl overflow-hidden z-50 shadow-xl shadow-black/50">
          {/* Oyuncu arama ipucu */}
          {isPlayerSearch && (
            <button
              onClick={handleSubmit}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer text-left"
            >
              <div className="w-8 h-8 rounded-md bg-blue-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-200">
                  <span className="text-white font-medium">{query}</span> oyuncusunu ara
                </p>
                <p className="text-[10px] text-gray-500">Enter'a bas veya tıkla</p>
              </div>
            </button>
          )}

          {/* Şampiyon sonuçları */}
          {filteredChamps.map((champ) => (
            <button
              key={champ.id}
              onClick={() => handleSelectChamp(champ)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors cursor-pointer text-left"
            >
              <img src={champ.image} alt={champ.name} width={28} height={28} className="rounded-md" />
              <div>
                <p className="text-sm text-gray-200">{champ.name}</p>
                <p className="text-[10px] text-gray-500">{champ.tags.join(" / ")}</p>
              </div>
            </button>
          ))}

          {/* Boş sonuç */}
          {!isPlayerSearch && query.length > 0 && filteredChamps.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-500">
              Şampiyon bulunamadı. Oyuncu aramak için <span className="text-blue-400">isim#tag</span> formatını kullan.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
