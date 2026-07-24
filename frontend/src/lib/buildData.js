/*
  Build sayfası yardımcıları — GERÇEK veri (backend /champions/{id} → build alanı,
  worker'ın maç maç biriktirdiği sayaçlar) için görselleştirme mantığı.

  Rünler: gerçek runesReforged ağacı (/runes) üzerinden — TÜM rünler gösterilir,
  gerçek maçlarda en çok seçilenler vurgulanır (op.gg tarzı). Sayaçlar marginal
  (rün başına toplam) olduğundan sayfa "en popüler tekil seçimlerin" birleşimidir.
*/

import { DD_ASSETS, DD_CDN } from "@/lib/ddragon";

const DD = `${DD_ASSETS}/cdn`;

export const itemIcon = (v, id) => `${DD}/${v}/img/item/${id}.png`;
export const champIcon = (v, id) => `${DD}/${v}/img/champion/${id}.png`;
// Profil ikonları /dd aynasında BİLEREK yok (binlerce dosya) → doğrudan ddragon.
export const profileIcon = (v, id) => `${DD_CDN}/cdn/${v}/img/profileicon/${id}.png`;
export const runeIcon = (iconPath) => `${DD}/img/${iconPath}`;            // icon zaten "perk-images/..." içerir
export const shardIcon = (name) => `${DD}/img/perk-images/StatMods/${name}.png`;

// Resmî tr_TR adları (DDragon runesReforged): İsabet/Hâkimiyet/Büyücülük/Azim/İlham
export const TREE_TR = {
  Precision: "İsabet", Domination: "Hâkimiyet", Sorcery: "Büyücülük",
  Resolve: "Azim", Inspiration: "İlham",
};

// Stat shard satırları (3 satır × 3 seçenek) — runesReforged'da yok, sabit.
// ids: Riot statPerks id'leri (backend shard sayaçları bu id'lerle gelir).
export const SHARD_ROWS = [
  [
    { id: 5008, icon: "StatModsAdaptiveForceIcon", name: "Uyarlanır Güç" },
    { id: 5005, icon: "StatModsAttackSpeedIcon", name: "Saldırı Hızı" },
    { id: 5007, icon: "StatModsCDRScalingIcon", name: "Yetenek İvmesi" },
  ],
  [
    { id: 5008, icon: "StatModsAdaptiveForceIcon", name: "Uyarlanır Güç" },
    { id: 5010, icon: "StatModsMovementSpeedIcon", name: "Hareket Hızı" },
    { id: 5001, icon: "StatModsHealthScalingIcon", name: "Can (seviyeye göre)" },
  ],
  [
    { id: 5011, icon: "StatModsHealthPlusIcon", name: "Can" },
    { id: 5013, icon: "StatModsTenacityIcon", name: "Meşakkat" },
    { id: 5001, icon: "StatModsHealthScalingIcon", name: "Can (seviyeye göre)" },
  ],
];

// Ayakkabı item id'leri (temel + gelişmiş) — item_full sayaçlarından ayrıştırma için.
const BOOT_IDS = new Set([
  1001, 3005, 3006, 3009, 3010, 3013, 3020, 3047, 3111, 3117, 3158,
  3170, 3171, 3172, 3173, 3174, 3175, 3176,
]);

/** Rün id'sinin ikon yolunu ağaçlardan bulur (keystone seçenek çipleri için). */
export function runeIconById(runesData, id) {
  for (const tree of runesData || []) {
    for (const slot of tree.slots || []) {
      const r = slot.runes.find((x) => x.id === id);
      if (r) return runeIcon(r.icon);
    }
  }
  return null;
}

