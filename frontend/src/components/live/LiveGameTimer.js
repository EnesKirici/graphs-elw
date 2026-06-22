"use client";

import { useEffect, useState } from "react";

/**
 * Canlı oyun süresini yukarı sayar.
 * gameStartTime (ms epoch) varsa ondan; yoksa gameLength'ten (saniye) devam eder.
 * SSR/hydration uyumsuzluğunu önlemek için ilk değer deterministik (gameLength),
 * Date.now() yalnız mount sonrası kullanılır.
 */
export default function LiveGameTimer({ gameStartTime, gameLength }) {
  const [elapsed, setElapsed] = useState(gameLength || 0);

  useEffect(() => {
    const tick = () => {
      if (gameStartTime && gameStartTime > 0) {
        setElapsed(Math.floor((Date.now() - gameStartTime) / 1000));
      } else {
        setElapsed((prev) => prev + 1);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [gameStartTime]);

  if (elapsed < 0) {
    return <span className="tabular-nums">Maç başlıyor…</span>;
  }

  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return (
    <span className="tabular-nums">
      {m}:{String(s).padStart(2, "0")}
    </span>
  );
}
