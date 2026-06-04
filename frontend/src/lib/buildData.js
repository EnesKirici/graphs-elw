/*
  PLACEHOLDER (TEST VERİSİ) — şampiyon build / rün / item / matchup / top players.
  Riot API bunları VERMEZ; gerçeği Match-V5 ham maçlarının worker ile toplanmasıyla
  gelecek. Bkz. META_TIERLIST_PLAN.md. Tüm değerler şampiyon+rol'den deterministik.

  Rünler: gerçek runesReforged ağacı (/runes) üzerinden — TÜM rünler gösterilir,
  seçili (önerilen) olanlar vurgulanır (op.gg tarzı).
*/

const DD = "https://ddragon.leagueoflegends.com/cdn";

export const itemIcon = (v, id) => `${DD}/${v}/img/item/${id}.png`;
export const spellIcon = (v, file) => `${DD}/${v}/img/spell/${file}.png`;
export const champIcon = (v, id) => `${DD}/${v}/img/champion/${id}.png`;
export const runeIcon = (iconPath) => `${DD}/img/${iconPath}`;            // icon zaten "perk-images/..." içerir
export const shardIcon = (name) => `${DD}/img/perk-images/StatMods/${name}.png`;

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
function sample(arr, n, seed) {
  const scored = arr.map((v, i) => ({ v, k: rand01(`${seed}|${i}`) })).sort((a, b) => a.k - b.k);
  return scored.slice(0, n).map((s) => s.v);
}
const pickIdx = (len, seed) => Math.floor(rand01(seed) * len);

