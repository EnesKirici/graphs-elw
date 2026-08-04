<?php

namespace App\Services;

use App\Models\CachedPlayer;
use App\Models\ChampionBuild;
use App\Models\ChampionMatchup;
use App\Models\ChampionStat;
use App\Models\ChampionTopPlayer;
use App\Models\StatPatch;
use App\Services\RiotApi\DataDragonService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Şampiyon build sayfası GERÇEK verisi — worker'ın maç maç biriktirdiği
 * champion_builds (keystone / rune_minor / shard / spell_pair / item_full) ve
 * champion_top_players sayaçlarından okunur. Patch penceresi (güncel + önceki)
 * birleşik sayılır ki küçük örneklemde sayfa boş kalmasın.
 *
 * Frontend sözleşmesi: positions yalnız GERÇEKTEN oynanan koridorları içerir
 * (games + pay eşiği) → oynanmayan rol sekmesi hiç görünmez (ör. Locke Support).
 */
class ChampionBuildService
{
    /** Rol sekmesi için eşikler: en az bu kadar maç VE toplam içinde bu pay. */
    private const POS_MIN_GAMES = 10;
    private const POS_MIN_SHARE = 0.05;

    /** Kategori başına döndürülecek satır sayısı. */
    private const TOP_N = [
        'keystone'     => 3,   // ana sayfa + 2./3. seçenek
        'rune_minor'   => 30,  // ağaçtaki TÜM oynanmış rünler %'siyle gösterilir (fallback)
        'rune_minor_k' => 120, // keystone-koşullu minörler ("KEYSTONE:PERK") — asıl kaynak
        'shard'        => 9,   // fallback
        'shard_k'      => 36,  // keystone-koşullu shard'lar
        'spell_pair'   => 2,
        'item_full'    => 15,
        'skill_order'  => 3,   // "Q>E>W" max önceliği
        'starter'      => 4,   // başlangıç kombinasyonları ("1055-2003")
        'item_slot1'   => 8,   // satın alma sırasına göre N. bitmiş eşya alternatifleri
        'item_slot2'   => 8,
        'item_slot3'   => 8,
        'item_slot4'   => 8,
        'item_slot5'   => 8,
    ];

    public function __construct(
        private PatchService $patch,
        private DataDragonService $ddragon,
        private MetaService $meta,
    ) {}

    public function getChampionBuild(string $championId): array
    {
        $patches = $this->patch->keptPatches();
        // v8: trend serisi koridor bazlı (rol seçimiyle birlikte değişir).
        $key = 'champion:build:v8:' . $championId . ':' . implode(',', $patches);

        // TTL 10dk DEĞİL 2sa: bu veriyi besleyen stats:rebuild günde 3 kez koşuyor,
        // yani 10 dakikalık tazelik hiçbir zaman yeni bilgi getirmiyordu — sadece her
        // 10 dakikada bir "şanssız" ziyaretçiye hesaplama faturasını çıkarıyordu.
        // Patch değişince cache anahtarı zaten değişir (bayat veri riski yok).
        return Cache::remember($key, 7200, function () use ($championId, $patches) {
            return $this->compute($championId, $patches);
        });
    }

