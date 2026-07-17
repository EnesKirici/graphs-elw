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
        'thresholds' => [
            'S+' => 0.70,
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
    | aşağıdaki patch başlangıç tarihlerinden patch'e atanır (PatchService). Böylece
    | 6 aylık veri tek patch'e yığılmaz, gerçek patch'e oturur.
    |
    | Yeni patch çıkınca en ÜSTE 1 satır ekle (~2 haftada bir; resmi yama notu günü).
    | NOT: DataDragon major 16 = 2026 (14=2024,15=2025,16=2026). LoL'ün resmi yama
    | notları yıl-bazlı "26.x" der ama minor aynıdır: 16.13 = 26.13.
    */
    'meta' => [
        'patch_starts' => [
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
        'entry_pages_per_division' => 1,
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
];
