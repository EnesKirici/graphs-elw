<?php

namespace App\Services;

use App\Models\ChampionBuild;
use App\Models\ChampionStat;
use App\Models\ChampionTopPlayer;
use App\Models\StatPatch;
use App\Services\RiotApi\DataDragonService;

/**
 * Tek bir maçı işleyip AGGREGATE sayaçları artırır (INCREMENTAL).
 *
 * ChampionStatsService::aggregateFromMatches() tüm `matches` tablosunu baştan sayar;
 * bu servis ise worker akışında TEK maç işler (ProcessMatchJob'tan çağrılır):
 *   - champion_stats   (ALL + pozisyon + ban)       → tier list / WR / pick / ban
 *   - champion_builds  (keystone / shard / spell / item) → build sayfası
 *   - champion_top_players (oyuncu × şampiyon)       → OTP listeleri / dünya-TR sırası
 *
 * NOT (iskelet): starter item ve skill-max sırası maç TIMELINE'ı gerektirir
 * (matches/{id}/timeline). Şimdilik final item + keystone + shard + spell çiftinden
 * çıkarılıyor; timeline entegrasyonu TODO.
 */
class BuildAggregationService
{
    private const RANKED_QUEUES = [420, 440];

    /** @var array<int,string>|null championId(numeric) → DDragon id */
    private ?array $keyToId = null;

    public function __construct(
        private DataDragonService $ddragon,
    ) {}

    /**
     * Bir maçın tam Riot objesini (data) işler.
     * @return bool işlendi mi (geçerli ranked maç değilse false)
     */
    public function processMatch(array $matchData, string $region = 'tr1'): bool
    {
        $info = $matchData['info'] ?? null;
        if (! $info || empty($info['participants'])) {
            return false;
        }
        if (! in_array((int) ($info['queueId'] ?? 0), self::RANKED_QUEUES, true)) {
            return false;
        }
        if ((int) ($info['gameDuration'] ?? 0) < 300) {
            return false; // remake
        }

        $patch = $this->patchBucket($info['gameVersion'] ?? '') ?? $this->ddragon->getCurrentVersion();
        $patch = $this->shortPatch($patch);
        $keyToId = $this->keyMap();

        // Patch toplam maç sayacı (pick/ban rate paydası)
        StatPatch::query()->where('patch', $patch)->exists()
            ? StatPatch::where('patch', $patch)->increment('total_games')
            : StatPatch::create(['patch' => $patch, 'total_games' => 1]);

        foreach ($info['participants'] as $p) {
            $key = (int) ($p['championId'] ?? 0);
            $champId = $keyToId[$key] ?? ($p['championName'] ?? null);
            if (! $champId) {
                continue;
            }
            $pos = $p['teamPosition'] ?: 'ALL';
            $win = ! empty($p['win']);

            // 1) champion_stats — ALL + pozisyon
            $this->bumpStat($patch, $champId, $key, 'ALL', $win);
            if ($pos !== 'ALL') {
                $this->bumpStat($patch, $champId, $key, $pos, $win);
            }

            // 2) champion_builds — keystone / shard / spell çifti / final item
            foreach ($this->buildKeys($p) as [$category, $itemKey]) {
                $this->bumpBuild($patch, $champId, $pos, $category, $itemKey, $win);
            }

            // 3) champion_top_players — oyuncu × şampiyon
            $this->bumpTopPlayer($region, $champId, $p, $win);
        }

        // Banlar → champion_stats.bans (ALL). Maç içinde TEKİLLEŞTİR: iki takım aynı
        // şampiyonu banlayabilir; çift sayılırsa banRate %100'ü aşar (stats:rebuild
        // ile aynı kural — ChampionStatsService::aggregateFromMatches).
        $banned = [];
        foreach ($info['teams'] ?? [] as $team) {
            foreach ($team['bans'] ?? [] as $ban) {
                $cid = $keyToId[(int) ($ban['championId'] ?? -1)] ?? null;
                if ($cid) {
                    $banned[$cid] = true;
                }
            }
        }
        foreach (array_keys($banned) as $cid) {
            ChampionStat::where(['patch' => $patch, 'champion_id' => $cid, 'position' => 'ALL'])
                ->increment('bans');
        }

        return true;
    }

