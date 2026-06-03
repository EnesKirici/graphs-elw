"use client";

import { useState, useEffect, useRef } from "react";

/*
  Sayı sayacı (ease-out cubic).
  Güvenlik: başlangıç değeri = hedef → animasyon çalışmasa bile doğru sayı görünür;
  ayrıca süre+200ms'de final değere set edilir (rAF throttle'a karşı).
*/
export default function AnimatedCounter({
  value,
  duration = 1500,
  format = (n) => Math.round(n).toLocaleString("tr-TR"),
  play = true,
  className,
}) {
  const [n, setN] = useState(value);
  const raf = useRef(0);

  useEffect(() => {
    if (!play) {
      setN(value);
      return;
    }
    const start = performance.now();
    setN(0);
    const animate = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(value * eased);
      if (p < 1) raf.current = requestAnimationFrame(animate);
    };
    raf.current = requestAnimationFrame(animate);
    const safety = setTimeout(() => setN(value), duration + 200);
    return () => {
      cancelAnimationFrame(raf.current);
      clearTimeout(safety);
    };
  }, [value, play, duration]);

  return <span className={className}>{format(n)}</span>;
}
