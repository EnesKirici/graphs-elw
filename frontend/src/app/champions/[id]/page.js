/*
  Şampiyon Detay Sayfası
  URL: /champions/[id]  (örnek: /champions/Yasuo)

  Dinamik route: [id] klasör adındaki köşeli parantez = URL parametresi
  Laravel: Route::get('/champions/{id}', ...)
  Next.js: src/app/champions/[id]/page.js
*/

import { fetchApi } from "@/lib/api";
import Link from "next/link";

// Dinamik metadata - her şampiyonun kendi title'ı olur (SEO)
export async function generateMetadata({ params }) {
  const { id } = await params;
  return { title: `${id} - GRAPHS` };
}

export default async function ChampionDetail({ params }) {
  const { id } = await params;
  const data = await fetchApi(`/champions/${id}`);
  const champ = data.champion;

  const statLabels = {
    attack: { label: "Saldırı", color: "from-red-500 to-orange-500" },
    defense: { label: "Savunma", color: "from-green-500 to-emerald-500" },
    magic: { label: "Büyü", color: "from-blue-500 to-purple-500" },
    difficulty: { label: "Zorluk", color: "from-yellow-500 to-amber-500" },
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Geri butonu */}
      <Link
        href="/champions"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition-colors mb-6"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Şampiyonlara Dön
      </Link>

      {/* Hero - Splash art arka planlı üst bölüm */}
      <div className="relative rounded-2xl overflow-hidden mb-8 animate-fade-in-up">
        {/* Splash art */}
        <img
          src={champ.splash}
          alt={champ.name}
          className="w-full h-64 md:h-80 object-cover object-top"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#060a10] via-[#060a10]/70 to-transparent" />

        {/* Şampiyon bilgisi (overlay üzerinde) */}
        <div className="absolute bottom-0 left-0 right-0 p-8">
          <div className="flex items-end gap-5">
            <img
              src={champ.image}
              alt={champ.name}
              width={72}
              height={72}
              className="rounded-xl border-2 border-[#1b2230] shadow-xl"
            />
            <div>
              <h1 className="text-4xl font-extrabold text-white tracking-tight">
                {champ.name}
              </h1>
              <p className="text-gray-400 mt-1">{champ.title}</p>
              <div className="flex gap-2 mt-2">
                {champ.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs bg-white/10 backdrop-blur text-white/80 px-2.5 py-1 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* İstatistik barları */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {Object.entries(champ.info).map(([key, value], i) => (
          <div
            key={key}
            className="glass rounded-xl p-4 animate-fade-in-up"
            style={{
              opacity: 0,
              animationDelay: `${i * 100 + 200}ms`,
              animationFillMode: "forwards",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                {statLabels[key]?.label || key}
              </p>
              <span className="text-sm font-bold text-white">{value}</span>
            </div>
            <div className="w-full bg-[#1b2230] rounded-full h-2">
              <div
                className={`h-2 rounded-full bg-gradient-to-r ${statLabels[key]?.color || "from-gray-500 to-gray-400"} animate-fill-bar`}
                style={{
                  width: `${value * 10}%`,
                  animationDelay: `${i * 100 + 400}ms`,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Yetenekler */}
      <div className="glass rounded-xl overflow-hidden mb-8 animate-fade-in-up delay-300" style={{ opacity: 0, animationFillMode: 'forwards' }}>
        <div className="px-6 py-4 border-b border-[#1b2230]/50">
          <h2 className="text-lg font-semibold text-white">Yetenekler</h2>
        </div>
        <div className="divide-y divide-[#1b2230]/30">
          {/* Pasif */}
          <div className="flex items-start gap-4 px-6 py-4 hover:bg-white/[0.01] transition-colors">
            <div className="relative flex-shrink-0">
              <img
                src={champ.passive.image}
                alt={champ.passive.name}
                width={44}
                height={44}
                className="rounded-lg"
              />
              <span className="absolute -top-1 -right-1 text-[9px] bg-gray-700 text-gray-300 px-1 rounded font-mono">
                P
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-100">
                {champ.passive.name}
              </p>
              <p
                className="text-xs text-gray-500 mt-1 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: champ.passive.description }}
              />
            </div>
          </div>

          {/* Q, W, E, R */}
          {champ.spells.map((spell, index) => (
            <div
              key={spell.id}
              className="flex items-start gap-4 px-6 py-4 hover:bg-white/[0.01] transition-colors"
            >
              <div className="relative flex-shrink-0">
                <img
                  src={spell.image}
                  alt={spell.name}
                  width={44}
                  height={44}
                  className="rounded-lg"
                />
                <span className="absolute -top-1 -right-1 text-[9px] bg-blue-500/20 text-blue-400 px-1 rounded font-mono font-bold">
                  {["Q", "W", "E", "R"][index]}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-100">
                  {spell.name}
                </p>
                <p
                  className="text-xs text-gray-500 mt-1 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: spell.description }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hikaye */}
      <div className="glass rounded-xl p-6 animate-fade-in-up delay-400" style={{ opacity: 0, animationFillMode: 'forwards' }}>
        <h2 className="text-lg font-semibold text-white mb-4">Hikaye</h2>
        <p className="text-sm text-gray-400 leading-relaxed">{champ.lore}</p>
      </div>
    </div>
  );
}
