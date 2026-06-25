# Canlı Maç (Live Game) — İzlediğimiz Yol & Gelecek Planı

> Hedef: **porofessor-tarzı** canlı maç ekranı — her oyuncu için rol, ana-rol, şampiyon
> istatistikleri ve zengin oynayış etiketleri (OTP, Autofill, Roaming, Bad CSer…).
> Durum (2026-06-25): temel altyapı + rol/sıra çalışıyor; zengin veri **rate-limit'e bağlı**.

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

## Yapıldı (bu oturum)
- ✅ Takım-seviyesi rol ataması + koridor sırası + autofill işareti (Vayne→ADC doğrulandı).
- ✅ Fetch 10→6 (rate-limit hafifletme).
- ✅ Rozet kart önyüzünde **en yüksek 3** ile sınırlandı (kayma fix).

## Sıradaki (öncelik)
1. Zengin etiketler (yukarıdaki liste) — son-maç verisi olan oyuncular için hesapla, gerisinde
   "veri yok" zarif göster. Worker gezdikçe DB dolar → kapsama artar.
2. Şampiyon istatistiklerini kart ön yüzüne taşı (ön yüz = önemli veri).
3. Ana-rol bazlı rol tahmini (veri olan oyuncularda assignTeamRoles'u override et).
4. **Production key sonrası:** 10 oyuncuyu da tam çek → güvenilir rol + tam etiket + tam kapsama.

İlgili: `project_live_game` (memory), `LiveGameService.php`, `LivePlayerCard.js`.
