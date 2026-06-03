"use client";

import { useBackground } from "@/context/BackgroundContext";

/*
  Tasarım arka plan atmosferi: radial accent glow + ince ızgara + yukarı süzülen
  partiküller. Kullanıcı özel arka plan görseli seçtiyse (BackgroundContext)
  atmosfer gizlenir ki özel görsel bozulmasın.
  Partikül konumları deterministik (hydration uyumsuzluğu olmasın).
*/
const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  left: (i * 53) % 100,
  top: (i * 31 + 7) % 100,
  delay: ((i * 0.9) % 14).toFixed(2),
}));

export default function BackgroundFX() {
  const { background, ready } = useBackground();
  if (!ready || background) return null;

  return (
    <div className="bg-fx" aria-hidden="true">
      <div className="bg-grid" />
      <div className="bg-particles">
        {PARTICLES.map((p, i) => (
          <i key={i} style={{ left: `${p.left}%`, top: `${p.top}%`, animationDelay: `${p.delay}s` }} />
        ))}
      </div>
    </div>
  );
}
