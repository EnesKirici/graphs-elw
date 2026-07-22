"use client";

import { useState, useEffect } from "react";
import Tooltip from "./Tooltip";

/*
  Tek rün ikonu + hover tooltip'i (isim, ağaç, kısa açıklama).
  Açıklamalar DDragon runesReforged.json'dan (tr_TR) çekilir ve modül düzeyinde
  cache'lenir — backend rün payload'ı sadece {name, icon} taşıdığı için.
  İkon URL'inin "/cdn/img/" sonrası kısmı runesReforged 'icon' alanıyla birebir eşleşir.
*/

let runeMetaPromise = null;
function loadRuneMeta() {
  if (!runeMetaPromise) {
    runeMetaPromise = (async () => {
      try {
        const versions = await fetch("https://ddragon.leagueoflegends.com/api/versions.json").then((r) => r.json());
        const v = versions?.[0];
        const trees = await fetch(`https://ddragon.leagueoflegends.com/cdn/${v}/data/tr_TR/runesReforged.json`).then((r) => r.json());
        const map = new Map();
        for (const tree of trees) {
          map.set(tree.icon, { name: tree.name, desc: "", tree: tree.name });
          for (const slot of tree.slots || []) {
            for (const rune of slot.runes || []) {
              const desc = (rune.shortDesc || "")
                .replace(/<br\s*\/?>/gi, " ")
                .replace(/<[^>]+>/g, "")
                .replace(/@[^@\s]*@/g, "")
                .replace(/\s+/g, " ")
                .trim();
              map.set(rune.icon, { name: rune.name, desc, tree: tree.name });
            }
          }
        }
        return map;
      } catch {
        return new Map();
      }
    })();
  }
  return runeMetaPromise;
}

const iconKey = (url) => {
  const i = url?.indexOf("/cdn/img/") ?? -1;
  return i >= 0 ? url.slice(i + "/cdn/img/".length) : null;
};

export default function RuneTip({ rune, size = 26, ring = false, dim = false }) {
  const [anchor, setAnchor] = useState(null);
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    let active = true;
    if (anchor && rune?.icon) {
      loadRuneMeta().then((map) => { if (active) setMeta(map.get(iconKey(rune.icon)) || null); });
    }
    return () => { active = false; };
  }, [anchor, rune?.icon]);

  if (!rune?.icon) {
    return <span style={{ width: size, height: size }} className="rounded-full bg-edge/40 flex-shrink-0" />;
  }

  return (
    <>
      <img
        src={rune.icon}
        alt={rune.name}
        width={size}
        height={size}
        className={`rounded-full flex-shrink-0 cursor-help ${ring ? "ring-2 ring-amber-400/60 bg-black/40" : ""} ${dim ? "opacity-70" : ""}`}
        onMouseEnter={(e) => setAnchor(e.currentTarget)}
        onMouseLeave={() => setAnchor(null)}
      />
      {anchor && (
        <Tooltip anchorEl={anchor}>
          <div className="tip-dark bg-[#0e131b] border border-edge rounded-xl p-3 shadow-2xl shadow-black/90 w-60">
            <div className="flex items-center gap-2.5">
              <img src={rune.icon} alt="" width={34} height={34} className="rounded-full flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-white leading-tight">{meta?.name || rune.name}</p>
                {meta?.tree && meta.tree !== (meta?.name || rune.name) && (
                  <p className="text-[10px] text-gray-500 leading-tight mt-0.5">{meta.tree}</p>
                )}
              </div>
            </div>
            {meta?.desc && (
              <p className="text-[11px] text-gray-400 leading-relaxed mt-2 border-t border-edge/60 pt-2">{meta.desc}</p>
            )}
          </div>
        </Tooltip>
      )}
    </>
  );
}
