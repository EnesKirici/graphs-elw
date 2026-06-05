import Link from "next/link";

export default function TopPicked({ champions }) {
  if (!champions || champions.length === 0) return null;

  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-edge/50 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
        <h3 className="text-sm font-semibold text-gray-200">En Çok Oynanan</h3>
      </div>

      <div className="p-3 grid grid-cols-2 gap-2">
        {champions.slice(0, 4).map((champ, index) => (
          <Link
            key={champ.id}
            href={`/champions/${champ.id}`}
            className="relative group rounded-lg overflow-hidden h-[88px] animate-fade-in-up"
            style={{ opacity: 0, animationDelay: `${index * 60}ms`, animationFillMode: "forwards" }}
          >
            <img
              src={champ.centered}
              alt={champ.name}
              className="absolute inset-0 w-full h-full object-cover opacity-95 group-hover:scale-105 transition-all duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="relative h-full flex items-end p-2.5">
              <div className="flex items-center gap-1.5 w-full">
                <img src={champ.image} alt={champ.name} width={20} height={20} className="rounded-sm border border-white/20" />
                <p className="text-[11px] font-medium text-white truncate flex-1">{champ.name}</p>
                <span className="text-[10px] text-blue-300 font-mono">{champ.pickRate}%</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
