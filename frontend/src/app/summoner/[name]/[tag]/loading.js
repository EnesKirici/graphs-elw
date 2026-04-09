export default function Loading() {
  return (
    <div>
      {/* Banner skeleton */}
      <div className="relative h-48 md:h-56 overflow-hidden bg-[#0d1117]">
        <div className="absolute inset-0 bg-gradient-to-t from-[#060a10] via-[#060a10]/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0">
          <div className="max-w-7xl mx-auto px-6 pb-5 flex items-end gap-4">
            <div className="w-[84px] h-[84px] rounded-xl bg-[#1b2230] animate-pulse" />
            <div className="space-y-2">
              <div className="h-8 w-48 bg-[#1b2230] rounded-lg animate-pulse" />
              <div className="h-4 w-32 bg-[#1b2230] rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Breadcrumb skeleton */}
      <div className="max-w-7xl mx-auto px-6 py-2.5 border-b border-[#1b2230]/30">
        <div className="h-4 w-40 bg-[#1b2230] rounded animate-pulse" />
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

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          {/* Sol kolon */}
          <div className="space-y-4">
            {/* Rank card skeleton */}
            <div className="glass rounded-xl p-5">
              <div className="h-3 w-16 bg-[#1b2230] rounded animate-pulse mb-3" />
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 bg-[#1b2230] rounded-xl animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-6 w-32 bg-[#1b2230] rounded animate-pulse" />
                  <div className="h-4 w-16 bg-[#1b2230] rounded animate-pulse" />
                  <div className="h-4 w-24 bg-[#1b2230] rounded animate-pulse" />
                </div>
              </div>
              <div className="mt-3 h-1.5 bg-[#1b2230] rounded-full animate-pulse" />
            </div>

            {/* Flex card skeleton */}
            <div className="glass rounded-xl p-4">
              <div className="h-3 w-10 bg-[#1b2230] rounded animate-pulse mb-3" />
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-[#1b2230] rounded-xl animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-28 bg-[#1b2230] rounded animate-pulse" />
                  <div className="h-3 w-20 bg-[#1b2230] rounded animate-pulse" />
                </div>
              </div>
            </div>

            {/* Champion pool skeleton */}
            <div className="glass rounded-xl p-5">
              <div className="h-4 w-28 bg-[#1b2230] rounded animate-pulse mb-4" />
              <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="w-full aspect-square bg-[#1b2230] rounded-lg animate-pulse" />
                ))}
              </div>
            </div>
          </div>

          {/* Sağ kolon */}
          <div className="space-y-4">
            {/* Stats skeleton */}
            <div className="glass rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#1b2230]/50">
                <div className="h-4 w-24 bg-[#1b2230] rounded animate-pulse" />
              </div>
              <div className="p-5 flex items-center justify-around">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <div className="w-[110px] h-[110px] rounded-full bg-[#1b2230] animate-pulse" />
                    <div className="h-3 w-16 bg-[#1b2230] rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </div>

            {/* Match list skeleton */}
            <div className="glass rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#1b2230]/50">
                <div className="h-4 w-32 bg-[#1b2230] rounded animate-pulse" />
              </div>
              <div className="space-y-px">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-4 py-3 flex items-center gap-3">
                    <div className="w-12 h-12 bg-[#1b2230] rounded-xl animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-24 bg-[#1b2230] rounded animate-pulse" />
                      <div className="h-3 w-36 bg-[#1b2230] rounded animate-pulse" />
                    </div>
                    <div className="h-5 w-20 bg-[#1b2230] rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
