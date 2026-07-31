# Sıralama — Division Filtreleri (Bronze I/II vb.) — Plan

> **Durum (2026-07-31): PLANLANDI, kodlanmadı.** Frontend'de iskelet hazır
> (`LeaderboardPro.js`'teki `TIERS` dizisi 10 derecenin tamamını listeliyor, Diamond
> ve altı `enabled:false` + kilit rozetli — tıklanabilir ama pasif). Bu belge o
> kilidi ne zaman/nasıl açacağımızı planlıyor. İlişki: `WORKER_PLAN.md` (Aşama 3 —
> `ladder:crawl` zaten Emerald+ `entries` sayfalarını taramayı planlıyor, bu belge
> onun leaderboard tarafını detaylandırıyor), `RIOT_PROD_KEY_BASVURU.md`.

## Kısa cevap (sorulan 3 soru)

- **Zor mu?** Hayır. Kod olarak yeni bir şey değil — mevcut `enrichPlayer()`,
  `RiotApiService::platformRequest()`, "client-side LP'ye göre sırala" mantığı
  (bkz. `LeaderboardController::index()`) zaten var; tek fark tek bir istekle gelen
  apex ligi yerine **çok sayfalı** bir uç noktayı gezmek. Zor olan taraf kod değil,
  **kapsamı doğru boyutlandırmak** (aşağıda).
- **Siteyi yavaşlatır mı?** Hayır — **AMA yalnız worker'a yazılırsa**. Sayfa
  taramasını hiçbir zaman kullanıcı isteği sırasında (senkron) yapmayacağız; apex
  dereceler bile 1 istek olsa da 30 dakikalık cache + oyuncu başına 24 saatlik
  zenginleştirme cache'i kullanıyor (`leaderboard:v6:*`, `player:enriched:v3:*`).
  Division'lar için tarama tamamen `ladder:crawl`-tarzı arka plan job'una taşınır,
  `/leaderboard` uç noktası yalnız DB'den okur — kullanıcı hiçbir zaman Riot'u
  canlı beklemez.
- **Çok mu istek atarız?** **Derece aşağı indikçe evet, ciddi biçimde artar** — bu
  yüzden aşamalı (Diamond→Iron) ve **worker'ın zaten ayrılmış bütçesi içinde**
  yapılmalı, ayrı bir istek havuzu açmadan. Aşağıdaki matematik ve "Önerilen
  uygulama" bölümü bunu nasıl kontrol altında tutacağımızı gösteriyor.

## Kapsam

Kullanıcı isteği iki parça:
1. **Division filtreleri** — Diamond/Emerald/Platinum/Gold/Silver/Bronze/Iron için
   I/II/III/IV alt filtresi (şu an yalnız derece var, division yok).
