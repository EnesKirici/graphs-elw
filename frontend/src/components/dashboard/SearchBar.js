"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export default function SearchBar({ champions }) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [playerSuggestions, setPlayerSuggestions] = useState([]);
  const ref = useRef(null);
  const debounceRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Debounced oyuncu autocomplete
  const fetchPlayers = useCallback((q) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setPlayerSuggestions([]); return; }

    debounceRef.current = setTimeout(async () => {
      try {
        // # varsa name ve tag'e ayır
        const hasHash = q.includes("#");
        const name = hasHash ? q.split("#")[0] : q;
        const tag = hasHash ? q.split("#")[1] : "";
        const url = `${API_BASE}/summoner/autocomplete?q=${encodeURIComponent(name)}${tag ? `&tag=${encodeURIComponent(tag)}` : ""}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setPlayerSuggestions(data || []);
        }
      } catch {}
    }, 300);
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
      const [name, tag] = query.split("#");
      if (name && tag) {
        setIsSearching(true);
        setIsOpen(false);
        router.push(`/summoner/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`);
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

  function handleSelectPlayer(player) {
    setIsSearching(true);
    setIsOpen(false);
    setQuery("");
    router.push(`/summoner/${encodeURIComponent(player.gameName)}/${encodeURIComponent(player.tagLine)}`);
  }

  function handleChange(e) {
    if (isSearching) return;
    const val = e.target.value;
    setQuery(val);
    setIsOpen(val.length > 0);
    fetchPlayers(val);
  }

  // Rank tier renkleri
  const tierColors = {
    CHALLENGER: "text-[#f0e6d2]", GRANDMASTER: "text-[#cd3737]", MASTER: "text-[#9d48e0]",
    DIAMOND: "text-[#4a9bd9]", EMERALD: "text-[#2d9e6e]", PLATINUM: "text-[#4a9bd9]",
    GOLD: "text-[#c89b3c]", SILVER: "text-[#80939e]", BRONZE: "text-[#8c5a2e]", IRON: "text-[#5a5a5a]",
  };

  const showPlayerSuggestions = playerSuggestions.length > 0 && query.length >= 2;

  return (
    <div ref={ref} className="relative max-w-2xl mx-auto">
      <form onSubmit={handleSubmit}>
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-xl blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
          <div className="relative">
            {isSearching ? (
              <div className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5">
                <div className="absolute inset-0 border-2 border-blue-500/30 rounded-full" />
                <div className="absolute inset-0 border-2 border-transparent border-t-blue-400 rounded-full animate-spin" />
              </div>
            ) : (
              <svg
                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-blue-400 transition-colors"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
            <input
              type="text"
              value={isSearching ? "" : query}
              onChange={handleChange}
              onFocus={() => query.length > 0 && !isSearching && setIsOpen(true)}
              placeholder={isSearching ? "Oyuncu aranıyor..." : "Şampiyon veya oyuncu ara... (isim#tag)"}
              disabled={isSearching}
              className={`w-full bg-[#0d1117] border border-[#1b2230] rounded-xl pl-12 pr-4 py-4 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 transition-all duration-300 ${isSearching ? "opacity-70 cursor-wait" : ""}`}
            />
          </div>
        </div>
      </form>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#0d1117] border border-[#1b2230] rounded-xl overflow-hidden z-50 shadow-xl shadow-black/50">

          {/* Oyuncu önerileri (autocomplete) */}
          {showPlayerSuggestions && (
            <>
              <div className="px-3 py-1.5 border-b border-[#1b2230]/50">
                <span className="text-[10px] text-gray-600 uppercase tracking-wider">Oyuncular</span>
              </div>
              {playerSuggestions.map((p) => (
                <button
                  key={p.puuid}
                  onClick={() => handleSelectPlayer(p)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors cursor-pointer text-left"
                >
                  {p.profileIcon ? (
                    <img src={p.profileIcon} alt="" width={32} height={32} className="rounded-lg" />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate">
                      <span className="text-white font-medium">{p.gameName}</span>
                      <span className="text-gray-500 text-xs">#{p.tagLine}</span>
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {p.tier && (
                        <span className={`text-[10px] font-semibold ${tierColors[p.tier] || "text-gray-500"}`}>
                          {p.tier.charAt(0) + p.tier.slice(1).toLowerCase()} {p.rank} · {p.lp} LP
                        </span>
                      )}
                      {p.topRoles && p.topRoles.length > 0 && (
                        <span className="flex items-center gap-0.5">
                          {p.topRoles.slice(0, 2).map((r, i) => (
                            <img key={i} src={r.icon} alt="" width={12} height={12} className="opacity-60" />
                          ))}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </>
          )}

          {/* Oyuncu arama ipucu (# ile arama yaptığında ve öneri yoksa) */}
          {isPlayerSearch && !showPlayerSuggestions && (
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
          {filteredChamps.length > 0 && (
            <>
              {showPlayerSuggestions && (
                <div className="px-3 py-1.5 border-t border-[#1b2230]/50">
                  <span className="text-[10px] text-gray-600 uppercase tracking-wider">Şampiyonlar</span>
                </div>
              )}
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
            </>
          )}

          {/* Boş sonuç */}
          {!isPlayerSearch && !showPlayerSuggestions && query.length > 0 && filteredChamps.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-500">
              Şampiyon bulunamadı. Oyuncu aramak için <span className="text-blue-400">isim#tag</span> formatını kullan.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
