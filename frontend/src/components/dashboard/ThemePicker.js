"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Palette, HelpCircle, Swords } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useBackground } from "@/context/BackgroundContext";

/* (?) arka plan yardımı — hover'da panelin üstüne gelince de açık kalır (kapanmaz). */
function BgHelp({ background, removeBg }) {
  const [hover, setHover] = useState(false);
  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <HelpCircle size={13} style={{ cursor: "help", color: "var(--txt-3)" }} />
      {hover && (
        <div
          className="absolute z-50 py-3"
          // (?)'e bitişik (gap yok) + sol köprü padding → mouse boşlukta kalmaz, hover'da açık kalır.
          style={{ right: "100%", top: -10, width: 248, paddingLeft: 24, paddingRight: 14, background: "var(--bg-1)", border: "1px solid var(--border-strong)", borderRadius: 12, boxShadow: "0 18px 50px rgba(0,0,0,.6)", textTransform: "none" }}
        >
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--txt)", marginBottom: 7 }}>Arka plan nasıl seçilir?</p>
          <p style={{ fontSize: 11.5, color: "var(--txt-2)", lineHeight: 1.6, marginBottom: 10, fontWeight: 400 }}>
            Bir şampiyonun kostümünü (splash art) arka plan yapabilirsin:
            <br />1. <b style={{ color: "var(--txt)" }}>Şampiyonlar</b> sayfasına gir
            <br />2. Bir şampiyon seç
            <br />3. Kostüm galerisinde <b style={{ color: "var(--txt)" }}>arka plan yap</b>
          </p>
          <Link href="/champions" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>
            <Swords size={13} /> Şampiyonlar sayfasına git →
          </Link>
          {background && (
            <button
              onClick={removeBg}
              style={{ display: "block", marginTop: 11, paddingTop: 10, borderTop: "1px solid var(--border)", width: "100%", textAlign: "left", fontSize: 11, color: "var(--txt-3)", fontWeight: 400 }}
            >
              Arka planı tamamen kaldır
            </button>
          )}
        </div>
      )}
    </span>
  );
}

/* Topbar tema seçici — accent rengi + arka plan (görsel/bulanıklık/perde) + saydam kartlar.
   Hepsi kullanıcının tarayıcısında saklanır (localStorage, ThemeContext/BackgroundContext). */
export default function ThemePicker() {
  const { accent, setAccent, accents, bgBlur, setBgBlur, glassCards, setGlassCards, bgVeil, setBgVeil } = useTheme();
  const { background, enabled, toggleEnabled, removeBg } = useBackground();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button className="tb-pill" onClick={() => setOpen((o) => !o)} title="Tema rengi" style={{ gap: 7 }}>
        <Palette size={15} />
        <span style={{ width: 11, height: 11, borderRadius: 4, background: "var(--accent)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.2)" }} />
      </button>
      {open && (
        <div className="theme-pop">
          <div className="theme-pop-title">Tema Rengi</div>
          <div className="theme-swatches">
            {accents.map((a) => (
              <button
                key={a.id}
                className={"swatch" + (a.value === accent ? " on" : "")}
                title={a.label}
                aria-label={a.label}
                onClick={() => setAccent(a.value)}
                style={{ background: a.value }}
              />
            ))}
          </div>

          {/* Arka plan görseli aç/kapa — kostüm splash'ını site arka planı yapma (silmeden gizle/göster) */}
          <div className="theme-pop-title" style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 6 }}>
            Arka Plan Görseli
            <BgHelp background={background} removeBg={removeBg} />
          </div>
          <button
            className="tb-pill"
            onClick={background ? toggleEnabled : undefined}
            title={background ? (enabled ? "Arka planı gizle" : "Arka planı göster") : "Şampiyonlar'dan bir kostüm seç (?)"}
            style={{ height: 30, width: "100%", justifyContent: "space-between", opacity: background ? 1 : 0.6, cursor: background ? "pointer" : "default" }}
          >
            <span>{background ? "Arka plan görseli" : "Seçili arka plan yok"}</span>
            <span style={{ color: background && enabled ? "var(--accent)" : "var(--txt-3)", fontWeight: 800 }}>
              {!background ? "—" : enabled ? "Açık" : "Kapalı"}
            </span>
          </button>

          {/* Arka plan görseli bulanıklığı (kostüm koyulunca anlamlı) */}
          <div className="theme-pop-title" style={{ marginTop: 14 }}>Arka Plan Bulanıklığı</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="range"
              min={0}
              max={20}
              step={2}
              value={bgBlur}
              onChange={(e) => setBgBlur(Number(e.target.value))}
              className="stat-slider"
              style={{ width: 132 }}
              aria-label="Arka plan bulanıklığı"
            />
            <span className="mono" style={{ fontSize: 11, color: "var(--txt-2)", minWidth: 40, textAlign: "right" }}>
              {bgBlur === 0 ? "Kapalı" : `${bgBlur}px`}
            </span>
          </div>

          {/* Zemin perdesi — arka plan görseli üstündeki örtü (light'ta beyazlık,
              dark'ta karartma). Kapatınca görsel tam canlılığında. */}
          <button
            className="tb-pill"
            onClick={() => setBgVeil(!bgVeil)}
            style={{ height: 30, width: "100%", justifyContent: "space-between", marginTop: 10 }}
          >
            <span>Zemin perdesi</span>
            <span style={{ color: bgVeil ? "var(--accent)" : "var(--txt-3)", fontWeight: 800 }}>
              {bgVeil ? "Açık" : "Kapalı"}
            </span>
          </button>

          {/* Saydam kartlar — arka plan görseli kartların içinden süzülür */}
          <div className="theme-pop-title" style={{ marginTop: 14 }}>Kartlar</div>
          <button
            className="tb-pill"
            onClick={() => setGlassCards(!glassCards)}
            style={{ height: 30, width: "100%", justifyContent: "space-between" }}
          >
            <span>Saydam kartlar</span>
            <span style={{ color: glassCards ? "var(--accent)" : "var(--txt-3)", fontWeight: 800 }}>
              {glassCards ? "Açık" : "Kapalı"}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
