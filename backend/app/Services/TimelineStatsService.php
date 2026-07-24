<?php

namespace App\Services;

use App\Services\RiotApi\DataDragonService;

/**
 * Maç timeline'ından participant başına build anahtarları çıkarır:
 *   skill_order  : temel yeteneklerin max'lanma önceliği ("Q>E>W")
 *   starter      : ilk alışveriş (ilk 90 sn) item kombinasyonu ("1055-2003")
 *   item_slot1-5 : satın alma SIRASINA göre ilk 5 bitmiş eşya
 *
 * Hem ham Riot timeline'ı hem MatchDataService'in slim formatı ile çalışır
 * (event alan adları ikisinde de aynı: type/timestamp/participantId/itemId/skillSlot).
 */
class TimelineStatsService
{
    private const STARTER_WINDOW_MS = 90_000;
    private const SKILL_LETTERS = [1 => 'Q', 2 => 'W', 3 => 'E', 4 => 'R'];

    /** @var array<int,bool>|null bitmiş eşya id seti (into boş + depth>=2) */
    private ?array $completedSet = null;

    public function __construct(
        private DataDragonService $ddragon,
    ) {}

    /**
     * Timeline'dan tüm participant'ların build anahtarlarını çıkarır.
     * @return array<int, array<array{0:string,1:string}>> participantId → [[category, key], ...]
     */
    public function extractAll(array $timeline): array
    {
        $byParticipant = [];

        foreach ($timeline['info']['frames'] ?? [] as $frame) {
            foreach ($frame['events'] ?? [] as $event) {
                $pid = (int) ($event['participantId'] ?? 0);
                if ($pid < 1 || $pid > 10) {
                    continue;
                }
                $byParticipant[$pid][] = $event;
            }
        }

        $out = [];
        foreach ($byParticipant as $pid => $events) {
            $keys = [];

            if ($order = $this->skillOrder($events)) {
                $keys[] = ['skill_order', $order];
            }
            if ($starter = $this->starterKey($events)) {
                $keys[] = ['starter', $starter];
            }
            foreach ($this->completedBuyOrder($events) as $i => $itemId) {
                if ($i >= 5) {
                    break;
                }
                $keys[] = ['item_slot' . ($i + 1), (string) $itemId];
            }

            $out[$pid] = $keys;
        }

        return $out;
    }

    /**
     * Temel yeteneklerin (Q/W/E) max'lanma önceliği. Önce 5 puana ulaşma sırası,
     * 5'e ulaşmayanlar toplam puana göre; eşitlikte erken basılan önde.
     */
    private function skillOrder(array $events): ?string
    {
        $points = [1 => 0, 2 => 0, 3 => 0];
        $maxedAt = [];     // slot → 5. puanın timestamp'i
        $firstAt = [];     // slot → ilk puanın timestamp'i

        foreach ($events as $e) {
            if (($e['type'] ?? '') !== 'SKILL_LEVEL_UP' || ($e['levelUpType'] ?? 'NORMAL') !== 'NORMAL') {
                continue;
            }
            $slot = (int) ($e['skillSlot'] ?? 0);
            if (! isset($points[$slot])) {
                continue; // R (4) max sırasına girmez
            }
            $points[$slot]++;
            $firstAt[$slot] ??= (int) ($e['timestamp'] ?? 0);
            if ($points[$slot] === 5) {
                $maxedAt[$slot] = (int) ($e['timestamp'] ?? 0);
            }
        }

        // En az 2 farklı temel yeteneğe puan basılmış olsun (remake/AFK gürültüsü)
        $used = array_filter($points);
        if (count($used) < 2) {
            return null;
        }

        $slots = [1, 2, 3];
        usort($slots, function ($a, $b) use ($points, $maxedAt, $firstAt) {
            $aMax = $maxedAt[$a] ?? PHP_INT_MAX;
            $bMax = $maxedAt[$b] ?? PHP_INT_MAX;
            if ($aMax !== $bMax) {
                return $aMax <=> $bMax;               // önce max'layan önde
            }
            if ($points[$a] !== $points[$b]) {
                return $points[$b] <=> $points[$a];    // sonra puan çokluğu
            }
            return ($firstAt[$a] ?? PHP_INT_MAX) <=> ($firstAt[$b] ?? PHP_INT_MAX);
        });

        return implode('>', array_map(fn ($s) => self::SKILL_LETTERS[$s], $slots));
    }

    /** İlk 90 saniyedeki alışveriş (UNDO düşülmüş), id'ler sıralı "-" ile birleşik. */
    private function starterKey(array $events): ?string
    {
        $bought = [];
        foreach ($events as $e) {
            $ts = (int) ($e['timestamp'] ?? 0);
            if ($ts > self::STARTER_WINDOW_MS) {
                break;
            }
            $type = $e['type'] ?? '';
            if ($type === 'ITEM_PURCHASED') {
                $bought[] = (int) ($e['itemId'] ?? 0);
            } elseif ($type === 'ITEM_UNDO') {
                $undo = (int) ($e['beforeId'] ?? 0);
                $idx = array_search($undo, array_reverse($bought, true), true);
                if ($idx !== false) {
                    unset($bought[$idx]);
                }
            }
        }
        $bought = array_values(array_filter($bought));
        if (! $bought || count($bought) > 5) {
            return null; // boş ya da anormal (ARAM benzeri gürültü)
        }
        sort($bought);

        return implode('-', $bought);
    }

    /** Satın alma sırasına göre bitmiş eşyalar (UNDO düşülmüş, ardışık tekrar birleşik). */
    private function completedBuyOrder(array $events): array
    {
        $completed = $this->completedSet();
        $order = [];
        foreach ($events as $e) {
            $type = $e['type'] ?? '';
            if ($type === 'ITEM_PURCHASED') {
                $id = (int) ($e['itemId'] ?? 0);
                if (isset($completed[$id])) {
                    $order[] = $id;
                }
            } elseif ($type === 'ITEM_UNDO') {
                $undo = (int) ($e['beforeId'] ?? 0);
                if ($undo && ($idx = array_search($undo, array_reverse($order, true), true)) !== false) {
                    unset($order[$idx]);
                    $order = array_values($order);
                }
            }
        }

        return array_values(array_unique($order));
    }

    /** @return array<int,bool> */
    private function completedSet(): array
    {
        if ($this->completedSet !== null) {
            return $this->completedSet;
        }
        $this->completedSet = [];
        try {
            foreach ($this->ddragon->getItems() as $id => $item) {
                if (empty($item['into']) && (int) ($item['depth'] ?? 1) >= 2) {
                    $this->completedSet[(int) $id] = true;
                }
            }
        } catch (\Throwable) {
            // DDragon yoksa boş set → item_slot sayaçları bu turda atlanır
        }

        return $this->completedSet;
    }
}
