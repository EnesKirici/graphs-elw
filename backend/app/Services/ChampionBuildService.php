<?php

namespace App\Services;

use App\Models\CachedPlayer;
use App\Models\ChampionBuild;
use App\Models\ChampionStat;
use App\Models\ChampionTopPlayer;
use App\Models\StatPatch;
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
    ) {}

    public function getChampionBuild(string $championId): array
    {
        $patches = $this->patch->keptPatches();
        $key = 'champion:build:v4:' . $championId . ':' . implode(',', $patches);

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

        // Genel bakış: pick/ban oranları (payda = patch penceresindeki toplam maç).
        // Bir şampiyon bir maçta en fazla 1 kez seçilebilir → pick = games / totalMatches.
        $totalMatches = (int) StatPatch::whereIn('patch', $patches)->sum('total_games');
        $allWins = (int) $statRows->where('position', 'ALL')->sum('wins');
        $allBans = (int) $statRows->where('position', 'ALL')->sum('bans');
        $overview = [
            'games'    => $totalGames,
            'winRate'  => $totalGames > 0 ? round($allWins / $totalGames * 100, 1) : 0.0,
            'pickRate' => $totalMatches > 0 ? round($totalGames / $totalMatches * 100, 1) : 0.0,
            'banRate'  => $totalMatches > 0 ? round($allBans / $totalMatches * 100, 1) : 0.0,
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
                        $row['completed'] = $it !== null
                            && empty($it['into'])
                            && (int) ($it['depth'] ?? 1) >= 2;
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
