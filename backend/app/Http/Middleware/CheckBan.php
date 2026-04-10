<?php

namespace App\Http\Middleware;

use Closure;
use App\Models\BannedIp;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

class CheckBan
{
    // Bilinen bot User-Agent pattern'leri — gerçek tarayıcıda ASLA bulunmaz
    private const BOT_PATTERNS = [
        'python-requests', 'python-urllib', 'scrapy', 'httpclient',
        'go-http-client', 'libwww', 'apache-httpclient',
        'nikto', 'sqlmap', 'nmap', 'masscan',
        'dirbuster', 'gobuster', 'wfuzz', 'hydra',
        'burpsuite', 'zap/', 'acunetix', 'nessus', 'arachni',
    ];

    // Hassas dosya erişimi — normal kullanıcı ASLA denemez
    private const CRITICAL_PATHS = [
        '.env', '.git', '.htaccess', '.aws', '.ssh',
        'credentials', 'id_rsa', 'wp-config',
        'config.php', '.docker', 'docker-compose',
    ];

    // Bot tarama path'leri — normal kullanıcı ASLA ziyaret etmez
    private const SCAN_PATHS = [
        'wp-admin', 'wp-login', 'wordpress', 'phpmyadmin',
        'xmlrpc', 'wp-content', 'wp-includes',
        'eval-stdin', 'vendor/phpunit', 'cgi-bin',
        'shell.php', 'cmd.php', 'admin.php',
        'setup.php', 'install.php',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $ip = $request->ip();

        // 1. Banlı mı kontrol et (cache ile hızlandır)
        if (Cache::get('banned:' . $ip)) {
            return response()->json(['error' => 'Engellendi.'], 403);
        }

        $ban = BannedIp::getActiveBan($ip);
        if ($ban) {
            Cache::put('banned:' . $ip, true, 300);
            return response()->json(['error' => 'Engellendi.'], 403);
        }

        // 2. Bot User-Agent → %100 bot, direkt ban
        $ua = strtolower($request->userAgent() ?? '');
        if ($ua && $this->matchesAny($ua, self::BOT_PATTERNS)) {
            $this->autoBan($ip, 'Bot UA: ' . substr($request->userAgent() ?? '', 0, 80), 'bot');
            return response()->json(['error' => 'Engellendi.'], 403);
        }

        // 3. Hassas dosya erişimi → %100 saldırı, direkt ban
        $path = strtolower($request->path());
        if ($this->matchesAny($path, self::CRITICAL_PATHS)) {
            $this->autoBan($ip, "HASSAS DOSYA ERISIMI: /{$path}", 'critical');
            return response()->json(['error' => 'Engellendi.'], 403);
        }

        // 4. Tarama path'leri → %100 bot, direkt ban
        if ($this->matchesAny($path, self::SCAN_PATHS)) {
            $this->autoBan($ip, "Tarama algilandi: /{$path}", 'scan');
            return response()->json(['error' => 'Engellendi.'], 403);
        }

        return $next($request);
    }

    private function matchesAny(string $haystack, array $patterns): bool
    {
        foreach ($patterns as $p) {
            if (str_contains($haystack, $p)) return true;
        }
        return false;
    }

    private function autoBan(string $ip, string $reason, string $severity = 'bot'): void
    {
        BannedIp::ban($ip, $reason, 0, true);
        Cache::put('banned:' . $ip, true, 300);

        // Dashboard'a anlık bildirim
        $alerts = Cache::get('ban_alerts', []);
        $alerts[] = [
            'ip'       => $ip,
            'reason'   => $reason,
            'severity' => $severity,
            'time'     => now()->toIso8601String(),
        ];
        Cache::put('ban_alerts', \array_slice($alerts, -50), 86400);
    }
}
