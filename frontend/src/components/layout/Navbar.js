"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useBackground } from "@/context/BackgroundContext";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const ROLE_ICONS = {
  TOP: "/roles/top.webp", JUNGLE: "/roles/jungle.webp", MIDDLE: "/roles/mid.webp",
  BOTTOM: "/roles/bot.webp", UTILITY: "/roles/support.webp",
  Top: "/roles/top.webp", Jungle: "/roles/jungle.webp", Mid: "/roles/mid.webp",
  ADC: "/roles/bot.webp", Support: "/roles/support.webp",
};

function RateLimitIndicator() {
  const [data, setData] = useState(null);
  useEffect(() => {
    let mounted = true;
    const poll = () => {
      fetch(`${API_BASE}/debug/rate-limit`).then(r => r.json()).then(d => { if (mounted) setData(d); }).catch(() => {});
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  if (!data) return null;

  // "20:1,100:120" → parse et
  const limitParts = (data.appLimit || "").split(",");
  const countParts = (data.appCount || "").split(",");
  let longLimit = 0, longUsed = 0;
  limitParts.forEach((p, i) => {
    const [limit, window] = p.split(":");
    const [used] = (countParts[i] || "0").split(":");
    if (parseInt(window) > 10) { longLimit = parseInt(limit); longUsed = parseInt(used); }
  });

  const pct = longLimit > 0 ? Math.round(longUsed / longLimit * 100) : 0;
  const isHot = pct > 70;
  const isCooldown = data.cooldownUntil > 0;

  return (
    <div className="flex items-center gap-1.5 text-[10px] font-mono">
      {isCooldown ? (
        <span className="text-red-400 animate-pulse">LIMIT {data.cooldownUntil}s</span>
      ) : (
        <>
          <div className="w-10 h-1.5 rounded-full bg-[#1b2230] overflow-hidden" title={`${longUsed}/${longLimit} (${pct}%)`}>
            <div className={`h-full rounded-full ${isHot ? "bg-red-500" : pct > 40 ? "bg-yellow-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
          </div>
          <span className={isHot ? "text-red-400" : "text-gray-600"}>{longUsed}/{longLimit}</span>
        </>
      )}
      {data.rateLimited > 0 && <span className="text-red-500">429×{data.rateLimited}</span>}
    </div>
  );
}

export default function Navbar() {
  const router = useRouter();
  const { background, removeBg } = useBackground();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const ref = useRef(null);
  const debounceRef = useRef(null);

  // Dışına tıklayınca kapat
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setShowDropdown(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Autocomplete — yazarken DB'den öneri
  function handleChange(value) {
    setQuery(value);
    setSelectedIdx(-1);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const hasTag = value.includes("#");
    const [namePart, tagPart] = hasTag ? value.split("#") : [value, ""];

    debounceRef.current = setTimeout(async () => {
      try {
        const url = tagPart
          ? `${API_BASE}/summoner/autocomplete?q=${encodeURIComponent(namePart)}&tag=${encodeURIComponent(tagPart)}`
          : `${API_BASE}/summoner/autocomplete?q=${encodeURIComponent(namePart)}`;
        const res = await fetch(url);
        const data = await res.json();
        setSuggestions(data);
        setShowDropdown(true);
      } catch {
        setSuggestions([]);
        setShowDropdown(hasTag);
      }
    }, 100);
  }

  function handleSubmit(e) {
    if (e) e.preventDefault();

    // Seçili öneri varsa onu aç
    if (selectedIdx >= 0 && selectedIdx < suggestions.length) {
      selectPlayer(suggestions[selectedIdx]);
      return;
    }

    // # ile yazılmışsa direkt ara
    if (query.includes("#")) {
      const [n, t] = query.split("#");
      if (n && t) {
        router.push(`/summoner/${encodeURIComponent(n)}/${encodeURIComponent(t)}`);
        setQuery("");
        setShowDropdown(false);
      }
      return;
    }

    // Öneri varsa ve Enter basıldıysa ilk öneriyi seç
    if (suggestions.length > 0) {
      selectPlayer(suggestions[0]);
    }
  }

  function handleKeyDown(e) {
    if (!showDropdown || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === "Escape") {
      setShowDropdown(false);
      setSelectedIdx(-1);
    }
  }

  function selectPlayer(p) {
    router.push(`/summoner/${encodeURIComponent(p.gameName)}/${encodeURIComponent(p.tagLine)}`);
    setQuery("");
    setShowDropdown(false);
    setSuggestions([]);
    setSelectedIdx(-1);
  }

  return (
    <nav className="sticky top-0 z-30 glass h-14 flex items-center px-4 gap-4">
      <div className="w-10 lg:w-0" />

      {/* Arama */}
      <div ref={ref} className="flex-1 max-w-lg mx-auto relative">
        <form onSubmit={handleSubmit}>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => handleChange(e.target.value)}
              onFocus={() => (suggestions.length > 0 || query.includes("#")) && setShowDropdown(true)}
              onKeyDown={handleKeyDown}
              placeholder="Oyuncu ara... (isim#tag)"
              className="w-full bg-white/5 border border-[#1b2230] rounded-lg pl-9 pr-4 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.07] transition-all duration-300"
            />
          </div>
        </form>

        {/* Dropdown */}
        {showDropdown && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#0d1117] border border-[#1b2230] rounded-lg overflow-hidden shadow-xl shadow-black/60 z-50">
            {/* DB sonuçları */}
            {suggestions.length > 0 && (
              suggestions.map((p, idx) => {
                const tierName = p.tier ? p.tier.charAt(0) + p.tier.slice(1).toLowerCase() : null;
                const rankText = tierName
                  ? `${tierName}${p.rank ? " " + p.rank : ""}${p.lp != null ? " · " + p.lp + " LP" : ""}`
                  : null;
                const isSelected = idx === selectedIdx;
                return (
                  <button
                    key={p.puuid}
                    onClick={() => selectPlayer(p)}
                    onMouseEnter={() => setSelectedIdx(idx)}
                    className={`w-full flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer text-left ${
                      isSelected ? "bg-white/10" : "hover:bg-white/5"
                    }`}
                  >
                    {/* Profil ikonu */}
                    {p.profileIcon ? (
                      <img src={p.profileIcon} alt="" width={40} height={40} className="rounded-lg" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-[#1b2230]" />
                    )}

                    {/* İsim + Rank detay */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200 font-medium truncate">
                        {p.gameName}
                        <span className="text-gray-500 text-xs ml-0.5">#{p.tagLine}</span>
                      </p>
                      {rankText ? (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <img src={`/ranks/badges/${p.tier.toLowerCase()}.webp`} alt="" width={16} height={16} />
                          <p className="text-[11px] text-gray-400">{rankText}</p>
                        </div>
                      ) : (
                        <p className="text-[11px] text-gray-500 mt-0.5">Unranked</p>
                      )}
                    </div>

                    {/* Koridor ikonları */}
                    {p.topRoles && (
                      <div className="flex items-center gap-1.5">
                        {p.topRoles.map((r, i) => (
                          <img key={i} src={ROLE_ICONS[r.role] || ROLE_ICONS[r.label] || ""} alt="" width={20} height={20} className="opacity-70" />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })
            )}

            {/* # ile arama ipucu */}
            {query.includes("#") && (
              <button
                onClick={handleSubmit}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer text-left ${
                  selectedIdx === suggestions.length ? "bg-white/10" : "hover:bg-white/5"
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-300">
                  <span className="text-white font-medium">{query}</span> ara
                </p>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Sağ */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {background && (
          <button onClick={removeBg}
            className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-white bg-white/5 hover:bg-red-500/20 border border-[#1b2230] hover:border-red-500/30 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            BG Kaldır
          </button>
        )}
        <RateLimitIndicator />
        <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-xs text-gray-500">TR1</span>
      </div>
    </nav>
  );
}
