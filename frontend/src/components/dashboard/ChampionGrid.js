import Link from "next/link";

export default function ChampionGrid({ champions, version }) {
  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#1b2230]/50 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-200">
            Tüm Şampiyonlar
          </h3>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Patch {version} — {champions.length} şampiyon
          </p>
        </div>
        <Link
          href="/champions"
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          Detaylı Liste →
        </Link>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-16 gap-1.5">
          {champions.map((champ) => (
            <Link
              key={champ.id}
              href={`/champions/${champ.id}`}
              className="group flex flex-col items-center gap-1 p-1 rounded-lg hover:bg-white/5 transition-colors"
              title={champ.name}
            >
              <img
                src={champ.image}
                alt={champ.name}
                width={36}
                height={36}
                className="rounded-md group-hover:ring-1 ring-blue-500/50 transition-all"
              />
              <span className="text-[8px] text-gray-600 group-hover:text-gray-400 text-center leading-tight truncate w-full transition-colors">
                {champ.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