    /**
     * SEO counter sayfası verisi (/champions/{id}/counter): oynanan her koridor için
     * TAM matchup listesi — counters (şampiyonu yenenler, bizim WR en düşük) ve
     * strongInto (şampiyonun ezdiği, bizim WR en yüksek). Build sayfasındaki 5+5
     * özetten farkı: tüm rakipleri (rakip başına min maç) verir → zengin SEO içeriği.
     */
    public function getChampionCounters(string $championId): array
    {
        $patches = $this->patch->keptPatches();
        // v4: bot lane çapraz eşleşmeleri (crossCounters/crossStrong) eklendi.
        $key = 'champion:counters:v4:' . $championId . ':' . implode(',', $patches);

        // TTL için gerekçe: yukarıdaki getChampionBuild ile aynı (stats:rebuild günde 3).
        // Counter hesabı daha ağır (pozisyon başına aynı-koridor + çapraz eşleşme).
        return Cache::remember($key, 7200, function () use ($championId, $patches) {
            $statRows = ChampionStat::where('champion_id', $championId)
                ->whereIn('patch', $patches)->where('position', '!=', 'ALL')->get();
            $totalGames = (int) ChampionStat::where('champion_id', $championId)
                ->whereIn('patch', $patches)->where('position', 'ALL')->sum('games');

            // Oynanan koridorlar (build ile aynı eşik) — WR delta'nın temeli.
            $positions = [];
            foreach ($statRows->groupBy('position') as $pos => $rows) {
                $g = (int) $rows->sum('games');
                $w = (int) $rows->sum('wins');
                $positions[] = [
                    'position' => $pos,
                    'games'    => $g,
                    'winRate'  => $g > 0 ? round($w / $g * 100, 1) : 0.0,
                    'share'    => $totalGames > 0 ? round($g / $totalGames * 100, 1) : 0.0,
                ];
            }
            usort($positions, fn ($a, $b) => $b['games'] <=> $a['games']);
            $shown = array_values(array_filter($positions, fn ($p) =>
                $p['games'] >= self::POS_MIN_GAMES && $p['share'] >= self::POS_MIN_SHARE * 100
            ));
            if (! $shown && $positions) {
                $shown = [$positions[0]];
            }

            // Bot lane 2v2: ADC'nin karşısında sadece rakip ADC değil, rakip SUPPORT da var.
            $crossOf = ['BOTTOM' => 'UTILITY', 'UTILITY' => 'BOTTOM'];

            $byPosition = [];
            foreach ($shown as $p) {
                $mu = $this->aggregateMatchups($championId, $patches, $p['position'], (float) $p['winRate']); // delta DESC
                // İşarete göre AYIR (bir eşleşme tek sütunda): counter = bizim WR düşük (delta<0),
                // strongInto = bizim WR yüksek (delta>0). Nötr (delta=0) hiçbirine girmez.
                $strong = array_values(array_filter($mu, fn ($m) => $m['delta'] > 0));                // delta DESC
                $weak = array_values(array_filter(array_reverse($mu), fn ($m) => $m['delta'] < 0));   // delta ASC
                $entry = [
                    'winRate'    => $p['winRate'],
                    'games'      => $p['games'],
                    'opponents'  => count($mu),
                    'counters'   => $weak,   // şampiyonu yenenler (en zorlu önce)
                    'strongInto' => $strong, // şampiyonun ezdiği (en ezici önce)
                ];

                // Çapraz koridor (yalnız alt koridor): ADC için karşı SUPPORT'lar,
                // SUPPORT için karşı ADC'ler. Veri yoksa alan hiç eklenmez.
                if ($cp = $crossOf[$p['position']] ?? null) {
                    $cm = $this->aggregateMatchups($championId, $patches, $p['position'], (float) $p['winRate'], $cp);
                    if ($cm) {
                        $entry['crossPosition'] = $cp;
                        $entry['crossStrong'] = array_values(array_filter($cm, fn ($m) => $m['delta'] > 0));
                        $entry['crossCounters'] = array_values(array_filter(array_reverse($cm), fn ($m) => $m['delta'] < 0));
                    }
                }

                $byPosition[$p['position']] = $entry;
            }

            return [
                'patches'         => $patches,
                'positions'       => $shown,
                'primaryPosition' => $shown[0]['position'] ?? null,
                'byPosition'      => $byPosition,
            ];
        });
    }

