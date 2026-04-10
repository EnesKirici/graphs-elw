<?php

namespace App\Services\RiotApi;

use App\Models\MatchRecord;
use App\Models\MatchTimeline;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Riot Match-V5 API veri katmanı — DB-first mimarisi.
 *
 * Maç verileri kalıcı olarak MySQL'de saklanır (maçlar asla değişmez).
 * Akış: DB'de var mı? → Evet: DB'den oku (0 API isteği)
 *                      → Hayır: Riot API'den çek → DB'ye yaz → döndür
 */
class MatchDataService
{
    public const QUEUE_NAMES = [
        420 => 'Solo/Duo',
        440 => 'Flex',
        450 => 'ARAM',
        400 => 'Normal',
        430 => 'Blind',
        490 => 'Quickplay',
        700 => 'Clash',
        900 => 'URF',
        1700 => 'Arena',
    ];

    private const SEASON_START_DAY = '01-08';

    public function __construct(
        private RiotApiService $api,
        private DataDragonService $ddragon,
    ) {}

    public function seasonStartTimestamp(): int
    {
        $year = (int) date('Y');
        $start = strtotime("{$year}-" . self::SEASON_START_DAY);
        if (time() < $start) {
            $start = strtotime(($year - 1) . '-' . self::SEASON_START_DAY);
        }
        return $start;
    }

    /**
     * Son N maçın ID'lerini getir (kısa cache — yeni maç kontrolü için).
     */
    public function getMatchIds(string $puuid, int $count = 20, int $start = 0): array
    {
        $cacheKey = "match:ids:{$puuid}:{$count}:{$start}";

        return Cache::remember($cacheKey, config('riot.cache_ttl.match_ids'), function () use ($puuid, $count, $start) {
            return $this->api->regionRequest(
                "/lol/match/v5/matches/by-puuid/{$puuid}/ids",
                ['count' => $count, 'start' => $start]
            );
        });
    }

    /**
     * Sezon ranked match ID'lerini cache'li çek.
     */
    public function getSeasonMatchIds(string $puuid, int $queueId): array
    {
        $cacheKey = "season_match_ids:v2:{$puuid}:{$queueId}";

        return Cache::remember($cacheKey, config('riot.cache_ttl.match_ids'), function () use ($puuid, $queueId) {
            $seasonStart = $this->seasonStartTimestamp();
            return $this->api->regionRequest(
                "/lol/match/v5/matches/by-puuid/{$puuid}/ids",
                ['startTime' => $seasonStart, 'queue' => $queueId, 'count' => 100]
            );
        });
    }

    /**
     * Tek bir maçın detayını getir — DB-first.
     * DB'de varsa oradan okur (0 API isteği), yoksa API'den çekip DB'ye yazar.
     */
    public function getMatchDetail(string $matchId): array
    {
        // 1. DB'de var mı?
        $match = MatchRecord::find($matchId);
        if ($match) {
            return $match->data;
        }

        // 2. API'den çek
        $response = $this->api->regionRequest("/lol/match/v5/matches/{$matchId}");

        // 3. DB'ye kaydet
        try {
            MatchRecord::create([
                'match_id'      => $matchId,
                'data'          => $response,
                'queue_id'      => $response['info']['queueId'] ?? 0,
                'game_duration' => $response['info']['gameDuration'] ?? 0,
                'game_creation' => $response['info']['gameCreation'] ?? 0,
            ]);
        } catch (\Exception $e) {
            // Duplicate key hatası olabilir (race condition) — görmezden gel
        }

        return $response;
    }

    /**
     * Maç timeline verisi — DB-first.
     * DB'ye ham veri yerine sadece gerekli kısımları kaydeder (~1MB → ~10KB).
     * Dönüş formatı mevcut kodla uyumlu: ['info']['frames'][]['events'] + ['participantFrames']
     */
    public function getMatchTimeline(string $matchId): ?array
    {
        // 1. DB'de var mı?
        $timeline = MatchTimeline::find($matchId);
        if ($timeline) {
            return $timeline->data;
        }

        // 2. API'den çek
        try {
            $response = $this->api->regionRequest("/lol/match/v5/matches/{$matchId}/timeline");
        } catch (\Exception $e) {
            return null;
        }

        // 3. Sadece gerekli verileri çıkar ve DB'ye kaydet
        $slim = $this->extractTimelineData($response);
        try {
            MatchTimeline::create([
                'match_id' => $matchId,
                'data'     => $slim,
            ]);
        } catch (\Exception $e) {}

        return $slim;
    }

