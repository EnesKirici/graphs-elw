"use client";

/*
  Koridor seçici — Genel ve Build sekmeleri AYNI seçimi paylaşır (state ChampionView'da).
  İki sekmede iki ayrı state tutulsaydı sekme değiştirince rol sıfırlanır, kullanıcı
  Top'u seçip Build'e geçtiğinde karşısına Mid çıkardı.
*/

const ROLE_LABELS = { TOP: "Top", JUNGLE: "Jungle", MIDDLE: "Mid", BOTTOM: "ADC", UTILITY: "Support", SUPPORT: "Support" };
const ROLE_ICON = {
  TOP: "/roles/top.svg", JUNGLE: "/roles/jungle.svg", MIDDLE: "/roles/mid.svg",
  BOTTOM: "/roles/bot.svg", UTILITY: "/roles/support.svg", SUPPORT: "/roles/support.svg",
};

export { ROLE_LABELS, ROLE_ICON };

export default function RoleSelector({ positions, role, onRole, lowSample }) {
  if (!positions || positions.length < 2) return null;

  return (
    <div className="px-4 py-2.5 border-b border-edge/40 flex items-center gap-3 flex-wrap">
      <span className="text-[10px] text-gray-500 uppercase tracking-wider">Koridor</span>
      <div className="flex items-center gap-1.5">
        {positions.map((p) => (
          <button
            key={p.position}
            onClick={() => onRole(p.position)}
            title={`${(p.games ?? 0).toLocaleString("tr-TR")} maç · %${p.winRate} kazanma`}
            className={`flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-200 cursor-pointer ${
              role === p.position
                ? "bg-blue-500/15 border-blue-400/40 text-white"
                : "bg-edge/20 border-edge/40 text-gray-400 hover:text-gray-200 hover:border-edge"
            }`}
          >
            <img src={ROLE_ICON[p.position]} alt="" width={18} height={18} className={role === p.position ? "" : "opacity-60"} />
            {ROLE_LABELS[p.position] || p.position}
            <span className={`text-[10px] font-normal ${role === p.position ? "text-blue-300" : "text-gray-600"}`}>
              {p.share}%
            </span>
          </button>
        ))}
      </div>
      {lowSample && (
        <span className="ml-auto text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
          Düşük örneklem
        </span>
      )}
    </div>
  );
}
