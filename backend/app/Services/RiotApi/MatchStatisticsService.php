<?php

namespace App\Services\RiotApi;

use App\Models\LpSnapshot;
use App\Models\MatchSummary;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

/**
 * Sezon istatistikleri ve çoklu maç aggregation servisi.
 * Koridor stats, winrate timeline, şampiyon stats, son maç özeti.
 */
class MatchStatisticsService
{
    private const ROLE_LABELS = ['TOP' => 'Top', 'JUNGLE' => 'Jungle', 'MIDDLE' => 'Mid', 'BOTTOM' => 'ADC', 'UTILITY' => 'Support'];
    private const ROLE_ICONS  = ['TOP' => 'top', 'JUNGLE' => 'jungle', 'MIDDLE' => 'mid', 'BOTTOM' => 'bot', 'UTILITY' => 'support'];

    /**
     * Profil cache anahtarlarının sürümleri — TEK KAYNAK.
     * Bir hesaplama değişip cache'i tazelemek gerektiğinde yalnızca buradaki sürümü artır;
     * hem yazan metod (self::ck) hem "Yenile" invalidasyonu (self::profileCacheKeys) senkron kalır.
     */
    private const CACHE_VERSIONS = [
        'avg_game_rank'    => 'v2',
        'season_roles'     => 'v4',
        'winrate_timeline' => 'v6',
        'lp_timeline'      => 'v5',
        'season_champs'    => 'v6',
        'season_badges'    => 'v4',
        'challenge_avgs'   => 'v5',
        'duo_partners'     => 'v6',
    ];

    /** Bir profil cache anahtarını merkezî sürümle üretir: "name:vN:{puuid}". */
    private static function ck(string $name, string $puuid): string
    {
        return $name . ':' . self::CACHE_VERSIONS[$name] . ':' . $puuid;
    }

    /**
     * "Yenile" (refresh) sonrası temizlenecek, yalnızca puuid'e bağlı profil cache anahtarları.
     * lp_timeline dinamik ekler (soloKey/flexKey) taşıdığından buraya dahil DEĞİL —
     * o, refresh'te queue-bazlı pattern temizliğiyle birlikte ele alınır.
     */
    public static function profileCacheKeys(string $puuid): array
    {
        return [
            self::ck('avg_game_rank', $puuid),
            self::ck('season_roles', $puuid),
            self::ck('winrate_timeline', $puuid),
            self::ck('season_champs', $puuid),
            self::ck('season_badges', $puuid),
            self::ck('challenge_avgs', $puuid),
            self::ck('duo_partners', $puuid),
        ];
    }

    public function __construct(
        private MatchDataService $matchData,
        private DataDragonService $ddragon,
        private LeagueService $league,
    ) {}

    /**
     * Oyuncunun sezon maçlarının kompakt stat kayıtları (match_summaries.stat_json).
     * MatchService::ensureSeasonSummaries önceden çağrılmış olmalı → full maç OKUNMAZ.
     * Her satır: ->queue_id, ->win, ->game_creation, ->stat_json['p'] (ham oyuncu,
     * challenges dahil), ->stat_json['roster'] (10 kompakt kimlik), ->stat_json['gameDuration'].
     */
    private function seasonStatRecords(string $puuid, ?array $queueIds = null): Collection
    {
        // Yalnız bu sezon (game_creation ms; seasonStartTimestamp saniye) → sezonlar karışmaz.
        $seasonStartMs = $this->matchData->seasonStartTimestamp() * 1000;

        $q = MatchSummary::where('puuid', $puuid)
            ->whereNotNull('stat_json')
            ->where('game_creation', '>=', $seasonStartMs)
            ->orderByDesc('game_creation');
        if ($queueIds) {
            $q->whereIn('queue_id', $queueIds);
        }

        return $q->get(['match_id', 'queue_id', 'win', 'game_creation', 'stat_json']);
    }

    /**
     * Tahmini MMR — son N maçtaki RAKİP oyuncuların ortalama solo rankı.
     * Riot MMR vermez; bu, oynanan maçların ortalama seviyesinden bir tahmindir.
     *
     * Maliyet: her benzersiz rakip için League-V4 (cache'li). Rate-limit'i korumak
     * için benzersiz rakip sayısı 25 ile sınırlı; 429'da elimizdekiyle yetinir.
     * Tüm sonuç summoner TTL'i boyunca cache'lenir (bir kez hesaplanır).
     */
    public function getAvgGameRank(string $puuid, int $matchCount = 20): ?array
    {
        return Cache::remember(self::ck('avg_game_rank', $puuid), config('riot.cache_ttl.summoner'), function () use ($puuid, $matchCount) {
            $rows = $this->seasonStatRecords($puuid)->take($matchCount);
            if ($rows->isEmpty()) return null;

            // Rakip puuid'lerini topla (oyuncunun takımı hariç) — kompakt kadrodan
            $opp = [];
            foreach ($rows as $row) {
                $p = $row->stat_json['p'] ?? null;
                $roster = $row->stat_json['roster'] ?? null;
                if (!$p || !$roster) continue;
                $myTeam = $p['teamId'] ?? null;
                if ($myTeam === null) continue;
                foreach ($roster as $rp) {
                    if (($rp['teamId'] ?? null) !== $myTeam && !empty($rp['puuid'])) {
                        $opp[$rp['puuid']] = true;
                    }
                }
            }
            // Rate-limit bütçesi düşük tutuldu (mevcut API key). Tüm sonuç cache'lenir →
            // profil başına tek sefer hesaplanır; gerisi gerçek key + worker ile.
            $oppPuuids = array_slice(array_keys($opp), 0, 15);

            $sum = 0; $count = 0;
            foreach ($oppPuuids as $pid) {
                try {
                    $solo = $this->league->getRankedInfo($pid)['solo'] ?? null;
                    if ($solo && isset($solo['tier'], $solo['rank'], $solo['lp'])) {
                        $sum += $this->rankToAbsolute($solo['tier'], $solo['rank'], $solo['lp']);
                        $count++;
                    }
                } catch (\Exception $e) {
                    if ($e->getCode() === 429) break; // rate limit → elimizdekiyle yetin
                }
            }
            if ($count === 0) return null;

            $disp = $this->absoluteToDisplay((int) round($sum / $count));
            return ['tier' => $disp['tier'], 'rank' => $disp['rank'], 'lp' => $disp['lp'], 'sampleSize' => $count];
        });
    }

