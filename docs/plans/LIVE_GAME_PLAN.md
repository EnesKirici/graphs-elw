# Canlı Maç (Live Game) — İzlediğimiz Yol & Gelecek Planı

> Hedef: **porofessor-tarzı** canlı maç ekranı — her oyuncu için rol, ana-rol, şampiyon
> istatistikleri ve zengin oynayış etiketleri (OTP, Autofill, Roaming, Bad CSer…).
> Durum (2026-06-25): temel altyapı + rol/sıra çalışıyor; zengin veri **rate-limit'e bağlı**.
>
> **✅ GÜNCELLEME (2026-06-26):** Aşağıdaki "Sıradaki (öncelik)" listesinin **1-5'i BİTTİ**
> (LabelEngine bağlandı + admin panel `live-labels` + şampiyon KDA ön yüzde + duo tespiti +
> priority-deferral; bkz. `DEVAM.md`). Sadece **6 (production key sonrası tam kapsama)** kaldı.
> "Duo tespiti (HENÜZ YAPILMADI)" başlığı artık geçersiz — premade tespiti yapıldı.

## Temel kısıtlar (bunları unutma)
1. **Riot canlı maçta ROL VERMEZ.** Spectator-V5 yalnız şampiyon + sihirdar büyüleri + takım
   döndürür; pozisyon/lane alanı YOKTUR → rol **tahmin** edilmek zorunda.
2. **Personal key rate-limit.** 10 rastgele oyuncunun maç geçmişini çekmek limiti aşıyor →
   sadece DB'de olan oyuncular tam veri alıyor, gerisi boş. Porofessor **production key** +
   her şeyi cache'leyerek çözüyor. Bizde **kısmi veri** stratejisi seçildi (kullanıcı kararı).

## Rol tahmini (YAPILDI — `LiveGameService::assignTeamRoles`)
Takım-seviyesi BENZERSİZ atama (5 oyuncu → 5 farklı rol):
1. **Smite (büyü 11) → JUNGLE** (kilit).
2. Kalanlar şampiyon pozisyon tercihiyle (Meraki, 171 şampiyon) **EN KESİN önce** (az
   seçenekli/tek-rol şampiyon — ör. Vayne=ADC — çakışmadan yerini alır; esnekler sonra).
3. Boş kalanlar → kalan boş roller.
4. `Top→JG→Mid→ADC→Sup` sırasına dizilir. `autofilled` = atanan rol şampiyonun tipik
   pozisyonu değilse.
- **Daha iyisi (KALAN):** oyuncunun son maçlarındaki **ANA ROLÜNÜ** kullan (en güvenilir;
  porofessor böyle). Ama bu maç-geçmişi ister → rate-limit. Production key sonrası ekle.

