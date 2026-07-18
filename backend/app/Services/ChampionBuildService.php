<?php

namespace App\Services;

use App\Models\ChampionBuild;
use App\Models\ChampionStat;
use App\Models\ChampionTopPlayer;
use App\Services\RiotApi\DataDragonService;
use Illuminate\Support\Facades\Cache;

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
        'keystone'   => 3,
        'rune_minor' => 12,
        'shard'      => 9,
        'spell_pair' => 2,
        'item_full'  => 15,
    ];

    public function __construct(
        private PatchService $patch,
        private DataDragonService $ddragon,
    ) {}

    public function getChampionBuild(string $championId): array
    {
        $patches = $this->patch->keptPatches();
        $key = 'champion:build:v1:' . $championId . ':' . implode(',', $patches);

        return Cache::remember($key, 600, function () use ($championId, $patches) {
            return $this->compute($championId, $patches);
        });
    }

    private function compute(string $championId, array $patches): array
    {
        // Pozisyon dağılımı champion_stats'tan (build satırlarından daha güvenilir payda).
        $statRows = ChampionStat::where('champion_id', $championId)
            ->whereIn('patch', $patches)->get();

        $totalGames = (int) $statRows->where('position', 'ALL')->sum('games');

        $positions = [];
        foreach ($statRows->where('position', '!=', 'ALL')->groupBy('position') as $pos => $rows) {
            $g = (int) $rows->sum('games');
            $w = (int) $rows->sum('wins');
            $positions[] = [
                'position' => $pos,
                'games'    => $g,
                'wins'     => $w,
                'winRate'  => $g > 0 ? round($w / $g * 100, 1) : 0.0,
                'share'    => $totalGames > 0 ? round($g / $totalGames * 100, 1) : 0.0,
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

        // Build sayaçları: patch penceresi birleşik, pozisyon × kategori × anahtar.
        $buildRows = ChampionBuild::where('champion_id', $championId)
            ->whereIn('patch', $patches)->get();

        $byPosition = [];
        foreach ($shown as $p) {
            $pos = $p['position'];
            $rows = $buildRows->where('position', $pos);

            $cats = [];
            foreach (self::TOP_N as $category => $limit) {
                $agg = [];
                foreach ($rows->where('category', $category) as $r) {
                    $agg[$r->item_key] ??= ['games' => 0, 'wins' => 0];
                    $agg[$r->item_key]['games'] += (int) $r->games;
                    $agg[$r->item_key]['wins']  += (int) $r->wins;
                }
                $list = [];
                foreach ($agg as $k => $v) {
                    $list[] = [
                        'key'     => (string) $k,
                        'games'   => $v['games'],
                        'wins'    => $v['wins'],
                        'winRate' => $v['games'] > 0 ? round($v['wins'] / $v['games'] * 100, 1) : 0.0,
                        'pickRate' => $p['games'] > 0 ? round($v['games'] / $p['games'] * 100, 1) : 0.0,
                    ];
                }
                usort($list, fn ($a, $b) => $b['games'] <=> $a['games']);
                $cats[$category] = array_slice($list, 0, $limit);
            }

            $byPosition[$pos] = $cats;
        }

        return [
            'patches'    => $patches,
            'totalGames' => $totalGames,
            'positions'  => $shown,
            'byPosition' => $byPosition,
            'spellMap'   => $this->spellMapForPairs($byPosition),
            'topPlayers' => $this->topPlayers($championId),
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

    /** Bu şampiyonu en çok oynayan gerçek oyuncular (isim bilinenler). */
    private function topPlayers(string $championId, int $limit = 4): array
    {
        return ChampionTopPlayer::where('champion_id', $championId)
            ->whereNotNull('game_name')
            ->where('games', '>=', 5)
            ->orderByDesc('games')
            ->limit($limit)
            ->get()
            ->map(fn ($r) => [
                'name'    => $r->game_name,
                'tag'     => $r->tag_line,
                'games'   => (int) $r->games,
                'wins'    => (int) $r->wins,
                'winRate' => $r->games > 0 ? round($r->wins / $r->games * 100, 1) : 0.0,
            ])
            ->values()
            ->all();
    }
}