    /** Bir participant'tan build anahtarlarını çıkar: [[category, key], ...] */
    private function buildKeys(array $p): array
    {
        $out = [];
        $perks = $p['perks'] ?? [];

        // Keystone (ana ağacın ilk seçimi)
        $keystone = $perks['styles'][0]['selections'][0]['perk'] ?? null;
        if ($keystone) {
            $out[] = ['keystone', (string) $keystone];
        }
        // Minor rünler (ana ağaç 2-4)
        foreach (array_slice($perks['styles'][0]['selections'] ?? [], 1) as $sel) {
            if (! empty($sel['perk'])) {
                $out[] = ['rune_minor', (string) $sel['perk']];
            }
        }
        // Stat shard'lar
        foreach (['offense', 'flex', 'defense'] as $slot) {
            if (! empty($perks['statPerks'][$slot])) {
                $out[] = ['shard', (string) $perks['statPerks'][$slot]];
            }
        }
        // Sihirdar büyüsü çifti (sıralı)
        $s1 = (int) ($p['summoner1Id'] ?? 0);
        $s2 = (int) ($p['summoner2Id'] ?? 0);
        if ($s1 && $s2) {
            $pair = $s1 < $s2 ? "{$s1}-{$s2}" : "{$s2}-{$s1}";
            $out[] = ['spell_pair', $pair];
        }
        // Final itemler (item0..item5; item6 = trinket, atlanır)
        for ($i = 0; $i <= 5; $i++) {
            $item = (int) ($p["item{$i}"] ?? 0);
            if ($item > 0) {
                $out[] = ['item_full', (string) $item];
            }
        }
        // TODO: starter item + skill-max sırası → match timeline gerekiyor.

        return $out;
    }

    private function bumpStat(string $patch, string $champId, int $key, string $pos, bool $win): void
    {
        $row = ChampionStat::firstOrCreate(
            ['patch' => $patch, 'champion_id' => $champId, 'position' => $pos],
            ['champion_key' => $key, 'games' => 0, 'wins' => 0, 'bans' => 0],
        );
        $row->increment('games');
        if ($win) {
            $row->increment('wins');
        }
    }

    private function bumpBuild(string $patch, string $champId, string $pos, string $category, string $key, bool $win): void
    {
        $row = ChampionBuild::firstOrCreate(
            ['patch' => $patch, 'champion_id' => $champId, 'position' => $pos, 'category' => $category, 'item_key' => $key],
            ['games' => 0, 'wins' => 0],
        );
        $row->increment('games');
        if ($win) {
            $row->increment('wins');
        }
    }

    private function bumpTopPlayer(string $region, string $champId, array $p, bool $win): void
    {
        $puuid = $p['puuid'] ?? null;
        if (! $puuid) {
            return;
        }
        $row = ChampionTopPlayer::firstOrCreate(
            ['region' => $region, 'champion_id' => $champId, 'puuid' => $puuid],
            ['games' => 0, 'wins' => 0],
        );
        $row->increment('games');
        if ($win) {
            $row->increment('wins');
        }
        // Maç-v5'te oyuncu adı var → güncel tut (tier/rank crawler'dan gelir)
        $name = $p['riotIdGameName'] ?? null;
        if ($name && $row->game_name !== $name) {
            $row->update(['game_name' => $name, 'tag_line' => $p['riotIdTagline'] ?? null]);
        }
    }

    /** @return array<int,string> */
    private function keyMap(): array
    {
        if ($this->keyToId !== null) {
            return $this->keyToId;
        }
        $this->keyToId = [];
        foreach ($this->ddragon->getChampions() as $champ) {
            $this->keyToId[(int) $champ['key']] = $champ['id'];
        }
        return $this->keyToId;
    }

    /** "16.11.1" → "16.11" (patch bucket). */
    private function shortPatch(string $v): string
    {
        $parts = explode('.', $v);
        return count($parts) >= 2 ? "{$parts[0]}.{$parts[1]}" : $v;
    }

    /** gameVersion'dan patch bucket (boşsa null). */
    private function patchBucket(string $gameVersion): ?string
    {
        if ($gameVersion === '') {
            return null;
        }
        return $this->shortPatch($gameVersion);
    }
}
