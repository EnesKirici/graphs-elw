/*
  TopBanned - En çok banlanan şampiyonlar.
  TopPicked ile aynı splash-card stili, kırmızı tema ile.
*/

import Link from "next/link";

export default function TopBanned({ champions }) {
  if (!champions || champions.length === 0) return null;

  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#1b2230]/50 flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-red-400" />
        <h3 className="text-base font-semibold text-gray-200">
          En Çok Banlanan
        </h3>
      </div>

      <div className="p-3 grid grid-cols-2 gap-2">
        {champions.slice(0, 6).map((champ, index) => (
          <Link
            key={champ.id}
            href={`/champions/${champ.id}`}
            className="relative group rounded-lg overflow-hidden h-24 animate-fade-in-up"
            style={{
              opacity: 0,
              animationDelay: `${index * 80}ms`,
              animationFillMode: "forwards",
            }}
          >
            {/* Splash art */}
            <img
              src={champ.splash}
              alt={champ.name}
              className="absolute inset-0 w-full h-full object-cover object-top opacity-95 group-hover:scale-105 transition-all duration-500"
            />
            {/* Kırmızı tint + alt gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-red-950/20 to-transparent" />

            {/* İçerik */}
            <div className="relative h-full flex items-end p-3">
              <div className="flex items-center gap-2 w-full">
                <img
                  src={champ.image}
                  alt={champ.name}
                  width={24}
                  height={24}
                  className="rounded-sm border border-white/20"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">
                    {champ.name}
                  </p>
                </div>
                <span className="text-[11px] text-red-300 font-mono font-medium">
                  {champ.banRate}%
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
