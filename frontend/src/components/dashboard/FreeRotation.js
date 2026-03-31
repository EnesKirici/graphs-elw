/*
  FreeRotation - Haftalık ücretsiz şampiyon rotasyonu.

  Yatay kaydırılabilir bir şampiyon listesi.
  Her şampiyonun üzerine gelince hafif bir "glow" efekti var.
*/

import Link from "next/link";

export default function FreeRotation({ champions }) {
  if (!champions || champions.length === 0) return null;

  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#1b2230]/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <h3 className="text-base font-semibold text-gray-200">
            Ücretsiz Rotasyon
          </h3>
        </div>
        <span className="text-xs text-gray-500">Bu hafta</span>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-5 sm:grid-cols-10 lg:grid-cols-10 gap-3">
          {champions.map((champ, index) => (
            <Link
              key={champ.id}
              href={`/champions/${champ.id}`}
              className="group flex flex-col items-center gap-2 animate-fade-in-up"
              style={{
                opacity: 0,
                animationDelay: `${index * 40}ms`,
                animationFillMode: "forwards",
              }}
            >
              {/* Şampiyon ikonu + glow efekti */}
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/0 to-cyan-500/0 group-hover:from-blue-500/30 group-hover:to-cyan-500/30 rounded-xl blur transition-all duration-300" />
                <img
                  src={champ.image}
                  alt={champ.name}
                  width={52}
                  height={52}
                  className="relative rounded-lg border border-[#1b2230] group-hover:border-blue-500/40 transition-all duration-300 group-hover:scale-105"
                />
              </div>
              <span className="text-[10px] text-gray-500 group-hover:text-gray-300 transition-colors text-center leading-tight truncate w-full">
                {champ.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
