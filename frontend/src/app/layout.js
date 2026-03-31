import { Geist } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

export const metadata = {
  title: "GRAPHS - League of Legends Analytics",
  description:
    "LoL meta istatistikleri, şampiyon analizleri ve oyuncu karşılaştırmaları",
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr" className={geist.variable}>
      <body className="min-h-screen bg-[#060a10] text-gray-100 font-sans antialiased">
        <Navbar />
        <main>{children}</main>

        {/* Sayfanın en altında ince bir footer */}
        <footer className="border-t border-[#1b2230]/30 mt-20">
          <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between text-xs text-gray-600">
            <span>GRAPHS.elw — LoL Analytics</span>
            <span>Riot Games ile bağlantılı değildir</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
