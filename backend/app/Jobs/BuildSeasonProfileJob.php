<?php

namespace App\Jobs;

use App\Services\RiotApi\MatchService;
use App\Services\RiotApi\MatchStatisticsService;
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

    public function handle(MatchService $match): void
    {
        // Bir tur özet kur (rate-limit'te kısmi kalır, fırlatmaz).
        try {
            $match->ensureSeasonSummaries($this->puuid);
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

        if ($total > 0 && $have < $total && $this->round < 60 && ($progressed || $rateLimited)) {
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