    /**
     * Sezon boyunca oynanmış ranked maçlardan koridor istatistikleri.
     */
    public function getSeasonRoleStats(string $puuid): array
    {
        $cacheKey = self::ck('season_roles', $puuid);

        return Cache::remember($cacheKey, config('riot.cache_ttl.summoner'), function () use ($puuid) {
            $queues = [
                420 => 'solo',
                440 => 'flex',
                400 => 'normal',
                430 => 'normal',
                490 => 'normal',
            ];

            $result = ['all' => [], 'solo' => [], 'flex' => [], 'normal' => []];
            $rawByKey = ['solo' => [], 'flex' => [], 'normal' => []];

            foreach ($this->seasonStatRecords($puuid, array_keys($queues)) as $row) {
                $queueKey = $queues[$row->queue_id] ?? null;
                if (!$queueKey) continue;
                $p = $row->stat_json['p'] ?? null;
                if (!$p) continue;

                $role = ($p['teamPosition'] ?? '') ?: ($p['individualPosition'] ?? '') ?: '';
                if (!$role) continue;
                if ($role === 'BOT') $role = 'BOTTOM';
                if (!isset($rawByKey[$queueKey][$role])) $rawByKey[$queueKey][$role] = ['games' => 0, 'wins' => 0];
                $rawByKey[$queueKey][$role]['games']++;
                if (!empty($p['win'])) $rawByKey[$queueKey][$role]['wins']++;
            }

            // Her kuyruk tipi için sıralı dizi oluştur
            foreach (['solo', 'flex', 'normal'] as $queueKey) {
                $roleData = $rawByKey[$queueKey];
                arsort($roleData);
                $sorted = [];
                foreach ($roleData as $key => $rd) {
                    $sorted[] = [
                        'role'    => $key,
                        'label'   => self::ROLE_LABELS[$key] ?? $key,
                        'icon'    => '/roles/' . (self::ROLE_ICONS[$key] ?? strtolower($key)) . '.webp',
                        'games'   => $rd['games'],
                        'wins'    => $rd['wins'],
                        'losses'  => $rd['games'] - $rd['wins'],
                        'winRate' => $rd['games'] > 0 ? round($rd['wins'] / $rd['games'] * 100, 1) : 0,
                    ];
                }
                $result[$queueKey] = $sorted;
            }

            // "all" = solo + flex + normal birleşik
            $allData = [];
            foreach (['solo', 'flex', 'normal'] as $q) {
                foreach ($result[$q] as $r) {
                    $key = $r['role'];
                    if (!isset($allData[$key])) $allData[$key] = ['games' => 0, 'wins' => 0, 'role' => $key, 'label' => $r['label'], 'icon' => $r['icon']];
                    $allData[$key]['games'] += $r['games'];
                    $allData[$key]['wins'] += $r['wins'];
                }
            }
            usort($allData, fn($a, $b) => $b['games'] <=> $a['games']);
            $result['all'] = array_map(fn($r) => [
                ...$r,
                'losses'  => $r['games'] - $r['wins'],
                'winRate' => $r['games'] > 0 ? round($r['wins'] / $r['games'] * 100, 1) : 0,
            ], array_values($allData));

            // Main role tespiti
            $result['mainRole'] = $this->detectMainRole($result['all']);

            return $result;
        });
    }

    /**
     * Sezon boyunca ranked winrate geçmişi — solo ve flex ayrı.
     */
    public function getWinrateTimeline(string $puuid): array
    {
        $cacheKey = self::ck('winrate_timeline', $puuid);

        return Cache::remember($cacheKey, config('riot.cache_ttl.summoner'), function () use ($puuid) {
            $result = ['solo' => null, 'flex' => null];

            foreach ([420 => 'solo', 440 => 'flex'] as $queueId => $key) {
                $matches = [];
                foreach ($this->seasonStatRecords($puuid, [$queueId]) as $row) {
                    $p = $row->stat_json['p'] ?? null;
                    if (!$p) continue;
                    if (($row->stat_json['gameDuration'] ?? 0) < 300) continue;
                    $matches[] = [
                        'time' => $row->game_creation,
                        'win'  => $p['win'],
                    ];
                }

                usort($matches, fn($a, $b) => $a['time'] <=> $b['time']);

                $wins = 0;
                $total = 0;
                $timeline = [];
                foreach ($matches as $m) {
                    $total++;
                    if ($m['win']) $wins++;
                    $timeline[] = [
                        'game'      => $total,
                        'winRate'   => round($wins / $total * 100, 1),
                        'date'      => date('d M', (int) ($m['time'] / 1000)),
                        'timestamp' => $m['time'],
                    ];
                }

                $result[$key] = [
                    'timeline' => $timeline,
                    'wins'     => $wins,
                    'losses'   => $total - $wins,
                    'games'    => $total,
                    'winRate'  => $total > 0 ? round($wins / $total * 100, 1) : 0,
                ];
            }

            return $result;
        });
    }