/*
  Gerçek rün sayfası: keystones/minors = backend sayaçları [{key, games, pickRate, ...}].
  pageIdx: hangi keystone seçeneği (0 = en popüler, 1-2 = alternatifler; dpm.lol tarzı).
  Ana ağaç = seçilen keystone'un ağacı; her satırda en çok oynanan rün işaretli.
  İkincil ağaç = ana ağaç dışındaki minör rünlerden en güçlü ağaç; farklı satırlardan 2 rün.
  pctOf: rün id → pick % (ağaçta TÜM oynanmış rünlerin altında gösterilir).

  cond.minorsK / cond.shardsK: keystone-KOŞULLU sayaçlar ("8010:8014" formatı) —
  rün sayfası bir bütün olduğundan yan ağaç/shard istatistikleri yalnız o keystone'un
  maçlarından okunur; yüzdeler keystone'un maç sayısına oranlanır. Koşullu veri henüz
  birikmemişse (backfill sürüyor) eski marginal sayaçlara düşülür.
  Dönüş: { primary, secondary, selected:Set<runeId>, shardSel:[i,i,i], pctOf } | null
*/
export function pickRealRunePage(runesData, keystones = [], minors = [], shards = [], pageIdx = 0, cond = {}) {
  if (!Array.isArray(runesData) || runesData.length === 0 || !keystones.length) return null;

  const active = keystones[pageIdx] || keystones[0];
  const keystone = Number(active.key);
  const kGames = active.games || 0;

  const condRows = (list) => (list || [])
    .filter((r) => String(r.key).startsWith(`${keystone}:`))
    .map((r) => ({
      key: String(r.key).split(":")[1],
      games: r.games,
      winRate: r.winRate,
      pickRate: kGames ? Math.round((r.games / kGames) * 1000) / 10 : 0,
    }));

  const minorsK = condRows(cond.minorsK);
  const shardsK = condRows(cond.shardsK);
  const useMinors = minorsK.length ? minorsK : minors;
  const useShards = shardsK.length ? shardsK : shards;

  const gamesOf = {}, pctOf = {};
  [...keystones, ...useMinors].forEach((r) => {
    gamesOf[Number(r.key)] = r.games;
    pctOf[Number(r.key)] = r.pickRate;
  });
  const primary = runesData.find((t) =>
    t.slots?.[0]?.runes?.some((r) => r.id === keystone)
  );
  if (!primary) return null;

  const selected = new Set([keystone]);

  // Ana ağaç minör satırları: her satırdan en çok oynanan
  primary.slots.slice(1).forEach((slot) => {
    const best = [...slot.runes].sort((a, b) => (gamesOf[b.id] || 0) - (gamesOf[a.id] || 0))[0];
    if (best && gamesOf[best.id]) selected.add(best.id);
  });

  // İkincil ağaç: ana ağaç dışındaki minörlerden toplam games'i en yüksek ağaç
  let secondary = null, secBest = 0;
  for (const tree of runesData) {
    if (tree.id === primary.id) continue;
    let sum = 0;
    tree.slots.slice(1).forEach((slot) => slot.runes.forEach((r) => { sum += gamesOf[r.id] || 0; }));
    if (sum > secBest) { secBest = sum; secondary = tree; }
  }
  if (secondary) {
    // Farklı satırlardan en iyi 2 rün
    const rowBest = secondary.slots.slice(1)
      .map((slot) => [...slot.runes].sort((a, b) => (gamesOf[b.id] || 0) - (gamesOf[a.id] || 0))[0])
      .filter((r) => r && gamesOf[r.id])
      .sort((a, b) => (gamesOf[b.id] || 0) - (gamesOf[a.id] || 0))
      .slice(0, 2);
    rowBest.forEach((r) => selected.add(r.id));
  }

  // Shard satır seçimleri: her satırda sayacı en yüksek seçenek
  const shardGames = {};
  useShards.forEach((s) => { shardGames[Number(s.key)] = s.games; });
  const shardSel = SHARD_ROWS.map((row) => {
    let best = 0, idx = 0;
    row.forEach((opt, i) => {
      const g = shardGames[opt.id] || 0;
      if (g > best) { best = g; idx = i; }
    });
    return idx;
  });

  return { primary, secondary, selected, shardSel, pctOf };
}

/*
  item_full sayaçlarından ([{key, games, wins, winRate, pickRate}]) gruplar:
  boots (en popüler ayakkabı), core (ayakkabı hariç ilk 3), full (ayakkabı + 5),
  situational (sonraki 4). Hepsi {id, icon, games, winRate} listeleri.
*/
export function groupRealItems(items = [], version) {
  const rows = items.map((it) => ({
    id: Number(it.key),
    icon: itemIcon(version, it.key),
    games: it.games,
    winRate: it.winRate,
    pickRate: it.pickRate,
    completed: it.completed,
  }));
  const boots = rows.filter((r) => BOOT_IDS.has(r.id));
  // Bileşen/iksir gibi bitmemiş eşyalar build önerisine girmez (backend 'completed'
  // işaretler; işaret yoksa — eski önbellek — eleme yapılmaz ki sayfa boş kalmasın).
  const rest = rows.filter((r) => !BOOT_IDS.has(r.id) && r.completed !== false);

  return {
    boots: boots.slice(0, 1),
    core: rest.slice(0, 3),
    full: [...boots.slice(0, 1), ...rest.slice(0, 5)],
    situational: rest.slice(5, 9),
  };
}
