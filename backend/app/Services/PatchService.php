<?php

namespace App\Services;

use App\Services\RiotApi\DataDragonService;
use Carbon\Carbon;

/**
 * Patch (yama) mantığının TEK kaynağı: güncel patch, bir maçın hangi patch'e ait
 * olduğu (gameVersion → yoksa tarih) ve tutulacak/prune penceresi.
 *
 * Neden ayrı servis: gameVersion bir dönem maç kaydında trim'lendiği için eski
 * maçlarda YOK. O maçları gameCreation tarihinden patch'e atarız (config
 * elwgraphs.meta.patch_starts). Böylece meta istatistikleri 6 aylık veriyi tek
 * patch'e yığmak yerine gerçek patch'e oturur. Patch mantığı eskiden
 * ChampionStatsService + BuildAggregationService'te ayrı ayrı duruyordu → burada
 * toplanır.
 */
class PatchService
{
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

    /** ms epoch → o tarihte yürürlükteki en yeni patch (config patch_starts). Yoksa null. */
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
     * (config'e dokunmadan). config patch_starts yalnız eski/tarihsel maçları patch'e
     * atamak ve prune eşiği (keepSince) içindir.
     */
    public function keptPatches(): array
    {
        $keep = max(1, (int) config('elwgraphs.meta.keep_patches', 2));

        return $this->ddragon->getRecentPatches($keep);
    }

    /** Prune eşiği: tutulacak en eski patch'in başlangıç günü (00:00). Yoksa null → prune yapma. */
    public function keepSince(): ?Carbon
    {
        $kept = $this->keptPatches();
        $oldest = end($kept);
        $starts = config('elwgraphs.meta.patch_starts', []);

        return isset($starts[$oldest]) ? Carbon::parse($starts[$oldest])->startOfDay() : null;
    }

    /** config patch_starts → [patch => Carbon], başlangıç tarihine göre AZALAN (yeni önce). */
    private function startsDesc(): array
    {
        $out = [];
        foreach (config('elwgraphs.meta.patch_starts', []) as $patch => $date) {
            $out[$patch] = Carbon::parse($date)->startOfDay();
        }
        uasort($out, fn ($a, $b) => $b <=> $a); // tarih azalan → en yeni patch başta

        return $out;
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
