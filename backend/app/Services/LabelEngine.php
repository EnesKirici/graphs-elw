<?php

namespace App\Services;

use App\Models\AdminSetting;

/**
 * Etiket Motoru — bağlama göre (canlı maç / profil / maç geçmişi) oynayış etiketleri.
 *
 * KATALOG kodda tanımlı (her etiketin mantığı `check()`'te). Admin paneli `labels_config`
 * AdminSetting'iyle her etiketi: aç/kapa + renk(ton) + eşik(ler) + ad ile EZER. Böylece
 * kullanıcı tam kontrol eder ama karmaşık koşullu etiketler (Main'i Karşıda gibi) de mümkün.
 *
 * Kullanım: `app(LabelEngine::class)->evaluate('live', $data)` → [['key','text','tone','color'], ...]
 */
class LabelEngine
{
    /** Ton → varsayılan renk (admin özel hex ile ezebilir). */
    public const TONE_COLOR = [
        'good'    => '#34d399', // yeşil
        'bad'     => '#f87171', // kırmızı
        'info'    => '#60a5fa', // mavi
        'neutral' => '#94a3b8', // gri
    ];

    /**
     * Etiket KATALOĞU — bağlam => key => [name (şablon), tone, thresholds, desc].
     * {champ} şablonu check() döndürdüğü değerle değişir. Eşikler admin'den ayarlanır.
     */
    public const CATALOG = [
        'live' => [
            'otp'         => ['name' => 'OTP {champ}',        'tone' => 'info', 'thresholds' => ['share' => 70, 'minGames' => 4], 'desc' => 'Maçlarının çoğu bu şampiyon — Oran (%) eşiği ve üstü, en az Min maç. Sezon verisi (DB).'],
            'champLover'  => ['name' => '{champ} sevdalısı',  'tone' => 'info', 'thresholds' => ['games' => 50],          'desc' => 'Bu şampiyonu bu sezon ÇOK oynamış — eşik maç ve üstü. Sezon verisi (DB).'],
            'champNew'    => ['name' => "{champ}'da yeni",     'tone' => 'bad',  'thresholds' => ['games' => 2],           'desc' => 'Bu şampiyonda bu sezon az/hiç maç — eşik ve altı. Sezon verisi (DB).'],
            'goodChamp'   => ['name' => 'İyi {champ}',         'tone' => 'good', 'thresholds' => ['games' => 5, 'wr' => 58], 'desc' => 'Bu şampiyonda sezon WR yüksek — en az X maç + WR eşiği. (DB)'],
            'badChamp'    => ['name' => 'Kötü {champ}',        'tone' => 'bad',  'thresholds' => ['games' => 5, 'wr' => 42], 'desc' => 'Bu şampiyonda sezon WR düşük — en az X maç + WR eşiği altı. (DB)'],
            'highVision'  => ['name' => 'Yüksek görüş',        'tone' => 'good', 'thresholds' => ['perMin' => 1.4],       'desc' => 'Yüksek vizyon/dk — tüm roller (genel). Son maçlar.'],
            'lowVision'   => ['name' => 'Düşük görüş',         'tone' => 'bad',  'thresholds' => ['perMin' => 0.4],        'desc' => 'Düşük vizyon/dk — tüm roller (genel). Son maçlar.'],
            'mainInEnemy' => ['name' => "Main'i Karşıda",      'tone' => 'bad',  'thresholds' => [],                        'desc' => 'En çok oynadığı şampiyon düşman takımda.'],
            'winStreak'   => ['name' => 'Galibiyet Serisi',   'tone' => 'good', 'thresholds' => ['streak' => 3],          'desc' => 'Son maçlarda üst üste galibiyet — eşik ve üstü.'],
            'coldStreak'  => ['name' => 'Mağlubiyet Serisi',  'tone' => 'bad',  'thresholds' => ['streak' => 3],          'desc' => 'Son maçlarda üst üste mağlubiyet — eşik ve üstü.'],
            'badCs'       => ['name' => 'Zayıf Farmcı',       'tone' => 'bad',  'thresholds' => ['csPerMin' => 5.0],      'desc' => 'Düşük CS/dk — son maçlar (destek hariç).'],
            'goodCs'      => ['name' => 'İyi Farmcı',         'tone' => 'good', 'thresholds' => ['csPerMin' => 8.0],      'desc' => 'Yüksek CS/dk — son maçlar (destek hariç).'],
            'autofill'    => ['name' => 'Autofill',           'tone' => 'info', 'thresholds' => [],                        'desc' => 'Ana rolünde oynamıyor (rol tahmini).'],
            'feeder'      => ['name' => 'Feed Eğilimi',       'tone' => 'bad',  'thresholds' => ['deaths' => 8.0],        'desc' => 'Son maçlarda ortalama yüksek ölüm — eşik ve üstü.'],
            'aggressive'  => ['name' => 'Agresif',            'tone' => 'info', 'thresholds' => ['kills' => 8.0],         'desc' => 'Son maçlarda ortalama yüksek kill — eşik ve üstü.'],
            'inForm'      => ['name' => 'Formda',             'tone' => 'good', 'thresholds' => ['elw' => 7.0],           'desc' => 'Son maç ELW ortalaması yüksek — eşik ve üstü.'],
            'outOfForm'   => ['name' => 'Formsuz',            'tone' => 'bad',  'thresholds' => ['elw' => 4.0],           'desc' => 'Son maç ELW ortalaması düşük — eşik ve altı.'],
        ],
        // Profil + maç geçmişi katalogları ileride (maç rozetleri zaten BadgeService'te).
        'profile' => [],
        'match'   => [],
    ];

