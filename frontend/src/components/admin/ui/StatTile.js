// Tek tip istatistik kutusu (KPI). Muted tonlar (tones.js) — neon değil.
// tone → değer rengi + ince sol accent şeridi. Işıltı/glow yok, sade profesyonel.

import { toneOf } from "./tones";

export default function StatTile({ label, value, hint, tone = "neutral", icon }) {
  const t = toneOf(tone);
  return (
    <div className="relative overflow-hidden rounded-xl border border-edge bg-card/60 p-4">
      <span className="absolute left-0 top-3.5 bottom-3.5 w-[3px] rounded-full" style={{ background: t.bar }} />
      <div className="pl-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-gray-500 uppercase tracking-wider truncate">{label}</p>
          {icon && (
            <svg className="w-4 h-4 text-gray-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
              <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
            </svg>
          )}
        </div>
        <p className="text-2xl font-semibold mt-1.5 tabular-nums" style={{ color: t.fg }}>{value}</p>
        {hint && <p className="text-[11px] text-gray-500 mt-1 leading-snug">{hint}</p>}
      </div>
    </div>
  );
}
