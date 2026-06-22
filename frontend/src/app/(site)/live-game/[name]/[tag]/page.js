import Link from "next/link";
import { getLiveGame } from "@/lib/api";
import LiveGameBoard from "@/components/live/LiveGameBoard";
import liveFixture from "@/lib/live-fixture.json";

export async function generateMetadata({ params }) {
  const { name, tag } = await params;
  const dn = decodeURIComponent(name);
  const dt = decodeURIComponent(tag);
  return {
    title: `${dn}#${dt} — Canlı Maç`,
    description: `${dn}#${dt} oyuncusunun canlı maçı: takım ve rakip istatistikleri, rozetler ve build.`,
  };
}

/** Ortak boş-durum kabuğu (offline / bulunamadı / rate limit). */
function StateShell({ icon, title, children, profileHref }) {
  return (
    <div className="max-w-[640px] mx-auto px-6 py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-soft flex items-center justify-center mx-auto mb-4 text-3xl">
        {icon}
      </div>
      <h1 className="text-xl font-bold text-gray-100 mb-2">{title}</h1>
      <div className="text-gray-400 text-sm">{children}</div>
      <div className="mt-6 flex items-center justify-center gap-4 text-sm">
        {profileHref && (
          <Link href={profileHref} className="text-blue-400 hover:underline">← Profile dön</Link>
        )}
        <Link href="/" className="text-gray-500 hover:text-gray-300">Ana Sayfa</Link>
      </div>
    </div>
  );
}

export default async function LiveGamePage({ params, searchParams }) {
  const { name, tag } = await params;
  const sp = (await searchParams) || {};
  const dn = decodeURIComponent(name);
  const dt = decodeURIComponent(tag);
  const profileHref = `/summoner/${encodeURIComponent(dn)}/${encodeURIComponent(dt)}`;

  // ?mock=1 → API'ye gitmeden fixture ile çalış (tasarım/screenshot için)
  let data;
  if (sp.mock) {
    data = liveFixture;
  } else {
    try {
      data = await getLiveGame(dn, dt);
    } catch {
      data = null;
    }
  }

  return (
    <div className="dpm-scope min-h-screen">
      {(() => {
        if (data?.rateLimited && data?.status !== "ingame" && data?.status !== "offline") {
          return (
            <StateShell icon="⏳" title="Sunucu Yoğunluğu" profileHref={profileHref}>
              Riot API istek limiti aşıldı. Lütfen birkaç dakika sonra tekrar deneyin.
            </StateShell>
          );
        }
        if (!data) {
          return (
            <StateShell icon="!" title="Oyuncu Bulunamadı" profileHref={profileHref}>
              {dn}#{dt} bulunamadı.
            </StateShell>
          );
        }
        if (data.status === "offline") {
          return (
            <StateShell icon="🎮" title="Şu An Oyunda Değil" profileHref={profileHref}>
              <span className="text-gray-200 font-semibold">{dn}#{dt}</span> şu anda bir maçta değil.
              Oyuncu maça girince bu sayfa canlı verilerle dolar.
            </StateShell>
          );
        }
        return <LiveGameBoard game={data} />;
      })()}
    </div>
  );
}
