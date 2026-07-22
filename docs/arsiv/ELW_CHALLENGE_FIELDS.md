# Riot Challenge Alanları — Tam Döküm (ELW Skoru için)

> Amaç: Riot match-v5 her oyuncu için **131+ "challenge" alanı** veriyor. Bunların hangilerini
> ELW skoruna katacağımıza birlikte karar vermek için hepsini Türkçe açıklamalarıyla listeledim.
> Örnek değerler **aynı maçtan** (TR1_1723507584) 3 farklı rolden: **sup**=NAMNAMMM (tank destek),
> **adc**=elwyore (Ezreal), **jg**=La Carte (orman, 12/0/5).
>
> **İlke:** Hepsini ALMIYORUZ. Çok metrik = gürültü + adaletsizlik + her biri sakla/normalize/ağırlık/baseline maliyeti.
> DPM bile rol başına ~5-8 metrik kullanıyor. "Az ama öz."

## Lejant (öneri sütunu)
- ✅ **Zaten kullanıyoruz** (skorda var)
- 📦 **Slim'de saklı ama skorda kullanılmıyor** (kolay aktive edilir)
- 🟢 **ÖNERİ: EKLE** — gerçek beceri/etki ölçer, DPM-uyumlu, adil normalize edilebilir
- ⚪ **Belki / duruma göre** — anlamlı ama nadir/niş; istersen
- ❌ **ATLA** — alakasız (başka mod), troll/novelty, aşırı nadir veya zaten türevi var

> **Maliyet notu:** 📦 dışındaki her şey Riot'un TAM verisinde var ama biz slim (21 alan) saklıyoruz.
> Eklersek `extractMatchData`'ya eklenir → sadece **yeni/yeniden çekilen** maçlarda dolu gelir,
> eski maçlarda 0 (worker zamanla yeniler).

---

## ⭐ KARARLAR (2026-06-30 — kullanıcı ile birlikte)

İki KATMAN ayırıyoruz:
- **(A) SKOR metriği** → ELW sayısını etkiler. Maliyet: sakla + normalize + role ağırlığı + **baseline yeniden ölç**.
- **(B) ROZET** → mevcut rozet sistemine eklenir (kalitatif etiket). Skoru ya hiç ya **çok az** etkiler, baseline gerekmez. Pozitif VE negatif olabilir.

### (A) SKOR metrikleri — EKLENECEK
**Destek (DPM modaliyle birebir):**
`wardTakedowns` (wards killed) · `stealthWardsPlaced` (wards placed) · `pickKillWithAlly` · `saveAllyFromDeath` · `effectiveHealAndShielding` · `enemyChampionImmobilizations` (CC adedi) · `visionScoreAdvantageLaneOpponent`

