"use client";

import { useState } from "react";
import { Droplet, Droplets, HeartPulse, Zap, CircleDot } from "lucide-react";
import Tooltip from "./Tooltip";

/*
  Eşya tooltip'i — dpm.lol tarzı: başlıkta ikon + isim + altın, stat satırları
  oyunun GERÇEK stat glifleriyle (public/staticons — CommunityDragon statmods)
  + kendi renginde kalın değer; pasifler ayrı bölümde, açıklamalardaki önemli
  kelimeler ([[tip:metin]], backend parseItemDescription üretir) vurgulu basılır.
*/

// Stat etiketi → renk + ikon (DDragon tr_TR adları). Sıra önemli: özgül olan önce.
// icon: /staticons/*.png (resmi LoL glifi) — olmayan statlarda lucide fallback.
const STAT_META = [
  ["Saldırı Gücü", "text-orange-300", "/staticons/ad.png"],
  ["Yetenek Gücü", "text-purple-300", "/staticons/ap.png"],
  ["Saldırı Hızı", "text-amber-200", "/staticons/as.png"],
  ["Kritik", "text-orange-400", "/staticons/crit.png"],
  ["Yetenek Hızı", "text-sky-300", "/staticons/haste.png"],
  ["Yetenek İvmesi", "text-sky-300", "/staticons/haste.png"],
  ["Büyü Direnci", "text-cyan-300", "/staticons/mr.png"],
  ["Zırh Delme", "text-orange-300", Zap],
  ["Zırh", "text-yellow-200", "/staticons/armor.png"],
  ["Büyü Nüfuzu", "text-violet-300", Zap],
  ["Can Yenilenmesi", "text-emerald-300", "/staticons/hpregen.png"],
  ["Can", "text-green-400", "/staticons/hp.png"],
  ["Mana Yenilenmesi", "text-blue-300", Droplet],
  ["Mana", "text-blue-400", Droplet],
  ["Hareket Hızı", "text-gray-100", "/staticons/ms.png"],
  ["Tenas", "text-violet-300", "/staticons/tenacity.png"],
  ["Sıvışma", "text-violet-300", "/staticons/tenacity.png"],
  ["Meşakkat", "text-violet-300", "/staticons/tenacity.png"],
  ["Yaşam Çalma", "text-rose-400", Droplets],
  ["Vampirizm", "text-rose-400", Droplets],
  ["İyileştirme", "text-emerald-300", HeartPulse],
  ["Kalkan", "text-emerald-300", HeartPulse],
];

function statMeta(label) {
  for (const [key, cls, icon] of STAT_META) if (label.includes(key)) return [cls, icon];
  return ["text-blue-300", CircleDot];
}

function StatIcon({ icon, cls }) {
  if (typeof icon === "string") {
    return <img src={icon} alt="" width={18} height={18} className="flex-shrink-0" />;
  }
  const Icon = icon;
  return <Icon size={16} className={`${cls} flex-shrink-0`} />;
}

// "+45 Saldırı Gücü" → ["45", "Saldırı Gücü"] ("+"ı at, gereksiz); "%12" varyasyonları korunur
function splitStat(line) {
  const m = line.match(/^(\+?\s*%?[\d.,]+\s*%?)\s*(.*)$/);
  return m ? [m[1].replace(/\s+/g, "").replace(/^\+/, ""), m[2]] : [null, line];
}

// [[tip:metin]] vurgu işaretleyicileri → renkli/kalın span'lar
const EM_STYLE = {
  ap: "text-purple-300 font-semibold",
  ad: "text-orange-300 font-semibold",
  td: "text-gray-100 font-semibold",
  heal: "text-green-300 font-semibold",
  shield: "text-emerald-300 font-semibold",
  ms: "text-yellow-200 font-semibold",
  as: "text-amber-300 font-semibold",
  kw: "text-gray-100 font-semibold",
};

function DescText({ text }) {
  const nodes = [];
  const re = /\[\[(\w+):([\s\S]*?)\]\]/g;
  let last = 0, m, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    nodes.push(<span key={i++} className={EM_STYLE[m[1]] || EM_STYLE.kw}>{m[2]}</span>);
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return <>{nodes}</>;
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
          <div className="tip-dark bg-[#0e131b] border border-edge rounded-xl shadow-2xl shadow-black/90 w-72 overflow-hidden">
            {/* Başlık: ikon + isim + altın */}
            <div className="flex items-center gap-3 p-3.5">
              <img src={item.image} alt="" width={44} height={44} className="rounded-lg border border-edge/60 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-white leading-tight truncate">{item.name}</p>
                {item.gold > 0 && (
                  <p className="text-[13px] font-semibold text-amber-400 leading-tight mt-1">
                    {item.gold.toLocaleString("tr-TR")}g
                  </p>
                )}
              </div>
            </div>

            {/* Statlar — resmi LoL glifi + kendi renginde kalın değer */}
            {stats.length > 0 && (
              <div className="px-3.5 pb-3.5 space-y-1.5">
                {stats.map((s, j) => {
                  const [val, label] = splitStat(s);
                  const [cls, icon] = statMeta(label);
                  return (
                    <p key={j} className="text-[13px] leading-snug flex items-center gap-1">
                      <StatIcon icon={icon} cls={cls} />
                      {val && <span className={`font-bold ${cls}`}>{val}</span>}
                      <span className="text-gray-200">{label}</span>
                    </p>
                  );
                })}
              </div>
            )}

            {/* Pasifler — açıklamada vurgulu kelimeler */}
            {passives.length > 0 && (
              <div className="border-t border-edge/60 bg-soft/20 px-3.5 py-3 space-y-2.5">
                {passives.map((p, j) => (
                  <div key={j}>
                    <p className="text-[13px] font-semibold text-amber-300">{p.name}</p>
                    {p.desc && (
                      <p className="text-[12px] text-gray-300 leading-relaxed mt-1">
                        <DescText text={p.desc} />
                      </p>
                    )}
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
