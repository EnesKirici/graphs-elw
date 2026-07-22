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

        // Önemli kelime/değer etiketleri → [[tip:metin]] işaretleyicisi.
        // Frontend (ItemTooltip) bunları renkli/kalın basar; strip_tags'ten sağ çıkar.
        // Anahtarlar küçük harf — regex /i ile eşleşen etiket adı strtolower ile aranır
        $emphasisTags = [
            'magicdamage'   => 'ap',   'scaleap'  => 'ap',
            'physicaldamage'=> 'ad',   'scalead'  => 'ad',
            'truedamage'    => 'td',
            'healing'       => 'heal', 'lifesteal'=> 'heal', 'omnivamp' => 'heal',
            'shield'        => 'shield',
            'speed'         => 'ms',
            'attackspeed'   => 'as',
            'status'        => 'kw',   'keywordmajor' => 'kw', 'attention' => 'kw', 'onhit' => 'kw',
        ];
        $tagPattern = implode('|', array_keys($emphasisTags));
        // İç içe etiketlerde içteki önce eşleşir (.*? en soldaki-en kısa); dıştaki ikinci turda
        // yakalanır ve callback içteki işaretleyicileri temizler. 3 tur her durumda yeter.
        for ($pass = 0; $pass < 3; $pass++) {
            $new = preg_replace_callback(
                '/<(' . $tagPattern . ')>(.*?)<\/\1>/si',
                function ($m) use ($emphasisTags) {
                    $text = preg_replace('/\[\[\w+:(.*?)\]\]/s', '$1', $m[2]); // iç işaretleyicileri düzleştir
                    $text = trim(strip_tags($text));
                    return $text === '' ? '' : '[[' . $emphasisTags[strtolower($m[1])] . ':' . $text . ']]';
                },
                $descPart
            );
            if ($new === $descPart) break;
            $descPart = $new;
        }

        if (preg_match_all('/<passive>(.*?)<\/passive>/s', $descPart, $passiveNames)) {
            $parts = preg_split('/<passive>.*?<\/passive>/s', $descPart);
            foreach ($passiveNames[1] as $i => $name) {
                // <br> → boşluk (strip_tags bitişik yapıştırmasın: "verir.Canavarlara" vakası)
                $raw = preg_replace('/<br\s*\/?>/i', ' ', $parts[$i + 1] ?? '');
                $desc = trim(strip_tags($raw));
                $desc = preg_replace('/^\s*<br\s*\/?>\s*/', '', $desc);
                $desc = trim(preg_replace('/\s+/', ' ', $desc));
                $name = trim(strip_tags(preg_replace('/\[\[\w+:(.*?)\]\]/s', '$1', $name)));
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

        // Stat shards — isim + DDragon StatMods ikonu (frontend mini rün olarak basar)
        $statShardMeta = [
            5001 => ['+10-180 Can (seviyeye göre)', 'StatModsHealthScalingIcon.png'],
            5002 => ['+6 Zırh', 'StatModsArmorIcon.png'],
            5003 => ['+8 Büyü Direnci', 'StatModsMagicResIcon.MagicResist_Fix.png'],
            5005 => ['+10% Saldırı Hızı', 'StatModsAttackSpeedIcon.png'],
            5007 => ['+8 Yetenek İvmesi', 'StatModsCDRScalingIcon.png'],
            5008 => ['+9 Uyarlanır Güç', 'StatModsAdaptiveForceIcon.png'],
            5010 => ['+%2 Hareket Hızı', 'StatModsMovementSpeedIcon.png'],
            5011 => ['+65 Can', 'StatModsHealthPlusIcon.png'],
            5013 => ['+10% Tenas', 'StatModsTenacityIcon.png'],
        ];
        $shardIconBase = config('riot.ddragon_assets_url') . '/cdn/img/perk-images/StatMods';
        $statShards = [];
        if (isset($perks['statPerks'])) {
            foreach (['offense', 'flex', 'defense'] as $slot) {
                $id = $perks['statPerks'][$slot] ?? 0;
                $meta = $statShardMeta[$id] ?? null;
                $statShards[] = [
                    'name' => $meta[0] ?? "Shard #{$id}",
                    'icon' => $meta ? "{$shardIconBase}/{$meta[1]}" : null,
                ];
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
