# Worker Sistemi Planı

## Worker Nedir?
Arka planda sürekli çalışan PHP process. Kullanıcıdan bağımsız olarak oyuncu verilerini günceller.
Production key alındıktan sonra eklenecek.

## Neden Gerekli?
- Profil açılmadan LP takibi yapılamıyor
- İlk profil açılışı 7sn sürüyor (API istekleri)
- Worker ile veriler önceden hazır → profil açılışı 0.3sn

## Gereksinimler
- Production API Key (30.000 istek/10dk)
- Laravel Queue + Scheduler
- `php artisan queue:work` sürekli çalışacak (supervisor ile)

## Mimari

### 1. Aktif Oyuncu Takibi
```
active_players tablosu:
  puuid, last_checked_at, priority (high/normal/low), check_interval

Öncelik sistemi:
  high   → her 5dk kontrol (son 1 saatte profili açılan oyuncular)
  normal → her 30dk kontrol (son 24 saatte profili açılan)
  low    → her 2 saat kontrol (son 7 günde profili açılan)
  inactive → takipten çıkar (7+ gün profil açılmamış)
```

### 2. Worker Görevleri
```
Her çalışmada:
  1. Aktif oyuncuları priority'ye göre çek
  2. Her oyuncu için:
     a. Son maç ID listesini çek (1 istek)
     b. DB'de olmayan maçları tespit et
     c. Yeni maçların detayını çek (N istek)
     d. LP snapshot kaydet (rank değiştiyse)
     e. cached_players güncelle

  Toplam istek/oyuncu: 1-5 (yeni maç varsa)
  Toplam istek/oyuncu: 1 (yeni maç yoksa)
```

### 3. Rate Limit Bütçesi (Production Key)
```
30.000 istek / 10dk = 3.000/dk

Worker bütçesi: %60 = 1.800/dk
Kullanıcı bütçesi: %40 = 1.200/dk

Worker ile takip edilebilecek oyuncu:
  High priority (5dk): 1.800 × 5 / 3 istek = ~3.000 oyuncu
  Normal (30dk): çok daha fazla
  
Gerçekçi: 5.000-10.000 aktif oyuncu takip edilebilir
```

### 4. Laravel Implementasyonu
```
Komutlar:
  php artisan player:check-new-matches  → Yeni maçları kontrol et
  php artisan player:update-lp          → LP snapshot'ları güncelle
  php artisan player:cleanup            → Eski verileri temizle

Scheduler (app/Console/Kernel.php):
  $schedule->command('player:check-new-matches')->everyFiveMinutes();
  $schedule->command('player:update-lp')->everyTenMinutes();
  $schedule->command('player:cleanup')->weekly();

Queue Jobs:
  CheckPlayerMatches → tek oyuncunun maçlarını kontrol et
  UpdatePlayerLp → tek oyuncunun LP'sini güncelle
```

### 5. Profil Açılışında Ne Değişir?
```
WORKER OLMADAN (şu an):
  Profil açılır → API'den 40+ istek → 7sn bekle → göster

WORKER İLE:
  Profil açılır → DB'den oku → 0.3sn → göster
  Worker zaten güncellemiş, veri taze
  
  Eğer worker henüz güncellemediyse:
    → DB'deki eski veriyi göster + "Güncelleniyor..." badge
    → Arka planda güncelle → otomatik refresh
```

### 6. DB Temizlik Stratejisi
```
Haftalık cleanup job:
  - 6 aydan eski LP snapshot'ları sil
  - 1 yıldan eski match_timelines'ları sil
  - 30 günden eski inactive oyuncuları active_players'dan çıkar
  - matches tablosu: ASLA SİLME (maçlar unique, tekrar çekilemez)
```

### 7. İstek Karşılaştırma (Günlük)
```
                    Worker yok     Worker var
İlk profil açılışı:  40 istek      0-5 istek
LP takibi:           Sadece açılışta Her 5-30dk otomatik
1000 aktif oyuncu:   40.000/gün     ~5.000/gün (worker)
Rate limit riski:    Yüksek         Düşük (kontrollü)
```

## Uygulama Sırası
1. Production key al (1-4 hafta bekleme)
2. `active_players` tablosu + migration oluştur
3. `CheckPlayerMatches` job yaz
4. `UpdatePlayerLp` job yaz
5. Scheduler ayarla
6. Sunucuda supervisor ile `queue:work` çalıştır
7. Profil açılışını DB-first'e çevir (worker güncellediyse API'ye gitme)

