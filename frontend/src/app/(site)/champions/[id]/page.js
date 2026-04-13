/*
  Şampiyon Detay Sayfası
  URL: /champions/[id]  (örnek: /champions/Yasuo)

  Dinamik route: [id] klasör adındaki köşeli parantez = URL parametresi
  Laravel: Route::get('/champions/{id}', ...)
  Next.js: src/app/champions/[id]/page.js
*/

import { fetchApi } from "@/lib/api";
import Link from "next/link";
import ChampionRadar from "@/components/champion/ChampionRadar";
import StatsTable from "@/components/champion/StatsTable";
import SkinGallery from "@/components/champion/SkinGallery";

// Dinamik metadata - her şampiyonun kendi title'ı olur (SEO)
export async function generateMetadata({ params }) {
  const { id } = await params;
  return {
    title: `${id} — Şampiyon Detayı`,
    description: `${id} şampiyon yetenekleri, skinleri ve istatistikleri.`,
  };
}

// Tag renk mapping
const tagConfig = {
  Fighter:  { color: "bg-orange-500/10 text-orange-400 border-orange-500/20", label: "Dövüşçü" },
  Tank:     { color: "bg-green-500/10 text-green-400 border-green-500/20",   label: "Tank" },
  Mage:     { color: "bg-blue-500/10 text-blue-400 border-blue-500/20",     label: "Büyücü" },
  Assassin: { color: "bg-red-500/10 text-red-400 border-red-500/20",        label: "Suikastçi" },
  Marksman: { color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", label: "Nişancı" },
  Support:  { color: "bg-teal-500/10 text-teal-400 border-teal-500/20",     label: "Destek" },
};

const positionConfig = {
  TOP:     { label: "Top",    color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  JUNGLE:  { label: "Jungle", color: "bg-green-500/10 text-green-400 border-green-500/20" },
  MIDDLE:  { label: "Mid",    color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  BOTTOM:  { label: "Bot",    color: "bg-red-500/10 text-red-400 border-red-500/20" },
  SUPPORT: { label: "Sup",    color: "bg-teal-500/10 text-teal-400 border-teal-500/20" },
};

export default async function ChampionDetail({ params }) {
  const { id } = await params;
  const data = await fetchApi(`/champions/${id}`);
  const champ = data.champion;

  return (
    <div>
      {/* ===== HERO BANNER ===== */}
      <div className="relative h-56 md:h-72 overflow-hidden">
        <img
          src={champ.splash}
          alt={champ.name}
          className="w-full h-full object-cover object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#060a10] via-[#060a10]/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#060a10]/60 via-transparent to-transparent" />

        {/* Şampiyon bilgisi overlay */}
        <div className="absolute bottom-0 left-0 right-0">
          <div className="max-w-7xl mx-auto px-6 pb-5 flex items-end gap-5">
            <div className="relative">
              <img
                src={champ.image}
                alt={champ.name}
                width={84}
                height={84}
                className="rounded-xl border-2 border-[#1b2230] shadow-2xl"
              />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight drop-shadow-lg">
                {champ.name}
              </h1>
              <p className="text-gray-400 mt-0.5 italic">{champ.title}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {champ.tags.map((tag) => {
                  const cfg = tagConfig[tag];
                  return (
                    <span
                      key={tag}
                      className={`text-xs px-2.5 py-1 rounded-md border ${cfg?.color || "bg-gray-500/10 text-gray-400 border-gray-500/20"}`}
                    >
                      {cfg?.label || tag}
                    </span>
                  );
                })}
                {champ.positions?.length > 0 && (
                  <>
                    <span className="text-gray-600">·</span>
                    {champ.positions.map((pos) => {
                      const cfg = positionConfig[pos];
                      const rate = champ.positionRates?.[pos];
                      return (
                        <span
                          key={pos}
                          className={`text-xs px-2.5 py-1 rounded-md border ${cfg?.color || "bg-gray-500/10 text-gray-400 border-gray-500/20"}`}
                        >
                          {cfg?.label || pos}{rate != null && ` ${rate}%`}
                        </span>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== BREADCRUMB ===== */}
      <div className="max-w-7xl mx-auto px-6 py-2.5 border-b border-[#1b2230]/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Link href="/" className="hover:text-gray-300 transition-colors">Home</Link>
            <span>›</span>
            <Link href="/champions" className="hover:text-gray-300 transition-colors">Şampiyonlar</Link>
            <span>›</span>
            <span className="text-gray-300">{champ.name}</span>
          </div>
          <Link
            href="/champions"
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Şampiyonlara Dön
          </Link>
        </div>
      </div>

      {/* ===== ANA İÇERİK — 2 Kolon ===== */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* Sol kolon — Radar + Base Stats */}
          <div className="lg:col-span-4 space-y-4">
            <ChampionRadar info={champ.info} />
            <StatsTable stats={champ.stats} />

            {/* İpuçları */}
            {(champ.allytips?.length > 0 || champ.enemytips?.length > 0) && (
              <div className="glass rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#1b2230]/50 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-200">İpuçları</h3>
                  <span className="text-[10px] text-gray-600 italic">Riot verisi — güncel olmayabilir</span>
                </div>
                <div className="p-4 space-y-4">
                  {champ.allytips?.length > 0 && (
                    <div>
                      <p className="text-[11px] text-emerald-400 uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Oynama İpuçları
                      </p>
                      <ul className="space-y-1.5">
                        {champ.allytips.map((tip, i) => (
                          <li key={i} className="text-xs text-gray-400 leading-relaxed pl-3 border-l border-[#1b2230]">
                            {tip}
                          </li>
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
                          <li key={i} className="text-xs text-gray-400 leading-relaxed pl-3 border-l border-[#1b2230]">
                            {tip}
                          </li>
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
            <div className="glass rounded-xl overflow-hidden animate-fade-in-up">
              <div className="px-5 py-3.5 border-b border-[#1b2230]/50">
                <h3 className="text-sm font-semibold text-gray-200">Yetenekler</h3>
              </div>
              <div className="divide-y divide-[#1b2230]/30">
                {/* Pasif */}
                <div className="flex items-start gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors group">
                  <div className="relative flex-shrink-0">
                    <img
                      src={champ.passive.image}
                      alt={champ.passive.name}
                      width={48}
                      height={48}
                      className="rounded-lg border border-[#1b2230] group-hover:border-gray-600 transition-colors"
                    />
                    <span className="absolute -top-1.5 -right-1.5 text-[9px] bg-gray-700/90 text-gray-300 px-1.5 py-0.5 rounded font-mono font-bold">
                      P
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-100">{champ.passive.name}</p>
                      <span className="text-[9px] text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">Pasif</span>
                    </div>
                    <p
                      className="text-xs text-gray-500 mt-1.5 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: champ.passive.description }}
                    />
                  </div>
                </div>

                {/* Q, W, E, R */}
                {champ.spells.map((spell, index) => {
                  const keys = ["Q", "W", "E", "R"];
                  const keyColors = [
                    "bg-blue-500/20 text-blue-400 border-blue-500/30",
                    "bg-green-500/20 text-green-400 border-green-500/30",
                    "bg-purple-500/20 text-purple-400 border-purple-500/30",
                    "bg-red-500/20 text-red-400 border-red-500/30",
                  ];

                  return (
                    <div
                      key={spell.id}
                      className="flex items-start gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors group"
                    >
                      <div className="relative flex-shrink-0">
                        <img
                          src={spell.image}
                          alt={spell.name}
                          width={48}
                          height={48}
                          className="rounded-lg border border-[#1b2230] group-hover:border-gray-600 transition-colors"
                        />
                        <span className={`absolute -top-1.5 -right-1.5 text-[10px] px-1.5 py-0.5 rounded font-mono font-bold border ${keyColors[index]}`}>
                          {keys[index]}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-100">{spell.name}</p>
                        </div>

                        {/* Cooldown / Cost / Range */}
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          {spell.cooldown && spell.cooldown !== "0" && (
                            <span className="flex items-center gap-1 text-[10px] text-gray-500">
                              <svg className="w-3 h-3 text-blue-400/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 6v6l4 2" />
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
                                <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
                                <circle cx="12" cy="10" r="3" />
                              </svg>
                              {spell.range}
                            </span>
                          )}
                        </div>

                        <p
                          className="text-xs text-gray-500 mt-2 leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: spell.description }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Skin Galerisi */}
            {champ.skins?.length > 0 && (
              <SkinGallery skins={champ.skins} championName={champ.name} />
            )}

            {/* Hikaye */}
            <div className="glass rounded-xl overflow-hidden animate-fade-in-up">
              <div className="px-5 py-3.5 border-b border-[#1b2230]/50">
                <h3 className="text-sm font-semibold text-gray-200">Hikaye</h3>
              </div>
              <div className="p-5">
                <p className="text-sm text-gray-400 leading-relaxed">{champ.lore}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
