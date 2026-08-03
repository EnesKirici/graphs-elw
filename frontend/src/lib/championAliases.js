/*
  Şampiyon takma adları (TR oyuncu jargonu) — SEO eşleşmesi için.

  Search Console verisi net: aramaların çoğu KISALTMA ile yapılıyor.
    "ww ct" 151 · "kata ct" 135 · "heim ct" 80 · "cho ct" 69 · "noc ct" 53
    "vlad ct" 32 · "fiddle ct" 12 · "luci ct" 12 · "xin ct" 11 · "naut/nau/nati ct"
  Sayfada "WW" kelimesi hiç geçmiyorsa Google "ww ct" sorgusunu Warwick sayfasına
  güvenle eşleyemez. Bu harita başlığa/açıklamaya/keywords'e ve görünür metne
  kısaltmaları taşır (gizli anahtar kelime yığını DEĞİL — H1 ve girişte gerçekten görünür).

  Kural: yalnızca GERÇEKTEN kullanılan kısaltmalar. Uydurma kısaltma eklemek
  alakasız sorgulara eşleşip tık oranını düşürür.
*/
const ALIASES = {
  Warwick: ["WW"],
  Katarina: ["Kata"],
  Heimerdinger: ["Heim", "Heimer"],
  Chogath: ["Cho", "Cho'Gath"],
  Nocturne: ["Noc"],
  Vladimir: ["Vlad"],
  Lucian: ["Luci"],
  XinZhao: ["Xin", "Xin Zhao"],
  Nautilus: ["Naut", "Nau"],
  Tryndamere: ["Tryn", "Trynd"],
  Cassiopeia: ["Cassi", "Cassio"],
  Morgana: ["Morg"],
  MissFortune: ["MF", "Miss Fortune"],
  Khazix: ["Kha", "Kha'Zix"],
  Malzahar: ["Malz"],
  Fiddlesticks: ["Fiddle"],
  Leblanc: ["LB", "Le Blanc"],
  MasterYi: ["Yi", "Master Yi"],
  KSante: ["Sante", "K'Sante"],
  Naafiri: ["Nafiri"],
  Gangplank: ["GP"],
  JarvanIV: ["Jarvan", "J4", "Jarvan IV"],
  Evelynn: ["Eve", "Evelyn"],
  TwistedFate: ["TF", "Twisted Fate"],
  Velkoz: ["Vel'Koz"],
  RekSai: ["Rek", "Rek'Sai"],
  AurelionSol: ["Asol", "Aurelion Sol"],
  DrMundo: ["Mundo", "Dr Mundo"],
  MonkeyKing: ["Wukong", "Monkey King"],
  TahmKench: ["Tahm", "TK", "Tahm Kench"],
  LeeSin: ["Lee", "Lee Sin"],
  KogMaw: ["Kog", "Kog'Maw"],
  Blitzcrank: ["Blitz"],
  Pantheon: ["Panth"],
  Renekton: ["Renek"],
  Sejuani: ["Sej"],
  Caitlyn: ["Cait"],
  Ezreal: ["Ez"],
  Seraphine: ["Sera"],
  Orianna: ["Ori"],
  Volibear: ["Voli"],
  Shyvana: ["Shyv"],
  Trundle: ["Trund"],
  Kassadin: ["Kass"],
  Illaoi: ["Illa"],
  Irelia: ["Ire"],
  Hecarim: ["Hec"],
  Alistar: ["Ali"],
  Malphite: ["Malph"],
  Zilean: ["Zil"],
  Belveth: ["Bel'Veth"],
  Nunu: ["Nunu & Willump"],
  Anivia: ["Aniv"],
  Camille: ["Cam"],
  Akali: ["Aka"],
};

/** Şampiyonun takma adları (yoksa boş dizi). */
export function aliasesOf(championId) {
  return ALIASES[championId] || [];
}

/** İlk (en yaygın) takma ad — başlıkta "Warwick (WW)" gibi göstermek için. */
export function primaryAlias(championId) {
  return ALIASES[championId]?.[0] || null;
}

/**
 * Counter sorgusu anahtar kelimeleri: isim + tüm takma adlar × (counter|ct) varyantları.
 * "ww ct", "ct ww", "ww counter" ... hepsi tek listede.
 */
export function counterKeywords(championId, name) {
  const names = [name, ...aliasesOf(championId)].filter(
    (v, i, a) => v && a.indexOf(v) === i
  );
  const out = [];
  for (const n of names) {
    out.push(`${n} counter`, `${n} ct`, `ct ${n}`, `counter ${n}`, `${n} counters`);
  }
  return out;
}
