<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CachedPlayer;
use App\Services\RiotApi\RiotApiService;
use App\Services\RiotApi\DataDragonService;
use App\Services\RiotApi\ChampionMasteryService;
use App\Services\RiotApi\SummonerService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LeaderboardController extends Controller
{
    public function __construct(
        private RiotApiService $api,
        private DataDragonService $ddragon,
        private ChampionMasteryService $mastery,
        private SummonerService $summoner,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $tier = $request->query('tier', 'challenger');
        $queue = $request->query('queue', 'RANKED_SOLO_5x5');

        $validTiers = ['challenger', 'grandmaster', 'master'];
        if (!in_array($tier, $validTiers)) {
            return response()->json(['error' => 'tier: challenger, grandmaster veya master'], 400);
        }

        $cacheKey = "leaderboard:v5:{$tier}:{$queue}";

        $data = Cache::remember($cacheKey, 1800, function () use ($tier, $queue) {
            // 1 API çağrısı — tüm lig
            $league = $this->api->platformRequest(
                "/lol/league/v4/{$tier}leagues/by-queue/{$queue}"
            );

            $sorted = collect($league['entries'] ?? [])
                ->sortByDesc('leaguePoints')
                ->values()
                ->take(50);

            $entries = $sorted->map(function ($entry, $index) use ($tier, $queue) {
                $puuid = $entry['puuid'] ?? null;
                $isTop10 = $index < 10;

                // Top 10 için detay çek + DB'ye kaydet
                $playerDetail = null;
                if ($puuid && $isTop10) {
                    $playerDetail = $this->enrichPlayer($puuid, $tier, $queue, $entry);
                }

                return [
                    'rank'        => $index + 1,
                    'puuid'       => $puuid,
                    'name'        => $playerDetail['name'] ?? null,
                    'profileIcon' => $playerDetail['profileIcon'] ?? null,
                    'topChamps'   => $playerDetail['topChamps'] ?? null,
                    'topRoles'    => $playerDetail['topRoles'] ?? null,
                    'tier'       => strtoupper($tier),
                    'lp'         => $entry['leaguePoints'],
                    'wins'       => $entry['wins'],
                    'losses'     => $entry['losses'],
                    'games'      => $entry['wins'] + $entry['losses'],
                    'winRate'    => ($entry['wins'] + $entry['losses']) > 0
                        ? round($entry['wins'] / ($entry['wins'] + $entry['losses']) * 100, 1)
                        : 0,
                    'hotStreak'  => $entry['hotStreak'],
                    'veteran'    => $entry['veteran'],
                    'freshBlood' => $entry['freshBlood'],
                ];
            });

            return [
                'tier'    => strtoupper($tier),
                'queue'   => $queue,
                'total'   => count($league['entries'] ?? []),
                'entries' => $entries->all(),
            ];
        });

        return response()->json($data);
    }

    /**
     * Top 10 oyuncu için: isim + mastery + DB kaydet.
     * Her oyuncu için max 3 API çağrısı (isim + mastery + summoner).
     * Tamamı 24 saat ayrı cache'lenir — tekrar çağrılmaz.
     */
    private function enrichPlayer(string $puuid, string $tier, string $queue, array $leagueEntry): array
    {
        return Cache::remember("player:enriched:v2:{$puuid}", 86400, function () use ($puuid, $tier, $queue, $leagueEntry) {
            $name = null;
            $topChamps = null;
            $topRoles = null;
            $profileIcon = null;
            $profileIconId = null;

            // İsim + profil ikonu (account + summoner, getByPuuid içinde cache'li)
            try {
                $sum = $this->summoner->getByPuuid($puuid);
                $name = [
                    'gameName' => $sum['gameName'] ?? null,
                    'tagLine'  => $sum['tagLine'] ?? null,
                ];
                $profileIcon = $sum['profileIcon'] ?? null;
                $profileIconId = $sum['profileIconId'] ?? null;
            } catch (\Exception $e) {
                // En azından ismi almayı dene
                try {
                    $account = $this->api->regionRequest("/riot/account/v1/accounts/by-puuid/{$puuid}");
                    $name = [
                        'gameName' => $account['gameName'] ?? null,
                        'tagLine'  => $account['tagLine'] ?? null,
                    ];
                } catch (\Exception $e2) {}
            }

            // Top 5 mastery şampiyonu (1 API çağrısı)
            try {
                $masteries = $this->mastery->getTopMasteries($puuid, 5);
                $topChamps = array_map(fn($m) => [
                    'name'  => $m['championName'],
                    'image' => $m['championImage'],
                    'level' => $m['championLevel'],
                ], $masteries);
            } catch (\Exception $e) {}

            // Koridor bilgisi — son 5 ranked maçtan (1 + 5 = 6 API çağrısı? hayır, match cache'li)
            // Rate limit korumak için sadece mastery'den şampiyon tag'leri ile tahmin edelim
            // Gerçek koridor bilgisi için maç geçmişi lazım — bunu atla, production'da ekleriz
            // Şimdilik mastery şampiyonlarından tahmin:
            $roleGuess = $this->guessRolesFromChampions($topChamps);
            $topRoles = $roleGuess;

            // DB'ye kaydet
            try {
                CachedPlayer::updateOrCreate(
                    ['puuid' => $puuid],
                    [
                        'game_name'      => $name['gameName'] ?? null,
                        'tag_line'       => $name['tagLine'] ?? null,
                        'tier'           => strtoupper($tier),
                        'rank'           => $leagueEntry['rank'] ?? 'I',
                        'queue'          => $queue,
                        'lp'             => $leagueEntry['leaguePoints'],
                        'wins'           => $leagueEntry['wins'],
                        'losses'         => $leagueEntry['losses'],
                        'top_champions'  => $topChamps,
                        'top_roles'      => $topRoles,
                        'profile_icon_id' => $profileIconId,
                    ]
                );
            } catch (\Exception $e) {}

            return [
                'name'        => $name,
                'profileIcon' => $profileIcon,
                'topChamps'   => $topChamps,
                'topRoles'    => $topRoles,
            ];
        });
    }

    /**
     * Şampiyon listesinden koridor tahmini.
     * Basit mapping — her şampiyonun tipik koridoru.
     * Gerçek maç verisinden çok daha ucuz (0 API çağrısı).
     */
    private function guessRolesFromChampions(?array $champs): ?array
    {
        if (!$champs) return null;

        // Basit şampiyon → rol mapping (en yaygın roller)
        $champRoles = [
            'Aatrox' => 'Top', 'Ahri' => 'Mid', 'Akali' => 'Mid', 'Akshan' => 'Mid',
            'Alistar' => 'Support', 'Amumu' => 'Jungle', 'Anivia' => 'Mid', 'Annie' => 'Mid',
            'Aphelios' => 'ADC', 'Ashe' => 'ADC', 'AurelionSol' => 'Mid', 'Aurora' => 'Mid',
            'Azir' => 'Mid', 'Bard' => 'Support', 'Belveth' => 'Jungle', 'Blitzcrank' => 'Support',
            'Brand' => 'Support', 'Braum' => 'Support', 'Briar' => 'Jungle', 'Caitlyn' => 'ADC',
            'Camille' => 'Top', 'Cassiopeia' => 'Mid', 'Chogath' => 'Top', 'Corki' => 'Mid',
            'Darius' => 'Top', 'Diana' => 'Jungle', 'Draven' => 'ADC', 'Ekko' => 'Jungle',
            'Elise' => 'Jungle', 'Evelynn' => 'Jungle', 'Ezreal' => 'ADC', 'Fiora' => 'Top',
            'Fizz' => 'Mid', 'Galio' => 'Mid', 'Gangplank' => 'Top', 'Garen' => 'Top',
            'Gnar' => 'Top', 'Gragas' => 'Top', 'Graves' => 'Jungle', 'Gwen' => 'Top',
            'Hecarim' => 'Jungle', 'Heimerdinger' => 'Mid', 'Irelia' => 'Top', 'Ivern' => 'Jungle',
            'Janna' => 'Support', 'JarvanIV' => 'Jungle', 'Jax' => 'Top', 'Jayce' => 'Top',
            'Jhin' => 'ADC', 'Jinx' => 'ADC', 'Kaisa' => 'ADC', 'Kalista' => 'ADC',
            'Karma' => 'Support', 'Karthus' => 'Jungle', 'Kassadin' => 'Mid', 'Katarina' => 'Mid',
            'Kayle' => 'Top', 'Kayn' => 'Jungle', 'Kennen' => 'Top', 'Khazix' => 'Jungle',
            'Kindred' => 'Jungle', 'Kled' => 'Top', 'KogMaw' => 'ADC', 'KSante' => 'Top',
            'Leblanc' => 'Mid', 'LeeSin' => 'Jungle', 'Leona' => 'Support', 'Lillia' => 'Jungle',
            'Lissandra' => 'Mid', 'Lucian' => 'ADC', 'Lulu' => 'Support', 'Lux' => 'Support',
            'Malphite' => 'Top', 'Malzahar' => 'Mid', 'Maokai' => 'Support', 'MasterYi' => 'Jungle',
            'MissFortune' => 'ADC', 'Mordekaiser' => 'Top', 'Morgana' => 'Support', 'Nami' => 'Support',
            'Nasus' => 'Top', 'Nautilus' => 'Support', 'Nidalee' => 'Jungle', 'Nocturne' => 'Jungle',
            'Nunu' => 'Jungle', 'Olaf' => 'Top', 'Orianna' => 'Mid', 'Ornn' => 'Top',
            'Pantheon' => 'Top', 'Poppy' => 'Top', 'Pyke' => 'Support', 'Qiyana' => 'Mid',
            'Quinn' => 'Top', 'Rakan' => 'Support', 'Rammus' => 'Jungle', 'RekSai' => 'Jungle',
            'Rell' => 'Support', 'Renekton' => 'Top', 'Rengar' => 'Jungle', 'Riven' => 'Top',
            'Rumble' => 'Top', 'Ryze' => 'Mid', 'Samira' => 'ADC', 'Sejuani' => 'Jungle',
            'Senna' => 'Support', 'Seraphine' => 'Support', 'Sett' => 'Top', 'Shaco' => 'Jungle',
            'Shen' => 'Top', 'Shyvana' => 'Jungle', 'Singed' => 'Top', 'Sion' => 'Top',
            'Sivir' => 'ADC', 'Skarner' => 'Jungle', 'Sona' => 'Support', 'Soraka' => 'Support',
            'Swain' => 'Mid', 'Sylas' => 'Mid', 'Syndra' => 'Mid', 'TahmKench' => 'Top',
            'Taliyah' => 'Mid', 'Talon' => 'Mid', 'Taric' => 'Support', 'Teemo' => 'Top',
            'Thresh' => 'Support', 'Tristana' => 'ADC', 'Trundle' => 'Jungle', 'Tryndamere' => 'Top',
            'TwistedFate' => 'Mid', 'Twitch' => 'ADC', 'Udyr' => 'Jungle', 'Urgot' => 'Top',
            'Varus' => 'ADC', 'Vayne' => 'ADC', 'Veigar' => 'Mid', 'Velkoz' => 'Mid',
            'Vex' => 'Mid', 'Vi' => 'Jungle', 'Viego' => 'Jungle', 'Viktor' => 'Mid',
            'Vladimir' => 'Mid', 'Volibear' => 'Top', 'Warwick' => 'Jungle', 'Xayah' => 'ADC',
            'Xerath' => 'Mid', 'XinZhao' => 'Jungle', 'Yasuo' => 'Mid', 'Yone' => 'Mid',
            'Yorick' => 'Top', 'Yuumi' => 'Support', 'Zac' => 'Jungle', 'Zed' => 'Mid',
            'Zeri' => 'ADC', 'Ziggs' => 'Mid', 'Zilean' => 'Support', 'Zoe' => 'Mid',
            'Zyra' => 'Support',
        ];

        $roleCounts = [];
        foreach ($champs as $c) {
            $name = $c['name'] ?? '';
            $role = $champRoles[$name] ?? null;
            if ($role) {
                $roleCounts[$role] = ($roleCounts[$role] ?? 0) + 1;
            }
        }
        arsort($roleCounts);

        return array_slice(
            array_map(fn($role, $count) => ['role' => $role, 'count' => $count], array_keys($roleCounts), array_values($roleCounts)),
            0, 2
        );
    }
}