    /**
     * Ham timeline verisinden sadece gerekli kısımları çıkar.
     * Kullanılan: ITEM_PURCHASED eventleri, SKILL_LEVEL_UP eventleri, participantFrames (gold)
     */
    private function extractTimelineData(array $raw): array
    {
        $frames = $raw['info']['frames'] ?? [];
        $slimFrames = [];

        foreach ($frames as $frame) {
            $slimFrame = [];

            // participantFrames — sadece totalGold (performance label için)
            if (isset($frame['participantFrames'])) {
                $pf = [];
                foreach ($frame['participantFrames'] as $pid => $data) {
                    $pf[$pid] = ['totalGold' => $data['totalGold'] ?? 0];
                }
                $slimFrame['participantFrames'] = $pf;
            }

            // Events — sadece ITEM_PURCHASED ve SKILL_LEVEL_UP
            $events = [];
            foreach ($frame['events'] ?? [] as $event) {
                $type = $event['type'] ?? '';
                if ($type === 'ITEM_PURCHASED') {
                    $events[] = [
                        'type'          => $type,
                        'timestamp'     => $event['timestamp'] ?? 0,
                        'participantId' => $event['participantId'] ?? null,
                        'itemId'        => $event['itemId'] ?? 0,
                    ];
                } elseif ($type === 'SKILL_LEVEL_UP') {
                    $events[] = [
                        'type'          => $type,
                        'timestamp'     => $event['timestamp'] ?? 0,
                        'participantId' => $event['participantId'] ?? null,
                        'skillSlot'     => $event['skillSlot'] ?? null,
                        'levelUpType'   => $event['levelUpType'] ?? 'NORMAL',
                    ];
                }
            }
            if (!empty($events)) {
                $slimFrame['events'] = $events;
            }

            $slimFrames[] = $slimFrame;
        }

        return ['info' => ['frames' => $slimFrames]];
    }

    /**
     * Birden fazla maç detayını paralel olarak çek ve DB'ye yaz.
     * DB'de olmayanları Http::pool() ile eşzamanlı indirir.
     */
    public function preloadMatches(array $matchIds): void
    {
        $this->preloadMatchDetails($matchIds);
        $this->preloadMatchTimelines($matchIds);
    }

    /**
     * Sadece maç detaylarını paralel yükle (timeline olmadan).
     */
    public function preloadMatchDetails(array $matchIds): void
    {
        // DB'de olmayan maçları bul
        $existing = MatchRecord::whereIn('match_id', $matchIds)->pluck('match_id')->toArray();
        $missing = array_values(array_diff($matchIds, $existing));

        if (empty($missing)) return;

        $regionUrl = config('riot.region_url');
        $apiKey = config('riot.api_key');

        foreach (array_chunk($missing, 20) as $chunk) {
            $responses = Http::pool(function ($pool) use ($chunk, $regionUrl, $apiKey) {
                foreach ($chunk as $id) {
                    $pool->as($id)
                        ->timeout(10)
                        ->withHeaders(['X-Riot-Token' => $apiKey])
                        ->get("{$regionUrl}/lol/match/v5/matches/{$id}");
                }
            });

            foreach ($chunk as $id) {
                $resp = $responses[$id] ?? null;
                if ($resp && $resp->successful()) {
                    $data = $resp->json();
                    try {
                        MatchRecord::create([
                            'match_id'      => $id,
                            'data'          => $data,
                            'queue_id'      => $data['info']['queueId'] ?? 0,
                            'game_duration' => $data['info']['gameDuration'] ?? 0,
                            'game_creation' => $data['info']['gameCreation'] ?? 0,
                        ]);
                    } catch (\Exception $e) {}
                }
            }
        }
    }

    /**
     * Sadece timeline'ları paralel yükle.
     */
    public function preloadMatchTimelines(array $matchIds): void
    {
        $existing = MatchTimeline::whereIn('match_id', $matchIds)->pluck('match_id')->toArray();
        $missing = array_values(array_diff($matchIds, $existing));

        if (empty($missing)) return;

        $regionUrl = config('riot.region_url');
        $apiKey = config('riot.api_key');

        foreach (array_chunk($missing, 20) as $chunk) {
            $responses = Http::pool(function ($pool) use ($chunk, $regionUrl, $apiKey) {
                foreach ($chunk as $id) {
                    $pool->as($id)
                        ->timeout(10)
                        ->withHeaders(['X-Riot-Token' => $apiKey])
                        ->get("{$regionUrl}/lol/match/v5/matches/{$id}/timeline");
                }
            });

            foreach ($chunk as $id) {
                $resp = $responses[$id] ?? null;
                if ($resp && $resp->successful()) {
                    try {
                        MatchTimeline::create([
                            'match_id' => $id,
                            'data'     => $this->extractTimelineData($resp->json()),
                        ]);
                    } catch (\Exception $e) {}
                }
            }
        }
    }

    /**
     * Champion ID'den görsel URL'i bul.
     */
    public function getChampImageById(int $championId): ?string
    {
        $champions = $this->ddragon->getChampions();
        foreach ($champions as $champ) {
            if ((int) $champ['key'] === $championId) {
                return $this->ddragon->championIconUrl($champ['id']);
            }
        }
        return null;
    }
}
