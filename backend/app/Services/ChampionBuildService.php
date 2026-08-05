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
        // Sayfanın gösterdiği kadar: ayrı bir "tam liste" sekmesi için geniş
        // tutulmuştu, o sekme geri alındı → gereksiz veri taşınmasın.
        'spell_pair'   => 4,
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
        // v10: alternatif sayıları sayfanın gösterdiği kadara indi (Build sekmesi geri alındı).
        $key = 'champion:build:v10:' . $championId . ':' . implode(',', $patches);

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
        // v5: her eşleşmeye rakip tarafının sayıları (opp) eklendi — kafa-kafaya kıyas tablosu.
        // v6: iki tarafın da KENDİ ortalaması (baseline / opp.base) — sınıf farkını değil
        //     eşleşmeyi ölçmek için; bkz. aggregateMatchups içindeki gerekçe.
        // v7: rol metrikleri (emilen hasar / şifa+kalkan / CC) — tanklamak ve iyileştirmek
        //     hiçbir eksende görünmüyordu.
        $key = 'champion:counters:v7:' . $championId . ':' . implode(',', $patches);

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
                    // Sayfanın şampiyonunun bu koridordaki KENDİ ortalaması. Tüm
                    // eşleşmelerde aynı olduğu için eşleşme başına DEĞİL, burada bir kez.
                    'baseline'   => $this->championBaseline($championId, $patches, $p['position']),
                ];

                // Çapraz koridor (yalnız alt koridor): ADC için karşı SUPPORT'lar,
                // SUPPORT için karşı ADC'ler. Veri yoksa alan hiç eklenmez.
                if ($cp = $crossOf[$p['position']] ?? null) {
                    $cm = $this->aggregateMatchups($championId, $patches, $p['position'], (float) $p['winRate'], $cp);
                    if ($cm) {
                        $entry['crossPosition'] = $cp;
                        // Çapraz eşleşmenin paydası AYRI: ADC'nin "karşı destek" ortalaması,
                        // ADC-vs-ADC ortalamasıyla aynı şey değil.
                        $entry['crossBaseline'] = $this->championBaseline($championId, $patches, $p['position'], $cp);
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
            'itemNames'  => $this->itemNamesFor($byPosition),
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

        /*
          KARŞI TARAFIN satırları — kafa-kafaya kıyas tablosu için (counter sayfası).
          Şema her eşleşmeyi İKİ yönlü saklar (A-vs-B ve B-vs-A ayrı satır), bu yüzden
          rakibin KDA/KP/hasarı gerçek veridir; aynadan türetilemez (yalnız @15 farkları
          simetriktir). Rakip başına ayrı sorgu N+1 olurdu → hepsi TEK sorguda çekilip
          champion_id'ye göre gruplanır.
        */
        $oppIds = $rows->pluck('opponent_id')->unique()->all();
        $mirror = $oppIds ? ChampionMatchup::whereIn('champion_id', $oppIds)
            ->whereIn('patch', $patches)
            ->where('position', $oppPos ?? $pos)
            ->where('opponent_id', $championId)
            ->where('opponent_position', $pos)
            ->get()->groupBy('champion_id') : collect();

        /*
          RAKİPLERİN KENDİ NORMALİ — adil kıyasın paydası (2026-08-05).

          Mutlak sayıları yan yana koymak şampiyon SINIFINI ölçüyordu, eşleşmeyi değil:
          Yuumi'nin @15 gold farkı TÜM rakiplerine karşı ortalama −514, Pyke'ın +286.
          Yuumi hangi rakiple oynarsa oynasın "geride" çıkıyordu — çünkü Yuumi minyon
          almıyor, rakibin bununla ilgisi yok. Ölçülen örnek: Yuumi-vs-Rell gd15 = −274,
          yani Yuumi kendi normalinden 240 gold ÖNDE; panel ise satırı Rell lehine
          tam kırmızı çiziyordu.

          Çözüm: her tarafı KENDİ ortalamasıyla kıyasla. Bu, elimizdeki satırlardan
          bedava çıkıyor (rakibin tüm eşleşmelerinin toplamı). Satırları çekmek yerine
          SQL'de topluyoruz: rakip başına ~150 satır × ~40 rakip = 6K satır belleğe
          alınacaktı, tek gruplu sorgu bunu rakip başına 1 satıra indiriyor.
        */
        $oppBase = $oppIds ? ChampionMatchup::whereIn('champion_id', $oppIds)
            ->whereIn('patch', $patches)
            ->where('position', $oppPos ?? $pos)
            ->where('opponent_position', $pos)
            ->groupBy('champion_id')
            ->selectRaw(
                'champion_id, SUM(n_stats) n_stats, SUM(sum_kills) sum_kills, SUM(sum_deaths) sum_deaths,'
                . ' SUM(sum_assists) sum_assists, SUM(sum_kp) sum_kp, SUM(sum_dmg) sum_dmg,'
                . ' SUM(n_role) n_role, SUM(sum_taken) sum_taken, SUM(sum_heal_shield) sum_heal_shield, SUM(sum_cc) sum_cc,'
                . ' SUM(n15) n15, SUM(sum_gd15) sum_gd15, SUM(sum_csd15) sum_csd15, SUM(sum_xpd15) sum_xpd15'
            )
            ->get()->keyBy('champion_id') : collect();

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
            $stats = $this->matchupStats($rws);
            $lane15 = $this->matchupLane15($rws);

            // Rakibin AYNI eşleşmedeki kendi sayıları (kıyas tablosunun sağ sütunu).
            $oRws = $mirror[$opp] ?? null;
            // Rakibin TÜM eşleşmelerdeki ortalaması (kıyasın paydası). Gruplu sorgudan
            // tek satır geliyor; matchupStats/matchupLane15 koleksiyon beklediği için sarılır.
            $oBase = isset($oppBase[$opp]) ? collect([$oppBase[$opp]]) : null;

            $mu[] = [
                'id'      => $opp,
                'name'    => $names[$opp] ?? $opp,
                'games'   => $g,
                'winRate' => $wr,
                'delta'   => round($wr - $posWinRate, 1),
                'stats'   => $stats,   // {n, kda:{k,d,a}, kp, dmg} | null
                'lane15'  => $lane15,  // {n, gd15, csd15, xpd15} | null (Faz B)
                // Kafa-kafaya kıyas için rakip tarafı. winRate hesaplanmaz — tanım gereği
                // 100 - bizimki (aynı maç kümesi); alan şişirilmesin diye gönderilmez.
                'opp'     => $oRws ? [
                    'stats'  => $this->matchupStats($oRws),
                    'lane15' => $this->matchupLane15($oRws),
                    // Rakibin kendi normali — frontend sapmayı bununla hesaplar.
                    'base'   => $oBase ? [
                        'stats'  => $this->matchupStats($oBase),
                        'lane15' => $this->matchupLane15($oBase),
                    ] : null,
                ] : null,
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

    /**
     * ŞAMPİYONUN KENDİ NORMALİ: bir koridorda TÜM rakiplerine karşı ortalaması.
     *
     * Kıyas tablosunun ve "koridor" etiketinin paydası. Mutlak sayı bir şampiyonun
     * ne yaptığını değil ne OLDUĞUNU ölçer (Yuumi gd15 ort. −514, Pyke +286); sapma
     * ise eşleşmeye özgüdür. Rakip tarafının karşılığı aggregateMatchups içindeki
     * $oppBase; burası sayfanın öznesi için aynı hesabı yapar.
     *
     * @param string|null $oppPos null = aynı koridor düellosu; 'UTILITY' vb. = bot çaprazı.
     */
    private function championBaseline(string $championId, array $patches, string $pos, ?string $oppPos = null): array
    {
        $agg = ChampionMatchup::where('champion_id', $championId)
            ->whereIn('patch', $patches)
            ->where('position', $pos)
            ->where('opponent_position', $oppPos ?? $pos)
            ->selectRaw(
                'SUM(n_stats) n_stats, SUM(sum_kills) sum_kills, SUM(sum_deaths) sum_deaths,'
                . ' SUM(sum_assists) sum_assists, SUM(sum_kp) sum_kp, SUM(sum_dmg) sum_dmg,'
                . ' SUM(n_role) n_role, SUM(sum_taken) sum_taken, SUM(sum_heal_shield) sum_heal_shield, SUM(sum_cc) sum_cc,'
                . ' SUM(n15) n15, SUM(sum_gd15) sum_gd15, SUM(sum_csd15) sum_csd15, SUM(sum_xpd15) sum_xpd15'
            )
            ->first();

        $one = collect([$agg]);

        return [
            'stats'  => $this->matchupStats($one),
            'lane15' => $this->matchupLane15($one),
        ];
    }

    /**
     * Matchup satır kümesinden KDA/KP/hasar ortalaması. Payda n_stats — games'ten AYRI,
     * çünkü prune edilmiş maçlarda ham detay yok (WR sayılır, KDA sayılmaz).
     * @param \Illuminate\Support\Collection<int, ChampionMatchup> $rws
     */
    private function matchupStats($rws): ?array
    {
        $n = (int) $rws->sum('n_stats');
        if ($n <= 0) {
            return null;
        }

        $out = [
            'n'   => $n,
            'kda' => [
                'k' => round($rws->sum('sum_kills') / $n, 1),
                'd' => round($rws->sum('sum_deaths') / $n, 1),
                'a' => round($rws->sum('sum_assists') / $n, 1),
            ],
            'kp'  => (int) round($rws->sum('sum_kp') / $n),
            'dmg' => (int) round($rws->sum('sum_dmg') / $n),
        ];

        /*
          ROL METRİKLERİ — AYRI PAYDA (n_role).

          Şampiyonun hasar dışındaki işi: tanklamak, iyileştirmek/kalkan basmak,
          CC tutmak. n_stats ile bölünemez: bu sütunlar 2026-08-05'te eklendi ve
          eski maçlar backfill ile doluyor, yani n_role < n_stats iken ortalama
          sistematik olarak DÜŞÜK çıkardı. Backfill bitince ikisi eşitlenir.
        */
        $nRole = (int) $rws->sum('n_role');
        if ($nRole > 0) {
            $out['nRole'] = $nRole;
            $out['taken'] = (int) round($rws->sum('sum_taken') / $nRole);
            $out['hs']    = (int) round($rws->sum('sum_heal_shield') / $nRole);
            $out['cc']    = (int) round($rws->sum('sum_cc') / $nRole);
        }

        return $out;
    }

    /**
     * 15. dakika koridor farkları (gold/cs/xp) — İŞARETLİ, negatif olabilir.
     * Payda n15; timeline saklanmadığı için eski maçlar boş kalır (ileriye dönük dolar).
     * @param \Illuminate\Support\Collection<int, ChampionMatchup> $rws
     */
    private function matchupLane15($rws): ?array
    {
        $n15 = (int) $rws->sum('n15');
        if ($n15 <= 0) {
            return null;
        }

        return [
            'n'     => $n15,
            'gd15'  => (int) round($rws->sum('sum_gd15') / $n15),
            'csd15' => round($rws->sum('sum_csd15') / $n15, 1),
            'xpd15' => (int) round($rws->sum('sum_xpd15') / $n15),
        ];
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

    /**
     * Yanıtta geçen TÜM eşya id'leri için ad map'i (id => "Ebedi Kılıç").
     *
     * İkon tek başına yetmiyordu: "2. eşya %64" diyen bir kart, hangi eşya olduğunu
     * bilmeyen ziyaretçiye hiçbir şey anlatmıyor (kullanıcı "2. eşya olarak ebedi mi
     * alınmış?" diye sormuştu — ikondan çıkaramamıştı). Yalnız kullanılan id'ler
     * gönderilir, tüm item.json değil.
     */
    private function itemNamesFor(array $byPosition): array
    {
        $ids = [];
        foreach ($byPosition as $cats) {
            foreach (['item_full', 'starter', 'item_slot1', 'item_slot2', 'item_slot3', 'item_slot4', 'item_slot5'] as $cat) {
                foreach ($cats[$cat] ?? [] as $row) {
                    // starter kombinasyonu "1055-2003" biçiminde
                    foreach (explode('-', (string) $row['key']) as $id) {
                        $ids[(string) (int) $id] = true;
                    }
                }
            }
        }
        if (! $ids) {
            return [];
        }

        try {
            $items = $this->ddragon->getItems();
        } catch (\Throwable) {
            return [];
        }

        $out = [];
        foreach (array_keys($ids) as $id) {
            if (isset($items[$id]['name'])) {
                $out[$id] = $items[$id]['name'];
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

    /** Limit 10: sayfada iki ayrı sıralama var (ustalık / ladder), ilk 10 gösteriliyor. */
    private function topPlayers(string $championId, int $limit = 10): array
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
