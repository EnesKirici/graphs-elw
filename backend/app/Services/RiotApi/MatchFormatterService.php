<?php

namespace App\Services\RiotApi;

/**
 * Riot API ham verisini frontend-friendly formata dönüştürme.
 * Item description parse, rune extraction vb.
 */
class MatchFormatterService
{
    /**
     * Item description HTML'ini yapılandırılmış veriye çevir.
     * Stats ve pasif açıklamaları ayrı ayrı döner.
     */
    public function parseItemDescription(string $html): array
    {
        $result = ['stats' => [], 'passives' => []];

        // Stats çıkar: <stats>...</stats> içindeki satırlar
        if (preg_match('/<stats>(.*?)<\/stats>/s', $html, $m)) {
            $statsHtml = $m[1];
            $statsHtml = preg_replace('/<attention>(.*?)<\/attention>/', '+$1', $statsHtml);
            $lines = explode('<br>', $statsHtml);
            foreach ($lines as $line) {
                $line = trim(strip_tags($line));
                if ($line) $result['stats'][] = $line;
            }
        }

        // Pasifler çıkar: <passive>İsim</passive> ve sonraki açıklama
        $descPart = preg_replace('/<stats>.*?<\/stats>/s', '', $html);
        $descPart = preg_replace('/<mainText>|<\/mainText>/', '', $descPart);

        if (preg_match_all('/<passive>(.*?)<\/passive>/s', $descPart, $passiveNames)) {
            $parts = preg_split('/<passive>.*?<\/passive>/s', $descPart);
            foreach ($passiveNames[1] as $i => $name) {
                $desc = isset($parts[$i + 1]) ? trim(strip_tags($parts[$i + 1])) : '';
                $desc = preg_replace('/^\s*<br\s*\/?>\s*/', '', $desc);
                $desc = trim(preg_replace('/\s+/', ' ', $desc));
                if ($name) {
                    $result['passives'][] = ['name' => $name, 'desc' => $desc];
                }
            }
        }

        return $result;
    }

    /**
     * Perks verisinden rün bilgilerini çıkar.
     */
    public function extractRunes(?array $perks, array $runeMap): array
    {
        if (!$perks || !isset($perks['styles'])) {
            return ['keystone' => null, 'primaryTree' => null, 'subTree' => null, 'allPerks' => []];
        }

        $keystone = null;
        $primaryTree = null;
        $subTree = null;
        $primaryPerks = [];
        $secondaryPerks = [];

        foreach ($perks['styles'] as $style) {
            $treeInfo = $runeMap[$style['style']] ?? null;

            if ($style['description'] === 'primaryStyle') {
                $primaryTree = $treeInfo;
                if (!empty($style['selections'])) {
                    $keystoneId = $style['selections'][0]['perk'];
                    $keystone = $runeMap[$keystoneId] ?? null;
                }
                foreach ($style['selections'] as $sel) {
                    $primaryPerks[] = $runeMap[$sel['perk']] ?? ['name' => 'Unknown', 'icon' => ''];
                }
            } elseif ($style['description'] === 'subStyle') {
                $subTree = $treeInfo;
                foreach ($style['selections'] as $sel) {
                    $secondaryPerks[] = $runeMap[$sel['perk']] ?? ['name' => 'Unknown', 'icon' => ''];
                }
            }
        }

        // Stat shards
        $statShardNames = [
            5001 => '+10-180 Can (seviyeye göre)',
            5002 => '+6 Zırh',
            5003 => '+8 Büyü Direnci',
            5005 => '+10% Saldırı Hızı',
            5007 => '+8 Yetenek İvmesi',
            5008 => '+9 Uyarlanır Güç',
            5010 => '+%1-10 CDR (seviyeye göre)',
            5011 => '+65 Can',
            5013 => '+10% Tenas',
        ];
        $statShards = [];
        if (isset($perks['statPerks'])) {
            foreach (['offense', 'flex', 'defense'] as $slot) {
                $id = $perks['statPerks'][$slot] ?? 0;
                $statShards[] = $statShardNames[$id] ?? "Shard #{$id}";
            }
        }

        return [
            'keystone'       => $keystone,
            'primaryTree'    => $primaryTree,
            'subTree'        => $subTree,
            'primaryPerks'   => $primaryPerks,
            'secondaryPerks' => $secondaryPerks,
            'statShards'     => $statShards,
        ];
    }
}
