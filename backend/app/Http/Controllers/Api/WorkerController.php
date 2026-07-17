<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\WorkerControlService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Artisan;

/**
 * Meta worker admin API'si — durum + elle tetikleme.
 * Aç/kapa ve ayarlar SettingsController üzerinden (worker_* anahtarları) yönetilir.
 */
class WorkerController extends Controller
{
    public function __construct(private WorkerControlService $control) {}

    /** GET /admin/worker — panel durum kartları. */
    public function status(): JsonResponse
    {
        return response()->json($this->control->status());
    }

    /**
     * POST /admin/worker/crawl — ladder taramasını elle tetikle (senkron; apex hızlı,
     * Emerald/Diamond sınırlı sayfa → toplam ~30-40 istek, birkaç saniye sürebilir).
     */
    public function crawl(): JsonResponse
    {
        Artisan::call('ladder:crawl', ['--force' => true]);

        return response()->json([
            'ok'     => true,
            'output' => trim(Artisan::output()),
            'status' => $this->control->status(),
        ]);
    }

    /**
     * POST /admin/worker/collect — bir toplama turunu elle tetikle (dispatch hızlıdır;
     * maçların işlenmesi kuyrukta, birkaç dakika içinde queue:work ile).
     */
    public function collect(): JsonResponse
    {
        Artisan::call('matches:collect', ['--force' => true]);

        return response()->json([
            'ok'     => true,
            'output' => trim(Artisan::output()),
            'status' => $this->control->status(),
        ]);
    }
}
