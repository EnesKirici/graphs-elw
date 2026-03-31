/*
  Şampiyonlar Listesi Sayfası
  URL: /champions
*/

import Link from "next/link";
import { fetchApi } from "@/lib/api";

export const metadata = {
  title: "Şampiyonlar - GRAPHS",
};

export default async function ChampionsPage() {
  const data = await fetchApi("/champions");

  const tagColors = {
    Fighter: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    Tank: "bg-green-500/10 text-green-400 border-green-500/20",
    Mage: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    Assassin: "bg-red-500/10 text-red-400 border-red-500/20",
    Marksman: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    Support: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Başlık */}
      <div className="mb-8 animate-fade-in-up">
        <h1 className="text-3xl font-bold text-white">Şampiyonlar</h1>
        <p className="text-gray-500 mt-2">
          Patch {data.version} — {data.count} şampiyon
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {data.champions.map((champ, i) => (
          <Link
            key={champ.id}
            href={`/champions/${champ.id}`}
            className="group glass rounded-xl p-4 hover:border-blue-500/30 transition-all duration-300 hover:-translate-y-0.5 animate-fade-in-up"
            style={{
              opacity: 0,
              animationDelay: `${Math.min(i * 20, 500)}ms`,
              animationFillMode: "forwards",
            }}
          >
            <div className="flex flex-col items-center gap-3">
              {/* Şampiyon ikonu + glow */}
              <div className="relative">
                <div className="absolute -inset-1 bg-blue-500/0 group-hover:bg-blue-500/20 rounded-xl blur transition-all duration-300" />
                <img
                  src={champ.image}
                  alt={champ.name}
                  width={56}
                  height={56}
                  className="relative rounded-xl group-hover:scale-105 transition-transform duration-300"
                />
              </div>

              <div className="text-center">
                <p className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">
                  {champ.name}
                </p>
                <div className="flex flex-wrap justify-center gap-1 mt-2">
                  {champ.tags.map((tag) => (
                    <span
                      key={tag}
                      className={`text-[9px] px-1.5 py-0.5 rounded-md border ${tagColors[tag] || "bg-gray-500/10 text-gray-400 border-gray-500/20"}`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
