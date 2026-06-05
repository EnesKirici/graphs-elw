"use client";

import { useState, useRef, useEffect } from "react";
import { Palette } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

/* Topbar tema seçici — accent rengi + arka plan bulanıklığı + saydam kartlar.
   Hepsi kullanıcının tarayıcısında saklanır (localStorage, ThemeContext). */
export default function ThemePicker() {
  const { accent, setAccent, accents, bgBlur, setBgBlur, glassCards, setGlassCards, bgVeil, setBgVeil } = useTheme();
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
