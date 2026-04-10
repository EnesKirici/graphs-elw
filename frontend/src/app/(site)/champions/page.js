/*
  Şampiyonlar Listesi Sayfası
  URL: /champions
*/

import Link from "next/link";
import { fetchApi } from "@/lib/api";
import ChampionGrid from "@/components/champion/ChampionGrid";

export const metadata = {
  title: "Şampiyonlar - GRAPHS",
};

export default async function ChampionsPage() {
  const data = await fetchApi("/champions");

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Breadcrumb + Geri */}
      <div className="flex items-center justify-between mb-6 animate-fade-in-up">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Link href="/" className="hover:text-gray-300 transition-colors">Home</Link>
          <span>›</span>
          <span className="text-gray-300">Şampiyonlar</span>
        </div>
        <Link
          href="/"
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Ana Sayfa
        </Link>
      </div>

      {/* Başlık */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Şampiyonlar</h1>
        <p className="text-gray-500 mt-2">
          Patch {data.version} — {data.count} şampiyon
        </p>
      </div>

      {/* Search + Grid */}
      <ChampionGrid champions={data.champions} />
    </div>
  );
}
