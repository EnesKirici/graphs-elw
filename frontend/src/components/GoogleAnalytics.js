import Script from "next/script";

/**
 * Google Analytics 4 (gtag.js) — next/script ile (ekstra bağımlılık yok).
 * Sadece NEXT_PUBLIC_GA_ID tanımlıysa render olur (build zamanında inline'lanır);
 * tanımsızsa hiçbir script eklenmez → GA olmadan da güvenle çalışır.
 *
 * Kurulum: frontend/.env.production içine `NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX` ekleyip
 * `npm run build` (deploy.sh) yeniden çalıştır. SPA sayfa geçişlerini GA4'ün
 * "Enhanced measurement" (history olayları) varsayılan olarak yakalar.
 */
export default function GoogleAnalytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  if (!gaId) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`}
      </Script>
    </>
  );
}