2. **Her derece+division'ın ilk ~50'si** (2026-07-31 netleşti — ilk fikir "ilk 3"tü,
   kullanıcı gerekçesini açıkladı: "gold 1 adam kendisini görmek istiyordur" — 3 kişilik
   podyum bunu sağlamıyor, sıradan bir Gold II oyuncusu top 3'te olma ihtimali yok.
   Top 50 bunu KISMEN çözer (daha geniş bir dilim, kendini bulma ihtimali artar) ama
   **HÂLÂ "kendimi bulma" özelliği değil** — bkz. aşağıdaki not.) Bu belge asıl bunu
   maliyetlendiriyor çünkü asıl zor kısım bu — division filtresi kendi başına
   (kullanıcı o division'ı seçtiğinde canlı sıralama göstermek) çok daha pahalı
   bir başka problem (aşağıda "Neden 'ilk 50' apex'ten çok daha pahalı" bölümü).

   **Önemli ayrım:** "İlk 50" bir Gold II oyuncusunun *o division'daki en iyileri*
   görmesini sağlar — kendi ismini bulmasını DEĞİL (division'da genelde binlerce
   oyuncu var, 50 bunun küçük bir dilimi). "Kendimi nerede görüyorum" tamamen ayrı
   bir özellik — profil sayfasında yüzdelik/sıralama (`PROFILE_RANKINGS_PLAN.md`,
   `ladder_buckets`) — ve bu belgenin kapsamı DIŞINDA, orada zaten planlı.

## Riot API mekaniği — apex ile neden aynı değil

| | Apex (Challenger/GM/Master) — **CANLIDA** | Diamond → Iron — **PLANLANMIŞ** |
|---|---|---|
| Endpoint | `.../{tier}leagues/by-queue/{queue}` | `.../entries/{queue}/{tier}/{division}` |
| İstek başına dönen | **Ligin tamamı** (TR1 Challenger ~200 kişi) | **Tek sayfa** (~205 kayıt, Riot dokümanına göre — uygulama anında doğrulanmalı) |
| Sıralı mı? | Hayır ama tek istekte hepsi elimizde → client-side `sortByDesc('leaguePoints')` yeterli | **Hayır ve sayfalar arası da sıralı değil** — division'ın gerçek ilk 3'ünü bulmak için o division'ın **her sayfasını** çekip elde tutmak gerekir |
| Toplam kişi sayısı | Sabit ve küçük (tanım gereği: en tepedeki ~200-1000 kişi) | **Alt derecelere inildikçe katlanarak büyür** (Iron/Bronze/Silver, oyuncu tabanının büyük çoğunluğu) |

Bu son iki satır asıl kısıtı oluşturuyor: Diamond'da "ilk N"i bulmak için belki
10-20 sayfa taramak yeterli, ama Iron'da (I-IV toplam) yüzlerce sayfa olabilir —
ve LP'ye göre sıralı olmadığı için **hepsini** görmeden "bu gerçekten ilk N" diyemeyiz
(47. sayfada 40 LP daha yüksek biri çıkabilir). **Önemli:** hedef sayı 3'ten 50'ye
çıkınca bu problem KÜÇÜLMÜYOR — sayfa başına ~205 kayıt olduğu için tek bir sayfa
bile 50'den fazla kayıt taşıyor, ama LP'ye göre sıralı olmadığından "ilk 50" için de
yine TÜM sayfaları gezip elde en yüksek 50 LP'yi tutmak gerekiyor (ilk 3 ile ilk 50
arasındaki fark yalnız hafızada tutulan liste boyutu — sayfa/istek sayısını
DEĞİŞTİRMİYOR).

## Neden "ilk 50" apex'ten çok daha pahalı

Örnek (gerçek TR1 dağılımını doğrulamadan, yalnız yöntemi göstermek için):

```
Diamond (4 division) ~20 sayfa/division  → ~80 istek  → 1 kez tarayınca ucuz
Emerald (4 division)  ~40 sayfa/division → ~160 istek → hâlâ makul
Platinum→Iron (5×4=20 division) division başına 100-400+ sayfa olabilir
  → tek geçişte binlerce istek
```

Yani "her derece+division'ın ilk 50'si" fikri **tek seferlik bir tarama değil,
sürekli tekrarlanması gereken** bir iş (LP sürekli değişiyor) — ve maliyeti
Diamond'dan Iron'a indikçe doğrusal değil, katlanarak artıyor. Bunu apex'le aynı
30 dakikalık döngüde yapmak prod key bütçesini tek başına tüketebilir.

**Ucuz alternatif (Platinum→Iron için, Faz C'de değerlendirilecek):** TAM/kesin
"ilk 50" yerine, division'ın yalnız İLK 1-2 sayfasından (~205-410 kayıt) çekilen ve
kendi içinde LP'ye sıralanan bir "örneklem 50"si gösterilebilir — dürüstçe "bu
division'dan bir kesit" olarak etiketlenir, "kesin ilk 50" iddiası taşımaz. Sayfa
sayısı sabit (division büyüklüğünden bağımsız) olduğu için maliyeti Iron'da da
Diamond'daki kadar ucuz kalır — trade-off kesinlik değil hız/maliyet.

## Siteyi yavaşlatır mı — mimari ayrım

Bugünkü apex akışı bile aslında "senkron değil" — `Cache::remember(1800s)` +
oyuncu zenginleştirmesi `Cache::remember(86400s)` sayesinde canlı ziyaretçi
neredeyse hiçbir zaman Riot'u beklemiyor, yalnız cache ısınırken 1 istek. Division
taraması için aynı disiplin ama bir kademe daha katı uygulanmalı:

- Tarama **yalnız worker'da** çalışır (`ladder:crawl`'a ek bir alt-komut ya da
  `WORKER_PLAN.md`'de zaten planlanan o komutun kendisi) — hiçbir HTTP isteği
  sayfa döngüsünü tetiklemez.
- Sonuç küçük bir tabloya yazılır (aşağıda), `/leaderboard` yalnız o tabloyu okur.
- `RiotApiService`'teki 429 cooldown + `WorkerControlService::shouldYield` (worker
  canlı trafik varken yol veriyor) mekanizması zaten var — division taraması bu
  mekanizmanın İÇİNDEN geçer, yeni bir istisna gerekmez.