    /**
     * LP yükseliş/azalış zaman serisi (Pro tasarım — profil sol kutusu).
     *
     * DİKKAT — TAHMİNİ: lp_snapshots seyrek ve timestamp'siz olduğundan gerçek
     * maç-bazlı LP geçmişi yok. Bunun yerine eğriyi şöyle kuruyoruz:
     *   - Bitiş noktası GERÇEK (oyuncunun şu anki LP'si).
     *   - Şekil GERÇEK (sezonun gerçek galibiyet/mağlubiyet dizisi).
     *   - Büyüklük TAHMİNİ (maç başına ~+20 galibiyet / -18 mağlubiyet).
     * Geriye doğru demirleme: son maç = şu anki LP, oradan geriye yürünür.
     * Worker periyodik gerçek snapshot toplamaya başlayınca bu gerçek veriyle
     * değiştirilecek. `estimated: true` ile işaretlenir.
     *
     * Maç detayları buildFullResponse'ta preload edildiği için 0 ekstra API isteği.
     */
    public function getLpTimeline(string $puuid, array $ranked): array
    {
        $soloKey = ($ranked['solo']['tier'] ?? '') . ($ranked['solo']['rank'] ?? '') . ($ranked['solo']['lp'] ?? '');
        $flexKey = ($ranked['flex']['tier'] ?? '') . ($ranked['flex']['rank'] ?? '') . ($ranked['flex']['lp'] ?? '');
        $cacheKey = self::ck('lp_timeline', $puuid) . ":{$soloKey}:{$flexKey}";

        return Cache::remember($cacheKey, config('riot.cache_ttl.summoner'), function () use ($puuid, $ranked) {
            $result = ['solo' => null, 'flex' => null];
            $deltaWin = 20;
            $deltaLoss = 18;

            // Worker'ın LP'sini organik takip ettiği hesap mı? (6 takip hesabı → gerçek snapshot
            // birikir → "organik"; diğerleri maç dizisinden tahmin → "tahmini" damgası.)
            $isTracked = \App\Models\TrackedPlayer::where('puuid', $puuid)->exists();

            foreach ([420 => 'solo', 440 => 'flex'] as $queueId => $key) {
                $cur = $ranked[$key] ?? null;
                if (!$cur || !isset($cur['tier'], $cur['rank'], $cur['lp'])) continue;

                // Kronolojik galibiyet/mağlubiyet listesi (sadece tamamlanmış maçlar)
                $games = [];
                foreach ($this->seasonStatRecords($puuid, [$queueId]) as $row) {
                    $p = $row->stat_json['p'] ?? null;
                    if (!$p) continue;
                    if (($row->stat_json['gameDuration'] ?? 0) < 300) continue;
                    $games[] = ['time' => $row->game_creation, 'win' => $p['win'], 'matchId' => $row->match_id];
                }
                if (count($games) < 2) continue;
                usort($games, fn($a, $b) => $a['time'] <=> $b['time']); // eski → yeni

                $n = count($games);
                $curAbs = $this->rankToAbsolute($cur['tier'], $cur['rank'], $cur['lp']);

                // GERÇEK snapshot LP'leri (match_id => mutlak LP) — varsa demir nokta.
                // Riot maç-başı LP vermez; yalnız bu snapshot anlarında gerçek LP biliyoruz.
                $queueName = $queueId === 420 ? 'RANKED_SOLO_5x5' : 'RANKED_FLEX_SR';
                $realByMatch = [];
                $peakCands = [['abs' => $curAbs, 'tier' => $cur['tier']]]; // mevcut LP de bir peak adayı
                foreach (LpSnapshot::where('puuid', $puuid)->where('queue', $queueName)->get() as $sn) {
                    $a = $this->rankToAbsolute($sn->tier, $sn->rank, $sn->lp);
                    $realByMatch[$sn->match_id] = $a;
                    $peakCands[] = ['abs' => $a, 'tier' => $sn->tier];
                }

                // Demir noktalar: gerçek snapshot olan maçlar + en yeni maç (şu anki gerçek LP).
                // Aradaki noktalar gerçek galip/mağlup dizisinden tahmin (±~LP) edilir.
                $abs = array_fill(0, $n, null);
                $anchored = array_fill(0, $n, false);
                $realCount = 0;
                foreach ($games as $i => $g) {
                    if (isset($realByMatch[$g['matchId']])) {
                        $abs[$i] = $realByMatch[$g['matchId']];
                        $anchored[$i] = true;
                        $realCount++;
                    }
                }
                $abs[$n - 1] = $curAbs;       // en yeni maç = gerçek mevcut LP
                $anchored[$n - 1] = true;

                // Demir noktaları koruyarak aradakileri geriye doğru tahmini doldur
                for ($i = $n - 1; $i >= 1; $i--) {
                    if ($anchored[$i - 1]) continue;
                    $delta = $games[$i]['win'] ? $deltaWin : -$deltaLoss;
                    $abs[$i - 1] = max(0, ($abs[$i] ?? $curAbs) - $delta);
                }

                // Peak: gerçek snapshot'lar + mevcut LP'den en yükseği. Master+ tier korunur
                // (aynı LP'de Challenger > GM > Master) → Challenger peak'i Master sanmaz.
                $tierPrio = ['CHALLENGER' => 3, 'GRANDMASTER' => 2, 'MASTER' => 1];
                usort($peakCands, fn ($a, $b) => ($b['abs'] <=> $a['abs'])
                    ?: (($tierPrio[strtoupper($b['tier'])] ?? 0) <=> ($tierPrio[strtoupper($a['tier'])] ?? 0)));
                $peakAbs = $peakCands[0]['abs'];
                $peakDisp = $this->absoluteToDisplay($peakAbs, $peakCands[0]['tier']);

                $timeline = [];
                foreach ($games as $i => $g) {
                    $d = $this->absoluteToDisplay($abs[$i], $cur['tier']);
                    $timeline[] = [
                        'game'      => $i + 1,
                        'lp'        => $abs[$i],          // mutlak LP (grafik ekseni)
                        'tier'      => $d['tier'],
                        'rank'      => $d['rank'],
                        'divLp'     => $d['lp'],           // bölüm içi LP (tooltip)
                        'date'      => date('d M', (int) ($g['time'] / 1000)),
                        'timestamp' => $g['time'],
                    ];
                }

                // "Tümü" sezon başını göstersin diye tüm sezon (max 300 nokta; peak tüm seriden).
                if (count($timeline) > 300) $timeline = array_slice($timeline, -300);

                $result[$key] = [
                    'timeline'  => $timeline,
                    'peak'      => ['lp' => $peakAbs, 'tier' => $peakDisp['tier'], 'rank' => $peakDisp['rank'], 'divLp' => $peakDisp['lp']],
                    // Aradaki noktalar tahmin edildiyse işaretle (gerçek snapshot azsa true).
                    'estimated' => $realCount < $n,
                    'realPoints' => $realCount,
                    // Takip hesabı → worker organik LP topluyor (damga "organik"); değilse "tahmini".
                    'tracked'   => $isTracked,
                ];
            }

            return $result;
        });
    }

    /**
     * Tier+rank+LP → mutlak sayı (LP eğrisi için). Iron IV 0LP = 0.
     */
    private function rankToAbsolute(string $tier, string $rank, int $lp): int
    {
        $tiers = ['IRON' => 0, 'BRONZE' => 400, 'SILVER' => 800, 'GOLD' => 1200, 'PLATINUM' => 1600, 'EMERALD' => 2000, 'DIAMOND' => 2400, 'MASTER' => 2800, 'GRANDMASTER' => 2800, 'CHALLENGER' => 2800];
        $ranks = ['IV' => 0, 'III' => 100, 'II' => 200, 'I' => 300];
        $base = $tiers[strtoupper($tier)] ?? 0;
        if (in_array(strtoupper($tier), ['MASTER', 'GRANDMASTER', 'CHALLENGER'])) {
            return $base + $lp;
        }
        return $base + ($ranks[$rank] ?? 0) + $lp;
    }

    /**
     * Mutlak LP → tier/rank/bölüm-LP (eğri noktalarını etikete çevirmek için).
     */
    private function absoluteToDisplay(int $abs, ?string $masterTier = null): array
    {
        if ($abs >= 2800) {
            // Master/GM/Challenger aynı LP ölçeğini paylaşır (taban 2800) → LP'den ayırt
            // edilemez. Gerçek tier verildiyse onu kullan (peak Challenger ise Challenger).
            $mt = strtoupper($masterTier ?? '');
            $tier = in_array($mt, ['MASTER', 'GRANDMASTER', 'CHALLENGER'], true) ? $mt : 'MASTER';

            return ['tier' => $tier, 'rank' => '', 'lp' => $abs - 2800];
        }
        $order = ['IRON' => 0, 'BRONZE' => 400, 'SILVER' => 800, 'GOLD' => 1200, 'PLATINUM' => 1600, 'EMERALD' => 2000, 'DIAMOND' => 2400];
        $tier = 'IRON';
        $base = 0;
        foreach ($order as $t => $b) {
            if ($abs >= $b) { $tier = $t; $base = $b; }
        }
        $within = $abs - $base;            // 0..399
        $divIdx = min(3, intdiv($within, 100)); // 0..3
        $rankNames = ['IV', 'III', 'II', 'I'];
        return ['tier' => $tier, 'rank' => $rankNames[$divIdx], 'lp' => $within - $divIdx * 100];
    }

