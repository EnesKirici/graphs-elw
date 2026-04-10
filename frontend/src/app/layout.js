import { Geist } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

export const metadata = {
  title: "GRAPHS - League of Legends Analytics",
  description: "LoL meta istatistikleri, şampiyon analizleri ve oyuncu karşılaştırmaları",
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
