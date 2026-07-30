"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TIER_META, ROLE_LABEL } from "@/lib/tierData";

/* Yamanın öne çıkanları — en üst dereceli şampiyonlar arasında otomatik döner.
   Tek satır: bölümlerin üstünde yer kaplamaz, bağlam verir (SEO metni de burada). */
export default function FeaturedStrip({ pool, role, version }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = pool.length;

  useEffect(() => { setI(0); }, [role, total]);
  useEffect(() => {
    if (paused || total <= 1) return;
    const id = setInterval(() => setI((p) => (p + 1) % total), 5000);
    return () => clearInterval(id);
  }, [paused, total]);

  const f = pool[i];
  if (!f) return null;
  const meta = TIER_META[f.rs.tier];

  return (
    <div
      className="tl-featured"
      style={{ "--tier": meta?.bar }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <Link href={`/champions/${f.id}`} className="tl-featured-art">
        <img src={f.image} alt={f.name} width={44} height={44} key={f.id} />
        <em style={{ background: meta?.bar }}>{f.rs.tier}</em>
      </Link>

      {/* Derece yalnız kazanmadan gelmiyor: ban oranı yüksek şampiyonlarda onu öne al,
          yoksa "%51 kazanma ama en güçlü" tuhaf görünür (ör. Locke — %75 ban). */}
      <p className="tl-featured-txt">
        <Link href={`/champions/${f.id}`}>{f.name}</Link>
        {role === "ALL" ? " tüm koridorlarda" : ` ${ROLE_LABEL[role]} koridorunda`} {version} yamasının öne çıkanlarından —
        {f.rs.ban >= 20 ? (
          <>
            {/* Ana sayfa slider'ındaki "yüksek ban parlıyor" efektiyle aynı sınıf
                (hs-ban-hot, dashboard-theme.css) — burada da aynı kural geçerli. */}
            <b className="hs-ban-hot"> %{f.rs.ban}</b> banlanma, <b>%{f.rs.wr}</b> kazanma
          </>
        ) : (
          <>
            <b> %{f.rs.wr}</b> kazanma, <b>%{f.rs.pick}</b> seçilme
          </>
        )}
        , <b>{f.rs.games.toLocaleString("tr-TR")}</b> maç{f.rs.lowSample ? " (örneklem küçük)" : ""}.
      </p>

      {total > 1 && (
        <div className="tl-featured-dots">
          {pool.map((p, idx) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setI(idx)}
              aria-label={p.name}
              title={p.name}
              data-on={idx === i ? "1" : "0"}
            />
          ))}
        </div>
      )}
    </div>
  );
}