## LP Takibi Sorunu (Worker ile Çözülecek)
Şu anki snapshot sistemi hatalı: profil her açıldığında mevcut LP → son maç ID'si
ile kaydediliyor. Ama arada profil açılmadan oynanan maçların snapshot'ı oluşmuyor,
bu yüzden LP farkı yanlış hesaplanabiliyor (kaybedilen maçta +LP gösterimi gibi).
Tutarlılık kontrolü eklendi (win+negatif veya loss+pozitif → gösterme) ama gerçek fix:
Worker her maç sonrası LP'yi otomatik kaydedecek → her maç için doğru LP değişimi.

## Notlar
- Dev key ile worker ÇALIŞTIRILMAMALI (100/2dk limit yetersiz)
- Worker başlamadan önce mevcut DB verisi yeterli olmalı
- İlk deployment'ta aktif oyuncular = son 7 günde profili açılan oyuncular

---

## Aşama 2 — Şampiyon İstatistik Pipeline'ı

### Amaç
Şu an dashboard'daki win rate, pick rate, ban rate, tier verileri **sahte** (hash tabanlı simülasyon).
Worker ile gerçek maç verisi toplanarak bunlar gerçek istatistiklere dönüştürülecek.

### Veri Kaynağı
Riot Match V5 API'den toplanan maç verileri. Her maçta her oyuncu için:
- `championId` → Hangi şampiyon oynandı
- `teamPosition` → Hangi koridorda oynandı (TOP, JUNGLE, MIDDLE, BOTTOM, UTILITY)
- `win` → Kazandı mı
- Maçtaki ban listesi → Ban rate hesabı

### Hedef Oyuncu Havuzu
```
Challenger + Grandmaster + Master oyuncuları → meta istatistikleri
Diamond+ tüm oyuncular → daha geniş örneklem
Diğer ranklar → genel istatistik (opsiyonel, çok fazla istek)

League V4 API ile tier bazlı oyuncu listeleri çekilir:
  GET /lol/league/v4/challengerleagues/by-queue/RANKED_SOLO_5x5
  GET /lol/league/v4/grandmasterleagues/by-queue/RANKED_SOLO_5x5
  GET /lol/league/v4/masterleagues/by-queue/RANKED_SOLO_5x5
```

### Hesaplanacak İstatistikler
```
Her şampiyon + her koridor için:
  - Win Rate = wins / totalGames × 100
  - Pick Rate = champGames / totalGames × 100
  - Ban Rate = champBans / totalGames × 100
  - Koridor Dağılımı = positionGames / champTotalGames × 100
    (örn: Yasuo → Mid %72, Top %18, Bot %10)
  - Tier = score hesabı (WR + PR ağırlıklı)
  - Patch bazlı değişim = bu patch WR - önceki patch WR
```

### Yeni DB Tabloları
```sql
-- Şampiyon istatistikleri (patch bazlı, günlük güncelleme)
champion_stats:
  id, champion_key, champion_id, patch, position,
  games, wins, losses, bans,
  pick_rate, win_rate, ban_rate, tier,
  sample_size, updated_at

-- Toplanan maçların özet verisi
match_champion_data:
  id, match_id, champion_key, position, win, patch,
  created_at
```

### Worker Görevleri
```
Yeni komutlar:
  php artisan stats:collect-high-elo    → Challenger/GM/Master oyuncu listesi çek
  php artisan stats:process-matches     → Maçlardan şampiyon istatistiklerini hesapla
  php artisan stats:calculate-meta      → champion_stats tablosunu güncelle

Scheduler:
  $schedule->command('stats:collect-high-elo')->daily();
  $schedule->command('stats:process-matches')->everyThirtyMinutes();
  $schedule->command('stats:calculate-meta')->hourly();
```

### Rate Limit Bütçesi (Ek)
```
Mevcut worker bütçesi: %60 = 1.800/dk
  Oyuncu takibi: %40 = 1.200/dk
  Meta stats:    %20 = 600/dk

Meta stats istek akışı:
  1. High elo oyuncu listesi: 3 istek/gün (Challenger+GM+Master)
  2. Oyuncu maçları: ~1.500 oyuncu × 1 istek = 1.500/gün
  3. Yeni maç detayları: ~5.000 maç/gün × 1 istek = 5.000/gün
  Toplam: ~6.500 istek/gün (çok rahat bütçe içinde)
```

### MetaService Geçişi
```
SAHTE (şu an):
  MetaService → crc32 hash ile win rate üret → frontend'e gönder

GERÇEK (worker sonrası):
  MetaService → champion_stats tablosundan oku → frontend'e gönder
  Aynı endpoint, aynı response formatı — frontend değişikliği YOK
```

### Geçici Çözüm (Worker Öncesi)
Şampiyon koridor bilgisi için Meraki Analytics CDN kullanılıyor:
`https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/champions/{name}.json`
→ `positions` alanı: ["TOP", "MIDDLE", "JUNGLE", "BOTTOM", "SUPPORT"]
→ Patch bazlı güncelleniyor, 24 saat cache
→ Worker hazır olunca kendi verimizle değiştirilecek

