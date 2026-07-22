import { Suspense } from "react";
import { fetchApi } from "@/lib/api";
import { getSeoOverrides, mergeSeo } from "@/lib/seo";
import HeroCarousel from "@/components/dashboard/HeroCarousel";
import BigSearch from "@/components/dashboard/BigSearch";
import MetaRibbon from "@/components/dashboard/MetaRibbon";
import RankColumns from "@/components/dashboard/RankColumns";
import PatchAndTier from "@/components/dashboard/PatchAndTier";
import Players from "@/components/dashboard/Players";
import RateLimitBanner from "@/components/summoner/RateLimitBanner";

// Ana sayfa SEO metadata — kök template'i geçersiz kılan tam başlık + açıklama.
// NOT: "geliştirme aşaması / beta" gibi ibareler META'ya GİRMEZ (yalnız görünür duyuru kartında).
// Admin → Ayarlar → SEO'dan title/description deploy'suz ezilebilir.
export async function generateMetadata() {
  const seo = await getSeoOverrides();
  return mergeSeo({
    title: {
      absolute: "ElwGraphs — LoL Oyuncu İstatistikleri, Maç Analizi ve Meta",
    },
    description:
      "League of Legends oyuncu profilleri, detaylı maç analizi, ELW Score performans puanlaması, canlı maç ön-analizi ve güncel şampiyon meta/tier listesi. Riot ID ile oyuncu ara, performansını incele.",
    alternates: { canonical: "/" },
    openGraph: {
      title: "ElwGraphs — LoL Oyuncu İstatistikleri, Maç Analizi ve Meta",
      description:
        "Oyuncu profilleri, maç analizi, ELW Score, canlı maç ön-analizi ve şampiyon meta/tier verileri tek yerde.",
      url: "https://elwgraphs.elw.com.tr",
      type: "website",
    },
  }, seo.home);
}

/* ---- Öne çıkan oyuncular: ayrı (challenger) uç, Suspense ile stream ---- */
async function PlayersSection() {
  let lb = null;
  try {
    lb = await fetchApi("/leaderboard?tier=challenger");
  } catch {}
  return <Players entries={lb?.entries} />;
}

function PlayersSkeleton() {
  return (
    <div className="section">
      <div className="card pad">
        <div className="section-head" style={{ marginBottom: 10 }}>
          <h2><span className="dot-mark" />Öne Çıkan Oyuncular</h2>
          <span className="tag">TR1 · canlı seri</span>
        </div>
        <div className="players">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="player-row">
              <span className="rank-no num">{i + 1}</span>
              <div className="portrait round skeleton" style={{ width: 40, height: 40 }} />
              <div className="skeleton" style={{ height: 14, width: "40%", borderRadius: 6 }} />
              <div className="skeleton" style={{ height: 12, width: 90, borderRadius: 6 }} />
              <div className="skeleton" style={{ height: 22, width: 56, borderRadius: 20 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---- Asıl dashboard verisi (Suspense ile iskelet gösterilir) ---- */
async function DashboardContent() {
  const [dashRes, statsRes] = await Promise.allSettled([
    fetchApi("/meta/dashboard"),
    fetchApi("/meta/stats"),
  ]);

  const data = dashRes.status === "fulfilled" ? dashRes.value : null;

  // Dashboard verisi olmadan sayfa yok — bağlantı hatası fallback'i
  if (!data) {
    return (
      <div className="content" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 16 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: "color-mix(in oklab, var(--loss) 12%, transparent)", display: "grid", placeItems: "center" }}>
          <span style={{ color: "var(--loss)", fontSize: 22, fontWeight: 800 }}>!</span>
        </div>
        <p className="muted">API bağlantısı kurulamadı</p>
        <code className="mono" style={{ fontSize: 12, color: "var(--txt-3)", background: "var(--surface)", padding: "8px 12px", borderRadius: 8 }}>
          php artisan serve --port=8000
        </code>
      </div>
    );
  }

  const stats = statsRes.status === "fulfilled" ? statsRes.value : null;
  const rateLimited = Boolean(data?.rateLimited || stats?.rateLimited);
  const chips = (data.topWinRate || []).slice(0, 5).map((c) => ({ id: c.id, name: c.name }));

  return (
    <>
      {rateLimited && <RateLimitBanner />}

      <div className="content">
        <HeroCarousel sliderPool={data.sliderPool} version={data.version} />

        <BigSearch chips={chips} />

        <MetaRibbon
          matchesAnalyzed={stats?.matchesAnalyzed}
          trackedPlayers={stats?.trackedPlayers}
          championCount={data.count}
          patch={data.version}
        />

        <RankColumns
          popular={data.topPickRate}
          topWinRate={data.topWinRate}
          topBanned={data.topBanRate}
        />

        <PatchAndTier champions={data.champions} patch={data.version} patchChanges={data.patchChanges} />

        <Suspense fallback={<PlayersSkeleton />}>
          <PlayersSection />
        </Suspense>
      </div>
    </>
  );
}

/* ---- Dashboard iskeleti (ilk yükleme) ---- */
function DashboardSkeleton() {
  return (
    <div className="content">
      <div className="skeleton" style={{ height: 416, borderRadius: 22 }} />
      <div className="section bigsearch-wrap">
        <div className="skeleton" style={{ height: 60, width: "100%", maxWidth: 760, borderRadius: 16 }} />
      </div>
      <div className="section meta-ribbon">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card skeleton" style={{ height: 92 }} />
        ))}
      </div>
      <div className="section">
        <div className="cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card skeleton" style={{ height: 320 }} />
          ))}
        </div>
      </div>
      <div className="section two-col">
        <div className="card skeleton" style={{ height: 280 }} />
        <div className="card skeleton" style={{ height: 280 }} />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