    private function compute(string $championId, array $patches): array
    {
        // Pozisyon dağılımı champion_stats'tan (build satırlarından daha güvenilir payda).
        $statRows = ChampionStat::where('champion_id', $championId)
            ->whereIn('patch', $patches)->get();

        // Genel toplamlar (payda = patch penceresindeki toplam maç). Bir şampiyon bir
        // maçta en fazla 1 kez seçilebilir → pick = games / totalMatches; ban rol-bağımsız.
        $totalGames   = (int) $statRows->where('position', 'ALL')->sum('games');
        $totalMatches = (int) StatPatch::whereIn('patch', $patches)->sum('total_games');
        $allWins      = (int) $statRows->where('position', 'ALL')->sum('wins');
        $allBans      = (int) $statRows->where('position', 'ALL')->sum('bans');
        $banRate      = $totalMatches > 0 ? round($allBans / $totalMatches * 100, 1) : 0.0;

        // Üst özet barı: rol-içi sıra + derece (tier-list ile aynı skorlama).
        $rankings = $this->meta->roleRankings();

        $positions = [];
        foreach ($statRows->where('position', '!=', 'ALL')->groupBy('position') as $pos => $rows) {
            $g = (int) $rows->sum('games');
            $w = (int) $rows->sum('wins');
            $rk = $rankings[$pos][$championId] ?? null;
            $positions[] = [
                'position' => $pos,
                'games'    => $g,
                'wins'     => $w,
                'winRate'  => $g > 0 ? round($w / $g * 100, 1) : 0.0,
                'share'    => $totalGames > 0 ? round($g / $totalGames * 100, 1) : 0.0,
                'pickRate' => $totalMatches > 0 ? round($g / $totalMatches * 100, 1) : 0.0,
                'banRate'  => $banRate, // şampiyon düzeyinde, tüm koridorlarda aynı
                'rank'     => $rk['rank'] ?? null,
                'total'    => $rk['total'] ?? null,
                'grade'    => $rk['grade'] ?? null,
            ];
        }
        usort($positions, fn ($a, $b) => $b['games'] <=> $a['games']);

        // Oynanmayan koridorlar gizlenir; hiçbiri eşiği geçemezse (çok az veri)
        // en çok oynanan tek koridor yine gösterilir ki sayfa boş kalmasın.
        $shown = array_values(array_filter($positions, fn ($p) =>
            $p['games'] >= self::POS_MIN_GAMES && $p['share'] >= self::POS_MIN_SHARE * 100
        ));
        if (! $shown && $positions) {
            $shown = [$positions[0]];
        }

        $overview = [
            'games'    => $totalGames,
            'winRate'  => $totalGames > 0 ? round($allWins / $totalGames * 100, 1) : 0.0,
            'pickRate' => $totalMatches > 0 ? round($totalGames / $totalMatches * 100, 1) : 0.0,
            'banRate'  => $banRate,
        ];

        // Bitmiş eşya kontrolü (Duruma Göre'de bileşen/iksir görünmesin diye):
        // bileşeni olan ('into' dolu) ya da tek parça (depth<2) itemler bitmiş sayılmaz.
        $itemMap = [];
        try {
            $itemMap = $this->ddragon->getItems();
        } catch (\Throwable) {
            // DDragon erişilemezse işaretsiz bırak — frontend hepsini bitmiş varsayar.
        }

        // Build sayaçları: patch penceresi birleşik, pozisyon × kategori × anahtar.
        $buildRows = ChampionBuild::where('champion_id', $championId)
            ->whereIn('patch', $patches)->get();

        // 30 günlük seriler: 'ALL' + oynanan her koridor (tek sorgu).
        $trends = $this->dailyTrends($championId);

        $byPosition = [];
        foreach ($shown as $p) {
            $pos = $p['position'];
            $rows = $buildRows->where('position', $pos);

            $cats = [];
            $samples = [];
            foreach (self::TOP_N as $category => $limit) {
                $agg = [];
                foreach ($rows->where('category', $category) as $r) {
                    $agg[$r->item_key] ??= ['games' => 0, 'wins' => 0];
                    $agg[$r->item_key]['games'] += (int) $r->games;
                    $agg[$r->item_key]['wins']  += (int) $r->wins;
                }
                $list = [];
                foreach ($agg as $k => $v) {
                    $row = [
                        'key'     => (string) $k,
                        'games'   => $v['games'],
                        'wins'    => $v['wins'],
                        'winRate' => $v['games'] > 0 ? round($v['wins'] / $v['games'] * 100, 1) : 0.0,
                        'pickRate' => $p['games'] > 0 ? round($v['games'] / $p['games'] * 100, 1) : 0.0,
                    ];
                    if ($category === 'item_full' && $itemMap) {
                        $it = $itemMap[(string) $k] ?? null;
                        $depth = (int) ($it['depth'] ?? 1);
                        $row['completed'] = $it !== null && empty($it['into']) && $depth >= 2;
                        // SAF BİLEŞEN (Uzun Kılıç, B.F. Kılıcı, Doran…) listeye hiç girmesin.
                        // Liste 15 satırla sınırlı; bileşenler yarısını kaplayınca ADC'lerde
                        // çizmeler dışarıda kalıyor ve "Çizme Tercihleri" boş görünüyordu
                        // (Samira'da tam olarak bu oluyordu). depth>=2 olan temel çizme
                        // (Savaşçı Çizmeleri gibi) elenmez — o gerçek bir tercihtir.
                        if ($it !== null && $depth < 2) {
                            continue;
                        }
                    }
                    $list[] = $row;
                }
                usort($list, fn ($a, $b) => $b['games'] <=> $a['games']);

                // Timeline kategorilerinde payda TÜM maçlar değil, timeline'ı işlenmiş
                // örneklemdir (backfill sürerken %0.3 gibi anlamsız değerler çıkmasın;
                // alternatiflerin toplamı ~%100'e oturur — dpm/op.gg mantığı).
                if (str_starts_with($category, 'item_slot') || in_array($category, ['skill_order', 'starter'], true)) {
                    $catTotal = array_sum(array_column($list, 'games'));
                    if ($catTotal > 0) {
                        foreach ($list as &$row) {
                            $row['pickRate'] = round($row['games'] / $catTotal * 100, 1);
                        }
                        unset($row);
                    }
                    $samples[$category] = $catTotal;
                }

                $cats[$category] = array_slice($list, 0, $limit);
            }

            // Frontend bu örneklem sayısıyla bölümü gösterip göstermeyeceğine karar verir
            // (düşük örneklemde "toplanıyor" mesajı) — anahtarlar kategori adlarıdır.
            $cats['_samples'] = $samples;

            // Rakip matchup'lar: iyi karşı (en yüksek sapma) / zayıf karşı (en düşük).
            // Sapma = o rakibe karşı WR − şampiyonun bu roldeki genel WR'si.
            $cats['matchups'] = $this->matchupsFor($championId, $patches, $pos, (float) $p['winRate']);

            // Seçili koridorun kendi 30 günlük serisi (yoksa anahtar hiç konmaz →
            // frontend "bu rolde trend için yeterli maç yok" der, ALL'a düşmez:
            // rol seçiliyken tüm rollerin ortalamasını göstermek yanlış olurdu).
            if (isset($trends[$pos])) {
                $cats['trend'] = $trends[$pos];
            }

            $byPosition[$pos] = $cats;
        }

        return [
            'patches'    => $patches,
            'totalGames' => $totalGames,
            'overview'   => $overview,
            'positions'  => $shown,
            'byPosition' => $byPosition,
            'spellMap'   => $this->spellMapForPairs($byPosition),
            'topPlayers' => $this->topPlayers($championId),
            'trend'      => $trends['ALL'] ?? [],
        ];
    }

