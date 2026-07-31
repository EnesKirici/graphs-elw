<?php

namespace App\Services;

use App\Models\AdminSetting;
use App\Models\StatPatch;
use App\Services\RiotApi\DataDragonService;
use Carbon\Carbon;
use Illuminate\Support\Facades\Schema;
use Throwable;

/**
 * Patch (yama) mantığının TEK kaynağı: güncel patch, bir maçın hangi patch'e ait
 * olduğu (gameVersion → yoksa tarih) ve tutulacak/prune penceresi.
 *
 * Neden ayrı servis: gameVersion bir dönem maç kaydında trim'lendiği için eski
 * maçlarda YOK. O maçları gameCreation tarihinden patch'e atarız. Böylece meta
 * istatistikleri 6 aylık veriyi tek patch'e yığmak yerine gerçek patch'e oturur.
 * Patch mantığı eskiden ChampionStatsService + BuildAggregationService'te ayrı ayrı
 * duruyordu → burada toplanır.
 *
 * Patch başlangıç tarihleri ÖNCE veriden gelir (stat_patches.first_game_at —
 * stats:rebuild her turda patch başına en eski maçı yazar), yoksa config
 * elwgraphs.meta.patch_starts'a düşer. Yani yeni yamada elle satır eklemek
 * GEREKMEZ; bölge yamayı ne zaman alırsa başlangıç oraya oturur.
 */
class PatchService
{
    /** startsDesc() tek istek içinde birden çok kez çağrılıyor (rebuild döngüsü) — DB'ye bir kez git. */
    private ?array $startsMemo = null;

    public function __construct(private DataDragonService $ddragon) {}

    /** DataDragon'a göre güncel patch bucket ("16.13.1" → "16.13"). */
    public function current(): string
    {
        return $this->bucket($this->ddragon->getCurrentVersion()) ?? '';
    }

    /**
     * Bir maçı patch bucket'ına ata. gameVersion varsa doğrudan ondan; yoksa
     * (eski/trim'li kayıt) gameCreation tarihinden. Çözülemezse null → çağıran atlar.
     *
     * @param array $info Maç `info` bloğu (gameVersion + gameCreation içerebilir).
     */
    public function patchForMatch(array $info): ?string
    {
        $gv = (string) ($info['gameVersion'] ?? '');
        if ($gv !== '') {
            return $this->bucket($gv);
        }

        return $this->patchForDate((int) ($info['gameCreation'] ?? 0));
    }

    /** ms epoch → o tarihte yürürlükteki en yeni patch (bkz. startsDesc). Yoksa null. */
    public function patchForDate(int $tsMs): ?string
    {
        if ($tsMs <= 0) {
            return null;
        }
        $when = Carbon::createFromTimestampMs($tsMs);
        foreach ($this->startsDesc() as $patch => $start) {
            if ($when->greaterThanOrEqualTo($start)) {
                return $patch;
            }
        }

        return null; // listelenen en eski patch'ten de eski → bilinmiyor (prune hedefi)
    }

    /**
     * Tutulacak patch'ler (config keep_patches kadar), en yeniden eskiye.
     * Kaynak: DataDragon versions.json → Riot yeni patch atınca pencere OTOMATİK kayar
     * (config'e dokunmadan). Patch BAŞLANGIÇ tarihleri ayrı konu (startsDesc): eski/
     * tarihsel maçları patch'e atamak ve prune eşiği (keepSince) içindir.
     */
    public function keptPatches(): array
    {
        // Meta gösterim + prune penceresi kaç patch (güncel dahil). Panelden ayarlanır
        // (admin_settings: meta_keep_patches), yoksa config yedeği. 1 = yalnız güncel,
        // 2 = güncel+önceki birleşik. Ana sayfa VE tier list bunu kullanır.
        $keep = max(1, (int) AdminSetting::getValue('meta_keep_patches', config('elwgraphs.meta.keep_patches', 2)));

        return $this->ddragon->getRecentPatches($keep);
    }

    /**
     * Prune eşiği: tutulacak en eski patch'in başlangıç günü (00:00). Yoksa null → prune yapma.
     *
     * startsDesc() üzerinden okur (gözlemlenen veri + config yedeği). Eskiden config'i
     * DOĞRUDAN okuyordu: yeni yamada satır eklenmeyince null dönüp matches:prune'u
     * sessizce devre dışı bırakıyordu — 16.15'te tam bu oldu.
     */
    public function keepSince(): ?Carbon
    {
        $kept = $this->keptPatches();
        $oldest = end($kept);

        return $this->startsDesc()[$oldest] ?? null;
    }

    /**
     * Patch başlangıçları (gözlemlenen veri + config yedeği), yeniden eskiye.
     * Dışarıya açık çünkü admin retention paneli AYNI pencereleri kullanmak zorunda —
     * kendi başına config'i parse etmesi iki kaynağın ayrışmasına yol açıyordu.
     *
     * @return array<string, Carbon>
     */
    public function starts(): array
    {
        return $this->startsDesc();
    }

    /**
     * Patch başlangıçları → [patch => Carbon], başlangıç tarihine göre AZALAN (yeni önce).
     *
     * Kaynak sırası: config patch_starts (tohum/yedek) → ÜSTÜNE stat_patches.first_game_at
     * (gözlemlenen gerçek başlangıç). Gözlemlenen değer günün başına yuvarlanır: config
     * semantiği "yama günü" ve ilk toplanan maç yamanın ortasında olabilir; ham saat
     * kullanmak o günün erken maçlarını önceki patch'e atardı.
     */
    private function startsDesc(): array
    {
        if ($this->startsMemo !== null) {
            return $this->startsMemo;
        }

        $out = [];
        foreach (config('elwgraphs.meta.patch_starts', []) as $patch => $date) {
            $out[$patch] = Carbon::parse($date)->startOfDay();
        }

        foreach ($this->observedStarts() as $patch => $at) {
            $out[$patch] = $at;
        }

        uasort($out, fn ($a, $b) => $b <=> $a); // tarih azalan → en yeni patch başta

        return $this->startsMemo = $out;
    }

    /**
     * stats:rebuild'in yazdığı gözlemlenen başlangıçlar → [patch => Carbon].
     *
     * Migration henüz koşmamışsa (deploy sırası) veya DB erişilemiyorsa sessizce
     * boş döner → config'e düşülür. Patch mantığı yüzünden istek patlamasın.
     */
    private function observedStarts(): array
    {
        try {
            if (! Schema::hasColumn('stat_patches', 'first_game_at')) {
                return [];
            }

            return StatPatch::whereNotNull('first_game_at')
                ->pluck('first_game_at', 'patch')
                ->map(fn ($at) => Carbon::parse($at)->startOfDay())
                ->all();
        } catch (Throwable) {
            return [];
        }
    }

    /** "16.13.1" / "16.13.634.5678" → "16.13"; geçersizse null. */
    private function bucket(string $gameVersion): ?string
    {
        $parts = explode('.', $gameVersion);
        if (count($parts) < 2 || $parts[0] === '') {
            return null;
        }

        return $parts[0] . '.' . $parts[1];
    }
}
