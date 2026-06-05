import Link from "next/link";

export default function RankingCard({ title, champions, valueKey, color = "blue" }) {
  const barColors = {
    blue: "bg-blue-500",
    green: "bg-emerald-500",
    red: "bg-red-500",
  };

  const textColors = {
    blue: "text-blue-400",
    green: "text-emerald-400",
    red: "text-red-400",
  };

  /*
    Bar genişliğini hesapla — mutlak ölçek kullan.
    Eskiden maxValue'ya göre orantılıyorduk (top 5 hep %95+ görünüyordu).
    Şimdi sabit ölçekler:
    - winRate: 60% = full bar (44-58 arası değerler net fark gösterir)
    - pickRate: 35% = full bar
    - banRate: 40% = full bar
  */
  const scales = { winRate: 60, pickRate: 35, banRate: 40 };
  const scale = scales[valueKey] || 60;

  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-edge/50">
        <h3 className="text-sm font-semibold text-gray-200">{title}</h3>
      </div>

      <div className="p-4 space-y-3">
        {champions.slice(0, 5).map((champ, i) => (
          <Link
            key={champ.id}
            href={`/champions/${champ.id}`}
            className="flex items-center gap-3 group animate-fade-in-up"
            style={{ opacity: 0, animationDelay: `${i * 60}ms`, animationFillMode: "forwards" }}
          >
            <span className="text-xs text-gray-500 font-mono w-4 text-right">
              {i + 1}.
            </span>

            <img
              src={champ.image}
              alt={champ.name}
              width={28}
              height={28}
              className="rounded-md group-hover:ring-1 ring-white/20 transition-all"
            />

            <span className="text-sm text-gray-300 group-hover:text-gray-100 transition-colors w-20 truncate">
              {champ.name}
            </span>

            <div className="flex-1 flex items-center gap-2">
              <span className={`text-xs font-mono font-medium ${textColors[color]} w-11 text-right`}>
                {champ[valueKey]}%
              </span>
              <div className="flex-1 h-2 bg-edge rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${barColors[color]} animate-fill-bar`}
                  style={{
                    width: `${Math.min((champ[valueKey] / scale) * 100, 100)}%`,
                    animationDelay: `${i * 60 + 200}ms`,
                  }}
                />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="px-4 pb-3">
        <Link
          href="/champions"
          className={`block text-center text-xs ${textColors[color]} hover:underline py-2 rounded-lg hover:bg-hover transition-colors`}
        >
          Tümünü Gör →
        </Link>
      </div>
    </div>
  );
}
