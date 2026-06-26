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
        'terrible' => -1.9, // diff <= → "Çok kötü takım"
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
];
