import ChampionRadar from "@/components/champion/ChampionRadar";
import StatsTable from "@/components/champion/StatsTable";
import SkinGallery from "@/components/champion/SkinGallery";
import DuoPartners from "@/components/champion/DuoPartners";

/*
  "Detay" tabı içeriği — radar + temel istatistikler + duo partnerleri + ipuçları
  (sol) ve yetenekler + skinler + hikaye (sağ). page.js'ten çıkarıldı; ChampionView
  bu component'i "Detay" tabında render eder.
*/
export default function ChampionDetail({ champ, version, duos, isClassic = false }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Sol kolon — Radar + Base Stats + Duo + İpuçları */}
      <div className="lg:col-span-4 space-y-4">
        <ChampionRadar info={champ.info} />
        <StatsTable stats={champ.stats} />
        {/* Duo sinerjisi maç verisinden gelir → Classic varyantta yok, gizle */}
        {!isClassic && <DuoPartners duos={duos} version={version} />}

        {(champ.allytips?.length > 0 || champ.enemytips?.length > 0) && (
          <div className="glass rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-edge/50 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-200">İpuçları</h3>
              <span className="text-[10px] text-gray-600 italic">Riot verisi — güncel olmayabilir</span>
            </div>
            <div className="p-4 space-y-4">
              {champ.allytips?.length > 0 && (
                <div>
                  <p className="text-[11px] text-blue-400 uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    Oynama İpuçları
                  </p>
                  <ul className="space-y-1.5">
                    {champ.allytips.map((tip, i) => (
                      <li key={i} className="text-xs text-gray-400 leading-relaxed pl-3 border-l border-edge">{tip}</li>
                    ))}
                  </ul>
                </div>
              )}
              {champ.enemytips?.length > 0 && (
                <div>
                  <p className="text-[11px] text-red-400 uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    Karşı Oynama
                  </p>
                  <ul className="space-y-1.5">
                    {champ.enemytips.map((tip, i) => (
                      <li key={i} className="text-xs text-gray-400 leading-relaxed pl-3 border-l border-edge">{tip}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sağ kolon — Yetenekler + Skinler + Hikaye */}
      <div className="lg:col-span-8 space-y-4">
        {/* Yetenekler */}
        <div className="glass rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-edge/50">
            <h3 className="text-sm font-semibold text-gray-200">Yetenekler</h3>
          </div>
          <div className="divide-y divide-edge/30">
            {/* Pasif */}
            <div className="flex items-start gap-4 px-5 py-4 hover:bg-hover transition-colors group">
              <div className="relative flex-shrink-0">
                <img src={champ.passive.image} alt={champ.passive.name} width={48} height={48}
                  className="rounded-lg border border-edge group-hover:border-gray-600 transition-colors" />
                <span className="absolute -top-1.5 -right-1.5 text-[9px] bg-gray-700/90 text-gray-300 px-1.5 py-0.5 rounded font-mono font-bold">P</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-100">{champ.passive.name}</p>
                  <span className="text-[9px] text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">Pasif</span>
                </div>
                <p className="text-xs text-gray-500 mt-1.5 leading-relaxed" dangerouslySetInnerHTML={{ __html: champ.passive.description }} />
              </div>
            </div>

            {/* Q, W, E, R — anahtar rozetleri pasif P ile aynı subtle gri (neon değil) */}
            {champ.spells.map((spell, index) => {
              const keys = ["Q", "W", "E", "R"];
              return (
                <div key={spell.id} className="flex items-start gap-4 px-5 py-4 hover:bg-hover transition-colors group">
                  <div className="relative flex-shrink-0">
                    <img src={spell.image} alt={spell.name} width={48} height={48}
                      className="rounded-lg border border-edge group-hover:border-gray-600 transition-colors" />
                    <span className="absolute -top-1.5 -right-1.5 text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-gray-700/90 text-gray-300">
                      {keys[index]}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-100">{spell.name}</p>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {spell.cooldown && spell.cooldown !== "0" && (
                        <span className="flex items-center gap-1 text-[10px] text-gray-500">
                          <svg className="w-3 h-3 text-blue-400/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                          </svg>
                          {spell.cooldown}s
                        </span>
                      )}
                      {spell.cost && spell.cost !== "0" && (
                        <span className="flex items-center gap-1 text-[10px] text-gray-500">
                          <svg className="w-3 h-3 text-blue-400/60" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" opacity="0.6" />
                          </svg>
                          {spell.cost}
                        </span>
                      )}
                      {spell.range && spell.range !== "self" && spell.range !== "0" && (
                        <span className="flex items-center gap-1 text-[10px] text-gray-500">
                          <svg className="w-3 h-3 text-blue-400/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" /><circle cx="12" cy="10" r="3" />
                          </svg>
                          {spell.range}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-2 leading-relaxed" dangerouslySetInnerHTML={{ __html: spell.description }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Skin Galerisi */}
        {champ.skins?.length > 0 && <SkinGallery skins={champ.skins} championName={champ.name} />}

        {/* Hikaye (normal) / Ne değişti? (Classic: DDragon lore alanına normal↔classic
            farklarını yazmış, <br> içeriyor → HTML olarak render et) */}
        <div className="glass rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-edge/50">
            <h3 className="text-sm font-semibold text-gray-200">{isClassic ? "Ne değişti?" : "Hikaye"}</h3>
          </div>
          <div className="p-5">
            {isClassic ? (
              <p className="text-sm text-gray-400 leading-relaxed" dangerouslySetInnerHTML={{ __html: champ.lore }} />
            ) : (
              <p className="text-sm text-gray-400 leading-relaxed">{champ.lore}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