---

## Aşama 2 — DURUM (2026-06-03)

### ✅ YAPILDI — İskelet (compact aggregate storage)
Maçlar stats için TEK TEK saklanmıyor; her maç işlenip sadece aggregate sayaçlara
ekleniyor → DB maç sayısından bağımsız, sabit boyutta kalıyor (736 maç → 573 satır).

- **Tablolar:** `champion_stats` (patch, champion_id, position → games/wins/bans) +
  `stat_patches` (patch → total_games). Migration: `2026_06_03_120000_create_champion_stats_tables.php`
- **Modeller:** `App\Models\ChampionStat`, `App\Models\StatPatch`
- **Servis:** `App\Services\ChampionStatsService`
  - `aggregateFromMatches()` — `matches` tablosunu sayaçlara çevirir. Şampiyon kimliği
    numeric `championId` → kanonik DDragon id (casing + dashboard join garanti).
    Kuyruk filtresi: RANKED_QUEUES = [420, 440].
  - `getMetaStats($patch)` — MIN_SAMPLE=20 guard'ı ile gerçek wr/pick/ban döner.
- **Komut:** `php artisan stats:rebuild` (tam yeniden hesap)
- **Entegrasyon:** `MetaService::getDashboardStats()` — yeterli örneklem varsa gerçek
  veri, yoksa hash simülasyonu; her şampiyona `dataSource` ('real'|'sim') + `sampleSize`.
  Response şekli aynı, frontend değişmedi. (Şu an 126/172 şampiyon gerçek.)
- **Cache:** `meta:dashboard_stats_v7`

#### Neden bu dosyalar? (sade özet)
Amaç: dashboard'daki **sahte** şampiyon WR/pick/ban'ı **gerçek** maçlardan hesaplamak, DB'yi şişirmeden.
- **migration** → istatistiklerin yaşayacağı 2 tabloyu kurar.
- **modeller (ChampionStat/StatPatch)** → o tabloları kodda okuyup yazmayı sağlar (Eloquent).
- **ChampionStatsService** → işin beyni: maçları sayar (aggregate) ve WR/pick/ban'a çevirir.
- **stats:rebuild komutu** → tetik düğmesi; istatistikleri maçlardan yeniden hesaplar (worker bunu otomatik çağıracak).
- **MetaService (değişti)** → dashboard'a veriyi dağıtır; yeterli gerçek veri varsa onu, yoksa simülasyonu gösterir.
- **frontend** → değişmedi; verinin şekli aynı kaldı, sadece sayıların kaynağı sahteden gerçeğe döndü.

⚠️ Mevcut örneklem `matches` tablosundan (aranan oyuncular) → küçük + yanlı, WR'ler
gürültülü. Pipeline doğru; gerçek meta için aşağıdaki crawler şart.

### ⏳ SIRADAKİ ADIMLAR (production key sonrası)
1. **Yüksek-elo crawler** — `stats:collect-high-elo`: League-V4 ile Challenger/GM/Master
   listesi → Match-V5 ile maç geçmişleri. Yansız, geniş örneklem.
2. **Incremental işleme** — `stats:process-matches`: tam rebuild yerine yalnız yeni
   maçları işle. İşlenmiş maçları küçük bir `processed_matches` set'i (match_id) ya da
   oyuncu-bazlı zaman imleci ile takip et (çift sayma yok). Sayaçlarda `increment()`/upsert.
3. **Scheduler** — `stats:collect-high-elo` daily, `stats:process-matches` ~30dk,
   `stats:calculate-meta` (gerekirse türetilmiş alanlar) hourly. Supervisor + `queue:work`.
4. **wrChange (patch-delta) gerçeğe** — `champion_stats` patch bazlı tutuyor; 2+ patch
   verisi birikince önceki patch WR'sinden hesapla (şu an MetaService'te placeholder).
5. **Frontend `dataSource`/`sampleSize`** — "N maça dayalı" rozeti / düşük-örneklem uyarısı.
6. **Koridor dağılımı** — `champion_stats`'ta per-position satırlar zaten var; istenirse
   "Yasuo → Mid %72, Top %18" dağılımı dashboard'a eklenebilir.
7. **(Ops.) MIN_SAMPLE'ı production'da artır** (ör. 200+) — gürültüyü azalt.

---

## Aşama 3 — Build / Ladder / OTP Pipeline (TASARIM, production key sonrası)

Son eklenen özellikler (tier list, şampiyon build sayfası, profil percentile sıraları,
en iyi oyuncular) şu an **TEST verisiyle** çalışıyor. Bu aşama o test verilerini gerçeğe
çevirir. `champion_stats` (Aşama 2) zaten tier list + WR/pick/ban'ı karşılıyor; burada
eksik kalan **build frekansları, ladder histogramı (percentile), OTP listeleri** eklenir.