    /**
     * Son N günün serisi: kazanma / seçim / yasaklanma oranı.
     *
     * Kaynak champion_daily_stats (sayaç tablosu) — ham maç taraması YOK, sorgu
     * yalnız ~30 satır okur.
     *
     * NEDEN KAYAN PENCERE: tek günün ham oranı az oynanan şampiyonda anlamsız.
     * Akshan (seçim oranı %1.2) bir günde 9 maç oynanıp 7'sini kazanınca grafik
     * "%77.8 kazanma, +33 puan" diyordu — oysa şampiyonun gerçek oranı %46.9.
     * Bu bir trend değil, zar atışıydı. Artık her nokta SON 3 GÜNÜN TOPLAMINDAN
     * hesaplanır (oranların ortalaması değil, toplamların oranı — böylece az maçlı
     * gün pencerede kendiliğinden az ağırlık alır).
     *
     * Gün ekseni stat_days'ten kurulur, şampiyon satırından değil: şampiyonun hiç
     * oynanmadığı bir gün pencereden düşerse seçim oranı yapay olarak yükselirdi.
     *
     * KORİDOR BAŞINA seri döner ('ALL' + oynanan her pozisyon). Tek seri yeterli
     * değildi: kullanıcı rolü değiştirince üstteki şerit MIDDLE'a göre "%46.8"
     * derken grafik tüm rollerin toplamıyla "%44.9" diyordu — aynı kartta iki
     * farklı kazanma oranı. Ban oranı ROLDEN BAĞIMSIZ (yasaklama seçim ekranında,
     * rol belli değilken yapılır) → her seride 'ALL' satırından gelir.
     *
     * @return array<string, array<array{day:string, games:int, winRate:float, pickRate:float, banRate:float}>>
     */
    private function dailyTrends(string $championId, int $days = 30): array
    {
        $since = now()->subDays($days)->toDateString();

        // Worker'ın az çalıştığı günler paydayı bozar → gün ekseninden tamamen çıkar.
        $totals = DB::table('stat_days')
            ->where('day', '>=', $since)
            ->where('matches', '>=', self::TREND_MIN_DAY_MATCHES)
            ->orderBy('day')
            ->pluck('matches', 'day');

        if ($totals->isEmpty()) {
            return [];
        }

        // Tek sorgu, tüm pozisyonlar (pozisyon başına ayrı sorgu atmaya değmez).
        $rows = DB::table('champion_daily_stats')
            ->where('champion_id', $championId)
            ->where('day', '>=', $since)
            ->get(['day', 'position', 'games', 'wins', 'bans']);

        $byPos = [];
        $bans = [];
        foreach ($rows as $r) {
            $day = (string) $r->day;
            $byPos[(string) $r->position][$day] = $r;
            if ($r->position === 'ALL') {
                $bans[$day] = (int) $r->bans;
            }
        }

        $out = [];
        foreach ($byPos as $pos => $days_) {
            $series = $this->trendSeries($totals, $days_, $bans);
            if (count($series) >= 3) {
                $out[$pos] = $series;
            }
        }

        return $out;
    }

