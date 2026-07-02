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
];