### Yeni tablolar (migration: 2026_06_04_140000, hepsi compact aggregate)
- **champion_builds** — `patch × champion_id × position × category × item_key → games/wins`.
  category: keystone | rune_minor | shard | spell_pair | item_boots | item_core | item_full | skill_max | starter.
  Build sayfası en yüksek frekanslı anahtarları + WR'lerini çeker. ~170×5×~30 = küçük.
- **champion_top_players** — `region × champion_id × puuid → games/wins/tier`. OTP listeleri
  ve şampiyon "dünya/TR sırası" buradan. Eşik üstü (ör. 30+ maç) oyuncular tutulur.
- **ladder_buckets** — `region × queue × tier × division → player_count`. Profil "Top %X" ve
  dünya/TR sırası bu kümülatif dağılımdan. ~10 tier × 4 division × queue = küçük.
- **processed_matches** — `match_id` (dedup, çift sayım yok).
- **crawl_players** — ladder taramasından gelen keşif havuzu (puuid + priority + zaman imleci).

### Akış (komutlar / job'lar)
```
ladder:crawl   (günlük)   League-V4 apex (Chal/GM/Master) + entries sayfaları (Emerald+)
                          → ladder_buckets güncelle + crawl_players'a puuid ekle
matches:collect (sürekli) crawl_players'tan batch → her puuid ranked match-id'leri
                          → işlenmemiş maçları ProcessMatchJob'a dispatch
ProcessMatchJob(matchId)  maç detayı (DB cache) → 10 participant için:
                            • champion_stats   ++ (games/wins/bans)   [mevcut servis]
                            • champion_builds  ++ (keystone, item slot, spell pair, skill max, starter)
                            • champion_top_players upsert (o oyuncunun o şampiyonla games/wins)
                            • processed_matches'e match_id ekle
meta:recalc    (saatlik)  champion_stats → tier skoru + pick/ban (payda: stat_patches.total_games)
                          champion_builds → "en popüler" kombinasyonları cache'le
```

### Build verisi çıkarımı (her participant'tan)
- Rünler: `perks.styles` (primary/sub stil) + `perks.styles[].selections[].perk` (keystone + minor) + `perks.statPerks` (shard).
- Itemler: `item0..item6` → boots/core/full slotları (timeline'dan satın alma sırası istenirse `matches/{id}/timeline`).
- Spell: `summoner1Id` + `summoner2Id` → çift olarak.
- Skill max: timeline `SKILL_LEVEL_UP` event'lerinden ilk maxlanan (timeline gerekirse; yoksa atlanır).
- Rank bracket: oyuncunun o anki tier'ı (crawl_players.tier) → istenirse bracket bazlı build.

### Frontend bağlama (placeholder → gerçek, response şekli aynı kalır)
| Özellik | Şu an (test) | Gerçek kaynak |
|---|---|---|
| Tier list | `tierData.js` | `champion_stats` → `/api/v1/meta/tier-list?role=&patch=` |
| Şampiyon build | `buildData.js` | `champion_builds` → `/api/v1/champions/{id}/build?role=` |
| Profil Top %X / dünya-TR | `placeholderLeagueRank` | `ladder_buckets` kümülatif percentile |
| Şampiyon dünya/TR sırası | `placeholderChampRank` | `champion_top_players` sıralaması |
| Ort. rakip seviyesi | sabit | son 10 maç rakip puuid'lerinin rank'ı (League-V4 + cache) |
| Build top players | `buildData.js` | `champion_top_players` |

### Rate limit bütçesi (Production 30k/10dk)
- Worker payı ~%60. `ladder:crawl` günde birkaç bin istek (apex + entries sayfaları).
- En büyük kalem `matches:collect`/process → throttle ile bütçe altında. processed_matches
  sayesinde tekrar işleme yok.

### Dedup / incremental / patch
- `processed_matches` ile her maç bir kez işlenir.
- Patch sınırı: tüm tablolarda `patch` alanı var; patch değişince yeni satırlar başlar,
  eski patch tarihsel kalır (wrChange/patch-delta için).

### Uygulama sırası (production key gelince)
1. `php artisan migrate` (yeni tablolar — şema hazır).
2. `ladder:crawl` komutu + ProcessMatchJob'u yaz (yukarıdaki çıkarımla).
3. Scheduler + supervisor `queue:work`.
4. Backend endpoint'leri (`/meta/tier-list`, `/champions/{id}/build`, percentile) → frontend'deki
   `tierData/buildData/placeholder*`'ı bu endpoint'lerle değiştir.
