<?php

return [
    /*
    |--------------------------------------------------------------------------
    | İstatistik güvenilirliği (küçük örneklem dostu)
    |--------------------------------------------------------------------------
    | Ham win rate yerine Wilson alt güven sınırı kullanılır → az maçta gözlenen
    | yüksek WR dürüstçe aşağı çekilir (Singed 30 maç/%65 tepeyi işgal etmez).
    */
    'stats' => [
        'z'              => 1.96, // %95 güven (Wilson z-değeri)
        'min_games'      => 30,   // "güvenilir" sayılması için min maç; altı = düşük örneklem
        'prior_strength' => 100,  // shrinkage prior gücü: kaç maçlık %50 önsel (büyük=daha temkinli)
        // Patch değişimi (wrChange) hesaplanması için ÖNCEKİ patch'in toplam maç eşiği.
        // Altındaysa wrChange üretilmez (küçük örneklem yanıltıcı trend gösterir);
        // yeni patch gelince önceki pencere dolu olacağından bölüm otomatik devreye girer.
        'patch_change_min_prev_games' => 300,
    ],

    /*
    |--------------------------------------------------------------------------
    | Duo (ADC+Support sinerji) istatistikleri
    |--------------------------------------------------------------------------
    */
    'duo' => [
        'min_games' => 5, // bir ikili "gösterilebilir" sayılması için min birlikte maç
    ],

    /*
    |--------------------------------------------------------------------------
    | ELW maç skoru — role-relatif / ham etki karışımı (α)
    |--------------------------------------------------------------------------
    | roleAdjusted ham skoru rolün baseline'ına böler (role-relatif). baseline_blend (α)
    | bu böleni global ham ortalamaya doğru karıştırır:
    |   effectiveBaseline = (1-α)·roleBaseline + α·global_baseline
    | α=0 → tam role-relatif ("rolüne göre ne kadar iyi"); α=1 → tam ham etki ("maçta kim
    | daha çok iş yaptı", carry'ler öne çıkar). α=0.5 dengeli (DPM-uyumlu): koridoru
    | kaybeden ama yüksek hasar/KP'li ADC, az-ölen-ama-denk-koridor top'un üstüne çıkar;
    | destekler ezilmez. global_baseline = 1493 maçlık ölçümün frekans-ağırlıklı role ort.
    | (elw:calibrate-baselines ile yeniden ölçülür; ROLE_W değişince güncelle).
    */
    'elw_score' => [
        'baseline_blend'  => 0.5,
        'global_baseline' => 9.28, // 2026-06-30: #7 granül metrikler sonrası yeniden ölçüldü (156 maç)
        // MUTLAK mükemmellik referansı (perfect). blendedElw'in 'abs' bileşeni ÇAPALI lineer:
        // adj (roleAdjusted, 1.0=rol ortalaması) 1.0→abs 5, perfect_adj→abs 10. Yani gerçekten
        // dominant oynayan (adj≈perfect, hard-carry/Penta) lobiden bağımsız 10'a çıkabilir.
        // Ölçüm (500 maç): dominant maçların adj'si 1.15–1.54 (medyan 1.37) → perfect_adj=1.5.
        'perfect_adj'     => 1.5,
    ],

    /*
    |--------------------------------------------------------------------------
    | Maç kartı "takım kalitesi" etiketi (DPM tarzı — takım arkadaşlarının MUTLAK seviyesi)
    |--------------------------------------------------------------------------
    | diff = takım arkadaşlarımın (ben hariç) ortalama ELW − lobi ortalaması (10 oyuncu).
    | "Takım arkadaşlarım lobi seviyesinin üstünde mi/altında mı." Per-player (beni
    | çıkarınca her profil farklı): carry çıkınca takım ortalama görünür → "Ortalama";
    | zayıf oyuncu çıkınca carry'ler kalır → "İyi"; herkes kötüyse → "Kötü". DPM ile
    | aynı davranış. Yumuşak eşikler (carry-loss ≈ ortalama; ~12/20/36/20/12).
    */
    // NOT: skorlar 'individual' (cömert) modda — maç kartında gösterilenlerle aynı.
    'team_quality' => [
        'great'    => 1.9,  // diff >= → "Çok iyi takım" (takım arkadaşların lobi üstü, net)
        'good'     => 0.7,  // diff >= → "İyi takım"
        'bad'      => -0.7, // diff <= → "Kötü takım" (takım arkadaşların lobi altı)
        'terrible' => -1.7, // diff <= → "Çok kötü takım" (2026-07: -1.9→-1.7 gevşetildi)
        // MUTLAK taban: relatif diff lobiyle sınırlı olduğundan (lobi kendi kötü takımımı da
        // içerir) 0/10-1/10 hard-inter'li takım -1.9'a ulaşamayabilir. Takım arkadaşlarının
        // MUTLAK ortalaması bunun altındaysa → relatiften bağımsız "Çok kötü takım".
        'terrible_abs' => 3.8,
        // ikisinin arası → "Ortalama takım"
    ],

    /*
    |--------------------------------------------------------------------------
    | Kompozit tier skoru
    |--------------------------------------------------------------------------
    | Tier yalnız WR ile değil; Wilson WR + pick + ban + örneklem güveni'nin
    | 0–1 normalize edilip ağırlıklı toplamından üretilir. Ağırlıklar buradan.
    */
    'tier' => [
        'weights' => [
            'wilson_wr' => 0.55, // ana ağırlık
            'pick_rate' => 0.20,
            'ban_rate'  => 0.10,
            'sample'    => 0.15, // örneklem güveni (n büyüdükçe artar)
        ],

        // Kompozit skor (0–1) → tier. Skor >= sınır olan ilk tier atanır.
        //
        // S+ = 0.64 (2026-07-30 kalibrasyonu): 0.70 mevcut örneklemde ULAŞILAMAZ bir
        // sınırdı (pick_max=20 iken en yüksek gerçek skor ~0.66) → "Tümü" listesinde
        // S+ hiç çıkmıyor, tier list'in tepesi 13 şampiyonluk tek S bloğu oluyordu.
        // 0.64 ile: Tümü → 3 S+ / 10 S, roller → 0–3 S+. Yani S+ "yamanın gerçekten
        // ayrışan birkaç şampiyonu" oluyor. Örneklem büyüyünce (prod key + crawler)
        // skorlar yukarı kayacağı için bu sınır tekrar gözden geçirilmeli.
        'thresholds' => [
            'S+' => 0.64,
            'S'  => 0.60,
            'A'  => 0.50,
            'B'  => 0.36,
            'C'  => 0.20,
            // altı → D
        ],

        // Örneklem güveni normalizasyonu: n bu değere ulaşınca güven = 1.0.
        // Mevcut örneklem küçük (çoğu <200) → 80'de tam güven (yoksa skorlar bastırılır,
        // S+ hiç çıkmaz). Production key + crawler ile örneklem büyüyünce yükseltilebilir.
        'sample_full_confidence_at' => 80,

        // Bileşenleri 0–1'e çevirme çapaları.
        'normalize' => [
            'wr_min'   => 0.45, // Wilson WR bu oranda 0 puan
            'wr_max'   => 0.57, // bu oranda 1 puan
            'pick_max' => 20,   // pick% bu değerde 1 puan
            'ban_max'  => 40,   // ban% bu değerde 1 puan
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Meta patch penceresi (istatistik kapsamı + eski maç prune'u)
    |--------------------------------------------------------------------------
    | Meta istatistikleri GÜNCEL patch'e göre hesaplanır. gameVersion'ı olan maçlar
    | doğrudan ondan; gameVersion'ı OLMAYAN eski maçlar (bir dönem kayıtta trim'lendi)
    | patch başlangıç tarihinden patch'e atanır (PatchService). Böylece 6 aylık veri
    | tek patch'e yığılmaz, gerçek patch'e oturur. Aynı tarih prune eşiğidir.
    |
    | ELLE BAKIM GEREKMEZ: başlangıç tarihi artık VERİDEN gözlemleniyor —
    | stats:rebuild her turda patch başına en eski maçı `stat_patches.first_game_at`e
    | yazar, PatchService onu aşağıdaki listenin ÜSTÜNE koyar. Yani bölge (TR) yamayı
    | ne zaman alırsa başlangıç oraya oturur; ddragon sürümünün oyun yamasından ÖNCE
    | düşmesi (16.15.1 assets 28 Tem, oyun 29 Tem) artık tarihi kaydırmaz.
    |
    | Aşağıdaki liste yalnızca TOHUM/YEDEK: henüz hiç maç toplanmamış patch'ler ve
    | gözlemlenen veriden önceki tarihsel patch'ler için. Yeni yamada satır eklemek
    | zorunlu değil — istersen ekleyebilirsin, ilk maç gelince veri onu ezer.
    | NOT: DataDragon major 16 = 2026 (14=2024,15=2025,16=2026). LoL'ün resmi yama
    | notları yıl-bazlı "26.x" der ama minor aynıdır: 16.13 = 26.13.
    */
    'meta' => [
        'patch_starts' => [
            '16.15' => '2026-07-29', // TR bakımı 29 Tem 05:00 +03 (~4 sa)
            '16.14' => '2026-07-14',
            '16.13' => '2026-06-23',
            '16.12' => '2026-06-09',
            '16.11' => '2026-05-27',
        ],
        // Meta + prune kaç patch tutsun (güncel dahil). 2 = güncel + önceki.
        'keep_patches' => 2,
    ],

    /*
    |--------------------------------------------------------------------------
    | Meta worker (ladder tarama + maç toplama) — Personal key bütçesi
    |--------------------------------------------------------------------------
    | Aç/kapa + hangi ligler + başlangıç tarihi RUNTIME ayarıdır (admin_settings:
    | worker_enabled / worker_tiers / worker_collect_since — panelden yönetilir).
    | Buradakiler SABİT bütçe sınırları: Personal key ~100 istek/2dk ve site
    | trafiğiyle paylaşıldığı için worker her turda küçük ısırıklar alır.
    */
    'worker' => [
        // Seçilebilir ligler (admin panel bu listeden çoklu seçim yaptırır).
        'tiers_available' => ['EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'],
        // Emerald/Diamond League-V4 entries: division başına çekilecek sayfa (1 sayfa ≈ 205 oyuncu, 1 istek).
        // 8 = division başına ~1640 aktif oyuncu → havuz apex'e daha az kayar, meta Emerald/Diamond'ı
        // daha iyi temsil eder. Crawl günlük (8×4×2=64 istek). DİKKAT: "tümünü çek" YAPMA —
        // dev key'le on binlerce oyuncu = crawl kotayı boğar + worker (15/tur) aylarca tarayamaz.
        // Tüm ladder ancak prod key gelince mantıklı (bütçe + tarama hızı yeter).
        'entry_pages_per_division' => 8,
        // matches:collect turu başına kuyruğa atılacak maksimum YENİ maç (≈ maç-detay isteği bütçesi).
        'match_budget' => 40,
        // Oyuncu başına en yeni kaç ranked maç ID'si istensin (count parametresi).
        'recent_per_player' => 10,
        // Son N saniyede kullanıcı kaynaklı Riot isteği olduysa worker o turu bırakır (kullanıcı önceliği).
        'user_yield_seconds' => 8,
    ],

    /*
    |--------------------------------------------------------------------------
    | Kule plakası (turret plate) — rol-bazlı normalizasyon
    |--------------------------------------------------------------------------
    | Plaka YALNIZ 3 dış kulede (top/mid/bot outer) ve maçın ilk 14 dakikasında var;
    | her dış kulede 5 plaka → bir takım rakipten en fazla 15 plaka alabilir. İç/nexus
    | kulelerinde plaka yoktur. Bir oyuncunun aldığı plaka rolüne çok bağlıdır (solo
    | laner çok, jungle/support az), bu yüzden "Performans Metrikleri" kartındaki Plaka
    | barını sabit bir max yerine ROLE göre normalize ederiz: oyuncunun sezon ortalama
    | turretPlatesTaken değeri, ana rolünün 'expected' hedefine ulaşınca bar dolu (%100).
    | Böylece top laner'ın 4 plakası ile jungle'ın 1 plakası kendi bağlamında okunur.
    |
    | Değerler ayarlanabilir hedeflerdir (rolün iyi bir oyuncu için tipik üst bandı).
    | Şu an küçük örneklem (~6 hesap) nedeniyle sabit; production key + geniş veri
    | sonrası DB-dinamik rol ortalamasına geçilebilir.
    */
    'plate' => [
        'expected_by_role' => [
            'TOP'     => 5.0,
            'MIDDLE'  => 3.5,
            'BOTTOM'  => 3.5,
            'JUNGLE'  => 1.5,
            'UTILITY' => 1.5,
        ],
        'expected_default' => 3.0, // ana rol belirlenemezse
    ],

    /*
    |--------------------------------------------------------------------------
    | API hız limiti (throttle) — IP başına
    |--------------------------------------------------------------------------
    | Aynı IP'den gelen istek seli (scraper/yanlış yazılmış script) siteyi ve
    | Riot bütçesini tüketmesin. Limitler IP başınadır; ofis/CGNAT gibi paylaşımlı
    | IP'lerde birden çok gerçek kullanıcı aynı kovayı paylaşır — bu yüzden tek
    | kullanıcının ihtiyacının epey üstünde tutulur. trusted_ips (sunucunun kendisi:
    | Next.js SSR + worker iç istekleri) limitten muaftır.
    */
    'api_throttle' => [
        'per_second'  => 10,
        'per_minute'  => 180,
        // DİKKAT: SSR isteği Cloudflare'e çıkıp origin'e geri döner ve nginx'te
        // gerçek-IP restorasyonu açık olduğu için istemci, sunucunun KENDİ dış IP'si
        // olarak görünür — 127.0.0.1 eşleşmesi yetmez, IPv6'yı da yazmak şart.
        // 28 Tem 2026: bu liste ölü Plesk IP'sinde kalmıştı → SSR bir günde 1334 kez
        // 429 yedi (en çok /summoner/search, /live/search) ve arama sayfaları
        // sebepsiz "yüklenemedi" verdi. Sunucu/IP değişiminde deploy beklememek için
        // env'den ekleme yapılabilir: TRUSTED_API_IPS=1.2.3.4,2a02::1
        'trusted_ips' => array_values(array_filter(array_map('trim', array_merge(
            ['127.0.0.1', '::1', '169.58.64.20', '2a02:c207:2346:712::1'],
            explode(',', (string) env('TRUSTED_API_IPS', ''))
        )))),
    ],
];
