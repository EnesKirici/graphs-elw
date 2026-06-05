/*
  WinRateChanges - Geçmiş patch'e kıyasla WR değişimi.
  Yeşil: yükselen, Kırmızı: düşen.
*/

import Link from "next/link";

export default function WinRateChanges({ risers, fallers, version }) {
  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-edge/50 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-200">
          Patch {version} Win Rate Değişimleri
        </h3>
      </div>

      <div className="p-4 grid grid-cols-2 gap-6">
        {/* Yükselen */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-emerald-500 mb-3 font-medium flex items-center gap-1.5">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
            </svg>
            Yükselen
          </p>
          <div className="space-y-2.5">
            {risers.map((champ, i) => (
              <Link
                key={champ.id}
                href={`/champions/${champ.id}`}
                className="flex items-center gap-2.5 group animate-fade-in-left"
                style={{
                  opacity: 0,
                  animationDelay: `${i * 80}ms`,
                  animationFillMode: "forwards",
                }}
              >
                <img
                  src={champ.image}
                  alt={champ.name}
                  width={28}
                  height={28}
                  className="rounded-md"
                />
                <span className="text-sm text-gray-300 group-hover:text-white transition-colors flex-1">
                  {champ.name}
                </span>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  +{champ.wrChange}%
                </span>
                <div className="w-12 h-1.5 bg-edge rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 animate-fill-bar"
                    style={{ width: `${(champ.wrChange / 3) * 100}%`, animationDelay: `${i * 80 + 200}ms` }}
                  />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Düşen */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-red-500 mb-3 font-medium flex items-center gap-1.5">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
            Düşen
          </p>
          <div className="space-y-2.5">
            {fallers.map((champ, i) => (
              <Link
                key={champ.id}
                href={`/champions/${champ.id}`}
                className="flex items-center gap-2.5 group animate-fade-in-left"
                style={{
                  opacity: 0,
                  animationDelay: `${i * 80}ms`,
                  animationFillMode: "forwards",
                }}
              >
                <img
                  src={champ.image}
                  alt={champ.name}
                  width={28}
                  height={28}
                  className="rounded-md"
                />
                <span className="text-sm text-gray-300 group-hover:text-white transition-colors flex-1">
                  {champ.name}
                </span>
                <span className="text-xs font-mono font-bold text-red-400">
                  {champ.wrChange}%
                </span>
                <div className="w-12 h-1.5 bg-edge rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-red-500 animate-fill-bar"
                    style={{ width: `${(Math.abs(champ.wrChange) / 3) * 100}%`, animationDelay: `${i * 80 + 200}ms` }}
                  />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
