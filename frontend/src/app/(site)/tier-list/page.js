import { fetchApi } from "@/lib/api";
import { getSeoOverrides, mergeSeo } from "@/lib/seo";
import TierList from "@/components/champion/TierList";

// Admin → Ayarlar → SEO'dan title/description deploy'suz ezilebilir.
export async function generateMetadata() {
  const seo = await getSeoOverrides();
  return mergeSeo({
    title: "LoL Tier List — Güncel Meta Şampiyon Sıralaması",
    description:
      "Güncel patch League of Legends meta tier list: şampiyonların kazanma, seçilme ve banlanma oranları, koridor dağılımı ve S/A/B tier sıralaması. En güçlü şampiyonlar tek listede.",
    keywords: ["lol tier list", "lol meta", "şampiyon tier", "en iyi şampiyonlar", "lol graph", "meta şampiyonlar", "op şampiyonlar"],
    alternates: { canonical: "/tier-list" },
    openGraph: {
      title: "LoL Tier List — Güncel Meta Şampiyon Sıralaması",
      description: "Güncel patch meta: kazanma/seçilme/banlanma oranları ve tier sıralaması.",
      url: "https://elwgraphs.com/tier-list",
      type: "website",
    },
  }, seo["tier-list"]);
}

export default async function TierListPage() {
  let data = null;
  try {
    data = await fetchApi("/meta/tier-list");
  } catch {}

  const champions = data?.champions || [];
  const totalGames = data?.totalGames || 0;

  return (
    <div className="dpm-scope soft-scope min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Başlık satırı kapsamı da taşır (maç/kuyruk/patch) → araç çubuğu sade kalır */}
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-white">Meta Tier List</h1>
            <p className="text-sm text-gray-500 mt-1">
              Topladığımız maçlardan hesaplanan meta — role göre kazanma / seçilme / banlanma oranı ve koridor dağılımı.
            </p>
          </div>
          {/* Kapsam bilgisi: sayılar okunur olmalı — etiketler soluk gri kalıyordu,
              maç sayısı ve patch beyaz/kalın, açıklama sözcükleri gri. */}
          <div className="flex items-center gap-2 text-xs">
            <span
              className="px-3 py-1.5 rounded-lg bg-white/[0.05] border border-edge whitespace-nowrap text-gray-400"
              title="Topladığımız maçlardan. Production key + ladder crawler ile Emerald+ filtresi gelecek."
            >
              <b className="text-gray-100 font-bold tabular-nums">{totalGames.toLocaleString("tr-TR")}</b> maç
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-white/[0.05] border border-edge whitespace-nowrap text-gray-300">
              Ranked Solo/Flex
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-white/[0.05] border border-edge whitespace-nowrap text-gray-400">
              Patch <b className="text-gray-100 font-bold tabular-nums">{data?.version || data?.patch}</b>
            </span>
          </div>
        </div>

        {champions.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center text-gray-500 text-sm">
            Henüz tier list için yeterli maç verisi toplanmadı. Veri biriktikçe burası dolacak.
          </div>
        ) : (
          <TierList data={data} />
        )}
      </div>
    </div>
  );
}
