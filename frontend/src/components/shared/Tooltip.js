"use client";

import ReactDOM from "react-dom";

/* Çapa elemanının üstünde açılan portal tooltip.
   edgeGuard: üstte yer yoksa alta çevirir ve yatayda ekran kenarına yapışmayı
   engeller (ızgara gibi kenara yakın çok elemanlı yerlerde şart). Varsayılan
   kapalı → mevcut kullanımların konumu birebir aynı kalır. */
export default function Tooltip({ anchorEl, children, edgeGuard = false, minSpaceAbove = 200 }) {
  if (!anchorEl || typeof window === "undefined") return null;
  const rect = anchorEl.getBoundingClientRect();

  const flip = edgeGuard && rect.top < minSpaceAbove;
  const centerX = rect.left + rect.width / 2;
  const left = edgeGuard ? Math.min(Math.max(centerX, 110), window.innerWidth - 110) : centerX;

  return ReactDOM.createPortal(
    <div
      className="fixed z-[9999] pointer-events-none"
      style={{
        top: flip ? `${rect.bottom + 8}px` : `${rect.top - 8}px`,
        left: `${left}px`,
        transform: flip ? "translate(-50%, 0)" : "translate(-50%, -100%)",
      }}
    >
      {children}
    </div>,
    document.body
  );
}
