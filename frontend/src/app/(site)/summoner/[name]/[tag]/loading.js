/*
  Profil yükleme iskeleti — GERÇEK yerleşimin aynası (SummonerContent):
  - Banner + sekme çubuğu (ProfileHeader)
  - Sol GENİŞ kolon (lg:col-span-8): Rank kartı + Son Maçlar
  - Sağ SIDEBAR (lg:col-span-4): İstatistikler + En Çok Oynanan + Koridorlar + Challenges
  Yerleşim değişirse burayı da güncelle — eski iskelet farklı düzen gösterip
  "zıplama" yaratıyordu.
*/
export default function Loading() {
  return (
    <div>
      {/* Banner skeleton (ProfileHeader üst kısmı) */}
      <div className="relative h-48 md:h-56 overflow-hidden bg-card">
        <div className="absolute inset-0 bg-gradient-to-t from-base via-base/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0">
          <div className="max-w-7xl mx-auto px-6 pb-5 flex items-end gap-4">
            <div className="w-[84px] h-[84px] rounded-xl bg-edge animate-pulse" />
            <div className="space-y-2">
              <div className="h-8 w-48 bg-edge rounded-lg animate-pulse" />
              <div className="h-4 w-32 bg-edge rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Sekme çubuğu skeleton (Genel Bakış / Şampiyonlar) */}
      <div className="max-w-7xl mx-auto px-6 border-b border-edge/30">
        <div className="flex items-center gap-6 py-3">
          <div className="h-4 w-20 bg-edge rounded animate-pulse" />
          <div className="h-4 w-24 bg-edge rounded animate-pulse" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Yükleniyor mesajı */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="relative w-5 h-5">
            <div className="absolute inset-0 border-2 border-blue-500/30 rounded-full" />
            <div className="absolute inset-0 border-2 border-transparent border-t-blue-400 rounded-full animate-spin" />
          </div>
          <span className="text-sm text-gray-400">Oyuncu bilgileri yükleniyor...</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* ===== Ana kolon (geniş) — Rank kartı + Son Maçlar ===== */}
          <div className="lg:col-span-8 space-y-5">
            {/* Rank kartı: Solo + Flex yan yana + winrate çizgisi */}
            <div className="glass rounded-xl p-5">
              <div className="grid md:grid-cols-2 gap-5">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-20 h-20 bg-edge rounded-xl animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-5 w-28 bg-edge rounded animate-pulse" />
                      <div className="h-3 w-16 bg-edge rounded animate-pulse" />
                      <div className="h-3 w-24 bg-edge rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 h-16 bg-edge/60 rounded-lg animate-pulse" />
            </div>

            {/* Son Maçlar */}
            <div className="glass rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-edge/50">
                <div className="h-4 w-32 bg-edge rounded animate-pulse" />
              </div>
              <div className="divide-y divide-edge/20">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="px-4 py-3 flex items-center gap-3">
                    <div className="w-12 h-12 bg-edge rounded-xl animate-pulse flex-shrink-0" />
                    <div className="flex-1 space-y-2 min-w-0">
                      <div className="h-4 w-28 bg-edge rounded animate-pulse" />
                      <div className="h-3 w-40 bg-edge rounded animate-pulse" />
                    </div>
                    <div className="hidden md:flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <div key={j} className="w-6 h-6 bg-edge rounded animate-pulse" />
                      ))}
                    </div>
                    <div className="h-9 w-16 bg-edge rounded-lg animate-pulse flex-shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ===== Sidebar (dar) — İstatistikler + En Çok Oynanan + Koridorlar + Challenges ===== */}
          <div className="lg:col-span-4 space-y-5">
            {/* İstatistikler (StatsCard) */}
            <div className="glass rounded-xl p-5">
              <div className="h-4 w-24 bg-edge rounded animate-pulse mb-4" />
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-6 w-16 bg-edge rounded animate-pulse" />
                    <div className="h-3 w-20 bg-edge rounded animate-pulse" />
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <div className="h-6 w-24 bg-edge rounded-full animate-pulse" />
                <div className="h-6 w-20 bg-edge rounded-full animate-pulse" />
              </div>
            </div>

            {/* En Çok Oynanan (ChampionPool) */}
            <div className="glass rounded-xl p-5">
              <div className="h-4 w-28 bg-edge rounded animate-pulse mb-4" />
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-edge rounded-lg animate-pulse flex-shrink-0" />
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <div className="h-3.5 w-24 bg-edge rounded animate-pulse" />
                      <div className="h-2.5 w-16 bg-edge rounded animate-pulse" />
                    </div>
                    <div className="h-4 w-12 bg-edge rounded animate-pulse flex-shrink-0" />
                  </div>
                ))}
              </div>
            </div>

            {/* Koridorlar (RoleRadar) */}
            <div className="glass rounded-xl p-5">
              <div className="h-4 w-20 bg-edge rounded animate-pulse mb-4" />
              <div className="mx-auto w-40 h-40 bg-edge/60 rounded-full animate-pulse" />
            </div>

            {/* Challenges */}
            <div className="glass rounded-xl p-5">
              <div className="h-4 w-24 bg-edge rounded animate-pulse mb-4" />
              <div className="space-y-2.5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-3 bg-edge rounded animate-pulse" style={{ width: `${85 - i * 18}%` }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
