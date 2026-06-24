# DB Optimizasyon Planı — Match Storage

> **🟡 DURUM (2026-06-24): Faz 1+2 KODLANDI & local test edildi; CANLIYA ALINMADI.**
> `match_summaries` (summary_json + stat_json) + `ensureSeasonSummaries` + 8 season-stat metodu
> özetten okur. Ölçüm: özet 12.3KB vs full 24KB → ~%50 (planın %80'i değil). **KALAN: items/runes
> trim (→~%66) + cleanup cron + deploy + e2e doğrulama.** Triyaj: `PROJE_DURUM.md`.

## Amaç
DB boyutunu %80-90 küçültmek. Şu an her maç için 10 oyuncunun tüm verisi
(~25KB) saklanıyor. Profil listesi için sadece aranan oyuncunun verisi yeterli.

---

## Mevcut Durum (Seçenek 1)

### Tablolar
```
matches:
  match_id (PK)
  data (JSON, ~25KB) ← 10 oyuncunun tüm verisi (Riot API slim)
  queue_id, game_duration, game_creation

match_timelines:
  match_id (PK)
  data (JSON, ~10KB) ← sadece itemleri, skill order, gold frames
```

### Dezavantaj
- 1000 maç = 25 MB
- 50.000 maç = 1.2 GB
- Profil listesi için gereksiz fazla veri okunuyor (10 oyuncu, 1 tanesi lazım)
- ELW/badges/perfLabel her profil açılışında yeniden hesaplanıyor

---

## Hedef Mimari (Seçenek 3)

### Ana Fikir
**Profil listesi için** → sadece aranan oyuncunun özeti + hesaplanmış değerler
**Maç detayı için** → tıklanınca çek, sakla (10 oyuncu full data)

### Yeni Tablolar

```sql
-- Profil listesinde gösterilen her maç için 1 satır
-- Aynı maç 10 farklı oyuncunun profilinde görünecekse 10 satır olur
match_summaries (YENİ):
  id (PK auto_increment)
  match_id (20) index
  puuid (78) index
  queue_id (smallint)
  game_creation (bigint)
  game_duration (int)
  win (bool)
  
  -- Oyuncu verisi
  champion_name (varchar)
  champion_id (int)
  role (varchar 10)  -- TOP, JUNGLE, MIDDLE, BOTTOM, UTILITY
  champ_level (tinyint)
  
  -- KDA / farm
  kills, deaths, assists (tinyint)
  cs, gold (int)
  damage_dealt, damage_taken (int)
  kp (tinyint)  -- kill participation %
  vision_score (smallint)
  
  -- Eşya/rün
  spell1_id, spell2_id (smallint)
  items_json (JSON, 7 item ID + detaylar)
  runes_json (JSON, keystone + primary + sub + stats)
  
  -- Hesaplanmış değerler
  elw_score (decimal 3,1)
  elw_score_team (decimal 3,1)
  match_rank (tinyint 1-10)
  match_rank_team (tinyint 1-10)
  badges_json (JSON, kısa liste)
  perf_label_json (JSON, label+desc+color)
  
  -- Multi kills
  double_kills, triple_kills, quadra_kills, penta_kills (tinyint)
  
  -- LP (gelecekte worker ile dolacak)
  lp_change (smallint nullable)
  
  created_at (timestamp)
  
  UNIQUE (match_id, puuid)  -- Aynı maç+oyuncu için duplicate engel
  INDEX (puuid, game_creation DESC)  -- Profil listesi sorgusu için

-- Maç detayı tıklandığında 10 oyuncunun tüm verisi
matches (DEĞİŞİK):
  match_id (PK)
  data (JSON, ~25KB full data)
  queue_id, game_duration, game_creation
  
  Sadece TIKLANINCA dolur, önceden preload YAPILMAZ
```

### Akış Değişikliği

#### Profil Açılışı (yeni):
```
1. puuid için getMatchIds() → 10 ID al
2. match_summaries tablosunda bu ID+puuid için kayıt ara
3. Eksik olanlar için:
   a. Match detail API'den çek (10 paralel istek)
   b. Aranan oyuncunun summary'sini hesapla
   c. ELW score, badges, perf label ÖNCEDEN hesapla
   d. match_summaries'e yaz (2KB)
   e. matches tablosuna YAZMA (sadece tıklanınca)
4. DB'den puuid'nin son 10 summary'sini oku
5. Frontend'e gönder

NOT: Eksik varsa yine 10 API isteği lazım. Fark: DB'ye 2KB yazıyoruz, 25KB değil.
```

#### Maç Detayı Tıklandığında (yeni):
```
1. matches tablosunda var mı?
   - VAR → DB'den oku, 10 oyuncu göster
   - YOK → API'den çek (1 istek), matches'e yaz, göster
2. Timeline için aynı mantık (match_timelines)
```

---

## Seçenek 1 vs Seçenek 3 — Kritik Farklar

| Metrik | Seçenek 1 (şu an) | Seçenek 3 (hedef) |
|--------|-------------------|-------------------|
| Profil listesi DB boyutu | 25 KB/maç | 2 KB/oyuncu-maç |
| ELW score hesaplaması | Her profil açılışında | Bir kere (kayıt zamanında) |
| Maç detayı açılınca | 0 API isteği | 1 API isteği (cache miss) |
| 1000 popüler maç | 25 MB | ~5 MB (1-2 oyuncu aranır ort.) |
| Kod karmaşıklığı | Düşük | Orta |

### Ne Zaman Seçenek 1 Daha İyi?
- Maç detayı çok sık tıklanıyor (her maça bakılıyor)
- Aynı maçın 10 oyuncusu da profillerden aranıyor (nadir)

### Ne Zaman Seçenek 3 Daha İyi?
- Çoğu maç detayı TIKLANMIYOR (gerçek durum)
- Her maçtan 1-3 oyuncu aranıyor (gerçek durum)
- **Gerçekçi senaryoda her zaman kazanır**

---

## Uygulama Adımları

### Aşama 1: Tablo Oluştur
```bash
php artisan make:migration create_match_summaries_table
```
Yukarıdaki şemayı uygula.

### Aşama 2: Model Yaz
```php
// app/Models/MatchSummary.php
class MatchSummary extends Model {
  protected $casts = [
    'items_json' => 'array',
    'runes_json' => 'array',
    'badges_json' => 'array',
    'perf_label_json' => 'array',
  ];
}
```

### Aşama 3: MatchService Değişiklikleri
```php
// getRecentMatches():
//   1. match_summaries'te DB-first bak
//   2. Eksikse getMatchDetail() çağır + summary hesapla + kaydet
//   3. matches tablosuna YAZMA (eski preload çağrısını kaldır)
//   4. Son 10 summary'yi döndür

// getMatchDetailFull():  
//   1. matches tablosu DB-first
//   2. Eksikse API'den çek + matches'e yaz
//   3. Full 10 oyuncu render
```

### Aşama 4: Veri Migrasyonu
Mevcut matches tablosu mevcut haliyle kalsın — geri uyumluluk için.
Zamanla yeni yapıya geçilir. Eski kayıtlar temizlenir.

### Aşama 5: Temizlik
- 6 aydan eski match_summaries sil (cron)
- 3 aydan eski matches sil (maç detayı tekrar açılmaz)

---

## Rate Limit Etkisi

### Seçenek 1 (şu an)
```
Profil açılış: 10 match detail preload (10 istek) + 2 season ID (2 istek) = 12 istek
Maç detayı açılış: 0 istek (DB'de)
```

### Seçenek 3 (hedef)
```
Profil açılış: 10 match detail API (10 istek) + summary hesapla
  İlk açılış: aynı 10 istek
  2. açılış: summaries DB'de → 0 istek ⚡
Maç detayı açılış:
  İlk açılış: 1 istek (matches'e yaz)
  2. açılış: 0 istek (DB'de)

Toplam istek: benzer veya daha az
```

**Sonuç:** Rate limit etkisi aynı kalır veya azalır. DB boyutu **%80 küçülür**.

---

## Dikkat Edilecekler

1. **ELW Score hesabı** 10 oyuncu birlikte gerekli — summary kaydederken tüm match detail gerekli (10 kişi kaydedilmeden summary yazılamaz)
2. **Versiyonlama:** ELW/badge algoritması değişirse eski summaries yanlış kalır
   → `algorithm_version` alanı ekle, versiyon değişince recompute
3. **Admin panel:** ELW ağırlıkları değişince eski summaries bozulur
   → Settings değişikliğinde "hepsini yeniden hesapla" butonu ekle

---

## Öncelik
Bu optimizasyon **zorunlu değil** — şu anki DB kullanımı 40GB diskte çok rahat.
Production key + worker geldikten sonra, DB 5-10 GB'a yaklaşınca yapılabilir.

**Şu an için:** Seçenek 1 ile devam et, ölçümleri takip et.
**Eşik:** matches tablosu > 5 GB olunca Seçenek 3'e geç.
