// Pro rank kutusu yardımcıları — RankCard'daki placeholder mantığının kopyası
// (eski RankCard'a dokunmadan) + LP mutlak/ters dönüşümleri.

export function rankBadgeUrl(tier) {
  return `/ranks/badges/${(tier || "").toLowerCase()}.webp`;
}

// Riot resmi mini-crest ikonları (CommunityDragon) — küçük tier amblemleri için.
// SVG sürümü tüm tier'ları içerir (Emerald dahil).
const MINI_CREST_BASE = "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-mini-crests";
export function miniCrestUrl(tier) {
  return `${MINI_CREST_BASE}/${(tier || "unranked").toLowerCase()}.svg`;
}

// İçerik İngilizce (kullanıcı tercihi); obje adı geriye-uyum için TIER_TR kaldı.
export const TIER_TR = {
  IRON: "Iron", BRONZE: "Bronze", SILVER: "Silver", GOLD: "Gold",
  PLATINUM: "Platinum", EMERALD: "Emerald", DIAMOND: "Diamond",
  MASTER: "Master", GRANDMASTER: "Grandmaster", CHALLENGER: "Challenger",
};

export function tierLabel(data) {
  if (!data?.tier) return "";
  const t = data.tier.toUpperCase();
  const name = TIER_TR[t] || data.tier;
  // Master/GM/Challenger'da bölüm (I/II/III/IV) YOKTUR.
  if (["MASTER", "GRANDMASTER", "CHALLENGER"].includes(t)) return name;
  return name + (data.rank ? ` ${data.rank}` : "");
}

// Tier renkleri — LP grafiği çizgisi + tooltip bunlarla renklenir.
export const TIER_COLORS = {
  IRON: "#8a8a8a",
  BRONZE: "#cd7f32",
  SILVER: "#9fb0bd",
  GOLD: "#e8b44a",
  PLATINUM: "#3fc7c7",   // teal/cyan
  EMERALD: "#2fd07e",    // yeşil
  DIAMOND: "#5a8fe6",    // mavi
  MASTER: "#c264e0",     // mor
  GRANDMASTER: "#e05555", // kırmızı
  CHALLENGER: "#2cc9e6", // cyan (tek renk; gradient değil)
};

export function tierColor(tier) {
  return TIER_COLORS[(tier || "").toUpperCase()] || "#22d3ee";
}

/* PLACEHOLDER (TEST VERİSİ) — bkz. PROFILE_RANKINGS_PLAN.md. RankCard ile aynı. */
const TIER_BASE_TOP = { IRON: 95, BRONZE: 80, SILVER: 62, GOLD: 46, PLATINUM: 34, EMERALD: 18, DIAMOND: 7, MASTER: 1.5, GRANDMASTER: 0.4, CHALLENGER: 0.05 };
const DIV_ADJ = { IV: 3, III: 1.5, II: 0, I: -2 };

export function placeholderLeagueRank(data) {
  const base = TIER_BASE_TOP[(data.tier || "").toUpperCase()] ?? 50;
  const adj = DIV_ADJ[data.rank] ?? 0;
  const topPct = Math.max(0.05, Math.round((base + adj - (data.lp || 0) / 100 * 1.4) * 10) / 10);
  const global = Math.round((topPct / 100) * 9_000_000);
  const tr = Math.round((topPct / 100) * 470_000);
  return { topPct, global, tr };
}

// LP mutlak/ters dönüşümleri — backend MatchStatisticsService ile aynı tablo.
const TBASE = { IRON: 0, BRONZE: 400, SILVER: 800, GOLD: 1200, PLATINUM: 1600, EMERALD: 2000, DIAMOND: 2400, MASTER: 2800, GRANDMASTER: 2800, CHALLENGER: 2800 };
const RANKOFF = { IV: 0, III: 100, II: 200, I: 300 };

export function rankToAbsolute(tier, rank, lp) {
  const t = (tier || "").toUpperCase();
  const base = TBASE[t] ?? 0;
  if (["MASTER", "GRANDMASTER", "CHALLENGER"].includes(t)) return base + (lp || 0);
  return base + (RANKOFF[rank] ?? 0) + (lp || 0);
}

export function absoluteToDisplay(abs) {
  if (abs >= 2800) return { tier: "MASTER", rank: "", lp: Math.round(abs - 2800) };
  const order = [["IRON", 0], ["BRONZE", 400], ["SILVER", 800], ["GOLD", 1200], ["PLATINUM", 1600], ["EMERALD", 2000], ["DIAMOND", 2400]];
  let tier = "IRON", base = 0;
  for (const [t, b] of order) { if (abs >= b) { tier = t; base = b; } }
  const within = abs - base;
  const divIdx = Math.min(3, Math.floor(within / 100));
  return { tier, rank: ["IV", "III", "II", "I"][divIdx], lp: Math.round(within - divIdx * 100) };
}
