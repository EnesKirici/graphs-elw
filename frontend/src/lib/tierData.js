/*
  Meta tier list — rol + tier görsel tanımları ve paylaşılan yardımcılar.
  WR / Pick / Ban / tier / koridor dağılımı GERÇEK veriden gelir:
  backend `GET /api/v1/meta/tier-list` (champion_stats agregasyonu).

  Rol anahtarları backend teamPosition ile birebir: TOP/JUNGLE/MIDDLE/BOTTOM/UTILITY.
  Renkler tek kaynaktan (@/lib/tones) — "canlı ama yumuşak" palet, neon değil.
*/

import { TONES } from "@/lib/tones";

export const TIER_ROLES = [
  { key: "ALL", label: "Tümü", icon: null },
  { key: "TOP", label: "Top", icon: "/roles/top.svg" },
  { key: "JUNGLE", label: "Jungle", icon: "/roles/jungle.svg" },
  { key: "MIDDLE", label: "Mid", icon: "/roles/mid.svg" },
  { key: "BOTTOM", label: "ADC", icon: "/roles/bot.svg" },
  { key: "UTILITY", label: "Support", icon: "/roles/support.svg" },
];

export const ROLE_LABEL = Object.fromEntries(TIER_ROLES.map((r) => [r.key, r.label]));
export const ROLE_ICON = Object.fromEntries(TIER_ROLES.filter((r) => r.icon).map((r) => [r.key, r.icon]));

// Tier sırası (yüksekten düşüğe): backend S+/S/A/B/C/D üretir.
export const TIER_ORDER = ["S+", "S", "A", "B", "C", "D"];
export const TIER_RANK = Object.fromEntries(TIER_ORDER.map((t, i) => [t, i]));

/* Tier kimliği — yalnız renk. Harfin yanına açıklama YAZILMAZ: derece harfi zaten
   evrensel, üstüne "güvenli ilk seçimler" gibi etiket koymak hem yer yiyordu hem
   yapay duruyordu. Yerine başlıkta nesnel veri var (kaç şampiyon, kazanma aralığı).
   `color` harf/metin rengi — kutu ve dolgu kalkınca parlak ton "neon" durmuyor,
   aksine mat ton okunmuyordu; `bar` şerit için biraz daha doygun.

   RENK ATAMASI: S+ ÖNCE rose (pembe/kırmızı) idi — tooltipte isim yanında bu rozet
   "S+" yazıyor, hemen altında yüksek bir kazanma % duruyor; kırmızı olunca "yüksek
   kazanma = kırmızı" gibi YANLIŞ okunuyordu, üstelik siteye göre kırmızı zaten başka
   bir anlam taşıyor (bkz. banTone — "banlanma çok yüksek" uyarısı). O yüzden rose'u
   EN KÖTÜ dereceye (D) verdik: "kırmızı = dikkat" anlamı korunuyor ama artık doğru
   yerde. S+ gold aldı (en iyi = "altın" — evrensel, kırmızıyla karışmaz). */
export const TIER_META = {
  "S+": { label: "S+", tone: "gold", color: TONES.gold.fg, bar: TONES.gold.bar, bg: TONES.gold.bg, bd: TONES.gold.bd },
  S: { label: "S", tone: "azure", color: TONES.azure.fg, bar: TONES.azure.bar, bg: TONES.azure.bg, bd: TONES.azure.bd },
  A: { label: "A", tone: "violet", color: TONES.violet.fg, bar: TONES.violet.bar, bg: TONES.violet.bg, bd: TONES.violet.bd },
  B: { label: "B", tone: "mint", color: TONES.mint.fg, bar: TONES.mint.bar, bg: TONES.mint.bg, bd: TONES.mint.bd },
  C: { label: "C", tone: "neutral", color: "#aab2c0", bar: TONES.neutral.bar, bg: TONES.neutral.bg, bd: TONES.neutral.bd },
  D: { label: "D", tone: "rose", color: TONES.rose.fg, bar: TONES.rose.bar, bg: TONES.rose.bg, bd: TONES.rose.bd },
};

/* Bütün dereceler açık gelir — liste tam görünsün, kullanıcı düğmeyle içerik
   açmak zorunda kalmasın. Başlığa tıklamak yine daraltıyor (isteyen kapatır). */