    /**
     * Sezon boyunca oynanmış maçlardan şampiyon istatistikleri.
     */
    public function getSeasonChampionStats(string $puuid): array
    {
        $cacheKey = self::ck('season_champs', $puuid);

        return Cache::remember($cacheKey, config('riot.cache_ttl.summoner'), function () use ($puuid) {
            // Queue → bucket. solo/flex AYRI tutulur; 'ranked' ve 'all' sonradan birleştirilir.
            $queues = [
                420 => 'solo',
                440 => 'flex',
                400 => 'normal',
                430 => 'normal',
                490 => 'normal',
            ];

            $emptyChamp = [
                'games' => 0,
                'wins' => 0,
                'kills' => 0,
                'deaths' => 0,
                'assists' => 0,
                'cs' => 0,
                'gold' => 0,
                'duration' => 0,
                'pentaKills' => 0,
                'quadraKills' => 0,
                'tripleKills' => 0,
                'doubleKills' => 0,
            ];

            $rawByType = ['solo' => [], 'flex' => [], 'normal' => []];

            foreach ($this->seasonStatRecords($puuid, array_keys($queues)) as $row) {
                $type = $queues[$row->queue_id] ?? null;
                if (!$type) continue;
                $p = $row->stat_json['p'] ?? null;
                if (!$p) continue;

                $gameDuration = $row->stat_json['gameDuration'] ?? 0;
                if ($gameDuration < 300) continue;

                $name = $p['championName'];
                if (!isset($rawByType[$type][$name])) {
                    $rawByType[$type][$name] = $emptyChamp;
                }
                $rawByType[$type][$name]['games']++;
                if (!empty($p['win'])) $rawByType[$type][$name]['wins']++;
                $rawByType[$type][$name]['kills']       += $p['kills'];
                $rawByType[$type][$name]['deaths']      += $p['deaths'];
                $rawByType[$type][$name]['assists']     += $p['assists'];
                $rawByType[$type][$name]['cs']          += ($p['totalMinionsKilled'] ?? 0) + ($p['neutralMinionsKilled'] ?? 0);
                $rawByType[$type][$name]['gold']        += $p['goldEarned'] ?? 0;
                $rawByType[$type][$name]['duration']    += $gameDuration;
                $rawByType[$type][$name]['pentaKills']  += $p['pentaKills'] ?? 0;
                $rawByType[$type][$name]['quadraKills'] += $p['quadraKills'] ?? 0;
                $rawByType[$type][$name]['tripleKills'] += $p['tripleKills'] ?? 0;
                $rawByType[$type][$name]['doubleKills'] += $p['doubleKills'] ?? 0;
            }

            // Bucket birleştirme: ranked = solo+flex; all = solo+flex+normal
            $merge = function (array $types) use ($emptyChamp, $rawByType) {
                $out = [];
                foreach ($types as $type) {
                    foreach ($rawByType[$type] as $name => $d) {
                        if (!isset($out[$name])) {
                            $out[$name] = $emptyChamp;
                        }
                        foreach (array_keys($emptyChamp) as $field) {
                            $out[$name][$field] += $d[$field];
                        }
                    }
                }
                return $out;
            };

            $buckets = [
                'all'    => $merge(['solo', 'flex', 'normal']),
                'ranked' => $merge(['solo', 'flex']),
                'solo'   => $rawByType['solo'],
                'flex'   => $rawByType['flex'],
                'normal' => $rawByType['normal'],
            ];

            $result = [];
            foreach ($buckets as $key => $champData) {
                uasort($champData, fn($a, $b) => $b['games'] <=> $a['games']);
                $list = [];
                foreach ($champData as $name => $d) {
                    $g = $d['games'];
                    $avgDuration = $g > 0 ? $d['duration'] / $g : 0;
                    $durationMinutes = $d['duration'] / 60;
                    $list[] = [
                        'championName'  => $name,
                        'championImage' => $this->ddragon->championIconUrl($name),
                        'games'         => $g,
                        'wins'          => $d['wins'],
                        'losses'        => $g - $d['wins'],
                        'winRate'       => $g > 0 ? round($d['wins'] / $g * 100, 1) : 0,
                        'avgKda'        => [
                            'kills'   => round($d['kills'] / $g, 1),
                            'deaths'  => round($d['deaths'] / $g, 1),
                            'assists' => round($d['assists'] / $g, 1),
                            'ratio'   => $d['deaths'] > 0
                                ? round(($d['kills'] + $d['assists']) / $d['deaths'], 2)
                                : 'Perfect',
                        ],
                        'avgDuration'   => round($avgDuration / 60, 1),
                        'csPerMin'      => $durationMinutes > 0 ? round($d['cs'] / $durationMinutes, 1) : 0,
                        'goldPerMin'    => $durationMinutes > 0 ? round($d['gold'] / $durationMinutes) : 0,
                        'totalCs'       => $d['cs'],
                        'totalGold'     => $d['gold'],
                        'pentaKills'    => $d['pentaKills'],
                        'quadraKills'   => $d['quadraKills'],
                        'tripleKills'   => $d['tripleKills'],
                        'doubleKills'   => $d['doubleKills'],
                    ];
                }
                $result[$key] = $list;
            }

            return $result;
        });
    }

    /**
     * Sezon kişilik rozetleri (op.gg "Personal Ratings" tarzı).
     * Sezon maçlarını tek geçişte tarayıp davranışsal eğilimleri çıkarır:
     * en sevilen şampiyon, galibiyet/mağlubiyet sonrası WR, taraf tercihi,
     * teslim olma, ilk kan, görüş. Hepsi DB'deki maç detaylarından (0 API isteği).
     *
     * Dönüş: [['key','label','desc','positive'=>bool], ...] (tetiklenenler).
     */
    /** Heal/kalkan özelliklerinde ("Yürüyen Base" / "Bencil İyileştirici")
     *  healer sayılan şampiyonlar (DDragon id). */
    private const HEALER_CHAMPS = [
        'Soraka', 'Sona', 'Yuumi', 'Nami', 'Janna', 'Lulu', 'Milio',
        'Seraphine', 'Karma', 'Taric', 'Rakan', 'Renata', 'Ivern',
    ];

