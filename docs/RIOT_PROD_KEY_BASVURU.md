# Riot Production Key — Başvuru Güncellemesi (App 853618)

---

# ✅ FİNAL METİN — EDIT APPLICATION → Product Description'a bunu yapıştır

> **⚠️ ALAN SINIRI: 1500 KARAKTER** (2026-07-29'da deneyerek ölçüldü — metin tam 1500'de kesiliyor.
> Eski başvuru metninin 1470 olması bu yüzden.) Aşağıdaki metin **1.491 karakter**, 9 karakter marj var.
> Doğrulandı: counter sayfaları CANLI (200), Product URL zaten `https://elwgraphs.com`.
> Mevcut metni tamamen sil, bunu yapıştır.

```
elwgraphs (https://elwgraphs.com) is a free, non-commercial LoL stats site for the Turkish server (TR1, EUROPE routing), live and public: no login, no ads, no paywall.

Players search any Riot ID for a ranked profile with full match history, per-match timeline breakdowns (lane phase, turret plates, KDA, kill participation, CS/min), an in-house performance score with a transparency modal, a per-game LP graph for opted-in tracked accounts, a live-game board, a champion tier list, and champion build/rune/counter pages built from our own match aggregation.

APIs: Account-V1, Summoner-V4, League-V4 (tier/LP + apex ladders), Match-V5 (ids, match, timeline), Spectator-V5, Champion-Mastery-V4, Platform-V3 (champion rotation), LoL-Status-V4. Assets: Data Dragon.

Only our Laravel backend calls Riot; the Next.js frontend calls our own API. We cache volatile data briefly, store completed matches once so they are never re-requested, run all calls on a rate-limit budget with 429 back-off, and never expose or sell raw data. Compliant with the Riot Developer Agreement and API Terms of Service.

Our dev key expires every 24h and breaks the live site daily. A production key would scale LP tracking from a few opted-in accounts to any searched player, and enable an Emerald+ ladder crawler so win/pick/ban rates, tier lists and counters come from real TR-wide data.

Moved from elwgraphs.elw.com.tr to elwgraphs.com (old domain 301-redirects). Ownership file: https://elwgraphs.com/riot.txt
```

**1500'e sığdırmak için feda edilenler** (hepsi ticket metnine taşındı, oraya yaz):
örnek sayfa linkleri (profil + Ahri counter), gizlilik politikası linki, build sayfasındaki
"rol-içi sıralama ve derece" detayı, iş kuyruğu (job queue) ayrıntısı, "percentiles".
**Korunanlar:** tam API listesi, uyum beyanı, production key gerekçesi, domain taşınma notu + riot.txt.

### 🇹🇷 Ne yazdığının Türkçesi

