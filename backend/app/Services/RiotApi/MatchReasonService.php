<?php

namespace App\Services\RiotApi;

/**
 * Maç sonucu "sebep" çipi — bir maçın NEDEN kazanıldığını/kaybedildiğini tek
 * etikete indirger (Taşıdın · Takımın taşıdı · Öne geçip kaybettiniz · …).
 *
 * Yalnızca match_summaries'te ZATEN saklanan alanlardan türer (sıralama, ELW skoru,
 * takım kalitesi, rozetler) → MatchService::hydrateSummary'de OKUMA anında üretilir,
 * saklanmaz. Böylece eski maçlarda da çalışır ve ALGO_VERSION bump'ı gerektirmez.
 *
 * NOT: Koridor bazlı sebepler ("Orman farkı" gibi) 10 oyuncunun tam koridor analizini
 * gerektirir (LaneAnalysisService::buildAnalysis) — o veri maç-detayında hesaplanır;
 * bu servis KART seviyesinde kişisel-sonuç sebeplerini verir.
 */
class MatchReasonService
{
    /**
     * @return array{key:string,label:string,desc:string,tone:string}|null  null = remake/eksik veri
     */
    public function reasonFor(array $summary): ?array
    {
        // Remake / eksik veri → sebep yok.
        if (($summary['duration'] ?? 0) < 300) {
            return null;
        }
        $ranking = $summary['ranking'] ?? null;
        if (!$ranking || !isset($ranking['rank'])) {
            return null;
        }

        $win    = (bool) ($summary['win'] ?? false);
        $rank   = (int) $ranking['rank'];
        $score  = (float) ($ranking['elwScore'] ?? 0);
        $tqKey  = $summary['teamQuality']['key'] ?? null; // great/good/avg/bad/terrible
        $badges = $summary['badges'] ?? [];

        $hasBadge = fn (string $key): bool => (bool) array_filter(
            $badges,
            fn ($b) => ($b['key'] ?? '') === $key
        );

        $weakTeam   = in_array($tqKey, ['bad', 'terrible'], true);
        $strongTeam = in_array($tqKey, ['great', 'good'], true);

        if ($win) {
            // 1) Sırtladın — MVP + yüksek skor + zayıf takım (tek başına çekti)
            if ($rank === 1 && $score >= 7.5 && $weakTeam) {
                return $this->r('hard_carry', 'Sırtladın', 'Zayıf takıma rağmen MVP performansıyla maçı taşıdın.', 'carry');
            }
            // 2) Taşıdın — ilk 2 + iyi skor + takım "harika" değil
            if ($rank <= 2 && $score >= 7 && !$strongTeam) {
                return $this->r('carry', 'Taşıdın', 'Takımın en iyilerindendin, galibiyette payın büyük.', 'carry');
            }
            // 3) Takımın taşıdı — düşük sıra + güçlü takım
            if ($rank >= 7 && $strongTeam) {
                return $this->r('carried', 'Takımın taşıdı', 'Takım arkadaşların lobinin üstündeydi, galibiyeti onlar sürükledi.', 'neutral');
            }
            // 4) Dengeli galibiyet
            return $this->r('team_win', 'Takımca kazandınız', 'Dengeli bir takım performansıyla kazandınız.', 'good');
        }

        // ── MAĞLUBİYET ──
        // 1) Öne geçip kaybettiniz (throw) — takım altında öndeyken kayıp
        if ($hasBadge('gold_loss')) {
            return $this->r('threw', 'Öne geçip kaybettiniz', 'Takım altında öndeyken avantajı koruyamadınız.', 'warn');
        }
        // 2) Takıma rağmen — sen iyi oynadın ama takım yetmedi
        if ($rank <= 2 && $score >= 6.5) {
            return $this->r('resilient_loss', 'Takıma rağmen', 'En iyi performansı sen gösterdin ama takım yetmedi.', 'good');
        }
        // 3) Koridorunda geride kaldın (kişisel koridor farkı)
        if ($hasBadge('rough_lane')) {
            return $this->r('lane_lost', 'Koridorunda geride kaldın', 'Koridor rakibine belirgin altın geride kaldın.', 'bad');
        }
        // 4) Takım yetersizdi — sen lobinin üstündeyken takım altında
        if ($weakTeam && $rank <= 4) {
            return $this->r('weak_team', 'Takım yetersizdi', 'Takım arkadaşların lobinin altındaydı.', 'bad');
        }
        // 5) Zorlu maç
        return $this->r('outclassed', 'Zorlu maç', 'Rakip takım genelinde üstündü.', 'bad');
    }

    /** @return array{key:string,label:string,desc:string,tone:string} */
    private function r(string $key, string $label, string $desc, string $tone): array
    {
        return ['key' => $key, 'label' => $label, 'desc' => $desc, 'tone' => $tone];
    }
}