    public function getPersonalityBadges(string $puuid): array
    {
        $cacheKey = self::ck('season_badges', $puuid);

        return Cache::remember($cacheKey, config('riot.cache_ttl.summoner'), function () use ($puuid) {
            $games = [];

            foreach ($this->seasonStatRecords($puuid, [420, 440, 400, 430, 490]) as $row) {
                $p = $row->stat_json['p'] ?? null;
                if (!$p) continue;
                $dur = $row->stat_json['gameDuration'] ?? 0;
                if ($dur < 300) continue;
                $c = $p['challenges'] ?? [];
                $mins = max(1, $dur / 60);
                $games[] = [
                    'champ'      => $p['championName'],
                    'win'        => (bool) $p['win'],
                    'teamId'     => $p['teamId'] ?? 0,
                    'surrender'  => (bool) ($p['gameEndedInSurrender'] ?? false),
                    'firstBlood' => (bool) ($p['firstBloodKill'] ?? false),
                    'visionPm'   => (float) ($c['visionScorePerMinute'] ?? 0),
                    'kills'      => (int) ($p['kills'] ?? 0),
                    'deaths'     => (int) ($p['deaths'] ?? 0),
                    'assists'    => (int) ($p['assists'] ?? 0),
                    'dmgPct'     => (float) ($c['teamDamagePercentage'] ?? 0),
                    'time'       => $row->game_creation,
                    // Oyuncu Özellikleri (vision/heal/KP/CS/objektif) için:
                    'wards'      => (int) ($p['wardsPlaced'] ?? 0),
                    'healPm'     => (float) ($c['effectiveHealAndShielding'] ?? 0) / $mins,
                    'kp'         => (float) ($c['killParticipation'] ?? 0),
                    'cspm'       => (($p['totalMinionsKilled'] ?? 0) + ($p['neutralMinionsKilled'] ?? 0)) / $mins,
                    'pos'        => $p['teamPosition'] ?? '',
                    'obj'        => (float) (($c['baronTakedowns'] ?? 0) + ($c['dragonTakedowns'] ?? 0)),
                    'penta'      => (int) ($p['pentaKills'] ?? 0),
                    'mins'       => $mins,
                ];
            }

            $g = count($games);
            if ($g < 10) return [];

            usort($games, fn($a, $b) => $a['time'] <=> $b['time']);

            $totalWins = 0;
            $champCount = [];
            $blue = ['g' => 0, 'w' => 0];
            $red  = ['g' => 0, 'w' => 0];
            $afterWin = ['g' => 0, 'w' => 0];
            $afterLoss = ['g' => 0, 'w' => 0];
            $surrenderLosses = 0;
            $firstBloods = 0;
            $visionSum = 0;
            $sumK = 0; $sumD = 0; $sumA = 0; $dmgSum = 0;
            $wardSum = 0; $kpSum = 0; $objSum = 0;
            $nonSup = ['g' => 0, 'dmg' => 0, 'cspm' => 0]; // support dışı maçlar (CS/hasar adil olsun)
            $healer = ['g' => 0, 'hpm' => 0];              // healer şampiyon maçları
            $prevWin = null;

            foreach ($games as $gm) {
                if ($gm['win']) $totalWins++;
                $champCount[$gm['champ']] = ($champCount[$gm['champ']] ?? 0) + 1;

                if ($gm['teamId'] === 100) { $blue['g']++; if ($gm['win']) $blue['w']++; }
                elseif ($gm['teamId'] === 200) { $red['g']++; if ($gm['win']) $red['w']++; }

                if ($prevWin === true)  { $afterWin['g']++;  if ($gm['win']) $afterWin['w']++; }
                if ($prevWin === false) { $afterLoss['g']++; if ($gm['win']) $afterLoss['w']++; }
                $prevWin = $gm['win'];

                if (!$gm['win'] && $gm['surrender']) $surrenderLosses++;
                if ($gm['firstBlood']) $firstBloods++;
                $visionSum += $gm['visionPm'];
                $sumK += $gm['kills']; $sumD += $gm['deaths']; $sumA += $gm['assists'];
                $dmgSum += $gm['dmgPct'];
                $wardSum += $gm['wards']; $kpSum += $gm['kp']; $objSum += $gm['obj'];
                if ($gm['pos'] !== '' && $gm['pos'] !== 'UTILITY') {
                    $nonSup['g']++; $nonSup['dmg'] += $gm['dmgPct']; $nonSup['cspm'] += $gm['cspm'];
                }
                if (in_array($gm['champ'], self::HEALER_CHAMPS, true)) {
                    $healer['g']++; $healer['hpm'] += $gm['healPm'];
                }
            }

            $overallWr = $totalWins / $g * 100;
            $losses = $g - $totalWins;
            $badges = [];

            // 1) En sevilen şampiyon
            arsort($champCount);
            $topChamp = array_key_first($champCount);
            $topGames = $champCount[$topChamp] ?? 0;
            if ($topGames >= 15 && $topGames >= $g * 0.2) {
                $badges[] = [
                    'key' => 'champ_lover', 'positive' => true,
                    'label' => "{$topChamp} Sevdalısı",
                    'desc' => "Bu sezon {$topChamp} ile {$topGames} maç oynadı.",
                ];
            }

            // 2) Zincir galibiyet — galibiyet sonrası WR belirgin yüksek
            if ($afterWin['g'] >= 8) {
                $awWr = $afterWin['w'] / $afterWin['g'] * 100;
                $delta = $awWr - $overallWr;
                if ($delta >= 5) {
                    $badges[] = [
                        'key' => 'chain_wins', 'positive' => true,
                        'label' => 'Zincir Galibiyet',
                        'desc' => 'Bir galibiyetin hemen ardından kazanma oranı ortalamadan %' . round($delta) . ' yüksek.',
                    ];
                }
            }

            // 3) Tilt eğilimi — mağlubiyet sonrası WR belirgin düşük (negatif)
            if ($afterLoss['g'] >= 8) {
                $alWr = $afterLoss['w'] / $afterLoss['g'] * 100;
                $delta = $overallWr - $alWr;
                if ($delta >= 8) {
                    $badges[] = [
                        'key' => 'tilt', 'positive' => false,
                        'label' => 'Tilt Eğilimi',
                        'desc' => 'Bir mağlubiyetin ardından kazanma oranı %' . round($delta) . ' düşüyor.',
                    ];
                }
            }

            // 4) Taraf tercihi — kırmızı/mavi WR farkı
            if ($blue['g'] >= 8 && $red['g'] >= 8) {
                $blueWr = $blue['w'] / $blue['g'] * 100;
                $redWr  = $red['w'] / $red['g'] * 100;
                $diff = $redWr - $blueWr;
                if (abs($diff) >= 6) {
                    $side = $diff > 0 ? 'Kırmızı' : 'Mavi';
                    $badges[] = [
                        'key' => 'side_lover', 'positive' => true,
                        'label' => "{$side} Taraf Sevdalısı",
                        'desc' => "{$side} tarafta kazanma oranı %" . round(abs($diff)) . ' daha yüksek.',
                    ];
                }
            }

            // 5) Teslimci — mağlubiyetlerin büyük kısmı teslimle bitiyor (negatif)
            if ($losses >= 10) {
                $rate = $surrenderLosses / $losses;
                if ($rate >= 0.55) {
                    $badges[] = [
                        'key' => 'surrenders', 'positive' => false,
                        'label' => 'Teslimci',
                        'desc' => 'Mağlubiyetlerinin %' . round($rate * 100) . "'inde takım teslim oldu.",
                    ];
                }
            }

            // 6) İlk kan avcısı
            $fbRate = $firstBloods / $g;
            if ($g >= 15 && $fbRate >= 0.22) {
                $badges[] = [
                    'key' => 'first_blood', 'positive' => true,
                    'label' => 'İlk Kan Avcısı',
                    'desc' => 'Maçların %' . round($fbRate * 100) . "'inde ilk kanı aldı.",
                ];
            }

            // 7) Kartograf / Göz Bekçisi — görüş skoru (Kartograf üst seviye, nadir)
            $avgVision = $visionSum / $g;
            if ($g >= 15 && $avgVision >= 2.0) {
                $badges[] = [
                    'key' => 'cartographer', 'positive' => true,
                    'label' => 'Kartograf',
                    'desc' => 'Dakika başına ' . round($avgVision, 1) . ' görüş skoru — harita onun eseri.',
                ];
            } elseif ($g >= 15 && $avgVision >= 1.4) {
                $badges[] = [
                    'key' => 'vision', 'positive' => true,
                    'label' => 'Göz Bekçisi',
                    'desc' => 'Dakika başına ortalama ' . round($avgVision, 1) . ' görüş skoru.',
                ];
            }

            // 8) Sağlam KDA — sezon ortalaması yüksek
            $kdaRatio = $sumD > 0 ? ($sumK + $sumA) / $sumD : ($sumK + $sumA);
            if ($g >= 15 && $kdaRatio >= 3.0) {
                $badges[] = [
                    'key' => 'solid_kda', 'positive' => true,
                    'label' => 'Sağlam KDA',
                    'desc' => 'Sezon ortalaması ' . round($kdaRatio, 2) . ' KDA.',
                ];
            }

            // 9) Hasar lideri — takım hasarının büyük kısmını yapıyor
            $avgDmg = $dmgSum / $g;
            if ($g >= 15 && $avgDmg >= 0.27) {
                $badges[] = [
                    'key' => 'damage_carry', 'positive' => true,
                    'label' => 'Hasar Lideri',
                    'desc' => 'Takım hasarının ortalama %' . round($avgDmg * 100) . "'ini yapıyor.",
                ];
            }

            /* ===== Yeni Oyuncu Özellikleri (2026-06-05) =====
               Eşikler bilinçli SIKI: bu bölüm "gerçekten hak eden almalı" diye
               tasarlandı (maç içi rozetlerden farklı). Negatifler tatlı sataşma
               tonunda ve veriye dayalı — hakaret değil espri. */

            // 10) Yürüyen Totem — maç başına 1'den az ward (10 maçta <10 kuralının oranı)
            $avgWards = $wardSum / $g;
            if ($avgWards < 1.0) {
                $badges[] = [
                    'key' => 'walking_ward', 'positive' => false,
                    'label' => 'Yürüyen Totem',
                    'desc' => 'Maç başına ortalama ' . round($avgWards, 1) . ' ward — haritadaki tek göz kendisi.',
                ];
            }

            // 11) Yürüyen Base / Bencil İyileştirici — healer şampiyonlarda heal+kalkan/dk
            if ($healer['g'] >= 10) {
                $hpm = $healer['hpm'] / $healer['g'];
                if ($hpm >= 600) {
                    $badges[] = [
                        'key' => 'walking_base', 'positive' => true,
                        'label' => 'Yürüyen Base',
                        'desc' => 'Healer maçlarında dakikada ortalama ' . round($hpm) . ' iyileştirme/kalkan.',
                    ];
                } elseif ($hpm > 0 && $hpm < 200) {
                    $badges[] = [
                        'key' => 'selfish_healer', 'positive' => false,
                        'label' => 'Bencil İyileştirici',
                        'desc' => 'Healer oynuyor ama dakikada sadece ' . round($hpm) . ' iyileştirme/kalkan atıyor.',
                    ];
                }
            }

            // 12) Her Fight'ta Var / Turist — kill katılımı
            $avgKp = $kpSum / $g;
            if ($g >= 15 && $avgKp >= 0.72) {
                $badges[] = [
                    'key' => 'every_fight', 'positive' => true,
                    'label' => "Her Fight'ta Var",
                    'desc' => 'Ortalama %' . round($avgKp * 100) . ' kill katılımı.',
                ];
            } elseif ($g >= 15 && $avgKp > 0 && $avgKp < 0.33) {
                $badges[] = [
                    'key' => 'tourist', 'positive' => false,
                    'label' => 'Turist',
                    'desc' => 'Ortalama %' . round($avgKp * 100) . ' kill katılımı — maçları gezmeye geliyor.',
                ];
            }

            // 13) Çiftçi / Vejetaryen + 14) Pasifist — support maçları HARİÇ (adil olsun)
            if ($nonSup['g'] >= 15) {
                $cspm = $nonSup['cspm'] / $nonSup['g'];
                if ($cspm >= 8.0) {
                    $badges[] = [
                        'key' => 'farmer', 'positive' => true,
                        'label' => 'Çiftçi',
                        'desc' => 'Dakikada ortalama ' . round($cspm, 1) . ' CS.',
                    ];
                } elseif ($cspm > 0 && $cspm < 4.0) {
                    $badges[] = [
                        'key' => 'vegetarian', 'positive' => false,
                        'label' => 'Vejetaryen',
                        'desc' => 'Dakikada sadece ' . round($cspm, 1) . ' CS — minyonlar kendisine minnettar.',
                    ];
                }

                $nsDmg = $nonSup['dmg'] / $nonSup['g'];
                if ($nsDmg > 0 && $nsDmg < 0.13) {
                    $badges[] = [
                        'key' => 'pacifist', 'positive' => false,
                        'label' => 'Pasifist',
                        'desc' => 'Hasar payı ortalama %' . round($nsDmg * 100) . ' — barış elçisi.',
                    ];
                }
            }

            // 15) Hayırsever — maç başına çok ölüm
            $avgDeaths = $sumD / $g;
            if ($g >= 15 && $avgDeaths >= 7.5) {
                $badges[] = [
                    'key' => 'philanthropist', 'positive' => false,
                    'label' => 'Hayırsever',
                    'desc' => 'Maç başına ortalama ' . round($avgDeaths, 1) . ' ölüm — rakibe düzenli gold bağışı.',
                ];
            }

            // 16) Objektif Canavarı / Baron da Ne? — baron+ejder katılımı
            $avgObj = $objSum / $g;
            if ($g >= 15 && $avgObj >= 3.5) {
                $badges[] = [
                    'key' => 'objective_beast', 'positive' => true,
                    'label' => 'Objektif Canavarı',
                    'desc' => 'Maç başına ortalama ' . round($avgObj, 1) . ' baron/ejder katılımı.',
                ];
            } elseif ($g >= 15 && $avgObj < 0.7) {
                $badges[] = [
                    'key' => 'baron_who', 'positive' => false,
                    'label' => 'Baron da Ne?',
                    'desc' => 'Maç başına ' . round($avgObj, 1) . ' baron/ejder katılımı — haritanın o köşesini hiç görmedi.',
                ];
            }

            /* ===== Prestij özellikleri — zor kazanılır, "gerçekten hak eden" =====
               Dördü de SON 20 MAÇ penceresinde (güncel form ödüllendirilir).
               $games zamana göre sıralı → son 20 = dilim sonu. */
            $last20 = array_slice($games, -20);

            // 17) Penta Koleksiyoncusu — son 20 maçta 2+ pentakill
            $penta20 = array_sum(array_column($last20, 'penta'));
            if ($penta20 >= 2) {
                $badges[] = [
                    'key' => 'penta_collector', 'positive' => true,
                    'label' => 'Penta Koleksiyoncusu',
                    'desc' => "Son 20 maçta {$penta20} pentakill.",
                ];
            }

            // 18) Kusursuz — son 20 maçta 3+ kez 0 ölümle galibiyet
            $perfect20 = count(array_filter($last20, fn($x) => $x['deaths'] === 0 && $x['win']));
            if ($perfect20 >= 3) {
                $badges[] = [
                    'key' => 'flawless', 'positive' => true,
                    'label' => 'Kusursuz',
                    'desc' => "Son 20 maçta {$perfect20} kez hiç ölmeden kazandı.",
                ];
            }

            // 19) Solo Carry — son 20 maçta %35+ takım hasarı VE %70+ KP ile 5+ galibiyet
            $carry20 = count(array_filter(
                $last20,
                fn($x) => $x['win'] && $x['dmgPct'] >= 0.35 && $x['kp'] >= 0.70
            ));
            if ($carry20 >= 5) {
                $badges[] = [
                    'key' => 'solo_carry', 'positive' => true,
                    'label' => 'Solo Carry',
                    'desc' => "Son 20 maçta %35+ takım hasarı ve %70+ kill katılımıyla {$carry20} galibiyet.",
                ];
            }

            // 20) Maraton Savaşçısı — son 20 maçtaki 40dk+ maçlarda (5+) %60+ galibiyet
            $long20 = array_filter($last20, fn($x) => $x['mins'] >= 40);
            if (count($long20) >= 5) {
                $longWins = count(array_filter($long20, fn($x) => $x['win']));
                $mwr = $longWins / count($long20) * 100;
                if ($mwr >= 60) {
                    $badges[] = [
                        'key' => 'marathon', 'positive' => true,
                        'label' => 'Maraton Savaşçısı',
                        'desc' => 'Son 20 maçın 40dk+ olan ' . count($long20) . " tanesinde %" . round($mwr) . ' galibiyet.',
                    ];
                }
            }

            // Pozitifler önce, en fazla 8 özellik
            usort($badges, fn($a, $b) => ($b['positive'] <=> $a['positive']));
            return array_slice($badges, 0, 8);
        });
    }