    /** Bir pozisyonun günlük satırlarını kayan pencereyle seriye çevirir. */
    private function trendSeries($totals, array $daysRows, array $bans): array
    {
        $series = [];
        foreach ($totals as $day => $total) {
            $r = $daysRows[(string) $day] ?? null;
            $series[] = [
                'day'   => (string) $day,
                'total' => (int) $total,
                'games' => $r ? (int) $r->games : 0,
                'wins'  => $r ? (int) $r->wins : 0,
                'bans'  => $bans[(string) $day] ?? 0,
            ];
        }

        $out = [];
        $n = count($series);
        for ($i = self::TREND_WINDOW - 1; $i < $n; $i++) {
            $g = $w = $b = $t = 0;
            for ($j = $i - (self::TREND_WINDOW - 1); $j <= $i; $j++) {
                $g += $series[$j]['games'];
                $w += $series[$j]['wins'];
                $b += $series[$j]['bans'];
                $t += $series[$j]['total'];
            }
            if ($t <= 0 || $g < self::TREND_MIN_WINDOW_GAMES) {
                continue; // pencerede bile yeterli maç yok → oran hâlâ gürültü
            }
            $out[] = [
                'day'      => $series[$i]['day'],
                'games'    => $g,
                'winRate'  => round($w / $g * 100, 1),
                'pickRate' => round($g / $t * 100, 1),
                'banRate'  => round($b / $t * 100, 1),
            ];
        }

        return $out;
    }

    /**
     * Trend serisinde bir günün eksene girmesi için o gün işlenmiş olması gereken
     * en az maç sayısı. Worker'ın az çalıştığı bir günde 20 maçtan çıkan
     * "%80 seçim oranı" gerçek bir sıçrama değil, örneklem gürültüsüdür.
     */
    private const TREND_MIN_DAY_MATCHES = 100;
    /** Kayan pencere genişliği (gün) — tek günün zar atışını yumuşatır. */
    private const TREND_WINDOW = 3;
    /** Pencerede bu kadar şampiyon maçı yoksa nokta hiç çizilmez. */
    private const TREND_MIN_WINDOW_GAMES = 20;

