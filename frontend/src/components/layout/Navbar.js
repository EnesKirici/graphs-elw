"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useBackground } from "@/context/BackgroundContext";
import { useAnalytics } from "@/context/AnalyticsContext";
import { useAdmin } from "@/context/AdminContext";
import ThemePicker from "@/components/dashboard/ThemePicker";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const ROLE_ICONS = {
  TOP: "/roles/top.webp", JUNGLE: "/roles/jungle.webp", MIDDLE: "/roles/mid.webp",
  BOTTOM: "/roles/bot.webp", UTILITY: "/roles/support.webp",
  Top: "/roles/top.webp", Jungle: "/roles/jungle.webp", Mid: "/roles/mid.webp",
  ADC: "/roles/bot.webp", Support: "/roles/support.webp",
};

/* Riot API kullanım göstergesi — tasarımın topbar "XP gauge"i olarak stillenir.
   Hesaplama mantığı korunur; yalnızca admin görür. */
function RateLimitIndicator() {
  const { isAdmin } = useAdmin();
  const [data, setData] = useState(null);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    if (!isAdmin) { setData(null); return; }
    let mounted = true;
    const poll = () => {
      fetch(`${API_BASE}/debug/rate-limit`).then((r) => r.json()).then((d) => { if (mounted) setData(d); }).catch(() => {});
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

  const pct = longLimit > 0 ? Math.round((longUsed / longLimit) * 100) : 0;
  const isHot = pct > 70;
  const isCooldown = data.cooldownUntil > 0;
  const noKey = !data.appLimit && data.requests > 0;
  const color = noKey || isCooldown || isHot ? "var(--loss)" : pct > 40 ? "var(--gold)" : "var(--win)";

  return (
    <div className="relative" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {/* Kompakt XP gauge */}
      <div className="tb-pill" style={{ gap: 10 }}>
        {noKey ? (
          <span className="mono" style={{ color: "var(--loss)", fontWeight: 800, fontSize: 11 }}>API KEY!</span>
        ) : isCooldown ? (
          <>
            <span className="sf-dot" style={{ background: "var(--loss)", boxShadow: "0 0 8px var(--loss)" }} />
            <span className="xp-meta" style={{ color: "var(--loss)" }}>LIMIT {data.cooldownUntil}s</span>
          </>
        ) : (
          <>
            <div className="xp-bar">
              <div className="xp-fill" style={{ width: `${Math.max(pct, 3)}%`, background: color }} />
            </div>
            <span className="xp-meta">
              {longUsed}/{longLimit}
              {data.rateLimited > 0 && <b style={{ color: "var(--gold)", marginLeft: 6 }}>429×{data.rateLimited}</b>}
            </span>
          </>
        )}
      </div>

      {/* Hover detay paneli */}
      {hover && (
        <div
          className="absolute top-full right-0 mt-2 px-5 py-4 w-72 z-50"
          style={{ background: "var(--bg-1)", border: "1px solid var(--border-strong)", borderRadius: 14, boxShadow: "0 18px 50px rgba(0,0,0,.6)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontSize: 12, color: "var(--txt-2)" }}>Riot API Durumu</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: noKey || isCooldown ? "var(--loss)" : "var(--win)" }}>
              {noKey ? "KEY GEÇERSİZ" : isCooldown ? "LİMİT AŞILDI" : "AKTİF"}
            </span>
          </div>
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span style={{ fontSize: 10, color: "var(--txt-3)" }}>2dk Limit</span>
              <span className="mono" style={{ fontSize: 11, fontWeight: 700, color }}>{longUsed} / {longLimit}</span>
            </div>
            <div style={{ height: 10, borderRadius: 6, background: "rgba(255,255,255,.08)", overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 6, background: color, width: `${Math.max(pct, 1)}%`, transition: "width .5s var(--ease)" }} />
            </div>
            <div className="flex justify-between mt-1">
              <span style={{ fontSize: 9, color: "var(--txt-3)" }}>{pct}% kullanıldı</span>
              <span style={{ fontSize: 9, color: "var(--txt-3)" }}>{Math.max(longLimit - longUsed, 0)} kalan</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="text-center">
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--txt)" }}>{data.requests}</p>
              <p style={{ fontSize: 9, color: "var(--txt-3)" }}>Toplam</p>
            </div>
            <div className="text-center">
              <p style={{ fontSize: 14, fontWeight: 700, color: data.rateLimited > 0 ? "var(--loss)" : "var(--txt)" }}>{data.rateLimited}</p>
              <p style={{ fontSize: 9, color: "var(--txt-3)" }}>429 Hata</p>
            </div>
            <div className="text-center">
              <p style={{ fontSize: 14, fontWeight: 700, color: data.blocked > 0 ? "var(--gold)" : "var(--txt)" }}>{data.blocked}</p>
              <p style={{ fontSize: 9, color: "var(--txt-3)" }}>Engellenen</p>
            </div>
          </div>
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

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setShowDropdown(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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
    if (selectedIdx >= 0 && selectedIdx < suggestions.length) {
      selectPlayer(suggestions[selectedIdx]);
      return;
    }
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
    if (suggestions.length > 0) selectPlayer(suggestions[0]);
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
    <nav className="elw-topbar">
      {/* Mobilde hamburger için boşluk */}
      <div className="lg:hidden" style={{ width: 40, flex: "none" }} />

      {/* Arama */}
      <div ref={ref} style={{ flex: 1, maxWidth: 560, position: "relative" }}>
        <form onSubmit={handleSubmit}>
          <div className="tb-search">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4-4" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => handleChange(e.target.value)}
              onFocus={() => (suggestions.length > 0 || query.includes("#")) && setShowDropdown(true)}
              onKeyDown={handleKeyDown}
              placeholder="Oyuncu ara… (isim#tag)"
            />
          </div>
        </form>

        {showDropdown && (suggestions.length > 0 || query.includes("#")) && (
          <div
            style={{
              position: "absolute", top: "100%", left: 0, right: 0, marginTop: 8, zIndex: 50,
              background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: 12,
              overflow: "hidden", boxShadow: "0 18px 50px rgba(0,0,0,.5)",
            }}
          >
            {suggestions.map((p, idx) => {
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
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "11px 14px",
                    textAlign: "left", background: isSelected ? "var(--surface-2)" : "transparent", transition: "background .15s",
                  }}
                >
                  {p.profileIcon ? (
                    <img src={p.profileIcon} alt="" width={40} height={40} style={{ borderRadius: 10 }} />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--surface-2)" }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--txt)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.gameName}
                      <span style={{ color: "var(--txt-3)", fontSize: 12, marginLeft: 2 }}>#{p.tagLine}</span>
                    </p>
                    {rankText ? (
                      <div className="flex items-center gap-1.5" style={{ marginTop: 2 }}>
                        <img src={`/ranks/badges/${p.tier.toLowerCase()}.webp`} alt="" width={16} height={16} />
                        <p style={{ fontSize: 11, color: "var(--txt-2)" }}>{rankText}</p>
                      </div>
                    ) : (
                      <p style={{ fontSize: 11, color: "var(--txt-3)", marginTop: 2 }}>Unranked</p>
                    )}
                  </div>
                  {p.topRoles && (
                    <div className="flex items-center gap-1.5">
                      {p.topRoles.map((r, i) => (
                        <img key={i} src={ROLE_ICONS[r.role] || ROLE_ICONS[r.label] || ""} alt="" width={20} height={20} style={{ opacity: 0.7 }} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}

            {query.includes("#") && (
              <button
                onClick={handleSubmit}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", textAlign: "left" }}
              >
                <div style={{ width: 32, height: 32, borderRadius: 9, background: "var(--accent-soft)", display: "grid", placeItems: "center" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
                </div>
                <p style={{ fontSize: 14, color: "var(--txt-2)" }}>
                  <span style={{ color: "var(--txt)", fontWeight: 600 }}>{query}</span> ara
                </p>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="tb-spacer" />

      {/* Sağ */}
      <div className="flex items-center" style={{ gap: 10, flexShrink: 0 }}>
        {background && (
          <button onClick={removeBg} className="tb-pill" style={{ gap: 6 }} title="Arka planı kaldır">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
            BG Kaldır
          </button>
        )}
        <RateLimitIndicator />
        <ThemePicker />
        {isAdmin && (
          <Link href="/admin" title="Admin Paneli" className="tb-pill admin">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            ADMIN
          </Link>
        )}
        <span className="tb-pill" style={{ gap: 7 }}>
          <span className="sf-dot" />
          TR1
        </span>
      </div>
    </nav>
  );
}
