<?php

namespace App\Services;

use App\Models\ChampionBuild;
use App\Models\ChampionMatchup;
use App\Models\ChampionStat;
use App\Models\ChampionTopPlayer;
use App\Models\StatPatch;
use App\Services\RiotApi\DataDragonService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Tek bir maçı işleyip AGGREGATE sayaçları artırır (INCREMENTAL).
 *
 * ChampionStatsService::aggregateFromMatches() tüm `matches` tablosunu baştan sayar;
 * bu servis ise worker akışında TEK maç işler (ProcessMatchJob'tan çağrılır):
 *   - champion_stats   (ALL + pozisyon + ban)       → tier list / WR / pick / ban
 *   - champion_builds  (keystone / shard / spell / item) → build sayfası
 *   - champion_top_players (oyuncu × şampiyon)       → OTP listeleri / dünya-TR sırası
 *
 * NOT (iskelet): starter item ve skill-max sırası maç TIMELINE'ı gerektirir
 * (matches/{id}/timeline). Şimdilik final item + keystone + shard + spell çiftinden
 * çıkarılıyor; timeline entegrasyonu TODO.
 */
class BuildAggregationService
{
    private const RANKED_QUEUES = [420, 440];

    /** @var array<int,string>|null championId(numeric) → DDragon id */
    private ?array $keyToId = null;

    public function __construct(
        private DataDragonService $ddragon,
        private TimelineStatsService $timelineStats,
    ) {}

    /**
     * Maçın geçerli (ranked, remake değil) olup olmadığını ve patch'ini döndürür.
     * @return array{0:bool,1:string} [geçerli mi, patch]
     */
    private function validateMatch(?array $info): array
    {
        if (! $info || empty($info['participants'])) {
            return [false, ''];
        }
        if (! in_array((int) ($info['queueId'] ?? 0), self::RANKED_QUEUES, true)) {
            return [false, ''];
        }
        if ((int) ($info['gameDuration'] ?? 0) < 300) {
            return [false, ''];
        }
        $patch = $this->patchBucket($info['gameVersion'] ?? '') ?? $this->ddragon->getCurrentVersion();

        return [true, $this->shortPatch($patch)];
    }

    /**
     * Timeline'a bağlı sayaçlar: skill_order / starter / item_slot1-5.
     * Maç sayaçlarından BAĞIMSIZ çalışır (timeline sonradan da işlenebilir).
     */
    public function processTimeline(array $matchData, array $timeline): bool
    {
        [$ok, $patch] = $this->validateMatch($matchData['info'] ?? null);
        if (! $ok) {
            return false;
        }
        $keysByPid = $this->timelineStats->extractAll($timeline);
        if (! $keysByPid) {
            return false;
        }
        $keyToId = $this->keyMap();

        foreach ($matchData['info']['participants'] as $i => $p) {
            $pid = (int) ($p['participantId'] ?? ($i + 1));
            $champId = $keyToId[(int) ($p['championId'] ?? 0)] ?? ($p['championName'] ?? null);
            if (! $champId || empty($keysByPid[$pid])) {
                continue;
            }
            $pos = $p['teamPosition'] ?: 'ALL';
            $win = ! empty($p['win']);
            foreach ($keysByPid[$pid] as [$category, $itemKey]) {
                $this->bumpBuild($patch, $champId, $pos, $category, $itemKey, $win);
            }
        }

        // @15 koridor avantajı (gold/cs/xp farkı) → champion_matchups. Timeline zaten
        // elimizde; ek Riot isteği YOK. Frame SAKLANMAZ, sadece 15. dk anı çıkarılır.
        $this->processLane15($matchData, $timeline, $patch);

        return true;
    }

    /**
     * Timeline'ın ~15. dakika frame'inden her koridor için gold/cs/xp farkını (şampiyon
     * vs karşı koridordaki rakip) çıkarıp champion_matchups'a EKLER (agregat toplam + n15).
     * Frame saklanmaz. 15. dk'ya ulaşmamış maçlar atlanır.
     */
    private function processLane15(array $matchData, array $timeline, string $patch): void
    {
        $frames = $timeline['info']['frames'] ?? [];
        if (count($frames) < 16) {
            return; // maç 15. dk'dan önce bitmiş → @15 anlamlı değil
        }
        $f15 = $frames[15]['participantFrames'] ?? [];
        if (! $f15) {
            return;
        }
        $keyToId = $this->keyMap();

        // pozisyon × takım → [champId, gold, cs, xp]
        $byPos = [];
        foreach ($matchData['info']['participants'] as $i => $p) {
            /*
              participantId SAKLANAN maç kopyasında YOK (match trim'i düşürüyor) →
              eski hâli `(string) ($p['participantId'] ?? 0)` ile herkese "0" veriyordu,
              $f15 anahtarları ise 1..10 → on katılımcının ONU da atlanıyor, @15 hiç
              yazılmıyordu. 2026-08-04 ölçümü: 59.174 maç timeline_done=true, ama
              champion_matchups'ta n15>0 olan satır SIFIR.
              Yukarıdaki build döngüsü aynı sorunu zaten `?? ($i + 1)` ile çözüyordu;
              burası atlanmış. Riot participants dizisi participantId sırasında (1..10)
              gelir, yani indeks+1 doğru karşılıktır.
            */
            $pid = (int) ($p['participantId'] ?? 0) ?: ($i + 1);
            $pos = $p['teamPosition'] ?? '';
            $champId = $keyToId[(int) ($p['championId'] ?? 0)] ?? ($p['championName'] ?? null);
            if (! $pos || ! $champId || empty($f15[$pid])) {
                continue;
            }
            $pf = $f15[$pid];
            $gold = (int) ($pf['totalGold'] ?? 0);
            $cs = (int) ($pf['minionsKilled'] ?? 0) + (int) ($pf['jungleMinionsKilled'] ?? 0);
            $xp = (int) ($pf['xp'] ?? 0);
            $byPos[$pos][(int) ($p['teamId'] ?? 0)] = [$champId, $gold, $cs, $xp];
        }

        foreach ($byPos as $pos => $teams) {
            if (count($teams) !== 2) {
                continue;
            }
            [$a, $b] = array_values($teams);
            if ($a[0] === $b[0]) {
                continue;
            }
            $this->bumpLane15($patch, $a[0], $pos, $b[0], $a[1] - $b[1], $a[2] - $b[2], $a[3] - $b[3]);
            $this->bumpLane15($patch, $b[0], $pos, $a[0], $b[1] - $a[1], $b[2] - $a[2], $b[3] - $a[3]);
        }

        $this->bumpDuoLane15($matchData, $timeline, $byPos);
    }

    /**
     * Aynı takımın ADC+SUPPORT ikilisi için @15 farkları (champion_duo_stats).
     *
     * Rakiplik DEĞİL sinerji: "bu eşle koridorda daha iyi miyim?". İkilinin her iki
     * üyesinin farkı AYRI saklanır (adc_* / sup_*) çünkü sayfa iki perspektiften de
     * açılıyor. Öldürme farkı timeline'ın CHAMPION_KILL olaylarından 15. dk'ya kadar
     * sayılır — maç özetindeki toplam öldürme DEĞİL.
     *
     * @param array $byPos processLane15'in kurduğu pozisyon×takım → [champId, gold, cs, xp]
     */
    private function bumpDuoLane15(array $matchData, array $timeline, array $byPos): void
    {
        $bots = $byPos['BOTTOM'] ?? [];
        $sups = $byPos['UTILITY'] ?? [];
        if (count($bots) !== 2 || count($sups) !== 2) {
            return; // alt koridor verisi eksik/bozuk — güvenme
        }

        // 15. dakikaya kadar şampiyon başına öldürme (takım id'siyle değil, şampiyonla eşlenir).
        $kills = $this->killsBefore15($matchData, $timeline);

        $teamIds = array_keys($bots);
        foreach ($teamIds as $tid) {
            $rakip = $teamIds[0] === $tid ? ($teamIds[1] ?? null) : $teamIds[0];
            if ($rakip === null || ! isset($bots[$rakip], $sups[$tid], $sups[$rakip])) {
                continue;
            }
            [$adc, $aGold, $aCs, $aXp] = $bots[$tid];
            [$rAdc, $rGold, $rCs, $rXp] = $bots[$rakip];
            [$sup, $sGold, $sCs, $sXp] = $sups[$tid];
            [$rSup, $rsGold, $rsCs, $rsXp] = $sups[$rakip];
            if (! $adc || ! $sup) {
                continue;
            }

            $keyCols = ['adc_champion' => $adc, 'support_champion' => $sup];
            \App\Models\ChampionDuoStat::firstOrCreate($keyCols, ['games' => 0, 'wins' => 0]);
            \App\Models\ChampionDuoStat::where($keyCols)->update([
                'n15'        => DB::raw('n15 + 1'),
                'adc_gd15'   => DB::raw('adc_gd15 + (' . (int) ($aGold - $rGold) . ')'),
                'adc_xpd15'  => DB::raw('adc_xpd15 + (' . (int) ($aXp - $rXp) . ')'),
                'adc_csd15'  => DB::raw('adc_csd15 + (' . (int) ($aCs - $rCs) . ')'),
                'adc_kd15'   => DB::raw('adc_kd15 + (' . (int) (($kills[$adc] ?? 0) - ($kills[$rAdc] ?? 0)) . ')'),
                'sup_gd15'   => DB::raw('sup_gd15 + (' . (int) ($sGold - $rsGold) . ')'),
                'sup_xpd15'  => DB::raw('sup_xpd15 + (' . (int) ($sXp - $rsXp) . ')'),
                'sup_csd15'  => DB::raw('sup_csd15 + (' . (int) ($sCs - $rsCs) . ')'),
                'sup_kd15'   => DB::raw('sup_kd15 + (' . (int) (($kills[$sup] ?? 0) - ($kills[$rSup] ?? 0)) . ')'),
            ]);
        }
    }

    /**
     * Şampiyon → 15. dakikaya kadar öldürme sayısı.
     * Timeline'ın CHAMPION_KILL olaylarından; killerId participantId'dir, katılımcı
     * dizisindeki indeks+1 ile eşlenir (participantId saklanan maç kopyasında YOK).
     * @return array<string,int>
     */
    private function killsBefore15(array $matchData, array $timeline): array
    {
        $keyToId = $this->keyMap();
        $pidToChamp = [];
        foreach ($matchData['info']['participants'] ?? [] as $i => $p) {
            $pid = (int) ($p['participantId'] ?? 0) ?: ($i + 1);
            $pidToChamp[$pid] = $keyToId[(int) ($p['championId'] ?? 0)] ?? ($p['championName'] ?? null);
        }

        $out = [];
        foreach ($timeline['info']['frames'] ?? [] as $frame) {
            foreach ($frame['events'] ?? [] as $e) {
                if (($e['type'] ?? '') !== 'CHAMPION_KILL' || (int) ($e['timestamp'] ?? 0) > 900000) {
                    continue;
                }
                $c = $pidToChamp[(int) ($e['killerId'] ?? 0)] ?? null;
                if ($c) {
                    $out[$c] = ($out[$c] ?? 0) + 1;
                }
            }
        }

        return $out;
    }

    /**
     * @15 farkını (işaretli) tek matchup satırına ekler.
     * @15 karşılaştırması AYNI koridordaki rakiple yapılır (ADC'nin gold farkı karşı
     * ADC'ye göre) → opponent_position = position. Çapraz satırlara @15 yazılmaz.
     */
    private function bumpLane15(string $patch, string $champ, string $pos, string $opp, int $gd, int $csd, int $xpd): void
    {
        $keyCols = [
            'patch' => $patch, 'champion_id' => $champ, 'position' => $pos,
            'opponent_id' => $opp, 'opponent_position' => $pos,
        ];
        // gd15/csd15/xpd15 İŞARETLİ toplanır (sütunlar signed): koridorda geri kalan
        // şampiyonda negatif birikir, mutlak değere çevrilmemeli.
        $this->bumpCounters('champion_matchups', $keyCols, [
            'n15'       => 1,
            'sum_gd15'  => (int) $gd,
            'sum_csd15' => (int) $csd,
            'sum_xpd15' => (int) $xpd,
        ]);
    }

    /**
     * Maçtaki karşı koridor eşleşmeleri: her pozisyon için iki takımın oyuncusu
     * eşlenir, iki yönlü satır üretilir. Pozisyonu boş/çift olan maçlar atlanır.
     *
     * Her satır o şampiyonun O MAÇTAKİ stat'ıyla gelir (KDA/KP/hasar) → head-to-head
     * detay agregasyonu için.
     *
     * AYRICA bot lane çapraz satırları: alt koridor 2v2 oynanır, ADC için karşı
     * SUPPORT da doğrudan rakiptir. opponent_position bu iki ilişkiyi ayırır
     * (aynı koridor → position ile aynı; çapraz → BOTTOM vs UTILITY).
     *
     * @return array<array{0:string,1:string,2:string,3:string,4:string,5:bool,6:int,7:int,8:int,9:int,10:int}>
     *         [patch, championId, position, opponentId, opponentPosition, win, kills, deaths, assists, kp%, dmg]
     */
    public function matchupRows(array $matchData): array
    {
        [$ok, $patch] = $this->validateMatch($matchData['info'] ?? null);
        if (! $ok) {
            return [];
        }
        $keyToId = $this->keyMap();
        $participants = $matchData['info']['participants'] ?? [];

        // Takım toplam öldürme (KP paydası)
        $teamKills = [];
        foreach ($participants as $p) {
            $tid = (int) ($p['teamId'] ?? 0);
            $teamKills[$tid] = ($teamKills[$tid] ?? 0) + (int) ($p['kills'] ?? 0);
        }

        // pozisyon × takım → [champId, win, kills, deaths, assists, kp, dmg, taken, healShield, cc]
        // Son üçü ROL metrikleri: bir şampiyonun hasar dışındaki işini ölçer (tank / enchanter /
        // engage). Bkz. 2026_08_05_090000 migration'ının gerekçesi.
        $byPos = [];
        foreach ($participants as $p) {
            $pos = $p['teamPosition'] ?? '';
            $champId = $keyToId[(int) ($p['championId'] ?? 0)] ?? ($p['championName'] ?? null);
            if (! $pos || ! $champId) {
                continue;
            }
            $tid = (int) ($p['teamId'] ?? 0);
            $k = (int) ($p['kills'] ?? 0);
            $d = (int) ($p['deaths'] ?? 0);
            $a = (int) ($p['assists'] ?? 0);
            $tk = $teamKills[$tid] ?? 0;
            $kp = $tk > 0 ? (int) round(($k + $a) / $tk * 100) : 0;
            $dmg = (int) ($p['totalDamageDealtToChampions'] ?? 0);
            $taken = (int) ($p['totalDamageTaken'] ?? 0);
            /*
              MÜTTEFİĞE iyileştirme + kalkan. `effectiveHealAndShielding` adı genel
              duruyor ama ÖLÇTÜK: yalnız müttefiğe yapılanı sayıyor (Swain 1.200 maçta
              ortalama 12.817 totalHeal'e karşı effective = 6). ELW #7 (2026-06-30)
              öncesi maçlarda challenge yok → ham müttefik toplamlarına düşülür.
            */
            $hs = (int) ($p['challenges']['effectiveHealAndShielding'] ?? 0);
            if ($hs <= 0) {
                $hs = (int) ($p['totalHealsOnTeammates'] ?? 0) + (int) ($p['totalDamageShieldedOnTeammates'] ?? 0);
            }
            // KENDİNE iyileştirme — ayrı bir iş. Swain/Aatrox gibi kendini ayakta tutan
            // şampiyonlar yukarıdaki alanda SIFIR görünüyordu; kıyasta yanlış bilgiydi.
            $healSelf = max(0, (int) ($p['totalHeal'] ?? 0) - (int) ($p['totalHealsOnTeammates'] ?? 0));
            // timeCCingOthers YAVAŞLATMAYI DA sayar (Yuumi 21 sn CC / 0 sabitleme).
            // Sert CC ayrı alanda ve ADET cinsinden.
            $cc = (int) round((float) ($p['timeCCingOthers'] ?? 0));
            $immob = (int) ($p['challenges']['enemyChampionImmobilizations'] ?? 0);
            $byPos[$pos][$tid] = [$champId, ! empty($p['win']), $k, $d, $a, $kp, $dmg, $taken, $hs, $cc, $healSelf, $immob];
        }

        $rows = [];

        // 1) Aynı koridor düellosu (her pozisyon için iki yön).
        foreach ($byPos as $pos => $teams) {
            if (count($teams) !== 2) {
                continue; // pozisyon verisi bozuk (çift jungle vb.) — güvenme
            }
            [$a, $b] = array_values($teams);
            if ($a[0] === $b[0]) {
                continue; // aynı şampiyon (teorik) — anlamsız
            }
            $rows[] = [$patch, $a[0], $pos, $b[0], $pos, $a[1], $a[2], $a[3], $a[4], $a[5], $a[6], $a[7], $a[8], $a[9], $a[10], $a[11]];
            $rows[] = [$patch, $b[0], $pos, $a[0], $pos, $b[1], $b[2], $b[3], $b[4], $b[5], $b[6], $b[7], $b[8], $b[9], $b[10], $b[11]];
        }

        // 2) Bot lane çaprazı: ADC ↔ KARŞI support. Aynı takımdaki ADC+SUP eşleşmesi
        //    burada ATLANIR — o bir rakiplik değil sinerjidir ve champion_duo_stats'ta
        //    ayrıca tutulur. Her çift iki yönlü yazılır (ADC'nin ve SUP'un perspektifi).
        $bots = $byPos['BOTTOM'] ?? [];
        $sups = $byPos['UTILITY'] ?? [];
        if (count($bots) === 2 && count($sups) === 2) {
            foreach ($bots as $botTeam => $adc) {
                foreach ($sups as $supTeam => $sup) {
                    if ($botTeam === $supTeam || $adc[0] === $sup[0]) {
                        continue; // aynı takım (sinerji) veya aynı şampiyon
                    }
                    $rows[] = [$patch, $adc[0], 'BOTTOM', $sup[0], 'UTILITY', $adc[1], $adc[2], $adc[3], $adc[4], $adc[5], $adc[6], $adc[7], $adc[8], $adc[9], $adc[10], $adc[11]];
                    $rows[] = [$patch, $sup[0], 'UTILITY', $adc[0], 'BOTTOM', $sup[1], $sup[2], $sup[3], $sup[4], $sup[5], $sup[6], $sup[7], $sup[8], $sup[9], $sup[10], $sup[11]];
                }
            }
        }

        return $rows;
    }

    /**
     * Eski bir maçın keystone-koşullu rün satırlarını DÖNDÜRÜR (bump etmez) —
     * builds:backfill-runes bunları bellekte toplayıp tek toplu upsert ile yazar
     * (maç başına ~240 tekil sorgu yerine chunk başına birkaç sorgu).
     *
     * @return array<array{0:string,1:string,2:string,3:string,4:string,5:bool}>
     *         [patch, championId, position, category, itemKey, win]
     */
    public function runeConditionalRows(array $matchData): array
    {
        [$ok, $patch] = $this->validateMatch($matchData['info'] ?? null);
        if (! $ok) {
            return [];
        }
        $keyToId = $this->keyMap();
        $rows = [];

        foreach ($matchData['info']['participants'] as $p) {
            $champId = $keyToId[(int) ($p['championId'] ?? 0)] ?? ($p['championName'] ?? null);
            if (! $champId) {
                continue;
            }
            $pos = $p['teamPosition'] ?: 'ALL';
            $win = ! empty($p['win']);
            foreach ($this->runeConditionalKeys($p) as [$category, $itemKey]) {
                $rows[] = [$patch, $champId, $pos, $category, $itemKey, $win];
            }
        }

        return $rows;
    }

    /**
     * Bir maçın tam Riot objesini (data) işler.
     * @return bool işlendi mi (geçerli ranked maç değilse false)
     */
    public function processMatch(array $matchData, string $region = 'tr1'): bool
    {
        [$ok, $patch] = $this->validateMatch($matchData['info'] ?? null);
        if (! $ok) {
            return false;
        }
        $info = $matchData['info'];
        $keyToId = $this->keyMap();

        // Patch toplam maç sayacı (pick/ban rate paydası).
        // "exists ? increment : create" da aynı yarışı taşıyordu: iki iş aynı anda
        // "yok" görüp ikisi de create çağırabilirdi (patch PRIMARY KEY → çakışma).
        $this->bumpCounters('stat_patches', ['patch' => $patch], ['total_games' => 1]);

        foreach ($info['participants'] as $p) {
            $key = (int) ($p['championId'] ?? 0);
            $champId = $keyToId[$key] ?? ($p['championName'] ?? null);
            if (! $champId) {
                continue;
            }
            $pos = $p['teamPosition'] ?: 'ALL';
            $win = ! empty($p['win']);

            // 1) champion_stats — ALL + pozisyon
            $this->bumpStat($patch, $champId, $key, 'ALL', $win);
            if ($pos !== 'ALL') {
                $this->bumpStat($patch, $champId, $key, $pos, $win);
            }

            // 2) champion_builds — keystone / shard / spell çifti / final item
            foreach ($this->buildKeys($p) as [$category, $itemKey]) {
                $this->bumpBuild($patch, $champId, $pos, $category, $itemKey, $win);
            }

            // 3) champion_top_players — oyuncu × şampiyon
            $this->bumpTopPlayer($region, $champId, $p, $win);
        }

        // 4) champion_matchups — karşı koridor eşleşmeleri (A-vs-B + B-vs-A) + KDA/hasar.
        //    Bot lane çapraz satırları (ADC↔karşı SUP) da buradan gelir; opponent_position
        //    ikisini ayırır ve unique index'in parçasıdır → anahtara dahil edilmeli.
        foreach ($this->matchupRows($matchData) as [$mPatch, $champ, $pos, $opp, $oppPos, $win, $k, $d, $as, $kp, $dmg, $taken, $hs, $cc, $healSelf, $immob]) {
            $keyCols = [
                'patch' => $mPatch, 'champion_id' => $champ, 'position' => $pos,
                'opponent_id' => $opp, 'opponent_position' => $oppPos,
            ];
            // Tek atomik yazma: games/wins (WR paydası) + KDA/hasar (n_stats ayrı payda)
            // + rol metrikleri (n_role ayrı payda — eski maçlarda backfill dolduruyor).
            $this->bumpCounters('champion_matchups', $keyCols, [
                'games'           => 1,
                'wins'            => $win ? 1 : 0,
                'n_stats'         => 1,
                'sum_kills'       => (int) $k,
                'sum_deaths'      => (int) $d,
                'sum_assists'     => (int) $as,
                'sum_kp'          => (int) $kp,
                'sum_dmg'         => (int) $dmg,
                'n_role'          => 1,
                'sum_taken'       => (int) $taken,
                'sum_heal_shield' => (int) $hs,
                'sum_cc'          => (int) $cc,
                'sum_heal_self'   => (int) $healSelf,
                'sum_immob'       => (int) $immob,
            ]);
        }

        // Banlar → champion_stats.bans (ALL). Maç içinde TEKİLLEŞTİR: iki takım aynı
        // şampiyonu banlayabilir; çift sayılırsa banRate %100'ü aşar (stats:rebuild
        // ile aynı kural — ChampionStatsService::aggregateFromMatches).
        $banned = [];
        foreach ($info['teams'] ?? [] as $team) {
            foreach ($team['bans'] ?? [] as $ban) {
                $cid = $keyToId[(int) ($ban['championId'] ?? -1)] ?? null;
                if ($cid) {
                    $banned[$cid] = true;
                }
            }
        }
        foreach (array_keys($banned) as $cid) {
            ChampionStat::where(['patch' => $patch, 'champion_id' => $cid, 'position' => 'ALL'])
                ->increment('bans');
        }

        // 5) Günlük trend sayaçları — "son 30 gün" grafiğinin kaynağı.
        $this->bumpDaily($info, $keyToId, $banned);

        return true;
    }

    /**
     * Maçı günlük sayaçlara ekler (champion_daily_stats + stat_days).
     *
     * Maç başına yalnız İKİ sorgu: bir tanesi günün toplam maç sayacı, diğeri tüm
     * şampiyon/pozisyon satırları için tek toplu upsert. Katılımcı başına ayrı
     * firstOrCreate+increment yapılsaydı maç başına ~40 sorgu olurdu.
     */
    private function bumpDaily(array $info, array $keyToId, array $banned): void
    {
        $created = (int) ($info['gameCreation'] ?? 0);
        if ($created <= 0) {
            return; // tarihsiz maç → günlük seriye yazılamaz
        }
        $day = Carbon::createFromTimestampMs($created)->toDateString();
        $now = now()->toDateTimeString();

        // Seçim/yasaklanma oranının paydası
        DB::statement(
            'INSERT INTO stat_days (day, matches, created_at, updated_at) VALUES (?,1,?,?)'
            . ' ON DUPLICATE KEY UPDATE matches = matches + 1, updated_at = VALUES(updated_at)',
            [$day, $now, $now]
        );

        $rows = $this->dailyAcc($info, $keyToId, $banned);
        if (! $rows) {
            return;
        }

        $ph = [];
        $bind = [];
        foreach ($rows as [$champ, $pos, $g, $w, $b]) {
            $ph[] = '(?,?,?,?,?,?,?,?)';
            array_push($bind, $day, $champ, $pos, $g, $w, $b, $now, $now);
        }

        DB::statement(
            'INSERT INTO champion_daily_stats (day, champion_id, position, games, wins, bans, created_at, updated_at) VALUES '
            . implode(',', $ph)
            . ' ON DUPLICATE KEY UPDATE games = games + VALUES(games), wins = wins + VALUES(wins),'
            . ' bans = bans + VALUES(bans), updated_at = VALUES(updated_at)',
            $bind
        );
    }

    /**
     * Bir maçın günlük sayaç satırlarını ÜRETİR (yazmaz) — geriye dönük doldurma için.
     * Banları maç içinde tekilleştirir (iki takım aynı şampiyonu banlarsa banRate şişerdi).
     *
     * @return array<array{0:string,1:string,2:int,3:int,4:int}> [championId, position, games, wins, bans]
     */
    public function dailyRowsFor(array $info): array
    {
        $keyToId = $this->keyMap();

        $banned = [];
        foreach ($info['teams'] ?? [] as $team) {
            foreach ($team['bans'] ?? [] as $ban) {
                $cid = $keyToId[(int) ($ban['championId'] ?? -1)] ?? null;
                if ($cid) {
                    $banned[$cid] = true;
                }
            }
        }

        return $this->dailyAcc($info, $keyToId, $banned);
    }

    /** Katılımcı + ban listesini [champ, pos, games, wins, bans] satırlarına indirger. */
    private function dailyAcc(array $info, array $keyToId, array $banned): array
    {
        $acc = [];
        foreach ($info['participants'] ?? [] as $p) {
            $champId = $keyToId[(int) ($p['championId'] ?? 0)] ?? ($p['championName'] ?? null);
            if (! $champId) {
                continue;
            }
            $win = empty($p['win']) ? 0 : 1;
            $pos = $p['teamPosition'] ?: 'ALL';

            $acc["{$champId}|ALL"] ??= [0, 0, 0];
            $acc["{$champId}|ALL"][0]++;
            $acc["{$champId}|ALL"][1] += $win;

            if ($pos !== 'ALL') {
                $acc["{$champId}|{$pos}"] ??= [0, 0, 0];
                $acc["{$champId}|{$pos}"][0]++;
                $acc["{$champId}|{$pos}"][1] += $win;
            }
        }
        // Yasaklamalar şampiyon düzeyinde (rolsüz) → yalnız ALL satırına
        foreach (array_keys($banned) as $cid) {
            $acc["{$cid}|ALL"] ??= [0, 0, 0];
            $acc["{$cid}|ALL"][2]++;
        }

        $out = [];
        foreach ($acc as $k => [$g, $w, $b]) {
            [$champ, $pos] = explode('|', $k, 2);
            $out[] = [$champ, $pos, $g, $w, $b];
        }

        return $out;
    }

    /** Bir participant'tan build anahtarlarını çıkar: [[category, key], ...] */
    private function buildKeys(array $p): array
    {
        $out = [];
        $perks = $p['perks'] ?? [];

        // Keystone (ana ağacın ilk seçimi)
        $keystone = $perks['styles'][0]['selections'][0]['perk'] ?? null;
        if ($keystone) {
            $out[] = ['keystone', (string) $keystone];
        }
        // Minor rünler — ana ağaç (2-4) + YAN ağaç (2 seçim). Yan ağaç sayılmazsa
        // build sayfasındaki ikincil ağaç başka sayfaların rünlerinden türer (yanlış).
        foreach ($this->minorPerks($perks) as $perk) {
            $out[] = ['rune_minor', (string) $perk];
        }
        // Stat shard'lar
        foreach (['offense', 'flex', 'defense'] as $slot) {
            if (! empty($perks['statPerks'][$slot])) {
                $out[] = ['shard', (string) $perks['statPerks'][$slot]];
            }
        }
        // Keystone-KOŞULLU sayaçlar: rün sayfası bir bütündür — yan ağaç ve shard
        // istatistikleri ancak "o keystone ile oynanan maçlar" içinde anlamlıdır.
        $out = array_merge($out, $this->runeConditionalKeys($p));
        // Sihirdar büyüsü çifti (sıralı)
        $s1 = (int) ($p['summoner1Id'] ?? 0);
        $s2 = (int) ($p['summoner2Id'] ?? 0);
        if ($s1 && $s2) {
            $pair = $s1 < $s2 ? "{$s1}-{$s2}" : "{$s2}-{$s1}";
            $out[] = ['spell_pair', $pair];
        }
        // Final itemler (item0..item5; item6 = trinket, atlanır)
        for ($i = 0; $i <= 5; $i++) {
            $item = (int) ($p["item{$i}"] ?? 0);
            if ($item > 0) {
                $out[] = ['item_full', (string) $item];
            }
        }
        return $out;
    }

    /** Ana ağaç minörleri (2-4) + yan ağaç seçimleri (2) — perk id listesi. */
    private function minorPerks(array $perks): array
    {
        $out = [];
        foreach (array_slice($perks['styles'][0]['selections'] ?? [], 1) as $sel) {
            if (! empty($sel['perk'])) {
                $out[] = $sel['perk'];
            }
        }
        foreach ($perks['styles'][1]['selections'] ?? [] as $sel) {
            if (! empty($sel['perk'])) {
                $out[] = $sel['perk'];
            }
        }

        return $out;
    }

    /**
     * Keystone-koşullu anahtarlar: [['rune_minor_k', 'KEYSTONE:PERK'], ['shard_k', 'KEYSTONE:SHARD']].
     * builds:backfill-runes komutu da eski maçlar için yalnız bunları işler.
     */
    public function runeConditionalKeys(array $p): array
    {
        $perks = $p['perks'] ?? [];
        $keystone = $perks['styles'][0]['selections'][0]['perk'] ?? null;
        if (! $keystone) {
            return [];
        }

        $out = [];
        foreach ($this->minorPerks($perks) as $perk) {
            $out[] = ['rune_minor_k', "{$keystone}:{$perk}"];
        }
        foreach (['offense', 'flex', 'defense'] as $slot) {
            if (! empty($perks['statPerks'][$slot])) {
                $out[] = ['shard_k', "{$keystone}:{$perks['statPerks'][$slot]}"];
            }
        }

        return $out;
    }

    /**
     * Sayaç satırını ATOMİK artırır: satır yoksa oluşturur, varsa üstüne ekler.
     *
     * `firstOrCreate` + `increment` ikilisinin yerine geçer. O desen "önce bak,
     * yoksa ekle" olduğu için İKİ paralel worker aynı satırı aynı anda eklemeye
     * kalktığında biri unique-index çakışması alıyordu. Laravel çakışmayı yakalayıp
     * satırı geri okumayı deniyor, bulamazsa hatayı yeniden fırlatıyor — ve bu
     * ProcessMatchJob'ı komple düşürüyordu, yani yalnız çakışan satır değil O MAÇIN
     * TÜM verisi kayboluyordu. 2026-08-05'te bir günde 72 iş böyle öldü; sayı
     * 4 Ağustos'ta 6'ydı, ikinci `queue:work` süreci (profiles + default) eklenince
     * fırladı — iki paralel yazıcı = yarışa giren iki taraf.
     *
     * Tek ifadede INSERT ... ON DUPLICATE KEY UPDATE yarışı imkânsız kılar: araya
     * okuma girmez, çakışma hata değil güncelleme olur. Yan fayda satır başına
     * 2-3 sorgu yerine 1 — maç başına onlarca satır yazıldığı için kayda değer.
     *
     * ŞART: tablonun ilgili sütunlarında UNIQUE index olmalı, yoksa "çakışma"
     * hiç oluşmaz ve her çağrı yeni satır ekler. Dört tabloda da doğrulandı.
     *
     * @param  array  $keys        satırı belirleyen sütunlar (unique index ile aynı)
     * @param  array  $increments  üstüne eklenecek sayaçlar (sütun => eklenecek değer)
     * @param  array  $insertOnly  yalnız İLK eklemede yazılan, sonra dokunulmayan alanlar
     * @param  array  $overwrite   her yazımda üzerine yazılan alanlar (ör. güncel oyuncu adı)
     */
    private function bumpCounters(
        string $table,
        array $keys,
        array $increments,
        array $insertOnly = [],
        array $overwrite = [],
    ): void {
        $now = Carbon::now();

        $insertCols = array_merge(array_keys($keys), array_keys($insertOnly), array_keys($overwrite), array_keys($increments));
        $insertVals = array_merge(array_values($keys), array_values($insertOnly), array_values($overwrite), array_values($increments));

        $colList = implode(', ', array_map(fn ($c) => "`{$c}`", array_merge($insertCols, ['created_at', 'updated_at'])));
        $placeholders = implode(', ', array_fill(0, count($insertCols) + 2, '?'));

        // Artışta VALUES(sütun) yerine değeri İKİNCİ kez bağlıyoruz: VALUES()
        // MySQL 8.0.20'de kullanımdan kalktı, MariaDB'de duruyor — bu biçim ikisinde de çalışır.
        $setParts = array_map(fn ($c) => "`{$c}` = `{$c}` + ?", array_keys($increments));
        foreach (array_keys($overwrite) as $c) {
            $setParts[] = "`{$c}` = ?";
        }
        $setList = implode(', ', $setParts);

        $bindings = array_merge(
            $insertVals,
            [$now, $now],
            array_values($increments),
            array_values($overwrite),
            [$now],
        );

        DB::statement(
            "INSERT INTO `{$table}` ({$colList}) VALUES ({$placeholders}) "
            . "ON DUPLICATE KEY UPDATE {$setList}, `updated_at` = ?",
            $bindings,
        );
    }

    private function bumpStat(string $patch, string $champId, int $key, string $pos, bool $win): void
    {
        $this->bumpCounters(
            'champion_stats',
            ['patch' => $patch, 'champion_id' => $champId, 'position' => $pos],
            ['games' => 1, 'wins' => $win ? 1 : 0],
            // champion_key sayaç DEĞİL sabit kimlik: ilk eklemede yazılır, sonra dokunulmaz.
            ['champion_key' => $key],
        );
    }

    private function bumpBuild(string $patch, string $champId, string $pos, string $category, string $key, bool $win): void
    {
        $this->bumpCounters(
            'champion_builds',
            ['patch' => $patch, 'champion_id' => $champId, 'position' => $pos, 'category' => $category, 'item_key' => $key],
            ['games' => 1, 'wins' => $win ? 1 : 0],
        );
    }

    private function bumpTopPlayer(string $region, string $champId, array $p, bool $win): void
    {
        $puuid = $p['puuid'] ?? null;
        if (! $puuid) {
            return;
        }
        // Maç-v5'te oyuncu adı var → güncel tut (tier/rank crawler'dan gelir).
        // Ad her yazımda tazelenir: oyuncu Riot ID'sini değiştirebiliyor.
        $name = $p['riotIdGameName'] ?? null;
        $overwrite = $name
            ? ['game_name' => $name, 'tag_line' => $p['riotIdTagline'] ?? null]
            : [];

        $this->bumpCounters(
            'champion_top_players',
            ['region' => $region, 'champion_id' => $champId, 'puuid' => $puuid],
            ['games' => 1, 'wins' => $win ? 1 : 0],
            [],
            $overwrite,
        );
    }

    /** @return array<int,string> */
    private function keyMap(): array
    {
        if ($this->keyToId !== null) {
            return $this->keyToId;
        }
        $this->keyToId = [];
        foreach ($this->ddragon->getChampions() as $champ) {
            $this->keyToId[(int) $champ['key']] = $champ['id'];
        }
        return $this->keyToId;
    }

    /** "16.11.1" → "16.11" (patch bucket). */
    private function shortPatch(string $v): string
    {
        $parts = explode('.', $v);
        return count($parts) >= 2 ? "{$parts[0]}.{$parts[1]}" : $v;
    }

    /** gameVersion'dan patch bucket (boşsa null). */
    private function patchBucket(string $gameVersion): ?string
    {
        if ($gameVersion === '') {
            return null;
        }
        return $this->shortPatch($gameVersion);
    }
}
