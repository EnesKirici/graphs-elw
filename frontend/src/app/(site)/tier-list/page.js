import { fetchApi } from "@/lib/api";
import TierList from "@/components/champion/TierList";

export const metadata = {
  title: "Meta Tier List",
  description: "Güncel patch meta tier list — şampiyonların kazanma, seçilme ve banlanma oranları ve tier sıralaması.",
};

export default async function TierListPage() {
  let data = null;
  try {
    data = await fetchApi("/champions");
  } catch {}

  const champions = data?.champions || [];

  return (
    <div className="dpm-scope min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="mb-5">
          <h1 className="text-2xl font-extrabold text-white">Meta Tier List</h1>
          <p className="text-sm text-gray-500 mt-1">
            Güncel patch'in en güçlü şampiyonları — role göre kazanma / seçilme / banlanma oranı.
          </p>
        </div>

        {champions.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center text-gray-500 text-sm">
            Şampiyon listesi şu anda yüklenemedi. Kısa süre sonra tekrar deneyin.
          </div>
        ) : (
          <TierList champions={champions} version={data?.version} />
        )}
      </div>
    </div>
  );
}
