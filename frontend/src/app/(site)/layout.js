import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import MainContent from "@/components/layout/MainContent";
import BackgroundFX from "@/components/dashboard/BackgroundFX";

export default function SiteLayout({ children }) {
  return (
    <>
      <BackgroundFX />
      <Sidebar />
      <MainContent>
        <Navbar />
        <main className="relative z-10 flex-1">{children}</main>
        <footer className="relative z-10 mt-20" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between text-xs" style={{ maxWidth: "var(--maxw)", margin: "0 auto", padding: "20px 26px", color: "var(--txt-3)" }}>
            <div className="flex items-center gap-2.5">
              <img src="/logo/elw-wordmark.png" alt="ELW GRAPHS" className="brand-word" style={{ height: 14, opacity: 0.7 }} />
              <span>— LoL Analytics</span>
            </div>
            <span>Riot Games ile bağlantılı değildir</span>
          </div>
        </footer>
      </MainContent>
    </>
  );
}
