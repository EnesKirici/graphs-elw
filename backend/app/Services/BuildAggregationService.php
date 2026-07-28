<?php

namespace App\Services;

use App\Models\ChampionBuild;
use App\Models\ChampionMatchup;
use App\Models\ChampionStat;
use App\Models\ChampionTopPlayer;
use App\Models\StatPatch;
use App\Services\RiotApi\DataDragonService;
use Illuminate\Support\Facades\DB;

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
        private TimelineStatsService $timelineStats,
    ) {}

    /**
     * Maçın geçerli (ranked, remake değil) olup olmadığını ve patch'ini döndürür.
     * @return array{0:bool,1:string} [geçerli mi, patch]
     */
    private function validateMatch(?array $info): array
    {
        if (! $info || empty($info['participants'])) {
            return [false, ''];
        }
        if (! in_array((int) ($info['queueId'] ?? 0), self::RANKED_QUEUES, true)) {
            return [false, ''];
        }
        if ((int) ($info['gameDuration'] ?? 0) < 300) {
            return [false, ''];
        }
        $patch = $this->patchBucket($info['gameVersion'] ?? '') ?? $this->ddragon->getCurrentVersion();

        return [true, $this->shortPatch($patch)];
    }

    /**
     * Timeline'a bağlı sayaçlar: skill_order / starter / item_slot1-5.
     * Maç sayaçlarından BAĞIMSIZ çalışır (timeline sonradan da işlenebilir).
     */
    public function processTimeline(array $matchData, array $timeline): bool
    {
        [$ok, $patch] = $this->validateMatch($matchData['info'] ?? null);
        if (! $ok) {
            return false;
        }
        $keysByPid = $this->timelineStats->extractAll($timeline);
        if (! $keysByPid) {
            return false;
        }
        $keyToId = $this->keyMap();

        foreach ($matchData['info']['participants'] as $i => $p) {
            $pid = (int) ($p['participantId'] ?? ($i + 1));
            $champId = $keyToId[(int) ($p['championId'] ?? 0)] ?? ($p['championName'] ?? null);
            if (! $champId || empty($keysByPid[$pid])) {
                continue;
            }
            $pos = $p['teamPosition'] ?: 'ALL';
            $win = ! empty($p['win']);
            foreach ($keysByPid[$pid] as [$category, $itemKey]) {
                $this->bumpBuild($patch, $champId, $pos, $category, $itemKey, $win);
            }
        }

        // @15 koridor avantajı (gold/cs/xp farkı) → champion_matchups. Timeline zaten
        // elimizde; ek Riot isteği YOK. Frame SAKLANMAZ, sadece 15. dk anı çıkarılır.
        $this->processLane15($matchData, $timeline, $patch);

        return true;
    }

    /**
     * Timeline'ın ~15. dakika frame'inden her koridor için gold/cs/xp farkını (şampiyon
     * vs karşı koridordaki rakip) çıkarıp champion_matchups'a EKLER (agregat toplam + n15).
     * Frame saklanmaz. 15. dk'ya ulaşmamış maçlar atlanır.
     */
    private function processLane15(array $matchData, array $timeline, string $patch): void
    {
        $frames = $timeline['info']['frames'] ?? [];
        if (count($frames) < 16) {
            return; // maç 15. dk'dan önce bitmiş → @15 anlamlı değil
        }
        $f15 = $frames[15]['participantFrames'] ?? [];
        if (! $f15) {
            return;
        }
        $keyToId = $this->keyMap();

        // pozisyon × takım → [champId, gold, cs, xp]
        $byPos = [];
        foreach ($matchData['info']['participants'] as $p) {
            $pid = (string) ($p['participantId'] ?? 0);
            $pos = $p['teamPosition'] ?? '';
            $champId = $keyToId[(int) ($p['championId'] ?? 0)] ?? ($p['championName'] ?? null);
            if (! $pos || ! $champId || empty($f15[$pid])) {
                continue;
            }
            $pf = $f15[$pid];
            $gold = (int) ($pf['totalGold'] ?? 0);
            $cs = (int) ($pf['minionsKilled'] ?? 0) + (int) ($pf['jungleMinionsKilled'] ?? 0);
            $xp = (int) ($pf['xp'] ?? 0);
            $byPos[$pos][(int) ($p['teamId'] ?? 0)] = [$champId, $gold, $cs, $xp];
        }

        foreach ($byPos as $pos => $teams) {
            if (count($teams) !== 2) {
                continue;
            }
            [$a, $b] = array_values($teams);
            if ($a[0] === $b[0]) {
                continue;
            }
            $this->bumpLane15($patch, $a[0], $pos, $b[0], $a[1] - $b[1], $a[2] - $b[2], $a[3] - $b[3]);
            $this->bumpLane15($patch, $b[0], $pos, $a[0], $b[1] - $a[1], $b[2] - $a[2], $b[3] - $a[3]);
        }
    }

    /** @15 farkını (işaretli) tek matchup satırına ekler. */
    private function bumpLane15(string $patch, string $champ, string $pos, string $opp, int $gd, int $csd, int $xpd): void
    {
        ChampionMatchup::firstOrCreate(
            ['patch' => $patch, 'champion_id' => $champ, 'position' => $pos, 'opponent_id' => $opp],
            ['games' => 0, 'wins' => 0],
        );
        ChampionMatchup::where([
            'patch' => $patch, 'champion_id' => $champ, 'position' => $pos, 'opponent_id' => $opp,
        ])->update([
            'n15'       => DB::raw('n15 + 1'),
            'sum_gd15'  => DB::raw('sum_gd15 + (' . (int) $gd . ')'),
            'sum_csd15' => DB::raw('sum_csd15 + (' . (int) $csd . ')'),
            'sum_xpd15' => DB::raw('sum_xpd15 + (' . (int) $xpd . ')'),
        ]);
    }

    /**
     * Maçtaki karşı koridor eşleşmeleri: her pozisyon için iki takımın oyuncusu
     * eşlenir, iki yönlü satır üretilir. Pozisyonu boş/çift olan maçlar atlanır.
     *
     * Her satır o şampiyonun O MAÇTAKİ stat'ıyla gelir (KDA/KP/hasar) → head-to-head
     * detay agregasyonu için. Eski çağıranlar ilk 5 elemanı destructure eder (geri uyumlu).
     *
     * @return array<array{0:string,1:string,2:string,3:string,4:bool,5:int,6:int,7:int,8:int,9:int}>
     *         [patch, championId, position, opponentId, win, kills, deaths, assists, kp%, dmg]
     */
    public function matchupRows(array $matchData): array
    {
        [$ok, $patch] = $this->validateMatch($matchData['info'] ?? null);
        if (! $ok) {
            return [];
        }
        $keyToId = $this->keyMap();
        $participants = $matchData['info']['participants'] ?? [];

        // Takım toplam öldürme (KP paydası)
        $teamKills = [];
        foreach ($participants as $p) {
            $tid = (int) ($p['teamId'] ?? 0);
            $teamKills[$tid] = ($teamKills[$tid] ?? 0) + (int) ($p['kills'] ?? 0);
        }

        // pozisyon × takım → [champId, win, kills, deaths, assists, kp, dmg]
        $byPos = [];
        foreach ($participants as $p) {
            $pos = $p['teamPosition'] ?? '';
            $champId = $keyToId[(int) ($p['championId'] ?? 0)] ?? ($p['championName'] ?? null);
            if (! $pos || ! $champId) {
                continue;
            }
            $tid = (int) ($p['teamId'] ?? 0);
            $k = (int) ($p['kills'] ?? 0);
            $d = (int) ($p['deaths'] ?? 0);
            $a = (int) ($p['assists'] ?? 0);
            $tk = $teamKills[$tid] ?? 0;
            $kp = $tk > 0 ? (int) round(($k + $a) / $tk * 100) : 0;
            $dmg = (int) ($p['totalDamageDealtToChampions'] ?? 0);
            $byPos[$pos][$tid] = [$champId, ! empty($p['win']), $k, $d, $a, $kp, $dmg];
        }

        $rows = [];
        foreach ($byPos as $pos => $teams) {
            if (count($teams) !== 2) {
                continue; // pozisyon verisi bozuk (çift jungle vb.) — güvenme
            }
            [$a, $b] = array_values($teams);
            if ($a[0] === $b[0]) {
                continue; // aynı şampiyon (teorik) — anlamsız
            }
            $rows[] = [$patch, $a[0], $pos, $b[0], $a[1], $a[2], $a[3], $a[4], $a[5], $a[6]];
            $rows[] = [$patch, $b[0], $pos, $a[0], $b[1], $b[2], $b[3], $b[4], $b[5], $b[6]];
        }

        return $rows;
    }

    /**
     * Eski bir maçın keystone-koşullu rün satırlarını DÖNDÜRÜR (bump etmez) —
     * builds:backfill-runes bunları bellekte toplayıp tek toplu upsert ile yazar
     * (maç başına ~240 tekil sorgu yerine chunk başına birkaç sorgu).
     *
     * @return array<array{0:string,1:string,2:string,3:string,4:string,5:bool}>
     *         [patch, championId, position, category, itemKey, win]
     */
    public function runeConditionalRows(array $matchData): array
    {
        [$ok, $patch] = $this->validateMatch($matchData['info'] ?? null);
        if (! $ok) {
            return [];
        }
        $keyToId = $this->keyMap();
        $rows = [];

        foreach ($matchData['info']['participants'] as $p) {
            $champId = $keyToId[(int) ($p['championId'] ?? 0)] ?? ($p['championName'] ?? null);
            if (! $champId) {
                continue;
            }
            $pos = $p['teamPosition'] ?: 'ALL';
            $win = ! empty($p['win']);
            foreach ($this->runeConditionalKeys($p) as [$category, $itemKey]) {
                $rows[] = [$patch, $champId, $pos, $category, $itemKey, $win];
            }
        }

        return $rows;
    }

    /**
     * Bir maçın tam Riot objesini (data) işler.
     * @return bool işlendi mi (geçerli ranked maç değilse false)
     */
    public function processMatch(array $matchData, string $region = 'tr1'): bool
    {
        [$ok, $patch] = $this->validateMatch($matchData['info'] ?? null);
        if (! $ok) {
            return false;
        }
        $info = $matchData['info'];
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

        // 4) champion_matchups — karşı koridor eşleşmeleri (A-vs-B + B-vs-A) + KDA/hasar
        foreach ($this->matchupRows($matchData) as [$mPatch, $champ, $pos, $opp, $win, $k, $d, $as, $kp, $dmg]) {
            ChampionMatchup::firstOrCreate(
                ['patch' => $mPatch, 'champion_id' => $champ, 'position' => $pos, 'opponent_id' => $opp],
                ['games' => 0, 'wins' => 0],
            );
            // Tek update: games/wins (WR paydası) + KDA/hasar (n_stats ayrı payda).
            ChampionMatchup::where([
                'patch' => $mPatch, 'champion_id' => $champ, 'position' => $pos, 'opponent_id' => $opp,
            ])->update([
                'games'       => DB::raw('games + 1'),
                'wins'        => DB::raw('wins + ' . ($win ? 1 : 0)),
                'n_stats'     => DB::raw('n_stats + 1'),
                'sum_kills'   => DB::raw('sum_kills + ' . (int) $k),
                'sum_deaths'  => DB::raw('sum_deaths + ' . (int) $d),
                'sum_assists' => DB::raw('sum_assists + ' . (int) $as),
                'sum_kp'      => DB::raw('sum_kp + ' . (int) $kp),
                'sum_dmg'     => DB::raw('sum_dmg + ' . (int) $dmg),
            ]);
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
        // Minor rünler — ana ağaç (2-4) + YAN ağaç (2 seçim). Yan ağaç sayılmazsa
        // build sayfasındaki ikincil ağaç başka sayfaların rünlerinden türer (yanlış).
        foreach ($this->minorPerks($perks) as $perk) {
            $out[] = ['rune_minor', (string) $perk];
        }
        // Stat shard'lar
        foreach (['offense', 'flex', 'defense'] as $slot) {
            if (! empty($perks['statPerks'][$slot])) {
                $out[] = ['shard', (string) $perks['statPerks'][$slot]];
            }
        }
        // Keystone-KOŞULLU sayaçlar: rün sayfası bir bütündür — yan ağaç ve shard
        // istatistikleri ancak "o keystone ile oynanan maçlar" içinde anlamlıdır.
        $out = array_merge($out, $this->runeConditionalKeys($p));
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
        return $out;
    }

    /** Ana ağaç minörleri (2-4) + yan ağaç seçimleri (2) — perk id listesi. */
    private function minorPerks(array $perks): array
    {
        $out = [];
        foreach (array_slice($perks['styles'][0]['selections'] ?? [], 1) as $sel) {
            if (! empty($sel['perk'])) {
                $out[] = $sel['perk'];
            }
        }
        foreach ($perks['styles'][1]['selections'] ?? [] as $sel) {
            if (! empty($sel['perk'])) {
                $out[] = $sel['perk'];
            }
        }

        return $out;
    }

    /**
     * Keystone-koşullu anahtarlar: [['rune_minor_k', 'KEYSTONE:PERK'], ['shard_k', 'KEYSTONE:SHARD']].
     * builds:backfill-runes komutu da eski maçlar için yalnız bunları işler.
     */
    public function runeConditionalKeys(array $p): array
    {
        $perks = $p['perks'] ?? [];
        $keystone = $perks['styles'][0]['selections'][0]['perk'] ?? null;
        if (! $keystone) {
            return [];
        }

        $out = [];
        foreach ($this->minorPerks($perks) as $perk) {
            $out[] = ['rune_minor_k', "{$keystone}:{$perk}"];
        }
        foreach (['offense', 'flex', 'defense'] as $slot) {
            if (! empty($perks['statPerks'][$slot])) {
                $out[] = ['shard_k', "{$keystone}:{$perks['statPerks'][$slot]}"];
            }
        }

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
