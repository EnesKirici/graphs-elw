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
