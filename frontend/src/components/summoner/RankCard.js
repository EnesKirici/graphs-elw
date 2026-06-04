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

/* Solo/Duo — belirgin blok */
function SoloBlock({ data }) {
  return (
    <>
      <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-3">Solo/Duo</p>
      {/* Rozet ile metin bloğu aynı optik yükseklikte → items-center ortalar */}
      <div className="flex items-center gap-3">
        <img
          src={rankBadgeUrl(data.tier)}
          alt={data.tier}
          width={76}
          height={76}
          className="flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="text-xl font-bold text-white leading-tight">{tierLabel(data)} {data.rank}</p>
            <span className="text-xs text-gray-400">{data.lp} LP</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            {data.freshBlood && <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-medium">Yeni Yükseldi</span>}
            {data.veteran && <span className="text-[9px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-full font-medium">Deneyimli</span>}
            <span className="text-xs text-emerald-400">{data.wins}W</span>
            <span className="text-xs text-gray-600">/</span>
            <span className="text-xs text-red-400">{data.losses}L</span>
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className={`text-2xl font-bold leading-none ${getWrColor(data.winRate)}`}>{data.winRate}%</p>
          <p className="text-[10px] text-gray-500 mt-1">Win Rate</p>
        </div>
      </div>
      <div className="mt-3 h-1.5 rounded-full overflow-hidden flex">
        <div className="h-full bg-emerald-500" style={{ width: `${data.winRate}%` }} />
        <div className="h-full bg-red-500" style={{ width: `${100 - data.winRate}%` }} />
      </div>
    </>
  );
}

/* Flex — ince satır */
function FlexRow({ data }) {
  return (
    <div className="flex items-center gap-3">
      <img src={rankBadgeUrl(data.tier)} alt={data.tier} width={40} height={40} className="flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Flex</span>
          <p className="text-sm font-bold text-white truncate">{tierLabel(data)} {data.rank}</p>
          <span className="text-[11px] text-gray-500">{data.lp} LP</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-emerald-400">{data.wins}W</span>
          <span className="text-[11px] text-gray-600">/</span>
          <span className="text-[11px] text-red-400">{data.losses}L</span>
        </div>
      </div>
      <p className={`text-sm font-bold ${getWrColor(data.winRate)} flex-shrink-0`}>{data.winRate}%</p>
    </div>
  );
}

function UnrankedRow({ title }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-gray-500 uppercase tracking-wider">{title}</span>
      <span className="text-xs text-gray-600">Unranked</span>
    </div>
  );
}

/*
  Birleşik kompakt sıralama kartı: Solo/Duo belirgin (WR geçmişi varsayılan AÇIK)
  + Flex ince satır (WR geçmişi aynı yapıda ama varsayılan KAPALI). Flex'in büyük
  kartı kaldırıldığı için En Çok Oynanan ekranda yukarı çıkar.
*/
export default function RankCard({ solo, flex, winrateTimeline }) {
  if (!solo && !flex) {
    return (
      <div className="glass rounded-xl p-4 text-center">
        <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">Sıralamalar</p>
        <p className="text-xs text-gray-600">Unranked</p>
      </div>
    );
  }

  const soloTl = winrateTimeline?.solo?.timeline;
  const flexTl = winrateTimeline?.flex?.timeline;

  return (
    <div className="glass rounded-xl p-5">
      {/* Solo/Duo — belirgin */}
      {solo ? <SoloBlock data={solo} /> : <UnrankedRow title="Solo/Duo" />}

      {/* Solo/Duo Win Rate Geçmişi — varsayılan AÇIK */}
      {solo && soloTl?.length >= 2 && <WinrateSection timeline={soloTl} defaultOpen={true} />}

      {/* Flex — ince satır + aynı yapıda WR geçmişi (varsayılan KAPALI) */}
      <div className="mt-3 pt-3 border-t border-[#1b2230]/40">
        {flex ? (
          <>
            <FlexRow data={flex} />
            {flexTl?.length >= 2 && <WinrateSection timeline={flexTl} defaultOpen={false} />}
          </>
        ) : (
          <UnrankedRow title="Flex" />
        )}
      </div>
    </div>
  );
}
