"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAnalytics } from "@/context/AnalyticsContext";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

/*
  Ortalı büyük arama. Navbar'daki oyuncu autocomplete + submit mantığını paylaşır:
  "isim#tag" -> /summoner/{name}/{tag}. Çipler popüler şampiyon kısayolları.
*/
export default function BigSearch({ chips = [] }) {
  const router = useRouter();
  const analytics = useAnalytics();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(-1);
  const ref = useRef(null);
  const debounce = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function handleChange(value) {
    setQuery(value);
    setSel(-1);
    if (debounce.current) clearTimeout(debounce.current);
    if (value.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const [namePart, tagPart] = value.includes("#") ? value.split("#") : [value, ""];
    debounce.current = setTimeout(async () => {
      try {
        const url = tagPart
          ? `${API_BASE}/summoner/autocomplete?q=${encodeURIComponent(namePart)}&tag=${encodeURIComponent(tagPart)}`
          : `${API_BASE}/summoner/autocomplete?q=${encodeURIComponent(namePart)}`;
        const res = await fetch(url);
        const data = await res.json();
        setSuggestions(Array.isArray(data) ? data : []);
        setOpen(true);
      } catch {
        setSuggestions([]);
        setOpen(value.includes("#"));
      }
    }, 120);
  }

  function selectPlayer(p) {
    analytics?.trackSearch?.(`${p.gameName}#${p.tagLine}`);
    router.push(`/summoner/${encodeURIComponent(p.gameName)}/${encodeURIComponent(p.tagLine)}`);
    setQuery("");
    setOpen(false);
    setSuggestions([]);
    setSel(-1);
  }

  function handleSubmit(e) {
    if (e) e.preventDefault();
    if (sel >= 0 && sel < suggestions.length) return selectPlayer(suggestions[sel]);
    if (query.includes("#")) {
      const [n, t] = query.split("#");
      if (n && t) {
        analytics?.trackSearch?.(`${n}#${t}`);
        router.push(`/summoner/${encodeURIComponent(n)}/${encodeURIComponent(t)}`);
        setQuery("");
        setOpen(false);
      }
      return;
    }
    if (suggestions.length > 0) selectPlayer(suggestions[0]);
  }

  function handleKeyDown(e) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((p) => (p < suggestions.length - 1 ? p + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((p) => (p > 0 ? p - 1 : suggestions.length - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
      setSel(-1);
    }
  }

  return (
    <div className="section" data-reveal style={{ "--d": 80 }}>
      <div className="bigsearch-wrap">
        <div ref={ref} style={{ width: "100%", maxWidth: 760, position: "relative" }}>
          <form onSubmit={handleSubmit}>
            <div className="bigsearch">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.2">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4-4" />
              </svg>
              <input
                value={query}
                onChange={(e) => handleChange(e.target.value)}
                onFocus={() => (suggestions.length > 0 || query.includes("#")) && setOpen(true)}
                onKeyDown={handleKeyDown}
                placeholder="Şampiyon veya oyuncu ara… (isim#tag)"
                aria-label="Ara"
              />
              <span className="kbd">↵ ara</span>
            </div>
          </form>

          {open && (suggestions.length > 0 || query.includes("#")) && (
            <div
              style={{
                position: "absolute", top: "100%", left: 0, right: 0, marginTop: 8, zIndex: 40,
                background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: 12,
                overflow: "hidden", boxShadow: "0 18px 50px rgba(0,0,0,.5)",
              }}
            >
              {suggestions.map((p, idx) => {
                const tierName = p.tier ? p.tier.charAt(0) + p.tier.slice(1).toLowerCase() : null;
                const rankText = tierName
                  ? `${tierName}${p.rank ? " " + p.rank : ""}${p.lp != null ? " · " + p.lp + " LP" : ""}`
                  : "Unranked";
                return (
                  <button
                    key={p.puuid}
                    type="button"
                    onClick={() => selectPlayer(p)}
                    onMouseEnter={() => setSel(idx)}
                    className="bigsearch-sugg"
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "11px 14px",
                      textAlign: "left", background: idx === sel ? "var(--surface-2)" : "transparent",
                      transition: "background .15s",
                    }}
                  >
                    {p.profileIcon ? (
                      <img src={p.profileIcon} alt="" width={36} height={36} style={{ borderRadius: 9 }} />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: 9, background: "var(--surface-2)" }} />
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--txt)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.gameName}
                        <span style={{ color: "var(--txt-3)", fontSize: 12, marginLeft: 2 }}>#{p.tagLine}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--txt-3)", marginTop: 2 }}>{rankText}</div>
                    </div>
                  </button>
                );
              })}
              {query.includes("#") && (
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="bigsearch-sugg"
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", textAlign: "left" }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: "var(--accent-soft)", display: "grid", placeItems: "center" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
                  </div>
                  <span style={{ fontSize: 14, color: "var(--txt-2)" }}>
                    <b style={{ color: "var(--txt)" }}>{query}</b> ara
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {chips.length > 0 && (
        <div className="search-chips">
          {chips.map((c) => (
            <Link key={c.id} href={`/champions/${c.id}`} className="search-chip">
              {c.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