> elwgraphs (https://elwgraphs.com), Türk sunucusu (TR1, EUROPE yönlendirmesi) için ücretsiz ve
> ticari olmayan bir League of Legends istatistik sitesidir. Yayında ve herkese açıktır: giriş yok,
> reklam yok, ücretli üyelik yok.
>
> **Oyuncu ne elde ediyor:** herhangi bir Riot ID (GameName#TagLine) aratarak tam maç geçmişli
> dereceli profil; Match-V5 timeline verisinden üretilmiş maç-başı kırılımlar (koridor safhası,
> plaka payları, KDA, öldürme katkısı, dakikada CS); tam olarak nasıl hesaplandığını gösteren
> şeffaflık modalıyla kendi performans skorumuz; opt-in ile takip edilen birkaç hesap için maç-başı
> LP geçmişi grafiği; canlı maç ekranı (Spectator-V5); şampiyon tier list'i; rol-içi sıralama ve
> derece gösteren şampiyon build ve rün sayfaları; ve bir şampiyonun hangi rakipleri yendiğini ya da
> hangilerine kaybettiğini gösteren, kendi eşleşme (matchup) toplamamızdan üretilmiş şampiyon-başı
> counter sayfaları. Örnek sayfalar: (profil) ve (Ahri counter).
>
> **Kullanılan API'ler:** Account-V1, Summoner-V4, League-V4 (tier/LP, apex ligler, giriş sayfaları),
> Match-V5 (id'ler, maç, timeline), Spectator-V5, Champion-Mastery-V4, Platform-V3 (şampiyon
> rotasyonu), LoL-Status-V4. Statik görseller Data Dragon'dan gelir.
>
> **Uyum:** Riot'u yalnızca Laravel arka ucumuz çağırır; Next.js ön yüzü kendi API'mizi çağırır.
> Değişken veri kısa süreliğine önbelleğe alınır, biten maçlar bir kez saklanır ve bir daha asla
> istenmez, tüm trafik 429 geri-çekilmesi ve iş kuyruğu ile hız-limiti bütçesine bağlı çalışır, ham
> Riot yanıtları asla dışarı açılmaz ya da satılmaz. Riot Geliştirici Sözleşmesi'ne ve API Kullanım
> Şartları'na uyuyoruz. Gizlilik politikası: (privacy linki)
>
> **Neden production key'e ihtiyacımız var:** geliştirme anahtarımız her 24 saatte bir sona eriyor ve
> bu canlı siteyi her gün bozuyor. Production key, LP takibini bir avuç opt-in hesaptan aranan her
> oyuncuya ölçekler ve Zümrüt+ merdiven tarayıcısını çalıştırmamızı sağlar; böylece
> kazanma/seçilme/yasaklanma oranları, tier list'ler, counter'lar ve yüzdelikler küçük bir örneklem
> yerine gerçek TR geneli veriden gelir.
>
> **Not:** ürün elwgraphs.elw.com.tr adresinden elwgraphs.com adresine taşındı (eski alan adı 301 ile
> yönlendiriyor). Sahiplik doğrulama dosyası: (riot.txt linki)

### Eski metne göre neler değişti

| Değişiklik | Sebep |
|---|---|
| URL `elwgraphs.elw.com.tr` → `elwgraphs.com` | Site taşındı; inceleyici doğru adrese gitsin |
| **League-EXP-V4 çıkarıldı** | Kodda hiç çağrılmıyor — kullanılmayan API bildirmek gereksiz risk |
| **LoL-Status-V4 eklendi** | Gerçekten kullanılıyor (`RiotKeyStatusTest`) |
| "static champion info" → tier list + build/rün + counter | Hepsi artık gerçek veriyle CANLI, planlanan değil |
| "run on a dev key" ifadesi çıkarıldı | Dev key olduğu zaten belli; yerine 429 back-off + kuyruk yazıldı (daha güçlü uyum kanıtı) |
| Örnek sayfa linkleri eklendi | İnceleyici tek tıkla çalışan sayfa görsün |
| Gizlilik politikası linki eklendi | Uyum sinyali |
| riot.txt + domain taşınma notu eklendi | Doğrulama neden takılmış olabilir, açıkça anlatılıyor |

---


> Hazırlandı: 2026-07-28. **Başvuru tarihi: 2026-06-23** (portalda "Last Updated" alanı; Pending
> Review). 2026-07-29 itibarıyla **36 gün** — Riot'un 3 haftalık üst sınırı aşılmış, GitHub issue
> eşiği (30 gün) geçilmiş durumda.
> Amaç: yeni başvuru AÇMADAN mevcut app'i güncellemek.
>
> **Her İngilizce bloğun altında Türkçe karşılığı var.** Riot'a giden metin İngilizce olanıdır;
> Türkçesi yalnızca ne yazdığını anlaman için — portala Türkçe yapıştırma.

## Durum tespiti (2026-07-28 canlı test)

| Kontrol | Sonuç |
|---|---|
| `https://elwgraphs.elw.com.tr` (başvurudaki Product URL) | 301 → `https://elwgraphs.com/` |
| `https://elwgraphs.elw.com.tr/riot.txt` | **301, gövde yok** ← doğrulama riski |
| `https://elwgraphs.com/riot.txt` | 200 → `5c9a8e6c-c7e9-46de-bdb5-824a5f010561` |
| `https://elwgraphs.com` | 200 |
| `https://api.elwgraphs.com/api/v1/champions` | 200 |
| `/privacy`, `/terms`, `/tier-list` | 200 |
| `https://elwgraphs.com/champions/Ahri/counter` | **404** (henüz deploy edilmedi) |

**Sonuç:** Product URL güncellenmeli. Riot doğrulaması `riot.txt`'e bakar; kayıtlı domainde
dosya 200 dönmüyor.

## Yapılacaklar (sırayla)

1. **EDIT APP** → Product URL: `https://elwgraphs.com`
2. **EDIT APP** → Product Description: aşağıdaki metin (uzun sürüm; sığmazsa kısa sürüm)
3. **MESSAGES → CREATE A TICKET** → aşağıdaki ticket metni
4. Eski domaindeki `riot.txt`'i 301 yerine doğrudan servis etmeyi düşün (nginx'te
   `location = /riot.txt { return 200 "5c9a8e6c-..."; }`) — redirect izlemeyen doğrulayıcıya karşı sigorta
5. 30 günü geçerse: `github.com/RiotGames/developer-relations` → issue (aşağıdaki metin)

---

## 1) Product Description — UZUN SÜRÜM (2.059 karakter / 297 kelime)

### 🇬🇧 Portala yapıştırılacak metin

```
elwgraphs (https://elwgraphs.com) is a free, non-commercial League of Legends stats site for the
Turkish server (TR1, EUROPE routing). It is live and open to the public: no login, no ads, no paywall.

What players get: search any Riot ID (GameName#TagLine) to open a ranked profile with full match
history; per-match breakdowns built from Match-V5 timelines (lane phase, turret-plate splits, KDA,
kill participation, CS/min); an in-house performance score with a transparency modal showing exactly
how it was computed; a per-game LP history graph for a few opted-in tracked accounts; a live-game
board (Spectator-V5) with per-player context; a champion tier list and champion build/rune pages
driven by our own aggregated match data; and the Challenger/GM/Master ladder.
Example profile you can open right now: https://elwgraphs.com/summoner/elw/0000

APIs used: Account-V1, Summoner-V4, League-V4 (tier/LP, apex leagues, entry pages), Match-V5 (ids,
match, timeline), Spectator-V5, Champion-Mastery-V4, Platform-V3 (champion rotation), LoL-Status-V4.
Static assets come from Data Dragon.

Compliance: only our Laravel backend calls Riot; the Next.js frontend calls our own API. Volatile
data is cached briefly, completed matches are stored once so they are never re-requested, all
traffic runs on a rate-limit budget with 429 back-off and a job queue, and raw Riot responses are
never exposed or sold. We follow the Riot Developer Agreement and the API Terms of Service.
Privacy policy: https://elwgraphs.com/privacy

Why we need a production key: our development key expires every 24 hours, which breaks the live site
daily. A production key would let us track LP for every searched player instead of a handful of
opted-in accounts, and run an Emerald+ ladder crawler so champion win/pick/ban rates, tier lists and
percentiles come from real TR-wide data rather than a small sample.

Note: the product moved from elwgraphs.elw.com.tr to elwgraphs.com (the old domain 301-redirects to
the new one). Ownership verification file: https://elwgraphs.com/riot.txt
```

### 🇹🇷 Ne yazdığının Türkçesi

> elwgraphs (https://elwgraphs.com), Türk sunucusu (TR1, EUROPE yönlendirmesi) için ücretsiz ve
> ticari olmayan bir League of Legends istatistik sitesidir. Yayında ve herkese açıktır: giriş yok,
> reklam yok, ücretli üyelik yok.
>
> **Oyuncu ne elde ediyor:** herhangi bir Riot ID (GameName#TagLine) aratarak tam maç geçmişiyle
> birlikte dereceli profil açılır; Match-V5 timeline verisinden üretilmiş maç-başı kırılımlar
> (koridor safhası, plaka payları, KDA, öldürme katkısı, dakikada CS); tam olarak nasıl
> hesaplandığını gösteren şeffaflık modalıyla birlikte kendi geliştirdiğimiz performans skoru;
> opt-in ile takip edilen birkaç hesap için maç-başı LP geçmişi grafiği; oyuncu-başı bağlam sunan
> canlı maç ekranı (Spectator-V5); kendi topladığımız maç verisinden üretilen şampiyon tier list'i
> ve şampiyon build/rün sayfaları; ve Challenger/GM/Master merdiveni.
> Hemen açabileceğiniz örnek profil: https://elwgraphs.com/summoner/elw/0000
>
> **Kullanılan API'ler:** Account-V1, Summoner-V4, League-V4 (tier/LP, apex ligler, giriş sayfaları),
> Match-V5 (id'ler, maç, timeline), Spectator-V5, Champion-Mastery-V4, Platform-V3 (şampiyon
> rotasyonu), LoL-Status-V4. Statik görseller Data Dragon'dan gelir.
>
> **Uyum:** Riot'u yalnızca Laravel arka ucumuz çağırır; Next.js ön yüzü kendi API'mizi çağırır.
> Değişken veri kısa süreliğine önbelleğe alınır, biten maçlar bir kez saklanır ve bir daha asla
> istenmez, tüm trafik 429 geri-çekilmesi ve iş kuyruğu ile hız-limiti bütçesine bağlı çalışır, ham
> Riot yanıtları asla dışarı açılmaz ya da satılmaz. Riot Geliştirici Sözleşmesi'ne ve API Kullanım
> Şartları'na uyuyoruz. Gizlilik politikası: https://elwgraphs.com/privacy
>
> **Neden production key'e ihtiyacımız var:** geliştirme anahtarımız her 24 saatte bir sona eriyor
> ve bu canlı siteyi her gün bozuyor. Production key sayesinde LP takibini bir avuç opt-in hesap
> yerine aranan her oyuncu için yapabilir; Zümrüt+ merdiven tarayıcısını çalıştırarak şampiyon
> kazanma/seçilme/yasaklanma oranlarını, tier list'leri ve yüzdelikleri küçük bir örneklem yerine
> gerçek TR geneli veriden üretebiliriz.
>
> **Not:** ürün elwgraphs.elw.com.tr adresinden elwgraphs.com adresine taşındı (eski alan adı 301 ile
> yeniye yönlendiriyor). Sahiplik doğrulama dosyası: https://elwgraphs.com/riot.txt

---

## 2) Product Description — KISA SÜRÜM (1.482 karakter / 202 kelime, sınır darsa)

> Referans: mevcut başvurudaki metin ~1.470 karakter — kısa sürüm onunla neredeyse aynı boyutta,
> yani form kesin kabul eder. Uzun sürüm ondan ~%40 büyük; sınır varsa buna düş.

### 🇬🇧 Portala yapıştırılacak metin

```
elwgraphs (https://elwgraphs.com) is a free, non-commercial League of Legends stats site for the
Turkish server (TR1, EUROPE routing), live and open to the public with no login, ads or paywall.

Players search any Riot ID to get a ranked profile, full match history with per-match timeline
breakdowns (lane phase, turret plates, KDA, kill participation, CS/min), an in-house performance
score with a transparency modal, a per-game LP graph for opted-in tracked accounts, a live-game
board, a champion tier list, champion build/rune pages and per-champion counter pages from our own
aggregated data, plus the Challenger/GM/Master ladder.
Examples: https://elwgraphs.com/summoner/elw/0000 and https://elwgraphs.com/champions/Ahri/counter

APIs: Account-V1, Summoner-V4, League-V4, Match-V5 (ids/match/timeline), Spectator-V5,
Champion-Mastery-V4, Platform-V3, LoL-Status-V4. Assets from Data Dragon.

Only our Laravel backend calls Riot; the Next.js frontend calls our own API. We cache volatile data
briefly, store completed matches once, run every call on a rate-limit budget with 429 back-off, and
never sell or expose raw data. Riot Developer Agreement and API ToS compliant.
Privacy: https://elwgraphs.com/privacy

A dev key expires every 24h and breaks the live site daily. A production key would scale LP tracking
to any searched player and enable an Emerald+ ladder crawler for real TR-wide champion statistics.

The product moved from elwgraphs.elw.com.tr to elwgraphs.com (old domain 301-redirects).
Verification: https://elwgraphs.com/riot.txt
```

### 🇹🇷 Ne yazdığının Türkçesi

> elwgraphs (https://elwgraphs.com), Türk sunucusu (TR1, EUROPE yönlendirmesi) için ücretsiz ve
> ticari olmayan, yayında ve herkese açık bir League of Legends istatistik sitesidir; giriş, reklam
> veya ücretli üyelik yoktur.
>
> Oyuncular herhangi bir Riot ID aratarak dereceli profil, maç-başı timeline kırılımlarıyla tam maç
> geçmişi (koridor safhası, plakalar, KDA, öldürme katkısı, dakikada CS), şeffaflık modallı kendi
> performans skorumuz, opt-in takip edilen hesaplar için maç-başı LP grafiği, canlı maç ekranı,
> kendi topladığımız veriden şampiyon tier list'i ve build/rün sayfaları, ayrıca Challenger/GM/Master
> merdivenini elde eder. Örnek profil: https://elwgraphs.com/summoner/elw/0000
>
> **API'ler:** Account-V1, Summoner-V4, League-V4, Match-V5 (id/maç/timeline), Spectator-V5,
> Champion-Mastery-V4, Platform-V3, LoL-Status-V4. Görseller Data Dragon'dan.
>
> Riot'u yalnızca Laravel arka ucumuz çağırır; Next.js ön yüzü kendi API'mizi çağırır. Değişken
> veriyi kısa süre önbellekleriz, biten maçları bir kez saklarız, her çağrıyı 429 geri-çekilmeli bir
> hız-limiti bütçesiyle çalıştırırız ve ham veriyi asla satmaz ya da dışarı açmayız. Riot Geliştirici
> Sözleşmesi ve API Kullanım Şartları'na uyumludur. Gizlilik: https://elwgraphs.com/privacy
>
> Geliştirme anahtarı her 24 saatte bir sona eriyor ve canlı siteyi her gün bozuyor. Production key,
> LP takibini aranan her oyuncuya ölçekler ve gerçek TR geneli şampiyon istatistikleri için Zümrüt+
> merdiven tarayıcısını mümkün kılar.
>
> Ürün elwgraphs.elw.com.tr adresinden elwgraphs.com adresine taşındı (eski alan adı 301 ile
> yönlendiriyor). Doğrulama: https://elwgraphs.com/riot.txt

---

## 2.5) ⏳ Counter sayfaları CANLIYA çıkınca eklenecek

> Durum (2026-07-28): `/champions/[id]/counter` local'de hazır ama **canlıda 404** — henüz deploy
> edilmedi. Riot inceleyicisi göremeyeceği bir özelliği yazmak red sebebidir, o yüzden metne
> KOYULMADI. Deploy bittikten sonra aşağıdaki komutla 200 döndüğünü doğrula, sonra uzun sürümdeki
> özellik cümlesinin sonuna (Challenger/GM/Master ladder'dan hemen sonra) şu eki yapıştır:

```
; and per-champion counter pages showing which opponents a champion beats or loses to,
built from our own matchup aggregation
```

**🇹🇷 Türkçesi:** "…ve bir şampiyonun hangi rakipleri yendiğini ya da hangilerine kaybettiğini
gösteren, kendi eşleşme (matchup) toplamamızdan üretilmiş şampiyon-başı counter sayfaları."

**Doğrulama komutu:**

```powershell
(Invoke-WebRequest 'https://elwgraphs.com/champions/Ahri/counter' -UserAgent 'Mozilla/5.0').StatusCode
```

---

## 3) Support ticket metni (MESSAGES → CREATE A TICKET)

**Subject:** `Production key application 853618 (elwgraphs) — domain changed, application updated`

### 🇬🇧 Gönderilecek metin

```
Hi,

I have a production key application pending review:

  App name: elwgraphs
  App ID:   853618
  Submitted: 2026-06-23
  Status:   Pending Review

I am writing for two reasons.

1) The product URL changed. The site was migrated to a new server and now runs on
   https://elwgraphs.com. The old domain (elwgraphs.elw.com.tr) still 301-redirects to it, but the
   application was registered with the old URL. I have updated the Product URL and the product
   description in the developer portal accordingly.

   The ownership file is served on the new domain:
   https://elwgraphs.com/riot.txt -> 5c9a8e6c-c7e9-46de-bdb5-824a5f010561

   If the automated verification does not follow redirects, that may be why the application has not
   progressed. Please let me know if I should keep the old domain registered instead, or if any
   additional verification step is needed.

2) Since submitting, the product has shipped several features that were only planned at the time:
   a champion tier list, champion build and rune pages (with in-role ranking and grade), per-champion
   counter pages built from our own matchup aggregation, a live-game board, and a per-game LP history
   graph — all built on real data and publicly available on the site right now.

   The product description field is limited to 1500 characters, so I could not fit example links
   there. Pages you can open directly:
     https://elwgraphs.com/summoner/elw/0000        (player profile + match history + score modal)
     https://elwgraphs.com/champions/Ahri/counter   (counter page from our matchup aggregation)
     https://elwgraphs.com/tier-list                (champion tier list)
     https://elwgraphs.com/privacy                  (privacy policy)

The site is fully working on a development key today (which is exactly the problem: the key expires
every 24 hours and the site breaks daily). Everything is TR1-only, free, non-commercial, no login,
no ads, and no raw Riot data is exposed or resold.

Happy to provide anything else you need for the review.

Thanks,
ELW (elw#0000)
```

### 🇹🇷 Ne yazdığının Türkçesi

> **Konu:** Production key başvurusu 853618 (elwgraphs) — alan adı değişti, başvuru güncellendi
>
> Merhaba,
>
> İncelemede bekleyen bir production key başvurum var:
> Uygulama adı: elwgraphs / App ID: 853618 / Gönderim: 2026-07-08 / Durum: Pending Review
>
> İki sebeple yazıyorum.
>
> **1)** Ürün URL'i değişti. Site yeni bir sunucuya taşındı ve artık https://elwgraphs.com üzerinde
> çalışıyor. Eski alan adı (elwgraphs.elw.com.tr) hâlâ 301 ile buraya yönlendiriyor, ancak başvuru
> eski URL ile kaydedilmişti. Geliştirici portalındaki Product URL'i ve ürün açıklamasını buna göre
> güncelledim.
>
> Sahiplik dosyası yeni alan adında sunuluyor:
> https://elwgraphs.com/riot.txt → 5c9a8e6c-c7e9-46de-bdb5-824a5f010561
>
> Otomatik doğrulama yönlendirmeleri takip etmiyorsa, başvurunun ilerlememesinin sebebi bu olabilir.
> Bunun yerine eski alan adının kayıtlı kalmasını mı istersiniz, ya da ek bir doğrulama adımı gerekir
> mi, bildirmenizi rica ederim.
>
> **2)** Başvurudan bu yana, o tarihte yalnızca planlanmış olan birkaç özellik yayına girdi: şampiyon
> tier list'i, şampiyon build ve rün sayfaları, canlı maç ekranı ve maç-başı LP geçmişi grafiği —
> hepsi gerçek veriyle çalışıyor ve şu anda sitede herkese açık.
>
> Site bugün geliştirme anahtarıyla tamamen çalışıyor (sorun da tam olarak bu: anahtar her 24 saatte
> bir sona eriyor ve site her gün bozuluyor). Her şey yalnızca TR1 içindir; ücretsiz, ticari değil,
> giriş yok, reklam yok ve hiçbir ham Riot verisi dışarı açılmıyor veya yeniden satılmıyor.
>
> İnceleme için ihtiyacınız olan başka bir şeyi memnuniyetle sağlarım.
>
> Teşekkürler, ELW (elw#0000)

---

## 4) GitHub issue — ✅ ARTIK UYGUN (36 gün doldu, eşik geçildi)

> Sıra: önce EDIT APP submit + ticket. Ticket'a birkaç gün cevap gelmezse issue'yu aç.

Repo: `RiotGames/developer-relations` → New issue

**Başlık:** `[Application Review] Production Key Pending 30+ Days — elwgraphs (ID: 853618)`

### 🇬🇧 Gönderilecek metin

```
App name: elwgraphs
App ID: 853618
Type: Production key
Submitted: 2026-06-23
Status: Pending Review for 36 days (no messages received)
Product URL: https://elwgraphs.com
Region: TR1 (EUROPE routing)

A free, non-commercial LoL stats site for the Turkish server, publicly live and fully functional on
a development key. The application has been pending for over 30 days with no response in the
Messages tab and no reply to the support ticket I opened.

Note: the product domain changed from elwgraphs.elw.com.tr to elwgraphs.com after submission (old
domain 301-redirects). I updated the Product URL in the portal, and riot.txt is served on the new
domain: https://elwgraphs.com/riot.txt

Could someone please check whether the application is blocked on domain verification or is simply
still in the queue? Thank you.
```

### 🇹🇷 Ne yazdığının Türkçesi

> **Başlık:** [Başvuru İncelemesi] Production Key 30+ Gündür Beklemede — elwgraphs (ID: 853618)
>
> Uygulama adı: elwgraphs / App ID: 853618 / Tür: Production key / Gönderim: 2026-07-08 /
> Durum: Pending Review (hiç mesaj alınmadı) / Ürün URL: https://elwgraphs.com /
> Bölge: TR1 (EUROPE yönlendirmesi)
>
> Türk sunucusu için ücretsiz, ticari olmayan bir LoL istatistik sitesi; herkese açık yayında ve
> geliştirme anahtarıyla tam çalışır durumda. Başvuru 30 günden uzun süredir beklemede; Messages
> sekmesinde hiçbir yanıt yok ve açtığım destek talebine de cevap gelmedi.
>
> Not: ürün alan adı başvurudan sonra elwgraphs.elw.com.tr adresinden elwgraphs.com adresine
> değişti (eski alan adı 301 ile yönlendiriyor). Portaldaki Product URL'i güncelledim ve riot.txt
> yeni alan adında sunuluyor: https://elwgraphs.com/riot.txt
>
> Başvurunun alan adı doğrulamasına mı takıldığını yoksa sadece sırada mı beklediğini kontrol
> edebilir misiniz? Teşekkürler.

---

## EK — Kullandığımız Riot API'leri ne işe yarıyor (koddan çıkarıldı)

| Riot API | Nerede çağrılıyor | Ne döner | Sitede neyi besliyor |
|---|---|---|---|
| **Account-V1** `by-riot-id` | `SummonerService` | isim#tag → puuid | Arama kutusu — her profilin ilk adımı |
| **Account-V1** `by-puuid` | `SummonerService`, `LeaderboardController` | puuid → isim#tag | Liderlik tablosundaki oyuncu adları |
| **Summoner-V4** `by-puuid` | `SummonerService` | seviye, profil ikonu | Profil başlığı |
| **League-V4** `entries/by-puuid` | `LeagueService` | tier/rank/LP, galibiyet-mağlubiyet | Rank rozeti, WR ve **LP grafiği** (`lp:capture` 10 dk'da bir okur → `lp_snapshots`) |
| **League-V4** apex ligler | `LeaderboardController`, `LadderCrawl` | Challenger/GM/Master listeleri | `/leaderboard` sayfası |
| **League-V4** `entries/{queue}/{tier}/{div}` | `LadderCrawl` | Zümrüt+ oyuncu havuzu | Meta/tier list için maç toplanacak oyuncu havuzu |
| **Match-V5** `ids by-puuid` | `MatchDataService`, `CollectMatches` | maç id listesi | Maç geçmişi sayfalama + worker'ın toplayacağı maçlar |
| **Match-V5** maç detayı | `MatchDataService` | 10 oyuncunun tam istatistiği | Maç kartları, KDA/CS/hasar, **ELW skoru**, WR/pick/ban, tier list, build/rün, counter |
| **Match-V5** timeline | `MatchDataService`, `ProcessMatchJob` | dakika dakika olaylar | Plaka savaşı, koridor safhası, **@15 gold/CS/XP farkı**, yetenek sırası, eşya alım sırası |
| **Spectator-V5** `active-games` | `SpectatorService` | devam eden maç | `/live-game` sayfası |
| **Spectator-V5** `featured-games` | `SpectatorService` | öne çıkan maçlar | Canlı maç vitrini |
| **Champion-Mastery-V4** `top` + `scores` | `ChampionMasteryService` | ustalık puanları | Profildeki ustalık bölümü |
| **Platform-V3** `champion-rotations` | `MetaService` | haftalık ücretsiz rotasyon | Şampiyon rotasyon bilgisi |
| **LoL-Status-V4** `platform-data` | `RiotKeyStatus` | sunucu durumu | Admin panelde key/sunucu sağlığı |
| **Data Dragon** (Riot API değil) | `assets:sync` | statik görseller | Şampiyon/eşya/rün ikonları (`/dd` aynası) |

### Hangi hesap hangi veriden çıkıyor

| Hesaplanan | Kaynak |
|---|---|
| **ELW performans skoru** | Match-V5 maç detayı + timeline |
| **Tier list / WR / pick / ban** | Toplanan maçların agregasyonu (`champion_stats`, `stats:rebuild`) |
| **Build ve rün sayfaları** | Maç detayı (perks, eşyalar) + timeline (yetenek/eşya sırası) |
| **Counter sayfaları** | `champion_matchups` — karşı koridor eşleşmesi + @15 farkı + KDA/hasar/KP (`BuildAggregationService`) |
| **LP grafiği** | League-V4 entries anlık görüntüleri, maçlarla eşleştirilmiş (`LpTrackingService`) |

> **League-EXP-V4 kullanılmıyor** — eski başvuru metninde yazıyordu, kaldırıldı.

---

## Onaydan sonra yapılacaklar (hatırlatma)

- `php artisan players:dedupe` **TEKRAR** çalıştır (puuid'ler key başına şifreli → key değişince mükerrer açılır, `DEVAM.md:17`)
- Worker bütçelerini büyüt: `config/elwgraphs.php` → `worker.match_budget`, `entry_pages_per_division`, `--players`
- Supervisor ile kalıcı `queue:work`
- `ladder:crawl` + `matches:collect` scheduler'a bağla (WORKER_PLAN Aşama 3)
