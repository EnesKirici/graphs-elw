<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RetentionService;
use Illuminate\Http\JsonResponse;

/**
 * Admin: maç verisi saklama (retention) — durum raporu + elle prune.
 * Otomatik silme yok; silmeye admin panelden karar verilir (bkz. RetentionService).
 */
class RetentionController extends Controller
{
    public function __construct(private RetentionService $retention) {}

    /** GET /admin/retention — patch dağılımı + "silersem ne açılır" önizlemesi. */
    public function status(): JsonResponse
    {
        return response()->json($this->retention->report());
    }

    /** POST /admin/retention/prune — eski maçları elle sil (geri alınamaz). */
    public function prune(): JsonResponse
    {
        $result = $this->retention->prune();

        return response()->json($result + [
            'message' => $result['skipped']
                ? 'Prune eşiği yok — hiçbir şey silinmedi.'
                : "Silindi: {$result['deletedMatches']} maç + {$result['deletedTimelines']} timeline.",
        ]);
    }
}