    /**
     * Son maçlardan istatistik hesapla.
     */
    public function calculateRecentStats(array $matches, string $puuid): array
    {
        // Remake maçları (5 dakikadan kısa) istatistiklere dahil edilmez
        $matches = array_values(array_filter(
            $matches,
            fn($m) => ($m['duration'] ?? $m['gameDuration'] ?? 0) >= 300
        ));

        if (empty($matches)) {
            return [
                'mostPlayedChampion' => null,
                'avgKDA' => ['kills' => 0, 'deaths' => 0, 'assists' => 0, 'ratio' => 0],
                'winRate' => 0,
                'wins' => 0,
                'losses' => 0,
                'totalGames' => 0,
            ];
        }

        $totalGames = count($matches);
        $wins = count(array_filter($matches, fn($m) => $m['win']));
        $totalKills = array_sum(array_column($matches, 'kills'));
        $totalDeaths = array_sum(array_column($matches, 'deaths'));
        $totalAssists = array_sum(array_column($matches, 'assists'));

        // En çok oynanan şampiyon
        $champCounts = [];
        foreach ($matches as $m) {
            $name = $m['champion']['name'];
            $champCounts[$name] = ($champCounts[$name] ?? 0) + 1;
        }
        arsort($champCounts);
        $topChampName = array_key_first($champCounts);

        // Rol analizi
        $roleData = [];
        foreach ($matches as $m) {
            $role = $m['role'] ?? '';
            if (!$role) continue;
            if (!isset($roleData[$role])) $roleData[$role] = ['games' => 0, 'wins' => 0];
            $roleData[$role]['games']++;
            if ($m['win']) $roleData[$role]['wins']++;
        }

        // Rol istatistikleri
        $roleStats = [];
        arsort($roleData);
        foreach ($roleData as $key => $rd) {
            $roleStats[] = [
                'role'    => $key,
                'label'   => self::ROLE_LABELS[$key] ?? $key,
                'icon'    => '/roles/' . (self::ROLE_ICONS[$key] ?? strtolower($key)) . '.webp',
                'games'   => $rd['games'],
                'wins'    => $rd['wins'],
                'losses'  => $rd['games'] - $rd['wins'],
                'winRate' => $rd['games'] > 0 ? round($rd['wins'] / $rd['games'] * 100, 1) : 0,
            ];
        }

        // Main role tespiti
        $mainRole = $this->detectMainRole($roleStats);

        // Sık alınan rozetler
        $badgeCounts = [];
        foreach ($matches as $m) {
            foreach ($m['badges'] ?? [] as $b) {
                $key = $b['key'];
                if (!isset($badgeCounts[$key])) {
                    $badgeCounts[$key] = ['count' => 0, 'label' => $b['label'], 'desc' => $b['desc'], 'category' => $b['category'], 'tier' => $b['tier']];
                }
                $badgeCounts[$key]['count']++;
                if ($b['tier'] === 'gold') $badgeCounts[$key]['tier'] = 'gold';
            }
        }
        uasort($badgeCounts, fn($a, $b) => $b['count'] <=> $a['count']);
        $frequentBadges = [];
        foreach ($badgeCounts as $key => $bc) {
            if ($bc['count'] < 2) continue;
            $frequentBadges[] = [
                'key'      => $key,
                'label'    => $bc['label'],
                'category' => $bc['category'],
                'tier'     => $bc['tier'],
                'count'    => $bc['count'],
                'rate'     => round($bc['count'] / $totalGames * 100),
            ];
        }

        // Negatif rozetler — kayıp serisi, kötü şampiyon WR
        $this->addNegativeProfileBadges($frequentBadges, $matches, $totalGames);

        return [
            'mostPlayedChampion' => [
                'id'    => $topChampName,
                'name'  => $topChampName,
                'image' => $this->ddragon->championIconUrl($topChampName),
                'games' => $champCounts[$topChampName],
            ],
            'avgKDA' => [
                'kills'   => round($totalKills / $totalGames, 1),
                'deaths'  => round($totalDeaths / $totalGames, 1),
                'assists' => round($totalAssists / $totalGames, 1),
                'ratio'   => $totalDeaths > 0
                    ? round(($totalKills + $totalAssists) / $totalDeaths, 2)
                    : 'Perfect',
            ],
            'winRate'    => round($wins / $totalGames * 100, 1),
            'wins'       => $wins,
            'losses'     => $totalGames - $wins,
            'totalGames' => $totalGames,
            'mainRole'   => $mainRole,
            'roleStats'  => $roleStats,
            'frequentBadges' => array_slice($frequentBadges, 0, 10),
        ];
    }

