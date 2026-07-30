"use client";

import { TIER_ROLES, TIER_ORDER, TIER_META } from "@/lib/tierData";

/* Rol sekmeleri + derece filtresi + şampiyon arama + görünüm anahtarı.
   Derece filtresi çoklu: hiçbiri seçili değilken tüm dereceler görünür.
   Mobilde roller tek satır yatay kayar; alt öğeler satır atlar. */
export default function TierToolbar({ role, onRole, tiers, onTier, query, onQuery, view, onView, counts }) {
  return (
    <div className="tl-toolbar">
      <div className="tl-roles no-scrollbar">
        {TIER_ROLES.map((r) => (
          <button key={r.key} type="button" onClick={() => onRole(r.key)} className="tl-role" data-on={role === r.key ? "1" : "0"}>
            {r.icon && <img src={r.icon} alt="" width={16} height={16} />}
            {r.label}
          </button>
        ))}
      </div>

      <div className="tl-tiers" role="group" aria-label="Derece filtresi">
        {TIER_ORDER.filter((t) => counts?.[t]).map((t) => {
          const on = tiers.includes(t);
          return (
            <button
              key={t}
              type="button"
              onClick={() => onTier(t)}
              className="tl-tier-chip"
              data-on={on ? "1" : "0"}
              style={{ "--tier": TIER_META[t]?.bar, "--tier-fg": TIER_META[t]?.color }}
              aria-pressed={on}
              title={`${t} derecesi — ${counts[t]} şampiyon`}
            >
              {t}
            </button>
          );
        })}
      </div>

      <div className="tl-tools">
        <label className="tl-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.6-3.6" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Şampiyon ara"
            aria-label="Şampiyon ara"
          />
        </label>

        <div className="tl-view" role="group" aria-label="Görünüm">
          <button type="button" onClick={() => onView("board")} data-on={view === "board" ? "1" : "0"} title="Derece bölümleri">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="6.5" rx="1.6" />
              <rect x="3" y="13.5" width="18" height="6.5" rx="1.6" />
            </svg>
            Bölümler
          </button>
          <button type="button" onClick={() => onView("table")} data-on={view === "table" ? "1" : "0"} title="Sıralanabilir tablo">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
            Tablo
          </button>
        </div>
      </div>
    </div>
  );
}
