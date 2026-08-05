<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ChampionBuildService;
use App\Services\ChampionGuideService;
use App\Services\ChampionStatsService;
use App\Services\RiotApi\DataDragonService;
use Illuminate\Http\JsonResponse;

class ChampionController extends Controller
{
    public function __construct(
        private DataDragonService $ddragon,
        private ChampionStatsService $stats,
        private ChampionBuildService $build,
        private ChampionGuideService $guides,
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
                // "Jade_*" = özel mod varyantı (dereceli maç verisi yok). Frontend bunları
                // ayrı "Classic" sekmesinde gösterir; detay sayfası yalnız Detay tab'ı açar.
                'isClassic' => str_starts_with($champ['id'], 'Jade_'),
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

        // Geçersiz şampiyon adı (ör. canlıdaki /champions/rotation denemesi) → 500 yerine düzgün 404
        if ($champion === null) {
            return response()->json(['error' => 'champion_not_found'], 404);
        }

        $version = $this->ddragon->getCurrentVersion();
        $positionMap = $this->ddragon->getChampionPositions();
        $championProfile = $this->ddragon->championProfile($champion);

        return response()->json([
            'version'  => $version,
            'champion' => [
                'id'        => $champion['id'],
                'key'       => $champion['key'],
                'name'      => $champion['name'],
                'title'     => $champion['title'],
                // "Jade_*" varyantı mı → detay sayfası yalnız Detay tab'ı + "Ne değişti?" gösterir.
                'isClassic' => str_starts_with($champion['id'], 'Jade_'),
                'lore'      => $champion['lore'],
                'tags'      => $champion['tags'],
                'positions' => $positionMap[$champion['id']] ?? [],
                // attack/defense/magic/difficulty (0-10). Riot bazı şampiyonlarda bunu
                // hiç doldurmuyor → o zaman oyun istemcisi verisinden türetilir ve
                // infoSource='client' döner (arayüz kaynağı açıkça yazar).
                'info'       => $championProfile['values'],
                'infoSource' => $championProfile['source'],
                'image'   => $this->ddragon->championIconUrl($champion['id']),
                'splash'  => $this->ddragon->splashArtUrl($champion['id']),
                'spells'  => collect($champion['spells'])->map(fn($s) => [
                    'id'          => $s['id'],
                    'name'        => $s['name'],
                    'description' => $s['description'],
                    'image'       => config('riot.ddragon_assets_url') . "/cdn/{$version}/img/spell/{$s['image']['full']}",
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
                    'image'       => config('riot.ddragon_assets_url') . "/cdn/{$version}/img/passive/{$champion['passive']['image']['full']}",
                ],
                'stats'   => $champion['stats'],
                'skins'   => $this->ddragon->formatSkins($champion),
            ],
            // ADC+Support sinerji partnerleri (shrinkage WR + min_games)
            'duos' => $this->stats->getBestPartners($id),
            // Gerçek build verisi (worker maçlarından): rün/item/spell sayaçları,
            // oynanan koridorlar, top oyuncular. Veri yoksa positions boş döner.
            'build' => $this->build->getChampionBuild($id),
        ]);
    }

    /**
     * Şampiyon counter verisi (SEO counter sayfası: "X counter" / "X CT").
     * Oynanan her koridor için TAM matchup listesi + şampiyon temel bilgisi.
     * GET /api/v1/champions/{id}/counters
     */
    public function counters(string $id): JsonResponse
    {
        $champion = $this->ddragon->getChampionDetail($id);

        if ($champion === null) {
            return response()->json(['error' => 'champion_not_found'], 404);
        }

        $version = $this->ddragon->getCurrentVersion();
        $positionMap = $this->ddragon->getChampionPositions();

        return response()->json([
            'version'  => $version,
            'champion' => [
                'id'        => $champion['id'],
                'key'       => $champion['key'],
                'name'      => $champion['name'],
                'title'     => $champion['title'],
                'tags'      => $champion['tags'],
                'positions' => $positionMap[$champion['id']] ?? [],
                'image'     => $this->ddragon->championIconUrl($champion['id']),
                'splash'    => $this->ddragon->splashArtUrl($champion['id']),
                // "Jade_*" varyantının dereceli maç verisi YOK → counter sayfası boş kalır.
                // Frontend bu bayrakla sayfayı noindex yapar: başlığı gerçek şampiyonunkiyle
                // birebir çakışıyordu ("Warwick Counter (Warwick CT)...") ve Google "ww ct"
                // aramasında BOŞ olanı gösterebiliyordu (2026-08-03 tespiti).
                'isClassic' => str_starts_with($champion['id'], 'Jade_'),
            ],
            'counters' => $this->build->getChampionCounters($id),
            // ADC+Support sinerjisi (aynı takım) — counter şeridinin ARKA YÜZÜ.
            // Limit 5 DEĞİL 60: burası artık kaydırılabilir bir şerit, "en iyi 5" özeti
            // değil (kullanıcı "tüm karakterleri gösterebilirsin, sağa scroll" dedi).
            // En güçlüler yine solda — liste adjWr'ye göre sıralı geliyor.
            'duos' => $this->stats->getBestPartners($id, 60),
            // Elle yazılan rehber metinleri (nasıl oynanır + eşleşmeye özel notlar).
            // Sayılar "ne oluyor"u söyler, bu metinler "ne yapmalısın"ı — veriden çıkmaz.
            'guide' => $this->guides->forChampion($id),
        ]);
    }

    /**
     * Rün ağaçları (runesReforged) — build sayfasında tam ağaç gösterimi için.
     * GET /api/v1/runes
     */
    public function runes(): JsonResponse
    {
        return response()->json([
            'version' => $this->ddragon->getCurrentVersion(),
            'runes'   => $this->ddragon->getRunes(),
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
