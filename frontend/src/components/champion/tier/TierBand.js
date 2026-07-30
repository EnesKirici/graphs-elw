"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ChampTile from "./ChampTile";
import { TIER_META } from "@/lib/tierData";

const NARROW = "(max-width: 720px)";

/* Dar ekran tespiti — masaüstünde bütün liste açık kalır, telefonda kalabalık
   bölümler kırpılır (173 kart 4'erli dizilince sayfa ~10.000px oluyordu). */
function useNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(NARROW);
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return narrow;
}

/* "Tümünü göster" yalnız gerçekten taşma varsa çıkar → ölçüm DOM'dan, tahminden değil. */
function useOverflow(ref, active) {
  const [overflow, setOverflow] = useState(false);
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setOverflow(el.scrollHeight > el.clientHeight + 4);
  }, [ref]);

  useEffect(() => {
    if (!active) { setOverflow(false); return; }
    measure();
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [active, measure, ref]);

  return overflow;
}

/* Bir derece = panelin içinde bir satır. Başlığı kutu-rozet değil TİPOGRAFİK işaret
   taşır (büyük harf + altında tier rengi çizgi), altında şampiyon ızgarası. Kareler
   her bölümde AYNI ölçüde. Başlığa tıklamak bölümü daraltır. */
export default function TierBand({ tier, champs, role, open, onToggle, forceOpen }) {
  const meta = TIER_META[tier];
  const [expanded, setExpanded] = useState(false);
  const tilesRef = useRef(null);
  const narrow = useNarrow();
  const isOpen = forceOpen || open;
  const clamped = narrow && isOpen && !expanded && !forceOpen;
  const overflowing = useOverflow(tilesRef, clamped);

  const wrs = champs.map((c) => c.rs.wr);
  const lo = Math.min(...wrs);
  const hi = Math.max(...wrs);

  return (
    <section className="tl-band" style={{ "--tier": meta?.bar, "--tier-fg": meta?.color, "--tier-bg": meta?.bg }}>
      <button
        type="button"
        className="tl-band-head"
        onClick={onToggle}
        aria-expanded={isOpen}
        title={isOpen ? "Bölümü daralt" : "Bölümü aç"}
      >
        <span className="tl-band-mark">{meta?.label || tier}</span>
        <span className="tl-band-num">
          {champs.length} şampiyon
          <i>·</i>
          {lo === hi ? `%${lo}` : `%${lo}–${hi}`} kazanma
        </span>
        <span className="tl-band-rule" aria-hidden="true" />

        {!isOpen && (
          <span className="tl-band-peek">
            {champs.slice(0, 14).map((c) => (
              <img key={c.id} src={c.image} alt="" width={22} height={22} loading="lazy" />
            ))}
          </span>
        )}

        <span className="tl-band-chev" data-open={isOpen ? "1" : "0"} aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>

      {isOpen && (
        <div className="tl-band-body">
          <div ref={tilesRef} className={`tl-tiles${clamped ? " clamped" : ""}`}>
            {champs.map((c) => (
              <ChampTile key={c.id} c={c} role={role} />
            ))}
          </div>
          {(overflowing || (expanded && narrow)) && !forceOpen && (
            <button type="button" className="tl-more" onClick={() => setExpanded((v) => !v)}>
              {expanded ? "Daralt" : `Tümünü göster (${champs.length})`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
