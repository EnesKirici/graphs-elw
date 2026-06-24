/*
  En İyi Duo Partnerleri — ADC+Support sinerji (FAZ 2).
  Kaynak: /champions/{id} → duos.asAdc / duos.asSupport (shrinkage WR + min_games).
  Şampiyon ADC oynanıyorsa en iyi support'lar, support oynanıyorsa en iyi ADC'ler.
*/

const DDRAGON = "https://ddragon.leagueoflegends.com/cdn";

function pct(v) {
  return v == null ? "-" : `${String(v).replace(".", ",")}%`;
}
function wrColor(wr) {
  if (wr >= 53) return "text-emerald-400";
  if (wr >= 50) return "text-blue-400";
  if (wr >= 47) return "text-yellow-400";
  return "text-red-400";
}

function Row({ d, version }) {
  return (
    <div className="flex items-center gap-2.5 py-1">
      <img
        src={`${DDRAGON}/${version}/img/champion/${d.champion}.png`}
        alt={d.champion}
        width={28}
        height={28}
        className="rounded-md border border-edge"
      />
      <span className="text-sm text-gray-200 flex-1 truncate">{d.champion}</span>
      <span className="text-[10px] text-gray-600 tabular-nums">{d.games} maç</span>
      <span
        className={`text-xs font-bold tabular-nums w-[46px] text-right ${wrColor(d.adjWr)}`}
        title={`Gözlenen WR %${pct(d.winRate).replace("%", "")} · ayarlı (örneklem-duyarlı)`}
      >
        {pct(d.adjWr)}
      </span>
    </div>
  );
}

export default function DuoPartners({ duos, version }) {
  if (!duos) return null;

  const sections = [];
  if (duos.asAdc?.length) sections.push({ title: "ADC oynarken — en iyi support", list: duos.asAdc });
  if (duos.asSupport?.length) sections.push({ title: "Support oynarken — en iyi ADC", list: duos.asSupport });
  if (!sections.length) return null;

  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-edge/50 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-200">En İyi Duo Partnerleri</h3>
        <span className="text-[10px] text-gray-600">ayarlı WR</span>
      </div>
      <div className="divide-y divide-edge/30">
        {sections.map((sec) => (
          <div key={sec.title} className="p-4">
            <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold mb-1.5">
              {sec.title}
            </p>
            {sec.list.map((d) => (
              <Row key={d.champion} d={d} version={version} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
