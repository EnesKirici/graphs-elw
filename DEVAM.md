# DEVAM — Sonraki Session İçin Kaldığımız Yer (2026-06-25)

> Bu dosya bir SONRAKİ session'ın kaldığı yerden devam etmesi için. Tüm proje durumu için
> `PROJE_DURUM.md` + `LIVE_GAME_PLAN.md` + memory dosyaları (`project_elw_scoring`,
> `project_live_game`). **Her şey LOCAL, CANLIYA ALINMADI (deploy en son).**

## 🔴 TAM ŞU AN NEREDE KALDIK: Etiket Motoru ADMİN PANELİ
Etiket motoru (`LabelEngine`) kuruldu + canlı maça BAĞLANDI (renkli etiketler kart önyüzünde
çıkıyor). **KALAN: admin paneli** (kullanıcı: "HEPSİNİ ADMİN PANELDE KONTROL EDEBİLEYİM —
bağlama göre ayır, aç/kapa + renk + eşik").

**⚠️ İSİM ÇAKIŞMASI (önemli):** `frontend/src/app/admin/settings/labels/page.js` ZATEN VAR ama o
**ESKİ perfLabel** sistemini yönetiyor (Durdurulamaz/Lider/Geç Açılan… `performance_labels`
AdminSetting). Benim etiket motorum FARKLI (canlı maç bağlamsal etiketleri). → Yeni admin sayfası
AYRI olmalı: **`/admin/settings/live-labels`** (veya `label-engine`). Eskiyi BOZMA.

**Backend HAZIR (bu session'da yapıldı):**
- `GET /api/v1/admin/labels` → `{catalog, tones, config}` (SettingsController::labels). Katalog =
  `LabelEngine::CATALOG` (kod), config = `labels_config` AdminSetting (admin ezme).
- `PUT /api/v1/admin/settings/labels_config` → kaydet (allowed listeye eklendi).
- `LabelEngine::CATALOG['live']` ~16 etiket: her biri `{name (şablon "OTP {champ}"), tone, thresholds, desc}`.
- `LabelEngine::TONE_COLOR` = good/bad/info/neutral → hex.

**Frontend KALAN — yeni admin sayfası `/admin/settings/live-labels`:**
- `fetchAdmin('/labels')` → catalog+config çek. Bağlam sekmeli (şimdilik sadece `live` dolu).
- Her etiket satırı: aç/kapa toggle + Ad input + Ton/Renk seçici (good/bad/info/neutral ya da özel hex)
  + Eşik input(lar)ı (thresholds: ör. otp→games, badCs→csPerMin). Desc göster.
- Kaydet → `putAdmin('/settings/labels_config', {value: config})`. config şekli:
  `labels_config[context][key] = {enabled, name?, tone?, color?, thresholds?}` (sadece ezilenler).
- Mevcut `admin/settings/elw-score/page.js` deseni mirror'la (`fetchAdmin`/`putAdmin` `@/lib/adminApi`).
- Admin settings menüsüne link ekle (eski "labels" = perfLabel'ı "Performans Etiketleri" diye
  netleştir; yeni = "Canlı Maç Etiketleri").

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
1. **Etiket motoru admin paneli** (yukarıda — TAM ŞU AN KALDIĞIMIZ YER).
2. **Şampiyon istatistikleri kart ÖN YÜZÜNE** — `championStat` (games/WR/KDA) backend'de HAZIR,
   sadece `LivePlayerCard` ön yüzünde göster (kullanıcı: "ön yüz=önemli veri, arka=detay").
3. **Duo tespiti** (canlı maç) — Spectator parti vermez; sezgisel: enrichment'taki son maç ID'leri
   ortak olanlar (aynı takımda birlikte oynamış) premade. recentGames[].matchId zaten var → ekstra
   API'siz, aynı takımda eşik üstü ortak maç → grupla (2-2-1, renkli işaret).
4. **Frontend priority-deferral**: 6+ öncelikli oyuncular limit yenilenince/retry ile sonra çek.
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
