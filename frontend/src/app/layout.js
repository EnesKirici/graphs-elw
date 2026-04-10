import { Geist } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

export const metadata = {
  title: {
    default: "ELW Graphs — League of Legends İstatistik ve Analiz",
    template: "%s | ELW Graphs",
  },
  description: "League of Legends oyuncu profilleri, maç analizleri, ELW Score performans puanlama, şampiyon istatistikleri ve meta takibi.",
  keywords: ["league of legends", "lol", "oyuncu istatistikleri", "maç analizi", "elw score", "lol türkiye", "şampiyon istatistikleri"],
  openGraph: {
    title: "ELW Graphs — League of Legends İstatistik ve Analiz",
    description: "Oyuncu profilleri, maç analizleri, ELW Score performans puanlama sistemi.",
    siteName: "ELW Graphs",
    type: "website",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr" className={geist.variable}>
      <body className="min-h-screen bg-[#060a10] text-gray-100 font-sans antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
