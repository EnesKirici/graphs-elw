<?php

namespace App\Services;

use App\Models\LpSnapshot;

/**
 * LP snapshot kaydı + maç-başına LP değişimi hesabı.
 *
 * Daha önce SummonerController içinde private'di; hem profil yenileme (controller)
 * hem de worker (lp:capture) aynı mantığı kullansın diye servise taşındı.
 * Controller davranışı birebir korunur.
 */
class LpTrackingService
{
    /**
     * Her kuyruğun EN YENİ ranked maçına o anki LP'yi yaz (match_id dedup → tekrar yazmaz).
     *
     * @param array $newest ['solo' => matchId|null, 'flex' => matchId|null]
     * @return int yazılan yeni snapshot sayısı
     */
    public function recordSnapshots(string $puuid, array $ranked, array $newest): int
    {
        $written = 0;
        try {
            foreach (['solo' => 'RANKED_SOLO_5x5', 'flex' => 'RANKED_FLEX_SR'] as $key => $queue) {
                $data = $ranked[$key] ?? null;
                if (!$data || !isset($data['lp'])) continue;

                $matchId = $newest[$key] ?? null;
                if (!$matchId) continue;

                $exists = LpSnapshot::where('puuid', $puuid)
                    ->where('match_id', $matchId)
                    ->exists();
                if ($exists) continue;

                LpSnapshot::create([
                    'puuid'    => $puuid,
                    'queue'    => $queue,
                    'match_id' => $matchId,
                    'tier'     => $data['tier'],
                    'rank'     => $data['rank'],
                    'lp'       => $data['lp'],
                ]);
                $written++;
            }
        } catch (\Exception $e) {}

        return $written;
    }

    /**
     * Her maça LP değişimini hesaplayıp ekle (bitişik snapshot'lar arası; tutarlılık kontrolleri).
     * SummonerController'dan birebir taşındı.
     */
    public function attachLpChanges(string $puuid, array $matches): array
    {
        $snapshots = LpSnapshot::where('puuid', $puuid)
            ->orderBy('id', 'desc')
            ->get()
            ->keyBy('match_id');

        $soloSnapshots = LpSnapshot::where('puuid', $puuid)
            ->where('queue', 'RANKED_SOLO_5x5')
            ->orderBy('id', 'desc')
            ->get();
        $flexSnapshots = LpSnapshot::where('puuid', $puuid)
            ->where('queue', 'RANKED_FLEX_SR')
            ->orderBy('id', 'desc')
            ->get();

        $rankedOrder = ['RANKED_SOLO_5x5' => [], 'RANKED_FLEX_SR' => []];
        foreach ($matches as $m) {
            $qt = $m['queueType'] ?? '';
            $q  = $qt === 'SoloQ' ? 'RANKED_SOLO_5x5' : ($qt === 'Flex' ? 'RANKED_FLEX_SR' : null);
            if ($q && isset($m['matchId'])) $rankedOrder[$q][] = $m['matchId'];
        }

        foreach ($matches as &$m) {
            $m['lpChange'] = null;
            $matchId = $m['matchId'] ?? null;
            if (!$matchId) continue;

            $snap = $snapshots[$matchId] ?? null;
            if (!$snap) continue;

            $list = $snap->queue === 'RANKED_SOLO_5x5' ? $soloSnapshots : $flexSnapshots;
            $found = false;
            $prevSnap = null;
            foreach ($list as $s) {
                if ($found) { $prevSnap = $s; break; }
                if ($s->match_id === $matchId) $found = true;
            }
            if (!$prevSnap) continue;

            $order = $rankedOrder[$snap->queue] ?? [];
            $iCur  = array_search($matchId, $order, true);
            $iPrev = array_search($prevSnap->match_id, $order, true);
            if ($iCur === false || $iPrev === false || $iPrev !== $iCur + 1) continue;

            $currentTotal = $this->lpToAbsolute($snap->tier, $snap->rank, $snap->lp);
            $prevTotal    = $this->lpToAbsolute($prevSnap->tier, $prevSnap->rank, $prevSnap->lp);
            $diff = $currentTotal - $prevTotal;

            $win = $m['win'] ?? null;
            if ($win === true && $diff < 0) continue;
            if ($win === false && $diff > 0) continue;

            if (abs($diff) > 60) continue;

            $m['lpChange'] = $diff;
        }
        unset($m);

        return $matches;
    }

    /**
     * Tier+Rank+LP → mutlak sayı (LP farkı için). Iron IV 0LP = 0, Master+ tek division.
     */
    public function lpToAbsolute(string $tier, string $rank, int $lp): int
    {
        $tiers = ['IRON' => 0, 'BRONZE' => 400, 'SILVER' => 800, 'GOLD' => 1200, 'PLATINUM' => 1600, 'EMERALD' => 2000, 'DIAMOND' => 2400, 'MASTER' => 2800, 'GRANDMASTER' => 2800, 'CHALLENGER' => 2800];
        $ranks = ['IV' => 0, 'III' => 100, 'II' => 200, 'I' => 300];

        $base = $tiers[strtoupper($tier)] ?? 0;
        $rankOffset = $ranks[$rank] ?? 0;

        if (in_array(strtoupper($tier), ['MASTER', 'GRANDMASTER', 'CHALLENGER'])) {
            return $base + $lp;
        }

        return $base + $rankOffset + $lp;
    }
}
