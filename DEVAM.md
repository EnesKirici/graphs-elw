# DEVAM — Sonraki Session İçin Kaldığımız Yer (2026-06-25)

> Bu dosya bir SONRAKİ session'ın kaldığı yerden devam etmesi için. Tüm proje durumu için
> `PROJE_DURUM.md` + `LIVE_GAME_PLAN.md` + memory dosyaları (`project_elw_scoring`,
> `project_live_game`). **Her şey LOCAL, CANLIYA ALINMADI (deploy en son).**

## 🔴 TAM ŞU AN NEREDE KALDIK: Frontend priority-deferral (BEKLEYEN #4)
Etiket admin paneli ✅ + şampiyon-stat KDA ✅ + kart redizayn ✅ + premade tespiti ✅ BİTTİ (aşağıda).
**SIRADAKİ:** 6+ öncelikli oyuncuları (fetchPriority) limit yenilenince/retry ile sonra çek
(şu an `runThrottled` hepsini sırayla çekiyor; rate-limit'te düşenler tekrar denenmiyor).

## ✅ Canlı kart redizayn + premade — BİTTİ (commit'li)
- **Premade (duo/trio) tespiti** (`LiveGameBoard.premadeGroups`): aynı takımda ORTAK son maç ID'leri
  (`recentGames[].matchId`, eşik=2) → union-find gruplar. Ekstra API yok. Görsel: kart çevresine
  renkli iç-çerçeve (ring) + sol üst "Duo/Trio" rozeti (grup başına renk). Fixture'da 2-2-1 örnek.
- **Kart ön yüz redizayn:** üst istatistik KUTUSU kaldırıldı (splash'i kapatıyordu) → kutusuz
  gölgeli metin. Orta satır ikonları (spell/rol/rün) büyütüldü. Summoner adı **tıklanınca yeni
  sekmede profil** (`Link target=_blank` + stopPropagation).
- **Şampiyon KDA** ön yüzde (maç/WR altında, ölüm kırmızı, oran amber).
- **Seri animasyonu:** alev/buz ikonları yalnız **4+ seride** animasyonlu
  (`globals.css` streakFlame/streakFrost). Mock'ta elw 5G, elwyore 4M demo.

## ⚠️ DEV SERVER / OOM NOTU (önemli — bu session'da yaşandı)
`live-game?mock=1` (en ağır SSR sayfası: 10 kart + radar + splash) **OOM ile 500** verebiliyor:
"Jest worker encountered child process exceptions, exceeding retry limit". **Kod hatası DEĞİL** —
boş RAM yetmeyince Next `--webpack` SSR worker'ını (child process) OS öldürüyor. Bu session'da
boş bellek ~680MB'a düşmüştü (Opera 8.5GB/45 süreç). **Çözüm:** belleği boşalt (tarayıcı sekmeleri)
+ dev server'ı **temiz yeniden başlat** (eski server'ın worker'ları "(stale)" kalıyor). Production
build'de (derlenmiş, worker yok) bu sorun OLMAZ.

## ✅ Etiket Motoru ADMİN PANELİ — BİTTİ (commit'li)
**Backend** (`GET /api/v1/admin/labels` → `{catalog, tones, config}`; `PUT /admin/settings/labels_config`).
**Frontend** `frontend/src/app/admin/settings/live-labels/page.js`:
- Bağlam sekmeli (live=15 etiket dolu; profile/match "yakında" placeholder).
- Her etiket: aç/kapa toggle + ad input + 4 ton renk seçici (ana satır=basit) + genişletilince
  özel hex renk + sayısal eşikler (gelişmiş) + "varsayılana dön". `{champ}` şablonu önizleme chip'inde.
- Kaydet → minimal diff (`buildSaveConfig`: yalnız varsayılandan SAPAN değerler;
  `labels_config[ctx][key]={enabled?,name?,tone?,color?,thresholds?}`).
- `AdminSidebar`: eski "Etiketler"→"Performans Etiketleri" (perfLabel, çakışma netlendi),
  yeni "Canlı Maç Etiketleri" linki eklendi.
- ⚠️ Eski `/admin/settings/labels` (perfLabel: Durdurulamaz/Lider…) DOKUNULMADI, çalışıyor.

## ✅ Bu session'da BİTEN (commit'li)
### ELW Score — DPM-tarzı KATEGORİLİ, baştan yazıldı (`ElwScoreService`)
- Skor = ~28 metrik (norm×role-ağırlığı) toplamı, **5 KATEGORİ** (Global/vs Rakip/Objektif/Takım/Role),
  her kategori harf notu. Ağırlıklar `ROLE_W` (7 rol). **ROLE-RELATİF:** ham/`ROLE_BASELINE` (rol-ort).
  **Win puana GİRMEZ.** **Multikill** (triple/quadra/penta) `UNIVERSAL_W` ile küçük + bonusu.
- **Modal** (`ElwScoreModal`) kategori sekmeli + vs Rakip'te rakip şampiyon. Skor dial'ına tıkla.
- **Takım kalitesi** (maç kartı etiketi): "takım arkadaşları mutlak seviyesi vs lobi ort" (DPM tarzı),
  individual skorlarla, renk gradyanı (çok kötü kırmızı→…→çok iyi camgöbeği). `config/elwgraphs.php`.
- Destek rolünde maç-detayda CS/dk yerine **vizyon**.
- **ALGO_VERSION = 8.** ⚠️ Skor mantığı her değişince: bump + `php artisan summaries:flush`.
- ⚠️ `ROLE_W` değişirse `ROLE_BASELINE`'ı YENİDEN ÖLÇ (reflection testi DEVAM'da yok ama
  buildContext+categorizedScore+resolveRole ile rol başına ort ham skor → ROLE_BASELINE).

### Canlı maç (`LiveGameService` + `LiveGameBoard`/`LivePlayerCard`)
- ✅ Takım-seviyesi rol ataması (`assignTeamRoles`): Smite→orman, en-kesin-şampiyon-önce (Vayne→ADC),
  Top→JG→Mid→ADC→Sup sırası, `autofilled` işareti.
- ✅ **Öncelikli-aşamalı fetch** (`fetchPriority`): bana en yakın matchup önce (1=rakibim, 2=düşman jg,
  3=bizim jg, 4-5=bot, 6+=gerisi). Frontend bu sırada çeker.
- ✅ **Etiket motoru bağlı**: enrichment aggregate'leri (avgCs/deaths/kills, mainChamp, streak) +
  `buildLiveLabels` → renkli etiketler kart önyüzünde.
- ✅ Rozet önyüzünde en yüksek 3.
- ⚠️ **Riot canlı maçta ROL VERMEZ** (Spectator-V5 pozisyon yok) → tahmin. Personal key 10 oyuncuyu
  tam çekemez (rate-limit) → öncelikli fetch + worker gezdikçe DB dolar. Production key'de tam.

## ⏳ BEKLEYEN (öncelik sırası)
1. ✅ ~~Etiket motoru admin paneli~~ — BİTTİ (yukarıda).
2. ✅ ~~Şampiyon istatistikleri kart ÖN YÜZÜNE (KDA)~~ — BİTTİ (yukarıda).
3. ✅ ~~Duo (premade) tespiti + kart redizayn~~ — BİTTİ (yukarıda).
4. **Frontend priority-deferral** (TAM ŞU AN KALDIĞIMIZ YER): 6+ öncelikli oyuncular limit yenilenince/retry ile sonra çek.
5. **Vizyon-temelli etiketler** (Yürüyen Totem/Totem Unutan): maç özetinde vizyon/dk yok → eklenince.
6. **DB-opt items/runes trim** + **worker-prewarm** (lp:capture'a ensureSeasonSummaries — kısmen?).
7. **DEPLOY** (en son) — DB-opt + tüm ELW + canlı maç + etiketler. Plesk akışı `project_deployment`.
   Migrate (match_summaries, champion_duo_stats, tracked_players) + scp + `stats:rebuild` + valid key
   ile e2e. **DİKKAT:** profil background+tema BAŞKA CHAT'te yapılıyor (çakışma olabilir, merge dikkat).

## 🧩 Önemli teknik notlar
- **PHP:** `$HOME/.config/herd/bin/php.bat` (Herd). tinker stdin hata yutar → temp `_x.php` + grep.
- **Local Riot key EXPIRED** → canlı fetch/rank local'de çalışmaz; gerçek test SUNUCUDA (Personal key).
- **Test profili:** dev :3000, `/summoner/elw/0000`; API `graphs-elw-api.test`.
- **5 takip hesabı:** elw#0000, nurayore#amare, elwyore#amare, "1v9 acc"#mhm, kirai#mid (tracked_players).
- **Skor değişince:** ALGO_VERSION bump + `summaries:flush` ŞART (yoksa eski özet görünür).
- **Commit:** görev başına parça parça; her commit sonu `Co-Authored-By: Claude Opus 4.8`.
- **Çalışma tarzı:** acele etme, dikkatli, artık kod bırakma; büyük/anlam-değiştiren kararları SOR.
