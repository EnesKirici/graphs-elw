<?php

namespace App\Console\Commands;

use App\Models\MatchRecord;
use App\Models\ProcessedMatch;
use App\Services\BuildAggregationService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Eski maçlar için champion_matchups'ın ROL metriklerini doldurur:
 * emilen hasar / iyileştirme+kalkan / CC süresi.
 *
 * Riot API'ye GİTMEZ — stored `matches` ham verisinden okur (kota harcamaz, worker
 * kapalıyken de çalışır). games/wins ve KDA sütunlarına DOKUNMAZ; yalnız n_role +
 * üç toplamı ekler → ortalama = toplam / n_role. Bayrak: matchup_role_done.
 *
 * Kardeş komut builds:backfill-matchup-stats ile aynı sözleşme ve aynı desen.
 */
class BackfillMatchupRole extends Command
{
    protected $signature = 'builds:backfill-matchup-role
        {--chunk=500 : Tur başına maç}
        {--limit=0 : En fazla bu kadar maç işle (0 = hepsi)}
        {--reset : Rol sütunlarını SIFIRLA ve hepsini baştan doldur}';

    protected $description = 'champion_matchups rol metriklerini (emilen hasar / şifa+kalkan / CC) eldeki maçlardan doldurur';

    public function handle(BuildAggregationService $agg): int
    {
        /*
          --reset: yeni bir rol sütunu eklendiğinde sayaçları sıfırdan kurar.
          Neden ayrı bayrak değil: her yeni sütun için bir `*_done` sütunu açmak
          processed_matches'i şişiriyor. Toplamlar aynı paydayı (n_role) paylaştığı
          için hepsini birlikte yeniden saymak hem tutarlı hem ucuz (~10 dk, Riot
          isteği YOK). Worker kapalıyken çalıştır — yoksa sıfırlama ile yeniden
          doldurma arasında işlenen maçlar kaybolur.
        */
        if ($this->option('reset')) {
            $this->warn('Rol sütunları sıfırlanıyor (n_role, sum_taken, sum_heal_shield, sum_cc, sum_heal_self, sum_immob)...');
            DB::table('champion_matchups')->update([
                'n_role' => 0, 'sum_taken' => 0, 'sum_heal_shield' => 0,
                'sum_cc' => 0, 'sum_heal_self' => 0, 'sum_immob' => 0,
            ]);
            DB::table('processed_matches')->update(['matchup_role_done' => false]);
            $this->info('Sıfırlandı.');
        }

        $cutoff = now()->subMinutes(30); // kuyruktaki yeni job'larla yarışma
        $limit = (int) $this->option('limit');

        $pending = ProcessedMatch::where('matchup_role_done', false)
            ->where('processed_at', '<', $cutoff)->count();
        $this->info("Bekleyen maç: {$pending}" . ($limit > 0 ? " (bu turda en fazla {$limit})" : ''));

        $done = $skipped = 0;
        $t0 = microtime(true);

        while (true) {
            if ($limit > 0 && $done + $skipped >= $limit) {
                break;
            }
            $take = (int) $this->option('chunk');
            if ($limit > 0) {
                $take = min($take, $limit - ($done + $skipped));
            }

            $batch = ProcessedMatch::where('matchup_role_done', false)
                ->where('processed_at', '<', $cutoff)
                ->orderBy('match_id')
                ->limit($take)
                ->pluck('match_id');

            if ($batch->isEmpty()) {
                break;
            }

            // [patch|champ|pos|opp|oppPos] => [patch, champ, pos, opp, oppPos, n, taken, hs, cc, healSelf, immob]
            $acc = [];
            foreach ($batch as $matchId) {
                $data = MatchRecord::find($matchId)?->data;
                if (! $data) {
                    $skipped++; // ham veri prune edilmiş → bayrak yine set edilir, tekrar denenmesin
                    continue;
                }
                foreach ($agg->matchupRows($data) as [$patch, $champ, $pos, $opp, $oppPos, , , , , , , $taken, $hs, $cc, $healSelf, $immob]) {
                    // KDA backfill'inden FARKLI: çapraz satırlar (ADC↔karşı support) da
                    // doldurulur. Sebep: rol metrikleri o satırların games/wins'ine bağlı
                    // değil, kendi paydası (n_role) var → çift sayım riski yok ve alt
                    // koridor kıyas paneli de bu eksenlerle çalışıyor.
                    $key = "{$patch}|{$champ}|{$pos}|{$opp}|{$oppPos}";
                    $acc[$key] ??= [$patch, $champ, $pos, $opp, $oppPos, 0, 0, 0, 0, 0, 0];
                    $acc[$key][5]++;             // n_role
                    $acc[$key][6] += $taken;     // sum_taken
                    $acc[$key][7] += $hs;        // sum_heal_shield (MÜTTEFİĞE)
                    $acc[$key][8] += $cc;        // sum_cc (yavaşlatma dâhil, saniye)
                    $acc[$key][9] += $healSelf;  // sum_heal_self (KENDİNE)
                    $acc[$key][10] += $immob;    // sum_immob (sert CC, adet)
                }
                $done++;
            }

            $now = now()->toDateTimeString();
            foreach (array_chunk(array_values($acc), 500) as $rows) {
                $ph = [];
                $bind = [];
                foreach ($rows as $r) {
                    $ph[] = '(?,?,?,?,?,?,?,?,?,?,?,?,?)';
                    array_push($bind, $r[0], $r[1], $r[2], $r[3], $r[4], $r[5], $r[6], $r[7], $r[8], $r[9], $r[10], $now, $now);
                }
                // games/wins INSERT'te yok (default 0), UPDATE'te DOKUNULMAZ.
                DB::statement(
                    'INSERT INTO champion_matchups (patch, champion_id, position, opponent_id, opponent_position,'
                    . ' n_role, sum_taken, sum_heal_shield, sum_cc, sum_heal_self, sum_immob, created_at, updated_at) VALUES '
                    . implode(',', $ph)
                    . ' ON DUPLICATE KEY UPDATE n_role = n_role + VALUES(n_role),'
                    . ' sum_taken = sum_taken + VALUES(sum_taken),'
                    . ' sum_heal_shield = sum_heal_shield + VALUES(sum_heal_shield),'
                    . ' sum_cc = sum_cc + VALUES(sum_cc),'
                    . ' sum_heal_self = sum_heal_self + VALUES(sum_heal_self),'
                    . ' sum_immob = sum_immob + VALUES(sum_immob), updated_at = VALUES(updated_at)',
                    $bind,
                );
            }

            ProcessedMatch::whereIn('match_id', $batch)->update(['matchup_role_done' => true]);

            $hiz = $done > 0 ? ($done + $skipped) / max(0.001, microtime(true) - $t0) : 0;
            $kalan = max(0, $pending - $done - $skipped);
            $this->info(sprintf('  işlendi: %d · veri yok: %d · %.0f maç/sn · kalan ~%s',
                $done, $skipped, $hiz, $hiz > 0 ? gmdate('H:i:s', (int) ($kalan / $hiz)) : '?'));
        }

        $this->info("Bitti — işlenen: {$done}, ham verisi olmayan: {$skipped}");

        return self::SUCCESS;
    }
}
