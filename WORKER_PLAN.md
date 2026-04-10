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

## Notlar
- Dev key ile worker ÇALIŞTIRILMAMALI (100/2dk limit yetersiz)
- Worker başlamadan önce mevcut DB verisi yeterli olmalı
- İlk deployment'ta aktif oyuncular = son 7 günde profili açılan oyuncular
