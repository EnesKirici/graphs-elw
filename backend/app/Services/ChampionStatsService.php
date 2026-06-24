<?php

namespace App\Services;

use App\Models\ChampionStat;
use App\Models\MatchRecord;
use App\Models\StatPatch;
use App\Services\RiotApi\DataDragonService;
use Illuminate\Support\Facades\DB;

/**
 * Şampiyon meta istatistik pipeline'ı (iskelet).
 *
 * Tasarım: maçlar TEK TEK saklanmaz; her maç işlenip yalnızca AGGREGATE sayaçlara
 * (champion_stats) eklenir. Böylece milyonlarca maç ~birkaç bin satırlık sabit
 * boyutlu tabloya iner — DB şişmez.
 *
 * Şu an kaynak: mevcut `matches` tablosu (aranan oyunculardan). Worker + production
 * key gelince yüksek-elo crawler aynı aggregate'e maç besleyecek; bu servis değişmez.
 */
class ChampionStatsService
{
    /** Bir şampiyon-pozisyonun "gerçek" sayılması için min. örneklem (yoksa simülasyona düşer). */
    private const MIN_SAMPLE = 20;

    /** Meta için sayılan kuyruklar: Ranked Solo (420) + Ranked Flex (440), SR. */
    private const RANKED_QUEUES = [420, 440];

    public function __construct(
        private DataDragonService $ddragon,
    ) {}

    /**
     * `matches` tablosundaki maçları sayaçlara dönüştürür (tam yeniden hesap).
     *
     * @return array{patches: array<string,int>, statRows: int, matches: int}
     */
    public function aggregateFromMatches(): array
    {
        $keyToId = $this->championKeyMap();
        $currentBucket = $this->currentPatchBucket();

        $acc = [];        // "patch|champId|pos" => ['key','games','wins','bans']
        $patchGames = []; // patch => int

        MatchRecord::whereIn('queue_id', self::RANKED_QUEUES)
            ->select(['match_id', 'data'])
            ->chunk(200, function ($rows) use (&$acc, &$patchGames, $keyToId, $currentBucket) {
                foreach ($rows as $row) {
                    $info = $row->data['info'] ?? null;
                    if (!$info || empty($info['participants'])) {
                        continue;
                    }

                    // gameVersion trim'lenmiş olabilir → yoksa mevcut patch'e say.
                    $patch = $this->patchBucket($info['gameVersion'] ?? '') ?? $currentBucket;
                    if ($patch === '') {
                        continue;
                    }
                    $patchGames[$patch] = ($patchGames[$patch] ?? 0) + 1;

                    foreach ($info['participants'] as $p) {
                        // championId (numeric) → kanonik DDragon id. Hem casing
                        // tutarsızlığını (FiddleSticks/Fiddlesticks) çözer hem de
                        // dashboard'daki şampiyon id'leriyle birebir eşleşmeyi sağlar.
                        $key = (int) ($p['championId'] ?? 0);
                        $champId = $keyToId[$key] ?? ($p['championName'] ?? null);
                        if (! $champId) {
                            continue;
                        }
                        $pos = $p['teamPosition'] ?? '';
                        $win = ! empty($p['win']);

                        $this->bump($acc, $patch, $champId, 'ALL', $key, $win);
                        if ($pos !== '') {
                            $this->bump($acc, $patch, $champId, $pos, $key, $win);
                        }
                    }

                    foreach ($info['teams'] ?? [] as $team) {
                        foreach ($team['bans'] ?? [] as $ban) {
                            $cid = $keyToId[(int) ($ban['championId'] ?? -1)] ?? null;
                            if (! $cid) {
                                continue;
                            }
                            $k = "{$patch}|{$cid}|ALL";
                            $acc[$k] ??= ['key' => 0, 'games' => 0, 'wins' => 0, 'bans' => 0];
                            $acc[$k]['bans']++;
                        }
                    }
                }
            });

        $this->persist($acc, $patchGames);

        return [
            'patches'  => $patchGames,
            'statRows' => count($acc),
            'matches'  => array_sum($patchGames),
        ];
    }

    /**
     * Dashboard için gerçek istatistikler (yalnızca yeterli örneklemi olanlar).
     *
     * @return array<string, array{winRate: float, pickRate: float, banRate: float, sampleSize: int}>
     */
    public function getMetaStats(string $patch): array
    {
        $patchRow = StatPatch::find($patch);
        if (! $patchRow || $patchRow->total_games < 1) {
            return [];
        }
        $total = $patchRow->total_games;

        $rows = ChampionStat::where('patch', $patch)->where('position', 'ALL')->get();

        $out = [];
        foreach ($rows as $r) {
            if ($r->games < self::MIN_SAMPLE) {
                continue;
            }
            $out[$r->champion_id] = [
                'winRate'    => round($r->wins / $r->games * 100, 1),
                'pickRate'   => round($r->games / $total * 100, 1),
                'banRate'    => round($r->bans / $total * 100, 1),
                'sampleSize' => $r->games,
                'wins'       => $r->wins, // Wilson alt sınırı için
            ];
        }

        return $out;
    }

    public function currentPatchBucket(): string
    {
        return $this->patchBucket($this->ddragon->getCurrentVersion()) ?? '';
    }

    // ---- iç yardımcılar ----

    private function bump(array &$acc, string $patch, string $champId, string $pos, int $key, bool $win): void
    {
        $k = "{$patch}|{$champId}|{$pos}";
        $acc[$k] ??= ['key' => $key, 'games' => 0, 'wins' => 0, 'bans' => 0];
        if ($key) {
            $acc[$k]['key'] = $key;
        }
        $acc[$k]['games']++;
        if ($win) {
            $acc[$k]['wins']++;
        }
    }

    private function persist(array $acc, array $patchGames): void
    {
        DB::transaction(function () use ($acc, $patchGames) {
            ChampionStat::query()->delete();
            StatPatch::query()->delete();
            $now = now();

            $bulk = [];
            foreach ($acc as $k => $v) {
                [$patch, $champId, $pos] = explode('|', $k, 3);
                $bulk[] = [
                    'patch'        => $patch,
                    'champion_key' => $v['key'],
                    'champion_id'  => $champId,
                    'position'     => $pos,
                    'games'        => $v['games'],
                    'wins'         => $v['wins'],
                    'bans'         => $v['bans'],
                    'created_at'   => $now,
                    'updated_at'   => $now,
                ];
            }
            foreach (array_chunk($bulk, 400) as $chunk) {
                ChampionStat::insert($chunk);
            }

            foreach ($patchGames as $patch => $tg) {
                StatPatch::create(['patch' => $patch, 'total_games' => $tg]);
            }
        });
    }

    /** Riot numeric championId → DDragon champion id (ban eşleme için). */
    private function championKeyMap(): array
    {
        $map = [];
        foreach ($this->ddragon->getChampions() as $champ) {
            $map[(int) $champ['key']] = $champ['id'];
        }

        return $map;
    }

    /** gameVersion "16.11.123.456" → "16.11"; geçersizse null. */
    private function patchBucket(string $gameVersion): ?string
    {
        $parts = explode('.', $gameVersion);
        if (count($parts) < 2 || $parts[0] === '') {
            return null;
        }

        return $parts[0].'.'.$parts[1];
    }
}
