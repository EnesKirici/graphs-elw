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

/*
  Bekleyen olaylar. GEREKLİ, çünkü Rybbit script'i `defer` ile yükleniyor ama
  React'in useEffect'i ondan ÖNCE çalışabiliyor: ilk sürümde olay o anda
  sessizce düşüyordu ve canlıda ölçüldü — `arama_sonucsuz` HİÇ gelmedi, aynı
  sayfada konsoldan elle gönderilen olay sorunsuz düştü (2026-08-05).
  Sayfa açılır açılmaz tetiklenen olaylar (TrackEvent) tam bu yarışa giriyor.
*/
const kuyruk = [];
let yoklayici = null;

/** Script hazırsa kuyruğu boşaltır. Hazır değilse false döner. */
function bosalt() {
  if (!window.rybbit?.event) return false;
  while (kuyruk.length) {
    const [ad, props] = kuyruk.shift();
    try {
      window.rybbit.event(ad, props);
    } catch {
      // Analitik hiçbir koşulda kullanıcı akışını kırmamalı.
    }
  }
  return true;
}

/**
 * Rybbit'e özel olay gönder.
 * Script henüz yüklenmediyse olay kuyruğa alınır ve yükleninceye kadar beklenir.
 * ~10 sn sonra hâlâ yoksa kuyruk BOŞALTILMADAN atılır: reklam engelleyici
 * script'i kalıcı olarak bloklamış olabilir, sonsuza kadar biriktirmenin anlamı yok.
 */
export function trackEvent(name, props) {
  if (typeof window === "undefined") return;
  if (isAdminBrowser()) return;

  kuyruk.push([name, props || undefined]);
  if (bosalt() || yoklayici) return;

  let deneme = 0;
  yoklayici = setInterval(() => {
    deneme += 1;
    if (bosalt() || deneme > 40) {
      clearInterval(yoklayici);
      yoklayici = null;
      if (deneme > 40) kuyruk.length = 0; // script gelmeyecek → belleği bırak
    }
  }, 250);
}
