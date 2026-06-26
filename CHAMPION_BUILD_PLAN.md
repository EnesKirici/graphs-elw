# Şampiyon Build Sayfası — Plan (op.gg / DPM tarzı)

> **Durum (2026-06-26): PLANLANDI, kodlanmadı.** Altyapı iskeleti var (`champion_builds`,
> `champion_top_players`, `BuildAggregationService`) ama **anlamlı veri Production key + ladder
> crawler bekliyor.** Tier-list bağlandı (`/meta/tier-list`); bu onun "2. yarısı".
> İlişki: `META_TIERLIST_PLAN.md`, `WORKER_PLAN.md` (Aşama 3), `PROFILE_RANKINGS_PLAN.md`.

## Amaç
Referans: DPM/op.gg/u.gg şampiyon build sayfası (`/champions/[id]`). Bir şampiyon + rol için:
en çok alınan **rünler, eşya dizilimleri, yetenek (skill) sırası, sihirdar büyüleri, çizme,
başlangıç eşyaları**, item slot bazlı WR/pickrate, matchup'lar, OTP'ler, ejder ruhları, 30 günlük
trend grafikleri ve maç-içi istatistikler (CS@15 vb.).

## Kritik gerçek — Riot bunları VERMEZ
Riot API yalnız **ham maç** verir (Match-V5: `item0-6`, `perks`, `summonerXId`; timeline:
`ITEM_PURCHASED`, `SKILL_LEVEL_UP`, dragon event'leri). "Şu item %54 alınıyor, WR'si %56" gibi
**tüm yüzdelikler bizim agregasyonumuz.** DataDragon yalnız statik veri (item ismi/ikon/şampiyon
yeteneği) verir.

## ⚠️ Veri ölçeği uyarısı (neden şimdi değil)
op.gg'nin tek bir Seraphine sayfası **9.519 maça** dayanıyor (item slot1 = 5.189 maç). Bizde
**tüm şampiyonlar toplam ~1.438 maç** → şampiyon başına ~10-50 → build yüzdelikleri **güvenilmez**.
Anlamlı build için **Production key + Emerald+ ladder crawler** (WORKER_PLAN Aşama 3) ya da en az
birkaç haftalık birikim şart. **Bu yüzden DB cleanup'ı da ertelemek doğru** (ham maç = build
hammaddesi; aggregate'e işlenmeden silinmemeli).

## Mevcut altyapı (hazır iskelet)
- **`champion_builds`** — `patch × champion_id × position × category × item_key → games/wins`.
  category değerleri (WORKER_PLAN): `keystone | rune_minor | shard | spell_pair | item_boots |
  item_core | item_full | skill_max | starter`. Compact aggregate (DB şişmez).
- **`champion_top_players`** — `region × champion_id × puuid → games/wins/tier/rank/lp`. OTP listesi.
- **`BuildAggregationService::processMatch($matchData)`** — tek maçı işler: champion_stats +
  champion_builds (keystone/shard/spell/final-item) + champion_top_players. **TODO:** starter +
  skill_max + item satın alma SIRASI → maç **timeline**'ı gerektirir (`matches/{id}/timeline`).
- **`ChampionBuild` / `ChampionTopPlayer` modelleri**, `processed_matches` (dedup), `crawl_players`.
- Frontend: `/champions/[id]` üstünde `ChampionBuild.js` zaten **test verisiyle** (`buildData.js`) var.

## Görseldeki her bölüm → veri kaynağı eşlemesi

| Bölüm (op.gg) | Kaynak | Tablo / category | Durum |
|---|---|---|---|
| **Rünler** (keystone + minor + shard) | `participant.perks.styles[].selections[].perk` + `statPerks` | champion_builds: `keystone`/`rune_minor`/`shard` | iskelet VAR |
| **Sihirdar büyüleri** (%) | `summoner1Id` + `summoner2Id` | `spell_pair` (ayrıca tekil) | iskelet VAR |
| **Çizme** (%) | item slot'taki boots | `item_boots` | iskelet VAR |
| **Core / Full item** frekansı | `item0-6` final | `item_core` / `item_full` | iskelet VAR (final) |
| **Başlangıç eşyaları** | timeline ilk `ITEM_PURCHASED` (frame 0-1) | `starter` | **TODO (timeline)** |
| **Yetenek sırası** (Q>E>W max) | timeline `SKILL_LEVEL_UP` | `skill_max` (+ tam 1-18 sıra) | **TODO (timeline)** |
| **Item slot 1-5** (her slot WR/pickrate/games) | timeline satın alma SIRASI | yeni: `item_slotN` veya slot meta | **YENİ** |
| **Item sets** (2/3/4/5 item kombinasyonu + WR) | timeline sıralı core itemler | yeni category `item_set_N` | **YENİ** |
| **Build varyantları** ("AP burn %56" vb.) | item kombinasyonlarını kümeleme | türetilmiş (core item set clustering) | **YENİ (ileri)** |
| **Matchup'lar** (X vs Y +%/−%, Good/Bad Lane) | aynı maçta karşı laner (teamPosition eşi) + sonuç | yeni: `champion_matchups` (champ×opp×pos→games/wins) | **YENİ** |
| **OTP Leaderboard** (player/WR/games) | champion_top_players | VAR | iskelet VAR |
| **Ejder ruhları** WR | timeline dragon soul event + win | yeni: `champion_dragon_souls` | **YENİ** |
| **30 gün WR/pick/ban grafikleri** | günlük champion_stats snapshot | yeni: `champion_stat_daily` (tarih bazlı) | **YENİ** |
| **Stats** (CS@15/GOLD@15/XP@15, KDA, KP, first blood, dmg, cs/min...) | timeline frame[15] + maç özeti ortalamaları | yeni: `champion_perf_stats` (toplamlar → ort.) | **YENİ** |
| Üst şerit: rol dağılımı %, derece, rank, WR/pick/ban, oyun sayısı | champion_stats (tier-list ile aynı) | VAR (`/meta/tier-list`) | VAR |

## Uygulama planı (aşamalı)

### Faz A — Temel build kartı (mevcut iskeletle, az veriyle bile çalışır)
`BuildAggregationService` zaten keystone/shard/spell/boots/core/full sayıyor. Eksik:
1. `champion_builds`'i bir endpoint'e bağla: `GET /api/v1/champions/{id}/build?role=` → en yüksek
   frekanslı keystone/shard/spell/boots/core item + WR'leri (shrinkage + min_games guard).
2. Frontend `ChampionBuild.js`'i `buildData.js` (test) yerine bu endpoint'e bağla (kontrat aynı kalsın).
3. "Düşük örneklem" rozeti (tier-list'teki gibi) — veri az olduğunda dürüst göster.

### Faz B — Timeline gerektirenler
4. `BuildAggregationService`'e timeline entegrasyonu: `starter` + `skill_max` (+ 1-18 tam sıra) +
   item **satın alma sırası** (slot 1-5) + item set (ilk N core kombinasyonu).
5. Yeni category'ler / tablolar: item_slotN, item_set.

### Faz C — Zengin bölümler (Production key + geniş örneklem sonrası)
6. `champion_matchups` (lane rakibi WR) → "iyi/kötü karşı" + Good/Bad Lane.
7. `champion_dragon_souls`, `champion_perf_stats` (CS@15 vb.), `champion_stat_daily` (30g grafik).
8. Build varyant clustering (core item set kümeleme → "AP burn / Enchanter poke" gibi adlandırma).

### Bağımlılık
- **Faz A** Personal key'le bile DEMO olarak kurulabilir (kontrat + UI), ama veri güvenilmez.
- **Faz B/C** ve gerçek yüzdelikler → **Production key + `ladder:crawl`/`matches:collect`**
  (WORKER_PLAN Aşama 3, komut iskeletleri yazılı) ile geniş Emerald+ örneklemi şart.

## Notlar
- Tüm tablolar **compact aggregate** (sayaç) → DB maç sayısından bağımsız sabit boyut.
- `processed_matches` ile her maç bir kez işlenir (çift sayım yok).
- Patch sınırı: tüm tablolarda `patch` alanı; patch değişince yeni satırlar, eski tarihsel kalır.
- Frontend kontratı `buildData.js`'teki şekille uyumlu tutulmalı ki UI değişmeden gerçek veriye geçsin.
