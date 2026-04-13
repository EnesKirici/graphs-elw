import { fetchApi } from "@/lib/api";
import WinRateBanner from "@/components/dashboard/WinRateBanner";
import SearchBar from "@/components/dashboard/SearchBar";
import RankingCard from "@/components/dashboard/RankingCard";
import WinRateChanges from "@/components/dashboard/WinRateChanges";
import TopBanned from "@/components/dashboard/TopBanned";
import TopPicked from "@/components/dashboard/TopPicked";
import BackgroundAnimation from "@/components/dashboard/BackgroundAnimation";
import Link from "next/link";

export default async function Home() {
  let data = null;
  try {
    data = await fetchApi("/meta/dashboard");
  } catch (error) {}

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
          <span className="text-red-400 text-xl">!</span>
        </div>
        <p className="text-gray-400">API bağlantısı kurulamadı</p>
        <code className="text-xs text-gray-600 bg-[#0d1117] px-3 py-2 rounded-lg">
          php artisan serve --port=8000
        </code>
      </div>
    );
  }

  return (
    <div className="relative">
      <BackgroundAnimation />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-6 space-y-5">
        {/* Slider */}
        <WinRateBanner sliderPool={data.sliderPool} version={data.version} />

        {/* Arama */}
        <SearchBar champions={data.champions} />

        {/* 3'lü ranking grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <RankingCard
            title="Popüler Şampiyonlar"
            champions={data.topPickRate}
            valueKey="pickRate"
            color="blue"
          />
          <RankingCard
            title="En Yüksek Win Rate"
            champions={data.topWinRate}
            valueKey="winRate"
            color="green"
          />
          <RankingCard
            title="En Çok Banlanan"
            champions={data.topBanRate}
            valueKey="banRate"
            color="red"
          />
        </div>

        {/* WR değişimleri + Splash kartlar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <WinRateChanges
            risers={data.risers}
            fallers={data.fallers}
            version={data.version}
          />
          <TopPicked champions={data.topPickRate} />
          <TopBanned champions={data.topBanRate} />
        </div>

        {/* Şampiyonlar sayfasına yönlendirme */}
        <Link
          href="/champions"
          className="glass rounded-xl p-5 flex items-center justify-between group hover:border-blue-500/30 transition-all duration-300"
        >
          <div>
            <h3 className="text-base font-semibold text-gray-200 group-hover:text-white transition-colors">
              Tüm Şampiyonlar
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {data.count} şampiyon — koridor, sınıf ve detaylı bilgiler
            </p>
          </div>
          <svg className="w-5 h-5 text-gray-600 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