**Genel (tüm roller / DPM'de var):**
`voidMonsterKill` (grublar) · `turretTakedowns` · `killsNearEnemyTurret` · `maxCsAdvantageOnLaneOpponent` (📦 saklı) · **`earlyLaningPhaseGoldExpAdvantage`** (erken koridor üstünlüğü — kullanıcı: "erkende iyi oynadı mı kanıtı")

**Orman:**
`jungleCsBefore10Minutes` · `enemyJungleMonsterKills` (counter-jungle) · `killsOnLanersEarlyJungleAsJungler` + `junglerKillsEarlyJungle` (erken gank)

**Roam atan laner:** `killsOnOtherLanesEarlyJungleAsLaner` · (`buffsStolen` minik)

**Minik/niş (küçük ağırlık):** `killsWithHelpFromEpicMonster` ("iyi baron/ejder kullanımı")

### (B) ROZETLER — EKLENECEK (mevcut badge sistemi)
**Pozitif:**
- `multiKillOneSpell` → "Tek Büyü Katliamı" (dinamik)
- `survivedSingleDigitHpCount` → "Kıl Payı" (tek haneli canda hayatta kalma)
- `highestWardKills` → "Ward Avcısı" (+ minik ELW bonusu)
- `hadOpenNexus` (+ galibiyet) → "Geri Dönüş" (`maxKillDeficit` koşul olarak)
- `killedChampTookFullTeamDamageSurvived` → "Yıkılmaz" (tank/top ön saf)
- `outnumberedKills` (📦) → "Sayıca Az, Yürekçe Çok"

**Negatif ("kötü"):**
- "Zor Koridor / Ezildi" → `earlyLaningPhaseGoldExpAdvantage`(negatif) + erken CS/altın/XP farkı + erken ölüm. (Not: "her Q'yu yedi" doğrudan veride YOK; sonucu = geride kalma ile yakalanır.)

### ❌ ATILANLAR (redundant — kullanıcı onayladı)
`takedowns` (=KP) · `takedownsAfterGainingLevelAdvantage` (önde olanın korunması = altın farkıyla zaten var) · `wardTakedownsBefore20M` (alt küme) · `controlWardTimeCoverageInRiverOrEnemyHalf` (v1 değil) · `deathsByEnemyChamps` (=deaths) · `kda` (türev) · `SWARM_*`/ARAM/novelty

### Uygulama fazları
1. **Faz 1:** (A) destek + genel skor metrikleri → sakla + skorla + DPM'e kalibre + **baseline yeniden ölç** + ALGO bump. elwyore maçında doğrula (NAMNAMMM düşer, elwyore 5.).
2. **Faz 2:** (B) rozetler (pozitif + "Zor Koridor" negatif).
3. **Faz 3:** orman/roam niş metrikleri.

---

## 1) Combat — Kill / Takedown / Hayatta Kalma

| Alan | Türkçe açıklama | sup / adc / jg | Öneri |
|---|---|---|---|
| `takedowns` | Toplam **katkı** (kill + assist olduğun aldırmalar) | 11 / 7 / 17 | ⚪ (KP'ye benziyor) |
| `takedownsFirstXMinutes` | İlk ~10dk takedown sayısı (erken oyun etkisi) | 2 / 3 / 9 | ⚪ |
| `takedownsBeforeJungleMinionSpawn` | Orman canavarı doğmadan (oyun başı invade) takedown | 0 / 0 / 0 | ❌ nadir |
| `takedownsAfterGainingLevelAdvantage` | Seviye avantajı kazandıktan sonra takedown | 0 / 0 / 0 | ❌ |
| `takedownsInAlcove` | Koridor köşesindeki (alcove) takedown | 0 / 0 / 0 | ❌ nadir |
| `takedownsInEnemyFountain` | Düşman çeşmesinde takedown (troll/şov) | 0 / 0 / 0 | ❌ |
| `soloKills` | Tek başına (1v1) kill — koridor üstünlüğü | 0 / 0 / 3 | ✅ |
| `quickSoloKills` | Çok hızlı solo kill (anında patlatma) | 0 / 0 / 0 | ⚪ |
| `killsNearEnemyTurret` | Düşman kulesi dibinde kill (dalış agresyonu) | 0 / 1 / 3 | 🟢 |
| `killsUnderOwnTurret` | Kendi kulen altında kill (savunma) | 0 / 0 / 1 | ⚪ |
| `killAfterHiddenWithAlly` | Müttefikle çalıda saklanıp kill (gank kurulumu) | 0 / 3 / 1 | ⚪ |
| `killsWithHelpFromEpicMonster` | Epik canavar (Baron/Ruh) buff'ıyla kill | 0 / 0 / 1 | ❌ niş |
| `killingSprees` | Kill serisi başlatma sayısı | 0 / 1 / 1 | ⚪ |
| `multikills` | Multikill (double+) sayısı | 0 / 1 / 1 | ✅ (bizde multikill var) |
| `multiKillOneSpell` | Tek büyüyle multikill (ör. Brand R) | 0 / 0 / 0 | ❌ niş |
| `multikillsAfterAggressiveFlash` | Agresif flash sonrası multikill | 0 / 1 / 0 | ❌ niş |
| `outnumberedKills` | Sayısal dezavantajda (1vX) kill | 1 / 0 / 1 | 📦 (saklı) ⚪ |
| `killedChampTookFullTeamDamageSurvived` | Tüm takım hasarını yiyip sağ kalıp kill | 0 / 0 / 0 | ❌ aşırı nadir |
| `maxKillDeficit` | Maçtaki en yüksek kill açığı (komeback bağlamı) | 2 / 0 / 2 | ❌ |
| `bountyGold` | Üstüne konan ödülden alınan altın | 0 / 314 / 0 | ⚪ |
| `deathsByEnemyChamps` | Düşman şampiyonlarınca ölüm (≈ deaths) | 4 / 3 / 0 | ❌ (deaths var) |
| `kda` | KDA oranı (zaten K/D/A'dan hesaplıyoruz) | 2.75 / 2.33 / 17 | ❌ türev |
| `survivedSingleDigitHpCount` | Tek haneli canda hayatta kalma sayısı | 0 / 0 / 0 | 📦 ⚪ |
| `survivedThreeImmobilizesInFight` | Bir kavgada 3 immobilize'dan sağ çıkma | 0 / 9 / 0 | ⚪ |
| `tookLargeDamageSurvived` | Büyük hasar alıp sağ kalma (novelty) | 0 / 0 / 0 | ❌ |
| `12AssistStreakCount` | 12 asistlik seri (aşırı nadir) | 0 / 0 / 0 | ❌ |

### Ace / Takım kill anları
| Alan | Türkçe açıklama | sup / adc / jg | Öneri |
|---|---|---|---|
| `acesBefore15Minutes` | 15dk önce ace (erken ezme) | 0 / 0 / 0 | ❌ nadir |
| `doubleAces` | Çift ace | 0 / 0 / 0 | ❌ nadir |
| `flawlessAces` | Kayıpsız ace (takımdan kimse ölmeden) | 1 / 0 / 1 | ⚪ |
| `fullTeamTakedown` | 5 kişinin de katıldığı takedown | 0 / 0 / 0 | ⚪ |
| `perfectGame` | "Kusursuz oyun" rozeti | 0 / 0 / 0 | ❌ nadir |

---

## 2) Hasar & Dayanıklılık

| Alan | Türkçe açıklama | sup / adc / jg | Öneri |
|---|---|---|---|
| `damagePerMinute` | Dakika başı şampiyon hasarı | 262 / 717 / 891 | ✅ |
| `teamDamagePercentage` | Takımın toplam hasarındaki payın | %7 / %32 / %24 | ✅ |
| `damageTakenOnTeamPercentage` | Takımın yediği hasardaki payın (ön saf) | %21 / %21 / %24 | ✅ |

---

## 3) Koridor (Laning)

| Alan | Türkçe açıklama | sup / adc / jg | Öneri |
|---|---|---|---|
| `laneMinionsFirst10Minutes` | İlk 10dk koridor minyonu (CS@10) | 15 / 80 / 0 | ✅ |
| `maxCsAdvantageOnLaneOpponent` | Rakibe karşı ulaşılan **max CS farkı** (DPM "MAX CS DIFF") | 20 / 31 / 49 | 📦 🟢 |
| `maxLevelLeadLaneOpponent` | Rakibe karşı max seviye farkı | 1 / 1 / 3 | ⚪ |
| `goldPerMinute` | Dakika başı altın | 274 / 352 / 523 | ✅ |
| `earlyLaningPhaseGoldExpAdvantage` | Erken koridorda altın/exp önde mi (0/1) | 0 / 0 / 0 | ⚪ |
| `laningPhaseGoldExpAdvantage` | Koridor fazı sonu altın/exp önde mi | 0 / 0 / 1 | ⚪ |
| `turretPlatesTaken` | Alınan kule plakası | 9 / 3 / 8 | ✅ |
| `quickFirstTurret` | İlk kuleyi çok hızlı düşürme | 0 / 0 / 0 | ⚪ |
| `kTurretsDestroyedBeforePlatesFall` | Plakalar düşmeden yıkılan kule | 0 / 0 / 0 | ❌ nadir |
| `outerTurretExecutesBefore10Minutes` | 10dk önce dış kule yıkımı | 0 / 0 / 0 | ⚪ |
| `twentyMinionsIn3SecondsCount` | 3 saniyede 20 minyon (büyük AOE wave clear) | 0 / 0 / 0 | ❌ niş |

---

## 4) Vizyon & Destek ⭐ (#7'nin kalbi)

| Alan | Türkçe açıklama | sup / adc / jg | Öneri |
|---|---|---|---|
| `visionScorePerMinute` | Dakika başı vizyon skoru | 1.44 / 0.63 / 0.80 | ✅ |
| `visionScoreAdvantageLaneOpponent` | Rakibe **göre** vizyon üstünlüğü (relatif) | 0.56 / 1.73 / 0.76 | 🟢 |
| `controlWardsPlaced` | Konulan kontrol wardı (pembe) | 1 / 2 / 0 | ✅ |
| `stealthWardsPlaced` | Konulan normal/gizli ward (DPM "**wards placed**") | 13 / 5 / 5 | 🟢 |
| `wardTakedowns` | Yıkılan düşman wardı (DPM "**wards killed**") | 4 / 2 / 1 | 🟢 |
| `wardTakedownsBefore20M` | 20dk öncesi ward yıkımı (erken vizyon savaşı) | 4 / 2 / 1 | ⚪ |
| `wardsGuarded` | Korunan/savunulan müttefik wardı | 1 / 0 / 0 | ⚪ |
| `controlWardTimeCoverageInRiverOrEnemyHalf` | Kontrol wardının nehir/düşman yarısını kapsama oranı | 0.56 / 0.66 / – | ⚪ |
| `twoWardsOneSweeperCount` | 2 ward + 1 sweeper kombosu | 0 / 0 / 0 | ❌ niş |
| `completeSupportQuestInTime` | Destek görevini (sadaka) zamanında bitirme | 0 / 0 / 0 | ⚪ |
| `fasterSupportQuestCompletion` | Destek görevini rakipten hızlı bitirme | 1 / – / – | ⚪ |
| `highestWardKills` | Lobide en çok ward yıkan mı (0/1) | 1 / – / – | ❌ türev |

---

## 5) CC / Engage

| Alan | Türkçe açıklama | sup / adc / jg | Öneri |
|---|---|---|---|
| `enemyChampionImmobilizations` | Düşmanı **immobilize etme sayısı** (engage/peel ölçer; `timeCCingOthers`'tan iyi) | 45 / 0 / 10 | 🟢 |
| `immobilizeAndKillWithAlly` | Müttefikle immobilize edip kill (koordine engage) | 10 / 0 / 6 | 🟢 |
| `knockEnemyIntoTeamAndKill` | Düşmanı takıma savurup kill (ör. Alistar W-Q, Lee R) | 0 / 0 / 0 | ⚪ |
| `highestCrowdControlScore` | Lobide en yüksek CC skoru mu (0/1) | – / – / 1 | ❌ türev |

---

## 6) Heal / Shield

| Alan | Türkçe açıklama | sup / adc / jg | Öneri |
|---|---|---|---|
| `effectiveHealAndShielding` | **Etkili** heal+shield (overheal/israf hariç) — ham heal'den adil | 468 / 0 / 0 | 🟢 |
| `HealFromMapSources` | Harita kaynaklarından heal (bitki, ruh vb.) | 0 / 0 / 770 | ❌ alakasız |

---

## 7) Objektifler (Ejder / Baron / Herald / Grub / Kule)

| Alan | Türkçe açıklama | sup / adc / jg | Öneri |
|---|---|---|---|
| `dragonTakedowns` | Ejder aldırma katkısı | 0 / 0 / 2 | ✅ |
| `baronTakedowns` | Baron aldırma katkısı | 1 / 0 / 1 | ✅ |
| `riftHeraldTakedowns` | Herald aldırma katkısı | 0 / 0 / 0 | ✅ |
| `epicMonsterSteals` | Smite ile epik canavar çalma | 0 / 0 / 1 | ✅ |
| `voidMonsterKill` | **Voidgrub** (Void canavarı) öldürme — DPM "GRUBS" | 1 / 0 / 4 | 🟢 |
| `turretTakedowns` | Kule yıkma katkısı (toplam) | 4 / 0 / 1 | 🟢 |
| `firstTurretKilled` / `firstTurretKilledTime` | İlk kuleyi yıkan + zamanı | 1/983 / 0 / 1/983 | ⚪ |
| `soloBaronKills` | Solo baron | 0 / 0 / 0 | ❌ nadir |
| `teamBaronKills` / `teamElderDragonKills` / `teamRiftHeraldKills` | Takım objektif sayıları (kişisel değil) | – | ❌ takım geneli |
| `earliestDragonTakedown` / `earliestBaron` | En erken ejder/baron zamanı | – | ❌ |
| `perfectDragonSoulsTaken` | Kusursuz ejder ruhu | 0 | ❌ nadir |
| `elderDragonKillsWithOpposingSoul` / `elderDragonMultikills` | Elder uç durumları | 0 | ❌ |
| `turretsTakenWithRiftHerald` / `multiTurretRiftHeraldCount` | Herald ile kule / tek herald çoklu kule | 0 | ⚪ |
| `baronBuffGoldAdvantageOverThreshold` | Baron buff'la altın avantajı eşiği aşma | 1 / – / 1 | ❌ |
| `epicMonsterKillsWithin30SecondsOfSpawn` | Doğduktan 30sn içinde epik canavar (kontrol) | 0 / 0 / 1 | ⚪ |
| `epicMonsterKillsNearEnemyJungler` | Düşman ormancı yanında epik canavar | 0 / 0 / 3 | ⚪ |
| `epicMonsterStolenWithoutSmite` | Smite'sız epik çalma (klutch) | 0 / 0 / 1 | ⚪ |
| `junglerTakedownsNearDamagedEpicMonster` | Hasarlı epik yanında ormancı takedown | 0 / 0 / 0 | ⚪ |

---

## 8) Orman-Özel

| Alan | Türkçe açıklama | sup / adc / jg | Öneri |
|---|---|---|---|
| `alliedJungleMonsterKills` | Kendi orman canavarları | 0 / 0 / 86 | ⚪ (jg CS türevi) |
| `enemyJungleMonsterKills` | Düşman ormanı (counter-jungle) | 0 / 0 / 9 | 🟢 (jg) |
| `moreEnemyJungleThanOpponent` | Rakipten fazla düşman ormanı yedin mi | 0 / 0 / -55 | ⚪ |
| `jungleCsBefore10Minutes` | 10dk önce orman CS (verimlilik) | 0 / 0 / 69 | 🟢 (jg) |
| `junglerKillsEarlyJungle` | Erken orman fazında kill | – / – / 0 | ⚪ |
| `killsOnLanersEarlyJungleAsJungler` | Erken gank kill (ormancı) | – / – / 2 | 🟢 (jg) |
| `getTakedownsInAllLanesEarlyJungleAsLaner` | Laner'ın erken tüm koridorlarda roam | 0 / 0 / – | ⚪ |
| `killsOnOtherLanesEarlyJungleAsLaner` | Laner'ın diğer koridora roam kill | 0 / 0 / – | ⚪ |
| `initialBuffCount` | İlk buff sayısı (2 = sağlıklı başlangıç) | 0 / 0 / 2 | ⚪ |
| `initialCrabCount` | İlk scuttle crab | 0 / 0 / 1 | ⚪ |
| `scuttleCrabKills` | Scuttle crab sayısı (vizyon/tempo) | 0 / 0 / 5 | ⚪ (jg) |
| `buffsStolen` | Çalınan düşman buff'ı | 0 / 0 / 1 | ⚪ |

---

## 9) Mekanik / Beceri

| Alan | Türkçe açıklama | sup / adc / jg | Öneri |
|---|---|---|---|
| `skillshotsHit` | İsabet ettirilen skillshot | 21 / 92 / 27 | 📦 ⚪ |
| `skillshotsDodged` | Kaçırılan (sıyrılan) düşman skillshot | 54 / 15 / 14 | 📦 ⚪ |
| `landSkillShotsEarlyGame` | Erken oyunda isabet eden skillshot | 4 / 19 / 5 | ⚪ |
| `dodgeSkillShotsSmallWindow` | Dar pencerede skillshot sıyırma (refleks) | 3 / 0 / 0 | ⚪ |
| `abilityUses` | Toplam yetenek kullanımı | 112 / 245 / 183 | ❌ gürültü |
| `quickCleanse` | Hızlı cleanse (CC temizleme) | 0 / 0 / 0 | ⚪ |

---

## 10) Diğer / Meta / Bağlam

| Alan | Türkçe açıklama | sup / adc / jg | Öneri |
|---|---|---|---|
| `pickKillWithAlly` | Müttefikle **koordineli pick/gank kill** (DPM destek metriği) | 10 / 6 / 14 | 🟢 |
| `saveAllyFromDeath` | Ölecek müttefiki **kurtarma** (clutch peel — DPM destek metriği) | 0 / 0 / 0 | 🟢 |
| `killParticipation` | Kill katılımı (KP) | %34 / %70 / %53 | ✅ |
| `playedChampSelectPosition` | Seçtiği pozisyonda mı oynadı (autofill değil) | 1 / 1 / 1 | ❌ bağlam |
| `hadOpenNexus` | Açık nexus'tan döndü mü (komeback) | 0 / 0 / 0 | ❌ |
| `lostAnInhibitor` | Inhibitor kaybı | 0 / 0 / 0 | ❌ takım |
| `gameLength` | Oyun süresi (saniye) — meta | 1571 | ❌ (zaten var) |
| `legendaryCount` | Tamamlanan efsanevi item sayısı | 0 / 0 / 1 | ❌ altın türevi |
| `legendaryItemUsed` | Kullanılan efsanevi item ID listesi | [3190,3876,3075] / [3004,3042] / [...] | ❌ |
| `fastestLegendary` | En hızlı efsanevi item zamanı | – / – / 958 | ⚪ |
| `mejaisFullStackInTime` | Mejai's full stack (novelty) | 0 | ❌ |

---

## 11) ❌ ÇÖP — Başka Oyun Modu / Event / Novelty (kesin atılır)

| Alan | Neden atılır |
|---|---|
| `SWARM_DefeatAatrox`, `SWARM_DefeatBriar`, `SWARM_DefeatMiniBosses`, `SWARM_EvolveWeapon`, `SWARM_Have3Passives`, `SWARM_KillEnemy`, `SWARM_PickupGold`, `SWARM_ReachLevel50`, `SWARM_Survive15Min`, `SWARM_WinWith5EvolvedWeapons` | **Swarm = PvE oyun modu** görevleri — ranked SR ile sıfır alaka (11 alan) |
| `InfernalScalePickup` | Event item pickup |
| `killsOnRecentlyHealedByAramPack` | **ARAM**-özel |
| `snowballsHit` | ARAM/event kartopu |
| `poroExplosions` | ARAM poro |
| `dancedWithRiftHerald` | Novelty (Herald'la dans emote) |
| `fistBumpParticipation` | Novelty (fist-bump emote) |
| `blastConeOppositeOpponentCount` | Novelty (blast cone ile zıplama) |
| `unseenRecalls` | Novelty (görünmeden recall) |

---

## ÖZET — Önerilen ekleme listesi (🟢)

**Destek-odaklı (#7, DPM modaliyle birebir):**
1. `wardTakedowns` — wards killed
2. `stealthWardsPlaced` — wards placed
3. `pickKillWithAlly` — koordineli pick kill
4. `saveAllyFromDeath` — clutch peel
5. `effectiveHealAndShielding` — gerçek heal/shield (enchanter)
6. `enemyChampionImmobilizations` — CC adedi (tank/engage)
7. `visionScoreAdvantageLaneOpponent` — vizyon üstünlüğü

**Genel boşluklar (diğer roller, DPM'de var):**
8. `voidMonsterKill` — grublar (Objektif)
9. `turretTakedowns` — kule katkısı
10. `killsNearEnemyTurret` — agresif dalış
11. `maxCsAdvantageOnLaneOpponent` (📦 zaten saklı) — max CS farkı

**Orman için (istenirse):** `enemyJungleMonsterKills`, `jungleCsBefore10Minutes`, `killsOnLanersEarlyJungleAsJungler`

---

### Sen incele, işaretle
Her satırın önerisini (✅/🟢/⚪/❌) görebilirsin. Eklemek/çıkarmak istediklerini bana söyle —
LoL bilginle "şu önemli, bu gereksiz" dersin, ona göre #7'yi kurarım. Eklenen her 🟢 için:
sakla (`extractMatchData`) → normalize et → role ağırlığı ver → baseline yeniden ölç.
