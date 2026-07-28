<?php

namespace App\Services;

use App\Models\MatchRecord;
use App\Models\MatchTimeline;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Maç verisi saklama (retention) — admin panel raporu + elle prune.
 *
 * ÖNEMLİ: Otomatik silme YOK. Yeni yama gelince eski patch verisi kendiliğinden
 * SİLİNMEZ; yalnızca meta GÖSTERİMİ tutulan patch penceresine (güncel + önceki)
 * kayar (bkz. MetaService/keptPatches). Silmeye admin panelden ELLE karar verilir.
 *
 * matches:prune komutu ve RetentionController bu servisi kullanır → tek doğru kaynak.
 * Silme geri alınamaz ama match_summaries / lp_snapshots ayrı tablolarda → profiller
 * bozulmaz (detay sonradan Riot'tan yeniden çekilir).
 */
class RetentionService
{
    public function __construct(private PatchService $patch) {}

    /** Prune eşiği (ms epoch): bundan eski maçlar silinebilir. Yoksa null → prune yapma. */
    public function cutoffMs(): ?int
    {
        return $this->patch->keepSince()?->getTimestampMs();
    }

    /**
     * Retention durum raporu — admin panel + prune önizleme. 0 Riot çağrısı (yalnız DB).
     * "Silersem ne kadar yer açılır / kaç maç" burada.
     */
    public function report(): array
    {
        $cutoff = $this->patch->keepSince();
        $cutoffMs = $cutoff?->getTimestampMs();

        $total = MatchRecord::count();
        $prunable = $cutoffMs !== null
            ? MatchRecord::where('game_creation', '<', $cutoffMs)->count()
            : 0;

        $sizes = $this->tableSizes();
        // Yaklaşık kazanç: silinecek maç oranı × toplam boyut (blob boyutu maça göre değişir → tahmin).
        $estFreedMb = $total > 0 ? round($prunable / $total * $sizes['totalMb'], 1) : 0.0;

        return [
            'keptPatches'     => $this->patch->keptPatches(),
            'cutoff'          => $cutoff?->toDateString(),
            'totalMatches'    => $total,
            'prunableMatches' => $prunable,
            'keptMatches'     => $total - $prunable,
            'autoPrune'       => false, // zamanlanmış silme YOK — her şey elle
            'sizes'           => $sizes,
            'estFreedMb'      => $estFreedMb,
            'patches'         => $this->perPatchBreakdown($cutoffMs),
        ];
    }

    /**
     * Eski maçları (+ ilişkili timeline'ları) sil. Dönüş: silinen sayılar + kalan.
     * skipped=true → eşik yok, hiçbir şey silinmedi (güvenlik).
     */
    public function prune(): array
    {
        $cutoffMs = $this->cutoffMs();
        if ($cutoffMs === null) {
            return ['deletedMatches' => 0, 'deletedTimelines' => 0, 'remaining' => MatchRecord::count(), 'skipped' => true];
        }

        // Timeline'lar ayrı tabloda (aynı match_id'ler) — alt sorguyla önce onları temizle.
        $timelines = MatchTimeline::whereIn(
            'match_id',
            MatchRecord::where('game_creation', '<', $cutoffMs)->select('match_id')
        )->delete();
        $matches = MatchRecord::where('game_creation', '<', $cutoffMs)->delete();

        return [
            'deletedMatches'   => $matches,
            'deletedTimelines' => $timelines,
            'remaining'        => MatchRecord::count(),
            'skipped'          => false,
        ];
    }

    /** matches + match_timelines disk boyutu (MB) — information_schema (yaklaşık). */
    private function tableSizes(): array
    {
        $rows = DB::select(
            "SELECT table_name AS t, ROUND((data_length + index_length) / 1024 / 1024, 1) AS mb
             FROM information_schema.TABLES
             WHERE table_schema = DATABASE() AND table_name IN ('matches', 'match_timelines')"
        );
        $map = [];
        foreach ($rows as $r) {
            $map[$r->t] = (float) $r->mb;
        }
        $matches = $map['matches'] ?? 0.0;
        $timelines = $map['match_timelines'] ?? 0.0;

        return [
            'matchesMb'   => $matches,
            'timelinesMb' => $timelines,
            'totalMb'     => round($matches + $timelines, 1),
        ];
    }

    /**
     * Patch başına maç sayısı (config patch_starts tarih pencereleri, indexli game_creation).
     * kept = maçları prune eşiğinin üstünde (silinmeyecek) mi. Şeffaflık için tablo.
     */
    private function perPatchBreakdown(?int $cutoffMs): array
    {
        $parsed = [];
        foreach (config('elwgraphs.meta.patch_starts', []) as $patch => $date) {
            $parsed[$patch] = Carbon::parse($date)->startOfDay();
        }
        uasort($parsed, fn ($a, $b) => $b <=> $a); // en yeni patch başta
        $patchesDesc = array_keys($parsed);

        $out = [];
        foreach ($patchesDesc as $i => $patch) {
            $startMs = $parsed[$patch]->getTimestampMs();
            // Üst sınır: bir sonraki (daha yeni) patch'in başlangıcı; en yeni patch'te sınırsız.
            $endMs = $i > 0 ? $parsed[$patchesDesc[$i - 1]]->getTimestampMs() : null;

            $q = MatchRecord::where('game_creation', '>=', $startMs);
            if ($endMs !== null) {
                $q->where('game_creation', '<', $endMs);
            }

            $out[] = [
                'patch'   => $patch,
                'matches' => $q->count(),
                'kept'    => $cutoffMs === null ? true : $startMs >= $cutoffMs,
            ];
        }

        // config'teki en eski patch'ten de eski maçlar (patch bilinmiyor → prune hedefi).
        if ($parsed) {
            $oldestMs = end($parsed)->getTimestampMs();
            $older = MatchRecord::where('game_creation', '<', $oldestMs)->count();
            if ($older > 0) {
                $out[] = ['patch' => 'daha eski', 'matches' => $older, 'kept' => false];
            }
        }

        return $out;
    }
}