    /**
     * Profil-seviyesi negatif rozetler.
     * Kayıp serisi, belirli şampiyonla kötü WR gibi.
     */
    private function addNegativeProfileBadges(array &$badges, array $matches, int $totalGames): void
    {
        // 1) Kayıp Serisi — Mevcut kayıp serisini hesapla (en sondan başlayarak)
        $currentLoseStreak = 0;
        for ($i = 0; $i < count($matches); $i++) {
            if (!$matches[$i]['win']) {
                $currentLoseStreak++;
            } else {
                break;
            }
        }
        if ($currentLoseStreak >= 3) {
            $badges[] = [
                'key'      => 'lose_streak',
                'label'    => 'Kayıp Serisi',
                'category' => 'negative',
                'tier'     => 'silver',
                'count'    => $currentLoseStreak,
                'rate'     => round($currentLoseStreak / $totalGames * 100),
            ];
        }

        // 2) Kötü Şampiyon WR — Belirli bir şampiyonla %35 altı WR (en az 3 maç)
        $champStats = [];
        foreach ($matches as $m) {
            $name = $m['champion']['name'] ?? '';
            if (!$name) continue;
            if (!isset($champStats[$name])) $champStats[$name] = ['games' => 0, 'wins' => 0];
            $champStats[$name]['games']++;
            if ($m['win']) $champStats[$name]['wins']++;
        }
        foreach ($champStats as $name => $stat) {
            if ($stat['games'] >= 3) {
                $wr = round($stat['wins'] / $stat['games'] * 100);
                if ($wr <= 35) {
                    $badges[] = [
                        'key'      => 'bad_champ_' . strtolower(preg_replace('/[^a-zA-Z]/', '', $name)),
                        'label'    => $name . ' ile Kötü',
                        'category' => 'negative',
                        'tier'     => 'silver',
                        'count'    => $stat['games'],
                        'rate'     => $wr,
                    ];
                }
            }
        }
    }

