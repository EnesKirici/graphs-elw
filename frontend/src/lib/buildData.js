/*
  PLACEHOLDER (TEST VERİSİ) — şampiyon build / rün / item / matchup / top players.
  Riot API bunları VERMEZ; gerçeği Match-V5 ham maçlarının worker ile toplanmasıyla
  gelecek (en çok alınan item/rün/spell frekansları + WR). Bkz. META_TIERLIST_PLAN.md.
  Tüm değerler şampiyon+rol'den deterministik üretilir (her render aynı kalır).
*/

const DD = "https://ddragon.leagueoflegends.com/cdn";

export const itemIcon = (v, id) => `${DD}/${v}/img/item/${id}.png`;
export const spellIcon = (v, file) => `${DD}/${v}/img/spell/${file}.png`;
export const champIcon = (v, id) => `${DD}/${v}/img/champion/${id}.png`;
export const runeIcon = (path) => `${DD}/img/perk-images/${path}.png`;

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rand01(seed) {
  let x = hashStr(String(seed));
  x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0;
  return x / 4294967295;
}
// Diziden deterministik n adet farklı eleman seç
function sample(arr, n, seed) {
  const scored = arr.map((v, i) => ({ v, k: rand01(`${seed}|${i}`) })).sort((a, b) => a.k - b.k);
  return scored.slice(0, n).map((s) => s.v);
}

// ---- Havuzlar ----
const BOOTS = [
  { id: 3006, name: "Berserker Tozlukları" },
  { id: 3047, name: "Plakalı Çelik Kaplama" },
  { id: 3020, name: "Büyücü Ayakkabısı" },
  { id: 3158, name: "Ionia Çizmeleri" },
];
const STARTERS = [
  { id: 1055, name: "Doran Kılıcı" },
  { id: 1056, name: "Doran Yüzüğü" },
  { id: 1054, name: "Doran Kalkanı" },
  { id: 2003, name: "Sağlık İksiri" },
];
const CORE_AD = [
  { id: 3031, name: "Sonsuzluk Kılıcı" }, { id: 6672, name: "Kraken Avcısı" },
  { id: 6673, name: "Ölümsüz Kalkan Yayı" }, { id: 3153, name: "Kılıçların Kanı" },
  { id: 6675, name: "Navori Pençeleri" }, { id: 3036, name: "Ölümcül İndirim" },
];
const CORE_AP = [
  { id: 6655, name: "Luden Yankısı" }, { id: 3157, name: "Zhonya Kum Saati" },
  { id: 3089, name: "Rabadon Kavuğu" }, { id: 4645, name: "Gölge Alevi" },
  { id: 3135, name: "Boşluk Asası" }, { id: 6653, name: "Liandry Çilesi" },
];
const SITUATIONAL = [
  { id: 3026, name: "Koruyucu Melek" }, { id: 3156, name: "Maw of Malmortius" },
  { id: 3139, name: "Cıva Pala" }, { id: 3033, name: "Ölümlü Hatıra" },
  { id: 3072, name: "Kan Emici" }, { id: 3046, name: "Hayalet Dansçı" },
];

const SPELLS_BY_ROLE = {
  TOP: ["SummonerFlash", "SummonerTeleport"],
  JUNGLE: ["SummonerSmite", "SummonerFlash"],
  MIDDLE: ["SummonerFlash", "SummonerDot"],
  BOTTOM: ["SummonerFlash", "SummonerHeal"],
  SUPPORT: ["SummonerFlash", "SummonerExhaust"],
};

const TREE_STYLE = {
  Precision: "Styles/7201_Precision",
  Domination: "Styles/7200_Domination",
  Sorcery: "Styles/7202_Sorcery",
  Resolve: "Styles/7204_Resolve",
  Inspiration: "Styles/7203_Whimsy",
};
const KEYSTONE = {
  Conqueror: "Styles/Precision/Conqueror/Conqueror",
  LethalTempo: "Styles/Precision/LethalTempo/LethalTempoTemp",
  PressTheAttack: "Styles/Precision/PressTheAttack/PressTheAttack",
  Electrocute: "Styles/Domination/Electrocute/Electrocute",
  DarkHarvest: "Styles/Domination/DarkHarvest/DarkHarvest",
  SummonAery: "Styles/Sorcery/SummonAery/SummonAery",
  ArcaneComet: "Styles/Sorcery/ArcaneComet/ArcaneComet",
  GraspOfTheUndying: "Styles/Resolve/GraspOfTheUndying/GraspOfTheUndying",
  Aftershock: "Styles/Resolve/VeteranAftershock/VeteranAftershock",
};
const MINORS = {
  Precision: ["Styles/Precision/PresenceOfMind/PresenceOfMind", "Styles/Precision/LegendAlacrity/LegendAlacrity", "Styles/Precision/CoupDeGrace/CoupDeGrace", "Styles/Precision/LastStand/LastStand"],
  Sorcery: ["Styles/Sorcery/Transcendence/Transcendence", "Styles/Sorcery/GatheringStorm/GatheringStorm", "Styles/Sorcery/ManaflowBand/ManaflowBand", "Styles/Sorcery/NimbusCloak/6361"],
  Domination: ["Styles/Domination/CheapShot/CheapShot", "Styles/Domination/EyeballCollection/EyeballCollection", "Styles/Domination/RelentlessHunter/RelentlessHunter", "Styles/Domination/SuddenImpact/SuddenImpact"],
  Resolve: ["Styles/Resolve/SecondWind/SecondWind", "Styles/Resolve/Conditioning/Conditioning", "Styles/Resolve/Overgrowth/Overgrowth", "Styles/Resolve/FontOfLife/FontOfLife"],
};
const SHARDS = [
  "StatMods/StatModsAdaptiveForceIcon",
  "StatMods/StatModsAttackSpeedIcon",
  "StatMods/StatModsHealthScalingIcon",
];

