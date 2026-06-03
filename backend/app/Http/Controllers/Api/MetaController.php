<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\MetaService;
use Illuminate\Http\JsonResponse;

class MetaController extends Controller
{
    public function __construct(
        private MetaService $meta,
    ) {}

    /**
     * Dashboard ana veri endpoint'i.
     * GET /api/v1/meta/dashboard
     */
    public function dashboard(): JsonResponse
    {
        return response()->json($this->meta->getDashboardStats());
    }

    /**
     * Ücretsiz şampiyon rotasyonu.
     * GET /api/v1/meta/rotation
     */
    public function rotation(): JsonResponse
    {
        return response()->json($this->meta->getFreeRotation());
    }

    /**
     * Site geneli canlı sayaçlar (analiz edilen maç, takip edilen oyuncu).
     * GET /api/v1/meta/stats
     */
    public function stats(): JsonResponse
    {
        return response()->json($this->meta->getSiteStats());
    }
}
