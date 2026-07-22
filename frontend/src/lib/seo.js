/*
  SEO override katmanı — admin panelinden (Ayarlar → SEO) yönetilen
  title/description ezmeleri. Deploy gerektirmeden arama sonucu metinlerinde
  iterasyon yapabilmek için: DB'deki seo_overrides ayarı boşsa sayfalar
  kod içindeki varsayılan metinlerini kullanır.

  Laravel karşılığı: config() varsayılanı + DB'den ezme gibi düşün.
*/

import { getPublicSettings } from "@/lib/api";

/**
 * Admin'in kaydettiği SEO ezmelerini getir.
 * Dönen yapı: { home: {title, description}, champions: {...}, "tier-list": {...},
 *               leaderboard: {...}, champion_detail: {title, description} }
 * Hata/boş durumda {} — sayfa varsayılanları devrede kalır.
 */
export async function getSeoOverrides() {
  const settings = await getPublicSettings(); // fetchApi cache'i (60 sn) sayesinde ucuz
  return settings?.seo || {};
}

/**
 * "{name} Build — {position}, Patch {patch}" gibi şablonlardaki
 * yer tutucuları gerçek değerlerle doldur. Değeri olmayan yer tutucu
 * (ör. veri yokken {patch}) çevresindeki fazla boşluklarla birlikte silinir.
 */
export function applySeoTemplate(template, vars) {
  if (!template) return null;
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replaceAll(`{${key}}`, value ?? "");
  }
  // Boş kalan yer tutucu artıkları: "— , Patch" gibi kırıntıları toparla
  return out.replace(/\s{2,}/g, " ").replace(/\s+([,.;])/g, "$1").trim();
}

/**
 * Statik bir sayfanın metadata'sına override uygula.
 * Yalnız dolu alanlar ezilir; OG/Twitter başlıkları da senkron tutulur.
 */
export function mergeSeo(defaults, override) {
  if (!override?.title && !override?.description) return defaults;
  const merged = { ...defaults };
  if (override.title) {
    merged.title = defaults.title?.absolute !== undefined
      ? { absolute: override.title }
      : override.title;
    if (merged.openGraph) merged.openGraph = { ...merged.openGraph, title: override.title };
    if (merged.twitter) merged.twitter = { ...merged.twitter, title: override.title };
  }
  if (override.description) {
    merged.description = override.description;
    if (merged.openGraph) merged.openGraph = { ...merged.openGraph, description: override.description };
    if (merged.twitter) merged.twitter = { ...merged.twitter, description: override.description };
  }
  return merged;
}