    // Support oynarken anlamsız olan laning metrikleri
    private const LANING_METRICS = [
        'laneMinionsFirst10Minutes',
        'maxCsAdvantageOnLaneOpponent',
        'soloKills',
        'turretPlatesTaken',
    ];

    /**
     * Sezon maçlarından challenge ortalamalarını hesapla (DB-only, 0 API isteği).
     * Support maçlarında laning metrikleri (CS, solo kill, plaka) hariç tutulur.
     */
    public function getChallengeAverages(string $puuid): array
    {
        $cacheKey = self::ck('challenge_avgs', $puuid);

        return Cache::remember($cacheKey, config('riot.cache_ttl.summoner'), function () use ($puuid) {
            // Summoner's Rift queue'ları — Arena/ARAM/Bot/özel modları hariç
            $allowedQueues = [400, 420, 430, 440];

            $totals = [];
            $counts = []; // Metrik başına ayrı sayaç (support filtrelemesi için)

            foreach ($this->seasonStatRecords($puuid, $allowedQueues) as $row) {
                $p = $row->stat_json['p'] ?? null;
                if (!$p) continue;
                if (($row->stat_json['gameDuration'] ?? 0) < 300) continue;

                $role = $p['teamPosition'] ?? '';
                $isSupport = ($role === 'UTILITY');

                // NOT: firstBloodKill artık extractMatchData'da ham participant top-düzeyinden
                // doğru doldurulup slim challenges'a yazılıyor; burada challenges'tan okunması yeterli.
                // (Eski slim kayıtlarda bu değer false — yeniden işlenince/yeni maçlarda düzelir.)
                $ch = $p['challenges'] ?? [];
                foreach ($ch as $key => $val) {
                    if (!is_numeric($val) && !is_bool($val)) continue;

                    // Support maçlarında laning metriklerini hariç tut
                    if ($isSupport && in_array($key, self::LANING_METRICS, true)) continue;

                    $totals[$key] = ($totals[$key] ?? 0) + (is_bool($val) ? ($val ? 1 : 0) : $val);
                    $counts[$key] = ($counts[$key] ?? 0) + 1;
                }
            }

            if (empty($counts)) return ['averages' => [], 'totalGames' => 0];

            $averages = [];
            foreach ($totals as $key => $total) {
                $averages[$key] = round($total / $counts[$key], 2);
            }

            $totalGames = max($counts);

            return ['averages' => $averages, 'totalGames' => $totalGames];
        });
    }

    /**
     * Sezon maçlarından duo partner tespiti (DB-only, 0 API isteği).
     *
     * Sadece Solo/Duo queue (420). Frekans eşiği:
     * - Minimum 2 maçta aynı takımda olma
     * - Toplam maç sayısının %5'inden fazla aynı takımda olma (yüksek elo filtresi)
     */
    public function getDuoPartners(string $puuid): array
    {
        $cacheKey = self::ck('duo_partners', $puuid);

        return Cache::remember($cacheKey, config('riot.cache_ttl.summoner'), function () use ($puuid) {
            // Summoner's Rift queue'ları — Arena, ARAM, Bot ve özel modları hariç tut
            $allowedQueues = [400, 420, 430, 440];

            $totalMatches = 0;
            $teammates = [];

            foreach ($this->seasonStatRecords($puuid, $allowedQueues) as $row) {
                if (($row->stat_json['gameDuration'] ?? 0) < 300) continue;
                $p = $row->stat_json['p'] ?? null;
                $roster = $row->stat_json['roster'] ?? null;
                if (!$p || !$roster) continue;

                $gameCreation = $row->game_creation;
                $totalMatches++;

                $myTeamId = $p['teamId'] ?? null;
                $myWin = (bool) ($p['win'] ?? false);
                if (!$myTeamId) continue;

                foreach ($roster as $rp) {
                    if (($rp['puuid'] ?? '') === $puuid) continue;
                    if (($rp['teamId'] ?? null) !== $myTeamId) continue;

                    $pid = $rp['puuid'] ?? '';
                    if (!$pid || str_starts_with($pid, 'BOT')) continue;

                    $name = ($rp['gameName'] ?? '') ?: '?';
                    if (!isset($teammates[$pid])) {
                        $teammates[$pid] = [
                            'puuid'       => $pid,
                            'gameName'    => $name,
                            'tagLine'     => $rp['tagLine'] ?? '',
                            'profileIcon' => $rp['profileIcon'] ?? 0,
                            'games'       => 0,
                            'wins'        => 0,
                            'losses'      => 0,
                            'lastPlayed'  => 0,
                            'champions'   => [],
                        ];
                    }

                    $teammates[$pid]['games']++;
                    $myWin ? $teammates[$pid]['wins']++ : $teammates[$pid]['losses']++;

                    if ($gameCreation > $teammates[$pid]['lastPlayed']) {
                        $teammates[$pid]['lastPlayed'] = $gameCreation;
                        $teammates[$pid]['gameName'] = $name;
                        $teammates[$pid]['tagLine'] = $rp['tagLine'] ?? '';
                        $teammates[$pid]['profileIcon'] = $rp['profileIcon'] ?? $teammates[$pid]['profileIcon'];
                    }

                    $champName = $rp['championName'] ?? '';
                    if ($champName && !in_array($champName, $teammates[$pid]['champions'])) {
                        $teammates[$pid]['champions'][] = $champName;
                    }
                }
            }

            if ($totalMatches === 0) return [];

            // Frekans eşiği: minimum 2 maç VE toplam maçların %5'inden fazla
            $threshold = max(2, (int) ceil($totalMatches * 0.05));
            $duos = array_filter($teammates, fn($t) => $t['games'] >= $threshold);
            usort($duos, fn($a, $b) => $b['games'] <=> $a['games']);

            $result = [];
            foreach (array_slice(array_values($duos), 0, 10) as $duo) {
                $duo['winRate'] = $duo['games'] > 0 ? round($duo['wins'] / $duo['games'] * 100, 1) : 0;
                $duo['profileIconUrl'] = $this->ddragon->profileIconUrl($duo['profileIcon']);
                $duo['championImages'] = array_map(
                    fn($name) => $this->ddragon->championIconUrl($name),
                    array_slice($duo['champions'], 0, 3)
                );
                unset($duo['profileIcon']);
                $result[] = $duo;
            }

            return $result;
        });
    }

    /**
     * Rol listesinden main role tespiti.
     */
    private function detectMainRole(array $roleStats): ?string
    {
        if (empty($roleStats)) return null;

        // games alanına göre sırala (zaten sıralı olabilir ama garanti edelim)
        usort($roleStats, fn($a, $b) => $b['games'] <=> $a['games']);

        $mainRole = null;
        if (count($roleStats) >= 2) {
            $first  = $roleStats[0]['games'];
            $second = $roleStats[1]['games'];
            if ($second >= $first * 0.6) {
                $mainRole = $roleStats[0]['label'] . '/' . $roleStats[1]['label'] . ' Main';
            } else {
                $mainRole = $roleStats[0]['label'] . ' Main';
            }
        } elseif (count($roleStats) === 1) {
            $mainRole = $roleStats[0]['label'] . ' Main';
        }

        if (count($roleStats) >= 4) {
            $vals = array_column($roleStats, 'games');
            if ($vals[0] - end($vals) <= 1) {
                $mainRole = 'Fill';
            }
        }

        return $mainRole;
    }
}
