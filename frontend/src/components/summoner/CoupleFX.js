"use client";

/*
  Couple profil arka plan efekti — yalnız couple hesaplarda render edilir.
  Minimal & subtle: içeriğin ARKASINDA (z-index düşük), az sayıda büyük/soft/soluk
  kalp yavaşça yükselir. UX'e dokunmaz (pointer-events yok, cursor değişmez).
  Deterministik konum → SSR-safe.
*/

// 7 büyük, soft, soluk kalp — arka plan ambiyansı (kalabalık/yapay değil)
const HEARTS = Array.from({ length: 7 }, (_, i) => ({
  left: 8 + (i * 79) % 84,             // %8-92 arası yayılım
  delay: -((i * 3.1) % 18).toFixed(2), // negatif → açılışta bazıları yolda
  dur: (16 + (i % 5) * 2).toFixed(1),  // 16-24s (yavaş)
  size: 34 + (i % 4) * 16,             // 34-82px (büyük)
  opacity: 0.14 + (i % 3) * 0.05,      // 0.14-0.24 (arka planda hafif görünür, soft)
}));

export default function CoupleFX() {
  return (
    <div className="couple-fx" aria-hidden="true">
      {HEARTS.map((h, i) => (
        <span
          key={i}
          className="couple-heart"
          style={{
            left: `${h.left}%`,
            fontSize: `${h.size}px`,
            opacity: h.opacity,
            animationDuration: `${h.dur}s`,
            animationDelay: `${h.delay}s`,
          }}
        >
          ♥
        </span>
      ))}
    </div>
  );
}
