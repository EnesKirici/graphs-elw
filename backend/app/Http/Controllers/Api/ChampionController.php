<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RiotApi\DataDragonService;
use Illuminate\Http\JsonResponse;

class ChampionController extends Controller
{
    public function __construct(
        private DataDragonService $ddragon
    ) {}

    /**
     * Tüm şampiyonları listele.
     * GET /api/v1/champions
     */
    public function index(): JsonResponse
    {
        $champions = $this->ddragon->getChampions();
        $version = $this->ddragon->getCurrentVersion();
        $positionMap = $this->ddragon->getChampionPositions();

        // DDragon verisini frontend için daha temiz bir formata dönüştür
        $formatted = collect($champions)->map(function ($champ) use ($positionMap) {
            return [
                'id'        => $champ['id'],        // "Aatrox"
                'key'       => $champ['key'],       // "266" (numeric ID)
                'name'      => $champ['name'],      // "Aatrox"
                'title'     => $champ['title'],     // "Darkin Kılıcı"
                'tags'      => $champ['tags'],      // ["Fighter", "Tank"]
                'image'     => $this->ddragon->championIconUrl($champ['id']),
                'positions' => $positionMap[$champ['id']] ?? [],
            ];
        })->values();

        return response()->json([
            'version'   => $version,
            'count'     => $formatted->count(),
            'champions' => $formatted,
        ]);
    }

    /**
     * Tek bir şampiyonun detaylı bilgisi.
     * GET /api/v1/champions/{id}
     */
    public function show(string $id): JsonResponse
    {
        $champion = $this->ddragon->getChampionDetail($id);
        $version = $this->ddragon->getCurrentVersion();
        $positionMap = $this->ddragon->getChampionPositions();

        return response()->json([
            'version'  => $version,
            'champion' => [
                'id'        => $champion['id'],
                'key'       => $champion['key'],
                'name'      => $champion['name'],
                'title'     => $champion['title'],
                'lore'      => $champion['lore'],
                'tags'      => $champion['tags'],
                'positions' => $positionMap[$champion['id']] ?? [],
                'info'      => $champion['info'],     // attack, defense, magic, difficulty
                'image'   => $this->ddragon->championIconUrl($champion['id']),
                'splash'  => $this->ddragon->splashArtUrl($champion['id']),
                'spells'  => collect($champion['spells'])->map(fn($s) => [
                    'id'          => $s['id'],
                    'name'        => $s['name'],
                    'description' => $s['description'],
                    'image'       => "https://ddragon.leagueoflegends.com/cdn/{$version}/img/spell/{$s['image']['full']}",
                    'cooldown'    => $s['cooldownBurn'] ?? null,
                    'cost'        => $s['costBurn'] ?? null,
                    'range'       => $s['rangeBurn'] ?? null,
                    'maxrank'     => $s['maxrank'] ?? 5,
                ]),
                'allytips'  => $champion['allytips'] ?? [],
                'enemytips' => $champion['enemytips'] ?? [],
                'passive' => [
                    'name'        => $champion['passive']['name'],
                    'description' => $champion['passive']['description'],
                    'image'       => "https://ddragon.leagueoflegends.com/cdn/{$version}/img/passive/{$champion['passive']['image']['full']}",
                ],
                'stats'   => $champion['stats'],
                'skins'   => collect($champion['skins'])
                    ->filter(fn($s) => !str_contains($s['name'], '('))
                    ->values()
                    ->map(fn($s) => [
                        'num'    => $s['num'],
                        'name'   => $s['name'] === 'default' ? $champion['name'] : $s['name'],
                        'splash' => $this->ddragon->splashArtUrl($champion['id'], $s['num']),
                    ]),
            ],
        ]);
    }

    /**
     * Güncel DDragon versiyon bilgisi.
     * GET /api/v1/version
     */
    public function version(): JsonResponse
    {
        return response()->json([
            'version' => $this->ddragon->getCurrentVersion(),
            'ddragon_base' => config('riot.ddragon_url'),
        ]);
    }
}