// ---- Item havuzları ----
const BOOTS = [
  { id: 3006, name: "Berserker Tozlukları" }, { id: 3047, name: "Plakalı Çelik Kaplama" },
  { id: 3020, name: "Büyücü Ayakkabısı" }, { id: 3158, name: "Ionia Çizmeleri" },
];
const STARTERS = [
  { id: 1055, name: "Doran Kılıcı" }, { id: 1056, name: "Doran Yüzüğü" },
  { id: 1054, name: "Doran Kalkanı" }, { id: 2003, name: "Sağlık İksiri" },
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

// ---- Rünler ----
export const TREE_TR = {
  Precision: "Hassasiyet", Domination: "Hükmetme", Sorcery: "Büyücülük",
  Resolve: "Kararlılık", Inspiration: "İlham",
};
const TAG_PRIMARY = {
  Mage: "Sorcery", Assassin: "Domination", Marksman: "Precision",
  Tank: "Resolve", Support: "Resolve", Fighter: "Precision",
};
const SECONDARY_OF = {
  Sorcery: "Domination", Domination: "Precision", Precision: "Domination",
  Resolve: "Sorcery", Inspiration: "Sorcery",
};
// Stat shard satırları (3 satır × 3 seçenek) — runesReforged'da yok, sabit.
export const SHARD_ROWS = [
  [{ icon: "StatModsAdaptiveForceIcon", name: "Uyarlanır Güç" }, { icon: "StatModsAttackSpeedIcon", name: "Saldırı Hızı" }, { icon: "StatModsCDRScalingIcon", name: "Yetenek Çabukluğu" }],
  [{ icon: "StatModsAdaptiveForceIcon", name: "Uyarlanır Güç" }, { icon: "StatModsMovementSpeedIcon", name: "Hareket Hızı" }, { icon: "StatModsHealthScalingIcon", name: "Can (ölçekli)" }],
  [{ icon: "StatModsHealthPlusIcon", name: "Can" }, { icon: "StatModsTenacityIcon", name: "Dayanıklılık" }, { icon: "StatModsHealthScalingIcon", name: "Can (ölçekli)" }],
];

/*
  Rün sayfasını seçer (deterministik). runesData = /runes yanıtı (tüm ağaçlar).
  Dönüş: { primary, secondary (tree objeleri), selected: Set<runeId>, shardSel: [i,i,i] }
*/
export function pickRunePage(champ, role, runesData) {
  if (!Array.isArray(runesData) || runesData.length === 0) return null;
  const byKey = {};
  runesData.forEach((t) => { byKey[t.key] = t; });

  const tag = (champ.tags || [])[0] || "Fighter";
  const primKey = TAG_PRIMARY[tag] || "Precision";
  const secKey = SECONDARY_OF[primKey] || "Domination";
  const primary = byKey[primKey] || runesData[0];
  const secondary = byKey[secKey] || runesData[1];
  const seed = `${champ.id}|${role}`;

  const selected = new Set();
  // Ana ağaç: keystone (slot0) + her minor satırdan 1
  primary.slots.forEach((slot, i) => {
    const r = slot.runes[pickIdx(slot.runes.length, `${seed}P${i}`)];
    if (r) selected.add(r.id);
  });
  // İkincil ağaç: 1..3 satırlardan 2 farklısından birer rün
  sample([1, 2, 3], 2, `${seed}S`).forEach((si) => {
    const slot = secondary.slots[si];
    const r = slot?.runes[pickIdx(slot.runes.length, `${seed}s${si}`)];
    if (r) selected.add(r.id);
  });
  const shardSel = SHARD_ROWS.map((row, i) => pickIdx(row.length, `${seed}sh${i}`));

  return { primary, secondary, selected, shardSel };
}

const isAp = (tag) => tag === "Mage" || tag === "Support";
const TR_NAMES = ["Karadeniz Fırtınası", "Boğaziçi", "AnkaralıTilki", "Egeli Nişancı", "Kapadokya", "İzmirin Kızı", "Yıldırım", "Gece Avcısı", "Pamukkale", "Çukurova"];

// Ana üretici (rünler ayrı: pickRunePage)
export function buildChampionData(champ, role, version, championList = []) {
  const tag = (champ.tags || [])[0] || "Fighter";
  const corePool = isAp(tag) ? CORE_AP : CORE_AD;
  const seed = `${champ.id}|${role}`;

  const spells = (SPELLS_BY_ROLE[role] || SPELLS_BY_ROLE.MIDDLE).map((f) => spellIcon(version, f));

  const starter = sample(STARTERS, 2, seed + "st").map((i) => ({ ...i, icon: itemIcon(version, i.id) }));
  const boots = sample(BOOTS, 1, seed + "bt").map((i) => ({ ...i, icon: itemIcon(version, i.id) }));
  const core = sample(corePool, 3, seed + "co").map((i) => ({ ...i, icon: itemIcon(version, i.id) }));
  const full = [...core, ...sample(corePool, 2, seed + "fb"), ...boots]
    .filter((v, i, a) => a.findIndex((x) => x.id === v.id) === i)
    .slice(0, 6)
    .map((i) => ({ ...i, icon: itemIcon(version, i.id) }));
  const situational = sample(SITUATIONAL, 4, seed + "si").map((i) => ({ ...i, icon: itemIcon(version, i.id) }));

  const buildNames = ["En Popüler", "2. En Popüler", "Alternatif", "Off-Meta"];
  const builds = buildNames.map((name, i) => ({
    name,
    wr: +(50 + rand01(seed + "bw" + i) * 6).toFixed(1),
    items: sample(corePool, 3, seed + "bi" + i).map((it) => itemIcon(version, it.id)),
  }));

  const keys = ["Q", "W", "E"];
  const maxFirst = sample(keys, 3, seed + "ab");
  const order = [];
  for (let lvl = 1; lvl <= 18; lvl++) {
    order.push([6, 11, 16].includes(lvl) ? "R" : maxFirst[(lvl - 1) % 3]);
  }
  const abilityOrder = { order, maxFirst };

  // Top players — rastgele (farklı) şampiyon ikonlarıyla
  const pool = championList.length ? championList : [{ id: champ.id, image: champIcon(version, champ.id) }];
  const topPlayers = sample(TR_NAMES, 4, seed + "tp").map((n, i) => {
    const rc = pool[pickIdx(pool.length, `${seed}tc${i}`)] || champ;
    return {
      name: n,
      wr: +(58 + rand01(seed + "tw" + i) * 14).toFixed(1),
      games: 80 + Math.floor(rand01(seed + "tg" + i) * 250),
      icon: rc.image || champIcon(version, rc.id),
    };
  });

  return { spells, starter, boots, core, full, situational, builds, abilityOrder, topPlayers, ap: isAp(tag) };
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
