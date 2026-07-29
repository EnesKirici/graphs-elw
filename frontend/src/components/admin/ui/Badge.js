// Tek tip durum rozeti — muted tonlar (tones.js). Neon değil, yumuşak.

import { toneOf } from "./tones";

export default function Badge({ children, tone = "neutral", dot = false, className = "" }) {
  const t = toneOf(tone);
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border ${className}`}
      style={{ color: t.fg, background: t.bg, borderColor: t.bd }}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.dot }} />}
      {children}
    </span>
  );
}
