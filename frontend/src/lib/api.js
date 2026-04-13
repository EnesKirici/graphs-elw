/*
  API Wrapper - Laravel backend ile iletişim

  Laravel'deki Http::get() gibi düşün. Bu dosya frontend'in
  "Laravel API'sine istek atan" tek noktası.

  Kullanım:
    import { fetchApi } from "@/lib/api";
    const data = await fetchApi("/champions");
    // Bu aslında http://localhost:8000/api/v1/champions adresine gider
*/

// .env.local dosyasından veya varsayılan değerden API URL'sini al
// NEXT_PUBLIC_ prefix'i = bu değişken tarayıcıda da görünür (public)
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

/**
 * Laravel API'sine GET isteği atar.
 *
 * @param {string} endpoint - API endpoint'i (örnek: "/champions")
 * @returns {Promise<any>} - JSON response
 */
export async function fetchApi(endpoint) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    // next.cache: Bu veriyi Next.js sunucu tarafında cache'ler
    // revalidate: 60 saniye sonra yeni veri çek
    next: { revalidate: 60 },
  });

  // Rate limit (429): JSON body'yi parse et ve döndür (throw etme)
  // Backend rateLimited flag ile kısmi veya hata verisi döner
  if (res.status === 429) {
    try {
      const data = await res.json();
      return { ...data, rateLimited: true };
    } catch {
      throw new Error(`API Hatası: 429 - ${endpoint}`);
    }
  }

  if (!res.ok) {
    throw new Error(`API Hatası: ${res.status} - ${endpoint}`);
  }

  return res.json();
}

/**
 * Analytics event'i backend'e POST et.
 */
export async function postAnalytics(endpoint, data) {
  try {
    await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      cache: "no-store",
    });
  } catch {
    // Analytics hatalarını sessizce yut — site çalışmaya devam etsin
  }
}

/**
 * Sayfa kapanırken kalan event'leri sendBeacon ile gönder.
 */
export function sendAnalyticsBeacon(data) {
  try {
    const url = `${API_BASE}/analytics/batch`;
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    navigator.sendBeacon(url, blob);
  } catch {
    // Beacon hatalarını sessizce yut
  }
}
