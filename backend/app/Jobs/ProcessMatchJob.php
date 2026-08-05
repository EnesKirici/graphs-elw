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
use Illuminate\Support\Facades\Cache;

/**
 * Tek maçı işleyip aggregate sayaçlara ekler (champion_stats/builds/top_players).
 * İşlenen maç processed_matches'e yazılır → çift sayım yok.
 */
class ProcessMatchJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Deneme SAYISI değil, ZAMAN sınırı (retryUntil).
     *
     * Laravel her `release()`'i bir deneme sayar. Bu işte release'lerin çoğu hata değil
     * BEKLEME sinyalidir (429 cooldown / geçersiz key / kullanıcıya yol verme). Sabit
     * $tries = 15 ile, yoğun saatlerde iş tek bir gerçek hata almadan yalnızca "bekle"
     * diye diye hakkını tüketip failed_jobs'a düşüyordu: 2026-07-30/31 penceresinde
     * 5.156 maç böyle KALICI kaybedildi (kuyrukta o an 8.3K iş attempts=10-11'deydi).
     *
     * retryUntil ile bekleme sinyalleri bedava — iş süre dolana kadar sabırla döner.
     * GERÇEK hatalar yine hızlıca düşer ($maxExceptions = 3) → sonsuz döngü yok.
     * Not: retryUntil dolduğunda Laravel worker'ın --tries değerine geri düşer.
     */
    public $maxExceptions = 3;

    /**
     * Pencere neden 3 gün: kuyruk tavanı (WorkerControlService::queueCeiling) sayesinde
     * normalde bekleme birkaç saati geçmez; geniş pay, birikmiş kuyruğun eridiği
     * dönemde işlerin zaman aşımından ölmemesi için.
     */
    public function retryUntil(): \DateTimeInterface
    {
        return now()->addDays(3);
    }

    public function __construct(
        public string $matchId,
        public string $region = 'tr1',
        public ?string $tierBucket = null, // maçın bulunduğu havuz ligi (EMERALD..CHALLENGER)
    ) {}

    public function handle(MatchDataService $matchData, BuildAggregationService $agg, \App\Services\WorkerControlService $worker): void
    {
        // WORKER KAPALI: bu iş 2 Riot isteği harcar (maç detayı + timeline). Kullanıcı
        // panelden "durdur" dediyse anahtarı tüketmemeli. Zamanlayıcı queue:work'ü zaten
        // başlatmıyor (routes/console.php); burası elle başlatılan işçiye karşı yedek.
        // SİLME, geri bırak — maç kaybolmasın; retryUntil (3 gün) bu beklemeyi affeder.
        if (! $worker->isEnabled()) {
            $this->release(300);

            return;
        }

        // Anahtar GEÇERSİZ (401/403): işlemeyi DENEME — boşa 401 atıp maçı 15 kez
        // deneyerek failed_jobs'a düşürmesin. İşi 2 dk gecikmeyle geri bırak; yeni key
        // panelden girilince (RiotKeyStore::put flag'i temizler) bekleyen işler işlenir.
        if (Cache::get('riot:key_invalid')) {
            $this->release(120);

            return;
        }

        // 429 COOLDOWN AKTİF: geri sayım bitene kadar Riot'a HİÇ dokunma.
        // Eskiden job normal akışına devam eder, RiotApiService::request() ilk satırda
        // cooldown'u görüp 'blocked' sayacını artırıp exception fırlatırdı. Ağ beklemesi
        // olmadığı için kuyruk saniyeler içinde boşa akıyor ve her deneme $tries hakkından
        // bir tane götürüyordu → panelde 47 gerçek 429'a karşılık 12.4k "engellenen"
        // birikmişti (kullanıcı bildirdi). Artık pencere kadar TEK sefer beklenir:
        // bir cooldown = job başına bir release, boşa istek ve boşa deneme yok.
        // WorkerControlService::shouldYield() aynı kontrolü tarama komutları için yapıyor;
        // burası kuyruğa ÇOKTAN girmiş işlerin karşılığı.
        $cooldownUntil = (int) Cache::get('riot:rate_limit_cooldown', 0);
        if ($cooldownUntil > time()) {
            // En az 5sn: kalan 1sn olsa bile job'ın anında geri dönüp dönmesini engeller.
            // En çok 150sn: catch bloğundaki 429 gecikmesiyle aynı üst sınır.
            $this->release(min(max($cooldownUntil - time() + 2, 5), 150));

            return;
        }

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
                    'patch'              => $this->patchOf($detail),
                    'rune_k_done'        => true,
                    'matchup_done'       => true,
                    'matchup_stats_done' => true, // processMatch step 4 KDA/hasarı da işledi
                    'cross_done'         => true, // ... ve bot lane çapraz satırlarını
                    'timeline_done'      => $timelineDone,
                ]);

            // Kaynak lig damgası → ileride elo-filtreli istatistik (yalnız boşsa yaz;
            // aynı maç farklı liglerden bulunursa İLK damga kalır).
            if ($this->tierBucket) {
                \App\Models\MatchRecord::where('match_id', $this->matchId)
                    ->whereNull('tier_bucket')
                    ->update(['tier_bucket' => $this->tierBucket]);

                // Snowball: bu maçtaki 10 oyuncuyu havuza ekle — BEDAVA keşif (maçı zaten
                // çektik, ekstra Riot isteği YOK). Yeni maçta çıkanlar = AKTİF oyuncular →
                // havuz kendiliğinden aktif oyuncularla büyür, ladder crawl'a daha az gerek.
                // Yeni satırların last_scanned_at'i null → worker onları ÖNCELİKLE tarar.
                $this->harvestPlayers($detail);
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

    /**
     * Maçtaki katılımcıları crawl havuzuna ekle (snowball). Yalnız YENİ puuid'ler eklenir
     * (PK=puuid → insertOrIgnore var olanları atlar, last_scanned_at'lerini EZMEZ). Tier =
     * maçın havuz ligi (matchmaking gereği katılımcılar ~aynı elo). Riot isteği harcamaz.
     */
    private function harvestPlayers(array $detail): void
    {
        $now = Carbon::now();
        $rows = [];
        foreach ($detail['info']['participants'] ?? [] as $p) {
            $puuid = $p['puuid'] ?? null;
            if (is_string($puuid) && $puuid !== '') {
                $rows[$puuid] = [
                    'puuid'      => $puuid,
                    'region'     => $this->region,
                    'tier'       => $this->tierBucket,
                    'priority'   => 'normal',
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
        }

        if ($rows) {
            \App\Models\CrawlPlayer::insertOrIgnore(array_values($rows));
        }
    }

    private function patchOf(array $detail): ?string
    {
        $v = $detail['info']['gameVersion'] ?? '';
        $parts = explode('.', $v);
        return count($parts) >= 2 ? "{$parts[0]}.{$parts[1]}" : null;
    }
}
