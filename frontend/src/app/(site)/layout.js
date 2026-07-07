import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import MainContent from "@/components/layout/MainContent";
import BackgroundFX from "@/components/dashboard/BackgroundFX";

export default function SiteLayout({ children }) {
  return (
    <>
      <BackgroundFX />
      <MainContent>
        <Navbar />
        <main className="relative z-10 flex-1">{children}</main>
        <footer className="relative z-10 mt-20" style={{ borderTop: "1px solid var(--border)" }}>
          <div style={{ maxWidth: "var(--maxw)", margin: "0 auto", padding: "24px 26px" }}>
            {/* Kısa tanıtım — SEO içerik (görünür metin) */}
            <p className="text-xs leading-relaxed max-w-2xl" style={{ color: "var(--txt-3)" }}>
              <span className="font-semibold" style={{ color: "var(--txt-2)" }}>ElwGraphs</span>, League of Legends
              oyuncu profillerini, maç analizlerini, ELW Score performans puanlamasını, canlı maç ön-analizini
              ve güncel şampiyon meta/tier verilerini tek yerde sunan bir istatistik platformudur.
            </p>
            <div className="flex items-center justify-between flex-wrap gap-3 mt-4 text-xs" style={{ color: "var(--txt-3)" }}>
              <div className="flex items-center gap-2.5">
                <img src="/logo/elw-wordmark.png" alt="ELW GRAPHS" className="brand-word" style={{ height: 14, opacity: 0.7 }} />
                <span>— LoL Analytics</span>
              </div>
              <div className="flex items-center gap-4">
                <Link href="/iletisim" className="hover:text-gray-300 transition-colors">İletişim</Link>
                <Link href="/privacy" className="hover:text-gray-300 transition-colors">Gizlilik</Link>
                <Link href="/terms" className="hover:text-gray-300 transition-colors">Şartlar</Link>
                <span>Riot Games ile bağlantılı değildir</span>
              </div>
            </div>
          </div>
        </footer>
      </MainContent>
    </>
  );
}
