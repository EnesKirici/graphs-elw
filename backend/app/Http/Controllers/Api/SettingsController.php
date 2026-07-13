<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminSetting;
use App\Services\MetaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class SettingsController extends Controller
{
    /**
     * Frontend'in ihtiyaç duyduğu public ayarlar.
     * GET /api/v1/settings/public
     */
    public function publicSettings(): JsonResponse
    {
        return response()->json([
            'elw_score'          => AdminSetting::getValue('elw_score', self::DEFAULT_ELW_SCORE),
            'performance_labels' => AdminSetting::getValue('performance_labels'),
            'badge_config'       => AdminSetting::getValue('badge_config'),
            'profile_design'     => AdminSetting::getValue('profile_design', 'classic'),
        ]);
    }

    /**
     * Etiket motoru — KATALOG (kod) + admin ezme config'i + ton renkleri (admin paneli için).
     * GET /api/v1/admin/labels
     */
    public function labels(): JsonResponse
    {
        return response()->json([
            'catalog' => \App\Services\LabelEngine::CATALOG,
            'tones'   => \App\Services\LabelEngine::TONE_COLOR,
            'config'  => AdminSetting::getValue('labels_config', []),
        ]);
    }

    /**
     * Belirli bir ayarı getir.
     * GET /api/v1/admin/settings/{key}
     */
    public function show(string $key): JsonResponse
    {
        $defaults = $this->getDefaults();

        $value = AdminSetting::getValue($key, $defaults[$key] ?? null);

        return response()->json([
            'key'   => $key,
            'value' => $value,
        ]);
    }

    /**
     * Belirli bir ayarı güncelle.
     * PUT /api/v1/admin/settings/{key}
     */
    public function update(string $key, Request $request): JsonResponse
    {
        $allowed = ['performance_labels', 'badge_config', 'elw_score', 'profile_design', 'meta_insufficient_mode', 'labels_config'];

        if (!in_array($key, $allowed)) {
            return response()->json(['error' => 'Geçersiz ayar anahtarı.'], 422);
        }

        // Tek string ayarlar vs yapılandırma dizisi.
        if ($key === 'profile_design') {
            $request->validate(['value' => 'required|string|in:classic,pro']);
        } elseif ($key === 'meta_insufficient_mode') {
            $request->validate(['value' => 'required|string|in:label,sim']);
        } else {
            $request->validate(['value' => 'required|array']);
        }

        AdminSetting::setValue($key, $request->input('value'));

        // Meta modu değişince ana sayfa dashboard cache'ini tazele (anında yansısın).
        if ($key === 'meta_insufficient_mode') {
            Cache::forget(MetaService::DASHBOARD_STATS_CACHE_KEY);
        }

        return response()->json([
            'ok'  => true,
            'key' => $key,
        ]);
    }

    private function getDefaults(): array
    {
        return [
            'elw_score'              => self::DEFAULT_ELW_SCORE,
            'profile_design'         => 'classic',
            'meta_insufficient_mode' => 'label',
        ];
    }

    private const DEFAULT_ELW_SCORE = [
        'labels' => [
            ['min' => 8.0, 'label' => 'Olağanüstü'],
            ['min' => 6.5, 'label' => 'Çok İyi'],
            ['min' => 5.0, 'label' => 'İyi'],
            ['min' => 3.5, 'label' => 'Mücadele'],
            ['min' => 0,   'label' => 'Zor Maç'],
        ],
        'colorThresholds' => ['emerald' => 7, 'blue' => 5, 'yellow' => 3],
        'glowThreshold'   => 8.5,
        'shimmerEnabled'   => true,
    ];
}
