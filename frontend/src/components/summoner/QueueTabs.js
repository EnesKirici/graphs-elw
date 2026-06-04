"use client";

/*
  Profil sayfasında tekrar eden segmented filtre (Tümü/SoloQ/Flex, Tümü/Dereceli/Normal vb.).
  ChampionPool, RoleRadar, RoleStats ve İstatistik merkezi bunu kullanır.

  Props:
    value     — seçili key
    onChange  — (key) => void
    options   — [{ key, label }]
*/
export default function QueueTabs({ value, onChange, options = [] }) {
  return (
    <div className="flex items-center gap-1">
      {options.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={`text-[11px] px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
            value === opt.key
              ? "bg-blue-500/15 text-blue-400"
              : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
