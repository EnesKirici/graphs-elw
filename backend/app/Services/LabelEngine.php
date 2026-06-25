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
            'otp'         => ['name' => 'OTP {champ}',        'tone' => 'info', 'thresholds' => ['games' => 4],            'desc' => 'Son maçların çoğu bu şampiyon'],
            'champLover'  => ['name' => '{champ} sevdalısı',  'tone' => 'info', 'thresholds' => ['games' => 2],            'desc' => 'Bu şampiyonu seviyor (2-3 maç)'],
            'champNew'    => ['name' => "{champ}'da yeni",     'tone' => 'bad',  'thresholds' => ['games' => 1],            'desc' => 'Bu şampiyonda az/hiç maç'],
            'goodChamp'   => ['name' => 'İyi {champ}',         'tone' => 'good', 'thresholds' => ['games' => 3, 'wr' => 60], 'desc' => 'Bu şampiyonda yüksek WR'],
            'badChamp'    => ['name' => 'Kötü {champ}',        'tone' => 'bad',  'thresholds' => ['games' => 3, 'wr' => 35], 'desc' => 'Bu şampiyonda düşük WR'],
            'mainInEnemy' => ['name' => "Main'i Karşıda",      'tone' => 'bad',  'thresholds' => [],                        'desc' => 'En çok oynadığı şampiyon düşman takımda'],
            'winStreak'   => ['name' => 'Galibiyet Serisi',   'tone' => 'good', 'thresholds' => ['streak' => 3],          'desc' => 'Üst üste galibiyet'],
            'coldStreak'  => ['name' => 'Mağlubiyet Serisi',  'tone' => 'bad',  'thresholds' => ['streak' => 3],          'desc' => 'Üst üste mağlubiyet'],
            'badCs'       => ['name' => 'Zayıf Farmcı',       'tone' => 'bad',  'thresholds' => ['csPerMin' => 5.0],      'desc' => 'Düşük CS/dk (destek hariç)'],
            'goodCs'      => ['name' => 'İyi Farmcı',         'tone' => 'good', 'thresholds' => ['csPerMin' => 8.0],      'desc' => 'Yüksek CS/dk (destek hariç)'],
            'autofill'    => ['name' => 'Autofill',           'tone' => 'info', 'thresholds' => [],                        'desc' => 'Ana rolünde değil'],
            'feeder'      => ['name' => 'Feed Eğilimi',       'tone' => 'bad',  'thresholds' => ['deaths' => 8.0],        'desc' => 'Son maçlarda yüksek ölüm'],
            'aggressive'  => ['name' => 'Agresif',            'tone' => 'info', 'thresholds' => ['kills' => 8.0],         'desc' => 'Son maçlarda yüksek kill'],
            'inForm'      => ['name' => 'Formda',             'tone' => 'good', 'thresholds' => ['elw' => 7.0],           'desc' => 'Son maç ELW ortalaması yüksek'],
            'outOfForm'   => ['name' => 'Formsuz',            'tone' => 'bad',  'thresholds' => ['elw' => 4.0],           'desc' => 'Son maç ELW ortalaması düşük'],
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
        $champGames = $d['liveChampGames'] ?? 0;
        $champWr = $d['liveChampWr'] ?? 0; // 0-100
        $isSupport = ($d['role'] ?? '') === 'UTILITY';

        return match ($key) {
            'otp'         => $champ && $champGames >= ($th['games'] ?? 4) ? ['{champ}' => $champ] : false,
            'champLover'  => $champ && $champGames >= ($th['games'] ?? 2) && $champGames < 4 ? ['{champ}' => $champ] : false,
            'champNew'    => $champ && $champGames <= ($th['games'] ?? 1) ? ['{champ}' => $champ] : false,
            'goodChamp'   => $champ && $champGames >= ($th['games'] ?? 3) && $champWr >= ($th['wr'] ?? 60) ? ['{champ}' => $champ] : false,
            'badChamp'    => $champ && $champGames >= ($th['games'] ?? 3) && $champWr <= ($th['wr'] ?? 35) ? ['{champ}' => $champ] : false,
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
