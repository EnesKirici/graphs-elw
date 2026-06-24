# Ana Sayfa Meta Verileri — Nasıl Hesaplanıyor, Doğru mu?

> Kısa cevap: **Hesap doğru, ama örneklem şu an küçük ve yanlı.** Production key + worker
> ile geniş ladder taranınca gerçek meta'ya oturacak.

## 1. WR / Pick / Ban nasıl hesaplanıyor?

Riot bunları HAZIR vermiyor (op.gg/LeagueOfGraphs gibi biz topluyoruz). Kaynak: kendi
topladığımız `matches` tablosundaki ranked maçlar (queue 420 Solo + 440 Flex).

`stats:rebuild` komutu tüm maçları tarayıp `champion_stats` tablosuna **sayaç** olarak işler
(`backend/app/Services/ChampionStatsService.php`). Her şampiyon için:

```
Win Rate  = wins  / games          (o şampiyonun kazandığı / oynandığı maç)
Pick Rate = games / totalGames     (lobi başına 1 maç = totalGames)
Ban Rate  = bans  / totalGames
Tier      = (WR-50)*2 + pickRate   formülünden S+/S/A/B/C/D
```

`MetaService::getDashboardStats()` bu sayaçları okuyup ana sayfaya verir.

## 2. Neden Singed / Aurelion Sol en yüksek WR? (Doğru mu?)

Çünkü örneklem **küçük ve yanlı**. Şu anki kaynak = aranan/takip edilen TR oyuncularının
maçları (~2000 ranked maç), gerçek global ladder değil. Örnek (canlı veri):

| Şampiyon | WR | Pick | Yaklaşık maç | Güvenilirlik |
|---|---|---|---|---|
| Singed | %65.5 | %1.5 | ~30 | ❌ gürültülü (az maç) |
| Aurelion Sol | %65.3 | %2.5 | ~50 | ❌ gürültülü |
| Katarina | %47.9 | %11 | ~220 | ✅ daha güvenilir |

30 maçta birisi %65 kazanmışsa bu "Singed meta" demek değil — sadece **o 30 maçta öyle
olmuş**. Az oynanan şampiyonlar 1-2 iyi seriyle WR listesinin tepesine çıkar. Bu yüzden
WR sıralamasının başında **niş şampiyonlar** görüyorsun. Gerçek meta'da pick'i yüksek
şampiyonlar (Katarina gibi) baz alınır.

**Koruma:** `MIN_SAMPLE = 20`. 20 maçtan az oynanan şampiyon "gerçek" sayılmaz →
admin ayarına göre **"veri yetersiz"** gösterilir veya (istenirse) simüle edilir.

**Çözüm (production key sonrası):** `ladder:crawl` ile Challenger/GM/Master + Diamond
ladder'ı taranıp on binlerce maç toplanınca örneklem büyür → WR'ler gerçek meta'ya oturur.
`MIN_SAMPLE` de 200+'a çıkarılır (gürültü iyice azalır).

## 3. Patch değişimleri (▲/▼) neden boş?

Patch değişimi = **bu yamanın WR'si − önceki yamanın WR'si**. Şu an elimizde sadece
**tek patch** (16.13) verisi var → kıyaslayacak önceki patch yok → boş. Veri biriktikçe
(2+ patch) otomatik dolacak. (Oyundaki "26.13" = DataDragon "16.13" — Riot iki ayrı
numara kullanır; biz DataDragon'unkini gösteriyoruz.)

## 4. Tablolar ne işe yarıyor? (Kafa karışıklığı için)

| Tablo | Ne tutar | Satır = | Boyut |
|---|---|---|---|
| `matches` | Her maçın **tam JSON'u** (10 oyuncu, ham Riot verisi) | 1 maç | ~32KB/maç → büyük (73MB) |
| `champion_stats` | Şampiyon **sayaçları** (WR/pick/ban) | patch×şampiyon×pozisyon | ~144KB (minik) |
| `cached_players` | **Oyuncu rehberi** (isim→puuid, arama için) + gördüğümüz ranklar | 1 oyuncu | ~1.5MB |
| `lp_snapshots` | **LP geçmişi** (zaman serisi: oyuncunun her maçtaki LP'si) | 1 oyuncu × 1 maç | ~64KB |

- **cached_players vs lp_snapshots farkı:** `cached_players` = "bu oyuncu var, puuid'i bu"
  (her oyuncu 1 satır, çoğu sadece arama için, rank NULL). `lp_snapshots` = "bu oyuncunun
  LP'si zaman içinde şöyle değişti" (oyuncu başına maç başına 1 satır, LP grafiği +
  maç-başına +/- LP için). Biri rehber, diğeri tarihçe. 3918 cached_player ama 62 snapshot
  olması normal: 3918 oyuncuyu maçlardan gördük (arama için), ama LP'sini sadece takip
  edilen/profili açılan birkaç oyuncu için tutuyoruz.

## 5. DB optimizasyonu — JSON mı, SQL kolon mu?

Soru: `matches.data` JSON yerine kolonlara parse etsek küçülür mü?

- **Tam maçı kolonlara açmak fazla küçültmez** — veri o veri (10 oyuncu × onlarca alan).
  Üstelik çok kolon / ayrı tablo gerekir, karmaşıklaşır.
- **Asıl kazanç: az veri saklamak.** Liste görünümü için 10 oyuncunun TAMAMI gerekmiyor;
  sadece aranan oyuncunun **özeti** (champion, KDA, eşya, önceden hesaplı ELW skoru) yeter.
  Bu yüzden plan: **`match_summaries`** tablosu (oyuncu başına ~2KB özet) + tam 10-oyuncu
  detay yalnız maç **tıklanınca** `matches`'ten. ~%80 küçülme + liste hızlanır
  (ELW her açılışta değil, bir kez kayıt anında hesaplanır). Detay: `DB_OPTIMIZATION_PLAN.md`.
- Yani doğru yol "JSON'u parse et" değil, **"listede sadece gerekeni sakla, detayı talep
  üzerine getir"**.

## Özet
Ana sayfadaki sayılar doğru hesaplanıyor ama **küçük/yanlı örnekten** geliyor → niş
şampiyonlar WR tepesinde. Production key + ladder crawler ile gerçek meta'ya oturacak.
Patch değişimleri 2+ patch verisi birikince dolacak.
