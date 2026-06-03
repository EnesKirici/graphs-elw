"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { primaryRole } from "@/lib/roles";
import { pctTR } from "./primitives";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// Havuzdan deterministik slayt seçimi (her kategoriden 2, sıraya göre serpiştir).
function selectSlides(pool) {
  const byCat = {};
  for (const c of pool) (byCat[c.sliderCategory] ||= []).push(c);
  const cats = Object.keys(byCat);
  const out = [];
  for (let i = 0; i < 2; i++) for (const cat of cats) if (byCat[cat][i]) out.push(byCat[cat][i]);
  return out.length ? out : pool.slice(0, 6);
}

export default function HeroCarousel({ sliderPool = [], version }) {
  const slides = useMemo(() => selectSlides(sliderPool), [sliderPool]);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  // Skin durumu: id -> [{num,name,splash}], id -> seçili index
  const [skins, setSkins] = useState({});
  const [skinIdx, setSkinIdx] = useState({});
  const total = slides.length;

  const go = useCallback((n) => setI((p) => (n + total) % total), [total]);

  useEffect(() => {
    if (paused || total <= 1) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setI((p) => (p + 1) % total), 5200);
    return () => clearInterval(id);
  }, [paused, total, resetKey]);

  function jump(n) {
    setI(n);
    setResetKey((k) => k + 1);
  }

  async function ensureSkins(id) {
    if (skins[id]) return skins[id];
    try {
      const res = await fetch(`${API_BASE}/champions/${id}`);
      const data = await res.json();
      const list = Array.isArray(data?.champion?.skins) ? data.champion.skins : [];
      setSkins((s) => ({ ...s, [id]: list }));
      return list;
    } catch {
      setSkins((s) => ({ ...s, [id]: [] }));
      return [];
    }
  }

  // Splash'a tıkla → rastgele kostüm
  async function randomSkin(id) {
    const list = await ensureSkins(id);
    if (list.length <= 1) return;
    const cur = skinIdx[id] ?? 0;
    let next = cur;
    while (next === cur) next = Math.floor(Math.random() * list.length);
    setSkinIdx((m) => ({ ...m, [id]: next }));
  }

  function pickSkin(id, idx) {
    setSkinIdx((m) => ({ ...m, [id]: idx }));
  }

  function splashFor(s) {
    const list = skins[s.id];
    const idx = skinIdx[s.id];
    if (list && idx != null && list[idx]) return list[idx].splash;
    return s.latestSkinSplash || s.splash;
  }

  if (total === 0) {
    return (
      <div className="hero-stage" data-reveal style={{ display: "grid", placeItems: "center", minHeight: 416 }}>
        <span className="dim mono" style={{ fontSize: 13 }}>Öne çıkan şampiyon verisi yok</span>
      </div>
    );
  }

  const cur = slides[i];

  return (
    <div
      className="hero-stage"
      data-reveal
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {slides.map((s, idx) => {
        const role = primaryRole(s.positions);
        const skinList = skins[s.id];
        const activeSkin = skinIdx[s.id] ?? 0;
        return (
          <div key={s.id + s.sliderCategory} className={"hero-slide" + (idx === i ? " active" : "")} aria-hidden={idx !== i}>
            <div className="hero-art" onClick={() => randomSkin(s.id)} title="Kostümü değiştir (tıkla)">
              {splashFor(s) && <img src={splashFor(s)} alt={s.name} />}
              {idx === i && skinList && skinList.length > 1 && (
                <div className="skin-picker" onClick={(e) => e.stopPropagation()}>
                  <div className="skin-dots">
                    {skinList.map((sk, di) => (
                      <button
                        key={sk.num}
                        className={activeSkin === di ? "on" : ""}
                        onClick={() => pickSkin(s.id, di)}
                        title={sk.name}
                        aria-label={sk.name}
                      />
                    ))}
                  </div>
                  <span className="skin-name mono">{skinList[activeSkin]?.name}</span>
                </div>
              )}
            </div>
            <div className="hero-info">
              <span className="hero-tag">
                <span className="dot-mark" />
                {s.sliderCategory} #{s.sliderRank}
              </span>
              <div className="hero-name">{s.name}</div>
              <div className="hero-sub">
                {s.title}
                {role ? ` · ${role}` : ""}
              </div>
              <div className="hero-stats">
                <div className="hero-stat">
                  <div className="hs-val up">{pctTR(s.winRate)}</div>
                  <div className="hs-lab">Win Rate</div>
                </div>
                <div className="hero-stat">
                  <div className="hs-val">{pctTR(s.pickRate)}</div>
                  <div className="hs-lab">Pick</div>
                </div>
                <div className="hero-stat">
                  <div className="hs-val">{pctTR(s.banRate)}</div>
                  <div className="hs-lab">Ban</div>
                </div>
              </div>
              <div className="hero-cta">
                <Link className="btn btn-primary" href={`/champions/${s.id}`}>
                  Şampiyonu İncele
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </Link>
                <Link className="btn btn-ghost" href={`/champions/${s.id}`}>Build &amp; Runes</Link>
              </div>
            </div>
          </div>
        );
      })}

      <div className="hero-wr">
        <div className="wr-num">{pctTR(cur.winRate)}</div>
        <div className="wr-lab">WIN RATE</div>
      </div>

      {total > 1 && (
        <>
          <button className="hero-nav prev" onClick={() => { go(i - 1); setResetKey((k) => k + 1); }} aria-label="Önceki">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <button className="hero-nav next" onClick={() => { go(i + 1); setResetKey((k) => k + 1); }} aria-label="Sonraki">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M9 6l6 6-6 6" /></svg>
          </button>
          <div className="hero-dots">
            {slides.map((_, idx) => (
              <button key={idx} className={idx === i ? "on" : ""} onClick={() => jump(idx)} aria-label={`Slayt ${idx + 1}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
