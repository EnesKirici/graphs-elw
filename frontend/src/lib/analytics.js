/*
  Rybbit özel olayları — TEK çağrı noktası.

  Neden gerekti: 2026-08-05 denetiminde Rybbit'te 30 günde YALNIZ `pageview`
  vardı (382 adet, 0 özel olay). Oturum kaydı "bir yere tıklandı / bir alana
  yazıldı" diyordu ama ne anlama geldiğini söylemiyordu. Somut bedeli:
  görünmez Unicode karakteri yüzünden oturumların %7,5'i "Oyuncu Bulunamadı"
  ekranına düşmüştü ve bunu panelde HİÇ göremedik — oturum kayıtları tek tek
  izlenerek bulundu.

  Kural: olay adları TÜRKÇE ve fiil-sonlu ("arama_sonucsuz"), çünkü paneli
  okuyan kişi Türkçe okuyor. props kısa tutulur — ClickHouse'ta her alan bir
  sütun genişlemesi demek.

  Admin (site sahibi) hiçbir olayı tetiklemez: kendi gezintimiz istatistiği
  kirletmesin. Aynı kural AnalyticsContext'te de geçerli, oradan buraya taşındı.
*/

/** Site sahibinin tarayıcısı mı? (admin girişi yapılmış cihaz) */
export function isAdminBrowser() {
  try {
    return !!localStorage.getItem("admin_token");
  } catch {
    // localStorage engelliyse (gizlilik eklentisi) izlemeyi sürdürmek doğru:
    // ziyaretçi olma ihtimali admin olma ihtimalinden çok yüksek.
    return false;
  }
}

/**
 * Rybbit'e özel olay gönder.
 * Script `defer` ile yüklendiği ve reklam engelleyicilerle bloklanabildiği için
 * `window.rybbit` HER ZAMAN olmayabilir — sessizce geçilir, sayfa akışı bozulmaz.
 */
export function trackEvent(name, props) {
  if (typeof window === "undefined") return;
  if (isAdminBrowser()) return;
  try {
    window.rybbit?.event?.(name, props || undefined);
  } catch {
    // Analitik hiçbir koşulda kullanıcı akışını kırmamalı.
  }
}