## Veri zenginleştirme (`getPlayerEnrichment`, kişi başı 5dk cache)
- Son **6 maç** (rate-limit için 10'dan düşürüldü) → ana-rol, son-form, rozetler, ELW ort.
- **KALAN zengin etiketler** (porofessor'daki gibi — son maçlardan türetilir):
  - **OTP / "X lover"** — son maçların çoğu aynı şampiyon.
  - **Autofill?** — oynadığı rol ana rolü değil (`autofilled` zaten var, son-maç ana-rolüyle birleştir).
  - **Roaming** — düşük CS + yüksek KP/gezme.
  - **Bad CSer** — düşük CS/dk.
  - **Aggressive Laner / Invader** — erken kill/ölüm yoğun.
  - **Epic Stealer** — `epicMonsterSteals`.
  - **Cold Streak / Win Streak** — son maç serisi.
  - **"X newbie"** — bu şampiyonda az maç.
  - **Main Picked by Enemy** — ana şampiyonu düşman takımda.
- **Şampiyon istatistikleri (KALAN, kart ÖN YÜZÜNE):** bu şampiyonda kaç maç + WR + KDA +
  (varsa) şampiyon-sırası. Kullanıcı: "şampiyona ait sıralamalar ön yüzde, arka yüz detay."

## Rate-limit stratejisi — ÖNCELİKLİ-AŞAMALI FETCH (kullanıcı kararı 2026-06-25)
Personal key'le 10 ağır enrichment limiti aşıyor → **bana en yakın matchup'ları ÖNCE çek.**
`LiveGameService::fetchPriority` her oyuncuya öncelik verir (her oyuncuda `fetchPriority` alanı):
- **0** = ben · **1** = koridor rakibim · **2** = düşman orman · **3** = bizim orman
- **4-5** = bot eşi/rakibi (ben botlane isem) · **6+** = diğer koridorlar
→ Frontend bu sıraya göre çeker. İlk ~5 (öncelik 1-5) HEMEN; geri kalan (6+) **limit yenilenince
veya worker** ile sonra. Örn: ben mid isem önce karşı mid + iki ormancı; ben ADC isem önce karşı
ADC + karşı sup + iki ormancı + bizim sup. **Production key'de bu öncelik gereksiz** (hepsi tek seferde).
- **KALAN:** frontend'in priority sırasıyla fetch'i + 6+ için worker/retry deferral mekanizması.

## Etiket Motoru — `App\Services\LabelEngine` (KATALOG + ADMİN AYAR)
Kullanıcı: tüm etiketler admin'den yönetilsin (aç/kapa + renk + eşik), bağlama göre ayrı.
- **3 bağlam:** `live` (canlı maç), `profile`, `match`. KATALOG kodda (`CATALOG`), mantık `check()`'te.
- **`live` kataloğu (kuruldu, ~15 etiket):** otp / {champ} sevdalısı / {champ}'da yeni / İyi {champ} /
  Kötü {champ} / Main'i Karşıda / Galibiyet-Mağlubiyet Serisi / Zayıf-İyi Farmcı / Autofill /
  Feed Eğilimi / Agresif / Formda / Formsuz. Her biri: ton(renk) + eşik (admin'den ezilir).
- **Admin ezme:** `AdminSetting` `labels_config[context][key]` = {enabled, color, tone, name, thresholds}.
- `evaluate(context, data)` → renkli etiket listesi. `data` = enrichment + canlı bağlam (liveChamp,
  liveChampGames/Wr, mainChamp, enemyChamps, role, autofilled, avgCsPerMin/Deaths/Kills, streak, elwAverage).
- **KALAN:** (1) enrichment'a bu aggregate'leri ekle (avgCs/Deaths/Kills, mainChamp, streak) + enemyChamps
  geçir + LabelEngine'i çağır. (2) Admin paneli `/admin/settings/labels` (bağlam sekmeli CRUD+renk+eşik).
  (3) Frontend etiketleri renkli göster. (4) Şampiyon istatistikleri kart ÖN YÜZÜNE (kullanıcı: ön yüz=önemli).
- Vizyon-temelli etiketler (Yürüyen Totem / Totem Unutan) → maç özetinde vizyon yok; eklenince yapılır.

## Duo tespiti (✅ YAPILDI — 2026-06-26 güncellemesi)
> Premade (duo/trio) tespiti yapıldı: `LiveGameBoard.premadeGroups` ortak son maç ID'leriyle union-find
> gruplar, renkli ring + "Duo/Trio" pill. Aşağısı orijinal plan.

Spectator-V5 parti bilgisi vermez → sezgisel: her oyuncunun **son maç ID'leri ortak** olanlar (aynı
takımda birlikte oynamış) premade. enrichment zaten son maçları çekiyor (matchId'ler var) → **ekstra
API'siz** aynı takımda eşik üstü ortak maç olanları grupla (2-2-1 ayrımı, renkli işaret). Öncelikli-fetch
ile sınırlı (veri olan oyuncular için). Production key'de tam.

## Yapıldı (bu oturum)
- ✅ Takım-seviyesi rol ataması + koridor sırası + autofill işareti (Vayne→ADC doğrulandı).
- ✅ Fetch 10→6 + **öncelikli-aşamalı fetch** (`fetchPriority`).
- ✅ Rozet kart önyüzünde **en yüksek 3**.
- ✅ **Etiket motoru** `LabelEngine` (live kataloğu + admin-config-aware evaluate).

## Sıradaki (öncelik)
1. ✅ ~~LabelEngine'i bağla: enrichment aggregate'leri + enemyChamps + evaluate + frontend renkli gösterim.~~ BİTTİ.
2. ✅ ~~Admin paneli (bağlam sekmeli, aç/kapa+renk+eşik).~~ BİTTİ — `/admin/settings/live-labels`.
3. ✅ ~~Şampiyon istatistikleri kart ön yüzüne.~~ BİTTİ — şampiyon KDA ön yüzde.
4. ✅ ~~Duo tespiti (ortak maç sezgiseli).~~ BİTTİ — `premadeGroups`.
5. ✅ ~~Frontend priority-sıralı fetch + 6+ deferral (worker/retry).~~ BİTTİ — priority-deferral (3 retry turu).
6. **Production key sonrası (KALAN):** 10 oyuncu tam çek → güvenilir rol + tam etiket + tam kapsama + duo.

İlgili: `project_live_game` (memory), `LiveGameService.php`, `LabelEngine.php`, `LivePlayerCard.js`.
