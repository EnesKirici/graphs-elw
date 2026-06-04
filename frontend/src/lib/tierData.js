/*
  PLACEHOLDER (TEST VERİSİ) — Meta tier list için WR / Pick / Ban / tier / counter
  değerleri. Riot API bunları VERMEZ; gerçeği Match-V5 ham maçlarının worker ile
  toplanmasıyla gelecek (op.gg/u.gg/metasrc bunu böyle yapıyor). Bkz. TIER_LIST_PLAN.md.

  Tüm değerler şampiyon+rol+patch'ten deterministik üretilir (her render aynı kalsın,
  gerçekmiş gibi görünsün). Gerçek veri gelince bu dosyayı gerçek kaynakla değiştir.
*/

export const TIER_ROLES = [
  { key: "TOP", label: "Top", icon: "/roles/top.svg" },
  { key: "JUNGLE", label: "Jungle", icon: "/roles/jungle.svg" },
  { key: "MIDDLE", label: "Mid", icon: "/roles/mid.svg" },
  { key: "BOTTOM", label: "ADC", icon: "/roles/bot.svg" },
  { key: "SUPPORT", label: "Support", icon: "/roles/support.svg" },
];

// DataDragon class etiketinden kaba rol (positions boşsa fallback)
const TAG_ROLE = {
  Marksman: "BOTTOM",
  Support: "SUPPORT",
  Mage: "MIDDLE",
  Assassin: "MIDDLE",
  Tank: "TOP",
  Fighter: "TOP",
};

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// seed'den deterministik 0..1
function rand01(seed) {
  let x = hashStr(String(seed));
  x ^= x << 13; x >>>= 0;
  x ^= x >> 17;
  x ^= x << 5; x >>>= 0;
  return x / 4294967295;
}

// Şampiyonun bir roldeki test istatistikleri
export function champStats(id, role, patch = "16.11") {
  const b = `${id}|${role}|${patch}`;
  const wr = +(45 + rand01(b + "w") * 11).toFixed(1);     // 45–56
  const pick = +(0.4 + rand01(b + "p") * 15).toFixed(1);  // 0.4–15.4
  const ban = +(0.2 + rand01(b + "n") * 20).toFixed(1);   // 0.2–20.2
  // Tier skoru — WR ağırlıklı + biraz pick + gürültü
  const score = (wr - 50) * 6 + pick * 1.1 + (rand01(b + "s") - 0.5) * 5;
  return { wr, pick, ban, score };
}

// Roldeki şampiyonları skora göre sırala + tier ata (S/A/B/C/D, kuantil)
export function buildRoleTiers(champions, role, patch = "16.11") {
  const inRole = champions.filter((c) => {
    const pos = c.positions || [];
    if (pos.length) return pos.includes(role);
    const tag = (c.tags || [])[0];
    return TAG_ROLE[tag] === role;
  });

  const withStats = inRole
    .map((c) => ({ ...c, stats: champStats(c.id, role, patch) }))
    .sort((a, b) => b.stats.score - a.stats.score);

  const total = withStats.length;
  withStats.forEach((c, i) => {
    const pct = total > 1 ? i / (total - 1) : 0;
    c.tier = pct <= 0.08 ? "S" : pct <= 0.25 ? "A" : pct <= 0.5 ? "B" : pct <= 0.78 ? "C" : "D";
  });

  return withStats;
}

// Bir şampiyona karşı en iyi 4 counter (test) — aynı rol havuzundan
export function champCounters(id, role, rolePool, patch = "16.11") {
  const others = rolePool.filter((c) => c.id !== id);
  const scored = others
    .map((c) => ({ c, k: rand01(`${id}${c.id}${role}${patch}`) }))
    .sort((a, b) => a.k - b.k)
    .slice(0, 4);
  return scored.map(({ c }) => ({
    champ: c,
    wr: +(52 + rand01(`${id}${c.id}cw`) * 10).toFixed(1), // counter'ın bu şampiyona karşı WR'si
  }));
}

export const TIER_META = {
  S: { label: "S", color: "#f59e0b", ring: "border-amber-400/70", text: "text-amber-400" },
  A: { label: "A", color: "#a855f7", ring: "border-purple-400/60", text: "text-purple-400" },
  B: { label: "B", color: "#3b82f6", ring: "border-blue-400/60", text: "text-blue-400" },
  C: { label: "C", color: "#10b981", ring: "border-emerald-400/50", text: "text-emerald-400" },
  D: { label: "D", color: "#6b7280", ring: "border-gray-500/50", text: "text-gray-400" },
};
