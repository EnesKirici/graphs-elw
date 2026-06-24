"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { primaryRole } from "@/lib/roles";
import { useBackground } from "@/context/BackgroundContext";
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

// Skin'ler dashboard payload'ıyla (sliderPool[].skins) gelir → ekstra istek yok.
function initSkins(slides) {
  const m = {};
  for (const s of slides) if (Array.isArray(s.skins) && s.skins.length) m[s.id] = s.skins;
  return m;
}

// Slider kategorisine göre vurgu rengi + öne çıkan stat (büyük sayı = şampiyonun
// slider'da olma SEBEBİ). Ban → kırmızı, Popüler → mavi, WR → yeşil (ayarlı WR).
function categoryStyle(category) {
  if (category?.includes("Banlanan")) return { color: "var(--loss)", valueKey: "banRate", label: "BAN" };
  if (category?.includes("Popüler")) return { color: "#4f8cff", valueKey: "pickRate", label: "PICK" };
  return { color: "var(--win)", valueKey: "adjWr", fallback: "winRate", label: "WIN RATE" };
}
function featuredValue(champ, st) {
  const v = champ[st.valueKey];
  return v != null ? v : st.fallback ? champ[st.fallback] : v;
}

export default function HeroCarousel({ sliderPool = [], version }) {
  const slides = useMemo(() => selectSlides(sliderPool), [sliderPool]);
  const { setBg } = useBackground();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  // Skin durumu: id -> [{num,name,splash}] (payload'dan seed), id -> seçili index
  const [skins, setSkins] = useState(() => initSkins(slides));
  const [skinIdx, setSkinIdx] = useState({});
  const skinsRef = useRef(null); // anlık okuma için (stale closure'ı önler)
  if (skinsRef.current === null) skinsRef.current = skins;
  const total = slides.length;

  const go = useCallback((n) => setI((p) => (n + total) % total), [total]);

  // Skin'leri çek (cache'li) — döner: liste
  const ensureSkins = useCallback(async (id) => {
    if (!id) return [];
    if (skinsRef.current[id]) return skinsRef.current[id];
    let list = [];
    try {
      const res = await fetch(`${API_BASE}/champions/${id}`);
      const data = await res.json();
      list = Array.isArray(data?.champion?.skins) ? data.champion.skins : [];
    } catch {
      list = [];
    }
    skinsRef.current = { ...skinsRef.current, [id]: list };
    setSkins((s) => ({ ...s, [id]: list }));
    // Şampiyon ilk yüklenince default (index 0) değil, rastgele bir kostüm seç.
    if (list.length > 1) {
      setSkinIdx((m) => (m[id] != null ? m : { ...m, [id]: 1 + Math.floor(Math.random() * (list.length - 1)) }));
    }
    return list;
  }, []);

  useEffect(() => {
    if (paused || total <= 1) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setI((p) => (p + 1) % total), 5200);
    return () => clearInterval(id);
  }, [paused, total, resetKey]);

  // === Splash ön-yükleme ===
  // Kostüm değiştirme/slayt geçişi yavaştı: yeni splash ancak src değişince
  // indirilmeye başlıyordu. Aktif slaytın TÜM kostümlerini arka planda kademeli
  // ısıt (bant genişliğini tek seferde yememek için 250ms arayla, seçili
  // kostümden ileriye doğru) + sıradaki slaytın seçili görselini hemen çek.
  const preloadedRef = useRef(new Set());
  const preload = useCallback((url) => {
    if (!url || preloadedRef.current.has(url)) return;
    preloadedRef.current.add(url);
    const img = new Image();
    img.decoding = "async";
    img.src = url;
  }, []);

  useEffect(() => {
    const s = slides[i];
    if (!s) return;
    const timers = [];

    // Sıradaki slaytın görüneceği splash — geçiş anında hazır olsun
    const nxt = slides[(i + 1) % total];
    if (nxt && nxt !== s) {
      const nl = skins[nxt.id];
      const nidx = skinIdx[nxt.id];
      const url = nl && nidx != null && nl[nidx] ? nl[nidx].splash : (nxt.latestSkinSplash || nxt.splash);
      timers.push(setTimeout(() => preload(url), 100));
    }

    // Aktif slaytın kostümleri — seçiliden ileriye doğru sırayla
    const list = skins[s.id] || [];
    const start = (skinIdx[s.id] ?? 0) + 1;
    list.forEach((_, n) => {
      const sk = list[(start + n) % list.length];
      timers.push(setTimeout(() => preload(sk.splash), 300 + n * 250));
    });

    return () => timers.forEach(clearTimeout);
  }, [i, slides, skins, skinIdx, total, preload]);

  // Mount: her şampiyona rastgele (non-default) kostüm ata. Skin'ler dashboard
  // payload'ıyla geldiği için EKSTRA İSTEK YOK; eksikse fallback ile çekilir.
  useEffect(() => {
    setSkinIdx((prev) => {
      const next = { ...prev };
      for (const s of slides) {
        const list = skinsRef.current[s.id];
        if (list && list.length > 1 && next[s.id] == null) {
          next[s.id] = 1 + Math.floor(Math.random() * (list.length - 1));
        }
      }
      return next;
    });
    // Güvenlik: payload'da skin'i olmayan slayt varsa çek (normalde gerekmez).
    slides.forEach((s) => { if (!skinsRef.current[s.id]?.length) ensureSkins(s.id); });
  }, [slides, ensureSkins]);

  function jump(n) {
    setI(n);
    setResetKey((k) => k + 1);
  }

  // Splash'a tıkla → sıradaki kostüm (sağa doğru)
  async function nextSkin(id) {
    const list = skinsRef.current[id] || (await ensureSkins(id));
    if (!list || list.length <= 1) return;
    setSkinIdx((m) => ({ ...m, [id]: ((m[id] ?? 0) + 1) % list.length }));
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
  const curStyle = categoryStyle(cur.sliderCategory);

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
        const st = categoryStyle(s.sliderCategory);
        return (
          <div key={s.id + s.sliderCategory} className={"hero-slide" + (idx === i ? " active" : "")} aria-hidden={idx !== i}>
            <div className="hero-art" onClick={() => nextSkin(s.id)} title="Kostümü değiştir (tıkla)">
              {splashFor(s) && (
                <img
                  src={splashFor(s)}
                  alt={s.name}
                  onError={(e) => {
                    // Yeni şampiyon kostümünün splash'ı CDN'de yoksa (404) varsayılana düş.
                    const fb = s.splash || s.latestSkinSplash;
                    if (fb && e.currentTarget.src !== fb) e.currentTarget.src = fb;
                  }}
                />
              )}

              {idx === i && (
                <button
                  className="hero-bg-btn"
                  onClick={(e) => { e.stopPropagation(); setBg(splashFor(s)); }}
                  title="Bu görseli arka plan yap"
                  aria-label="Arka plan yap"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
              )}

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
              <span
                className="hero-tag"
                style={{
                  color: st.color,
                  background: `color-mix(in oklab, ${st.color} 12%, transparent)`,
                  borderColor: `color-mix(in oklab, ${st.color} 30%, transparent)`,
                }}
              >
                <span className="dot-mark" style={{ background: st.color, boxShadow: `0 0 8px ${st.color}` }} />
                {s.sliderCategory} #{s.sliderRank}
              </span>
              <div className="hero-name">{s.name}</div>
              <div className="hero-sub">
                {s.title}
                {role ? ` · ${role}` : ""}
              </div>
              <div className="hero-stats">
                <div className="hero-stat">
                  <div className="hs-val" style={st.label === "WIN RATE" ? { color: st.color } : undefined}>{pctTR(s.adjWr ?? s.winRate)}</div>
                  <div className="hs-lab">Win Rate</div>
                </div>
                <div className="hero-stat">
                  <div className="hs-val" style={st.label === "PICK" ? { color: st.color } : undefined}>{pctTR(s.pickRate)}</div>
                  <div className="hs-lab">Pick</div>
                </div>
                <div className="hero-stat">
                  <div className="hs-val" style={st.label === "BAN" ? { color: st.color } : undefined}>{pctTR(s.banRate)}</div>
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
        <div className="wr-num" style={{ color: curStyle.color, textShadow: `0 0 26px color-mix(in oklab, ${curStyle.color} 50%, transparent)` }}>{pctTR(featuredValue(cur, curStyle))}</div>
        <div className="wr-lab">{curStyle.label}</div>
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
