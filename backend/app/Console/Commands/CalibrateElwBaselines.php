<?php

namespace App\Console\Commands;

use App\Models\MatchRecord;
use App\Services\RiotApi\ElwScoreService;
use Illuminate\Console\Command;

/**
 * ELW ROLE_BASELINE kalibrasyonu — depolanan maçların ham (baseline öncesi) ELW skorlarını
 * role göre ortalayıp önerilen yeni baseline'ları raporlar. HİÇBİR ŞEYİ DEĞİŞTİRMEZ; çıktıyı
 * ElwScoreService::ROLE_BASELINE'a elle taşırsın. ROLE_W her değiştiğinde yeniden çalıştırılmalı.
 *
 *   php artisan elw:calibrate-baselines
 *   php artisan elw:calibrate-baselines --min-duration=600 --recent=1000
 */
class CalibrateElwBaselines extends Command
{
    protected $signature = 'elw:calibrate-baselines
        {--min-duration=600 : Bu saniyenin altındaki maçları atla (remake/erken surrender)}
        {--recent=0 : Sadece en yeni N maçı kullan (0 = hepsi). Yeni maçlar tam alan setine sahip}
        {--queues=400,420,430,440,490,700 : Dahil edilecek queueId listesi (SR rolleri olanlar)}';

    protected $description = 'Depolanan maçlardan role-göre ham ELW ortalamasını ölçer, önerilen ROLE_BASELINE\'ı raporlar';

    public function handle(ElwScoreService $elw): int
    {
        $minDur  = (int) $this->option('min-duration');
        $recent  = (int) $this->option('recent');
        $queues  = array_map('intval', array_filter(explode(',', (string) $this->option('queues'))));

        // role => ['raws' => float[]]
        $byRole = [];
        $matchCount = 0;
        $skipped = 0;

        $query = MatchRecord::query()->whereIn('queue_id', $queues);
        if ($recent > 0) {
            $query->orderByDesc('game_creation')->limit($recent);
        }

        $this->info('Maçlar işleniyor...');
        $bar = $this->output->createProgressBar();

        $process = function (MatchRecord $m) use ($elw, $minDur, &$byRole, &$matchCount, &$skipped, $bar) {
            $info = $m->data['info'] ?? null;
            $dur  = $info['gameDuration'] ?? $m->game_duration ?? 0;
            $parts = $info['participants'] ?? null;
            if (!$parts || count($parts) < 6 || $dur < $minDur) {
                $skipped++;
                return;
            }
            foreach ($elw->participantRawScores($parts, $dur) as $ps) {
                // pozisyonu çözülemeyenler MIDDLE'a düşer; rolü gerçekten boş olanı atla
                $byRole[$ps['role']]['raws'][] = $ps['raw'];
            }
            $matchCount++;
            $bar->advance();
        };

        if ($recent > 0) {
            foreach ($query->get() as $m) { $process($m); }
        } else {
            $query->chunkById(300, function ($rows) use ($process) {
                foreach ($rows as $m) { $process($m); }
            }, 'match_id');
        }
        $bar->finish();
        $this->newLine(2);

        if ($matchCount === 0) {
            $this->error('Uygun maç bulunamadı (queue/süre filtresini kontrol et).');
            return self::FAILURE;
        }

        // Mevcut baseline'ı reflection ile oku (kopyalama yok → drift olmaz)
        $current = (new \ReflectionClass(ElwScoreService::class))->getConstant('ROLE_BASELINE');

        $order = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY_ENCHANTER', 'UTILITY_DAMAGE', 'UTILITY_TANK'];
        $rows = [];
        $suggested = [];
        foreach ($order as $role) {
            $raws = $byRole[$role]['raws'] ?? [];
            $n = count($raws);
            if ($n === 0) {
                $rows[] = [$role, 0, '—', '—', '—', $current[$role] ?? '—', '—'];
                continue;
            }
            sort($raws);
            $mean = array_sum($raws) / $n;
            $median = $raws[intdiv($n, 2)];
            $variance = 0.0;
            foreach ($raws as $r) { $variance += ($r - $mean) ** 2; }
            $std = sqrt($variance / $n);
            $cur = $current[$role] ?? null;
            $new = round($mean, 2);
            $suggested[$role] = $new;
            $delta = $cur !== null ? round(($new - $cur) / $cur * 100) : null;
            $rows[] = [
                $role,
                $n,
                number_format($mean, 2),
                number_format($median, 2),
                number_format($std, 2),
                $cur !== null ? number_format($cur, 2) : '—',
                $delta !== null ? sprintf('%+d%%', $delta) : '—',
            ];
        }

        $this->info("İşlenen maç: {$matchCount}  ·  atlanan: {$skipped}  ·  min-süre: {$minDur}sn");
        $this->table(
            ['Rol', 'Örnek', 'Ortalama (yeni)', 'Medyan', 'Std', 'Mevcut', 'Δ'],
            $rows
        );

        // Kopyala-yapıştır için hazır blok
        $this->newLine();
        $this->line('// Önerilen ROLE_BASELINE (mean):');
        $parts = [];
        foreach ($order as $role) {
            if (isset($suggested[$role])) {
                $parts[] = "'{$role}' => {$suggested[$role]}";
            }
        }
        // okunur 2 satır
        $this->line("        'TOP' => {$suggested['TOP']}, 'JUNGLE' => {$suggested['JUNGLE']}, 'MIDDLE' => {$suggested['MIDDLE']}, 'BOTTOM' => {$suggested['BOTTOM']},");
        $this->line("        'UTILITY_ENCHANTER' => {$suggested['UTILITY_ENCHANTER']}, 'UTILITY_DAMAGE' => {$suggested['UTILITY_DAMAGE']}, 'UTILITY_TANK' => {$suggested['UTILITY_TANK']},");

        return self::SUCCESS;
    }
}
