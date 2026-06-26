/*
  Meta tier list — statik rol + tier görsel tanımları.
  WR / Pick / Ban / tier / koridor dağılımı değerleri artık GERÇEK:
  backend `GET /api/v1/meta/tier-list` (champion_stats agregasyonu).
  (Eski test fonksiyonları champStats/buildRoleTiers/champCounters kaldırıldı.)

  Rol anahtarları backend teamPosition ile birebir: TOP/JUNGLE/MIDDLE/BOTTOM/UTILITY.
*/

export const TIER_ROLES = [
  { key: "ALL", label: "Tümü", icon: null },
  { key: "TOP", label: "Top", icon: "/roles/top.svg" },
  { key: "JUNGLE", label: "Jungle", icon: "/roles/jungle.svg" },
  { key: "MIDDLE", label: "Mid", icon: "/roles/mid.svg" },
  { key: "BOTTOM", label: "ADC", icon: "/roles/bot.svg" },
  { key: "UTILITY", label: "Support", icon: "/roles/support.svg" },
];

// Tier sırası (yüksekten düşüğe): backend S+/S/A/B/C/D üretir.
export const TIER_ORDER = ["S+", "S", "A", "B", "C", "D"];

export const TIER_META = {
  "S+": { label: "S+", color: "#f43f5e", ring: "border-rose-400/70", text: "text-rose-400" },
  S: { label: "S", color: "#f59e0b", ring: "border-amber-400/70", text: "text-amber-400" },
  A: { label: "A", color: "#a855f7", ring: "border-purple-400/60", text: "text-purple-400" },
  B: { label: "B", color: "#3b82f6", ring: "border-blue-400/60", text: "text-blue-400" },
  C: { label: "C", color: "#10b981", ring: "border-emerald-400/50", text: "text-emerald-400" },
  D: { label: "D", color: "#6b7280", ring: "border-gray-500/50", text: "text-gray-400" },
};
