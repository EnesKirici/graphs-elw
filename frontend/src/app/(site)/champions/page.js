import { fetchApi } from "@/lib/api";
import ChampionGrid from "@/components/champion/ChampionGrid";

export const metadata = {
  title: "Tüm Şampiyonlar",
  description: "League of Legends şampiyonlarının tam listesi.",
};

export default async function ChampionsPage() {
  let data = null;
  try {
    data = await fetchApi("/champions");
  } catch {}

  const champions = data?.champions || [];

  return (
    <div className="content">
      <div className="section-head" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800 }}>
          <span className="dot-mark" />Tüm Şampiyonlar
        </h2>
        {champions.length > 0 && (
          <span className="tag">{champions.length} şampiyon · Patch {data?.version}</span>
        )}
      </div>

      {champions.length === 0 ? (
        <div className="card pad">
          <p className="dim" style={{ fontSize: 13 }}>Şampiyon listesi şu anda yüklenemedi. Kısa süre sonra tekrar deneyin.</p>
        </div>
      ) : (
        <div className="card pad">
          <ChampionGrid champions={champions} showSearch={true} />
        </div>
      )}
    </div>
  );
}
