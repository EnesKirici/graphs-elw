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
            'S+' => 0.82,
            'S'  => 0.68,
            'A'  => 0.52,
            'B'  => 0.36,
            'C'  => 0.20,
            // altı → D
        ],

        // Örneklem güveni normalizasyonu: n bu değere ulaşınca güven = 1.0.
        'sample_full_confidence_at' => 200,

        // Bileşenleri 0–1'e çevirme çapaları.
        'normalize' => [
            'wr_min'   => 0.45, // Wilson WR bu oranda 0 puan
            'wr_max'   => 0.57, // bu oranda 1 puan
            'pick_max' => 20,   // pick% bu değerde 1 puan
            'ban_max'  => 40,   // ban% bu değerde 1 puan
        ],
    ],
];
