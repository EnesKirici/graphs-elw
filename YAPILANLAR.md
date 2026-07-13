# YAPILANLAR — Tamamlanan İşler Arşivi

> **Bu dosya BİTMİŞ işlerin kaydı** (nasıl ilerledik, kronolojik yeni→eski).
> Güncel durum + bekleyen işler için → `DEVAM.md`. Kalıcı proje bilgisi → memory dosyaları.

---

## 2026-07-13 — Cache invalidasyon fix + Plaka Savaşı + key rotasyonu (`4d7d6c2`, `d482ca5`)

**Cache anahtarları tek kaynak — kırık invalidasyon düzeldi** (`4d7d6c2`)
- Üreten ile temizleyen taraflar farklı sürümler kullanıyordu (dashboard **v10** cache'lenirken
  rebuild **v8** siliyordu; winrate_timeline v6↔v5, season_champs v6↔v3, duo_partners v6↔v3 vb.)
  → "Yenile" butonu ve `stats:rebuild` fiilen hiçbir cache'i temizlemiyordu.
- Fix: `MatchStatisticsService::CACHE_VERSIONS` + `ck()` + `profileCacheKeys()` (profil anahtarı
  sürümleri tek kaynak) + `MetaService::DASHBOARD_STATS_CACHE_KEY`. Sürüm bump'ında invalidasyon
  otomatik senkron kalır.

**Plaka Savaşı + rol-normalize plaka barı** (`d482ca5`)
- Maç detayı (klasik "İstatistikler" + pro "Detaylar"): takım plaka toplamları (maks 15/takım),
  oyuncu chip dağılımı; pro tarafta aranan oyuncunun takım payı (%).
- Performans Metrikleri: Plaka barı sabit max(5) yerine ana role göre hedef — config
  `elwgraphs.plate.expected_by_role` (Top 5.0 · Mid/ADC 3.5 · Jungle/Support 1.5), tooltip'te rol.
- Backend `getChallengeAverages` payload'ına `plate {role, expected}`; `challenge_avgs` cache **v6**.
- Canlı doğrulama: API yanıtında `plate:{role:"JUNGLE",expected:1.5}` ✓ (Elwoidy, jungle main).

**Riot API key rotasyonu:** local + sunucu `.env` güncellendi, `config:clear`+`cache:clear`,
yeni key Riot'a karşı **200** doğrulandı. ALGO 13 sabit → `summaries:flush` gerekmedi.

---

## 2026-07-08 — Meta patch-scoping + prune + yeni şampiyon fix + Beta pill + Riot başvurusu

**Yeni şampiyon (Locke) istatistik fix** (`8c4e3d8`, `1aefe50`)
- Locke hero'da WR/Pick **%0.0** görünüyordu → 12 maç < MIN_SAMPLE(20) → null → `pctTR(null)`="0,0%".
- Ban %1.3 ise DOĞRUYDU ama **örneklem yanlılığıyla** düşüktü (aşağıda).
- Fix: hero Locke override'ı WR/pick/ban'ı doğrudan `champion_stats`'tan hesaplıyor (adjWr+tier) +
  `lowSample` işareti; hero başlık metriği ban→WR; stat altına "N maç · düşük örneklem" notu.
- Bonus: "Aktif geliştiriliyor" → **"Beta sürüm"** (sade kurumsal pill, /iletisim).

**Meta patch-scoping — ASIL bulgu & düzeltme** (`a006420`, `1827a1c`, `8126d77`, `08c0409`)
- **Kök sorun:** `matches` kaydında `gameVersion` **trim'lenmişti** (NULL) → patch bucketing çöküyor →
  6 aylık veri (Ocak–Temmuz, ~13 patch) tek patch'e (16.13) yığılıyordu. Locke (2 haftalık) 2145 maçlık
  paydayla ban %1.3 görünüyordu; ham JSON'da 27 ban / 23 maç doğrulandı.
- **`gameVersion` artık saklanıyor** (`MatchDataService.extractMatchData`) → yeni maçlar patch taşır.
- **`PatchService`** (yeni, patch mantığı tek kaynak): bir maçı patch'e atar — gameVersion varsa ondan,
  yoksa (eski/dateless kayıt) `gameCreation` tarihinden (config `elwgraphs.meta.patch_starts`).
  `keptPatches` **DataDragon versions.json**'dan (güncel+önceki) → Riot patch atınca pencere OTOMATİK kayar.
- **Meta birleşik pencere:** `getMetaStats`/`getPositionStats` string|array patch alır, güncel+önceki
  patch'i (~625 maç) TOPLAR → listeler dolu kalır. wrChange = güncel vs önceki (tek-patch, dürüst trend).
  Locke "yeni şampiyon" olduğu için GÜNCEL patch'te (82 maç) → ban **%32.9**.
- **`matches:prune`** komutu (yeni): güncel+önceki patch'i tutar, öncesini siler. Varsayılan dry-run;
  `--force` ile gerçek silme + ilişkili timeline temizliği. **Sonuç:** 1692 maç silindi → DB 2417→725.
- Canlı doğrulandı: Popüler (Diana 139 maç…), En Çok Ban (Talon %48, Zed %45…), Locke %32.9. ALGO 13 sabit.

**Riot production key başvurusu:** App ID **853618**, Status **Pending Review**. Ürün açıklaması yazıldı
(API listesi + ToS uyumu + LP worker/Spectator canlı örnekleri). Domain `elwgraphs.elw.com.tr` kaldı.

