"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useBackground } from "@/context/BackgroundContext";
import { useAnalytics } from "@/context/AnalyticsContext";
import { useAdmin } from "@/context/AdminContext";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const ROLE_ICONS = {
  TOP: "/roles/top.webp", JUNGLE: "/roles/jungle.webp", MIDDLE: "/roles/mid.webp",
  BOTTOM: "/roles/bot.webp", UTILITY: "/roles/support.webp",
  Top: "/roles/top.webp", Jungle: "/roles/jungle.webp", Mid: "/roles/mid.webp",
  ADC: "/roles/bot.webp", Support: "/roles/support.webp",
};

function RateLimitIndicator() {
  const { isAdmin } = useAdmin();
  const [data, setData] = useState(null);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    if (!isAdmin) { setData(null); return; }
    let mounted = true;
    const poll = () => {
      fetch(`${API_BASE}/debug/rate-limit`).then(r => r.json()).then(d => { if (mounted) setData(d); }).catch(() => {});
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => { mounted = false; clearInterval(id); };
  }, [isAdmin]);

  if (!isAdmin || !data) return null;

  const limitParts = (data.appLimit || "").split(",");
  const countParts = (data.appCount || "").split(",");
  let shortLimit = 0, shortUsed = 0, longLimit = 0, longUsed = 0;
  limitParts.forEach((p, i) => {
    const [limit, window] = p.split(":");
    const [used] = (countParts[i] || "0").split(":");
    if (parseInt(window) <= 10) { shortLimit = parseInt(limit); shortUsed = parseInt(used); }
    else { longLimit = parseInt(limit); longUsed = parseInt(used); }
  });

  const pct = longLimit > 0 ? Math.round(longUsed / longLimit * 100) : 0;
  const isHot = pct > 70;
  const isCooldown = data.cooldownUntil > 0;
  const noKey = !data.appLimit && data.requests > 0;
  const barColor = noKey ? "bg-red-500" : isCooldown ? "bg-red-500" : isHot ? "bg-red-500" : pct > 40 ? "bg-yellow-500" : "bg-emerald-500";
  const textColor = noKey ? "text-red-400" : isCooldown ? "text-red-400" : isHot ? "text-red-400" : pct > 40 ? "text-yellow-400" : "text-emerald-400";

  return (
    <div
      className="relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Compact bar */}
      <div className="flex items-center gap-2 cursor-default px-2.5 py-1.5 rounded-lg bg-white/5 border border-[#1b2230] hover:border-[#2a3441] transition-colors">
        {noKey ? (
          <span className="text-[11px] text-red-400 font-bold animate-pulse">API KEY!</span>
        ) : isCooldown ? (
          <>
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[11px] text-red-400 font-mono font-bold">LIMIT {data.cooldownUntil}s</span>
          </>
        ) : (
          <>
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: noKey ? "#ef4444" : isHot ? "#ef4444" : pct > 40 ? "#f59e0b" : "#10b981" }} />
            <div className="w-16 h-2 rounded-full bg-[#1b2230] overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.max(pct, 3)}%` }} />
            </div>
            <span className={`text-[11px] font-mono font-semibold ${textColor}`}>{longUsed}/{longLimit}</span>
            {data.rateLimited > 0 && <span className="text-[10px] text-red-500 font-bold">429x{data.rateLimited}</span>}
          </>
        )}
      </div>

      {/* Hover detay paneli */}
      {hover && (
        <div className="absolute top-full right-0 mt-2 bg-[#0a0e14] border border-[#2a3441] rounded-xl px-5 py-4 shadow-2xl shadow-black/90 w-72 z-50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-400 font-medium">Riot API Durumu</span>
            <span className={`text-xs font-bold ${noKey ? "text-red-400" : isCooldown ? "text-red-400" : "text-emerald-400"}`}>
              {noKey ? "KEY GECERSiZ" : isCooldown ? "LIMIT ASILDI" : "AKTIF"}
            </span>
          </div>

          {/* 2dk limit bar */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-gray-500">2dk Limit</span>
              <span className={`text-[11px] font-mono font-bold ${textColor}`}>{longUsed} / {longLimit}</span>
            </div>
            <div className="h-2.5 rounded-full bg-[#1b2230] overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.max(pct, 1)}%` }} />
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="text-[9px] text-gray-600">{pct}% kullanıldı</span>
              <span className="text-[9px] text-gray-600">{Math.max(longLimit - longUsed, 0)} kalan</span>
            </div>
          </div>

          {/* Saniye limit */}
          {shortLimit > 0 && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-gray-500">Saniye Limit</span>
                <span className="text-[11px] font-mono text-gray-400">{shortUsed} / {shortLimit}</span>
              </div>
              <div className="h-1.5 rounded-full bg-[#1b2230] overflow-hidden">
                <div className="h-full rounded-full bg-blue-500/60" style={{ width: `${shortLimit > 0 ? Math.max(shortUsed / shortLimit * 100, 1) : 0}%` }} />
              </div>
            </div>
          )}

          {/* Detay istatistikler */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#1b2230]/50">
            <div className="text-center">
              <p className="text-sm font-bold text-gray-200">{data.requests}</p>
              <p className="text-[9px] text-gray-600">Toplam</p>
            </div>
            <div className="text-center">
              <p className={`text-sm font-bold ${data.rateLimited > 0 ? "text-red-400" : "text-gray-200"}`}>{data.rateLimited}</p>
              <p className="text-[9px] text-gray-600">429 Hata</p>
            </div>
            <div className="text-center">
              <p className={`text-sm font-bold ${data.blocked > 0 ? "text-yellow-400" : "text-gray-200"}`}>{data.blocked}</p>
              <p className="text-[9px] text-gray-600">Engellenen</p>
            </div>
          </div>

          {isCooldown && (
            <div className="mt-3 pt-2 border-t border-[#1b2230]/50 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[11px] text-red-400">Bekleniyor: {data.cooldownUntil} saniye</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const router = useRouter();
  const { background, removeBg } = useBackground();
  const analytics = useAnalytics();
  const { isAdmin } = useAdmin();
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
        analytics?.trackSearch(`${n}#${t}`);
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
    analytics?.trackSearch(`${p.gameName}#${p.tagLine}`);
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
        {isAdmin && (
          <Link
            href="/admin"
            title="Admin Paneli"
            className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 hover:border-amber-400/50 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            ADMIN
          </Link>
        )}
        <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-xs text-gray-500">TR1</span>
      </div>
    </nav>
  );
}
