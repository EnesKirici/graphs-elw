<?php

namespace App\Jobs;

use App\Services\RiotApi\MatchService;
use App\Services\RiotApi\MatchStatisticsService;
use App\Services\RiotApi\RiotApiService;
use App\Services\WorkerControlService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;

/**
 * Bir profilin TÜM sezon maç özetlerini ARKA PLANDA kurar (async build).
 *
 * Soğuk profil ilk açılışında SummonerController bunu kuyruğa atar; sayfa son 10
 * maçla anında açılır, bu iş sezonu tamamlar → sezon panelleri sonra kendiliğinden
 * dolar (frontend season-status'u poll eder).
 *
 * Dev key rate-limit'i: ensureSeasonSummaries 429'da KISMİ döner (fırlatmaz), bu
 * yüzden eksik kalırsa cooldown kadar bekleyip KENDİNİ yeniden tetikler → sezon
 * tamamlanana dek. İş bitince sezon-stat cache'lerini temizler ki paneller tazelensin.
 */
class BuildSeasonProfileJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /** Kendi zincirini kurar; framework retry'ına bırakılmaz. */
    public int $tries = 1;
    public int $timeout = 280;

    /** Tur başına en fazla çekilecek eksik maç. */
    private const CHUNK = 20;
    /** Dev key 2dk penceresinde bu kadar kullanılmışsa build o turda bekler. Yüksek
     *  tutuldu: boşta bütçe çürümesin (eşzamanlı ziyaretçi nadir); asıl canlı-koruma
     *  shouldYield — kullanıcı gezinince build zaten anında durur. ~20 pay bir profile yeter. */
    private const BUDGET_RESERVE = 80;
    /** Sonsuz döngü koruması — yield turları da sayar. */
    private const MAX_ROUNDS = 400;

    /** Önceki turda kurulmuş özet sayısı — stall (ilerleme yok) tespiti için.
     *  Sınıf düzeyinde default: kuyrukta bekleyen ESKİ payload deserialize edilse
     *  bile ilklendirilmiş kalır (typed-property init hatasını önler). */
    public int $prevHave = -1;

    public function __construct(
        public string $puuid,
        public int $round = 1,
        int $prevHave = -1,
    ) {
        $this->prevHave = $prevHave;
    }

    public function handle(MatchService $match, WorkerControlService $worker): void
    {
        // Bu zincir yaşadıkça "building" bayrağını taze tut (uzun yield'lerde 15dk
        // TTL'i dolup profil yanlışlıkla "ready + partial" görünmesin).
        Cache::put("season:building:{$this->puuid}", true, 900);

        // ── BÜTÇE / KULLANICI KORUMASI ────────────────────────────────
        // Site kullanıcısı aktifse (son ~8sn Riot isteği), cooldown varsa, ya da dev key
        // 2dk bütçesi eşiği (55) aştıysa → BU TURDA KURMA; kısa süre sonra tekrar dene.
        // Aynı state (round+1, prevHave KORUNUR) → yield stall SAYILMAZ, canlıya pay kalır.
        if ($this->round < self::MAX_ROUNDS
            && ($worker->shouldYield() || RiotApiService::appUsed() >= self::BUDGET_RESERVE)) {
            self::dispatch($this->puuid, $this->round + 1, $this->prevHave)->delay(10);

            return;
        }

        // Sınırlı bir öbek kur (rate-limit'te getMatchDetailsTransient içeride kısmi kalır).
        try {
            $match->ensureSeasonSummaries($this->puuid, self::CHUNK);
        } catch (\Throwable $e) {
            // beklenmedik hata → bir sonraki turda tekrar denenir
        }

        [$have, $total] = $match->seasonProgress($this->puuid);
        Cache::put("season:progress:{$this->puuid}", compact('have', 'total'), 1800);

        // Devam kararı: hâlâ eksik VAR + tur limiti aşılmadı + (bu turda İLERLEME oldu
        // VEYA şu an rate-limit'liyiz). İlerleme yok + rate-limit de yoksa, kalan maçlar
        // kurulamıyor demektir (remake/geçersiz) → partial kabul edip bitir; sonsuz döngü yok.
        $cooldown    = Cache::get('riot:rate_limit_cooldown');
        $rateLimited = $cooldown && time() < (int) $cooldown;
        $progressed  = $have > $this->prevHave;

        if ($total > 0 && $have < $total && $this->round < self::MAX_ROUNDS && ($progressed || $rateLimited)) {
            $delay = $rateLimited ? max(2, (int) $cooldown - time() + 2) : 3;
            self::dispatch($this->puuid, $this->round + 1, $have)->delay($delay);

            return;
        }

        // Tamamlandı → sezon-stat cache'lerini temizle (taze hesaplansın) + bayraklar.
        foreach (MatchStatisticsService::profileCacheKeys($this->puuid) as $key) {
            Cache::forget($key);
        }
        Cache::forget("season:building:{$this->puuid}");
        Cache::put("season:ready:{$this->puuid}", true, 86400);
    }
}