// Şampiyon sınıfına göre rün arketipi
function runeArchetype(tag) {
  if (tag === "Mage") return { pri: "Sorcery", key: "ArcaneComet", sec: "Domination" };
  if (tag === "Assassin") return { pri: "Domination", key: "Electrocute", sec: "Precision" };
  if (tag === "Tank" || tag === "Support") return { pri: "Resolve", key: "GraspOfTheUndying", sec: "Sorcery" };
  if (tag === "Marksman") return { pri: "Precision", key: "LethalTempo", sec: "Domination" };
  return { pri: "Precision", key: "Conqueror", sec: "Resolve" }; // Fighter & default
}

function isAp(tag) { return tag === "Mage" || tag === "Support"; }

const TR_NAMES = ["Karadeniz Fırtınası", "Boğaziçi", "AnkaralıTilki", "Egeli Nişancı", "Kapadokya", "İzmirin Kızı", "Yıldırım", "Gece Avcısı", "Pamukkale", "Çukurova"];

// Ana üretici
export function buildChampionData(champ, role, version) {
  const tag = (champ.tags || [])[0] || "Fighter";
  const ap = isAp(tag);
  const corePool = ap ? CORE_AP : CORE_AD;
  const seed = `${champ.id}|${role}`;

  const spells = (SPELLS_BY_ROLE[role] || SPELLS_BY_ROLE.MIDDLE).map((f) => spellIcon(version, f));

  const arch = runeArchetype(tag);
  const runePage = {
    primaryStyle: runeIcon(TREE_STYLE[arch.pri]),
    keystone: runeIcon(KEYSTONE[arch.key]),
    primaryMinors: sample(MINORS[arch.pri] || MINORS.Precision, 3, seed + "pm").map(runeIcon),
    secondaryStyle: runeIcon(TREE_STYLE[arch.sec]),
    secondaryMinors: sample(MINORS[arch.sec] || MINORS.Sorcery, 2, seed + "sm").map(runeIcon),
    shards: SHARDS.map(runeIcon),
  };

  const starter = sample(STARTERS, 2, seed + "st").map((i) => ({ ...i, icon: itemIcon(version, i.id) }));
  const boots = sample(BOOTS, 1, seed + "bt").map((i) => ({ ...i, icon: itemIcon(version, i.id) }));
  const core = sample(corePool, 3, seed + "co").map((i) => ({ ...i, icon: itemIcon(version, i.id) }));
  const full = [...core, ...sample(corePool, 2, seed + "fb"), ...boots]
    .filter((v, i, a) => a.findIndex((x) => x.id === v.id) === i)
    .slice(0, 6)
    .map((i) => ({ ...i, icon: itemIcon(version, i.id) }));
  const situational = sample(SITUATIONAL, 4, seed + "si").map((i) => ({ ...i, icon: itemIcon(version, i.id) }));

  // Önerilen buildler
  const buildNames = ["En Popüler", "2. En Popüler", "Alternatif", "Off-Meta"];
  const builds = buildNames.map((name, i) => ({
    name,
    wr: +(50 + rand01(seed + "bw" + i) * 6).toFixed(1),
    items: sample(corePool, 3, seed + "bi" + i).map((it) => itemIcon(version, it.id)),
  })).sort((a, b) => (a.name === "En Popüler" ? -1 : 0));

  // Ability order — basit dağılım (R: 6/11/16, kalanlar dönüşümlü)
  const keys = ["Q", "W", "E"];
  const maxFirst = sample(keys, 3, seed + "ab"); // önce maxlanacak sıra
  const order = [];
  for (let lvl = 1; lvl <= 18; lvl++) {
    if ([6, 11, 16].includes(lvl)) order.push("R");
    else order.push(maxFirst[(lvl - 1) % 3]);
  }
  const abilityOrder = { order, maxFirst };

  // Top players (test) — bu şampiyonu en çok oynayanlar
  const topPlayers = sample(TR_NAMES, 4, seed + "tp").map((n, i) => ({
    name: n,
    wr: +(58 + rand01(seed + "tw" + i) * 14).toFixed(1),
    games: 80 + Math.floor(rand01(seed + "tg" + i) * 250),
    icon: champIcon(version, champ.id),
  }));

  return { spells, runePage, starter, boots, core, full, situational, builds, abilityOrder, topPlayers, ap };
}

// Matchup (counter) — verilen şampiyon havuzundan (gerçek ikonlar)
export function buildMatchups(champ, role, pool, version) {
  const others = (pool || []).filter((c) => c.id !== champ.id);
  if (!others.length) return { easy: [], hard: [] };
  const ranked = others
    .map((c) => ({ c, wr: +(40 + rand01(`${champ.id}${c.id}${role}`) * 22).toFixed(1) }))
    .sort((a, b) => b.wr - a.wr);
  const easy = ranked.slice(0, 3).map(({ c, wr }) => ({ name: c.name, icon: c.image || champIcon(version, c.id), wr }));
  const hard = ranked.slice(-3).reverse().map(({ c, wr }) => ({ name: c.name, icon: c.image || champIcon(version, c.id), wr }));
  return { easy, hard };
}
