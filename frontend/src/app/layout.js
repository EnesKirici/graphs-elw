import { Geist, Archivo, Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "./dashboard-theme.css";
import Providers from "@/components/Providers";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

// Dashboard tasarım sistemi fontları (Archivo=display, Manrope=gövde, JetBrains=mono)
// Türkçe karakterler için latin-ext şart.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});
const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin", "latin-ext"],
  display: "swap",
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
    // ?v=2: marka yenilendi (mavi EL) — tarayıcının eski favicon önbelleğini kırar
    icon: [
      { url: "/favicon.ico?v=2", sizes: "any" },
      { url: "/favicon-32x32.png?v=2", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png?v=2", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png?v=2",
  },
  manifest: "/site.webmanifest",
};

// Paint öncesi tema uygula → FOUC/flaş yok. localStorage'tan mod + accent +
// arka plan bulanıklığı + saydam kart tercihini okur (hepsi tarayıcıya özel).
const THEME_INIT = `(function(){try{var m=localStorage.getItem('elw-mode');if(m==='light')document.documentElement.classList.add('light');var a=localStorage.getItem('elw-accent');if(a)document.documentElement.style.setProperty('--accent',a);var b=localStorage.getItem('elw-bg-blur');if(b&&b!=='0')document.documentElement.style.setProperty('--bg-blur',b+'px');var g=localStorage.getItem('elw-glass-cards');if(g==='1')document.documentElement.classList.add('glass-cards');var v=localStorage.getItem('elw-bg-veil');if(v==='0')document.documentElement.classList.add('no-veil');}catch(e){}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="tr" suppressHydrationWarning className={`${geist.variable} ${archivo.variable} ${manrope.variable} ${jetbrains.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-screen bg-base text-gray-100 font-sans antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
