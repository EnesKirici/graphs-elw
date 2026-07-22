"use client";

import { useState } from "react";
import Tooltip from "./Tooltip";

/*
  Eşya tooltip'i — dpm.lol tarzı: başlıkta ikon + isim + altın,
  stat satırları kendi renginde kalın değerle, pasifler ayrı bölümde.
  item.desc backend'de parseItemDescription ile hazırlanır: { stats: [], passives: [{name, desc}] }.
*/

// Stat etiketine göre renk (DDragon tr_TR adları). Sıra önemli: özgül olan önce.
const STAT_COLORS = [
  ["Saldırı Gücü", "text-orange-400"],
  ["Yetenek Gücü", "text-purple-400"],
  ["Saldırı Hızı", "text-amber-300"],
  ["Kritik", "text-red-400"],
  ["Yetenek Hızı", "text-sky-300"],
  ["Yetenek İvmesi", "text-sky-300"],
  ["Büyü Direnci", "text-cyan-300"],
  ["Zırh Delme", "text-orange-300"],
  ["Zırh", "text-yellow-300"],
  ["Büyü Nüfuzu", "text-violet-300"],
  ["Can Yenilenmesi", "text-emerald-300"],
  ["Can", "text-green-400"],
  ["Mana Yenilenmesi", "text-blue-300"],
  ["Mana", "text-blue-400"],
  ["Hareket Hızı", "text-gray-100"],
  ["Yaşam Çalma", "text-rose-400"],
  ["Vampirizm", "text-rose-400"],
  ["İyileştirme", "text-emerald-300"],
  ["Kalkan", "text-emerald-300"],
];

function statColor(label) {
  for (const [key, cls] of STAT_COLORS) if (label.includes(key)) return cls;
  return "text-blue-300";
}

// "+45 Saldırı Gücü" → ["+45", "Saldırı Gücü"]; "%12 Omnivamp" gibi varyasyonları da yakalar
function splitStat(line) {
  const m = line.match(/^(\+?\s*%?[\d.,]+\s*%?)\s*(.*)$/);
  return m ? [m[1].replace(/\s+/g, ""), m[2]] : [null, line];
}

export default function ItemTooltip({ item, size = 30, imgClass = "" }) {
  const [anchor, setAnchor] = useState(null);

  if (!item) {
    return <div style={{ width: size, height: size }} className="rounded bg-edge" />;
  }

  const stats = item.desc?.stats || [];
  const passives = item.desc?.passives || [];

  return (
    <>
      <img
        src={item.image}
        alt={item.name}
        width={size}
        height={size}
        className={`rounded cursor-pointer ${imgClass}`}
        onMouseEnter={(e) => setAnchor(e.currentTarget)}
        onMouseLeave={() => setAnchor(null)}
      />
      {anchor && (
        <Tooltip anchorEl={anchor}>
          <div className="tip-dark bg-[#0e131b] border border-edge rounded-xl shadow-2xl shadow-black/90 w-64 overflow-hidden">
            {/* Başlık: ikon + isim + altın */}
            <div className="flex items-center gap-2.5 p-3">
              <img src={item.image} alt="" width={38} height={38} className="rounded-lg border border-edge/60 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-white leading-tight truncate">{item.name}</p>
                {item.gold > 0 && (
                  <p className="text-[12px] font-semibold text-amber-400 leading-tight mt-0.5">
                    {item.gold.toLocaleString("tr-TR")}g
                  </p>
                )}
              </div>
            </div>

            {/* Statlar — değer kendi renginde kalın */}
            {stats.length > 0 && (
              <div className="px-3 pb-3 space-y-[3px]">
                {stats.map((s, j) => {
                  const [val, label] = splitStat(s);
                  return (
                    <p key={j} className="text-[11px] leading-snug">
                      {val && <span className={`font-bold ${statColor(label)}`}>{val} </span>}
                      <span className="text-gray-300">{label}</span>
                    </p>
                  );
                })}
              </div>
            )}

            {/* Pasifler */}
            {passives.length > 0 && (
              <div className="border-t border-edge/60 bg-soft/20 px-3 py-2.5 space-y-2">
                {passives.map((p, j) => (
                  <div key={j}>
                    <p className="text-[11px] font-semibold text-amber-300">{p.name}</p>
                    {p.desc && <p className="text-[10px] text-gray-400 leading-relaxed mt-0.5">{p.desc}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Tooltip>
      )}
    </>
  );
}