    /**
     * Verilen bağlam + veri için geçerli etiketleri döndür (admin config'iyle ezilmiş).
     * @return array<int,array{key:string,text:string,tone:string,color:string}>
     */
    public function evaluate(string $context, array $data): array
    {
        $catalog = self::CATALOG[$context] ?? [];
        $allConfig = AdminSetting::getValue('labels_config', []);
        $config = $allConfig[$context] ?? [];

        $out = [];
        foreach ($catalog as $key => $def) {
            $cfg = $config[$key] ?? [];
            if (($cfg['enabled'] ?? true) === false) {
                continue;
            }
            $thresholds = array_merge($def['thresholds'], $cfg['thresholds'] ?? []);
            $result = $this->check($key, $data, $thresholds);
            if ($result === false) {
                continue;
            }
            $name = $cfg['name'] ?? $def['name'];
            if (is_array($result)) {
                $name = strtr($name, $result); // {champ} → gerçek isim
            }
            $tone = $cfg['tone'] ?? $def['tone'];
            $out[] = [
                'key'   => $key,
                'text'  => $name,
                'tone'  => $tone,
                'color' => $cfg['color'] ?? self::TONE_COLOR[$tone] ?? '#94a3b8',
            ];
        }
        return $out;
    }

    /**
     * Tek etiketin koşulu. false = uygulanmaz; true/array = uygulanır (array → şablon değişkenleri).
     */
    private function check(string $key, array $d, array $th): bool|array
    {
        $champ = $d['liveChamp'] ?? null;
        $seasonGames = $d['liveChampSeasonGames'] ?? 0;  // bu sezon bu şampiyonda toplam (DB)
        $seasonWr    = $d['liveChampSeasonWr'] ?? 0;      // bu sezon bu şampiyonda WR (0-100)
        $champShare  = $d['liveChampShare'] ?? 0;         // tüm sezon maçlarının % kaçı bu şampiyon
        $vision      = $d['avgVisionPerMin'] ?? 0;        // son maçlar ortalama vizyon/dk
        $isSupport = ($d['role'] ?? '') === 'UTILITY';

        return match ($key) {
            // OTP: maçlarının çoğu (Oran %) bu şampiyon + en az Min maç (1/1=%100 yanılgısını önler).
            'otp'         => $champ && $champShare >= ($th['share'] ?? 70) && $seasonGames >= ($th['minGames'] ?? 4) ? ['{champ}' => $champ] : false,
            // Sevdalısı: bu şampiyonu bu sezon ÇOK oynamış (yüksek toplam).
            'champLover'  => $champ && $seasonGames >= ($th['games'] ?? 50) ? ['{champ}' => $champ] : false,
            // Yeni: bu şampiyonda bu sezon az/hiç maç.
            'champNew'    => $champ && $seasonGames <= ($th['games'] ?? 2) ? ['{champ}' => $champ] : false,
            'goodChamp'   => $champ && $seasonGames >= ($th['games'] ?? 5) && $seasonWr >= ($th['wr'] ?? 58) ? ['{champ}' => $champ] : false,
            'badChamp'    => $champ && $seasonGames >= ($th['games'] ?? 5) && $seasonWr <= ($th['wr'] ?? 42) ? ['{champ}' => $champ] : false,
            // Görüş etiketleri — GENEL (tüm roller). Vizyon verisi yoksa (0) etiket çıkmaz.
            'highVision'  => $vision >= ($th['perMin'] ?? 1.4),
            'lowVision'   => $vision > 0 && $vision < ($th['perMin'] ?? 0.4),
            'mainInEnemy' => !empty($d['mainChamp']) && in_array($d['mainChamp'], $d['enemyChamps'] ?? [], true) ? ['{champ}' => $d['mainChamp']] : false,
            'winStreak'   => ($d['streak'] ?? 0) >= ($th['streak'] ?? 3),
            'coldStreak'  => ($d['streak'] ?? 0) <= -($th['streak'] ?? 3),
            'badCs'       => !$isSupport && ($d['avgCsPerMin'] ?? 99) < ($th['csPerMin'] ?? 5.0),
            'goodCs'      => !$isSupport && ($d['avgCsPerMin'] ?? 0) >= ($th['csPerMin'] ?? 8.0),
            'autofill'    => (bool) ($d['autofilled'] ?? false),
            'feeder'      => ($d['avgDeaths'] ?? 0) >= ($th['deaths'] ?? 8.0),
            'aggressive'  => ($d['avgKills'] ?? 0) >= ($th['kills'] ?? 8.0),
            'inForm'      => ($d['elwAverage'] ?? 0) >= ($th['elw'] ?? 7.0),
            'outOfForm'   => ($d['elwAverage'] ?? null) !== null && $d['elwAverage'] < ($th['elw'] ?? 4.0),
            default       => false,
        };
    }
}
