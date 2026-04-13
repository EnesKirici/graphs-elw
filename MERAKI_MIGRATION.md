# Meraki Analytics -> Worker Geçiş Notu

## Mevcut Durum
Şampiyon koridor bilgisi (positions) Meraki Analytics CDN'den çekiliyor:
`https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/champions.json`

### Sorunlar
- Meraki verisi **25.08 patch'inde kalmış**, 2026 patch'lerine güncellenmemiş
- Koridor verisi oynanma oranına göre sıralı değil (alfabetik)
- Harici bağımlılık — kapanırsa positions boş dizi döner (site çökmez ama veri kaybolur)
- Yeni meta kaymaları yansımıyor (2026'da koridor değiştiren şampiyonlar eski veriyle görünür)

### Şu An Nerede Kullanılıyor?
- `DataDragonService::getChampionPositions()` — Meraki'den çekip 24 saat cache'liyor
- `ChampionController::index()` — champions listesine `positions` alanı ekliyor
- `ChampionController::show()` — detay sayfasına `positions` ekliyor
- `MetaService::getDashboardStats()` — dashboard istatistiklerine `positions` ekliyor
- Frontend: `ChampionGrid.js` (champions sayfası), `[id]/page.js` (detay sayfası)

## Worker ile Geçiş Planı

### Veri Kaynağı
Match V5 API'den toplanan maçlarda her oyuncunun `teamPosition` alanı var:
- `TOP`, `JUNGLE`, `MIDDLE`, `BOTTOM`, `UTILITY`

### Hesaplama
```
Her şampiyon için:
  position_counts = { TOP: 1200, MIDDLE: 5800, BOTTOM: 300 }
  total = sum(position_counts)
  
  Eşik: %5 altı pozisyonlar dahil edilmez (noise filtresi)
  
  Sonuç: positions = ["MIDDLE", "TOP"]  (oynanma oranına göre sıralı)
  
  Bonus: position_rates = { MIDDLE: 79.5, TOP: 16.4, BOTTOM: 4.1 }
  → Frontend'de "Mid %80 · Top %16" gibi gösterilebilir
```

### Yapılacaklar (Worker Hazır Olunca)
1. `champion_stats` tablosuna `position` kolonu zaten planlandı (WORKER_PLAN.md)
2. `DataDragonService::getChampionPositions()` metodunu DB'den okuyacak şekilde değiştir
3. Meraki HTTP çağrısını kaldır, `meraki:champion_positions` cache key'ini temizle
4. Frontend'de `positions` yerine `position_rates` ile oranları da göster (opsiyonel)

### Test
- Worker aktif olduktan 1 gün sonra yeterli sample size olur (~5000+ maç)
- Meraki verisiyle kıyasla: %90+ örtüşme beklenir (major meta shift yoksa)
- Sorunsuzsa Meraki bağımlılığını tamamen sil
