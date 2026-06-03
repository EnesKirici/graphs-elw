"use client";

import { useState, useRef, useEffect } from "react";
import { Palette } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

/* Topbar tema rengi seçici — palet butonu + accent swatch popover'ı. */
export default function ThemePicker() {
  const { accent, setAccent, accents } = useTheme();
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
        </div>
      )}
    </div>
  );
}
