// Bilgilendirme/uyarı kutusu (ikon + metin) — canlı-yumuşak palet (tones.js).

import { toneOf } from "./tones";

const ICONS = {
  info: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  success: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  warn: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  danger: "M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z",
};
const TONE_MAP = { info: "azure", success: "mint", warn: "gold", danger: "rose" };

export default function InfoNote({ tone = "info", title, children, className = "" }) {
  const t = toneOf(TONE_MAP[tone] || "azure");
  return (
    <div
      className={`rounded-2xl border p-4 flex items-start gap-3 ${className}`}
      style={{ borderColor: t.bd, background: t.bg }}
    >
      <svg className="w-5 h-5 shrink-0 mt-0.5" style={{ color: t.fg }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[tone] || ICONS.info} />
      </svg>
      <div className="min-w-0">
        {title && <p className="text-sm font-medium text-gray-100">{title}</p>}
        {children && <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{children}</p>}
      </div>
    </div>
  );
}
