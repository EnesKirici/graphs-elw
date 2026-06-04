/*
  Riot platform kodu → kısa bölge etiketi (sıralama gösteriminde kullanılır).
  Hesap hangi sunucudaysa o sunucunun etiketi gösterilir (TR değilse TR yazmaz).
*/
const REGION_MAP = {
  tr1: "TR",
  euw1: "EUW",
  eun1: "EUNE",
  na1: "NA",
  kr: "KR",
  jp1: "JP",
  br1: "BR",
  la1: "LAN",
  la2: "LAS",
  oc1: "OCE",
  ru: "RU",
  ph2: "PH",
  sg2: "SG",
  th2: "TH",
  tw2: "TW",
  vn2: "VN",
  me1: "ME",
};

export function regionLabel(platform) {
  if (!platform) return "TR";
  const key = String(platform).toLowerCase();
  return REGION_MAP[key] || String(platform).toUpperCase().replace(/[0-9]/g, "");
}
