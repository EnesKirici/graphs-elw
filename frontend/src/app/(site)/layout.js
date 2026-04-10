import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import MainContent from "@/components/layout/MainContent";

export default function SiteLayout({ children }) {
  return (
    <>
      <Sidebar />
      <MainContent>
        <Navbar />
        <main className="relative z-10 flex-1">{children}</main>
        <footer className="relative z-10 border-t border-[#1b2230]/30 mt-20">
          <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <img src="/logo/white_3.webp" alt="ELW" width={20} height={20} className="rounded opacity-60" />
              <span>GRAPHS.elw — LoL Analytics</span>
            </div>
            <span>Riot Games ile bağlantılı değildir</span>
          </div>
        </footer>
      </MainContent>
    </>
  );
}
