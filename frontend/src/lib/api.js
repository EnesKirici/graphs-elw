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
 * 429 yakalanınca tarayıcıda RateLimitToast'a haber ver (sağ üst bildirim).
 * SSR'da window yok → sessizce atlanır.
 */
function notifyRateLimited() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("elw:rate-limited"));
  }
}

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
    notifyRateLimited();
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
 * Tek oyuncunun ELW skor kırılımı (şeffaflık modalı).
 * mode: "individual" (carry — maç kartı ölçeği) | "team".
 */
export async function getElwBreakdown(matchId, puuid, mode = "individual") {
  return fetchApi(
    `/matches/${encodeURIComponent(matchId)}/elw/${encodeURIComponent(puuid)}?mode=${mode}`
  );
}

/**
 * Canlı maç verisi — name/tag ile arar.
 * Oyuncu oyunda değilse backend 404 + {status:"offline"} döner; bu bir HATA
 * DEĞİL geçerli bir durum olduğu için 404'ü özel ele alıyoruz (throw etmez).
 * Canlı veri olduğu için cache: "no-store".
 */
export async function getLiveGame(name, tag) {
  const res = await fetch(
    `${API_BASE}/live/search?name=${encodeURIComponent(name)}&tag=${encodeURIComponent(tag)}`,
    { cache: "no-store" }
  );
  if (res.status === 404) {
    try {
      return await res.json(); // { status: "offline", puuid, profile }
    } catch {
      return { status: "offline" };
    }
  }
  if (res.status === 429) {
    notifyRateLimited();
    try {
      return { ...(await res.json()), rateLimited: true };
    } catch {
      return { rateLimited: true };
    }
  }
  if (!res.ok) return null;
  return res.json();
}

/**
 * Tek oyuncunun ağır (son-maç türevli) verisi — kart başına progresif çağrı.
 * Hata olursa null döner; UI zarifçe bozulmadan devam etsin.
 */
export async function getLivePlayer(puuid, champion, opts = {}) {
  try {
    const params = new URLSearchParams();
    if (champion) params.set("champion", champion);
    if (opts.role) params.set("role", opts.role);
    if (opts.autofilled) params.set("autofilled", "1");
    if (opts.enemyChamps?.length) params.set("enemyChamps", opts.enemyChamps.join(","));
    const q = params.toString() ? `?${params}` : "";
    const res = await fetch(`${API_BASE}/live/player/${puuid}${q}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/**
 * "Oyunda mı?" — profil sayfasındaki yeşil tık için hafif kontrol.
 */
export async function getLiveStatus(puuid) {
  try {
    const res = await fetch(`${API_BASE}/live/${puuid}/status`, { cache: "no-store" });
    if (!res.ok) return { inGame: false };
    return res.json();
  } catch {
    return { inGame: false };
  }
}

/**
 * Public ayarları getir (profil tasarımı, ELW eşikleri vb.).
 * Hata durumunda boş obje döner — sayfa yine de render olsun.
 */
export async function getPublicSettings() {
  try {
    return await fetchApi("/settings/public");
  } catch {
    return {};
  }
}

/**
 * Analytics event'i backend'e POST et.
 */
export async function postAnalytics(endpoint, data) {
  try {
    await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
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