    /** Rakip başına en az bu kadar maç yoksa matchup listeye girmez (gürültü). */
    private const MATCHUP_MIN_GAMES = 10;
    /** Matchup sıralaması güven sabiti: sapmayı games/(games+K) ile ağırlıklar
     *  (az maçlı büyük sapmayı nötre çeker → istatistiksel olarak doğru sıra). */
    private const MATCHUP_CONF_K = 40;

    /**
     * Pozisyon için matchup listeleri: good (en yüksek sapma) / bad (en düşük).
     * Build sayfası özeti (5+5); tam liste için getChampionCounters kullanır.
     * @return array{good: array, bad: array, opponents: int}
     */
    private function matchupsFor(string $championId, array $patches, string $pos, float $posWinRate): array
    {
        $mu = $this->aggregateMatchups($championId, $patches, $pos, $posWinRate); // delta DESC

        $good = array_slice($mu, 0, 5);
        $goodIds = array_column($good, 'id');
        $bad = array_values(array_filter(
            array_reverse($mu),
            fn ($m) => ! in_array($m['id'], $goodIds, true)
        ));

        return [
            'good'      => $good,
            'bad'       => array_slice($bad, 0, 5),
            'opponents' => count($mu),
        ];
    }

    /**
     * Bir koridordaki TÜM rakip eşleşmelerini (rakip başına min maç) toplar ve
     * sapmaya göre AZALAN sıralar (en yüksek delta önce). delta = o rakibe karşı
     * WR − şampiyonun bu roldeki genel WR'si. matchupsFor + getChampionCounters ortak.
     * @return array<int, array{id:string,name:string,games:int,winRate:float,delta:float}>
     */
    /**
     * @param string|null $oppPos Rakibin pozisyonu. null = aynı koridor düellosu (ADC↔ADC).
     *                            'UTILITY' gibi bir değer verilirse bot lane çaprazı
     *                            (ör. ADC'nin karşı SUPPORT eşleşmeleri) döner.
     */
    private function aggregateMatchups(string $championId, array $patches, string $pos, float $posWinRate, ?string $oppPos = null): array
    {
        $rows = ChampionMatchup::where('champion_id', $championId)
            ->whereIn('patch', $patches)
            ->where('position', $pos)
            ->where('opponent_position', $oppPos ?? $pos)
            ->get();

        // Rakip adları (DDragon) — id görüntü için, name etiket için.
        $names = $this->championNames();

        $mu = [];
        foreach ($rows->groupBy('opponent_id') as $opp => $rws) {
            $g = (int) $rws->sum('games');
            if ($g < self::MATCHUP_MIN_GAMES) {
                continue;
            }
            $w = (int) $rws->sum('wins');
            $wr = round($w / $g * 100, 1);

            // Head-to-head detay: KDA/hasar/KP (payda n_stats, WR'nin games'inden ayrı —
            // prune'lu maçlarda ham detay yok). @15 koridor farkı (payda n15) — Faz B doldurur.
            $n = (int) $rws->sum('n_stats');
            $stats = $n > 0 ? [
                'n'   => $n,
                'kda' => [
                    'k' => round($rws->sum('sum_kills') / $n, 1),
                    'd' => round($rws->sum('sum_deaths') / $n, 1),
                    'a' => round($rws->sum('sum_assists') / $n, 1),
                ],
                'kp'  => (int) round($rws->sum('sum_kp') / $n),
                'dmg' => (int) round($rws->sum('sum_dmg') / $n),
            ] : null;

            $n15 = (int) $rws->sum('n15');
            $lane15 = $n15 > 0 ? [
                'n'     => $n15,
                'gd15'  => (int) round($rws->sum('sum_gd15') / $n15),
                'csd15' => round($rws->sum('sum_csd15') / $n15, 1),
                'xpd15' => (int) round($rws->sum('sum_xpd15') / $n15),
            ] : null;

            $mu[] = [
                'id'      => $opp,
                'name'    => $names[$opp] ?? $opp,
                'games'   => $g,
                'winRate' => $wr,
                'delta'   => round($wr - $posWinRate, 1),
                'stats'   => $stats,   // {n, kda:{k,d,a}, kp, dmg} | null
                'lane15'  => $lane15,  // {n, gd15, csd15, xpd15} | null (Faz B)
                // Güven-ağırlıklı sapma — YALNIZ sıralama için (görüntülenen delta gerçek kalır).
                '_conf'   => ($wr - $posWinRate) * $g / ($g + self::MATCHUP_CONF_K),
            ];
        }
        // Ham sapma yerine güven-ağırlıklı sapmaya göre sırala: az maçlı büyük sapma
        // (gürültü) çok maçlı gerçek avantajın üstüne çıkmaz.
        usort($mu, fn ($a, $b) => $b['_conf'] <=> $a['_conf']);
        foreach ($mu as &$m) {
            unset($m['_conf']);
        }
        unset($m);

        return $mu;
    }

