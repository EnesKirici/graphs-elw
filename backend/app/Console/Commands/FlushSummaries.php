<?php

namespace App\Console\Commands;

use App\Models\MatchSummary;
use Illuminate\Console\Command;

/**
 * match_summaries'i temizler. ELW/badge ağırlıkları (admin ayarı) değişince özetlerdeki
 * önceden hesaplanmış skorlar bayatlar → bu komutla temizlenir, sonraki profil
 * açılışında yeni ayarla yeniden kurulur. (stat_json ham veri olduğu için season-stats
 * etkilenmez; asıl gereken liste skorlarının tazelenmesidir.)
 */
class FlushSummaries extends Command
{
    protected $signature = 'summaries:flush';

    protected $description = 'match_summaries tablosunu temizler (ELW/badge ayarı değişince çalıştır)';

    public function handle(): int
    {
        $n = MatchSummary::count();
        MatchSummary::truncate();
        $this->info("{$n} özet temizlendi. Profiller sonraki açılışta yeni ayarla yeniden kurar.");

        return self::SUCCESS;
    }
}
