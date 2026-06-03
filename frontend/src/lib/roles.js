/*
  Rol normalizasyonu — backend'den gelen farklı rol gösterimlerini tasarımın
  TR etiket + renk sistemine çevirir.

  Girişler:
    - champion.positions: ["TOP","JUNGLE","MIDDLE","BOTTOM","UTILITY"]
    - leaderboard topRoles[].role: "Top" | "Jungle" | "Mid" | "ADC" | "Support"
  Çıkış TR etiket: Top | Orman | Mid | ADC | Destek
*/

const TR_LABEL = {
  TOP: "Top",
  JUNGLE: "Orman", JG: "Orman", ORMAN: "Orman",
  MIDDLE: "Mid", MID: "Mid",
  BOTTOM: "ADC", BOT: "ADC", ADC: "ADC",
  UTILITY: "Destek", SUPPORT: "Destek", SUP: "Destek", DESTEK: "Destek",
};

// Tasarım token'ları (design README "Rol renkleri")
export const ROLE_COLORS = {
  Top: "#e8b44a",
  Orman: "#1fd6a0",
  Mid: "#4f8cff",
  ADC: "#ff5470",
  Destek: "#b06cff",
};

/** Herhangi bir rol/pozisyon değerini TR etikete çevirir (eşleşmezse null). */
export function roleLabel(input) {
  if (!input) return null;
  return TR_LABEL[String(input).toUpperCase()] || null;
}

/** TR etiketten rol rengini verir. */
export function roleColor(label) {
  return ROLE_COLORS[label] || "var(--txt-3)";
}

/**
 * positions dizisinden (veya topRoles dizisinden) birincil rolü seçer.
 * Eleman string ("TOP") ya da nesne ({ role: "Jungle" }) olabilir.
 */
export function primaryRole(positions) {
  if (!positions) return null;
  const arr = Array.isArray(positions) ? positions : [positions];
  for (const p of arr) {
    const label = roleLabel(typeof p === "string" ? p : p?.role);
    if (label) return label;
  }
  return null;
}
