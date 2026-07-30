<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Sunucu durumu — CPU/RAM/disk/DB/kuyruk. Metrikler PHP'nin kendi fonksiyonları +
 * /proc + information_schema'dan okunur (shell_exec YOK, ekstra araç YOK).
 */
class ServerController extends Controller
{
    public function status(): JsonResponse
    {
        return response()->json([
            'cpu'   => $this->cpu(),
            'ram'   => $this->ram(),
            'disk'  => $this->disk(),
            'db'    => $this->db(),
            'queue' => [
                'pending' => (int) DB::table('jobs')->count(),
                'failed'  => (int) DB::table('failed_jobs')->count(),
            ],
            'php'   => PHP_VERSION,
            'now'   => now()->toDateTimeString(),
        ]);
    }

    private function cpu(): array
    {
        $load = function_exists('sys_getloadavg') ? sys_getloadavg() : [null, null, null];
        $cores = $this->cores();
        $l1 = (float) ($load[0] ?? 0);

        return [
            'load1'   => round($l1, 2),
            'load5'   => round((float) ($load[1] ?? 0), 2),
            'load15'  => round((float) ($load[2] ?? 0), 2),
            'cores'   => $cores,
            'percent' => $cores ? min(100, (int) round($l1 / $cores * 100)) : null,
        ];
    }

    private function cores(): int
    {
        $info = @file_get_contents('/proc/cpuinfo');

        return $info ? max(1, substr_count($info, 'processor')) : 1;
    }

    private function ram(): array
    {
        $total = $avail = 0;
        $mem = @file_get_contents('/proc/meminfo');
        if ($mem) {
            if (preg_match('/MemTotal:\s+(\d+) kB/', $mem, $m)) {
                $total = (int) $m[1] * 1024;
            }
            if (preg_match('/MemAvailable:\s+(\d+) kB/', $mem, $m)) {
                $avail = (int) $m[1] * 1024;
            }
        }
        $used = max(0, $total - $avail);

        return [
            'total'     => $total,
            'used'      => $used,
            'available' => $avail,
            'percent'   => $total ? (int) round($used / $total * 100) : null,
        ];
    }

    private function disk(): array
    {
        $total = (float) (@disk_total_space('/') ?: 0);
        $free  = (float) (@disk_free_space('/') ?: 0);
        $used  = max(0, $total - $free);

        return [
            'total'   => $total,
            'used'    => $used,
            'free'    => $free,
            'percent' => $total ? (int) round($used / $total * 100) : null,
        ];
    }

    private function db(): array
    {
        // 60 sn cache — information_schema büyük DB'de yavaş olabilir.
        return Cache::remember('server:db_sizes', 60, function () {
            $rows = DB::select(
                "SELECT table_name AS t, (data_length + index_length) AS bytes, table_rows AS rws
                 FROM information_schema.TABLES
                 WHERE table_schema = DATABASE()
                 ORDER BY bytes DESC"
            );

            $total = 0;
            $tables = [];
            foreach ($rows as $r) {
                $total += (int) $r->bytes;
                $tables[] = ['name' => $r->t, 'bytes' => (int) $r->bytes, 'rows' => (int) $r->rws];
            }

            return ['total' => $total, 'tables' => array_slice($tables, 0, 12)];
        });
    }
}