export const TIER_OPEN_DEFAULT = { "S+": true, S: true, A: true, B: true, C: true, D: true };

/* Kazanma oranı rengi — PALET sitenin mevcut konvansiyonuyla ORTAK (ChampPerfListPro /
   Last30Panel: cyan / mavi / mor / kırmızı, yeşil yok) — aynı görsel dil, aynı anlam.
   SAYILAR ise kasıtlı olarak farklı (2026-07-30, kullanıcı talebi + veriyle doğrulandı):
   profildeki eşikler bir OYUNCUNUN son 20-30 maçı gibi gürültülü/küçük örneklem için
   kalibre — orada %60-80 WR sık görülür (streak). Tier list'teki WR ise binlerce
   maçlık AGREGA — büyük sayılar 50'ye yakın kümelenir. Profil sayfalarına dokunulmadı.

   Son kalibrasyon (678 rol-satırı üstünde ölçüldü): kırmızı <48 / mor 48–51 / mavi
   51–53 / cyan ≥53 → dağılım dengeli (141/108/212/217). Tek istisna: Zed (Tümü,
   A tier, %47.9 WR) kırmızı görünür — bu ÇELİŞKİ DEĞİL: A tier'i WR değil pick+ban+
   örneklem taşıyor (bkz. MetaService::compositeTierScore), WR'nin gerçekten vasat
   olması ayrı bir doğru bilgi. Kabul edildi (kullanıcı onayı). */
export const WR_COLORS = { high: "#22d3ee", good: "#60a5fa", low: "#c084fc", bad: "#f87171" };

export function wrTone(wr) {
  if (wr >= 53) return WR_COLORS.high;
  if (wr >= 51) return WR_COLORS.good;
  if (wr >= 48) return WR_COLORS.low;
  return WR_COLORS.bad;
}

/* Banlanma oranı rengi — kırmızı burada "kötü" DEĞİL, "dikkat çekici kadar yüksek"
   demek (ana sayfa slider'ındaki hs-ban-hot ile aynı eşik: %20). Altındaki değerler
   nötr kalır, yoksa her satır kırmızıya boyanır ve vurgu anlamını yitirir. */
export const BAN_HOT_AT = 20;

export function banTone(ban) {
  return ban >= BAN_HOT_AT ? WR_COLORS.bad : "#dfe4ee";
}

/* Bir şampiyonun gösterilecek koridorları. Tek koridora sıkışmak yanlış bilgi
   veriyordu (ör. Sylas Mid %43 + Jungle %39 → tek rozet "Mid" diyordu). ALL
   sekmesinde ikincil koridor da bu eşiği geçiyorsa İKİ rozet gösterilir. */
export const SECOND_LANE_AT = 22;

export function tileLanes(champ, role) {
  if (role !== "ALL") return [{ pos: role, share: champ.rs.laneShare }];
  const dist = laneDistribution(champ.roles);
  return dist.filter((d, i) => i === 0 || d.share >= SECOND_LANE_AT).slice(0, 2);
}

/* Bir şampiyonun oynandığı koridorların dağılımı (laneShare, yüksekten düşüğe).
   ALL "rolü" gerçek koridor değil (toplam) → dağılımdan hariç. */
export function laneDistribution(roles) {
  return Object.entries(roles)
    .filter(([pos]) => pos !== "ALL")
    .map(([pos, r]) => ({ pos, label: ROLE_LABEL[pos] || pos, share: r.laneShare }))
    .sort((a, b) => b.share - a.share);
}

/* Şampiyonu seçili roldeki istatistiğiyle birlikte düzleştir (c.rs = rol satırı),
   tier → kazanma sırasına göre sırala. Board ve tablo aynı sırayı paylaşır. */
export function championsInRole(champions, role) {
  return champions
    .filter((c) => c.roles && c.roles[role])
    .map((c) => ({ ...c, rs: c.roles[role] }))
    .sort((a, b) => {
      const t = (TIER_RANK[a.rs.tier] ?? 9) - (TIER_RANK[b.rs.tier] ?? 9);
      return t !== 0 ? t : (b.rs.adjWr ?? b.rs.wr) - (a.rs.adjWr ?? a.rs.wr);
    });
}
