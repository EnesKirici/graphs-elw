"use client";

import { useState } from "react";
import Link from "next/link";
import Tooltip from "@/components/shared/Tooltip";
import { DD_CDN } from "@/lib/ddragon";
import { TIER_META, ROLE_ICON, ROLE_LABEL, wrTone, banTone, tileLanes } from "@/lib/tierData";

/* Şampiyon karesi: kare ikon değil, DİKEY karakter görseli (ddragon loading art).
   Üstte sanat + koridor rozet(ler)i, altta kazanma oranı ve isim.

   Detay iki yoldan verilir:
   - fare olan cihazda hover kartı (seçilme/banlanma/maç),
   - dokunmatikte hover diye bir şey yok ve tıklamak şampiyon sayfasına gidiyor
     → aynı bilgiler kartın altında kalıcı bir satır olarak gösterilir (.tl-tile-extra,
     CSS'te yalnız hover'sız/dar ekranda görünür). Böylece telefonda bilgi kaybolmuyor. */
export default function ChampTile({ c, role }) {
  const [anchor, setAnchor] = useState(null);
  const rs = c.rs;
  const meta = TIER_META[rs.tier];
  const lanes = tileLanes(c, role);
  // İki koridor gösteriliyorsa kartın büyük WR'i o ikisinin KARIŞIMI (roles.ALL) —
  // ne biri ne öbürü. Rozetin native title'ı ve tooltip'in alt satırı o koridorun
  // KENDİ gerçek WR'ini gösterir (c.roles[pos]) — hangi sayı hangi koridora ait
  // netleşsin diye.
  const multiLane = lanes.length > 1;

  return (
    <>
      <Link
        href={`/champions/${c.id}`}
        className="tl-tile"
        style={{ "--tier": meta?.bar }}
        onMouseEnter={(e) => setAnchor(e.currentTarget)}
        onMouseLeave={() => setAnchor(null)}
        onFocus={(e) => setAnchor(e.currentTarget)}
        onBlur={() => setAnchor(null)}
      >
        <span className="tl-tile-art">
          <img src={`${DD_CDN}/cdn/img/champion/loading/${c.id}_0.jpg`} alt={c.name} loading="lazy" decoding="async" />
          {/* Çift koridor oynanan şampiyonlarda iki rozet (bkz. tileLanes) */}
          <span className="tl-tile-lanes">
            {lanes.map((l) => {
              const laneWr = c.roles[l.pos]?.wr;
              return ROLE_ICON[l.pos] ? (
                <span
                  key={l.pos}
                  className="tl-tile-lane"
                  title={`${ROLE_LABEL[l.pos]} — %${l.share} pay${laneWr != null ? ` · %${laneWr} kazanma` : ""}`}
                >
                  <img src={ROLE_ICON[l.pos]} alt={ROLE_LABEL[l.pos]} width={15} height={15} />
                </span>
              ) : null;
            })}
          </span>
          {rs.lowSample && <span className="tl-tile-thin" title={`Düşük örneklem — ${rs.games} maç`} />}
        </span>
        <span className="tl-tile-foot">
          <b
            style={{ color: wrTone(rs.wr) }}
            title={multiLane ? `Toplam (${lanes.map((l) => ROLE_LABEL[l.pos]).join(" + ")} birleşik) — ayrı ayrı için karta gel` : undefined}
          >
            %{rs.wr}
          </b>
          <span className="tl-tile-name">{c.name}</span>
          <span className="tl-tile-extra">
            <i>%{rs.pick} seç</i>
            <i style={{ color: banTone(rs.ban) }}>%{rs.ban} ban</i>
          </span>
        </span>
      </Link>

      {anchor && (
        <Tooltip anchorEl={anchor} edgeGuard>
          <div className="tl-tip">
            <div className="tl-tip-head">
              <img src={c.image} alt="" width={38} height={38} />
              <div className="min-w-0">
                <b>{c.name}</b>
                <span>{lanes.map((l) => `${ROLE_LABEL[l.pos]} %${l.share}`).join(" · ")}</span>
              </div>
              <em style={{ color: meta?.color, borderColor: meta?.bar }}>{rs.tier}</em>
            </div>
            <dl className="tl-tip-rows">
              <div><dt>{multiLane ? "Kazanma (toplam)" : "Kazanma"}</dt><dd style={{ color: wrTone(rs.wr) }}>%{rs.wr}</dd></div>
              <div><dt>Seçilme</dt><dd>%{rs.pick}</dd></div>
              <div><dt>Banlanma</dt><dd style={{ color: banTone(rs.ban) }}>%{rs.ban}</dd></div>
              <div><dt>Maç</dt><dd>{rs.games.toLocaleString("tr-TR")}</dd></div>
            </dl>

            {/* İki koridor birden oynanınca üstteki "toplam" sayı ikisinin karışımı —
                hangi koridorun gerçekte ne verdiğini burada ayrı ayrı göster. */}
            {multiLane && (
              <dl className="tl-tip-lanes">
                {lanes.map((l) => {
                  const lr = c.roles[l.pos];
                  if (!lr) return null;
                  return (
                    <div key={l.pos}>
                      <dt>
                        {ROLE_ICON[l.pos] && <img src={ROLE_ICON[l.pos]} alt="" width={15} height={15} />}
                        {ROLE_LABEL[l.pos]}
                        <i>%{l.share} pay</i>
                      </dt>
                      <dd style={{ color: wrTone(lr.wr) }}>%{lr.wr}</dd>
                    </div>
                  );
                })}
              </dl>
            )}
            {rs.lowSample && <p className="tl-tip-note">Örneklem küçük — oran oturmamış olabilir.</p>}
          </div>
        </Tooltip>
      )}
    </>
  );
}
