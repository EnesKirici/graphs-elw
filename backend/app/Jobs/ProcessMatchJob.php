<?php

namespace App\Jobs;

use App\Models\ProcessedMatch;
use App\Services\BuildAggregationService;
use App\Services\RiotApi\MatchDataService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Carbon;

/**
 * Tek maçı işleyip aggregate sayaçlara ekler (champion_stats/builds/top_players).
 * İşlenen maç processed_matches'e yazılır → çift sayım yok.
 */
class ProcessMatchJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Rate limit release'leri deneme sayar → bol hak; GERÇEK hatalar yine
     * 3 istisnada düşer (maxExceptions). Yoksa bütçe dolunca kuyruğun kalanı
     * 3'er milisaniyelik denemeyle failed_jobs'a akıyordu (maç kaybı).
     */
    public $tries = 15;
    public $maxExceptions = 3;

    public function __construct(
        public string $matchId,
        public string $region = 'tr1',
        public ?string $tierBucket = null, // maçın bulunduğu havuz ligi (EMERALD..CHALLENGER)
    ) {}

    public function handle(MatchDataService $matchData, BuildAggregationService $agg): void
    {
        // ATOMİK CLAIM — çift sayımın TEK garantisi burası.
        // Aynı maç 10 oyuncunun da geçmişinde çıkar; match_id PRIMARY KEY olduğu için
        // insertOrIgnore yalnızca İLK job'ta 1 döner, diğerlerinde 0 (zaten var) → atlanır.
        // Eşzamanlı worker'larda bile aynı maç tam olarak BİR kez işlenir.
        $claimed = ProcessedMatch::query()->insertOrIgnore([
            'match_id'     => $this->matchId,
            'processed_at' => Carbon::now(),
        ]);

        if (! $claimed) {
            return; // başka bir job zaten işledi/işliyor
        }

        try {
            $detail = $matchData->getMatchDetail($this->matchId);
            $agg->processMatch($detail, $this->region);

            // Timeline'a bağlı sayaçlar (skill_order/starter/item_slotN) — ekstra 1 API
            // isteği. Başarısız olursa maç işlenmiş sayılır, timelines:backfill tamamlar.
            $timelineDone = false;
            try {
                $timeline = app(\App\Services\RiotApi\RiotApiService::class)
                    ->regionRequest("/lol/match/v5/matches/{$this->matchId}/timeline");
                $agg->processTimeline($detail, $timeline);
                $timelineDone = true;
            } catch (\Throwable) {
                // 429/ağ hatası → backfill halleder
            }

            // patch'i claim sonrası güncelle (claim anında maç detayı yoktu).
            // rune_k_done: yeni processMatch koşullu rün sayaçlarını da işledi.
            ProcessedMatch::where('match_id', $this->matchId)
                ->update([
                    'patch'         => $this->patchOf($detail),
                    'rune_k_done'   => true,
                    'timeline_done' => $timelineDone,
                ]);

            // Kaynak lig damgası → ileride elo-filtreli istatistik (yalnız boşsa yaz;
            // aynı maç farklı liglerden bulunursa İLK damga kalır).
            if ($this->tierBucket) {
                \App\Models\MatchRecord::where('match_id', $this->matchId)
                    ->whereNull('tier_bucket')
                    ->update(['tier_bucket' => $this->tierBucket]);
            }
        } catch (\Throwable $e) {
            // İşleme başarısızsa claim'i geri al → maç tekrar denenebilir (yine çift sayılmaz)
            ProcessedMatch::where('match_id', $this->matchId)->delete();

            // Rate limit (429) hata değil bekleme sinyalidir: fail etme, cooldown
            // süresi kadar gecikmeyle kuyruğa geri bırak. Süre mesajdan okunur
            // ("Rate limit aktif. N saniye bekleyin."), yoksa 20 sn varsayılır.
            if ((int) $e->getCode() === 429) {
                preg_match('/(\d+) saniye/', $e->getMessage(), $m);
                $this->release(min(max(((int) ($m[1] ?? 15)) + 5, 10), 150));

                return;
            }

            throw $e; // job retry mekanizması devreye girsin
        }
    }

    private function patchOf(array $detail): ?string
    {
        $v = $detail['info']['gameVersion'] ?? '';
        $parts = explode('.', $v);
        return count($parts) >= 2 ? "{$parts[0]}.{$parts[1]}" : null;
    }
}
