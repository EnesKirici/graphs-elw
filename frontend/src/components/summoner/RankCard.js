"use client";

import WinrateSection from "./WinrateSection";

function rankBadgeUrl(tier) {
  return `/ranks/badges/${tier.toLowerCase()}.webp`;
}

function getWrColor(wr) {
  if (wr >= 51) return "text-emerald-400";
  if (wr >= 45) return "text-yellow-400";
  return "text-red-400";
}

function tierLabel(data) {
  return data.tier.charAt(0) + data.tier.slice(1).toLowerCase();
}

/* Büyük rank bloğu — Solo/Duo ve Flex aynı görünüm, yeşil/kırmızı bar YOK */
function RankBlock({ data, title }) {
  return (
    <div>
      <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-3">{title}</p>
      <div className="flex items-center gap-4">
        <img
          src={rankBadgeUrl(data.tier)}
          alt={data.tier}
          width={92}
          height={92}
          className="flex-shrink-0 drop-shadow-[0_4px_14px_rgba(0,0,0,0.5)]"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-2xl font-bold text-white leading-tight">{tierLabel(data)} {data.rank}</p>
            {data.freshBlood && <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-medium">Yeni Yükseldi</span>}
            {data.veteran && <span className="text-[9px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-full font-medium">Deneyimli</span>}
          </div>
          <p className="text-sm text-gray-400 mt-1">{data.lp} LP</p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-sm">
              <span className="text-emerald-400 font-medium">{data.wins}G</span>
              <span className="text-gray-600 mx-1">/</span>
              <span className="text-red-400 font-medium">{data.losses}M</span>
            </span>
            <span className={`text-lg font-bold ${getWrColor(data.winRate)}`}>{data.winRate}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function UnrankedBlock({ title }) {
  return (
    <div>
      <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-3">{title}</p>
      <div className="flex items-center gap-4 opacity-60">
        <div className="w-[92px] h-[92px] rounded-full bg-[#1b2230]/40 border border-[#1b2230] flex items-center justify-center flex-shrink-0">
          <span className="text-gray-600 text-sm">?</span>
        </div>
        <p className="text-sm text-gray-500">Unranked</p>
      </div>
    </div>
  );
}

/*
  Büyük birleşik sıralama kartı: Solo/Duo + Flex yan yana belirgin bloklar
  (büyük rank ikonu, WR%); altında WR geçmişi grafikleri (Solo açık, Flex kapalı).
  Geniş ana kolonda durur.
*/
export default function RankCard({ solo, flex, winrateTimeline }) {
  if (!solo && !flex) {
    return (
      <div className="glass rounded-xl p-6 text-center">
        <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">Sıralamalar</p>
        <p className="text-sm text-gray-600">Bu oyuncu derecesiz</p>
      </div>
    );
  }

  const soloTl = winrateTimeline?.solo?.timeline;
  const flexTl = winrateTimeline?.flex?.timeline;
  const hasGraph = soloTl?.length >= 2 || flexTl?.length >= 2;

  return (
    <div className="glass rounded-xl p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:pr-6">
          {solo ? <RankBlock data={solo} title="Solo/Duo" /> : <UnrankedBlock title="Solo/Duo" />}
        </div>
        <div className="md:border-l md:border-[#1b2230]/50 md:pl-6">
          {flex ? <RankBlock data={flex} title="Flex 5v5" /> : <UnrankedBlock title="Flex 5v5" />}
        </div>
      </div>

      {hasGraph && (
        <div className="mt-1">
          {soloTl?.length >= 2 && (
            <WinrateSection timeline={soloTl} defaultOpen={true} label="Solo/Duo — Win Rate Geçmişi" />
          )}
          {flexTl?.length >= 2 && (
            <WinrateSection timeline={flexTl} defaultOpen={false} label="Flex — Win Rate Geçmişi" />
          )}
        </div>
      )}
    </div>
  );
}