Bu ayrım sağlandığı sürece kullanıcı tarafında **hiçbir yavaşlama olmaz** — risk
yalnız biri bunu yanlışlıkla controller içinde senkron çağırırsa oluşur (Bronze I
sayfasını açan kullanıcı 100+ sayfalık taramayı canlı beklerdi — YAPILMAYACAK).

## Önerilen uygulama (aşamalı)

### Faz A — Yalnız filtre iskeleti (bugün yapılabilir, 0 ekstra istek)
Frontend'deki kilit zaten hazır. Division alt-filtresi (I/II/III/IV pilleri,
`.tl-tier-chip` ile aynı bileşen — yeni tasarım dili açılmaz) tier seçilince
görünür ama **hepsi kilitli** kalır. Yalnız UI, veri yok.

### Faz B — Diamond + Emerald, "ilk 50" (prod key + WORKER_PLAN Aşama 3 sonrası)
`WORKER_PLAN.md`'nin zaten tasarladığı `ladder:crawl`'a (Emerald+ `entries`
taraması zaten planda var) küçük bir ek: sayfaları gezerken yalnız
`ladder_buckets` sayacını değil, o ana kadar görülen en yüksek LP'li 50 kaydı da
tutan bir çalışan liste (min-heap / sıralı dizi) besle. Tarama bitince:

```
division_leaders: region × queue × tier × division × rank(1-50)
                   → puuid, lp, wins, losses, updated_at
```

(7 derece × 4 division × 50 satır = en fazla 1.400 satır — Diamond/Emerald ile
sınırlıysa 2 derece × 4 division × 50 = 400 satır. Hâlâ CHAMPION_BUILD_PLAN.md'deki
"tüm tablolar compact aggregate" ilkesiyle uyumlu, DB'ye yük değil.) `/leaderboard`
non-apex bir tier+division için bu tabloyu okur ve ilk 3'ünü PODYUM, kalanını
(4-50) tıpkı bugünkü apex akışı gibi KOMPAKT TABLO olarak gösterir — sayfadaki
mevcut podyum+tablo ayrımı (bu oturumda tasarlandı) division'lar için de AYNEN
kullanılır, ayrı bir tasarım gerekmez. İsim/avatar/mastery için AYNI
`enrichPlayer()` çağrılır (puuid-keyed, zaten 24 saat cache'li — yeni kod değil,
ama artık yalnız top-10 değil top-50 için çalışacağı için oyuncu başına ~2-3 istek
× 50 = ilk taramada ~100-150 ek istek/division — bu da tek seferlik, sonrası cache'li).
Diamond+Emerald seçilince **gerçek**, geri kalanı hâlâ kilitli.

### Faz C — Platinum → Iron (yalnız istek bütçesi doğrulandıktan sonra)
Faz B'nin gerçek sayfa/istek sayıları elde olunca (varsayım değil, ölçülmüş veri)
karar: ya aynı yöntemle aşağı inilir (muhtemelen günlük yerine haftalık tazeleme —
alt derecede LP yarışı üst derece kadar hızlı değişmiyor), ya da yukarıdaki "ucuz
örneklem" alternatifine (yalnız ilk 1-2 sayfa, dürüstçe etiketli) geçilir. Bu karar
şimdiden verilmiyor — Faz B'nin gerçek maliyeti görülmeden erken optimizasyon olur.

## Önkoşullar
- Prod key onayı (`RIOT_PROD_KEY_BASVURU.md`, başvuru Pending).
- `ladder:crawl` komutunun scheduler'a bağlanması (`WORKER_PLAN.md` Aşama 3 —
  şu an kod iskeleti yazılı ama zamanlanmıyor).
- Faz B öncesi: gerçek TR1 division sayfa sayılarının bir kerelik ölçümü (yukarıdaki
  örnek tablo varsayım; gerçek sayı prod key gelince `ladder:crawl` ilk çalıştığında
  loglanmalı, Faz C kararı ona göre verilmeli).