**Diğer:** Riot API key rotasyonu (local+sunucu). Mail (enes@elw.com.tr) iPhone'da çalışır hale geldi
(SSL kapalı; Let's Encrypt reissue opsiyonel). Search Console sitemap gönderildi.

---

## 2026-07-07 — Couple + gerçek rank ikonları + tier-list mobil + SEO (15 commit, `79a871b..a6071c6`)
Hepsi FRONTEND (ALGO 13 sabit → flush yok).
- **Couple profil teması** (nurayore ♥ elwyore): minimal arka plan kalpleri (z-index 0, soluk) + isim-yanı
  rozet; cursor normal. `coupleProfiles.js` + `CoupleFX.js`.
- **LP grafik + PEAK/MMR:** gerçek Riot rank amblemleri (`rankBadgeUrl`, /ranks/badges/*.webp).
- **Meta tier-list mobil:** rol sekmeleri tek satır yatay kaydırma, maç/patch etiketleri ayrı satır, tablo hizalama.
- **Hero pill** ("Aktif geliştiriliyor", gösterişli — sonra 07-08'de "Beta sürüm"e sadeleşti).
- **Mobil maç kartı + detay tablosu** yeni düzen; duyuru kartı→pill; **/iletisim** sayfası (enes@elw.com.tr).
- **SEO:** tüm sayfalara zengin+dinamik meta + JSON-LD (WebSite + Organization).

## 2026-07-06 — Mobil responsive turu + özel hata sayfaları (11 commit, `4ae57a8..41f7e4c`)
- Mobil responsive baştan sona (navbar/hero/maç kartı/tablolar/canlı maç — CDP 390px ölçümlü, taşma sıfır).
- Hero splash mobilde kart arkası; header sade (logo+arama+menü; mod/admin hamburger'da); stat kartları 2x2.
- **Özel 404/500 sayfaları** (LoL recall temalı, animasyonlu).
- `champions/{id}` geçersiz isimde 500→404 (26 Haz "rotation 500" gizemi buydu — rotation endpoint yok,
  `{id}` rotası yakalıyordu).
- ⚠️ Mobil screenshot: `--window-size` <500px GÜVENİLMEZ → CDP emülasyon şart (memory: reference-screenshot-setup).

## 2026-06-26 — Büyük deploy (27 commit): DB-opt + ELW + canlı maç + etiketler
GitHub push + Plesk bare push + `checkout -f` + cache:clear + `npm run build` + pm2 restart + `summaries:flush`
(1406 temizlendi). ALGO_VERSION 9. ⚠️ `GET /champions/rotation` 500 (07-06'da çözüldü).

---

## Özellik arşivi (2026-06 session'ları)

### ELW Score — DPM-tarzı kategorili (`ElwScoreService`)
- Skor = ~28 metrik (norm×role-ağırlığı), **5 KATEGORİ** (Global/vs Rakip/Objektif/Takım/Role), her kategori
  harf notu. **ROLE-RELATİF** (ham/`ROLE_BASELINE`). **Win puana GİRMEZ.** Multikill küçük bonus.
- `ElwScoreModal` kategori sekmeli (dial'a tıkla). **Takım kalitesi** etiketi (takım arkadaşlarının mutlak
  seviyesi vs lobi ort, renk gradyanı). Destek rolünde CS/dk yerine vizyon.
- ⚠️ Skor mantığı değişince: `ALGO_VERSION` bump + `php artisan summaries:flush`. `ROLE_W` değişirse
  `ROLE_BASELINE`'ı yeniden ölç (`elw:calibrate-baselines`).

### Canlı maç (`LiveGameService` + `LiveGameBoard`/`LivePlayerCard`, Spectator-V5)
- Takım-seviyesi rol ataması (`assignTeamRoles`); öncelikli-aşamalı fetch (`fetchPriority`: bana en yakın önce).
- Etiket motoru bağlı (enrichment aggregate → `buildLiveLabels` → renkli etiketler); rozet önyüzünde en yüksek 3.
- **Premade tespiti** (`premadeGroups`): ortak son maç ID'leri (eşik 2) → union-find; renkli ring + Duo/Trio pill.
- **Kart etkileşim:** tek tık → o kartı çevirir; orta VS butonu → tüm kartları snap. **Seri animasyonu** 4+ seride
  (parçacık: alev/buz). Takım renkleri `searchedTeamId`'den.
- ⚠️ Riot canlı maçta ROL VERMEZ (tahmin). Personal key 10 oyuncuyu tam çekemez → prod key'de tam.

### Etiket motoru + admin paneli
- **OTP** = maçlarının %X'i bu şampiyon (`share`≥70 + minGames guard). **Sevdalısı** = sezon ≥50 maç.
  iyi/kötü/yeni sezon oyun+WR bazlı. Yüksek/Düşük görüş (vizyon/dk). Veri: `getSeasonChampionStats`
  (match_summaries DB, ekstra API yok).
- Admin panel (`/admin/settings/live-labels`): bağlam sekmeli, per-etiket aç/kapa+ad+4 ton+hex+eşik,
  minimal diff kaydet. Eski `/admin/settings/labels` (perfLabel) dokunulmadı.

### DB optimizasyonu (items/runes trim)
- `summary_json` items/runes SLIM (sadece id) saklanır, okurken DataDragon'dan hydrate
  (`MatchService::slimItems/slimRunes` yazar, `hydrateSummary` okur). Blok %92 küçüldü. ALGO 8→9.
- Worker-prewarm: `CaptureLp` adım 7 `ensureSeasonSummaries` (profil kimse bakmadan hazır).
