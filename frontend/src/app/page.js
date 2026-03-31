import { fetchApi } from "@/lib/api";
import HeroSection from "@/components/dashboard/HeroSection";
import WinRateBanner from "@/components/dashboard/WinRateBanner";
import ChampionTable from "@/components/dashboard/ChampionTable";
import FreeRotation from "@/components/dashboard/FreeRotation";
import TopBanned from "@/components/dashboard/TopBanned";
import TopPicked from "@/components/dashboard/TopPicked";
import BackgroundAnimation from "@/components/dashboard/BackgroundAnimation";

export default async function Home() {
  let data = null;
  try {
    data = await fetchApi("/meta/dashboard");
  } catch (error) {
    // API çalışmıyorsa
  }

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
      {/* Arka plan parçacık animasyonu */}
      <BackgroundAnimation />

      {/* Tüm içerik z-10'da (animasyonun üzerinde) */}
      <div className="relative z-10">
        {/* Hero */}
        <HeroSection version={data.version} championCount={data.count} />

        <div className="max-w-7xl mx-auto px-6 pb-16 space-y-6">
          {/* Top Win Rate Banner */}
          <WinRateBanner champions={data.topWinRate} />

          {/* Ücretsiz Rotasyon */}
          <FreeRotation champions={data.freeRotation} />

          {/* Ana içerik grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sol: Win Rate tablosu */}
            <div className="lg:col-span-2">
              <ChampionTable
                title="En Yüksek Win Rate"
                champions={data.topWinRate}
              />
            </div>

            {/* Sağ: Kartlar */}
            <div className="space-y-6">
              <TopPicked champions={data.topPickRate} />
              <TopBanned champions={data.topBanRate} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
