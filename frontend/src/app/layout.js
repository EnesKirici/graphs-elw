import { Geist, Archivo, Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "./dashboard-theme.css";
import Providers from "@/components/Providers";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import RateLimitToast from "@/components/shared/RateLimitToast";

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
  // Tüm göreli OG/canonical URL'leri buna göre mutlaklaşır.
  metadataBase: new URL("https://elwgraphs.elw.com.tr"),
  title: {
    default: "ElwGraphs — League of Legends İstatistik ve Analiz",
    template: "%s | ElwGraphs",
  },
  description: "League of Legends oyuncu profilleri, maç analizleri, ELW Score performans puanlama, şampiyon istatistikleri ve meta takibi.",
  keywords: [
    "league of legends", "lol", "lol graph", "lol graphs", "league of graphs", "graphs lol",
    "oyuncu istatistikleri", "maç analizi", "canlı maç analizi", "elw score", "lol türkiye",
    "lol champions", "lol şampiyonlar", "lol karakterleri", "şampiyon istatistikleri",
    "tier list", "lol meta", "lol sıralama", "lol profil",
  ],
  applicationName: "ElwGraphs",
  alternates: { canonical: "/" },
  openGraph: {
    title: "ElwGraphs — League of Legends İstatistik ve Analiz",
    description: "Oyuncu profilleri, maç analizleri, ELW Score performans puanlama sistemi.",
    siteName: "ElwGraphs",
    url: "https://elwgraphs.elw.com.tr",
    locale: "tr_TR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ElwGraphs — League of Legends İstatistik ve Analiz",
    description: "Oyuncu profilleri, maç analizleri, ELW Score performans puanlama.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
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
// is-admin: admin mini-bar React beklemeden İLK boyamada görünsün (geç gelme/zıplama olmasın).
const THEME_INIT = `(function(){try{if(localStorage.getItem('admin_token'))document.documentElement.classList.add('is-admin');var m=localStorage.getItem('elw-mode');if(m==='light')document.documentElement.classList.add('light');var a=localStorage.getItem('elw-accent');if(a)document.documentElement.style.setProperty('--accent',a);var b=localStorage.getItem('elw-bg-blur');if(b&&b!=='0')document.documentElement.style.setProperty('--bg-blur',b+'px');var cb=localStorage.getItem('elw-card-blur');if(cb!==null)document.documentElement.style.setProperty('--card-blur',cb+'px');var g=localStorage.getItem('elw-glass-cards');if(g==='1')document.documentElement.classList.add('glass-cards');var v=localStorage.getItem('elw-bg-veil');if(v==='0')document.documentElement.classList.add('no-veil');var bg=localStorage.getItem('site-background');var be=localStorage.getItem('elw-bg-enabled');if(bg&&be!=='0')document.documentElement.classList.add('has-bg');}catch(e){}})();`;

// SEO: yapılandırılmış veri (schema.org) — WebSite + Organization. Arama motorları
// için site kimliği. "geliştirme aşaması" gibi ibareler BURADA yer almaz.
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://elwgraphs.elw.com.tr/#website",
      url: "https://elwgraphs.elw.com.tr",
      name: "ElwGraphs",
      description:
        "League of Legends oyuncu profilleri, maç analizi, ELW Score performans puanlaması, canlı maç ön-analizi ve şampiyon meta/tier verileri.",
      inLanguage: "tr-TR",
    },
    {
      "@type": "Organization",
      "@id": "https://elwgraphs.elw.com.tr/#org",
      name: "ElwGraphs",
      url: "https://elwgraphs.elw.com.tr",
      logo: "https://elwgraphs.elw.com.tr/apple-touch-icon.png",
    },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr" suppressHydrationWarning className={`${geist.variable} ${archivo.variable} ${manrope.variable} ${jetbrains.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        {/* Google Analytics (gtag.js) */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-CF9094L00G" />
        <script dangerouslySetInnerHTML={{ __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-CF9094L00G');` }} />
        {/* Yapılandırılmış veri (schema.org) */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
        {/* Rybbit analytics (self-host: a.elw.com.tr) — dev trafiği sayılmasın diye yalnız production */}
        {process.env.NODE_ENV === "production" && (
          <script src="https://a.elw.com.tr/api/script.js" data-site-id="8a6203c50e34" defer />
        )}
      </head>
      <body className="min-h-screen bg-base text-gray-100 font-sans antialiased">
        <Providers>
          {children}
        </Providers>
        <RateLimitToast />
        <GoogleAnalytics />
      </body>
    </html>
  );
}
