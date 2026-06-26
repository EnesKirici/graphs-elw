# DEVAM — Sonraki Session İçin Kaldığımız Yer (2026-06-25; triyaj+ayıklama 2026-06-26)

> Bu dosya bir SONRAKİ session'ın kaldığı yerden devam etmesi için. Tüm proje durumu için
> `PROJE_DURUM.md` + `LIVE_GAME_PLAN.md` + memory dosyaları (`project_elw_scoring`,
> `project_live_game`). **Her şey LOCAL, CANLIYA ALINMADI (deploy en son).**

## 🟢 DEPLOY YAPILDI (2026-06-26) — canlı güncel
**27 commit canlıya alındı** (GitHub push + Plesk bare repo push + deploy dizinine `git checkout -f` +
backend cache:clear + frontend `npm run build` + pm2 restart + `summaries:flush` 1406 temizlendi).
Canlı doğrulandı: ALGO_VERSION 9, LabelEngine/live-labels VAR, tüm sayfalar HTTP 200, ana sayfa 0.12s.
⚠️ Bilinen küçük konu: `GET /api/v1/champions/rotation` 500 (ana sayfada kullanılmıyor, ayrı bakılır).
Eski "kaldığımız yer" notu (referans):
Etiket admin paneli ✅ KDA ✅ kart redizayn ✅ premade ✅ priority-deferral ✅ görüş/OTP-sezon ✅
**DB-opt items/runes trim ✅ (2026-06-26):** summary_json items/runes SLIM (sadece id) saklanır, okurken
DataDragon'dan hydrate (`MatchService::hydrateSummary`). Test: items+runes bloğu %92 küçüldü, ALGO_VERSION 9.
**worker-prewarm ✅ (zaten vardı:** CaptureLp adım 7 `ensureSeasonSummaries`). Hepsi BİTTİ.
**SIRADAKİ:** DEPLOY (#7) — kullanıcı zamanı söyleyecek. ⚠️ Deploy'da `summaries:flush` ŞART (ALGO_VERSION 9,
eski v8 özetler geçersiz). Opsiyonel ufak iş: yenile-butonu cooldown (RefreshButton var, server-side rate-limit yok).

## ✅ Etiket motoru iyileştirmesi (görüş + sezon-bazlı) — BİTTİ (commit'li)
- **OTP** artık "maçlarının %X'i bu şampiyon" (`share`, vars. 70) + `minGames` guard (1/1=%100 önler).
- **Sevdalısı** = SEZON çok oynamış (≥50). iyi/kötü/yeni de **sezon oyun+WR** bazlı (veteran "yeni" çıkmaz).
- **Veri:** `getSeasonChampionStats` (profildeki "Şampiyon Performansı" ile aynı; `match_summaries` DB,
  cache'li, **EKSTRA API YOK**). Mastery'ye gerek kalmadı.
- **YENİ "Yüksek/Düşük görüş"** (vizyon/dk, GENEL — tüm roller). `LiveGameService` base'e
  `avgVisionPerMin` + `seasonChampStats` eklendi, cache `live:player:v2→v3`.
- **Admin panel** eşik etiketleri netlendi (Oran %, Min maç, Vizyon/dk) + açıklamalar. Mock test ✓.
- ⚠️ Veri DB'ye bağlı: tanınmayan oyuncuda sezon-maç az → OTP/sevdalısı çıkmaz; worker gezdikçe dolar.

## ✅ Priority-deferral — BİTTİ (commit'li)
`LiveGameBoard` fetch: rate-limit'e takılıp düşen (backend `error:'rate_limited'/'failed'` veya null)
oyuncular artık KAYDEDİLMİYOR; öncelik sırasıyla **3 retry turu** (15sn arayla) tekrar deneniyor →
başarılı olunca backend DB'ye de yazar. Mock erken döndüğü için etkilenmez. Gerçek test sunucuda.

## ✅ Canlı kart redizayn + premade — BİTTİ (commit'li)
> (Eskiden bu bölüm DEVAM.md'de İKİ KEZ vardı ve etkileşim notu çelişiyordu; 2026-06-26'da
> koddan teyit edilip TEK doğru bölümde birleştirildi.)
- **Premade (duo/trio) tespiti** (`LiveGameBoard.premadeGroups`): aynı takımda ORTAK son maç ID'leri
  (`recentGames[].matchId`, eşik=2) → union-find gruplar. Ekstra API yok. Görsel: kart çevresine
  renkli iç-çerçeve (ring) + sol üst "Duo/Trio" dolu renkli pill (grup başına renk). Fixture'da 2-2-1.
- **Kart ön yüz redizayn:** üst istatistik KUTUSU kaldırıldı (splash'i kapatıyordu) → kutusuz
  gölgeli metin. Orta satır ikonları (spell/rol/rün) büyütüldü. Summoner adı **tıklanınca yeni
  sekmede profil** (`Link target=_blank` + stopPropagation). SEN rozeti + K/D/A kırılımı kaldırıldı.
- **Şampiyon KDA** ön yüzde (maç/WR altında, ölüm kırmızı, oran amber).
- **Kart etkileşim (NİHAİ, kodla teyitli):** **tek tık → o kartı çevirir** (`LivePlayerCard` setFlipped);
  ortadaki **VS butonu → flipSignal** yayınlar, tüm kartlar aynı hedefe snap. Çift-tık/XOR KALDIRILDI
  (sürekli sorun çıkarıyordu; eski "çift-tık tümünü çevir" notu GEÇERSİZ).
- **Takım renkleri:** API `searchedTeamId` (100=Mavi/200=Kırmızı) → "Senin/Rakip Takım · Mavi/Kırmızı".
- **Seri animasyonu:** yalnız **4+ seride** — ikon yanıp sönmez, **parçacıklar** ikon üzerindeki
  noktalardan doğup yükselir (alev kıvılcımı/buz tozu; `globals.css` .streak-fx/.ember/.frost). "Gününde" koyu cam pill.
- **Cila:** sert rank border yerine **çok minimal** rank renginde iç ışıma (`faceShadow`).

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
4. ✅ ~~Frontend priority-deferral~~ — BİTTİ (yukarıda).
5. ✅ ~~Görüş etiketleri + OTP/sevdalısı sezon-bazlı~~ — BİTTİ (yukarıda).
6. ✅ ~~DB-opt items/runes trim + worker-prewarm~~ — BİTTİ (2026-06-26). Trim: summary_json items/runes
   SLIM (sadece id) saklanır, okurken DataDragon'dan hydrate (`MatchService::slimItems/slimRunes` yazar,
   `hydrateSummary` okur). ALGO_VERSION 8→9 → eski v8 özetler geçersiz; **deploy'da `summaries:flush`**.
   Prewarm zaten vardı (CaptureLp adım 7). Geriye-uyum: eski full kayıtlar da hydrate'ten temiz geçiyor.
7. ✅ ~~DEPLOY~~ — YAPILDI (2026-06-26). 27 commit canlıya alındı (DB-opt trim + tüm ELW + canlı maç +
   etiketler + tema). Akış: GitHub push → Plesk bare repo (`~/git/graphs-elw.git`) push → deploy dizinine
   `git --git-dir=... --work-tree=... checkout -f master` → `npm run build` + pm2 restart → `summaries:flush`.
   ⚠️ Plesk OTOMATİK deploy YOK (hook yok) → checkout elle. config:cache YAPMA (key tuzağı). Detay: `project_deployment`.
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