    /** Yanıttaki spell_pair'lerde geçen büyü id'leri için ad + görsel URL map'i. */
    private function spellMapForPairs(array $byPosition): array
    {
        $ids = [];
        foreach ($byPosition as $cats) {
            foreach ($cats['spell_pair'] ?? [] as $row) {
                foreach (explode('-', $row['key']) as $id) {
                    $ids[(int) $id] = true;
                }
            }
        }
        if (! $ids) {
            return [];
        }
        $map = $this->ddragon->getSpellMap();
        $out = [];
        foreach (array_keys($ids) as $id) {
            if (isset($map[$id])) {
                $out[$id] = $map[$id]; // ['name' => ..., 'image' => ...]
            }
        }

        return $out;
    }

    /** Bu şampiyonu en çok oynayan gerçek oyuncular (isim bilinenler). */
    /**
     * DDragon şampiyon adları (id => görünen ad), istek başına TEK kez.
     *
     * Eskiden aggregateMatchups her çağrıldığında 171 şampiyonluk liste baştan
     * kuruluyordu. Bot lane çaprazı gelince bu çağrı sayısı pozisyon başına ikiye
     * çıktı (aynı koridor + çapraz) ve counters ucu ~0.6sn'ye yükseldi (normal
     * şampiyon ucu 0.18sn). Memoize edilince tek yükleme yetiyor.
     */
    private ?array $championNames = null;

    private function championNames(): array
    {
        if ($this->championNames !== null) {
            return $this->championNames;
        }
        $this->championNames = [];
        try {
            foreach ($this->ddragon->getChampions() as $c) {
                $this->championNames[$c['id']] = $c['name'] ?? $c['id'];
            }
        } catch (\Throwable) {
        }

        return $this->championNames;
    }

    private function topPlayers(string $championId, int $limit = 6): array
    {
        $rows = ChampionTopPlayer::where('champion_id', $championId)
            ->whereNotNull('game_name')
            ->where('games', '>=', 5)
            ->orderByDesc('games')
            ->limit($limit)
            ->get();

        // Oyuncunun gerçek profil ikonu cached_players'tan (puuid ile) gelir.
        $icons = CachedPlayer::whereIn('puuid', $rows->pluck('puuid'))
            ->pluck('profile_icon_id', 'puuid');

        return $rows
            ->map(fn ($r) => [
                'name'          => $r->game_name,
                'tag'           => $r->tag_line,
                'games'         => (int) $r->games,
                'wins'          => (int) $r->wins,
                'winRate'       => $r->games > 0 ? round($r->wins / $r->games * 100, 1) : 0.0,
                'profileIconId' => $icons[$r->puuid] ?? null,
                'tier'          => $r->tier,
                'rank'          => $r->rank,
                'lp'            => $r->lp !== null ? (int) $r->lp : null,
            ])
            ->values()
            ->all();
    }
}
