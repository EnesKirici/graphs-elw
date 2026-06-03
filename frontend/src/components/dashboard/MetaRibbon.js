"use client";

import AnimatedCounter from "./AnimatedCounter";
import { compactTR } from "./primitives";

/*
  Meta istatistik şeridi — 4 sayaç.
  Gerçek kaynak: /meta/stats (matchesAnalyzed, trackedPlayers) + /meta/dashboard
  (championCount, patch). Sayaçlar animasyonlu; patch metin olarak.
*/
export default function MetaRibbon({ matchesAnalyzed, trackedPlayers, championCount, patch }) {
  const stats = [
    { label: "Analiz Edilen Maç", value: matchesAnalyzed ?? 0, format: compactTR, duration: 1500 },
    { label: "Takip Edilen Oyuncu", value: trackedPlayers ?? 0, format: compactTR, duration: 1650 },
    { label: "Aktif Şampiyon", value: championCount ?? 0, format: (n) => Math.round(n).toLocaleString("tr-TR"), duration: 1400 },
    { label: "Güncel Patch", text: patch || "—" },
  ];

  return (
    <div className="section meta-ribbon" data-reveal style={{ "--d": 120 }}>
      {stats.map((s) => (
        <div key={s.label} className="card meta-stat">
          <div className="ms-val">
            {s.text != null ? s.text : <AnimatedCounter value={s.value} duration={s.duration} format={s.format} />}
          </div>
          <div className="ms-lab">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
