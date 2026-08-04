/*
  Derece (tier) rengi — TEK kaynak, tier-list'in kendi paletiyle (@/lib/tierData →
  @/lib/tones) BİRLEŞİK. Önceden burada ayrı bir renk seti vardı (cyan/blue/sky/gray/
  amber/red) — bu, /tier-list sayfasındaki gold/azure/violet/mint/neutral/rose
  paletinden SAPMIŞTI (2026-08-04: aynı "C" derecesi tier-list'te gri, şampiyon
  sayfasının çerçevesinde amber/turuncu görünüyordu — kullanıcı fark etti). Artık
  doğrudan TIER_META'dan türetiliyor; ikinci bir tanım yok, kayma da olamaz.

  Aynı derece hem stat şeridinde (büyük "S" harfi, ChampionBuild) hem şampiyon
  ikonunun çerçevesinde (ChampionHero) kullanılıyor. Bu dosya bilerek "use client"
  DEĞİL: hem sunucu (ChampionHero) hem istemci (ChampionBuild) tarafından import
  ediliyor — tıpkı içe aktardığı tierData/tones gibi.
*/

import { TIER_META } from "@/lib/tierData";

/** Ham renk (hex) — çerçeve, gölge ve metin hepsi bunu kullanır. Bilinmeyen/boş derece → null. */
export const gradeColor = (g) => TIER_META[g]?.color || null;
