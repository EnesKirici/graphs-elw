# Şampiyon Sıralaması — Hesaplama Mantığı (Methodology)

> **Durum:** Henüz UYGULANMADI. Frontend'de `ChampPerfListPro.js` içindeki `placeholderChampRank`
> (DEMO/test verisi) ile gösteriliyor. Gerçek sıralar **worker** ile bu mantığa göre hesaplanıp
> `championRank` olarak gelecek. Bkz. [[WORKER_PLAN]], [[PROFILE_RANKINGS_PLAN]].

Referans: u.gg / lolprofile tarzı "şampiyon başına oyuncu sıralaması". Aşağıdaki kurallar referans
sitenin ("How are players ranked?") açıklamasından alındı; **biz de zamanla bu mantıkla çalıştıracağız.**

---

## Genel Mantık

1. Her **(oyuncu, şampiyon, rol)** üçlüsü için **iki skor** hesaplanır:
   - **Sezon skoru** (current season — bu sezonun tüm maçları)
   - **Son 30 gün skoru** (past 30 days)
2. Sonra bu ikisinin **geometrik ortalaması** alınarak **üçüncü (nihai) skor** bulunur:
   ```
   nihaiSkor = sqrt(sezonSkoru × son30GünSkoru)
   ```
3. Oyuncular, o şampiyonda **en iyi "ortalama skoru"na** göre sıralanır (rol başına bir ortalama skor).
   Yani bir oyuncunun o şampiyon + rol kombinasyonundaki en iyi skoru, o şampiyondaki sırasını belirler.
4. Tüm oyuncular bu nihai skora göre **büyükten küçüğe** dizilir → 1., 2., 3. ... sıra.
   (Hem **Dünya** hem **bölge/TR** için ayrı sıralama: aynı skor listesi, bölgeye göre filtreli.)

---

## İki Skorun (sezon + 30 gün) Hesaplanması — Çarpan Kuralları

Skor **çarpımsal (multiplicative) ve üstel (exponential)** bir modeldir. Bir temel skordan başlanır,
her faktör çarpan olarak uygulanır:

| Faktör | Kural | Anlamı |
|---|---|---|
| **Tier (rank)** | `+1 tier → skor × 4` | Şampiyonun oynandığı maçların **ortalama tier'i**. En baskın faktör. **Üstel**: `+2 tier → × 16` (4²), `+3 tier → × 64`. Yani yüksek rankta (Challenger maçları) oynamak skoru katlar. |
| **Winrate** | `+%12 winrate → skor × 2` | O **şampiyon/rol ortalamasına** göre fazladan her +%12 WR, skoru 2'yle çarpar (üstel). |
| **KDA** | `+%100 KDA → skor × 1.33` | O şampiyon/rol ortalamasına göre KDA iki katıysa (+%100) skor × 1.33 (üstel). |

> "Tier" = maç başına oyuncunun rankı değil, **o şampiyonla oynanan maçların ortalama tier'i** (lobi seviyesi).

---

## Uygunluk ve Ceza Kuralları

| Kural | Etki |
|---|---|
| **Minimum 10 maç** | Sıralanabilmek için o şampiyon/rolde en az **10 maç** gerekir. |
| **<50 maç cezası** | 50'den az maç oynadıysan **eksik her maç için skor × 0.75**. (Az örneklem cezası — 50 maça yaklaştıkça ceza azalır.) |
| **Son 30 günde ≥1 dereceli maç** | O şampiyonla sıralanmak için son 30 günde **en az 1 dereceli maç** şart. |
| **Son 30 günde <5 maç cezası** | Son 30 günde o şampiyonla 5'ten az maç → **eksik her maç için skor × 0.5**. |

---

## Özet Formül (yaklaşık)

Bir dönem (sezon veya 30g) için:
```
skor = TEMEL
     × 4   ^ (ortalamaTier − referansTier)              # tier farkı (üstel)
     × 2   ^ ((winrate − şampyonRolOrtWR) / 12%)         # WR farkı (üstel)
     × 1.33^ ((kda     − şampyonRolOrtKDA) / 100%)        # KDA farkı (üstel)
     × 0.75^ (max(0, 50 − toplamMaç))                     # <50 maç cezası
     × 0.5 ^ (max(0, 5  − son30gMaç))                     # son 30g <5 maç cezası

nihaiSkor = sqrt(sezonSkoru × son30GünSkoru)             # geometrik ortalama
```
Oyuncular `nihaiSkor` azalan sırada → Dünya/TR sırası.

**Kilit içgörü:** Tier (×4 üstel) açık ara en baskın faktör. Yüksek rankta tutarlı oynamak, yüksek
WR/KDA'dan çok daha fazla skor getirir. WR ve KDA "şampiyon/rol ortalamasına göre" göreceli ölçülür
(meta/şampiyon dengesizliğini nötrler).

---

## Bizim Projede Uygulama Notları (worker)

- **Gerekli veri (oyuncu × şampiyon × rol başına):** sezon ve son-30g için → maç sayısı, ortalama tier
  (lobi), winrate, KDA. Ayrıca **şampiyon/rol global ortalama WR ve KDA** (kıyas için).
- Worker tüm (oyuncu, şampiyon, rol) skorlarını hesaplayıp **azalan sırada indeksler** → her oyuncuya
  o şampiyondaki Dünya + bölge sırası (`championRank = { global, tr }`).
- Frontend `ChampPerfListPro` zaten `c.championRank.global / .tr` bekliyor; worker doldurunca
  `placeholderChampRank` (DEMO) devre dışı kalır.
- Performans/ölçek: bu ağır bir batch iş — [[WORKER_PLAN]] Aşama'larıyla ve [[DB_OPTIMIZATION_PLAN]]
  (match_summaries) ile periyodik hesaplanmalı, anlık değil.
