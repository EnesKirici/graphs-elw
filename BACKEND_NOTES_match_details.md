# Backend Notu — Maç "Detaylar" sekmesi için eklenecek alanlar

> **✅ DURUM (2026-06-24): Bölüm 1-4 YAPILDI** — spell casts (Q/W/E/R) + summoner casts (D/F) +
> 14 ping alanı (`extractMatchData` + `getMatchDetailFull`), ward doğrulandı, rank boş catch'i
> `Log::warning`'e çevrildi; ayrıca Master+ için `leaguePoints` eklendi. **KALAN: Bölüm 5
> (@15 koridor farkları — timeline'dan, opsiyonel).** Eski maçlarda yeni alanlar 0 (yeniden
> çekilince/yeni maçlarda dolar; frontend 0'ları gizler).

> Frontend tarafında maç accordion'una **"Detaylar"** sekmesi eklendi
> (`frontend/src/components/summoner/pro/MatchDetailsTab.js`).
> Sekme bugün mevcut alanlarla (skillOrder, itemTimeline, challenges, items, badges,
> visionScore/wards, 10 oyuncu kıyas) çalışıyor. Aşağıdaki 2 alan grubu eklendiğinde
> görseldeki **Spell Casted** ve **Pings** bölümleri de otomatik dolacak.
>
> Frontend defensive yazıldı: alanlar yoksa o bölümler gizli/bilgilendirme modunda kalır,
> hata vermez. Yani aşağıdakiler **opsiyonel ama istenen** eklemeler.

---

## 1) Spell Casts — Q/W/E/R + D/F kaç kez (ÖNCELİKLİ)

Riot Match-V5 participant objesinde **zaten var** (Timeline'da değil, maç özetinde):
`spell1Casts`, `spell2Casts`, `spell3Casts`, `spell4Casts`, `summoner1Casts`, `summoner2Casts`.

Ayrıntılı arka plan: **`LIVE_CLIENT_SPELL_TRACKING.md`**.

### 1a. Ham alanları slim veriye ekle
`backend/app/Services/RiotApi/MatchDataService.php` → `extractMatchData()` (~satır 252, `$slimParticipants` map'i). Şu satırları ekle:

```php
'spell1Casts' => $p['spell1Casts'] ?? 0,
'spell2Casts' => $p['spell2Casts'] ?? 0,
'spell3Casts' => $p['spell3Casts'] ?? 0,
'spell4Casts' => $p['spell4Casts'] ?? 0,
'summoner1Casts' => $p['summoner1Casts'] ?? 0,
'summoner2Casts' => $p['summoner2Casts'] ?? 0,
```

### 1b. Detail-full formatter'da frontend kontratına çevir
`MatchService::getMatchDetailFull()` içindeki oyuncu objesi kurulurken (challenges/skillOrder'ın eklendiği yer ile aynı oyuncu objesi), ekle:

```php
'spellCasts' => [
    'q' => $p['spell1Casts'] ?? 0,
    'w' => $p['spell2Casts'] ?? 0,
    'e' => $p['spell3Casts'] ?? 0,
    'r' => $p['spell4Casts'] ?? 0,
],
'summonerCasts' => [
    'd' => $p['summoner1Casts'] ?? 0,  // 1. sihirdar büyüsü (D tuşu)
    'f' => $p['summoner2Casts'] ?? 0,  // 2. sihirdar büyüsü (F tuşu)
],
```

**Frontend kontratı (kesin):**
```
player.spellCasts   = { q:int, w:int, e:int, r:int }
player.summonerCasts = { d:int, f:int }
```

> Not (Riot bug'ı): form değiştiren şampiyonlarda (Jayce, Elise, Nidalee, Gnar, Kayn...)
> bu sayılar 0/yanlış gelebilir. Frontend 0'ı sorunsuz gösterir; özel işlem gerekmez.

---

## 2) Pings (İKİNCİL — görseldeki sağ alt kutu)

Riot participant objesinde ping alanları var. Detail-full oyuncu objesine `pings` ekle.
**Frontend doğrudan Riot alan adlarını bekliyor** (PING_LABELS bu adlarla eşler), o yüzden
adları DEĞİŞTİRME:

```php
'pings' => [
    'onMyWayPings'        => $p['onMyWayPings'] ?? 0,
    'enemyMissingPings'   => $p['enemyMissingPings'] ?? 0,
    'assistMePings'       => $p['assistMePings'] ?? 0,
    'needVisionPings'     => $p['needVisionPings'] ?? 0,
    'getBackPings'        => $p['getBackPings'] ?? 0,
    'pushPings'           => $p['pushPings'] ?? 0,
    'allInPings'          => $p['allInPings'] ?? 0,
    'holdPings'           => $p['holdPings'] ?? 0,
    'dangerPings'         => $p['dangerPings'] ?? 0,
    'commandPings'        => $p['commandPings'] ?? 0,
    'enemyVisionPings'    => $p['enemyVisionPings'] ?? 0,
    'visionClearedPings'  => $p['visionClearedPings'] ?? 0,
    'baitPings'           => $p['baitPings'] ?? 0,
    'basicPings'          => $p['basicPings'] ?? 0,
],
```
(Aynı alanları 1a'daki gibi `extractMatchData`'ya da eklemen gerekir ki slim veride dursun.)

**Frontend kontratı:** `player.pings = { <riotPingFieldName>: int, ... }`
Frontend, değeri 0 olanları otomatik gizler; hepsi 0/yoksa Pings bölümü hiç görünmez.

---

## 3) Doğrulama — wardsPlaced / wardsKilled detail-full'da geliyor mu?

Frontend "Görüş & Ward" kutusu `player.wardsPlaced` ve `player.wardsKilled` okuyor.
`extractMatchData`'da bu alanlar var (satır ~269) ama **detail-full formatter'ın** oyuncu
objesine geçirdiğinden emin ol. Geçmiyorsa ekle:
```php
'wardsPlaced' => $p['wardsPlaced'] ?? 0,
'wardsKilled' => $p['wardsKilled'] ?? 0,
```
(Yoksa frontend 0 gösterir — bozulmaz ama veri eksik kalır.)

---

## 4) Rank (tier/division) — Genel + Detaylar'da isim altında "—" düşüyor ⚠️ AKTİF SORUN

Frontend doğru okuyor (`player.tier`, `player.rankDivision`) ama API yanıtında **null** geliyor
(canlı teşhis: `TR1_1721894803` maçında 10 oyuncunun hepsi `tier:null`).

Kod ZATEN VAR: `MatchService::getMatchDetailFull()` satır ~163-172 her oyuncu için
`$this->league->getRankedInfo($puuid)` çağırıp `solo.tier`/`solo.rank` yazıyor. Yani mantık doğru;
sorun şu ihtimallerden biri:
1. **`getRankedInfo()` null/boş dönüyor** — Riot League-V5 çağrısı başarısız (dev key expire/rate-limit;
   memory'de "dev key sık expire" notu var) → tüm tier'lar null.
2. Satır 171'deki **boş `catch (\Exception $e) {}`** hatayı sessizce yutuyor → debug zor.
   En azından `Log::warning('rank fetch failed', ...)` ekleyip gerçek hatayı görün.
3. Bu maçtaki puuid'lerin gerçekten solo rankı yok (ihtimal düşük — 10/10 null olması API sorununu işaret eder).

**Yapılacak (backend):** `getRankedInfo()`'yu izole test et (tek puuid ile), API key geçerliliğini doğrula,
boş catch'i loglamaya çevir. Frontend tarafında değişiklik gerekmez — tier dolu gelince otomatik görünür.
**Frontend kontratı:** `player.tier: string|null` (ör. "DIAMOND"), `player.rankDivision: string|null` (ör. "II").

---

## 5) (Opsiyonel) @15 koridor farkları — görseldeki "LANING PHASE (AT 15)"

Referans görselde koridor kutusu "cs diff / gold diff / xp diff @15 + first lvl 2" gösteriyor.
Bu veri Match-V5 özetinde YOK; **timeline frame'lerinden** hesaplanır (15. dk frame'inde
oyuncunun cs+gold+xp'si eksi lane rakibininki). Şu an frontend "Koridor" kutusu mevcut veriyle
(CS@10, maxCsAdvantage, ilk kan) doldu — çalışıyor.

Birebir @15 isteniyorsa: `getMatchTimeline` → `frames[15].participantFrames[pid]` içinden
`minionsKilled + jungleMinionsKilled`, `totalGold`, `xp` al; aynı roldeki rakiple farkını çıkar.
**Frontend kontratı (eklenirse):** `player.laneDiff15 = { cs:int, gold:int, xp:int }` +
`player.firstToLevel2: bool`. (Frontend bu gelince Koridor kutusunu @15 diff'lerle gösterecek şekilde güncellenir.)

---

## 6) First Blood her zaman `false` — ✅ DÜZELTİLDİ (frontend oturumu, 2026-06-24)

> **Çözüm uygulandı:** `extractMatchData()` (MatchDataService) artık `firstBloodKill`'i ham Riot
> `participant.firstBloodKill` (top-düzey) alanından okuyup slim challenges'a yazıyor. Diğer
> katmanlar (getMatchDetailFull, BadgeService, getChallengeAverages) zaten slim challenges'tan
> okuyor — değişmedi. `getChallengeAverages` cache v4→v5. **Kanıt:** Riot ham yanıtında alan
> doğru geliyor (örn. elw son 25 maçta 2 ilk kan = %8; eskiden %0 görünüyordu). **KALAN:** eski
> DB slim kayıtlarında değer hâlâ `false` — o maçlar Riot'tan yeniden çekilince/yeni maçlarda düzelir.
> İstenirse mevcut `match_summaries` yeniden işlenebilir.

### (Orijinal teşhis, referans için)

Performans Metrikleri'nde "First Blood 0%" ve Detaylar'da "İlk Kan —" hep boş. Kanıt: maç
`TR1_1721894803`'te **10 oyuncunun 10'u da `challenges.firstBloodKill = false`** — bu imkansız
(her maçta tam 1 kişi ilk kanı alır).

Sebep: Riot ham verisinde `firstBloodKill` **participant düzeyinde** bir alandır
(`participant.firstBloodKill`), Riot'un **challenges** objesinde böyle bir alan YOKTUR. Backend
`extractMatchData()` (~satır 291) ve detail formatter `$p['challenges']['firstBloodKill'] ?? false`
okuyor → daima `false`.

**Düzeltme:** kaynağı participant düzeyine al → `$p['firstBloodKill'] ?? false`.
(`firstBloodAssist` de aynı şekilde participant düzeyindedir.) Bu düzelince hem maç detayındaki
"İlk Kan" hem Performans Metrikleri'ndeki First Blood oranı doğru hesaplanır. Not: geçmiş
season-stat kayıtları yanlış değerle saklandıysa yeniden işlenmeleri gerekebilir.

---

## ⚠️ Geriye dönük veri uyarısı
`extractMatchData` çıktısı DB'de/cache'te saklanıyorsa, **eski kayıtlarda bu yeni alanlar
olmayacak** — yalnızca yeniden işlenen/yeni çekilen maçlarda görünür. Eski maçlarda
frontend bölümleri otomatik gizli kalır (sorun değil). İstenirse maçlar yeniden işlenebilir.

---

## Özet checklist (backend)
- [x] `extractMatchData()`'ya 6 spell cast alanı + 14 ping alanı ekle ✅
- [x] `getMatchDetailFull()` oyuncu objesine `spellCasts`, `summonerCasts`, `pings` ekle ✅
- [x] `wardsPlaced`/`wardsKilled` detail-full'da geçiyor (zaten vardı) ✅
- [x] Bölüm 4: rank boş catch'i `Log::warning` + Master+ `leaguePoints` ✅
- [ ] Bölüm 5: @15 koridor farkları (timeline) — opsiyonel, KALAN

Hiçbir frontend değişikliği gerekmez — alanlar gelir gelmez UI otomatik dolar.
